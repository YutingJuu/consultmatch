"""
main.py
ConsultMatch FastAPI backend.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

from data.synthetic import CONSULTANTS, PROJECTS
from scoring import (
    compute_score,
    rank_projects_for_consultant,
    rank_consultants_for_project,
)
from matching import gale_shapley, build_preference_lists

app = FastAPI(title="ConsultMatch API", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://consultmatch.vercel.app",
    "https://consultmatch-xi.vercel.app",
    "https://consultmatch-git-main.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ───────────────────────────────────────────────────────────
_consultant_rankings: dict[str, list[str]] = {}
_project_rankings: dict[str, list[str]] = {}
_match_results: Optional[dict] = None
_custom_consultants: dict[str, dict] = {}   # stores onboarded custom profiles

# Base lookups (synthetic data)
_c_lookup: dict[str, dict] = {c["id"]: c for c in CONSULTANTS}
_p_lookup: dict[str, dict] = {p["id"]: p for p in PROJECTS}


def get_all_consultants() -> list[dict]:
    """Synthetic + any registered custom consultants."""
    return CONSULTANTS + list(_custom_consultants.values())


def get_c_lookup() -> dict[str, dict]:
    return {**_c_lookup, **_custom_consultants}


# ── Request models ────────────────────────────────────────────────────────────

class RankingSubmission(BaseModel):
    id: str
    ranked_ids: list[str]

class CustomProfile(BaseModel):
    id: str
    name: str
    level: str
    seniority: int
    skills: list[str]
    preferred_industries: list[str]
    wfh_preference: str
    work_style: str
    preferred_duration: str
    career_goal: str
    available_from: str

class CustomScoreRequest(BaseModel):
    consultant: dict
    project_id: str


# ── Custom profile registration ───────────────────────────────────────────────

@app.post("/consultants/register")
def register_custom_consultant(profile: CustomProfile):
    """Register an onboarded consultant so they participate in matching."""
    _custom_consultants[profile.id] = profile.model_dump()
    return {"status": "registered", "id": profile.id}


# ── Consultant endpoints ──────────────────────────────────────────────────────

@app.get("/consultants")
def list_consultants():
    return get_all_consultants()

@app.get("/consultants/{consultant_id}")
def get_consultant(consultant_id: str):
    c = get_c_lookup().get(consultant_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    return c

@app.get("/consultants/{consultant_id}/recommendations")
def get_project_recommendations(consultant_id: str):
    c = get_c_lookup().get(consultant_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    return rank_projects_for_consultant(c, PROJECTS)

@app.post("/consultants/rankings")
def submit_consultant_ranking(submission: RankingSubmission):
    if submission.id not in get_c_lookup():
        raise HTTPException(status_code=404, detail="Consultant not found")
    _consultant_rankings[submission.id] = submission.ranked_ids
    return {"status": "ok", "consultant_id": submission.id}

@app.get("/consultants/{consultant_id}/rankings")
def get_consultant_ranking(consultant_id: str):
    return {
        "consultant_id": consultant_id,
        "ranked_ids": _consultant_rankings.get(consultant_id, [])
    }


# ── Project endpoints ─────────────────────────────────────────────────────────

@app.get("/projects")
def list_projects():
    return PROJECTS

@app.get("/projects/{project_id}")
def get_project(project_id: str):
    p = _p_lookup.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

@app.get("/projects/{project_id}/recommendations")
def get_consultant_recommendations(project_id: str):
    p = _p_lookup.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return rank_consultants_for_project(p, get_all_consultants())

@app.post("/projects/rankings")
def submit_project_ranking(submission: RankingSubmission):
    if submission.id not in _p_lookup:
        raise HTTPException(status_code=404, detail="Project not found")
    _project_rankings[submission.id] = submission.ranked_ids
    return {"status": "ok", "project_id": submission.id}

@app.get("/projects/{project_id}/rankings")
def get_project_ranking(project_id: str):
    return {
        "project_id": project_id,
        "ranked_ids": _project_rankings.get(project_id, [])
    }


# ── Matching ──────────────────────────────────────────────────────────────────

@app.post("/match")
def run_matching():
    global _match_results
    all_consultants = get_all_consultants()
    c_lookup = get_c_lookup()

    consultant_prefs, project_prefs = build_preference_lists(
        all_consultants, PROJECTS,
        _consultant_rankings, _project_rankings,
    )

    raw_matches = gale_shapley(consultant_prefs, project_prefs)

    enriched = []
    for cid, pid in raw_matches.items():
        c = c_lookup[cid]
        if pid:
            p = _p_lookup[pid]
            score = compute_score(c, p)
            enriched.append({
                "consultant_id": cid,
                "consultant_name": c["name"],
                "project_id": pid,
                "project_name": p["name"],
                "client": p["client"],
                "industry": p["industry"],
                "score": score,
                "status": "matched",
                "is_custom": cid in _custom_consultants,
            })
        else:
            enriched.append({
                "consultant_id": cid,
                "consultant_name": c["name"],
                "project_id": None,
                "project_name": None,
                "client": None,
                "industry": None,
                "score": None,
                "status": "unmatched",
                "is_custom": cid in _custom_consultants,
            })

    matched = [e for e in enriched if e["status"] == "matched"]
    avg_score = (
        round(sum(e["score"]["total"] for e in matched) / len(matched), 1)
        if matched else 0
    )

    _match_results = {
        "matches": enriched,
        "summary": {
            "total_consultants": len(all_consultants),
            "total_projects": len(PROJECTS),
            "matched_count": len(matched),
            "unmatched_count": len(all_consultants) - len(matched),
            "average_compatibility_score": avg_score,
        }
    }
    return _match_results

@app.get("/match/results")
def get_match_results():
    if _match_results is None:
        raise HTTPException(status_code=404, detail="No matching has been run yet.")
    return _match_results

@app.post("/match/reset")
def reset_state():
    global _match_results
    _consultant_rankings.clear()
    _project_rankings.clear()
    _custom_consultants.clear()
    _match_results = None
    return {"status": "reset"}


# ── Scoring ───────────────────────────────────────────────────────────────────

@app.get("/score/{consultant_id}/{project_id}")
def get_score(consultant_id: str, project_id: str):
    c = get_c_lookup().get(consultant_id)
    p = _p_lookup.get(project_id)
    if not c or not p:
        raise HTTPException(status_code=404, detail="Not found")
    return compute_score(c, p)

@app.post("/score/custom")
def get_custom_score(request: CustomScoreRequest):
    p = _p_lookup.get(request.project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return compute_score(request.consultant, p)
