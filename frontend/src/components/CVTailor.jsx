import React, { useState, useRef } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const DEFAULT_CV_TEXT = `EXPERIENCE

Singapore Central Bank - DevOps Engineer (Oct 2024 – Apr 2026)
• Onboarded 10+ applications onto CI/CD pipelines (Jenkins/CloudBees, with ongoing migration to GitLab), resolving build issues and deployment blockers, and successfully promoting pilot applications into production environments.
• Supported containerised application deployments in RHEL-based environments and contributed to migration efforts towards OCP for standardised orchestration.
• Led planning and design discussions for GCC data landing zone migration, and conducted pilot testing in AWS using Apache Airflow, S3, EC2 and other services.
• Addressed security and code quality findings from tools such as SonarQube and Nexus IQ, remediating vulnerabilities to meet MAS security and compliance standards.
• Managed and coordinated weekly deployment activities across a 15+ member team, ensuring efficient release cycles with minimal downtime.

Government Technology Agency - SRE / Data Analyst (Jun 2021 – Sep 2024)
• Designed and implemented a centralised ETL process and cost and usage reporting portal on AWS, aggregating billing data across multiple AWS accounts, enabling stakeholders to perform data-driven cost analysis and optimisation.
• Built a self-service platform for alert and maintenance window management used across multiple application teams, aligned with defined SLA/SLO targets, improving service reliability and reducing manual operational overhead.
• Developed and maintained observability dashboards using Grafana and Prometheus, and leveraged Datadog for API endpoint monitoring, enabling real-time visibility into system health.

Maritime Sector – Internship & Publication
• Published a paper on shipping CO2 emissions using Python and Spark.
• Applied ML techniques for consulting projects, built a classification model to identify risky vessels, and a live Power BI dashboard for vessel carbon emission monitoring.

MSc Business Analytics, NUS – AI & Analytics Projects
• Developed an AI-powered wedding design application using LLM-driven prompt generation and image generation models.
• Built an agentic AI pet health assistant using multi-step reasoning, dual RAG, and LLM-based decision support.`;

export default function CVTailor({ role, consultantProfile, consultantId, onClose, onApplied }) {
  const hasProfileCV = !!(
    (consultantProfile?.cvText && !consultantProfile.cvText.startsWith("[PDF")) ||
    consultantProfile?.cvFileBase64 ||
    consultantProfile?.cvFileName
  );

  // If profile has CV, skip upload step — go straight to tailoring
  const [step, setStep] = useState(hasProfileCV ? "confirm" : "upload");
  const [cvText, setCvText] = useState(
    consultantProfile?.cvText && !consultantProfile.cvText.startsWith("[PDF")
      ? consultantProfile.cvText : ""
  );
  const [fileData, setFileData] = useState(
    consultantProfile?.cvFileBase64
      ? { base64: consultantProfile.cvFileBase64, name: consultantProfile.cvFileName || "cv.pdf" }
      : null
  );
  const [tailoredText, setTailoredText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tailorMode, setTailorMode] = useState(null);
  const fileRef = useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt")) {
      const text = await file.text();
      setCvText(text); setFileData(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setFileData({ base64: reader.result.split(",")[1], name: file.name });
        setCvText("");
      };
      reader.readAsDataURL(file);
    }
  };

  const tailorCV = async () => {
    setLoading(true); setError("");
    try {
      const payload = fileData
        ? { role_id: role.role_id, file_base64: fileData.base64, file_name: fileData.name }
        : { role_id: role.role_id, cv_text: cvText };
      const response = await axios.post(`${API}/tailor`, payload);
      setTailoredText(response.data.tailored_text);
      setTailorMode(response.data.mode);
      setStep("review");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to tailor CV. Please try again.");
      setStep(hasProfileCV ? "confirm" : "upload");
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    try {
      await axios.post(`${API}/applications`, {
        consultant_id: consultantId,
        role_id: role.role_id,
        cv_text: tailoredText,
      });
      if (onApplied) onApplied(role.role_id, tailoredText);
    } catch (e) { /* already applied */ }
    setStep("submitted");
  };

  const STEPS_WITH_CV = ["Confirm CV", "AI Tailoring", "Review & Submit"];
  const STEPS_NO_CV   = ["Upload CV",  "AI Tailoring", "Review & Submit"];
  const STEPS = hasProfileCV ? STEPS_WITH_CV : STEPS_NO_CV;

  const stepIndex = {
    confirm: 0, upload: 0, tailoring: 1, review: 2, submitted: 2,
  }[step] ?? 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>Apply — {role.role_title}</h3>
            <p>{role.project_name} · {role.client} · {role.cl_label}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Steps */}
        <div className="modal-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`modal-step ${i === stepIndex ? "active" : i < stepIndex ? "done" : ""}`}>
              <span className="modal-step-dot">{i < stepIndex ? "✓" : i+1}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className="modal-body">

          {/* Confirm CV from profile */}
          {step === "confirm" && (
            <div>
              <div className="cv-from-profile-notice">
                <span className="cv-profile-icon">✅</span>
                <div>
                  <strong>CV loaded from your profile</strong>
                  <p>
                    {fileData
                      ? `📎 ${fileData.name}`
                      : `📝 Text CV (${cvText.length} characters)`}
                  </p>
                </div>
              </div>

              <p className="modal-hint">
                Claude will tailor your CV for the <strong>{role.role_title}</strong> role at <strong>{role.client}</strong>, highlighting your most relevant experience for:
              </p>
              <div className="skills-row" style={{marginBottom:"12px"}}>
                {role.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
              </div>

              <div className="cv-divider"><span>not the right CV?</span></div>
              <div className="cv-upload-zone" onClick={() => fileRef.current.click()}>
                <span className="upload-icon">📤</span>
                <span>Upload a different CV</span>
                <span className="upload-sub">PDF, PPTX, DOCX, TXT</span>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.pptx,.docx,.doc"
                  style={{display:"none"}} onChange={handleFileUpload} />
              </div>
              {fileData && fileData.name !== consultantProfile?.cvFileName && (
                <div className="cv-preview-notice">📎 Using: {fileData.name}</div>
              )}
              {error && <p className="cv-error">{error}</p>}
            </div>
          )}

          {/* Upload step (no profile CV) */}
          {step === "upload" && (
            <div>
              <p className="modal-hint">
                Upload your CV — Claude will extract your experience and tailor it for <strong>{role.role_title}</strong> at <strong>{role.client}</strong>.
              </p>
              <div className="cv-upload-zone" onClick={() => fileRef.current.click()}>
                <span className="upload-icon">{fileData ? "📎" : "📄"}</span>
                <span>{fileData ? fileData.name : "Click to upload CV"}</span>
                <span className="upload-sub">PDF, PPTX, DOCX — AI extracts · TXT — reads directly</span>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.pptx,.docx,.doc"
                  style={{display:"none"}} onChange={handleFileUpload} />
              </div>
              {fileData && (
                <div className="cv-preview-notice">
                  📎 {fileData.name} ready — AI will extract and tailor your experience
                </div>
              )}
              <div className="cv-divider"><span>or paste your experience section</span></div>
              <textarea className="cv-textarea"
                placeholder="Paste your CV experience section here..."
                value={cvText} onChange={e => { setCvText(e.target.value); setFileData(null); }}
                rows={8} />
              {error && <p className="cv-error">{error}</p>}
            </div>
          )}

          {/* Tailoring spinner */}
          {step === "tailoring" && (
            <div className="tailoring-screen">
              <div className="tailoring-icon">🤖</div>
              <h4>Tailoring your CV...</h4>
              <p>Claude is rewriting your experience to highlight relevance for:</p>
              <div className="tailoring-role">
                <strong>{role.role_title} — {role.project_name}</strong>
                <span>Required: {role.required_skills.join(", ")}</span>
              </div>
              <div className="tailoring-spinner" />
            </div>
          )}

          {/* Review */}
          {step === "review" && (
            <div>
              <div className="review-banner">
                <span>{tailorMode === "ai" ? "🤖" : "⚙️"}</span>
                <div>
                  <strong>CV tailored for {role.role_title}</strong>
                  <p>Review and edit the tailored experience section below before submitting.</p>
                </div>
                <span className="tailor-mode-badge">{tailorMode === "ai" ? "AI ✨" : "Rule-based ⚙️"}</span>
              </div>
              <div className="diff-header">
                <span>Tailored Experience Section</span>
                <span className="diff-hint">Click anywhere to edit</span>
              </div>
              <textarea className="cv-textarea review" value={tailoredText}
                onChange={e => setTailoredText(e.target.value)} rows={14} />
              <div className="role-requirements">
                <p className="req-title">Matched against:</p>
                <div className="skills-row">
                  {role.required_skills.map(s => <span key={s} className="skill-chip">{s}</span>)}
                </div>
              </div>
            </div>
          )}

          {/* Submitted */}
          {step === "submitted" && (
            <div className="submitted-screen">
              <div className="submitted-icon">✅</div>
              <h4>Application Submitted!</h4>
              <p>Your tailored CV has been submitted for <strong>{role.role_title}</strong>.</p>
              <div className="submitted-details">
                <div className="submitted-row"><span>Role</span><strong>{role.role_title}</strong></div>
                <div className="submitted-row"><span>Project</span><strong>{role.project_name}</strong></div>
                <div className="submitted-row"><span>Client</span><strong>{role.client}</strong></div>
                <div className="submitted-row"><span>Level</span><strong>{role.cl_label}</strong></div>
                <div className="submitted-row">
                  <span>Status</span>
                  <strong className="status-pending">⏳ Under Review</strong>
                </div>
              </div>
              <p className="submitted-note">
                You will be notified if the project team expresses interest in your profile.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {(step === "confirm" || step === "upload") && (
            <button className="modal-btn primary"
              onClick={() => { setStep("tailoring"); tailorCV(); }}
              disabled={!cvText && !fileData}>
              ✨ Tailor with AI →
            </button>
          )}
          {step === "review" && (
            <>
              <button className="modal-btn secondary"
                onClick={() => setStep(hasProfileCV ? "confirm" : "upload")}>
                ← Back
              </button>
              <button className="modal-btn primary" onClick={handleSubmit}>
                Submit Application →
              </button>
            </>
          )}
          {step === "submitted" && (
            <button className="modal-btn primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
