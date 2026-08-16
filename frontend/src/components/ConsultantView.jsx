import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";
import CVTailor from "./CVTailor";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ConsultantView({ consultantId, customProfile }) {
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [scoresUnlocked, setScoresUnlocked] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [likes, setLikes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [applyingTo, setApplyingTo] = useState(null);
  const [tab, setTab] = useState("browse");
  const isCustom = !!customProfile;

  useEffect(() => {
    if (isCustom) {
      setProfile(customProfile);
      axios.get(`${API}/projects`).then(r => setProjects(r.data));
    } else {
      axios.get(`${API}/consultants/${consultantId}`).then(r => setProfile(r.data));
      axios.get(`${API}/consultants/${consultantId}/recommendations`).then(r => {
        setRecommendations(r.data); setScoresUnlocked(true);
      });
    }
    axios.get(`${API}/likes/${consultantId}`).then(r => setLikes(r.data.liked || []));
    axios.get(`${API}/applications/${consultantId}`).then(r => setApplications(r.data));
  }, [consultantId, isCustom]);

  const unlockScores = async () => {
    setLoadingScores(true);
    try {
      const scored = await Promise.all(
        projects.map(async p => {
          const r = await axios.post(`${API}/score/custom`, { consultant: customProfile, project_id: p.id });
          return { ...p, score: r.data };
        })
      );
      setRecommendations(scored.sort((a,b) => b.score.total - a.score.total));
      setScoresUnlocked(true);
    } finally { setLoadingScores(false); }
  };

  const toggleLike = async (pid) => {
    const r = await axios.post(`${API}/likes`, { consultant_id: consultantId, project_id: pid });
    setLikes(prev => r.data.status === "liked" ? [...prev, pid] : prev.filter(id => id !== pid));
  };

  const onApplied = (projectId, cvText) => {
    const p = displayList.find(x => x.id === projectId);
    if (p) {
      setApplications(prev => [...prev, {
        project_id: projectId, project_name: p.name,
        client: p.client, industry: p.industry,
        district: p.district || "Singapore",
        status: "Applied", applied_at: new Date().toISOString(), cv_text: cvText,
      }]);
    }
  };

  if (!profile) return <div className="loading">Loading...</div>;

  const displayList = scoresUnlocked ? recommendations : projects;
  const likedProjects = displayList.filter(p => likes.includes(p.id));
  const appliedIds = new Set(applications.map(a => a.project_id));

  const STATUS_COLOR = {
    "Applied": "#3b82f6", "Under Review": "#d97706",
    "Shortlisted": "#16a34a", "Not Selected": "#94a3b8",
  };

  return (
    <div className="view-container">
      {/* Unlock banner */}
      {isCustom && !scoresUnlocked && (
        <div className="unlock-banner">
          <div className="unlock-banner-left">
            <span className="unlock-icon">🔒</span>
            <div>
              <strong>Unlock your compatibility scores</strong>
              <p>See how well each project matches your profile.</p>
            </div>
          </div>
          <button className="unlock-btn" onClick={unlockScores} disabled={loadingScores}>
            {loadingScores ? "Calculating..." : "✨ Unlock Scores"}
          </button>
        </div>
      )}

      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h2>{profile.name}</h2>
            <span className="tag cl-tag">CL{profile.cl}</span>
            <span className="tag">{profile.cl_title || profile.level}</span>
            {isCustom && <span className="tag tag-new">Your Profile</span>}
          </div>
          <div className="profile-meta">
            <span>📅 Available {profile.available_from}</span>
            <span>🏠 {profile.wfh_preference}</span>
            <span>🎯 {profile.career_goal?.replace("_"," ")}</span>
          </div>
        </div>
        <div className="skills-row">
          {profile.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
        <div className="pref-row">
          <span>Industries: {profile.preferred_industries?.join(", ")}</span>
          <span>Style: {profile.work_style}</span>
          <span>Duration: {profile.preferred_duration}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={tab==="browse"?"tab active":"tab"} onClick={()=>setTab("browse")}>
          🔍 Browse ({displayList.length})
          {scoresUnlocked && <span className="tab-badge">Scored</span>}
        </button>
        <button className={tab==="saved"?"tab active":"tab"} onClick={()=>setTab("saved")}>
          ❤️ Saved {likes.length > 0 && `(${likes.length})`}
        </button>
        <button className={tab==="applications"?"tab active":"tab"} onClick={()=>setTab("applications")}>
          📋 My Applications {applications.length > 0 && `(${applications.length})`}
        </button>
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <div className="card-list">
          {!scoresUnlocked && (
            <div className="unscored-notice">
              <span>📋</span>
              <span>Showing all {projects.length} available projects. Unlock scores to see compatibility rankings.</span>
            </div>
          )}
          {displayList.map((p, i) => (
            <ProjectCard key={p.id} p={p} i={i} scoresUnlocked={scoresUnlocked}
              liked={likes.includes(p.id)} applied={appliedIds.has(p.id)}
              onLike={() => toggleLike(p.id)}
              onApply={() => setApplyingTo(p)} />
          ))}
        </div>
      )}

      {/* Saved tab */}
      {tab === "saved" && (
        <div className="card-list">
          {likedProjects.length === 0
            ? <div className="empty-state">
                <p>❤️</p>
                <p>No saved projects yet.</p>
                <p>Click the heart icon on any project card to save it here.</p>
              </div>
            : likedProjects.map((p, i) => (
                <ProjectCard key={p.id} p={p} i={i} scoresUnlocked={scoresUnlocked}
                  liked={true} applied={appliedIds.has(p.id)}
                  onLike={() => toggleLike(p.id)}
                  onApply={() => setApplyingTo(p)} />
              ))
          }
        </div>
      )}

      {/* Applications tab */}
      {tab === "applications" && (
        <div className="applications-panel">
          {applications.length === 0
            ? <div className="empty-state">
                <p>📋</p>
                <p>No applications yet.</p>
                <p>Click "Apply to this Role" on any project card to get started.</p>
              </div>
            : applications.map(a => (
                <div key={a.project_id} className="application-card">
                  <div className="application-header">
                    <div>
                      <strong>{a.project_name}</strong>
                      <span className="card-client">{a.client} · {a.industry}</span>
                    </div>
                    <span className="status-pill"
                      style={{background: STATUS_COLOR[a.status] + "20",
                              color: STATUS_COLOR[a.status],
                              border: `1px solid ${STATUS_COLOR[a.status]}40`}}>
                      {a.status}
                    </span>
                  </div>
                  <div className="application-meta">
                    <span>📍 {a.district}</span>
                    <span>🕐 Applied {new Date(a.applied_at).toLocaleDateString("en-SG", {day:"numeric", month:"short", year:"numeric"})}</span>
                  </div>
                  <div className="application-timeline">
                    {["Applied","Under Review","Shortlisted"].map((s, idx) => {
                      const statuses = ["Applied","Under Review","Shortlisted","Not Selected"];
                      const currentIdx = statuses.indexOf(a.status);
                      const done = statuses.indexOf(s) <= currentIdx && a.status !== "Not Selected";
                      return (
                        <div key={s} className={`timeline-step ${done ? "done" : ""} ${a.status === s ? "current" : ""}`}>
                          <div className="timeline-dot"/>
                          <span>{s}</span>
                        </div>
                      );
                    })}
                  </div>
                  {a.status === "Not Selected" && (
                    <p className="not-selected-note">
                      Thank you for your interest. The project team has selected other candidates for this role.
                    </p>
                  )}
                </div>
              ))
          }
        </div>
      )}

      {/* CV Tailor modal */}
      {applyingTo && (
        <CVTailor
          project={applyingTo}
          consultantProfile={profile}
          consultantId={consultantId}
          onClose={() => setApplyingTo(null)}
          onApplied={onApplied}
        />
      )}
    </div>
  );
}

function ProjectCard({ p, i, scoresUnlocked, liked, applied, onLike, onApply }) {
  return (
    <div className={`project-card ${liked ? "liked-card" : ""}`}>
      <div className="card-top">
        <div>
          {scoresUnlocked && <span className="rank-num">#{i+1}</span>}
          <strong>{p.name}</strong>
          <span className="card-client">{p.client}</span>
        </div>
        <div className="card-top-right">
          {scoresUnlocked && p.score
            ? <ScoreBadge score={p.score.total} />
            : <div className="score-locked">🔒 Score locked</div>}
          <button className={`like-btn ${liked ? "liked" : ""}`} onClick={onLike}
            title={liked ? "Remove from saved" : "Save this project"}>
            {liked ? "❤️" : "🤍"}
          </button>
        </div>
      </div>

      <div className="card-meta">
        <span>🏭 {p.industry}</span>
        <span>📍 {p.district || p.location}</span>
        <span>🏠 {p.wfh_policy}</span>
        <span>⏱ {p.duration}</span>
        <span>👥 {p.team_size || "—"} people</span>
      </div>

      {/* Team slots */}
      {p.team_slots && (
        <div className="slot-row">
          {p.team_slots.map(s => (
            <span key={s.slot_id} className="slot-chip">
              {s.count}× {s.cl_label}
            </span>
          ))}
        </div>
      )}

      {scoresUnlocked && p.score && (
        <>
          <div className="score-breakdown">
            <span>Skills {p.score.breakdown.skills}/40</span>
            <span>Preferences {p.score.breakdown.preference}/40</span>
            <span>CL Fit {p.score.breakdown.cl}/20</span>
          </div>
          <div className="skill-match-row">
            {p.required_skills.map(s => {
              const matched = p.score.matched_skills.includes(s.toLowerCase());
              return (
                <span key={s} className={`skill-match-chip ${matched?"match":"no-match"}`}>
                  {matched?"✅":"❌"} {s}
                </span>
              );
            })}
          </div>
          <div className="card-flags">
            {p.score.industry_match && <span className="flag green">✓ Industry fit</span>}
            {p.score.wfh_match && <span className="flag green">✓ WFH match</span>}
            {p.score.style_match && <span className="flag green">✓ Work style</span>}
            {p.score.duration_match && <span className="flag green">✓ Duration</span>}
            {!p.score.industry_match && <span className="flag grey">✗ Industry mismatch</span>}
            {!p.score.wfh_match && <span className="flag grey">✗ WFH mismatch</span>}
          </div>
        </>
      )}

      <p className="card-desc">{p.description}</p>

      <div className="card-actions">
        {applied
          ? <span className="applied-badge">✅ Applied</span>
          : <button className="apply-btn" onClick={onApply}>📄 Apply to this Role</button>}
      </div>
    </div>
  );
}
