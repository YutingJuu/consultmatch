import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ManagerView({ projectId }) {
  const [project, setProject] = useState(null);
  const [slotRecs, setSlotRecs] = useState([]);
  const [proposedTeam, setProposedTeam] = useState(null);
  const [proposing, setProposing] = useState(false);
  const [tab, setTab] = useState("slots");
  const [viewingCV, setViewingCV] = useState(null);

  useEffect(() => {
    axios.get(`${API}/projects/${projectId}`).then(r => setProject(r.data));
    axios.get(`${API}/projects/${projectId}/team-recommendations`).then(r => {
      setSlotRecs(r.data.slots || []);
    });
  }, [projectId]);

  const proposeTeam = async () => {
    setProposing(true);
    try {
      const r = await axios.post(`${API}/projects/${projectId}/propose-team`);
      setProposedTeam(r.data.proposed_team);
      setTab("proposed");
    } finally { setProposing(false); }
  };

  const updateStatus = async (consultantId, status) => {
    await axios.patch(`${API}/applications/status`, {
      consultant_id: consultantId, project_id: projectId, status,
    });
    // Refresh
    axios.get(`${API}/projects/${projectId}/team-recommendations`).then(r => {
      setSlotRecs(r.data.slots || []);
    });
  };

  if (!project) return <div className="loading">Loading...</div>;

  const totalSlots = project.team_slots?.reduce((sum, s) => sum + s.count, 0) || 0;

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
            <span>👥 {totalSlots} headcount</span>
          </div>
        </div>
        <div className="skills-row">
          {project.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>

        {/* Team composition */}
        <div className="team-composition">
          <span className="team-comp-label">Team composition:</span>
          {project.team_slots?.map(s => (
            <span key={s.slot_id} className="slot-chip-lg">
              {s.count}× {s.role} <span className="slot-cl">({s.cl_label})</span>
            </span>
          ))}
        </div>
        <p className="card-desc" style={{marginTop:"8px"}}>{project.description}</p>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab==="slots"?"tab active":"tab"} onClick={()=>setTab("slots")}>
          👥 Candidates by Role Slot
        </button>
        <button className={tab==="proposed"?"tab active":"tab"} onClick={()=>setTab("proposed")}>
          🎯 Proposed Team {proposedTeam && `(${proposedTeam.length} slots)`}
        </button>
      </div>

      {/* Propose button */}
      {tab === "slots" && (
        <div className="propose-bar">
          <div>
            <strong>Ready to find the best team?</strong>
            <p>ConsultMatch will use Gale-Shapley matching to propose an optimal team composition, prioritising consultants who have applied or expressed interest.</p>
          </div>
          <button className="propose-btn" onClick={proposeTeam} disabled={proposing}>
            {proposing ? "Proposing..." : "🎯 Propose Full Team"}
          </button>
        </div>
      )}

      {/* Slots view */}
      {tab === "slots" && (
        <div className="slots-container">
          {slotRecs.map(({ slot, candidates }) => (
            <div key={slot.slot_id} className="slot-section">
              <div className="slot-header">
                <div>
                  <span className="slot-title">{slot.role}</span>
                  <span className="slot-cl-badge">{slot.cl_label}</span>
                  <span className="slot-count-badge">{slot.count} needed</span>
                </div>
              </div>

              <div className="candidate-list">
                {candidates.length === 0
                  ? <p className="empty-msg">No eligible candidates found for this CL range.</p>
                  : candidates.slice(0, 5).map((c, idx) => (
                      <CandidateCard key={c.id} c={c} idx={idx}
                        onViewCV={() => setViewingCV(c)}
                        onUpdateStatus={(status) => updateStatus(c.id, status)} />
                    ))
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proposed team view */}
      {tab === "proposed" && proposedTeam && (
        <div className="proposed-team">
          <div className="proposed-note">
            <span>🤖</span>
            <div>
              <strong>Gale-Shapley Proposed Team</strong>
              <p>Consultants are matched to role slots by compatibility score, with priority given to those who have applied or liked this project. No two consultants are assigned to the same slot.</p>
            </div>
          </div>

          {proposedTeam.map(({ slot, proposed }) => (
            <div key={slot.slot_id} className="proposed-slot">
              <div className="slot-header">
                <span className="slot-title">{slot.role}</span>
                <span className="slot-cl-badge">{slot.cl_label}</span>
              </div>
              {proposed.length === 0
                ? <p className="empty-msg">No candidates available for this slot.</p>
                : proposed.map((c, idx) => (
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
                        <div className="skills-row" style={{marginTop:"6px"}}>
                          {c.skills.map(s => (
                            <span key={s} className={`skill-chip ${
                              project.required_skills.includes(s) ? "matched" : ""}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ScoreBadge score={c.score.total} small />
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
          <button className="propose-btn" onClick={proposeTeam} disabled={proposing}>
            {proposing ? "Proposing..." : "Propose Full Team"}
          </button>
        </div>
      )}

      {/* CV viewer modal */}
      {viewingCV && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewingCV(null)}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{viewingCV.name}'s Submitted CV</h3>
                <p>CL{viewingCV.cl} {viewingCV.cl_title} · Status: {viewingCV.application_status}</p>
              </div>
              <button className="modal-close" onClick={() => setViewingCV(null)}>✕</button>
            </div>
            <div className="modal-body">
              {viewingCV.cv_text
                ? <pre className="cv-display">{viewingCV.cv_text}</pre>
                : <p className="empty-msg">No CV submitted with this application.</p>}
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary"
                onClick={() => { updateStatus(viewingCV.id, "Shortlisted"); setViewingCV(null); }}>
                ✅ Shortlist
              </button>
              <button className="modal-btn secondary"
                onClick={() => { updateStatus(viewingCV.id, "Not Selected"); setViewingCV(null); }}>
                ✗ Not Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, idx, onViewCV, onUpdateStatus }) {
  return (
    <div className="candidate-card">
      <div className="candidate-rank">#{idx+1}</div>
      <div className="candidate-info">
        <div className="candidate-name-row">
          <strong>{c.name}</strong>
          <span className="tag cl-tag">CL{c.cl}</span>
          <span className="tag">{c.cl_title}</span>
          {c.has_applied && (
            <span className="signal-badge applied">✅ Applied
              {c.application_status && ` · ${c.application_status}`}
            </span>
          )}
          {!c.has_applied && c.has_liked && (
            <span className="signal-badge liked">❤️ Interested</span>
          )}
        </div>
        <div className="skills-row" style={{marginTop:"6px"}}>
          {c.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
        <div className="score-breakdown" style={{marginTop:"6px"}}>
          <span>Skills {c.score.breakdown.skills}/40</span>
          <span>Preferences {c.score.breakdown.preference}/40</span>
          <span>CL Fit {c.score.breakdown.cl}/20</span>
        </div>
      </div>
      <div className="candidate-actions">
        <ScoreBadge score={c.score.total} small />
        {c.has_applied && (
          <button className="view-cv-btn" onClick={onViewCV}>View CV</button>
        )}
      </div>
    </div>
  );
}
