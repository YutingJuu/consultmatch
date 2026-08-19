import React, { useState, useRef } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const ALL_SKILLS = [
  "Python", "Machine Learning", "Deep Learning", "NLP", "Statistics", "R",
  "SQL", "Data ETL", "Data Visualisation", "Power BI", "Tableau",
  "AWS", "Cloud Architecture", "DevOps", "Kubernetes", "MLOps",
  "Agile", "Scrum", "Project Management", "Stakeholder Management",
  "Business Analysis", "Strategy", "Change Management",
  "UX Design", "Figma", "User Research",
  "Cybersecurity", "Risk Management", "Compliance",
  "SAP", "ERP", "Salesforce", "CRM",
  "Supply Chain", "Logistics Optimisation",
  "Financial Modelling", "Mergers & Acquisitions",
  "Data Governance", "Blockchain", "AI Agents",
  "Client Relationship Management", "Digital Marketing",
];

const INDUSTRIES = [
  "Banking", "Insurance", "Technology", "Healthcare",
  "Government", "Retail", "Logistics", "Telecommunications",
  "Manufacturing", "Private Equity",
];

const LEVELS = [
  { label: "CL11 Analyst", value: "Analyst", cl: 11 },
  { label: "CL10 Senior Analyst", value: "Senior Analyst", cl: 10 },
  { label: "CL9 Consultant", value: "Consultant", cl: 9 },
  { label: "CL8 Associate Manager", value: "Associate Manager", cl: 8 },
  { label: "CL7 Manager", value: "Manager", cl: 7 },
];

const STEPS = ["About You", "Your Skills", "Upload CV", "Your Preferences", "Review"];

function CategorisedSkills({ selected, onChange, search = "" }) {
  const [openCats, setOpenCats] = React.useState(["AI / ML"]);
  const toggle = (cat) => setOpenCats(prev =>
    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
  );
  const toggleSkill = (s) => onChange(
    selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]
  );
  return (
    <div className="skill-categories">
      {Object.entries(SKILL_CATEGORIES).map(([cat, skills]) => {
        const filtered = search ? skills.filter(s => s.toLowerCase().includes(search.toLowerCase())) : skills;
        if (filtered.length === 0) return null;
        const selectedInCat = filtered.filter(s => selected.includes(s)).length;
        const isOpen = openCats.includes(cat) || search.length > 0;
        return (
          <div key={cat} className="skill-category">
            <button className="skill-cat-header" onClick={() => toggle(cat)}>
              <span>{cat}</span>
              <span className="skill-cat-meta">
                {selectedInCat > 0 && <span className="skill-cat-badge">{selectedInCat}</span>}
                <span className="skill-cat-arrow">{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen && (
              <div className="skill-cat-grid">
                {filtered.map(s => (
                  <button key={s}
                    className={`skill-toggle ${selected.includes(s) ? "active" : ""}`}
                    onClick={() => toggleSkill(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingWizard({ onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    cl: 9,
    cl_title: "Consultant",
    available_from: "2026-09-01",
    skills: [],
    preferred_industries: [],
    wfh_preference: "hybrid",
    work_style: "structured",
    preferred_duration: "3-6 months",
    career_goal: "technical_depth",
    cvText: "",
    cvFileName: "",
    cvFileBase64: "",
  });
  const fileRef = useRef();
  const [skillSearch, setSkillSearch] = useState("");

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const toggleIndustry = (ind) => {
    setForm(f => ({
      ...f,
      preferred_industries: f.preferred_industries.includes(ind)
        ? f.preferred_industries.filter(i => i !== ind)
        : [...f.preferred_industries, ind],
    }));
  };

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.skills.length > 0;
    if (step === 2) return true; // CV upload is optional (can skip)
    if (step === 3) return form.preferred_industries.length > 0;
    return true;
  };

  const handleComplete = async () => {
    const uniqueId = "CUSTOM_" + Date.now();
    const profile = {
      ...form,
      id: uniqueId,
      isCustom: true,
    };
    // Register with backend so they participate in matching
    try {
      await axios.post(`${API}/consultants/register`, profile);
    } catch (e) {
      console.error("Failed to register profile", e);
    }
    onComplete(profile);
  };

  const filteredSkills = ALL_SKILLS.filter(s =>
    s.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="login-screen">
      <div className="wizard-card">
        {/* Header */}
        <div className="wizard-header">
          <button className="back-btn" onClick={step === 0 ? onBack : () => setStep(s => s - 1)}>
            ← Back
          </button>
          <div className="wizard-steps">
            {STEPS.map((s, i) => (
              <div key={s} className={`wizard-step ${i === step ? "active" : i < step ? "done" : ""}`}>
                <div className="step-dot">{i < step ? "✓" : i + 1}</div>
                <span className="step-label">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="wizard-progress-bg">
          <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Step content */}
        <div className="wizard-body">

          {/* Step 0: About You */}
          {step === 0 && (
            <div className="wizard-step-content">
              <h2>Tell us about yourself</h2>
              <p className="step-hint">This helps us find projects that match your level and availability.</p>

              <div className="form-field">
                <label>Your name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Tan"
                  value={form.name}
                  onChange={e => update("name", e.target.value)}
                />
              </div>


              <div className="form-field">
                <label>Career level</label>
                <select
                  value={form.cl_title}
                  onChange={e => {
                    const lvl = LEVELS.find(l => l.value === e.target.value);
                    if (lvl) { update("cl_title", lvl.value); update("cl", lvl.cl); }
                  }}
                  style={{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",
                    borderRadius:"8px",fontSize:"14px",background:"white",color:"#1e293b"}}>
                  {LEVELS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Available from</label>
                <input
                  type="date"
                  value={form.available_from}
                  onChange={e => update("available_from", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 1: Skills */}
          {step === 1 && (
            <div className="wizard-step-content">
              <h2>Select your skills</h2>
              <p className="step-hint">Pick all that apply. Selected: <strong>{form.skills.length}</strong></p>
              <input className="skill-search" placeholder="Search skills..."
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                style={{width:"100%",marginBottom:"10px",padding:"8px 10px",
                  border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"13px"}} />
              <CategorisedSkills
                selected={form.skills}
                onChange={skills => update("skills", skills)}
                search={skillSearch}
              />
            </div>
          )}


          {/* Step 2: CV Upload */}
          {step === 2 && (
            <div className="wizard-step-content">
              <h2>Upload your CV</h2>
              <p className="step-hint">
                We'll use this to auto-tailor your CV when you apply to specific roles.
                You can skip this and upload later from your profile page.
              </p>

              <div className="cv-upload-zone" onClick={() => fileRef.current.click()}>
                <span className="upload-icon">📄</span>
                <span>{form.cvFileName || "Click to upload CV"}</span>
                <span className="upload-sub">Supported: PDF, TXT, PPTX, DOCX</span>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.pptx,.docx,.doc"
                  style={{display:"none"}}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    update("cvFileName", file.name);
                    const name = file.name.toLowerCase();
                    if (name.endsWith(".txt")) {
                      const text = await file.text();
                      update("cvText", text);
                    } else {
                      // PDF/PPTX/DOCX — store as base64 for AI processing on apply
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result.split(",")[1];
                        update("cvText", "");
                        update("cvFileBase64", base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              {form.cvFileName && (
                <div className="cv-preview-notice">
                  ✅ {form.cvFileName} uploaded
                </div>
              )}

              <div className="cv-divider"><span>or paste your experience section</span></div>

              <textarea
                className="cv-textarea"
                placeholder="Paste your CV experience section here..."
                value={form.cvText.startsWith("[PDF") ? "" : form.cvText}
                onChange={e => { update("cvText", e.target.value); update("cvFileName", ""); }}
                rows={8}
              />

              <p className="skip-note" style={{marginTop:"12px"}}>
                💡 You can also skip this step and upload from your profile page later.
              </p>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="wizard-step-content">
              <h2>Your work preferences</h2>
              <p className="step-hint">This is what makes ConsultMatch different — your preferences matter.</p>

              <div className="form-field">
                <label>Preferred industries <span className="field-note">(select all that interest you)</span></label>
                <div className="option-chips">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind}
                      className={`option-chip ${form.preferred_industries.includes(ind) ? "active" : ""}`}
                      onClick={() => toggleIndustry(ind)}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Work location preference</label>
                <div className="option-cards">
                  {["remote", "hybrid", "onsite"].map(w => (
                    <button
                      key={w}
                      className={`option-card ${form.wfh_preference === w ? "active" : ""}`}
                      onClick={() => update("wfh_preference", w)}
                    >
                      {w === "remote" ? "🏠 Remote" : w === "hybrid" ? "🔄 Hybrid" : "🏢 Onsite"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Work style</label>
                <div className="option-cards">
                  <button
                    className={`option-card ${form.work_style === "structured" ? "active" : ""}`}
                    onClick={() => update("work_style", "structured")}
                  >
                    📋 Structured<span className="option-sub">Clear processes, defined scope</span>
                  </button>
                  <button
                    className={`option-card ${form.work_style === "flexible" ? "active" : ""}`}
                    onClick={() => update("work_style", "flexible")}
                  >
                    🔀 Flexible<span className="option-sub">Agile, fast-changing environment</span>
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Preferred project duration</label>
                <div className="option-cards">
                  {["1-3 months", "3-6 months", ">6 months"].map(d => (
                    <button
                      key={d}
                      className={`option-card ${form.preferred_duration === d ? "active" : ""}`}
                      onClick={() => update("preferred_duration", d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Career goal for this project</label>
                <div className="option-cards">
                  <button
                    className={`option-card ${form.career_goal === "technical_depth" ? "active" : ""}`}
                    onClick={() => update("career_goal", "technical_depth")}
                  >
                    🔬 Technical depth<span className="option-sub">Deepen expertise in a domain</span>
                  </button>
                  <button
                    className={`option-card ${form.career_goal === "client_exposure" ? "active" : ""}`}
                    onClick={() => update("career_goal", "client_exposure")}
                  >
                    🤝 Client exposure<span className="option-sub">Build client-facing experience</span>
                  </button>
                  <button
                    className={`option-card ${form.career_goal === "leadership" ? "active" : ""}`}
                    onClick={() => update("career_goal", "leadership")}
                  >
                    🌟 Leadership<span className="option-sub">Lead teams and decisions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="wizard-step-content">
              <h2>Review your profile</h2>
              <p className="step-hint">Here's what we'll use to match you with projects.</p>

              <div className="review-card">
                <div className="review-name">{form.name}</div>
                <div className="review-level">CL{form.cl} {form.cl_title}</div>

                <div className="review-section">
                  <span className="review-label">Skills ({form.skills.length})</span>
                  <div className="skills-row">
                    {form.skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                  </div>
                </div>

                {form.cvFileName && (
                  <div className="review-section">
                    <span className="review-label">CV</span>
                    <span className="skill-chip">📄 {form.cvFileName}</span>
                  </div>
                )}
                {form.cvText && !form.cvFileName && (
                  <div className="review-section">
                    <span className="review-label">CV</span>
                    <span className="skill-chip">📝 Pasted text ({form.cvText.length} chars)</span>
                  </div>
                )}
                <div className="review-section">
                  <span className="review-label">Preferred industries</span>
                  <div className="skills-row">
                    {form.preferred_industries.map(i => <span key={i} className="skill-chip">{i}</span>)}
                  </div>
                </div>

                <div className="review-grid">
                  <div className="review-item">
                    <span>WFH</span><strong>{form.wfh_preference}</strong>
                  </div>
                  <div className="review-item">
                    <span>Style</span><strong>{form.work_style}</strong>
                  </div>
                  <div className="review-item">
                    <span>Duration</span><strong>{form.preferred_duration}</strong>
                  </div>
                  <div className="review-item">
                    <span>Goal</span><strong>{form.career_goal.replace("_", " ")}</strong>
                  </div>
                  <div className="review-item">
                    <span>Available</span><strong>{form.available_from}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="wizard-footer">
          {step < STEPS.length - 1 ? (
            <button
              className="wizard-next-btn"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
            >
              Continue →
            </button>
          ) : (
            <button className="wizard-next-btn complete" onClick={handleComplete}>
              🎯 Find My Matches →
            </button>
          )}
          {step < STEPS.length - 1 && (
            <p className="skip-note">
              Step {step + 1} of {STEPS.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
