import React, { useState, useEffect } from "react";
import axios from "axios";
import OnboardingWizard from "./OnboardingWizard";
import ProjectWizard from "./ProjectWizard";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// 5 curated sample profiles — varied CLs and backgrounds
const SAMPLE_IDS = ["C07", "C05", "C01", "C04", "C15"];

// Hardcoded so dropdown appears instantly without waiting for API
const SAMPLE_CONSULTANTS = [
  { id:"C07", name:"Grace Koh",   cl:11, cl_title:"Analyst",
    skills:["Excel","PowerPoint","Business Analysis","Research","SQL"],
    preferred_industries:["Healthcare","Government"], work_style:"structured",
    wfh_preference:"onsite", preferred_duration:"1-3 months",
    career_goal:"client_exposure", available_from:"2026-09-01",
    email:"grace.koh@accenture.com" },
  { id:"C05", name:"Eva Chen",    cl:10, cl_title:"Senior Analyst",
    skills:["SQL","Tableau","Business Analysis","Data ETL","Power BI"],
    preferred_industries:["Retail","Logistics"], work_style:"structured",
    wfh_preference:"hybrid", preferred_duration:"1-3 months",
    career_goal:"client_exposure", available_from:"2026-09-10",
    email:"eva.chen@accenture.com" },
  { id:"C01", name:"Alice Tan",   cl:9,  cl_title:"Consultant",
    skills:["Python","Machine Learning","Data Visualisation","SQL","Statistics"],
    preferred_industries:["Banking","Technology"], work_style:"structured",
    wfh_preference:"hybrid", preferred_duration:"3-6 months",
    career_goal:"technical_depth", available_from:"2026-09-01",
    email:"alice.tan@accenture.com" },
  { id:"C04", name:"David Ng",    cl:8,  cl_title:"Associate Manager",
    skills:["Strategy","Business Analysis","Client Relationship Management","Agile","Stakeholder Management"],
    preferred_industries:["Banking","Insurance"], work_style:"structured",
    wfh_preference:"hybrid", preferred_duration:">6 months",
    career_goal:"leadership", available_from:"2026-08-20",
    email:"david.ng@accenture.com" },
  { id:"C15", name:"Olivia Tan",  cl:7,  cl_title:"Manager",
    skills:["Strategy","Mergers & Acquisitions","Financial Modelling","Stakeholder Management"],
    preferred_industries:["Banking","Private Equity"], work_style:"structured",
    wfh_preference:"onsite", preferred_duration:">6 months",
    career_goal:"leadership", available_from:"2026-09-01",
    email:"olivia.tan@accenture.com" },
];

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("landing"); // landing | consultant-choice | onboarding | existing | manager-choice | project-wizard | existing-project
  const [consultants, setConsultants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [customProfiles, setCustomProfiles] = useState(
    () => JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]")
  );
  const [customProject, setCustomProject] = useState(null);

  useEffect(() => {
    // Sample consultants hardcoded — no API call needed, avoids cold-start delay
    setConsultants(SAMPLE_CONSULTANTS);
    const saved = JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]");
    if (saved.length > 0) setSelectedConsultantId(saved[0].id);
    else setSelectedConsultantId(SAMPLE_CONSULTANTS[0].id);

    // Projects still need API (more complex data)
    axios.get(`${API}/projects`).then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelectedManagerId(r.data[0].manager_id);
    }).catch(() => {});
  }, []);

  const handleExistingLogin = () => {
    const c = [...customProfiles, ...consultants].find(c => c.id === selectedConsultantId);
    const isCustom = customProfiles.some(p => p.id === c.id);
    onLogin({ role: "consultant", id: c.id, name: c.name,
              isCustom, profile: isCustom ? c : null });
  };

  const handleManagerLogin = () => {
    const p = projects.find(p => p.manager_id === selectedManagerId);
    onLogin({ role: "manager", id: p.id, name: p.manager_name });
  };

  const handleProjectComplete = (project) => {
    setCustomProject(project);
    onLogin({ role: "manager", id: project.id, name: project.manager_name,
               isCustomProject: true, project });
  };

  const handleOnboardingComplete = (customProfile) => {
    // Save to sessionStorage so it persists within the session
    const saved = JSON.parse(sessionStorage.getItem("consultmatch_custom_profiles") || "[]");
    const updated = [customProfile, ...saved.filter(p => p.id !== customProfile.id)];
    sessionStorage.setItem("consultmatch_custom_profiles", JSON.stringify(updated));
    setCustomProfiles(updated);
    onLogin({ role: "consultant", id: customProfile.id, name: customProfile.name,
               isCustom: true, profile: customProfile });
  };

  // ── Landing screen ───────────────────────────────────────────────────────
  if (role === "landing") {
    return (
      <div className="login-screen">
        <div className="login-card landing-card">
          <div className="login-logo">ConsultMatch</div>
          <p className="login-tagline">Preference-Driven Consultant Allocation</p>
          <p className="landing-desc">
            A two-sided matching system that aligns consultants and projects
            based on mutual compatibility — not just skill overlap.
          </p>
          <div className="landing-roles">
            <button className="landing-role-btn" onClick={() => setRole("consultant-choice")}>
              <span className="role-icon">👤</span>
              <span className="role-text">
                <span className="role-title">I'm a Consultant</span>
                <span className="role-sub">Browse roles and find projects that match your profile</span>
              </span>
            </button>
            <button className="landing-role-btn" onClick={() => setRole("manager-choice")}>
              <span className="role-icon">📋</span>
              <span className="role-text">
                <span className="role-title">I'm a Project Manager</span>
                <span className="role-sub">Find the right candidates for your project</span>
              </span>
            </button>
          </div>
          <p className="login-note">Demo prototype · NUS MSBA Capstone 2026</p>
        </div>
      </div>
    );
  }

  // ── Consultant choice: new or existing ───────────────────────────────────
  if (role === "consultant-choice") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("landing")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">How would you like to continue?</p>

          <div className="choice-cards">
            <button className="choice-card primary" onClick={() => setRole("onboarding")}>
              <span className="choice-icon">✨</span>
              <span className="choice-title">New here?</span>
              <span className="choice-sub">Fill in your profile and preferences to get personalised project matches</span>
            </button>
            <button className="choice-card" onClick={() => setRole("existing")}>
              <span className="choice-icon">🔄</span>
              <span className="choice-title">Use existing profile</span>
              <span className="choice-sub">Select a pre-filled consultant profile to explore the system</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding wizard ────────────────────────────────────────────────────
  if (role === "onboarding") {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onBack={() => setRole("consultant-choice")}
      />
    );
  }

  // ── Existing consultant select ────────────────────────────────────────────
  if (role === "existing") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("consultant-choice")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">Select a consultant profile</p>

          <div className="login-field">
            <label>Choose profile</label>
            <select value={selectedConsultantId}
              onChange={e => setSelectedConsultantId(e.target.value)}>
              {customProfiles.length > 0 && (
                <optgroup label="Your Profiles">
                  {customProfiles.map(c => (
                    <option key={c.id} value={c.id}>
                      ✨ {c.name} (CL{c.cl} {c.cl_title})
                    </option>
                  ))}
                </optgroup>
              )}
              <>
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (CL{c.cl} {c.cl_title})</option>
                ))}
              </>
            </select>
          </div>

          {selectedConsultantId && (() => {
            const c = [...customProfiles, ...consultants].find(x => x.id === selectedConsultantId);
            if (!c) return null;
            return (
              <div className="profile-preview">
                <div className="preview-row">
                  <span>Level</span>
                  <strong>CL{c.cl} {c.cl_title}</strong>
                </div>
                <div className="preview-row">
                  <span>Industries</span>
                  <strong>{c.preferred_industries?.join(", ") || "—"}</strong>
                </div>
                <div className="preview-row">
                  <span>WFH</span>
                  <strong>{c.wfh_preference}</strong>
                </div>
                <div className="preview-row">
                  <span>Goal</span>
                  <strong>{c.career_goal?.replace("_"," ") || "—"}</strong>
                </div>
                <div className="preview-skills">
                  {c.skills?.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            );
          })()}

          <button className="login-btn" onClick={handleExistingLogin}>
            Enter as this consultant →
          </button>
        </div>
      </div>
    );
  }

  // ── Manager: new project wizard ──────────────────────────────────────────
  if (role === "project-wizard") {
    return (
      <ProjectWizard
        onComplete={handleProjectComplete}
        onBack={() => setRole("manager-choice")}
      />
    );
  }

  // ── Manager: choice screen ────────────────────────────────────────────────
  if (role === "manager-choice") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("landing")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">How would you like to continue?</p>

          <div className="choice-cards">
            <button className="choice-card primary" onClick={() => setRole("project-wizard")}>
              <span className="choice-icon">✨</span>
              <span className="choice-title">New project</span>
              <span className="choice-sub">Define your project and team composition to find the best consultants</span>
            </button>
            <button className="choice-card" onClick={() => setRole("existing-project")}>
              <span className="choice-icon">📋</span>
              <span className="choice-title">Use existing project</span>
              <span className="choice-sub">Select from sample projects to explore the system</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Manager: existing project select ──────────────────────────────────────
  if (role === "existing-project") {
    const SAMPLE_PROJECT_IDS = ["P01", "P03", "P05", "P08", "P13"];
    const sampleProjects = projects.filter(p => SAMPLE_PROJECT_IDS.includes(p.id));
    const selectedProject = sampleProjects.find(x => x.manager_id === selectedManagerId)
      || sampleProjects[0];

    return (
      <div className="login-screen">
        <div className="login-card">
          <button className="back-btn" onClick={() => setRole("manager-choice")}>← Back</button>
          <div className="login-logo" style={{fontSize:"20px"}}>ConsultMatch</div>
          <p className="login-tagline">Select a project</p>

          <div className="login-field">
            <label>Choose project</label>
            <select value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}>
              {sampleProjects.map(p => (
                <option key={p.manager_id} value={p.manager_id}>
                  {p.manager_name} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="profile-preview">
              <div className="preview-row">
                <span>Client</span><strong>{selectedProject.client}</strong>
              </div>
              <div className="preview-row">
                <span>Industry</span><strong>{selectedProject.industry}</strong>
              </div>
              <div className="preview-row">
                <span>Duration</span><strong>{selectedProject.duration}</strong>
              </div>
              <div className="preview-row">
                <span>WFH</span><strong>{selectedProject.wfh_policy}</strong>
              </div>
              <div className="preview-row">
                <span>Roles</span>
                <strong>{selectedProject.team_slots?.length || 0} open</strong>
              </div>
              <div className="preview-skills">
                {selectedProject.team_slots?.map(s => (
                  <span key={s.slot_id} className="skill-chip">{s.role}</span>
                ))}
              </div>
            </div>
          )}

          <button className="login-btn" onClick={handleManagerLogin}
            disabled={!selectedProject}>
            Enter as Project Manager →
          </button>
        </div>
      </div>
    );
  }
}
