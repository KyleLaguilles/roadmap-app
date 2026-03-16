import { useState } from "react";
import axios from "axios";

const DOCS = [
  { id: "resume",      label: "Resume",                icon: "📄" },
  { id: "coverLetter", label: "Cover Letter",           icon: "✉️" },
  { id: "dpr",         label: "Degree Progress Report", icon: "🎓" },
  { id: "transcript",  label: "Transcript",             icon: "📊" },
];

export default function HomePage({ uploadedFiles, setUploadedFiles, onContinue }) {
  const [query, setQuery]       = useState("");
  const [answer, setAnswer]     = useState("");
  const [searching, setSearching] = useState(false);

  const pickFile = (id) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.doc,.docx,.txt";
    inp.onchange = (e) => {
      const f = e.target.files[0];
      if (f) setUploadedFiles((prev) => ({ ...prev, [id]: f }));
    };
    inp.click();
  };

  const removeFile = (id, e) => {
    e.stopPropagation();
    setUploadedFiles((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setAnswer("");
    try {
      const { data } = await axios.post("/api/search", { query });
      setAnswer(data.answer);
    } catch {
      setAnswer("Couldn't reach the advisor — make sure the backend is running.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "calc(100vh - 57px)",
      padding: "48px 24px", textAlign: "center", position: "relative",
    }}>
      {/* Glow orb */}
      <div style={{
        position: "absolute", width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,210,0,0.09) 0%, transparent 70%)",
        top: 0, left: "50%", transform: "translateX(-50%)", pointerEvents: "none",
        animation: "orbBreathe 4s ease-in-out infinite",
      }} />

      {/* Hero bulb */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 22, filter: "drop-shadow(0 0 14px rgba(255,210,0,0.55))" }}>
        <circle cx="40" cy="33" r="20" fill="rgba(255,210,0,0.15)" stroke="#ffd200" strokeWidth="2"/>
        <circle cx="40" cy="33" r="9"  fill="rgba(255,210,0,0.3)"/>
        <path d="M32 53h16M34 59h12" stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M40 13V9M59 24l3-3M21 24l-3-3M64 35h4M12 35H8" stroke="#ffd200" strokeWidth="2" strokeLinecap="round"/>
      </svg>

      <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15, marginBottom: 10 }}>
        <span style={{ color: "#ffd200" }}>Luminary AI</span><br />Academic Advisor
      </h1>
      <p style={{ fontSize: 15, color: "rgba(245,245,240,0.42)", marginBottom: 36, maxWidth: 500, lineHeight: 1.65 }}>
        Upload your documents and get personalized course recommendations for next semester
      </p>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ width: "100%", maxWidth: 560, position: "relative", marginBottom: 40 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about courses, requirements, career paths..."
          style={{
            width: "100%", padding: "14px 52px 14px 20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,210,0,0.28)",
            borderRadius: 12, color: "#f5f5f0", fontSize: 14, outline: "none",
          }}
        />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}>
          <circle cx="8.5" cy="8.5" r="5.5" stroke="#ffd200" strokeWidth="1.5"/>
          <path d="M13 13l3.5 3.5" stroke="#ffd200" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {answer && (
          <div style={{
            marginTop: 10, padding: "12px 16px", textAlign: "left",
            background: "rgba(255,210,0,0.06)", border: "0.5px solid rgba(255,210,0,0.22)",
            borderRadius: 10, fontSize: 13, color: "rgba(245,245,240,0.8)", lineHeight: 1.65,
          }}>
            {searching ? "Thinking…" : answer}
          </div>
        )}
      </form>

      {/* Upload section */}
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,210,0,0.5)", marginBottom: 12, textAlign: "left", width: "100%", maxWidth: 560 }}>
        Upload your documents
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 560 }}>
        {DOCS.map(({ id, label, icon }) => {
          const file = uploadedFiles[id];
          return (
            <div
              key={id}
              onClick={() => pickFile(id)}
              style={{
                background: file ? "rgba(255,210,0,0.22)" : "rgba(255,210,0,0.08)",
                border: `1px solid ${file ? "#ffd200" : "rgba(255,210,0,0.35)"}`,
                borderRadius: 10, padding: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                transition: "all 0.2s",
                boxShadow: file ? "0 0 20px rgba(255,210,0,0.22)" : "none",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,210,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ffd200" }}>{label}</div>
                <div style={{ fontSize: 11, color: file ? "rgba(255,210,0,0.9)" : "rgba(255,210,0,0.52)", marginTop: 2 }}>
                  {file ? `✓ ${file.name.length > 20 ? file.name.slice(0, 20) + "…" : file.name}` : "Click to upload"}
                </div>
              </div>
              {file && (
                <span onClick={(e) => removeFile(id, e)} style={{ color: "rgba(255,210,0,0.6)", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</span>
              )}
            </div>
          );
        })}
      </div>

      {/* CTAs */}
      <div style={{ marginTop: 26, display: "flex", gap: 12 }}>
        <button
          onClick={onContinue}
          style={{
            padding: "13px 30px", borderRadius: 10, background: "#ffd200",
            color: "#0d0d0d", fontSize: 13, fontWeight: 700, border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 0 0 rgba(255,210,0,0)", transition: "box-shadow 0.2s, transform 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 22px rgba(255,210,0,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l5 4-5 4" stroke="#0d0d0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Continue to Coach
        </button>
        <button style={{
          padding: "13px 24px", borderRadius: 10, background: "transparent",
          color: "#ffd200", fontSize: 13, fontWeight: 600,
          border: "1px solid rgba(255,210,0,0.45)", cursor: "pointer",
          transition: "all 0.2s",
        }}>
          View Sample Report
        </button>
      </div>
    </div>
  );
}
