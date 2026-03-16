import { useEffect, useRef } from "react";

export default function Splash({ onDone }) {
  const splashRef = useRef(null);
  const bulbRef   = useRef(null);
  const raysRef   = useRef(null);
  const glowRef   = useRef(null);
  const r1Ref     = useRef(null);
  const r2Ref     = useRef(null);
  const r3Ref     = useRef(null);
  const titleRef  = useRef(null);
  const subRef    = useRef(null);

  useEffect(() => {
    const bulb   = bulbRef.current;
    const rays   = raysRef.current;
    const glow   = glowRef.current;
    const title  = titleRef.current;
    const sub    = subRef.current;
    const splash = splashRef.current;

    // T+100 — bulb pops in
    const t1 = setTimeout(() => {
      bulb.style.transition = "transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, filter 0.6s ease";
      bulb.style.transform  = "scale(1) rotate(0deg)";
      bulb.style.opacity    = "1";
      bulb.style.filter     = "drop-shadow(0 0 22px rgba(255,210,0,0.9))";
      glow.style.transition = "transform 0.7s ease, opacity 0.5s ease";
      glow.style.transform  = "scale(1)";
      glow.style.opacity    = "1";
    }, 100);

    // T+350 — rays spin
    const t2 = setTimeout(() => {
      rays.style.transition = "opacity 0.3s ease, transform 1.6s ease";
      rays.style.opacity    = "0.9";
      rays.style.transform  = "rotate(80deg) scale(1.15)";
      setTimeout(() => { rays.style.opacity = "0"; }, 900);
    }, 350);

    // Rings expand
    const ringData = [[r1Ref, 400], [r2Ref, 580], [r3Ref, 760]];
    const ringTimers = ringData.map(([ref, delay]) =>
      setTimeout(() => {
        ref.current.style.transition = "transform 1s ease-out, opacity 1s ease-out";
        ref.current.style.transform  = "scale(1.6)";
        ref.current.style.opacity    = "0";
      }, delay)
    );

    // T+650 — title + subtitle
    const t3 = setTimeout(() => {
      title.style.opacity   = "1";
      title.style.transform = "translateY(0)";
      setTimeout(() => {
        sub.style.opacity   = "1";
        sub.style.transform = "translateY(0)";
      }, 180);
    }, 650);

    // T+2400 — fade out
    const t4 = setTimeout(() => {
      splash.style.opacity = "0";
      setTimeout(onDone, 650);
    }, 2400);

    return () => [t1, t2, t3, t4, ...ringTimers].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      ref={splashRef}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#0d0d0d",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        transition: "opacity 0.65s ease",
      }}
    >
      {/* Bulb wrap */}
      <div style={{ position: "relative", width: 145, height: 145, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26 }}>

        {/* Glow orb */}
        <div ref={glowRef} style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,210,0,0.18) 0%, transparent 70%)", transform: "scale(0.3)", opacity: 0 }} />

        {/* Rings */}
        {[[r1Ref, 88], [r2Ref, 122], [r3Ref, 162]].map(([ref, size], i) => (
          <div key={i} ref={ref} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: "1.5px solid rgba(255,210,0,0.55)", opacity: 0, transform: "scale(0.5)" }} />
        ))}

        {/* Rays */}
        <svg ref={raysRef} width="145" height="145" viewBox="0 0 145 145" fill="none"
          style={{ position: "absolute", opacity: 0, transform: "rotate(0deg) scale(0.6)" }}>
          <line x1="72" y1="5"   x2="72" y2="24"  stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="72" y1="121" x2="72" y2="140" stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="5"  y1="72"  x2="24" y2="72"  stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="121" y1="72" x2="140" y2="72" stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="20" y1="20" x2="34"  y2="34"  stroke="#ffd200" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <line x1="111" y1="111" x2="125" y2="125" stroke="#ffd200" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <line x1="125" y1="20" x2="111" y2="34"  stroke="#ffd200" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <line x1="20"  y1="125" x2="34" y2="111" stroke="#ffd200" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
        </svg>

        {/* Bulb SVG */}
        <svg ref={bulbRef} width="86" height="86" viewBox="0 0 80 80" fill="none"
          style={{ position: "relative", zIndex: 2, transform: "scale(0) rotate(-20deg)", opacity: 0, filter: "drop-shadow(0 0 0px rgba(255,210,0,0))" }}>
          <circle cx="40" cy="33" r="20" fill="rgba(255,210,0,0.2)" stroke="#ffd200" strokeWidth="2"/>
          <circle cx="40" cy="33" r="10" fill="rgba(255,210,0,0.45)"/>
          <path d="M32 53h16M34 59h12" stroke="#ffd200" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Title */}
      <div ref={titleRef} style={{ fontSize: 28, fontWeight: 700, color: "#ffd200", letterSpacing: "0.08em", opacity: 0, transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
        LUMINARY AI
      </div>

      {/* Subtitle */}
      <div ref={subRef} style={{ fontSize: 14, color: "rgba(245,245,240,0.4)", marginTop: 8, opacity: 0, transform: "translateY(12px)", transition: "opacity 0.5s 0.18s ease, transform 0.5s 0.18s ease" }}>
        Your AI-Powered Academic Advisor
      </div>
    </div>
  );
}
