import { useState } from 'react'

interface Props {
  name: string
  courses: string[]
  fields: string[]
}

export default function SlackNotification({ name, courses, fields }: Props) {
  const [sent, setSent] = useState(false)
  const [visible, setVisible] = useState(false)

  const handleSend = () => {
    setSent(true)
    setTimeout(() => setVisible(true), 300)
  }

  const now = new Date()
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          📅 Scheduling to Slack
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Let Luminary's watsonx scheduling agent send your weekly plan to Slack.
        </p>
      </div>

      {!sent ? (
        <button
          onClick={handleSend}
          className="inline-flex items-center gap-3 rounded-2xl border border-[#4A154B]/60 bg-[#4A154B]/20 px-5 py-3 text-sm font-medium text-white hover:bg-[#4A154B]/40 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 54 54" fill="none">
            <path d="M19.7 33.6c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5 2-4.5 4.5-4.5H19.7v4.5z" fill="#E01E5A"/>
            <path d="M22.2 33.6c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5v11.3c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5V33.6z" fill="#E01E5A"/>
            <path d="M26.7 19.7c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5V19.7H26.7z" fill="#36C5F0"/>
            <path d="M26.7 22.2c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5H15.4c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5H26.7z" fill="#36C5F0"/>
            <path d="M40.6 26.7c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5V22.2h4.5c2.5 0 4.5 2 4.5 4.5z" fill="#2EB67D"/>
            <path d="M31.6 26.7c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5v11.3c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5V26.7z" fill="#2EB67D"/>
            <path d="M36.1 40.6c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5-4.5-2-4.5-4.5v-4.5h4.5z" fill="#ECB22E"/>
            <path d="M36.1 38.1c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5h11.3c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5H36.1z" fill="#ECB22E"/>
          </svg>
          Send my weekly plan to Slack
        </button>
      ) : (
        <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-2 text-xs text-green-400 mb-3 inline-flex items-center gap-2">
            <span>✓</span> Sent to your slack
          </div>

          {/* Mock Slack message */}
          <div className="rounded-2xl border border-slate-700 bg-[#1a1d21] p-4 space-y-3 font-mono text-sm">
            {/* Slack header */}
            <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-400 flex items-center justify-center text-[#0c0c0e] font-bold text-xs shrink-0">
                L
              </div>
              <div>
                <span className="text-white font-bold text-sm">Luminary AI</span>
                <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">APP</span>
                <span className="ml-2 text-slate-500 text-xs">{time}</span>
              </div>
            </div>

            {/* Message body */}
            <div className="space-y-2 text-slate-300">
              <p>👋 Hey <span className="text-white font-semibold">{name || 'there'}</span>! Here's your Luminary weekly plan:</p>

              <div className="rounded-lg border-l-4 border-amber-400 bg-slate-800/60 px-3 py-2 space-y-1">
                <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide">🎓 This week's focus</p>
                {courses.length > 0 ? courses.map((c, i) => (
                  <p key={i} className="text-slate-200 text-xs">• {c}</p>
                )) : (
                  <p className="text-slate-200 text-xs">• Review your degree roadmap</p>
                )}
              </div>

              <div className="rounded-lg border-l-4 border-blue-400 bg-slate-800/60 px-3 py-2 space-y-1">
                <p className="text-blue-400 font-semibold text-xs uppercase tracking-wide">🚀 Your career tracks</p>
                {fields.map((f, i) => (
                  <p key={i} className="text-slate-200 text-xs">• {f}</p>
                ))}
              </div>

              <p className="text-slate-400 text-xs">Powered by <span className="text-amber-400">Luminary AI</span> × <span className="text-purple-400">IBM watsonx</span> </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}