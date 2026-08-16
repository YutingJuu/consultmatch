import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";
import CVTailor from "./CVTailor";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ConsultantView({ consultantId, customProfile }) {
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
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
      axios.get(`${API}/roles`).then(r => setRoles(r.data));
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
        roles.map(async role => {
          const r = await axios.post(`${API}/score/custom`,
            { consultant: customProfile, role_id: role.role_id });
          return { ...role, score: r.data };
        })
      );
      setRecommendations(scored.sort((a,b) => b.score.total - a.score.total));
      setScoresUnlocked(true);
    } finally { setLoadingScores(false); }
  };

  const toggleLike = async (roleId) => {
    const r = await axios.post(`${API}/likes`,
      { consultant_id: consultantId, role_id: roleId });
    setLikes(prev => r.data.status === "liked"
      ? [...prev, roleId] : prev.filter(id => id !== roleId));
  };

  const onApplied = (roleId, cvText) => {
    const role = displayList.find(x => x.role_id === roleId);
    if (role) {
      setApplications(prev => [...prev, {
        role_id: roleId,
        role_title: role.role_title,
        project_name: role.project_name,
        client: role.client,
        industry: role.industry,
        district: role.district || "Singapore",
        cl_label: role.cl_label,
        status: "Applied",
        applied_at: new Date().toISOString(),
      }]);
    }
  };

  if (!profile) return <div className="loading">Loading...</div>;

  const displayList = scoresUnlocked ? recommendations : roles;
  const likedRoles = displayList.filter(r => likes.includes(r.role_id));
  const appliedIds = new Set(applications.map(a => a.role_id));

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
              <p>See how well each role matches your profile and skills.</p>
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
            <span className="tag">{profile.cl_title}</span>
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
          🔍 Browse Roles ({displayList.length})
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
              <span>Showing all {roles.length} available roles across {new Set(roles.map(r=>r.project_id)).size} projects. Unlock scores to see personalised rankings.</span>
            </div>
          )}
          {displayList.map((role, i) => (
            <RoleCard key={role.role_id} role={role} rank={scoresUnlocked ? i+1 : null}
              liked={likes.includes(role.role_id)}
              applied={appliedIds.has(role.role_id)}
              onLike={() => toggleLike(role.role_id)}
              onApply={() => setApplyingTo(role)} />
          ))}
        </div>
      )}

      {/* Saved tab */}
      {tab === "saved" && (
        <div className="card-list">
          {likedRoles.length === 0
            ? <div className="empty-state">
                <p>❤️</p>
                <p>No saved roles yet.</p>
                <p>Click the heart on any role card to save it here.</p>
              </div>
            : likedRoles.map(role => (
                <RoleCard key={role.role_id} role={role}
                  liked={true} applied={appliedIds.has(role.role_id)}
                  onLike={() => toggleLike(role.role_id)}
                  onApply={() => setApplyingTo(role)} />
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
                <p>Click "Apply" on any role card to get started.</p>
              </div>
            : applications.map(a => (
                <div key={a.role_id} className="application-card">
                  <div className="application-header">
                    <div>
                      <strong>{a.role_title}</strong>
                      <span className="card-client">
                        {a.project_name} · {a.client}
                      </span>
                      <span className="app-cl-label">{a.cl_label}</span>
                    </div>
                    <span className="status-pill"
                      style={{background: STATUS_COLOR[a.status]+"20",
                              color: STATUS_COLOR[a.status],
                              border:`1px solid ${STATUS_COLOR[a.status]}40`}}>
                      {a.status}
                    </span>
                  </div>
                  <div className="application-meta">
                    <span>📍 {a.district}</span>
                    <span>🏭 {a.industry}</span>
                    <span>🕐 Applied {new Date(a.applied_at).toLocaleDateString("en-SG",
                      {day:"numeric",month:"short",year:"numeric"})}</span>
                  </div>
                  <div className="application-timeline">
                    {["Applied","Under Review","Shortlisted"].map(s => {
                      const order = ["Applied","Under Review","Shortlisted","Not Selected"];
                      const done = order.indexOf(s) <= order.indexOf(a.status) && a.status !== "Not Selected";
                      const current = a.status === s;
                      return (
                        <div key={s} className={`timeline-step ${done?"done":""} ${current?"current":""}`}>
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

      {applyingTo && (
        <CVTailor
          role={applyingTo}
          consultantProfile={profile}
          consultantId={consultantId}
          onClose={() => setApplyingTo(null)}
          onApplied={onApplied}
        />
      )}
    </div>
  );
}

function RoleCard({ role, rank, liked, applied, onLike, onApply }) {
  return (
    <div className="project-card">
      <div className="card-top">
        <div style={{flex:1}}>
          {rank && <span className="rank-num">#{rank}</span>}
          <strong>{role.role_title}</strong>
          <span className="tag cl-tag" style={{marginLeft:"8px",fontSize:"11px"}}>
            {role.cl_label}
          </span>
          <div className="role-project-line">
            {role.project_name} · {role.client}
          </div>
        </div>
        <div className="card-top-right">
          {role.score
            ? <ScoreBadge score={role.score.total} />
            : <div className="score-locked">🔒 Score locked</div>}
          <button
            className="like-btn"
            onClick={onLike}
            title={liked ? "Remove from saved" : "Save this role"}
          >
            {liked ? "❤️" : "🤍"}
          </button>
        </div>
      </div>

      <div className="card-meta">
        <span>🏭 {role.industry}</span>
        <span>📍 {role.district}</span>
        <span>🏠 {role.wfh_policy}</span>
        <span>⏱ {role.duration}</span>
      </div>

      {role.score && (
        <>
          <div className="score-breakdown">
            <span>Skills {role.score.breakdown.skills}/40</span>
            <span>Preferences {role.score.breakdown.preference}/40</span>
            <span>CL Fit {role.score.breakdown.cl}/20</span>
          </div>
          <div className="skill-match-row">
            {role.required_skills.map(s => {
              const matched = role.score.matched_skills.includes(s.toLowerCase());
              return (
                <span key={s} className={`skill-match-chip ${matched?"match":"no-match"}`}>
                  {matched?"✅":"❌"} {s}
                </span>
              );
            })}
          </div>
          <div className="card-flags">
            {role.score.industry_match && <span className="flag green">✓ Industry fit</span>}
            {role.score.wfh_match && <span className="flag green">✓ WFH match</span>}
            {role.score.style_match && <span className="flag green">✓ Work style</span>}
            {role.score.duration_match && <span className="flag green">✓ Duration</span>}
            {!role.score.industry_match && <span className="flag grey">✗ Industry mismatch</span>}
            {!role.score.wfh_match && <span className="flag grey">✗ WFH mismatch</span>}
          </div>
        </>
      )}

      {!role.score && (
        <div className="skills-row" style={{margin:"8px 0"}}>
          {role.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
      )}

      <p className="card-desc">{role.description}</p>

      <div className="card-actions">
        {applied
          ? <span className="applied-badge">✅ Applied</span>
          : <button className="apply-btn" onClick={onApply}>📄 Apply to this Role</button>}
      </div>
    </div>
  );
}
