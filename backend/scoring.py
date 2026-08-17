"""
scoring.py — compatibility scoring v3
CL is a hard filter (enforced before scoring, not scored).
Score (0-100):
  Skills match:        40 pts
  Preference align:    40 pts
  Availability:        20 pts
"""

WEIGHTS = {"skills": 0.40, "preference": 0.40, "availability": 0.20}
PREF_W  = {"industry": 0.25, "wfh": 0.25, "work_style": 0.25, "duration": 0.25}

WFH_COMPAT = {
    ("remote","remote"):1.0,("hybrid","hybrid"):1.0,("onsite","onsite"):1.0,
    ("remote","hybrid"):0.5,("hybrid","remote"):0.5,
    ("hybrid","onsite"):0.5,("onsite","hybrid"):0.5,
    ("remote","onsite"):0.0,("onsite","remote"):0.0,
}

def cl_eligible(c, role):
    """Hard CL filter — consultant CL must be within role's CL range."""
    c_cl = c.get("cl", 9)
    lo, hi = role.get("cl_range", [9, 10])
    return lo <= c_cl <= hi

def score_skills(c, role):
    cs = set(s.lower() for s in c.get("skills", []))
    rs = set(s.lower() for s in role.get("required_skills", []))
    if not rs: return 0.5
    return len(cs & rs) / len(rs)

def score_availability(c, role):
    from datetime import datetime
    try:
        avail = datetime.strptime(c.get("available_from", "2026-09-01"), "%Y-%m-%d")
        start = datetime.strptime(role.get("start_date", "2026-10-01"), "%Y-%m-%d")
        delta = (avail - start).days
        if delta <= 0:  return 1.0   # available before or on start
        if delta <= 14: return 0.8   # up to 2 weeks late
        if delta <= 30: return 0.5   # up to 1 month late
        if delta <= 60: return 0.2   # up to 2 months late
        return 0.0                   # too late
    except Exception:
        return 0.5

def score_preferences(c, role):
    scores = {
        "industry":   1.0 if role.get("industry") in c.get("preferred_industries", []) else 0.0,
        "wfh":        WFH_COMPAT.get((c.get("wfh_preference","hybrid"), role.get("wfh_policy","hybrid")), 0.0),
        "work_style": 1.0 if c.get("work_style") == role.get("preferred_work_style") else 0.3,
        "duration":   1.0 if c.get("preferred_duration") == role.get("duration") else 0.2,
    }
    return sum(PREF_W[k] * scores[k] for k in scores)

def compute_score(c, role):
    sk = score_skills(c, role)
    pr = score_preferences(c, role)
    av = score_availability(c, role)
    breakdown = {
        "skills":       round(sk * 100 * WEIGHTS["skills"], 1),
        "preference":   round(pr * 100 * WEIGHTS["preference"], 1),
        "availability": round(av * 100 * WEIGHTS["availability"], 1),
    }
    total = round(sum(breakdown.values()), 1)
    cs = set(s.lower() for s in c.get("skills", []))
    rs = set(s.lower() for s in role.get("required_skills", []))
    return {
        "total": total,
        "breakdown": breakdown,
        "matched_skills": list(cs & rs),
        "industry_match": role.get("industry") in c.get("preferred_industries", []),
        "wfh_match": c.get("wfh_preference") == role.get("wfh_policy"),
        "style_match": c.get("work_style") == role.get("preferred_work_style"),
        "duration_match": c.get("preferred_duration") == role.get("duration"),
        "availability_score": round(av * 100, 0),
        "available_from": c.get("available_from", ""),
        "role_start_date": role.get("start_date", ""),
    }

def rank_roles_for_consultant(c, roles):
    """Filter by CL first, then score and rank."""
    eligible = [r for r in roles if cl_eligible(c, r)]
    return sorted([{**r, "score": compute_score(c, r)} for r in eligible],
                  key=lambda x: x["score"]["total"], reverse=True)

def rank_consultants_for_role(role, consultants):
    """Filter by CL first, then score and rank."""
    eligible = [c for c in consultants if cl_eligible(c, role)]
    return sorted([{**c, "score": compute_score(c, role)} for c in eligible],
                  key=lambda x: x["score"]["total"], reverse=True)
