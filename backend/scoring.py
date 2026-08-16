"""
scoring.py — score consultant against a ROLE posting (not project).
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

def score_skills(c, role):
    cs = set(s.lower() for s in c.get("skills",[]))
    rs = set(s.lower() for s in role.get("required_skills",[]))
    if not rs: return 0.0
    return len(cs & rs) / len(rs)

def score_cl(c, role):
    c_cl = c.get("cl", 9)
    lo, hi = role.get("cl_range", [9, 9])
    if lo <= c_cl <= hi: return 1.0
    if c_cl == lo - 1 or c_cl == hi + 1: return 0.5
    return 0.0

def score_preferences(c, role):
    scores = {
        "industry": 1.0 if role.get("industry") in c.get("preferred_industries",[]) else 0.0,
        "wfh": WFH_COMPAT.get((c.get("wfh_preference","hybrid"), role.get("wfh_policy","hybrid")), 0.0),
        "work_style": 1.0 if c.get("work_style") == role.get("preferred_work_style") else 0.3,
        "duration": 1.0 if c.get("preferred_duration") == role.get("duration") else 0.2,
    }
    return sum(PREF_W[k] * scores[k] for k in scores)

def compute_score(c, role):
    sk = score_skills(c, role)
    cl = score_cl(c, role)
    pr = score_preferences(c, role)
    breakdown = {
        "skills":     round(sk * 100 * WEIGHTS["skills"], 1),
        "cl":         round(cl * 100 * WEIGHTS["cl"], 1),
        "preference": round(pr * 100 * WEIGHTS["preference"], 1),
    }
    total = round(sum(breakdown.values()), 1)
    cs = set(s.lower() for s in c.get("skills",[]))
    rs = set(s.lower() for s in role.get("required_skills",[]))
    return {
        "total": total, "breakdown": breakdown,
        "matched_skills": list(cs & rs),
        "industry_match": role.get("industry") in c.get("preferred_industries",[]),
        "wfh_match": c.get("wfh_preference") == role.get("wfh_policy"),
        "style_match": c.get("work_style") == role.get("preferred_work_style"),
        "duration_match": c.get("preferred_duration") == role.get("duration"),
    }

def rank_roles_for_consultant(c, roles):
    return sorted([{**r, "score": compute_score(c, r)} for r in roles],
                  key=lambda x: x["score"]["total"], reverse=True)

def rank_consultants_for_role(role, consultants):
    lo, hi = role.get("cl_range", [7, 11])
    eligible = [c for c in consultants if lo <= c.get("cl", 9) <= hi]
    return sorted([{**c, "score": compute_score(c, role)} for c in eligible],
                  key=lambda x: x["score"]["total"], reverse=True)
