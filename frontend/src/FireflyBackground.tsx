import { useMemo } from 'react'

const FIREFLY_COUNT = 44

function fireflySeed(i: number) {
  const x = (i * 17 + 31) % 100
  const y = (i * 23 + 7) % 100
  const delay = (i * 1.3 + 0.5) % 5
  const duration = 4 + (i % 3)
  const size = 2 + (i % 3)
  return { x, y, delay, duration, size }
}

export default function FireflyBackground() {
  const fireflies = useMemo(
    () =>
      Array.from({ length: FIREFLY_COUNT }, (_, i) => fireflySeed(i)),
    []
  )

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {fireflies.map(({ x, y, delay, duration, size }, i) => (
        <div
          key={i}
          className="firefly absolute rounded-full bg-amber-400"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            boxShadow: `0 0 ${size * 6}px ${size * 1.5}px rgba(251, 191, 36, 0.38)`,
            animation: `firefly-twinkle ${duration}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
}
