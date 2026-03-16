export default function Navbar({ currentPage, onNavigate }) {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 36px",
      borderBottom: "0.5px solid rgba(255,210,0,0.15)",
      position: "relative", zIndex: 10,
      background: "rgba(13,13,13,0.88)",
      backdropFilter: "blur(14px)",
    }}>
      {/* Logo */}
      <div
        onClick={() => onNavigate("home")}
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
      >
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ animation: "logoPulse 2.4s ease-in-out infinite" }}>
          <circle cx="14" cy="12" r="7" stroke="#ffd200" strokeWidth="1.8" fill="rgba(255,210,0,0.1)"/>
          <path d="M11 19h6M12 22h4" stroke="#ffd200" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M14 5V3M20.5 7.5l1.4-1.4M7.5 7.5L6.1 6.1M23 14h2M3 14H1" stroke="#ffd200" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", color: "#ffd200" }}>
          LUMINARY AI
        </span>
      </div>

      {/* Right side: Home | Login  Signup */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => onNavigate("home")}
          style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: currentPage === "home" ? "rgba(255,210,0,0.1)" : "transparent",
            color: currentPage === "home" ? "#ffd200" : "rgba(245,245,240,0.42)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Home
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "rgba(255,210,0,0.15)", margin: "0 4px" }} />

        <button style={{
          padding: "7px 18px", borderRadius: 8,
          border: "1px solid rgba(255,210,0,0.35)",
          background: "transparent", color: "#ffd200",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          transition: "all 0.2s",
        }}>
          Log In
        </button>

        <button style={{
          padding: "7px 18px", borderRadius: 8,
          border: "none", background: "#ffd200",
          color: "#0d0d0d", fontSize: 13, fontWeight: 700,
          cursor: "pointer", transition: "all 0.2s",
        }}>
          Sign Up
        </button>
      </div>
    </nav>
  );
}
