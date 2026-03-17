import { type FormEvent, useState } from 'react'
import IntroAnimation from './IntroAnimation'
import FireflyBackground from './FireflyBackground'
import PdfUploadZone from './PdfUploadZone'
import luminaryLogo from './assets/luminary_logo.png'
import SlackNotification from './SlackNotification'

type GradeLevel = 'high school' | 'freshman' | 'sophomore' | 'junior' | 'senior'
type MathComfort = 'low' | 'medium' | 'high'
type CodingExposure = 'none' | 'some' | 'experienced'

interface ElectiveCourse {
  number: string
  name: string
  prereq?: string | null
  in_progress?: boolean | null
}

interface AnalyzeResponse {
  fields: string[]
  reasoning: string
  remaining_courses: {
    semester: string
    courses: { number: string; name: string; prereq?: string | null }[]
  }[]
  job_market: {
    field: string
    median_salary: string
    companies: string[]
    locations: string[]
    titles: string[]
  }[]
  electives: ElectiveCourse[]
  resources: { skill: string; items: string[] }[]
}

function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [step, setStep] = useState<'form' | 'results'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)

  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('high school')
  const [interests, setInterests] = useState('')
  const [mathComfort, setMathComfort] = useState<MathComfort>('medium')
  const [codingExposure, setCodingExposure] = useState<CodingExposure>('some')
  const [careerGoal, setCareerGoal] = useState('')
  const [transcript, setTranscript] = useState('')
  const [resumeFile, setResumeFile] = useState<string | null>(null)
  const [resumeText, setResumeText] = useState<string | null>(null)
  const [degreeProgressFile, setDegreeProgressFile] = useState<string | null>(null)
  const [degreeProgressText, setDegreeProgressText] = useState<string | null>(null)

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const [progressMessage, setProgressMessage] = useState<string>('Starting…')

  const prepTrack = [
    'Programming fundamentals: variables, loops, functions (Python or JavaScript)',
    'Data structures basics: arrays/lists, stacks, queues, hash maps',
    'Problem solving: 20–30 easy coding problems (focus on patterns)',
    'Math for CS: algebra → precalc → intro discrete math (logic, sets)',
    'Build 1 portfolio project: small web app or data project with a README',
    'Git + GitHub: commits, branches, pull requests',
  ]

  async function handleAskLuminary() {
    const question = chatInput.trim()
    if (!question || !result) return

    setChatError(null)
    setChatLoading(true)
    setChatMessages((prev) => [...prev, { role: 'user', text: question }])
    setChatInput('')

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          profile: {
            name,
            gradeLevel,
            interests,
            mathComfort,
            codingExposure,
            careerGoal,
          },
          plan: result,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail ?? 'Chat request failed')
      }

      const data: { answer: string } = await response.json()
      setChatMessages((prev) => [...prev, { role: 'assistant', text: data.answer }])
    } catch (err: any) {
      setChatError(err.message ?? 'Failed to contact Luminary')
    } finally {
      setChatLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setProgressMessage('Starting…')
    setResult({
      fields: [],
      reasoning: '',
      remaining_courses: [],
      job_market: [],
      electives: [],
      resources: [],
    })

    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          grade_level: gradeLevel,
          interests,
          math_comfort: mathComfort,
          coding_exposure: codingExposure,
          career_goal: careerGoal,
          transcript: transcript || null,
          resume_text: resumeText || null,
          degree_progress_text: degreeProgressText || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail ?? 'Something went wrong')
      }

      if (!response.body) {
        throw new Error('Streaming is not supported in this browser')
      }

      // Show results immediately; sections will fill in as chunks arrive.
      setStep('results')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE format: "data: <json>\n\n". Split on blank lines.
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line) continue
          const jsonText = line.startsWith('data:') ? line.slice(5).trim() : line
          if (!jsonText) continue

          let chunk: any
          try {
            chunk = JSON.parse(jsonText)
          } catch {
            continue
          }

          if (chunk.type === 'status') {
            setProgressMessage(chunk.message ?? 'Working…')
          } else if (chunk.type === 'job_market') {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    job_market: [
                      ...(prev.job_market ?? []),
                      {
                        field: chunk.field ?? '',
                        median_salary: chunk.median_salary ?? 'Not listed',
                        companies: chunk.companies ?? [],
                        locations: chunk.locations ?? [],
                        titles: chunk.titles ?? [],
                      },
                    ].filter((x) => x.field),
                  }
                : prev,
            )
          } else if (chunk.type === 'fields') {
            setResult((prev) => (prev ? { ...prev, fields: chunk.fields ?? [] } : prev))
          } else if (chunk.type === 'reasoning') {
            setResult((prev) => (prev ? { ...prev, reasoning: chunk.reasoning ?? '' } : prev))
          } else if (chunk.type === 'electives') {
            setResult((prev) => (prev ? { ...prev, electives: chunk.electives ?? [] } : prev))
          } else if (chunk.type === 'remaining_courses') {
            setResult((prev) =>
              prev ? { ...prev, remaining_courses: chunk.remaining_courses ?? [] } : prev,
            )
          } else if (chunk.type === 'resources') {
            setResult((prev) => (prev ? { ...prev, resources: chunk.resources ?? [] } : prev))
          } else if (chunk.type === 'error') {
            throw new Error(chunk.detail ?? 'Streaming error')
          } else if (chunk.type === 'done') {
            setProgressMessage('Done')
          }
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to contact coach')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('form')
    setResult(null)
    setError(null)
    setChatInput('')
    setChatMessages([])
    setChatError(null)
    setChatLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes luminaryFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .luminary-fade-in { animation: luminaryFadeIn 420ms ease-out; }
      `}</style>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      <div className="min-h-screen bg-[#0c0c0e] text-slate-50 flex items-center justify-center px-4 relative">
        <FireflyBackground />
        <div className="relative z-10 w-full max-w-5xl rounded-3xl border-2 border-dashed border-amber-400/50 bg-slate-900/40 backdrop-blur shadow-[0_0_40px_rgba(251,191,36,0.08)] p-8 md:p-10 space-y-8">
          <header className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <img
                src={luminaryLogo}
                alt="Luminary"
                className="h-9 w-9 object-contain drop-shadow-[0_0_14px_rgba(251,191,36,0.55)]"
              />
              <p className="text-sm font-medium text-amber-400 tracking-wide uppercase drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
                Luminary AI — Academic Advisor
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-amber-400/95 drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]">
              Let us help light the way to graduation
            </h1>
            <p className="text-slate-400 max-w-2xl">
              Tell us where you are today. Upload your DPR and we'll map out the fastest path to graduation, tailored to you.
            </p>
          </header>

        {step === 'form' && (
          <form
            onSubmit={handleSubmit}
            className="grid gap-6 md:grid-cols-2 md:gap-8 text-left"
          >
            <div className="space-y-4 md:col-span-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Grade level
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                  >
                    <option value="high school">High school</option>
                    <option value="freshman">Freshman</option>
                    <option value="sophomore">Sophomore</option>
                    <option value="junior">Junior</option>
                    <option value="senior">Senior</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Math comfort
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                    value={mathComfort}
                    onChange={(e) => setMathComfort(e.target.value as MathComfort)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Coding exposure
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                    value={codingExposure}
                    onChange={(e) => setCodingExposure(e.target.value as CodingExposure)}
                  >
                    <option value="none">None</option>
                    <option value="some">Some</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Career goal
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                    value={careerGoal}
                    onChange={(e) => setCareerGoal(e.target.value)}
                    placeholder="e.g. ML engineer, web dev"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Interests
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="What kinds of problems or projects excite you?"
                required
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <PdfUploadZone
                variant="resume"
                label="Upload Resume or Transcript (optional)"
                description="General background context — skills, experience, courses taken elsewhere."
                fileName={resumeFile}
                extractedText={resumeText}
                onFileAccepted={(file, text) => {
                  setResumeFile(file.name)
                  setResumeText(text)
                }}
                onRemove={() => {
                  setResumeFile(null)
                  setResumeText(null)
                }}
                disabled={loading}
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <PdfUploadZone
                variant="degree"
                label="Upload Degree Progress Report (optional)"
                description="CSUN degree audit showing classes completed and in progress."
                fileName={degreeProgressFile}
                extractedText={degreeProgressText}
                onFileAccepted={(file, text) => {
                  setDegreeProgressFile(file.name)
                  setDegreeProgressText(text)
                }}
                onRemove={() => {
                  setDegreeProgressFile(null)
                  setDegreeProgressText(null)
                }}
                disabled={loading}
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-200">
                  Or paste transcript / resume (optional)
                </label>
                <span className="text-xs text-slate-400">
                  Fallback if you don’t upload a PDF.
                </span>
              </div>
              <textarea
                className="w-full min-h-[80px] rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste any transcript, resume bullets, or project notes here..."
              />
            </div>

            <div className="md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
              {error && (
                <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900 px-3 py-2 rounded-lg w-full md:w-auto">
                  {error}
                </p>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-medium text-[#0c0c0e] shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
                    <span>{progressMessage || 'Luminary is mapping your path to graduation...'}</span>
                  </>
                ) : (
                  <>Light the way 🎓</>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'results' && result && (
                  <div className="space-y-8 text-left">

                    {/* Loading overlay */}
                    {loading && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl">🎓</span>
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-amber-400 font-medium text-lg">Generating your future...</p>
                          <p className="text-slate-400 text-sm">{progressMessage}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {[0,1,2].map((i) => (
                            <div key={i} className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    )}

                     {!loading && (
                       <div className="space-y-8">

             {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-400 tracking-wide uppercase mb-1">
                  Your Personalized Plan
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Your path to graduation is ready ✨
                </h2>
              </div>
              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-xl border border-amber-400/30 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-400/10"
              >
                ← Start over
              </button>
            </div>

            {/* Summary Card */}
                        <section className="relative rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-amber-400/5 to-transparent px-6 py-6 luminary-fade-in overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-8 w-8 rounded-full bg-amber-400 flex items-center justify-center text-[#0c0c0e] font-bold text-sm shrink-0">
                              ✦
                            </div>
                            <p className="text-sm font-bold text-amber-400 uppercase tracking-widest">
                              Where you stand
                            </p>
                          </div>
                          <p className="text-base text-slate-200 leading-relaxed font-medium">
                            {result.fields.length > 0
                              ? `Based on your background and goals, you're well-positioned to pursue ${result.fields.slice(0, 2).join(' and ')}. Here's what Luminary recommends to get you across the finish line.`
                              : 'Based on your profile, here is your personalized graduation plan.'}
                          </p>
                          {result.fields.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {result.fields.map((field) => (
                                <span key={field} className="inline-flex items-center rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-[#0c0c0e]">
                                  {field}
                                </span>
                              ))}
                            </div>
                          )}
                        </section>

            {/* Explainability */}
            {result.reasoning && (
              <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5 luminary-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400">✦</span>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                  Why Luminary chose this for you
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/15 bg-amber-400/10 px-4 py-3">
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  {result.reasoning || 'Luminary tailored this plan based on your profile and goals.'}
                </p>
              </div>
              </section>
            )}

            {/* Job market snapshot */}
            {result.job_market.length > 0 && (
              <section className="space-y-3 luminary-fade-in">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">
                Career paths that match your goals
                                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  {result.job_market.map((jm) => (
                    <article
                      key={jm.field}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4"
                    >
                      <p className="text-sm font-semibold text-slate-100 mb-2">{jm.field}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-300">
                          Median salary:{' '}
                          <span className="text-amber-300 font-medium">{jm.median_salary}</span>
                        </p>
                        {jm.companies.length > 0 && (
                          <p className="text-slate-300">
                            <span className="font-medium">Top companies hiring:</span>{' '}
                            <span className="text-slate-200 break-words">{jm.companies.slice(0, 3).join(', ')}</span>
                          </p>
                        )}
                        {jm.locations.length > 0 && (
                          <p className="text-slate-300">
                            <span className="font-medium">Common locations:</span>{' '}
                            <span className="text-slate-200 break-words">{jm.locations.slice(0, 3).join(', ')}</span>
                          </p>
                        )}
                      </div>

                      {jm.titles.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {jm.titles.map((title, idx) => (
                            <li key={`${jm.field}-${idx}-${title}`} className="text-sm text-slate-200 flex items-start gap-2">
                              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                              <span className="font-medium text-slate-100 break-words">{title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Full degree roadmap */}
            {result.remaining_courses.length > 0 && (
              <section className="space-y-3 luminary-fade-in">
                {result.remaining_courses.some((s) => s.semester === 'Senior electives') && (
                  <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm font-semibold text-amber-300">🎓 Elective units remaining</p>
                    <p className="text-sm text-slate-200 mt-1">
                      {result.remaining_courses.find((s) => s.semester === 'Senior electives')?.courses?.[0]?.number ?? ''}
                      {' '}
                      senior electives remaining.
                    </p>
                  </article>
                )}
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    🗺️ Your full degree roadmap
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Remaining required COMP courses (excludes completed and in-progress).
                  </p>
                </div>
                <div className="grid gap-3">
                  {result.remaining_courses
                    .filter((sem) => sem.semester !== 'Senior electives')
                    .map((sem) => (
                    <article
                      key={sem.semester}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <p className="text-sm font-semibold text-amber-300 mb-2">
                        {sem.semester}
                      </p>
                      <ul className="space-y-2">
                        {sem.courses.map((c) => (
                          <li
                            key={c.number}
                            className="flex items-start gap-2 rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2"
                          >
                            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                            <div className="text-sm">
                              <span className="font-medium text-amber-400/90">{c.number}</span>
                              <span className="text-slate-100">
                                {c.name ? ` — ${c.name}` : ''}
                              </span>
                              {c.prereq && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Prereq: {c.prereq}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Courses */}
            <section className={`space-y-3 ${result.electives.length > 0 ? 'luminary-fade-in' : ''}`}>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {result.electives.length === 1 && gradeLevel !== 'high school'
                    ? '⭐ Most recommended course'
                    : '📚 Courses to take next'}
                </h2>
                <p className="text-slate-300 text-sm">
                  Use this list when picking university courses or high-quality
                  online classes.
                </p>
                {result.electives.length > 0 ? (
                  <ul className="space-y-2">
                    {result.electives.map((elective, idx) => (
                      <li
                        key={elective.number ? `${elective.number}-${idx}` : idx}
                        className="flex items-start gap-2 rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2"
                      >
                        <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                        <div className="text-sm">
                          {elective.number && (
                            <span className="font-medium text-amber-400/90">{elective.number}</span>
                          )}
                          <span className="text-slate-100">
                            {elective.number ? ` — ${elective.name}` : elective.name}
                          </span>
                        {elective.in_progress && (
                          <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 align-middle">
                            In progress
                          </span>
                        )}
                          {elective.prereq && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Prereq: {elective.prereq}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : gradeLevel === 'high school' ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-300">
                      You selected <span className="text-amber-300 font-medium">High school</span>, so
                      Luminary won’t recommend upper-division university electives yet. Here’s a prep track
                      to get you ready.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {prepTrack.map((item) => (
                        <li key={item} className="text-sm text-slate-200 flex items-start gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No course recommendations were returned for this run.
                  </p>
                )}
              </div>
            </section>

            {/* Skill Gaps Accordion */}
                        <section className={`space-y-3 ${result.resources.length > 0 ? 'luminary-fade-in' : ''}`}>
                          <div>
                            <h2 className="text-xl font-semibold tracking-tight">
                              ⚡ Skill gaps to address
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                              These are areas to strengthen before graduation. Click each to expand.
                            </p>
                          </div>
                          <div className="space-y-2">
                            {result.resources.map((group) => (
                              <details
                                key={group.skill}
                                className="group rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden"
                              >
                                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-slate-800/50 transition-colors">
                                  <span className="text-sm font-semibold text-amber-400">{group.skill}</span>
                                  <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <ul className="px-4 pb-4 space-y-1 border-t border-slate-800 pt-3">
                                  {group.items.map((item) => (
                                    <li key={item} className="text-xs text-slate-300 flex items-start gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ))}
                          </div>
                        </section>

            {/* Slack Notification */}
            <SlackNotification
            name={name}
            courses={result.electives.slice(0, 3).map(e => e.number ? `${e.number} — ${e.name}` : e.name)}
            fields={result.fields.slice(0, 2)}

            />

            {/* Chat */}
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  💬 Ask Luminary
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Have questions about your plan? Ask anything.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                {chatMessages.length > 0 && (
                  <div className="space-y-3">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={`${msg.role}-${idx}`}
                        className={
                          msg.role === 'user'
                            ? 'ml-auto max-w-[85%] rounded-2xl bg-amber-400/10 border border-amber-400/20 px-3 py-2 text-sm text-slate-100'
                            : 'mr-auto max-w-[85%] rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-sm text-slate-100'
                        }
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {chatError && (
                  <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900 px-3 py-2 rounded-lg">
                    {chatError}
                  </p>
                )}

                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                    placeholder="e.g. What class should I take first? Can I finish in 2 semesters?"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAskLuminary()
                      }
                    }}
                    disabled={chatLoading}
                  />
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-[#0c0c0e] hover:bg-amber-300"
                    onClick={handleAskLuminary}
                    disabled={chatLoading || chatInput.trim().length === 0}
                  >
                    {chatLoading ? 'Asking…' : 'Ask ✨'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Luminary has context of your full profile and DPR.
                </p>
              </div>
            </section>
          </div>
            )}
          </div>
        )}
        </div>
      </div>
    </>
  )
}

export default App