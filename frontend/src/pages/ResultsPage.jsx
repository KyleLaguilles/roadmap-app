import { useState } from "react";

const DEMO = {
  summary: "You're a motivated student aiming for an ML engineering career. Your moderate coding background and medium math comfort suggest a structured ramp-up will serve you well.",
  recommendedCourses: [
    { code: "CS 3310",  name: "Algorithms",       reason: "Core for any software role" },
    { code: "CS 4840",  name: "Machine Learning", reason: "Directly aligns with your goal" },
    { code: "CS 3220",  name: "Web Dev",           reason: "Versatile portfolio skill" },
    { code: "MATH 2550",name: "Statistics",        reason: "Foundation for ML" },
    { code: "CS 4650",  name: "Cybersecurity",     reason: "High-demand specialization" },
  ],
  careerInsights: [
    { insight: "ML Engineer roles are up 34% YoY — strong market signal for your goal", type: "opportunity" },
    { insight: "Python & PyTorch are the top requested skills in your target field", type: "tip" },
    { insight: "Build 2–3 portfolio projects to stand out to recruiters", type: "tip" },
  ],
  weeklyRoadmap: [
    { weeks: "1–2",  focus: "Python Fundamentals", tasks: ["Functions, lists, OOP basics", "10 LeetCode easy problems"],            tag: "Foundation" },
    { weeks: "3–4",  focus: "Data Skills",          tasks: ["NumPy & Pandas intro", "Kaggle mini-project"],                          tag: "Data" },
    { weeks: "5–7",  focus: "ML Core",              tasks: ["Enroll in CS 4840", "Linear regression + classification + eval"],       tag: "ML Core" },
    { weeks: "8–10", focus: "Portfolio",             tasks: ["Build capstone ML project", "Deploy to GitHub with a README"],          tag: "Portfolio" },
  ],
  skillGaps: ["PyTorch", "Git/GitHub", "SQL", "Cloud deployment"],
  strengths: ["Clear career direction", "Problem-solving mindset"],
};

const insightColors = {
  opportunity: { bg: "rgba(0,200,100,0.07)",  border: "rgba(0,200,100,0.22)",  dot: "#00c864" },
  warning:     { bg: "rgba(255,150,0,0.07)",  border: "rgba(255,150,0,0.22)",  dot: "#ff9600" },
  tip:         { bg: "rgba(255,210,0,0.06)",  border: "rgba(255,210,0,0.2)",   dot: "#ffd200" },
};

export default function ResultsPage({ results, studentProfile, onBack }) {
  const [chatInput, setChatInput]   = useState("");
  const [chatReply, setChatReply]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const data = results || DEMO;

  const askAI = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    setChatReply("");
    try {
      const ctx = studentProfile ? `Student: ${studentProfile.name}, Goal: ${studentProfile.careerGoal}` : "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentContext: ctx,
          messages: [{ role: "user", content: chatInput }],
        }),
      });
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try { const { text } = JSON.parse(payload); if (text) { full += text; setChatReply(full); } } catch {}
        }
      }
    } catch {
      setChatReply("Couldn't reach the AI — make sure the backend is running.");
    } finally {
      setChatLoading(false);
    }
  };

  const card = {
    background: "rgba(255,255,255,0.03)",
    border: "0.5px solid rgba(255,210,0,0.2)",
    borderRadius: 12, padding: "18px 20px",
  };

  return (
    <div style={{ padding: "40px 48px 60px" }}>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.13em", color: "rgba(255,210,0,0.55)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffd200", animation: "logoPulse 2.4s ease-in-out infinite" }} />
        Your Personalized Plan
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>
        Your <span style={{ color: "#ffd200" }}>Roadmap</span> is Ready
      </h2>

      {/* Summary */}
      {data.summary && (
        <p style={{ fontSize: 14, color: "rgba(245,245,240,0.62)", marginBottom: 28, lineHeight: 1.7, maxWidth: 700, padding: "14px 18px", background: "rgba(255,210,0,0.05)", border: "0.5px solid rgba(255,210,0,0.14)", borderRadius: 10 }}>
          {data.summary}
        </p>
      )}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 780, marginBottom: 24 }}>

        {/* Recommended Courses */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,210,0,0.6)", textTransform: "uppercase", marginBottom: 12 }}>Recommended Courses</div>
          {data.recommendedCourses?.map((c) => (
            <span key={c.code} title={c.reason} style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,210,0,0.08)", border: "0.5px solid rgba(255,210,0,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#ffd200", margin: "3px 3px 3px 0" }}>
              {c.code} — {c.name}
            </span>
          ))}
        </div>

        {/* Career Insights */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,210,0,0.6)", textTransform: "uppercase", marginBottom: 12 }}>Career Insights</div>
          {data.careerInsights?.map((item, i) => {
            const col = insightColors[item.type] || insightColors.tip;
            return (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 9, padding: "8px 12px", background: col.bg, border: `0.5px solid ${col.border}`, borderRadius: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.dot, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 13, color: "rgba(245,245,240,0.75)", lineHeight: 1.5 }}>{item.insight}</span>
              </div>
            );
          })}
        </div>

        {/* Weekly Roadmap */}
        <div style={{ ...card, gridColumn: "1/-1" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,210,0,0.6)", textTransform: "uppercase", marginBottom: 12 }}>Weekly Roadmap</div>
          {data.weeklyRoadmap?.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "11px 0", borderBottom: i < data.weeklyRoadmap.length - 1 ? "0.5px solid rgba(255,210,0,0.08)" : "none" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ffd200", minWidth: 54, paddingTop: 2, letterSpacing: "0.06em" }}>WEEK {w.weeks}</div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f0" }}>{w.focus}</span>
                <span style={{ display: "inline-block", background: "rgba(255,210,0,0.1)", color: "rgba(255,210,0,0.8)", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>{w.tag}</span>
                <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                  {w.tasks?.map((t, j) => (
                    <li key={j} style={{ fontSize: 12, color: "rgba(245,245,240,0.65)", marginBottom: 2 }}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Skill Gaps + Strengths */}
        {(data.skillGaps?.length > 0 || data.strengths?.length > 0) && (
          <div style={{ ...card, gridColumn: "1/-1" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {data.skillGaps?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,210,0,0.6)", textTransform: "uppercase", marginBottom: 10 }}>Skill Gaps to Address</div>
                  {data.skillGaps.map((s) => (
                    <span key={s} style={{ display: "inline-flex", background: "rgba(255,80,80,0.08)", border: "0.5px solid rgba(255,80,80,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#ff9090", margin: "3px 3px 3px 0" }}>{s}</span>
                  ))}
                </div>
              )}
              {data.strengths?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,210,0,0.6)", textTransform: "uppercase", marginBottom: 10 }}>Your Strengths</div>
                  {data.strengths.map((s) => (
                    <span key={s} style={{ display: "inline-flex", background: "rgba(0,200,100,0.08)", border: "0.5px solid rgba(0,200,100,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#00c864", margin: "3px 3px 3px 0" }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ask AI + Back */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", maxWidth: 780, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ padding: "12px 22px", borderRadius: 10, background: "transparent", color: "#ffd200", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,210,0,0.45)", cursor: "pointer" }}>
          ← Edit Profile
        </button>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askAI()}
          placeholder="Ask a follow-up question…"
          style={{ flex: 1, padding: "11px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,210,0,0.22)", color: "#f5f5f0", fontSize: 13, outline: "none", minWidth: 200 }}
        />
        <button
          onClick={askAI}
          disabled={chatLoading}
          style={{ padding: "12px 24px", borderRadius: 10, background: chatLoading ? "rgba(255,210,0,0.5)" : "#ffd200", color: "#0d0d0d", fontSize: 13, fontWeight: 700, border: "none", cursor: chatLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l5 4-5 4" stroke="#0d0d0d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {chatLoading ? "Thinking…" : "Ask Luminary AI"}
        </button>
      </div>

      {chatReply && (
        <div style={{ marginTop: 14, padding: "14px 18px", background: "rgba(255,210,0,0.04)", border: "0.5px solid rgba(255,210,0,0.18)", borderRadius: 10, fontSize: 13, color: "rgba(245,245,240,0.82)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxWidth: 780 }}>
          {chatReply}
        </div>
      )}
    </div>
  );
}
