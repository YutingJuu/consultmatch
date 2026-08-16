import React, { useState, useRef } from "react";
import { getDistrictFromPostal } from "../utils/locationUtils";

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

export default function ProfilePage({ profile, onUpdate, onClose }) {
  const [form, setForm] = useState({ ...profile });
  const [activeSection, setActiveSection] = useState("personal");
  const [saved, setSaved] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const fileRef = useRef();

  const update = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
    setSaved(false);
  };

  const toggleIndustry = (ind) => {
    setForm(f => ({
      ...f,
      preferred_industries: f.preferred_industries.includes(ind)
        ? f.preferred_industries.filter(i => i !== ind)
        : [...f.preferred_industries, ind],
    }));
    setSaved(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    update("cvFileName", file.name);
    if (file.type === "text/plain") {
      const text = await file.text();
      update("cvText", text);
    } else {
      update("cvText", `[PDF uploaded: ${file.name}]`);
    }
  };

  const handleSave = () => {
    onUpdate(form);
    setSaved(true);
  };

  const filteredSkills = ALL_SKILLS.filter(s =>
    s.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const sections = [
    { id: "personal", label: "👤 Personal" },
    { id: "skills", label: "🔧 Skills" },
    { id: "preferences", label: "⚙️ Preferences" },
    { id: "cv", label: "📄 My CV" },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card profile-modal">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>My Profile</h3>
            <p>{form.name} · {form.level}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Section tabs */}
        <div className="profile-section-tabs">
          {sections.map(s => (
            <button
              key={s.id}
              className={`profile-section-tab ${activeSection === s.id ? "active" : ""}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Personal */}
          {activeSection === "personal" && (
            <div>
              <div className="form-field">
                <label>Name</label>
                <input type="text" value={form.name}
                  onChange={e => update("name", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Career Level</label>
                <div className="option-cards">
                  {[
                    { label: "CL11 Analyst", value: "Analyst", cl: 11 },
                    { label: "CL10 Senior Analyst", value: "Senior Analyst", cl: 10 },
                    { label: "CL9 Consultant", value: "Consultant", cl: 9 },
                    { label: "CL8 Associate Manager", value: "Associate Manager", cl: 8 },
                    { label: "CL7 Manager", value: "Manager", cl: 7 },
                  ].map(l => (
                    <button key={l.value}
                      className={`option-card ${form.cl_title === l.value ? "active" : ""}`}
                      onClick={() => { update("cl_title", l.value); update("cl", l.cl); }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>Available From</label>
                <input type="date" value={form.available_from}
                  onChange={e => update("available_from", e.target.value)} />
              </div>

              <div className="form-field">
                <label>Home Postal Code
                  <span className="field-note"> — used to estimate commute</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 078881"
                  maxLength={6}
                  value={form.postalCode || ""}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    update("postalCode", val);
                    if (val.length >= 2) {
                      const info = getDistrictFromPostal(val);
                      if (info) {
                        update("homeDistrict", info.district);
                        update("homeZone", info.zone);
                      }
                    }
                  }}
                />
                {form.homeDistrict && (
                  <div className="postal-result">
                    📍 <strong>{form.homeDistrict}</strong>
                    <span className="zone-badge">{form.homeZone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skills */}
          {activeSection === "skills" && (
            <div>
              <p className="step-hint">
                Selected: <strong>{form.skills.length} skills</strong>
              </p>
              <input className="skill-search" placeholder="Search skills..."
                value={skillSearch} onChange={e => setSkillSearch(e.target.value)} />
              {form.skills.length > 0 && (
                <div className="selected-skills">
                  {form.skills.map(s => (
                    <span key={s} className="skill-chip selected"
                      onClick={() => toggleSkill(s)}>{s} ✕</span>
                  ))}
                </div>
              )}
              <div className="skill-grid">
                {filteredSkills.map(s => (
                  <button key={s}
                    className={`skill-toggle ${form.skills.includes(s) ? "active" : ""}`}
                    onClick={() => toggleSkill(s)}>
                    {form.skills.includes(s) ? "✓ " : ""}{s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeSection === "preferences" && (
            <div>
              <div className="form-field">
                <label>Preferred Industries</label>
                <div className="option-chips">
                  {INDUSTRIES.map(ind => (
                    <button key={ind}
                      className={`option-chip ${form.preferred_industries?.includes(ind) ? "active" : ""}`}
                      onClick={() => toggleIndustry(ind)}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>Work Location</label>
                <div className="option-cards">
                  {["remote", "hybrid", "onsite"].map(w => (
                    <button key={w}
                      className={`option-card ${form.wfh_preference === w ? "active" : ""}`}
                      onClick={() => update("wfh_preference", w)}>
                      {w === "remote" ? "🏠 Remote" : w === "hybrid" ? "🔄 Hybrid" : "🏢 Onsite"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>Work Style</label>
                <div className="option-cards">
                  {["structured", "flexible"].map(w => (
                    <button key={w}
                      className={`option-card ${form.work_style === w ? "active" : ""}`}
                      onClick={() => update("work_style", w)}>
                      {w === "structured" ? "📋 Structured" : "🔀 Flexible"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>Preferred Duration</label>
                <div className="option-cards">
                  {["1-3 months", "3-6 months", ">6 months"].map(d => (
                    <button key={d}
                      className={`option-card ${form.preferred_duration === d ? "active" : ""}`}
                      onClick={() => update("preferred_duration", d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>Career Goal</label>
                <div className="option-cards">
                  {[
                    { value: "technical_depth", label: "🔬 Technical Depth" },
                    { value: "client_exposure", label: "🤝 Client Exposure" },
                    { value: "leadership", label: "🌟 Leadership" },
                  ].map(g => (
                    <button key={g.value}
                      className={`option-card ${form.career_goal === g.value ? "active" : ""}`}
                      onClick={() => update("career_goal", g.value)}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CV */}
          {activeSection === "cv" && (
            <div>
              <p className="step-hint">
                Your CV is used to auto-tailor applications when you apply to specific roles.
                Upload a new version or edit the text directly.
              </p>

              {form.cvFileName && (
                <div className="cv-current">
                  <span className="cv-current-icon">📄</span>
                  <div>
                    <strong>{form.cvFileName}</strong>
                    <span>Current CV on file</span>
                  </div>
                  <button className="cv-replace-btn" onClick={() => fileRef.current.click()}>
                    Replace
                  </button>
                </div>
              )}

              <div className="cv-upload-zone" onClick={() => fileRef.current.click()}>
                <span className="upload-icon">📤</span>
                <span>{form.cvFileName ? "Upload a new version" : "Upload CV"}</span>
                <span className="upload-sub">Click to browse files</span>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.pptx,.docx,.doc"
                  style={{ display: "none" }} onChange={handleFileUpload} />
              </div>

              <div className="cv-divider"><span>or edit experience text directly</span></div>

              <textarea
                className="cv-textarea"
                placeholder="Paste or edit your experience section here..."
                value={form.cvText?.startsWith("[PDF") ? "" : (form.cvText || "")}
                onChange={e => { update("cvText", e.target.value); update("cvFileName", ""); }}
                rows={12}
              />

              {form.cvText && (
                <div className="cv-preview-notice">
                  ✅ CV content ready · {form.cvText.length} characters
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {saved
            ? <span className="save-success">✅ Changes saved</span>
            : <button className="modal-btn primary" onClick={handleSave}>
                Save Changes
              </button>
          }
        </div>
      </div>
    </div>
  );
}
