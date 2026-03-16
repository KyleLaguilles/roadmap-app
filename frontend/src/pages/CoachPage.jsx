import { useState } from "react";
import axios from "axios";

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,210,0,0.18)",
  borderRadius: 8, color: "#f5f5f0",
  fontSize: 14, padding: "11px 14px", outline: "none",
  width: "100%", transition: "border-color 0.2s, box-shadow 0.2s",
};

export default function CoachPage({ uploadedFiles, onBack, onComplete }) {
  const [form, setForm] = useState({
    name: "", gradeLevel: "", mathComfort: "Medium",
    codingExposure: "Some", careerGoal: "", interests: "", pastedText: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.gradeLevel || !form.careerGoal) {
      setError("Please fill in Name, Grade Level, and Career Goal.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      Object.entries(uploadedFiles).forEach(([k, file]) => fd.append(k, file));

      const { data } = await axios.post("/api/analyze", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.success) {
        onComplete(data.data, form);
      } else {
        setError("Analysis failed. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Server error — make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "rgba(255,210,0,0.65)", textTransform: "uppercase" };
  const selectStyle = {
    ...inputStyle,
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffd200' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center",
    paddingRight: 36, cursor: "pointer",
  };

  return (
    <div style={{ padding: "40px 48px 60px", maxWidth: 760 }}>
      {/* Eyebrow */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.13em", color: "rgba(255,210,0,0.55)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffd200", animation: "logoPulse 2.4s ease-in-out infinite" }} />
        Career Coach
      </div>

      <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
        Design your <span style={{ color: "#ffd200" }}>CS journey</span><br />with an agentic coach
      </h2>
      <p style={{ fontSize: 13, color: "rgba(245,245,240,0.42)", marginBottom: 32, lineHeight: 1.65, maxWidth: 560 }}>
        Tell the coach where you are today. It will research the job market, pick focus areas, and outline a weekly roadmap tailored to you.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Alex" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Grade Level</label>
          <select style={selectStyle} value={form.gradeLevel} onChange={set("gradeLevel")}>
            <option value="">Select level</option>
            {["High school","Freshman","Sophomore","Junior","Senior","Graduate student"].map(o => (
              <option key={o} style={{ background: "#1a1a1a" }}>{o}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Math Comfort</label>
          <select style={selectStyle} value={form.mathComfort} onChange={set("mathComfort")}>
            {["Beginner","Medium","Advanced"].map(o => (
              <option key={o} style={{ background: "#1a1a1a" }}>{o}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Coding Exposure</label>
          <select style={selectStyle} value={form.codingExposure} onChange={set("codingExposure")}>
            {["None","Some","Moderate","Extensive"].map(o => (
              <option key={o} style={{ background: "#1a1a1a" }}>{o}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1/-1" }}>
          <label style={labelStyle}>Career Goal</label>
          <input style={inputStyle} value={form.careerGoal} onChange={set("careerGoal")} placeholder="e.g. ML engineer, web dev, data scientist..." />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1/-1" }}>
          <label style={labelStyle}>Interests</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 95, lineHeight: 1.6 }} value={form.interests} onChange={set("interests")} placeholder="What kinds of problems or projects excite you?" />
        </div>

        <hr style={{ gridColumn: "1/-1", border: "none", borderTop: "0.5px solid rgba(255,210,0,0.1)", margin: "4px 0" }} />

        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "rgba(255,210,0,0.65)", textTransform: "uppercase" }}>Optional: paste transcript / resume</span>
          <span style={{ fontSize: 11, color: "rgba(245,245,240,0.28)", fontStyle: "italic" }}>Helps the agent calibrate level, but not required.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1/-1" }}>
          <textarea style={{ ...inputStyle, fontSize: 13, minHeight: 110, lineHeight: 1.6, resize: "vertical" }} value={form.pastedText} onChange={set("pastedText")} placeholder="Paste any transcript, resume bullets, or project notes here..." />
        </div>

        {error && (
          <div style={{ gridColumn: "1/-1", padding: "10px 14px", background: "rgba(255,60,60,0.08)", border: "0.5px solid rgba(255,60,60,0.3)", borderRadius: 8, fontSize: 13, color: "#ff7070" }}>
            {error}
          </div>
        )}

        <div style={{ gridColumn: "1/-1", display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={onBack} style={{ padding: "12px 22px", borderRadius: 10, background: "transparent", color: "#ffd200", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,210,0,0.45)", cursor: "pointer" }}>
            ← Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "12px 28px", borderRadius: 10,
              background: loading ? "rgba(255,210,0,0.5)" : "#ffd200",
              color: "#0d0d0d", fontSize: 13, fontWeight: 700,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "box-shadow 0.2s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l5 4-5 4" stroke="#0d0d0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {loading ? "Analyzing…" : "Build My Roadmap"}
          </button>
          <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
            {[false, true, false].map((on, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#ffd200" : "rgba(255,210,0,0.18)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
