"""
ConsultMatch FastAPI backend — v13
Role-level postings. Consultants apply to roles, not projects.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, httpx

from data.synthetic import CONSULTANTS, PROJECTS, ROLES
from scoring import compute_score, rank_roles_for_consultant, rank_consultants_for_role

app = FastAPI(title="ConsultMatch API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://consultmatch.vercel.app",
        "https://consultmatch-xi.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ───────────────────────────────────────────
_custom_consultants: dict[str, dict] = {}
_applications: dict[str, list] = {}   # consultant_id -> [{role_id, status, cv_text, ...}]
_likes: dict[str, list] = {}           # consultant_id -> [role_id, ...]

_p_lookup = {p["id"]: p for p in PROJECTS}
_r_lookup = {r["role_id"]: r for r in ROLES}

def get_all_consultants():
    return CONSULTANTS + list(_custom_consultants.values())

def get_c_lookup():
    return {c["id"]: c for c in get_all_consultants()}


# ── Models ────────────────────────────────────────────────────
class CustomProfile(BaseModel):
    id: str; name: str; cl: int; cl_title: str
    skills: list[str]; preferred_industries: list[str]
    wfh_preference: str; work_style: str
    preferred_duration: str; career_goal: str
    available_from: str
    cvText: Optional[str] = ""
    cvFileName: Optional[str] = ""
    cvFileBase64: Optional[str] = ""

class ApplicationRequest(BaseModel):
    consultant_id: str; role_id: str
    cv_text: Optional[str] = ""

class LikeRequest(BaseModel):
    consultant_id: str; role_id: str

class CustomScoreRequest(BaseModel):
    consultant: dict; role_id: str

class TailorRequest(BaseModel):
    cv_text: Optional[str] = ""
    role_id: str
    file_base64: Optional[str] = None
    file_name: Optional[str] = None

class StatusUpdate(BaseModel):
    consultant_id: str; role_id: str; status: str


# ── Custom profile ────────────────────────────────────────────
@app.post("/consultants/register")
def register_custom_consultant(profile: CustomProfile):
    _custom_consultants[profile.id] = profile.model_dump()
    return {"status": "registered", "id": profile.id}


# ── Consultants ───────────────────────────────────────────────
@app.get("/consultants")
def list_consultants():
    return get_all_consultants()

@app.get("/consultants/{consultant_id}")
def get_consultant(consultant_id: str):
    c = get_c_lookup().get(consultant_id)
    if not c: raise HTTPException(404, "Not found")
    return c

@app.get("/consultants/{consultant_id}/recommendations")
def get_recommendations(consultant_id: str):
    c = get_c_lookup().get(consultant_id)
    if not c: raise HTTPException(404, "Not found")
    return rank_roles_for_consultant(c, ROLES)


# ── Roles ─────────────────────────────────────────────────────
@app.get("/roles")
def list_roles():
    return ROLES

@app.get("/roles/{role_id}")
def get_role(role_id: str):
    r = _r_lookup.get(role_id)
    if not r: raise HTTPException(404, "Not found")
    return r

@app.get("/roles/{role_id}/candidates")
def get_role_candidates(role_id: str):
    r = _r_lookup.get(role_id)
    if not r: raise HTTPException(404, "Not found")
    applicant_by_cid = {
        cid: a for cid, apps in _applications.items()
        for a in apps if a["role_id"] == role_id
    }
    liked_by = {cid for cid, rids in _likes.items() if role_id in rids}
    candidates = []
    for c in rank_consultants_for_role(r, get_all_consultants()):
        cid = c["id"]
        candidates.append({
            **c,
            "has_applied": cid in applicant_by_cid,
            "has_liked": cid in liked_by,
            "cv_text": applicant_by_cid.get(cid, {}).get("cv_text",""),
            "application_status": applicant_by_cid.get(cid, {}).get("status",""),
        })
    return candidates


# ── Projects ──────────────────────────────────────────────────
@app.get("/projects")
def list_projects():
    return PROJECTS

@app.get("/projects/{project_id}")
def get_project(project_id: str):
    p = _p_lookup.get(project_id)
    if not p: raise HTTPException(404, "Not found")
    return p

@app.get("/projects/{project_id}/roles")
def get_project_roles(project_id: str):
    """All role postings for a specific project."""
    return [r for r in ROLES if r["project_id"] == project_id]

@app.post("/projects/{project_id}/propose-team")
def propose_team(project_id: str):
    """Propose best team for a project across all its role slots."""
    project_roles = [r for r in ROLES if r["project_id"] == project_id]
    if not project_roles: raise HTTPException(404, "No roles found")

    all_consultants = get_all_consultants()
    applicant_by_cid = {
        cid: a for cid, apps in _applications.items()
        for a in apps if a.get("role_id","").startswith(project_id)
    }
    liked_by = {cid for cid, rids in _likes.items()
                if any(rid.startswith(project_id) for rid in rids)}

    proposed = []
    used = set()
    for role in project_roles:
        candidates = rank_consultants_for_role(role, all_consultants)
        scored = []
        for c in candidates:
            if c["id"] in used: continue
            cid = c["id"]
            boost = 10 if cid in applicant_by_cid else (5 if cid in liked_by else 0)
            scored.append({**c, "adjusted": c["score"]["total"] + boost,
                          "has_applied": cid in applicant_by_cid,
                          "has_liked": cid in liked_by})
        scored.sort(key=lambda x: x["adjusted"], reverse=True)
        best = scored[0] if scored else None
        if best: used.add(best["id"])
        proposed.append({"role": role, "proposed": [best] if best else []})

    return {"project_id": project_id, "proposed_team": proposed}


# ── Likes ─────────────────────────────────────────────────────
@app.post("/likes")
def toggle_like(req: LikeRequest):
    liked = _likes.setdefault(req.consultant_id, [])
    if req.role_id in liked:
        liked.remove(req.role_id)
        return {"status": "unliked"}
    liked.append(req.role_id)
    return {"status": "liked"}

@app.get("/likes/{consultant_id}")
def get_likes(consultant_id: str):
    return {"liked": _likes.get(consultant_id, [])}


# ── Applications ──────────────────────────────────────────────
@app.post("/applications")
def apply_to_role(req: ApplicationRequest):
    apps = _applications.setdefault(req.consultant_id, [])
    if any(a["role_id"] == req.role_id for a in apps):
        raise HTTPException(400, "Already applied to this role")
    from datetime import datetime
    apps.append({
        "role_id": req.role_id,
        "status": "Applied",
        "cv_text": req.cv_text,
        "applied_at": datetime.utcnow().isoformat(),
    })
    return {"status": "ok"}

@app.get("/applications/{consultant_id}")
def get_applications(consultant_id: str):
    apps = _applications.get(consultant_id, [])
    enriched = []
    for a in apps:
        r = _r_lookup.get(a["role_id"])
        if r:
            enriched.append({**a,
                "role_title": r["role_title"],
                "project_name": r["project_name"],
                "client": r["client"],
                "industry": r["industry"],
                "district": r.get("district","Singapore"),
                "cl_label": r["cl_label"],
            })
    return enriched

@app.patch("/applications/status")
def update_application_status(req: StatusUpdate):
    apps = _applications.get(req.consultant_id, [])
    for a in apps:
        if a["role_id"] == req.role_id:
            a["status"] = req.status
            return {"status": "updated"}
    raise HTTPException(404, "Application not found")


# ── Scoring ───────────────────────────────────────────────────
@app.post("/score/custom")
def get_custom_score(request: CustomScoreRequest):
    r = _r_lookup.get(request.role_id)
    if not r: raise HTTPException(404, "Role not found")
    return compute_score(request.consultant, r)


# ── CV Tailoring ──────────────────────────────────────────────
def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    import io
    name = filename.lower()
    if name.endswith(".pptx"):
        from pptx import Presentation
        prs = Presentation(io.BytesIO(file_bytes))
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    texts.append(shape.text.strip())
        return "\n".join(texts)
    elif name.endswith(".docx") or name.endswith(".doc"):
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return ""

@app.post("/tailor")
async def tailor_cv(request: TailorRequest):
    r = _r_lookup.get(request.role_id)
    if not r: raise HTTPException(404, "Role not found")
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key: raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    role_context = f"""Role: {r['role_title']} — {r['project_name']} ({r['client']}, {r['industry']})
Required skills: {", ".join(r['required_skills'])}
Job description: {r['description']}"""

    if request.file_base64 and request.file_name:
        import base64
        file_bytes = base64.b64decode(request.file_base64)
        name = request.file_name.lower()
        if name.endswith(".pdf"):
            messages = [{"role":"user","content":[
                {"type":"document","source":{"type":"base64","media_type":"application/pdf","data":request.file_base64}},
                {"type":"text","text":f"You are an expert CV writer for a management consulting firm.\n\nThe consultant is applying to:\n{role_context}\n\nFrom the attached PDF CV:\n1. Extract the experience/work history section\n2. Rewrite bullets to highlight relevance to this role\n3. Keep all job titles, company names, dates exactly as-is\n4. Do not fabricate experience\n5. Output ONLY the rewritten experience section, no preamble"}
            ]}]
        else:
            extracted = extract_text_from_file(file_bytes, request.file_name)
            if not extracted: raise HTTPException(400, "Could not extract text from file")
            messages = [{"role":"user","content":f"You are an expert CV writer for a management consulting firm.\n\nThe consultant is applying to:\n{role_context}\n\nHere is their CV content (extracted from {request.file_name}):\n{extracted}\n\n1. Identify and extract the experience/work history section\n2. Rewrite bullets to highlight relevance to this role\n3. Keep all job titles, company names, dates exactly as-is\n4. Do not fabricate experience\n5. Output ONLY the rewritten experience section, no preamble"}]
    else:
        messages = [{"role":"user","content":f"You are an expert CV writer for a management consulting firm.\n\nThe consultant is applying to:\n{role_context}\n\nHere is their experience section:\n{request.cv_text}\n\n1. Rewrite bullets to highlight relevance to this role\n2. Keep all job titles, company names, dates exactly as-is\n3. Reorder bullets within each role — most relevant first\n4. Do not fabricate experience\n5. Output ONLY the rewritten experience section, no preamble"}]

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-6", "max_tokens": 1500, "messages": messages},
        )
    if response.status_code != 200:
        raise HTTPException(502, f"Anthropic API error: {response.text}")
    return {"tailored_text": response.json()["content"][0]["text"], "mode": "ai"}


# ── Reset ─────────────────────────────────────────────────────
@app.post("/reset")
def reset_state():
    _custom_consultants.clear()
    _applications.clear()
    _likes.clear()
    return {"status": "reset"}
