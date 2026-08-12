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

from data.synthetic import CONSULTANTS, PROJECTS
from scoring import (
    compute_score,
    rank_projects_for_consultant,
    rank_consultants_for_project,
)
from matching import gale_shapley, build_preference_lists

app = FastAPI(title="ConsultMatch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state (resets on server restart — fine for prototype)
_consultant_rankings: dict[str, list[str]] = {}
_project_rankings: dict[str, list[str]] = {}
_match_results: Optional[dict] = None

c_lookup = {c["id"]: c for c in CONSULTANTS}
p_lookup = {p["id"]: p for p in PROJECTS}


# ─── Request / Response Models ────────────────────────────────────────────────

class RankingSubmission(BaseModel):
    id: str                  # consultant_id or project_id
    ranked_ids: list[str]    # ordered preference list


# ─── Consultant Endpoints ─────────────────────────────────────────────────────

@app.get("/consultants")
def get_all_consultants():
    return CONSULTANTS


@app.get("/consultants/{consultant_id}")
def get_consultant(consultant_id: str):
    c = c_lookup.get(consultant_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    return c


@app.get("/consultants/{consultant_id}/recommendations")
def get_project_recommendations(consultant_id: str):
    """Return projects ranked by compatibility score for this consultant."""
    c = c_lookup.get(consultant_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultant not found")
    ranked = rank_projects_for_consultant(c, PROJECTS)
    return ranked


@app.post("/consultants/rankings")
def submit_consultant_ranking(submission: RankingSubmission):
    """Store consultant's ranked preference list over projects."""
    if submission.id not in c_lookup:
        raise HTTPException(status_code=404, detail="Consultant not found")
    _consultant_rankings[submission.id] = submission.ranked_ids
    return {"status": "ok", "consultant_id": submission.id}


@app.get("/consultants/{consultant_id}/rankings")
def get_consultant_ranking(consultant_id: str):
    return {
        "consultant_id": consultant_id,
        "ranked_ids": _consultant_rankings.get(consultant_id, [])
    }


# ─── Project Endpoints ────────────────────────────────────────────────────────

@app.get("/projects")
def get_all_projects():
    return PROJECTS


@app.get("/projects/{project_id}")
def get_project(project_id: str):
    p = p_lookup.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@app.get("/projects/{project_id}/recommendations")
def get_consultant_recommendations(project_id: str):
    """Return consultants ranked by compatibility score for this project."""
    p = p_lookup.get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    ranked = rank_consultants_for_project(p, CONSULTANTS)
    return ranked


@app.post("/projects/rankings")
def submit_project_ranking(submission: RankingSubmission):
    """Store project manager's ranked preference list over consultants."""
    if submission.id not in p_lookup:
        raise HTTPException(status_code=404, detail="Project not found")
    _project_rankings[submission.id] = submission.ranked_ids
    return {"status": "ok", "project_id": submission.id}


@app.get("/projects/{project_id}/rankings")
def get_project_ranking(project_id: str):
    return {
        "project_id": project_id,
        "ranked_ids": _project_rankings.get(project_id, [])
    }


# ─── Matching Endpoint ────────────────────────────────────────────────────────

@app.post("/match")
def run_matching():
    """
    Run Gale-Shapley matching using submitted rankings (with score-based fallback).
    Returns stable matching results with full score breakdowns.
    """
    global _match_results

    consultant_prefs, project_prefs = build_preference_lists(
        CONSULTANTS,
        PROJECTS,
        _consultant_rankings,
        _project_rankings,
    )

    raw_matches = gale_shapley(consultant_prefs, project_prefs)

    # Enrich results with names and scores
    enriched = []
    for cid, pid in raw_matches.items():
        c = c_lookup[cid]
        if pid:
            p = p_lookup[pid]
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
            })

    # Summary stats
    matched = [e for e in enriched if e["status"] == "matched"]
    avg_score = (
        round(sum(e["score"]["total"] for e in matched) / len(matched), 1)
        if matched else 0
    )

    _match_results = {
        "matches": enriched,
        "summary": {
            "total_consultants": len(CONSULTANTS),
            "total_projects": len(PROJECTS),
            "matched_count": len(matched),
            "unmatched_count": len(CONSULTANTS) - len(matched),
            "average_compatibility_score": avg_score,
        }
    }
    return _match_results


@app.get("/match/results")
def get_match_results():
    """Return the most recent matching results."""
    if _match_results is None:
        raise HTTPException(status_code=404, detail="No matching has been run yet.")
    return _match_results


@app.post("/match/reset")
def reset_state():
    """Clear all rankings and match results (useful for demo resets)."""
    global _match_results
    _consultant_rankings.clear()
    _project_rankings.clear()
    _match_results = None
    return {"status": "reset"}


# ─── Score Endpoint ───────────────────────────────────────────────────────────

@app.get("/score/{consultant_id}/{project_id}")
def get_score(consultant_id: str, project_id: str):
    """Return compatibility score between one consultant and one project."""
    c = c_lookup.get(consultant_id)
    p = p_lookup.get(project_id)
    if not c or not p:
        raise HTTPException(status_code=404, detail="Consultant or project not found")
    return compute_score(c, p)
