"""
scoring.py — compatibility scoring using real Accenture CL levels
Score (0-100): Skills 40pts | Preferences 40pts | CL fit 20pts
"""

WEIGHTS = {"skills": 0.40, "preference": 0.40, "cl": 0.20}
PREF_W  = {"industry": 0.25, "wfh": 0.25, "work_style": 0.25, "duration": 0.25}

WFH_COMPAT = {
    ("remote","remote"):1.0,("hybrid","hybrid"):1.0,("onsite","onsite"):1.0,
    ("remote","hybrid"):0.5,("hybrid","remote"):0.5,
    ("hybrid","onsite"):0.5,("onsite","hybrid"):0.5,
    ("remote","onsite"):0.0,("onsite","remote"):0.0,
}

def score_skills(c, p):
    cs = set(s.lower() for s in c.get("skills",[]))
    ps = set(s.lower() for s in p.get("required_skills",[]))
    if not ps: return 0.0
    return len(cs & ps) / len(ps)

def score_cl(c, p):
    """Score CL fit against slot range (if project has slots) or seniority_required."""
    c_cl = c.get("cl", 9)
    slots = p.get("team_slots", [])
    if slots:
        # Best fit across any slot
        best = 0.0
        for slot in slots:
            lo, hi = slot["cl_range"]
            if lo <= c_cl <= hi:
                best = 1.0; break
            elif c_cl == lo - 1 or c_cl == hi + 1:
                best = max(best, 0.5)
        return best
    else:
        req = p.get("seniority_required", 9)
        diff = abs(c_cl - req)
        return 1.0 if diff == 0 else (0.5 if diff <= 1 else 0.0)

def score_preferences(c, p):
    scores = {
        "industry": 1.0 if p.get("industry") in c.get("preferred_industries",[]) else 0.0,
        "wfh": WFH_COMPAT.get((c.get("wfh_preference","hybrid"), p.get("wfh_policy","hybrid")), 0.0),
        "work_style": 1.0 if c.get("work_style") == p.get("preferred_work_style") else 0.3,
        "duration": 1.0 if c.get("preferred_duration") == p.get("duration") else 0.2,
    }
    return sum(PREF_W[k] * scores[k] for k in scores)

def compute_score(c, p):
    sk = score_skills(c, p);  cl = score_cl(c, p);  pr = score_preferences(c, p)
    breakdown = {
        "skills":     round(sk * 100 * WEIGHTS["skills"], 1),
        "cl":         round(cl * 100 * WEIGHTS["cl"], 1),
        "preference": round(pr * 100 * WEIGHTS["preference"], 1),
    }
    total = round(sum(breakdown.values()), 1)
    cs = set(s.lower() for s in c.get("skills",[]))
    ps = set(s.lower() for s in p.get("required_skills",[]))
    return {
        "total": total, "breakdown": breakdown,
        "matched_skills": list(cs & ps),
        "industry_match": p.get("industry") in c.get("preferred_industries",[]),
        "wfh_match": c.get("wfh_preference") == p.get("wfh_policy"),
        "style_match": c.get("work_style") == p.get("preferred_work_style"),
        "duration_match": c.get("preferred_duration") == p.get("duration"),
    }

def rank_projects_for_consultant(c, projects):
    return sorted([{**p, "score": compute_score(c, p)} for p in projects],
                  key=lambda x: x["score"]["total"], reverse=True)

def rank_consultants_for_project(p, consultants):
    return sorted([{**c, "score": compute_score(c, p)} for c in consultants],
                  key=lambda x: x["score"]["total"], reverse=True)
