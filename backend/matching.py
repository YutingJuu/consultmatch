"""
matching.py
Gale-Shapley deferred acceptance algorithm for consultant-project matching.

Side that proposes: consultants (consultant-optimal stable matching).
Projects have capacity = 1 for this prototype (can be extended).

Inputs:
  - consultant_prefs: dict of consultant_id -> ordered list of project_ids
  - project_prefs:    dict of project_id -> ordered list of consultant_ids

Output:
  - matches: dict of consultant_id -> project_id (or None if unmatched)
"""

from typing import Optional


def gale_shapley(
    consultant_prefs: dict[str, list[str]],
    project_prefs: dict[str, list[str]],
    project_capacity: Optional[dict[str, int]] = None,
) -> dict[str, Optional[str]]:
    """
    Consultant-proposing Gale-Shapley algorithm.

    Args:
        consultant_prefs: {consultant_id: [project_id, ...]} in preference order
        project_prefs:    {project_id: [consultant_id, ...]} in preference order
        project_capacity: {project_id: int} — defaults to 1 per project

    Returns:
        {consultant_id: project_id or None}
    """
    if project_capacity is None:
        project_capacity = {pid: 1 for pid in project_prefs}

    # Build project preference rank lookup for O(1) comparison
    project_rank = {
        pid: {cid: rank for rank, cid in enumerate(prefs)}
        for pid, prefs in project_prefs.items()
    }

    # State
    free_consultants = list(consultant_prefs.keys())
    next_proposal = {cid: 0 for cid in consultant_prefs}           # next index to propose to
    project_held = {pid: [] for pid in project_prefs}              # consultants tentatively held

    while free_consultants:
        cid = free_consultants.pop(0)
        prefs = consultant_prefs[cid]

        if next_proposal[cid] >= len(prefs):
            # Consultant has exhausted all options — remains unmatched
            continue

        pid = prefs[next_proposal[cid]]
        next_proposal[cid] += 1

        cap = project_capacity.get(pid, 1)
        held = project_held[pid]

        if len(held) < cap:
            # Project has capacity — tentatively accept
            held.append(cid)
        else:
            # Project is full — compare worst current hold against new proposer
            p_rank = project_rank.get(pid, {})

            # Rank all currently held + new proposer
            candidates = held + [cid]
            ranked = sorted(
                candidates,
                key=lambda x: p_rank.get(x, float("inf"))
            )

            # Keep top `cap` candidates
            project_held[pid] = ranked[:cap]
            rejected = ranked[cap:]

            for r in rejected:
                if r != cid:
                    # Previously held consultant got bumped — re-enters free pool
                    free_consultants.append(r)
                else:
                    # New proposer was rejected — try next on their list
                    free_consultants.append(cid)

    # Build final output
    matches = {cid: None for cid in consultant_prefs}
    for pid, held in project_held.items():
        for cid in held:
            matches[cid] = pid

    return matches


def build_preference_lists(
    consultants: list[dict],
    projects: list[dict],
    consultant_rankings: dict[str, list[str]],  # from frontend: {cid: [pid, ...]}
    project_rankings: dict[str, list[str]],      # from frontend: {pid: [cid, ...]}
) -> tuple[dict, dict]:
    """
    Merge user-submitted rankings with system score rankings as fallback.
    If a consultant did not rank all projects, the remaining projects are
    appended in score order.

    Returns (consultant_prefs, project_prefs) ready for gale_shapley().
    """
    from scoring import rank_projects_for_consultant, rank_consultants_for_project

    all_pids = [p["id"] for p in projects]
    all_cids = [c["id"] for c in consultants]

    c_lookup = {c["id"]: c for c in consultants}
    p_lookup = {p["id"]: p for p in projects}

    # Build consultant preference lists
    consultant_prefs = {}
    for cid in all_cids:
        submitted = consultant_rankings.get(cid, [])
        submitted_set = set(submitted)
        # Fill remaining with score-ranked order
        ranked = rank_projects_for_consultant(c_lookup[cid], projects)
        fallback = [r["id"] for r in ranked if r["id"] not in submitted_set]
        consultant_prefs[cid] = submitted + fallback

    # Build project preference lists
    project_prefs = {}
    for pid in all_pids:
        submitted = project_rankings.get(pid, [])
        submitted_set = set(submitted)
        ranked = rank_consultants_for_project(p_lookup[pid], consultants)
        fallback = [r["id"] for r in ranked if r["id"] not in submitted_set]
        project_prefs[pid] = submitted + fallback

    return consultant_prefs, project_prefs
