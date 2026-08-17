import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Custom project slots use slot_id, backend roles use role_id
const getRoleId = (role) => role.role_id || role.slot_id;

export default function ManagerView({ projectId, customProject }) {
  const [project, setProject] = useState(customProject || null);
  const [projectRoles, setProjectRoles] = useState([]);
  const [rolesCandidates, setRolesCandidates] = useState({}); // role_id -> candidates[]
  const [proposedTeam, setProposedTeam] = useState(null);
  const [proposing, setProposing] = useState(false);
  const [tab, setTab] = useState("slots");
  const [viewingCV, setViewingCV] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [error, setError] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [expressedInterest, setExpressedInterest] = useState(new Set());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setError(null);
    if (customProject) {
      setProject(customProject);
      const slots = customProject.team_slots || [];
      // Build role objects that look like backend roles
      const roles = slots.map(s => ({
        ...s,
        project_id: customProject.id,
        project_name: customProject.name,
        client: customProject.client,
        industry: customProject.industry,
        wfh_policy: customProject.wfh_policy,
        duration: customProject.duration,
        district: customProject.district,
        preferred_work_style: customProject.preferred_work_style || "structured",
      }));
      setProjectRoles(roles);

      // Fetch all consultants, score against each slot, check applications/likes
      setLoadingCandidates(true);
      (async () => {
        const appsRes = await axios.get(`${API}/consultants`);
        const allConsultants = appsRes.data;

        // Fetch application and like data for all consultants in parallel
        const appliedMap = {};
        const likedMap = {};
        await Promise.all(allConsultants.map(async c => {
          try {
            const r = await axios.get(`${API}/applications/${c.id}`);
            appliedMap[c.id] = r.data.map(a => a.role_id);
          } catch { appliedMap[c.id] = []; }
          try {
            const r = await axios.get(`${API}/likes/${c.id}`);
            likedMap[c.id] = r.data.liked || [];
          } catch { likedMap[c.id] = []; }
        }));

        for (const slot of slots) {
          const [cl_min, cl_max] = slot.cl_range;
          const eligible = allConsultants.filter(c => c.cl >= cl_min && c.cl <= cl_max); // hard CL filter
          const roleForScoring = roles.find(ro => ro.slot_id === slot.slot_id);
          const scored = await Promise.all(eligible.map(async c => {
            try {
              const res = await axios.post(`${API}/score/inline`, {
                consultant: c, role: roleForScoring,
              });
              return {
                ...c, score: res.data,
                has_applied: (appliedMap[c.id] || []).includes(slot.slot_id),
                has_liked: (likedMap[c.id] || []).includes(slot.slot_id),
                application_status: (appliedMap[c.id] || []).includes(slot.slot_id) ? "Applied" : "",
              };
            } catch (e) {
              return { ...c, score: { total: 20, breakdown: { skills: 0, preference: 0, cl: 20 } },
                        has_applied: false, has_liked: false, application_status: "" };
            }
          }));
          scored.sort((a, b) => b.score.total - a.score.total);
          setRolesCandidates(prev => ({ ...prev, [slot.slot_id]: scored }));
        }
        setLoadingCandidates(false);
      })();
    } else {
      axios.get(`${API}/projects/${projectId}`)
        .then(r => setProject(r.data))
        .catch(() => setError("Failed to load project."));
      axios.get(`${API}/projects/${projectId}/roles`)
        .then(r => {
          setProjectRoles(r.data);
          r.data.forEach(role => {
            axios.get(`${API}/roles/${role.role_id}/candidates`)
              .then(res => setRolesCandidates(prev => ({
                ...prev, [role.role_id]: res.data
              })))
              .catch(() => {});
          });
        })
        .catch(() => setError("Failed to load roles."));
    }
  }, [projectId, customProject]);

  const expressInterest = async (c, role) => {
    const key = getRoleId(role) + ":" + c.id;
    const managerName = project?.manager_name || "Project Manager";
    const projectName = project?.name || role.project_name;
    const client = project?.client || role.client;
    const roleTitle = role.role_title || role.role;
    const email = c.email || (c.name.toLowerCase().replace(" ", ".") + "@accenture.com");

    const firstName = c.name.split(" ")[0];
    const startDate = role.start_date || project?.start_date || "TBC";
    const duration = role.duration || project?.duration || "TBC";
    const district = role.district || project?.district || "Singapore";
    const wfhPolicy = role.wfh_policy || project?.wfh_policy || "hybrid";

    const subject = encodeURIComponent(
      roleTitle + " opportunity — " + projectName + " (" + client + ")"
    );
    const bodyText = "Hi " + firstName + ",\n\n" +
      "I\'m " + managerName + ", PM for the " + projectName + " project at " + client + ". " +
      "I came across your profile and think you\'d be a strong fit for the " + roleTitle + " role we\'re currently staffing.\n\n" +
      "Quick details:\n" +
      "- Start: " + startDate + "\n" +
      "- Duration: " + duration + "\n" +
      "- Location: " + district + " (" + wfhPolicy + ")\n\n" +
      "Would you be open to a quick 15-min chat this week to see if it\'s a good fit? Happy to share more about the project scope.\n\n" +
      "Thanks,\n" +
      managerName;
    const body = encodeURIComponent(bodyText);

    // Use location.href for mailto — most reliable on Edge + Outlook (corporate setup)
    window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;

    // Mark as expressed in local state
    setExpressedInterest(prev => new Set([...prev, key]));

    // Also record in backend so consultant sees it
    try {
      await axios.post(`${API}/express-interest`, {
        consultant_id: c.id,
        role_id: getRoleId(role),
        manager_name: managerName,
        project_name: projectName,
        client: client,
        role_title: roleTitle,
        cl_label: role.cl_label,
        district: role.district,
        industry: role.industry,
      });
    } catch (e) {
      console.error("Backend record failed", e);
    }

    setToast(`Email draft opened for ${c.name}`);
    setTimeout(() => setToast(null), 3000);
  };

  const proposeTeam = async () => {
    setProposing(true);
    try {
      if (customProject) {
        // Custom project — propose team client-side from already-loaded candidates
        const proposed = projectRoles.map(role => {
          const candidates = rolesCandidates[getRoleId(role)] || [];
          const used = new Set();
          const best = candidates.find(c => !used.has(c.id));
          if (best) used.add(best.id);
          return { role, proposed: best ? [best] : [] };
        });
        setProposedTeam(proposed);
        setTab("proposed");
      } else {
        const r = await axios.post(`${API}/projects/${projectId}/propose-team`);
        setProposedTeam(r.data.proposed_team);
        setTab("proposed");
      }
    } catch (e) {
      setError("Failed to propose team. Please try again.");
    } finally { setProposing(false); }
  };

  const updateStatus = async (consultantId, roleId, status) => {
    try {
      await axios.patch(`${API}/applications/status`, {
        consultant_id: consultantId,
        role_id: roleId,
        status,
      });
      // Refresh candidates for this role
      const res = await axios.get(`${API}/roles/${roleId}/candidates`);
      setRolesCandidates(prev => ({ ...prev, [roleId]: res.data }));
    } catch (e) {
      setError("Failed to update status.");
    }
  };

  if (error) return (
    <div className="error-screen">
      <p>⚠️ {error}</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  );

  if (!project) return <div className="loading">Loading project...</div>;

  const totalHeadcount = projectRoles.reduce((sum, r) => sum + 1, 0);

  return (
    <div className="view-container">

      {/* Project card */}
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h2>{project.name}</h2>
            <span className="tag">{project.client}</span>
            <span className="tag tag-secondary">{project.industry}</span>
          </div>
          <div className="profile-meta">
            <span>📅 {project.duration}</span>
            <span>🏠 {project.wfh_policy}</span>
            <span>📍 {project.district}</span>
            <span>👥 {totalHeadcount} roles open</span>
          </div>
        </div>
        <div className="skills-row">
          {project.required_skills?.map(s => (
            <span key={s} className="skill-chip">{s}</span>
          ))}
        </div>
        <div className="team-composition">
          <span className="team-comp-label">Open roles:</span>
          {projectRoles.map(r => (
            <span key={getRoleId(r)} className="slot-chip-lg">
              {r.role_title} <span className="slot-cl">({r.cl_label})</span>
            </span>
          ))}
        </div>
        <p className="card-desc" style={{marginTop:"8px"}}>{project.description}</p>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab==="slots"?"tab active":"tab"} onClick={()=>setTab("slots")}>
          👥 Candidates by Role ({projectRoles.length} roles)
        </button>
        <button className={tab==="proposed"?"tab active":"tab"} onClick={()=>setTab("proposed")}>
          🎯 Proposed Team {proposedTeam && `(${proposedTeam.length} slots)`}
        </button>
      </div>

      {/* Applicants summary for existing projects */}
      {tab === "slots" && !customProject && (() => {
        const totalApplicants = Object.values(rolesCandidates)
          .flat().filter(c => c.has_applied).length;
        if (totalApplicants === 0) return null;
        return (
          <div className="applicants-banner">
            <span className="applicants-banner-icon">📬</span>
            <div>
              <strong>{totalApplicants} consultant{totalApplicants > 1 ? "s have" : " has"} applied to roles in this project</strong>
              <p>Applicants are highlighted with ✅ in the candidate list below. You can view their submitted CV before running the matching algorithm.</p>
            </div>
          </div>
        );
      })()}

      {/* No applicants note for custom projects */}
      {tab === "slots" && customProject && (
        <div className="no-applicants-note">
          <span>💡</span>
          <span>This is a newly created project — no consultants have applied yet. The system will recommend candidates based on skills, preferences, and availability.</span>
        </div>
      )}

      {/* Propose bar */}
      {tab === "slots" && (
        <div className="propose-bar">
          <div>
            <strong>Ready to find the best team?</strong>
            <p>ConsultMatch uses Gale-Shapley matching to propose an optimal team, prioritising consultants who have applied or expressed interest.</p>
          </div>
          <button className="propose-btn" onClick={proposeTeam} disabled={proposing}>
            {proposing ? "Proposing..." : "🎯 Propose Full Team"}
          </button>
        </div>
      )}

      {/* Loading state */}
      {tab === "slots" && loadingCandidates && (
        <div className="candidates-loading">
          <div className="loading-spinner"/>
          <p>Finding the best candidates for each role...</p>
          <p className="loading-sub">Scoring {projectRoles.length} roles against consultant profiles</p>
        </div>
      )}

      {/* Slots view — one section per role */}
      {tab === "slots" && !loadingCandidates && (
        <div className="slots-container">
          {projectRoles.length === 0 && (
            <div className="empty-state">
              <p>📋</p>
              <p>No roles defined for this project yet.</p>
            </div>
          )}
          {projectRoles.map(role => {
            const candidates = rolesCandidates[getRoleId(role)] || [];
            const isExpanded = expandedRole === getRoleId(role);
            return (
              <div key={getRoleId(role)} className="slot-section">
                <div className="slot-header"
                  onClick={() => setExpandedRole(isExpanded ? null : getRoleId(role))}
                  style={{cursor:"pointer"}}>
                  <div>
                    <span className="slot-title">{role.role_title}</span>
                    <span className="slot-cl-badge">{role.cl_label}</span>
                    <span className="slot-count-badge">{candidates.length} candidates</span>
                    {candidates.some(c => c.has_applied) && (
                      <span className="signal-badge applied" style={{marginLeft:"6px"}}>
                        {candidates.filter(c => c.has_applied).length} applied
                      </span>
                    )}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:"12px"}}>
                    {isExpanded ? "▲ collapse" : "▼ expand"}
                  </span>
                </div>

                {isExpanded && (
                  <div className="candidate-list">
                    <p className="role-desc-manager">{role.description}</p>
                    {candidates.length === 0
                      ? <p className="empty-msg">No eligible candidates found for this CL range.</p>
                      : candidates.slice(0, 8).map((c, idx) => (
                          <CandidateCard key={c.id} c={c} idx={idx}
                            requiredSkills={role.required_skills}
                            onViewCV={() => setViewingCV({...c, roleId: getRoleId(role)})}
                            onUpdateStatus={(status) => updateStatus(c.id, getRoleId(role), status)} />
                        ))
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Proposed team view */}
      {tab === "proposed" && proposedTeam && (
        <div className="proposed-team">
          <div className="proposed-note">
            <span>🤖</span>
            <div>
              <strong>Gale-Shapley Proposed Team</strong>
              <p>Each role slot is filled with the highest-scoring available candidate. Consultants who applied get +10 priority, those who liked the project get +5. No consultant is assigned twice.</p>
            </div>
          </div>

          {proposedTeam.map(({ role, proposed }) => (
            <div key={getRoleId(role)} className="proposed-slot">
              <div className="slot-header">
                <span className="slot-title">{role.role_title}</span>
                <span className="slot-cl-badge">{role.cl_label}</span>
              </div>
              {proposed.length === 0
                ? <p className="empty-msg" style={{padding:"12px 16px"}}>
                    No candidates available for this slot.
                  </p>
                : proposed.map((c, idx) => c && (
                    <div key={c.id} className="proposed-card">
                      <div className="proposed-rank">#{idx+1}</div>
                      <div className="proposed-info">
                        <div className="proposed-name-row">
                          <strong>{c.name}</strong>
                          <span className="tag cl-tag">CL{c.cl}</span>
                          <span className="tag">{c.cl_title}</span>
                          {c.has_applied && <span className="signal-badge applied">✅ Applied</span>}
                          {!c.has_applied && c.has_liked && <span className="signal-badge liked">❤️ Interested</span>}
                        </div>
                        <div className="candidate-email">📧 {c.email || `${c.name.toLowerCase().replace(" ",".")}@accenture.com`}</div>
                        <div className="skills-row" style={{marginTop:"6px"}}>
                          {c.skills?.map(s => (
                            <span key={s} className={`skill-chip ${
                              role.required_skills?.includes(s) ? "matched" : ""}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      {c.score && <ScoreBadge score={c.score.total} small />}
                    </div>
                  ))
              }
            </div>
          ))}
        </div>
      )}

      {tab === "proposed" && !proposedTeam && (
        <div className="empty-state">
          <p>🎯</p>
          <p>No team proposed yet.</p>
          <button className="propose-btn" onClick={proposeTeam} disabled={proposing}
            style={{marginTop:"16px"}}>
            {proposing ? "Proposing..." : "🎯 Propose Full Team"}
          </button>
        </div>
      )}

      {/* CV viewer modal */}
      {viewingCV && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setViewingCV(null)}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{viewingCV.name}'s CV</h3>
                <p>CL{viewingCV.cl} {viewingCV.cl_title}
                  {viewingCV.application_status && ` · ${viewingCV.application_status}`}
                </p>
              </div>
              <button className="modal-close" onClick={() => setViewingCV(null)}>✕</button>
            </div>
            <div className="modal-body">
              {viewingCV.cv_text
                ? <div className="cv-display">
                    {viewingCV.cv_text.split("\n").map((line, i) => {
                      // Render **bold** text
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      const rendered = parts.map((part, j) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={j}>{part.slice(2,-2)}</strong>
                          : part
                      );
                      // Detect headers (bold-only lines) vs bullet lines vs blank
                      const isBold = line.trim().startsWith("**") && line.trim().endsWith("**");
                      const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("• ");
                      const isBlank = line.trim() === "" || line.trim() === "---";
                      if (isBlank) return <div key={i} style={{height:"10px"}} />;
                      if (isBold) return <p key={i} className="cv-line-header">{rendered}</p>;
                      if (isBullet) return <p key={i} className="cv-line-bullet">{rendered}</p>;
                      return <p key={i} className="cv-line">{rendered}</p>;
                    })}
                  </div>
                : <p className="empty-msg">No CV submitted with this application.</p>}
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary"
                onClick={() => {
                  updateStatus(viewingCV.id, viewingCV.roleId, "Shortlisted");
                  setViewingCV(null);
                }}>
                ✅ Shortlist
              </button>
              <button className="modal-btn secondary"
                onClick={() => {
                  updateStatus(viewingCV.id, viewingCV.roleId, "Not Selected");
                  setViewingCV(null);
                }}>
                ✗ Not Selected
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast-notification">
          ⭐ {toast}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, idx, requiredSkills, expressedKey, expressedInterest, onViewCV, onExpressInterest, onUpdateStatus }) {
  const alreadyExpressed = expressedInterest?.has(expressedKey);
  return (
    <div className={`candidate-card ${c.has_applied ? "applied-card" : ""}`}>
      <div className="candidate-rank">#{idx+1}</div>
      <div className="candidate-info">
        <div className="candidate-name-row">
          <strong>{c.name}</strong>
          <span className="tag cl-tag">CL{c.cl}</span>
          <span className="tag">{c.cl_title}</span>
          {c.has_applied && <span className="signal-badge applied">✅ Applied</span>}
          {!c.has_applied && c.has_liked && <span className="signal-badge liked">❤️ Saved role</span>}
          {alreadyExpressed && <span className="signal-badge approached">✉️ Email Sent</span>}
        </div>
        <div className="candidate-email">📧 {c.email || `${c.name.toLowerCase().replace(" ",".")  }@accenture.com`}</div>
        <div className="skills-row" style={{marginTop:"6px"}}>
          {c.skills?.map(s => (
            <span key={s} className={`skill-chip ${requiredSkills?.includes(s) ? "matched" : ""}`}>
              {s}
            </span>
          ))}
        </div>
        {c.score && (
          <div className="score-breakdown" style={{marginTop:"6px"}}>
            <span>Skills {c.score.breakdown.skills}/40</span>
            <span>Prefs {c.score.breakdown.preference}/40</span>
            <span>Avail {c.score.breakdown.availability}/20</span>
          </div>
        )}
      </div>
      <div className="candidate-actions">
        {c.score && <ScoreBadge score={c.score.total} small />}
        {c.has_applied && (
          <button className="view-cv-btn" onClick={onViewCV}>View CV</button>
        )}
        {!alreadyExpressed && (
          <button className="express-btn" onClick={onExpressInterest}>
            ✉️ Contact
          </button>
        )}
      </div>
    </div>
  );
}
