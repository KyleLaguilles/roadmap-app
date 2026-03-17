import { useCallback, useState } from 'react'

const API_BASE = 'http://localhost:8000'

interface PdfUploadZoneProps {
  label: string
  description: string
  variant: 'resume' | 'degree'
  fileName: string | null
  extractedText: string | null
  onFileAccepted: (file: File, text: string) => void
  onRemove: () => void
  disabled?: boolean
}

export default function PdfUploadZone({
  label,
  description,
  variant,
  fileName,
  extractedText,
  onFileAccepted,
  onRemove,
  disabled = false,
}: PdfUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extractPdf = useCallback(async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/upload-pdf`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail ?? 'Failed to extract PDF text')
    }
    const data = await res.json()
    return data.text ?? ''
  }, [])

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are accepted')
        return
      }
      setError(null)
      setUploading(true)
      try {
        const text = await extractPdf(file)
        onFileAccepted(file, text)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [extractPdf, onFileAccepted]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || uploading) return
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [disabled, uploading, handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile]
  )

  const borderColor = variant === 'resume' ? 'border-amber-400/40' : 'border-emerald-500/40'
  const bgHover = variant === 'resume' ? 'hover:bg-amber-400/5' : 'hover:bg-emerald-500/5'
  const dragActive = dragOver ? (variant === 'resume' ? 'bg-amber-400/10' : 'bg-emerald-500/10') : ''

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-200">{label}</label>
      <p className="text-xs text-slate-400 mb-1">{description}</p>
      {!fileName ? (
        <label
          htmlFor={`pdf-upload-${variant}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            block rounded-xl border-2 border-dashed ${borderColor} bg-slate-900/30 px-4 py-6
            flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer
            ${disabled || uploading ? 'opacity-60 pointer-events-none' : `${bgHover} ${dragActive}`}
          `}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={onInputChange}
            className="hidden"
            id={`pdf-upload-${variant}`}
          />
          {uploading ? (
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400/60 border-t-transparent" />
              Extracting text…
            </span>
          ) : (
            <>
              <span className="text-sm text-slate-300">
                Drag and drop a PDF here, or click to browse
              </span>
              <span className="text-sm font-medium text-amber-400 hover:underline">
                PDF only
              </span>
            </>
          )}
        </label>
      ) : (
        <div
          className={`rounded-xl border-2 ${borderColor} bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-2`}
        >
          <span className="text-sm text-slate-200 truncate" title={fileName}>
            {fileName}
          </span>
          {extractedText !== null && (
            <span className="text-xs text-slate-500 shrink-0">
              {extractedText.length > 0 ? `${extractedText.length} chars` : 'No text extracted'}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-sm text-rose-400 hover:text-rose-300 shrink-0"
          >
            Remove
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
