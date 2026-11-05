import { cn } from "@/lib/utils"
import type { ContextSegment } from "@/registry/lib/know"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/ui/popover"

const kindColor: Record<ContextSegment["kind"], string> = {
  system: "var(--chart-5)",
  instructions: "var(--chart-1)",
  knowledge: "var(--chart-2)",
  thread: "var(--chart-4)",
  tools: "var(--chart-3)",
  files: "var(--faint-foreground)",
}

function k(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n)
}

/**
 * What fills the model's context budget, as a ring in the composer that
 * opens to a breakdown: system, instructions, Know, the thread, tools, files.
 * Counts are the service's own token counts; the ring warns past 80%.
 */
function ContextMeter({
  segments,
  limit,
  className,
}: {
  /** What fills the context window, by kind, in tokens. */
  segments: ContextSegment[]
  /** The model's context window, in tokens. */
  limit: number
  className?: string
}) {
  const used = segments.reduce((n, s) => n + s.tokens, 0)
  const pct = Math.min(1, used / limit)
  const warn = pct > 0.8
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Context: ${k(used)} of ${k(limit)} tokens used`}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs tabular-nums outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40", warn ? "text-warning-text" : "text-muted-foreground", className)}
      >
        <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden>
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--muted)" strokeWidth="2.5" />
          <circle cx="9" cy="9" r={r} fill="none" stroke={warn ? "var(--warning)" : "var(--primary)"} strokeWidth="2.5" strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" />
        </svg>
        {Math.round(pct * 100)}%
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="flex items-baseline justify-between text-sm font-medium">
          Context <span className="text-xs font-normal text-muted-foreground tabular-nums">{k(used)} / {k(limit)} tokens</span>
        </p>
        <div aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
          {segments.map((s) => (
            <span key={s.label} style={{ width: `${(s.tokens / limit) * 100}%`, background: kindColor[s.kind] }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {[...segments]
            .sort((a, b) => b.tokens - a.tokens)
            .map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span aria-hidden className="size-2 rounded-xs" style={{ background: kindColor[s.kind] }} />
                <span className="flex-1">{s.label}</span>
                <span className="text-muted-foreground tabular-nums">{k(s.tokens)}</span>
              </li>
            ))}
        </ul>
        {warn && <p className="mt-3 text-xs text-warning-text">Nearly full. Older thread turns will be summarised to make room.</p>}
      </PopoverContent>
    </Popover>
  )
}

export { ContextMeter }
