import { useId } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  ariaLabel?: string
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = 'var(--color-primary-500)',
  ariaLabel,
}: SparklineProps) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? 'גרף קו'}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

interface BarMiniProps {
  data: { label: string; value: number }[]
  max?: number
  ariaLabel?: string
}

export function BarMini({ data, max, ariaLabel }: BarMiniProps) {
  const titleId = useId()
  if (data.length === 0) return null
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1)

  return (
    <div role="img" aria-labelledby={titleId} className="flex flex-col gap-2">
      <span id={titleId} className="sr-only">
        {ariaLabel ?? 'גרף עמודות'}
      </span>
      {data.map((d) => {
        const pct = (d.value / ceiling) * 100
        return (
          <div key={d.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-text-muted">
              {d.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[--color-surface-sunk]">
              <div
                className="absolute inset-y-0 start-0 rounded-full bg-primary-500 transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-end font-medium text-text">{d.value}</span>
          </div>
        )
      })}
    </div>
  )
}

interface DonutProps {
  data: { label: string; value: number; color?: string }[]
  size?: number
  ariaLabel?: string
}

const DONUT_PALETTE = [
  'var(--color-primary-500)',
  'var(--color-primary-300)',
  'var(--color-primary-700)',
  'var(--color-primary-400)',
  'var(--color-primary-600)',
]

export function Donut({ data, size = 140, ariaLabel }: DonutProps) {
  const titleId = useId()
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const radius = size / 2 - 8
  const circ = 2 * Math.PI * radius

  // Pre-compute cumulative offsets immutably so render stays pure.
  const segments = data.reduce<{ len: number; offset: number }[]>((acc, d) => {
    const prev = acc[acc.length - 1]
    const offset = prev ? prev.offset + prev.len : 0
    return [...acc, { len: (d.value / total) * circ, offset }]
  }, [])

  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{ariaLabel ?? 'תרשים עוגה'}</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunk)"
          strokeWidth={12}
        />
        {data.map((d, i) => {
          const { len, offset } = segments[i]
          const dash = `${len} ${circ - len}`
          const dashoffset = -offset
          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color ?? DONUT_PALETTE[i % DONUT_PALETTE.length]}
              strokeWidth={12}
              strokeDasharray={dash}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          )
        })}
        <text
          x={size / 2}
          y={size / 2}
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-current text-xl font-bold"
        >
          {total}
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: d.color ?? DONUT_PALETTE[i % DONUT_PALETTE.length] }}
            />
            <span className="text-text-muted">{d.label}</span>
            <span className="font-medium text-text">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
