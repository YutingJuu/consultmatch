"""
ConsultMatch FastAPI backend — v12
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, httpx

from data.synthetic import CONSULTANTS, PROJECTS
from scoring import compute_score, rank_projects_for_consultant, rank_consultants_for_project
from matching import gale_shapley, build_preference_lists

app = FastAPI(title="ConsultMatch API", version="2.0.0")

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
_applications: dict[str, list] = {}   # consultant_id -> [{project_id, status, cv_text, applied_at}]
_likes: dict[str, list] = {}          # consultant_id -> [project_id, ...]
_match_results: Optional[dict] = None

_p_lookup = {p["id"]: p for p in PROJECTS}

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

class ApplicationRequest(BaseModel):
    consultant_id: str; project_id: str
    cv_text: Optional[str] = ""

class LikeRequest(BaseModel):
    consultant_id: str; project_id: str

class CustomScoreRequest(BaseModel):
    consultant: dict; project_id: str

class TailorRequest(BaseModel):
    cv_text: Optional[str] = ""
    project_id: str
    file_base64: Optional[str] = None   # base64-encoded file content
    file_name: Optional[str] = None     # original filename for type detection

class StatusUpdate(BaseModel):
    consultant_id: str; project_id: str; status: str


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
    return rank_projects_for_consultant(c, PROJECTS)


# ── Likes ─────────────────────────────────────────────────────
@app.post("/likes")
def toggle_like(req: LikeRequest):
    liked = _likes.setdefault(req.consultant_id, [])
    if req.project_id in liked:
        liked.remove(req.project_id)
        return {"status": "unliked"}
    else:
        liked.append(req.project_id)
        return {"status": "liked"}

@app.get("/likes/{consultant_id}")
def get_likes(consultant_id: str):
    return {"liked": _likes.get(consultant_id, [])}


# ── Applications ──────────────────────────────────────────────
@app.post("/applications")
def apply_to_project(req: ApplicationRequest):
    apps = _applications.setdefault(req.consultant_id, [])
    # Check not already applied
    if any(a["project_id"] == req.project_id for a in apps):
        raise HTTPException(400, "Already applied to this project")
    from datetime import datetime
    apps.append({
        "project_id": req.project_id,
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
        p = _p_lookup.get(a["project_id"])
        if p:
            enriched.append({**a, "project_name": p["name"],
                             "client": p["client"], "industry": p["industry"],
                             "district": p.get("district","Singapore")})
    return enriched

@app.patch("/applications/status")
def update_application_status(req: StatusUpdate):
    """Manager updates applicant status."""
    apps = _applications.get(req.consultant_id, [])
    for a in apps:
        if a["project_id"] == req.project_id:
            a["status"] = req.status
            return {"status": "updated"}
    raise HTTPException(404, "Application not found")

@app.get("/applications/project/{project_id}")
def get_project_applicants(project_id: str):
    """Get all applicants for a project (manager view)."""
    result = []
    for cid, apps in _applications.items():
        for a in apps:
            if a["project_id"] == project_id:
                c = get_c_lookup().get(cid)
                if c:
                    result.append({
                        "consultant_id": cid,
                        "consultant_name": c["name"],
                        "cl": c.get("cl"), "cl_title": c.get("cl_title"),
                        "skills": c.get("skills",[]),
                        "status": a["status"],
                        "cv_text": a.get("cv_text",""),
                        "applied_at": a["applied_at"],
                    })
    return result


# ── Projects ──────────────────────────────────────────────────
@app.get("/projects")
def list_projects():
    return PROJECTS

@app.get("/projects/{project_id}")
def get_project(project_id: str):
    p = _p_lookup.get(project_id)
    if not p: raise HTTPException(404, "Not found")
    return p

@app.get("/projects/{project_id}/team-recommendations")
def get_team_recommendations(project_id: str):
    """
    For each team slot, recommend consultants whose CL falls within
    the slot's CL range, ranked by compatibility score.
    Also annotates whether each consultant has applied or liked this project.
    """
    p = _p_lookup.get(project_id)
    if not p: raise HTTPException(404, "Not found")

    all_consultants = get_all_consultants()
    applicants = {
        a["project_id"]: a
        for cid, apps in _applications.items()
        for a in apps
        if a["project_id"] == project_id
    }
    # Build applicant lookup: consultant_id -> application
    applicant_by_cid = {}
    for cid, apps in _applications.items():
        for a in apps:
            if a["project_id"] == project_id:
                applicant_by_cid[cid] = a

    # Build likes lookup
    liked_by = {cid for cid, pids in _likes.items() if project_id in pids}

    slots = []
    for slot in p.get("team_slots", []):
        cl_min, cl_max = slot["cl_range"]
        eligible = [c for c in all_consultants
                    if cl_min <= c.get("cl", 9) <= cl_max]
        scored = []
        for c in eligible:
            sc = compute_score(c, p)
            cid = c["id"]
            scored.append({
                **c,
                "score": sc,
                "has_applied": cid in applicant_by_cid,
                "has_liked": cid in liked_by,
                "cv_text": applicant_by_cid.get(cid, {}).get("cv_text", ""),
                "application_status": applicant_by_cid.get(cid, {}).get("status", ""),
            })
        scored.sort(key=lambda x: x["score"]["total"], reverse=True)
        slots.append({
            "slot": slot,
            "candidates": scored,
        })

    return {"project_id": project_id, "slots": slots}


# ── Team matching (Gale-Shapley per slot) ─────────────────────
@app.post("/projects/{project_id}/propose-team")
def propose_team(project_id: str):
    """
    Run Gale-Shapley for each slot independently.
    Returns the best stable team composition.
    """
    p = _p_lookup.get(project_id)
    if not p: raise HTTPException(404, "Not found")

    all_consultants = get_all_consultants()
    applicant_by_cid = {}
    for cid, apps in _applications.items():
        for a in apps:
            if a["project_id"] == project_id:
                applicant_by_cid[cid] = a

    liked_by = {cid for cid, pids in _likes.items() if project_id in pids}

    proposed_team = []
    used_consultant_ids = set()

    for slot in p.get("team_slots", []):
        cl_min, cl_max = slot["cl_range"]
        count = slot.get("count", 1)

        eligible = [c for c in all_consultants
                    if cl_min <= c.get("cl", 9) <= cl_max
                    and c["id"] not in used_consultant_ids]

        # Score and sort — boost applied consultants
        scored = []
        for c in eligible:
            sc = compute_score(c, p)
            cid = c["id"]
            boost = 10 if cid in applicant_by_cid else (5 if cid in liked_by else 0)
            scored.append({
                **c,
                "score": sc,
                "adjusted_total": sc["total"] + boost,
                "has_applied": cid in applicant_by_cid,
                "has_liked": cid in liked_by,
                "application_status": applicant_by_cid.get(cid, {}).get("status", ""),
            })
        scored.sort(key=lambda x: x["adjusted_total"], reverse=True)

        selected = scored[:count]
        for s in selected:
            used_consultant_ids.add(s["id"])

        proposed_team.append({
            "slot": slot,
            "proposed": selected,
        })

    return {"project_id": project_id, "proposed_team": proposed_team}


# ── Scoring ───────────────────────────────────────────────────
@app.get("/score/{consultant_id}/{project_id}")
def get_score(consultant_id: str, project_id: str):
    c = get_c_lookup().get(consultant_id)
    p = _p_lookup.get(project_id)
    if not c or not p: raise HTTPException(404, "Not found")
    return compute_score(c, p)

@app.post("/score/custom")
def get_custom_score(request: CustomScoreRequest):
    p = _p_lookup.get(request.project_id)
    if not p: raise HTTPException(404, "Not found")
    return compute_score(request.consultant, p)


# ── CV Tailoring ──────────────────────────────────────────────
def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract text from PPTX or DOCX files."""
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
    p = _p_lookup.get(request.project_id)
    if not p: raise HTTPException(404, "Not found")
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    role_context = f"""Role: {p['name']} at {p['client']} ({p['industry']})
Required skills: {", ".join(p['required_skills'])}
Description: {p['description']}
Duration: {p['duration']}"""

    # ── File-based input (PPTX, DOCX, PDF) ───────────────────
    if request.file_base64 and request.file_name:
        import base64
        file_bytes = base64.b64decode(request.file_base64)
        name = request.file_name.lower()

        if name.endswith(".pdf"):
            # Send PDF natively to Claude — it can read it directly
            prompt_text = f"""You are an expert CV writer for a management consulting firm.

The consultant is applying to this role:
{role_context}

The attached PDF is their CV. Please:
1. Extract the experience/work history section
2. Rewrite the bullet points to highlight relevance to the role above
3. Keep all job titles, company names, and dates exactly as-is
4. Do not fabricate any experience
5. Output ONLY the rewritten experience section, no preamble or explanation"""

            messages = [{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": request.file_base64,
                        }
                    },
                    {"type": "text", "text": prompt_text}
                ]
            }]

        else:
            # PPTX or DOCX — extract text server-side first
            extracted = extract_text_from_file(file_bytes, request.file_name)
            if not extracted:
                raise HTTPException(400, "Could not extract text from file")

            prompt_text = f"""You are an expert CV writer for a management consulting firm.

The consultant is applying to this role:
{role_context}

Here is their CV content (extracted from {request.file_name}):
{extracted}

Please:
1. Identify and extract the experience/work history section
2. Rewrite the bullet points to highlight relevance to the role above
3. Keep all job titles, company names, and dates exactly as-is
4. Do not fabricate any experience
5. Output ONLY the rewritten experience section, no preamble or explanation"""

            messages = [{"role": "user", "content": prompt_text}]

    # ── Text-based input ──────────────────────────────────────
    else:
        prompt_text = f"""You are an expert CV writer for a management consulting firm.

The consultant is applying to this role:
{role_context}

Here is their experience section:
{request.cv_text}

Please:
1. Rewrite the bullet points to highlight relevance to the role above
2. Keep all job titles, company names, and dates exactly as-is
3. Reorder bullets within each role — most relevant first
4. Do not fabricate any experience
5. Output ONLY the rewritten experience section, no preamble or explanation"""

        messages = [{"role": "user", "content": prompt_text}]

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": "claude-sonnet-4-6", "max_tokens": 1500,
                  "messages": messages},
        )
    if response.status_code != 200:
        raise HTTPException(502, f"Anthropic API error: {response.text}")
    return {"tailored_text": response.json()["content"][0]["text"], "mode": "ai"}


# ── Reset ─────────────────────────────────────────────────────
@app.post("/reset")
def reset_state():
    global _match_results
    _custom_consultants.clear(); _applications.clear()
    _likes.clear(); _match_results = None
    return {"status": "reset"}
