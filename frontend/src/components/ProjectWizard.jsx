import React, { useState } from "react";

const INDUSTRIES = [
  "Banking", "Insurance", "Technology", "Healthcare",
  "Government", "Retail", "Logistics", "Telecommunications",
  "Manufacturing", "Private Equity",
];

const DISTRICTS = [
  "Raffles Place / Cecil", "Shenton Way / Tanjong Pagar", "Marina Bay",
  "City Hall / Clarke Quay", "Orchard / River Valley", "Novena / Thomson",
  "One-North / Buona Vista", "Jurong / Clementi", "Jurong / Bukit Batok",
  "Tampines / Pasir Ris", "Paya Lebar / Macpherson", "Serangoon / Hougang",
  "Woodlands / Kranji", "Yishun / Sembawang", "Bishan / Ang Mo Kio",
];

// CL7 = most senior (Manager), CL11 = most junior (Analyst)
const COMMON_SKILLS = [
  "Python", "Machine Learning", "SQL", "Data Visualisation", "Statistics",
  "Business Analysis", "Agile", "Stakeholder Management", "Project Management",
  "AWS", "Cloud Architecture", "DevOps", "Kubernetes", "NLP", "Deep Learning",
  "UX Design", "Figma", "Cybersecurity", "Risk Management", "Compliance",
  "SAP", "ERP", "Salesforce", "CRM", "Supply Chain", "Strategy",
  "Change Management", "Power BI", "Tableau", "Data Governance", "Financial Modelling",
];

const CL_OPTIONS = [
  { label: "CL7 Manager", cl: 7 },
  { label: "CL8 Associate Manager", cl: 8 },
  { label: "CL9 Consultant", cl: 9 },
  { label: "CL10 Senior Analyst", cl: 10 },
  { label: "CL11 Analyst", cl: 11 },
];

const STEPS = ["Project Basics", "Team Composition", "Review"];

export default function ProjectWizard({ onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    client: "",
    industry: "",
    duration: "3-6 months",
    wfh_policy: "hybrid",
    district: "Raffles Place / Cecil",
    description: "",
    manager_name: "",
  });
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({
    role: "", cl_selected: [9, 10], description: "", required_skills: []
  });
  const [skillSearch, setSkillSearch] = useState("");

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSlot = () => {
    if (!newSlot.role.trim() || newSlot.cl_selected.length === 0) return;
    const sorted = [...newSlot.cl_selected].sort((a, b) => a - b);
    const cl_min = sorted[0];
    const cl_max = sorted[sorted.length - 1];
    const clLabels = CL_OPTIONS
      .filter(o => newSlot.cl_selected.includes(o.cl))
      .map(o => o.label);
    const cl_label = clLabels.length === 1
      ? clLabels[0]
      : `CL${cl_min}–CL${cl_max} (${clLabels.map(l => l.replace(/CL\d+ /, "")).join(" / ")})`;
    const id = `CUSTOM-${Date.now()}-${slots.length}`;
    setSlots(prev => [...prev, {
      slot_id: id,
      role: newSlot.role.trim(),
      cl_range: [cl_min, cl_max],
      cl_label,
      required_skills: [],
      description: newSlot.description.trim() || `${newSlot.role} role for this project.`,
    }]);
    setNewSlot({ role: "", cl_selected: [9, 10], description: "", required_skills: [] });
    setSkillSearch("");
  };

  const removeSlot = (id) => setSlots(prev => prev.filter(s => s.slot_id !== id));

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.client.trim() && form.industry && form.manager_name.trim();
    if (step === 1) return slots.length > 0;
    return true;
  };

  const handleComplete = () => {
    const project = {
      id: `PROJ-${Date.now()}`,
      name: form.name.trim(),
      client: form.client.trim(),
      industry: form.industry,
      duration: form.duration,
      wfh_policy: form.wfh_policy,
      district: form.district,
      zone: "CBD",
      description: form.description.trim() || `${form.name} for ${form.client}.`,
      manager_id: `MGR-${Date.now()}`,
      manager_name: form.manager_name.trim(),
      preferred_work_style: "structured",
      required_skills: [...new Set(slots.flatMap(s => s.required_skills))],
      team_slots: slots,
      isCustom: true,
    };
    onComplete(project);
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="login-screen">
      <div className="wizard-card">
        {/* Header */}
        <div className="wizard-header">
          <button className="back-btn"
            onClick={step === 0 ? onBack : () => setStep(s => s - 1)}>
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

        <div className="wizard-progress-bg">
          <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="wizard-body">

          {/* Step 0: Project Basics */}
          {step === 0 && (
            <div className="wizard-step-content">
              <h2>Project Details</h2>
              <p className="step-hint">Tell us about the project you need to staff.</p>

              <div className="form-field">
                <label>Your name (Project Manager)</label>
                <input type="text" placeholder="e.g. Sophie Rao"
                  value={form.manager_name}
                  onChange={e => update("manager_name", e.target.value)} />
              </div>

              <div className="form-field">
                <label>Project name</label>
                <input type="text" placeholder="e.g. AI Credit Scoring Modernisation"
                  value={form.name}
                  onChange={e => update("name", e.target.value)} />
              </div>

              <div className="form-field">
                <label>Client</label>
                <input type="text" placeholder="e.g. DBS Bank"
                  value={form.client}
                  onChange={e => update("client", e.target.value)} />
              </div>

              <div className="form-field">
                <label>Industry</label>
                <div className="option-chips">
                  {INDUSTRIES.map(ind => (
                    <button key={ind}
                      className={`option-chip ${form.industry === ind ? "active" : ""}`}
                      onClick={() => update("industry", ind)}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Project duration</label>
                <div className="option-cards">
                  {["1-3 months", "3-6 months", ">6 months"].map(d => (
                    <button key={d}
                      className={`option-card ${form.duration === d ? "active" : ""}`}
                      onClick={() => update("duration", d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Work arrangement</label>
                <div className="option-cards">
                  {["remote", "hybrid", "onsite"].map(w => (
                    <button key={w}
                      className={`option-card ${form.wfh_policy === w ? "active" : ""}`}
                      onClick={() => update("wfh_policy", w)}>
                      {w === "remote" ? "🏠 Remote" : w === "hybrid" ? "🔄 Hybrid" : "🏢 Onsite"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Office location</label>
                <select value={form.district}
                  onChange={e => update("district", e.target.value)}
                  style={{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",
                    borderRadius:"8px",fontSize:"14px"}}>
                  {DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Project description <span className="field-note">(optional)</span></label>
                <textarea className="cv-textarea"
                  placeholder="Brief description of the project objectives and scope..."
                  value={form.description}
                  onChange={e => update("description", e.target.value)}
                  rows={3} />
              </div>
            </div>
          )}

          {/* Step 1: Team Composition */}
          {step === 1 && (
            <div className="wizard-step-content">
              <h2>Team Composition</h2>
              <p className="step-hint">
                Define the roles you need to fill. Add one role at a time.
              </p>

              {/* Existing slots */}
              {slots.length > 0 && (
                <div className="slots-added">
                  {slots.map((s, i) => (
                    <div key={s.slot_id} className="slot-added-item">
                      <div>
                        <strong>{s.role}</strong>
                        <span className="slot-cl-badge" style={{marginLeft:"8px"}}>
                          {s.cl_label}
                        </span>
                        {s.required_skills?.length > 0 && (
                          <span style={{fontSize:"11px",color:"#64748b",marginLeft:"8px"}}>
                            · {s.required_skills.join(", ")}
                          </span>
                        )}
                      </div>
                      <button className="remove-btn" onClick={() => removeSlot(s.slot_id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new slot */}
              <div className="add-slot-form">
                <p className="add-slot-title">+ Add a role</p>

                <div className="form-field">
                  <label>Role title</label>
                  <input type="text"
                    placeholder="e.g. Data Scientist, Business Analyst, DevOps Engineer"
                    value={newSlot.role}
                    onChange={e => setNewSlot(s => ({ ...s, role: e.target.value }))} />
                </div>

                <div className="form-field">
                  <label>Acceptable career levels</label>
                  <div className="cl-bubble-row">
                    {CL_OPTIONS.map(o => (
                      <button key={o.cl}
                        className={`cl-bubble ${newSlot.cl_selected.includes(o.cl) ? "active" : ""}`}
                        onClick={() => setNewSlot(s => ({
                          ...s,
                          cl_selected: s.cl_selected.includes(o.cl)
                            ? s.cl_selected.filter(c => c !== o.cl)
                            : [...s.cl_selected, o.cl]
                        }))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {newSlot.cl_selected.length === 0 && (
                    <p style={{fontSize:"12px",color:"#ef4444",marginTop:"6px"}}>
                      Please select at least one career level.
                    </p>
                  )}
                </div>

                <div className="form-field">
                  <label>Required skills <span className="field-note">(select all that apply)</span></label>
                  <input className="skill-search" placeholder="Search skills..."
                    value={skillSearch}
                    onChange={e => setSkillSearch(e.target.value)}
                    style={{marginBottom:"8px"}} />
                  {newSlot.required_skills.length > 0 && (
                    <div className="selected-skills" style={{marginBottom:"8px"}}>
                      {newSlot.required_skills.map(s => (
                        <span key={s} className="skill-chip selected"
                          onClick={() => setNewSlot(n => ({
                            ...n, required_skills: n.required_skills.filter(x => x !== s)
                          }))}>
                          {s} ✕
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="skill-grid">
                    {COMMON_SKILLS
                      .filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()))
                      .map(s => (
                        <button key={s}
                          className={`skill-toggle ${newSlot.required_skills.includes(s) ? "active" : ""}`}
                          onClick={() => setNewSlot(n => ({
                            ...n,
                            required_skills: n.required_skills.includes(s)
                              ? n.required_skills.filter(x => x !== s)
                              : [...n.required_skills, s]
                          }))}>
                          {newSlot.required_skills.includes(s) ? "✓ " : ""}{s}
                        </button>
                      ))
                    }
                  </div>
                </div>

                <div className="form-field">
                  <label>Role description <span className="field-note">(optional)</span></label>
                  <textarea className="cv-textarea"
                    placeholder="What will this person do on the project?"
                    value={newSlot.description}
                    onChange={e => setNewSlot(s => ({ ...s, description: e.target.value }))}
                    rows={2} />
                </div>

                <button className="add-slot-btn" onClick={addSlot}
                  disabled={!newSlot.role.trim() || newSlot.cl_selected.length === 0}>
                  + Add this role
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="wizard-step-content">
              <h2>Review Your Project</h2>
              <p className="step-hint">Here's what we'll use to match consultants to your project.</p>

              <div className="review-card">
                <div className="review-name">{form.name}</div>
                <div className="review-level">{form.client} · {form.industry}</div>

                <div className="review-grid" style={{marginTop:"14px"}}>
                  <div className="review-item">
                    <span>Manager</span><strong>{form.manager_name}</strong>
                  </div>
                  <div className="review-item">
                    <span>Duration</span><strong>{form.duration}</strong>
                  </div>
                  <div className="review-item">
                    <span>WFH</span><strong>{form.wfh_policy}</strong>
                  </div>
                  <div className="review-item">
                    <span>Location</span><strong>{form.district}</strong>
                  </div>
                </div>

                <div className="review-section" style={{marginTop:"16px"}}>
                  <span className="review-label">Team Slots ({slots.length} roles open)</span>
                  <div className="slots-added">
                    {slots.map(s => (
                      <div key={s.slot_id} className="slot-added-item">
                        <div>
                          <strong>{s.role}</strong>
                          <span className="slot-cl-badge" style={{marginLeft:"8px"}}>
                            {s.cl_label}
                          </span>
                          {s.required_skills?.length > 0 && (
                            <span style={{fontSize:"11px",color:"#64748b",marginLeft:"8px"}}>
                              · {s.required_skills.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          {step < STEPS.length - 1 ? (
            <button className="wizard-next-btn"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}>
              Continue →
            </button>
          ) : (
            <button className="wizard-next-btn complete" onClick={handleComplete}>
              🎯 Find Candidates →
            </button>
          )}
          <p className="skip-note">Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>
    </div>
  );
}
