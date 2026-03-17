import { type FormEvent, useState } from 'react'
import IntroAnimation from './IntroAnimation'
import FireflyBackground from './FireflyBackground'
import PdfUploadZone from './PdfUploadZone'

type GradeLevel = 'high school' | 'freshman' | 'sophomore' | 'junior' | 'senior'
type MathComfort = 'low' | 'medium' | 'high'
type CodingExposure = 'none' | 'some' | 'experienced'

interface ElectiveCourse {
  number: string
  name: string
  prereq?: string | null
}

interface AnalyzeResponse {
  fields: string[]
  roadmap: string[]
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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

      const data: AnalyzeResponse = await response.json()
      setResult(data)
      setStep('results')
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
  }

  return (
    <>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      <div className="min-h-screen bg-[#0c0c0e] text-slate-50 flex items-center justify-center px-4 relative">
        <FireflyBackground />
        <div className="relative z-10 w-full max-w-5xl rounded-3xl border-2 border-dashed border-amber-400/50 bg-slate-900/40 backdrop-blur shadow-[0_0_40px_rgba(251,191,36,0.08)] p-8 md:p-10 space-y-8">
          <header className="space-y-2 text-center md:text-left">
            <p className="text-sm font-medium text-amber-400 tracking-wide uppercase drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
              Luminary AI — Academic Advisor
            </p>
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
                    <span>Luminary is mapping your path to graduation...</span>
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
            <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-5">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">
                Where you stand
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {result.fields.length > 0
                  ? `Based on your background and goals, you're well-positioned to pursue ${result.fields.slice(0, 2).join(' and ')}. Here's what Luminary recommends to get you across the finish line.`
                  : 'Based on your profile, here is your personalized graduation plan.'}
              </p>
            </section>

            {/* Recommended Courses */}
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  📚 Courses to take next
                </h2>
                <p className="text-slate-300 text-sm">
                  Use this list when picking university courses or high-quality
                  online classes.
                </p>
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
                        {elective.prereq && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Prereq: {elective.prereq}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Skill Gaps */}
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  ⚡ Skill gaps to address
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  These are areas to strengthen before graduation.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {result.resources.map((group) => (
                  <article
                    key={group.skill}
                    className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4"
                  >
                    <h3 className="text-sm font-semibold text-amber-400 mb-2">
                      {group.skill}
                    </h3>
                    <ul className="space-y-1">
                      {group.items.map((item) => (
                        <li key={item} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

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
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                    placeholder="e.g. What class should I take first? Can I finish in 2 semesters?"
                  />
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-[#0c0c0e] hover:bg-amber-300"
                  >
                    Ask ✨
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
       </div>
     </>
   )
 }

 export default App