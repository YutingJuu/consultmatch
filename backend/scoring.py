"""
scoring.py
Preference-compatibility scoring between consultants and projects.

Score breakdown (0-100):
  - Skills match:          40 points
  - Preference alignment:  40 points
      * Industry match:    10 pts
      * WFH match:         10 pts
      * Work style match:  10 pts
      * Duration match:    10 pts
  - Seniority fit:         20 points
"""

from typing import Any

WEIGHTS = {
    "skills": 0.40,
    "preference": 0.40,
    "seniority": 0.20,
}

PREFERENCE_WEIGHTS = {
    "industry": 0.25,
    "wfh": 0.25,
    "work_style": 0.25,
    "duration": 0.25,
}


def score_skills(consultant: dict, project: dict) -> float:
    """Jaccard-style overlap between consultant skills and project required skills."""
    c_skills = set(s.lower() for s in consultant["skills"])
    p_skills = set(s.lower() for s in project["required_skills"])
    if not p_skills:
        return 0.0
    overlap = len(c_skills & p_skills)
    return overlap / len(p_skills)


def score_seniority(consultant: dict, project: dict) -> float:
    """
    Exact match = 1.0
    One level off = 0.5
    Two or more levels off = 0.0
    """
    diff = abs(consultant["seniority"] - project["seniority_required"])
    if diff == 0:
        return 1.0
    elif diff <= 2:
        return 0.5
    return 0.0


def score_preferences(consultant: dict, project: dict) -> float:
    """Aggregate preference alignment score."""
    scores = {}

    # Industry match
    scores["industry"] = (
        1.0 if project["industry"] in consultant["preferred_industries"] else 0.0
    )

    # WFH match
    wfh_compatibility = {
        ("remote", "remote"): 1.0,
        ("hybrid", "hybrid"): 1.0,
        ("onsite", "onsite"): 1.0,
        ("remote", "hybrid"): 0.5,
        ("hybrid", "remote"): 0.5,
        ("hybrid", "onsite"): 0.5,
        ("onsite", "hybrid"): 0.5,
        ("remote", "onsite"): 0.0,
        ("onsite", "remote"): 0.0,
    }
    key = (consultant["wfh_preference"], project["wfh_policy"])
    scores["wfh"] = wfh_compatibility.get(key, 0.0)

    # Work style match
    scores["work_style"] = (
        1.0 if consultant["work_style"] == project["preferred_work_style"] else 0.3
    )

    # Duration match
    scores["duration"] = (
        1.0 if consultant["preferred_duration"] == project["duration"] else 0.2
    )

    return sum(
        PREFERENCE_WEIGHTS[k] * scores[k] for k in scores
    )


def compute_score(consultant: dict, project: dict) -> dict:
    """
    Compute full compatibility score between one consultant and one project.
    Returns a dict with total score and breakdown.
    """
    skills_raw = score_skills(consultant, project)
    seniority_raw = score_seniority(consultant, project)
    preference_raw = score_preferences(consultant, project)

    skills_score = round(skills_raw * 100 * WEIGHTS["skills"], 1)
    seniority_score = round(seniority_raw * 100 * WEIGHTS["seniority"], 1)
    preference_score = round(preference_raw * 100 * WEIGHTS["preference"], 1)
    total = round(skills_score + seniority_score + preference_score, 1)

    matched_skills = list(
        set(s.lower() for s in consultant["skills"])
        & set(s.lower() for s in project["required_skills"])
    )

    return {
        "total": total,
        "breakdown": {
            "skills": skills_score,
            "seniority": seniority_score,
            "preference": preference_score,
        },
        "matched_skills": matched_skills,
        "industry_match": project["industry"] in consultant["preferred_industries"],
        "wfh_match": consultant["wfh_preference"] == project["wfh_policy"],
        "style_match": consultant["work_style"] == project["preferred_work_style"],
        "duration_match": consultant["preferred_duration"] == project["duration"],
    }


def rank_projects_for_consultant(consultant: dict, projects: list) -> list:
    """Return projects ranked by compatibility score for a given consultant."""
    scored = []
    for p in projects:
        result = compute_score(consultant, p)
        scored.append({**p, "score": result})
    return sorted(scored, key=lambda x: x["score"]["total"], reverse=True)


def rank_consultants_for_project(project: dict, consultants: list) -> list:
    """Return consultants ranked by compatibility score for a given project."""
    scored = []
    for c in consultants:
        result = compute_score(c, project)
        scored.append({**c, "score": result})
    return sorted(scored, key=lambda x: x["score"]["total"], reverse=True)
