import React, { useState, useEffect } from "react";
import axios from "axios";
import ScoreBadge from "./ScoreBadge";
import CVTailor from "./CVTailor";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ConsultantView({ consultantId, customProfile }) {
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [scoresUnlocked, setScoresUnlocked] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [likes, setLikes] = useState([]);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [applications, setApplications] = useState([]);

  const [applyingTo, setApplyingTo] = useState(null);
  const [tab, setTab] = useState("browse");
  const isCustom = !!customProfile;

  useEffect(() => {
    if (isCustom) {
      setProfile(customProfile);
      // Auto-score immediately — no unlock step needed
      setLoadingScores(true);
      axios.post(`${API}/score/custom/batch`, { consultant: customProfile })
        .then(r => {
          setRecommendations(r.data);
          setScoresUnlocked(true);
        })
        .catch(() => {
          // Fallback: load unscored roles
          const cl = customProfile?.cl || 9;
          axios.get(`${API}/roles`).then(r2 => {
            setRoles(r2.data.filter(role =>
              role.cl_range[0] <= cl && cl <= role.cl_range[1]
            ));
          });
        })
        .finally(() => {
          setLoadingScores(false);
          setInitialLoading(false);
        });
    } else {
      axios.get(`${API}/consultants/${consultantId}`).then(r => setProfile(r.data));
      axios.get(`${API}/consultants/${consultantId}/recommendations`).then(r => {
        setRecommendations(r.data); setScoresUnlocked(true); setInitialLoading(false);
      });
    }
    axios.get(`${API}/likes/${consultantId}`).then(r => setLikes(r.data.liked || []));
    fetchApplications();

  }, [consultantId, isCustom]);



  const fetchApplications = () => {
    axios.get(`${API}/applications/${consultantId}`).then(r => {
      setApplications(r.data);
      setAppliedIds(new Set(r.data.map(a => a.role_id)));
    }).catch(() => {});
  };

  const toggleLike = async (roleId) => {
    const r = await axios.post(`${API}/likes`,
      { consultant_id: consultantId, role_id: roleId }); // roleId is already resolved by caller
    setLikes(prev => r.data.status === "liked"
      ? [...prev, roleId] : prev.filter(id => id !== roleId));
  };

  const onApplied = (roleId, roleData) => {
    setAppliedIds(prev => new Set([...prev, roleId]));
    setApplications(prev => [...prev, {
      role_id: roleId,
      role_title: roleData?.role_title || roleData?.role,
      project_name: roleData?.project_name,
      client: roleData?.client,
      industry: roleData?.industry,
      district: roleData?.district || "Singapore",
      cl_label: roleData?.cl_label,
      status: "Applied",
      applied_at: new Date().toISOString(),
      manager_initiated: false,
    }]);
  };

  if (!profile) return <div className="loading">Loading...</div>;

  const displayList = recommendations;
  const likedRoles = recommendations.filter(r => likes.includes(r.role_id || r.slot_id));


  return (
    <div className="view-container">


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

        </button>
        <button className={tab==="saved"?"tab active":"tab"} onClick={()=>setTab("saved")}>
          ❤️ Saved {likes.length > 0 && `(${likes.length})`}
        </button>
        <button className={tab==="applications"?"tab active":"tab"} onClick={()=>setTab("applications")}>
          📋 My Applications {applications.length > 0 && `(${applications.length})`}
        </button>
      </div>

      {/* Browse tab */}
      {tab === "browse" && (loadingScores || initialLoading) && (
        <div className="candidates-loading">
          <div className="loading-spinner"/>
          <p>Finding your best matches...</p>
          <p className="loading-sub">Scoring roles against your profile and availability</p>
        </div>
      )}

      {tab === "browse" && !loadingScores && !initialLoading && (
        <div className="card-list">
          {displayList.map((role, i) => (
            <RoleCard key={role.role_id || role.slot_id} role={role} rank={scoresUnlocked ? i+1 : null}
              liked={likes.includes(role.role_id || role.slot_id)}
              applied={appliedIds.has(role.role_id || role.slot_id)}
              onLike={() => toggleLike(role.role_id || role.slot_id)}
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
                <RoleCard key={role.role_id || role.slot_id} role={role}
                  liked={true} applied={appliedIds.has(role.role_id || role.slot_id)}
                  onLike={() => toggleLike(role.role_id || role.slot_id)}
                  onApply={() => setApplyingTo(role)} />
              ))
          }
        </div>
      )}


            {/* My Applications tab */}
      {tab === "applications" && (
        <div className="applications-panel">
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"8px"}}>
            <button className="refresh-btn" onClick={fetchApplications}>
              ↺ Refresh
            </button>
          </div>
          {applications.length === 0
            ? <div className="empty-state">
                <p>📋</p>
                <p>No applications yet.</p>
                <p>Browse roles and click Apply, or a manager may reach out to you.</p>
              </div>
            : applications.map((a, idx) => {
                const STATUS_CONFIG = {
                  "Applied":           { color: "#3b82f6", bg: "#eff6ff", icon: "📤", label: "Applied" },
                  "Manager Interested": { color: "#16a34a", bg: "#f0fdf4", icon: "⭐", label: "Manager Interested" },
                  "Shortlisted":       { color: "#16a34a", bg: "#f0fdf4", icon: "✅", label: "Shortlisted" },
                  "Not Selected":      { color: "#94a3b8", bg: "#f8fafc", icon: "✗",  label: "Not Selected" },
                };
                const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG["Applied"];
                return (
                  <div key={idx} className="application-card">
                    <div className="application-header">
                      <div>
                        <strong>{a.role_title}</strong>
                        <span className="card-client">{a.project_name} · {a.client}</span>
                        {a.cl_label && <span className="app-cl-label">{a.cl_label}</span>}
                      </div>
                      <span className="status-pill"
                        style={{background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40`}}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <div className="application-meta">
                      <span>📍 {a.district || "Singapore"}</span>
                      <span>🏭 {a.industry}</span>
                      <span>🕐 {a.manager_initiated ? "Manager reached out" : "You applied"} · {new Date(a.applied_at).toLocaleDateString("en-SG", {day:"numeric",month:"short",year:"numeric"})}</span>
                    </div>
                    {a.status === "Manager Interested" && (
                      <div className="manager-interest-note">
                        ⭐ A project manager has expressed interest in your profile for this role. Check your email for further communication.
                      </div>
                    )}
                  </div>
                );
              })
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
          {role.score && <ScoreBadge score={role.score.total} />}
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
