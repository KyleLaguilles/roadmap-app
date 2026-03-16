import { useEffect, useState } from 'react'

const DURATION_MS = 3200
const BULB_LIGHT_UP_MS = 800

export default function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'bulb' | 'icon'>('bulb')
  const [hide, setHide] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('icon'), BULB_LIGHT_UP_MS)
    const t2 = setTimeout(() => setHide(true), DURATION_MS - 200)
    const t3 = setTimeout(onComplete, DURATION_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0c0e] transition-opacity duration-300 ${
        hide ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-6 text-center px-4">
        {/* Icon container: light bulb morphs into roadmap icon */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Light bulb - visible in phase 'bulb', fades out when phase is 'icon' */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              phase === 'bulb' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <svg
              className="w-20 h-20 text-amber-400 animate-glow-bulb"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
            </svg>
          </div>

          {/* Roadmap / path icon - visible in phase 'icon' */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              phase === 'icon' ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
          >
            <div className="rounded-full border-2 border-amber-400/80 bg-[#0c0c0e] p-4 shadow-[0_0_24px_rgba(251,191,36,0.4)]">
              <svg
                className="w-10 h-10 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12h16M4 8h8m-8 8h6" />
                <circle cx="18" cy="12" r="2" fill="currentColor" />
                <circle cx="10" cy="8" r="2" fill="currentColor" />
                <circle cx="8" cy="16" r="2" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-amber-400 tracking-tight drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
          AI Career Coach
        </h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Design your CS journey with an agentic coach
        </p>
      </div>
    </div>
  )
}
