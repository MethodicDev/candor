import type { ReactNode } from "react"
import Link from "next/link"

const links = [
  { href: "/", label: "Vercel AI SDK" },
  { href: "/claude", label: "Claude Agent SDK" },
] as const

/** The starter's header: what this is, and the two versions of the chat. */
export function PageHeader({ current, title, description }: { current: "/" | "/claude"; title: string; description: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-semibold">Candor starter</p>
        <nav aria-label="Chat versions" className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === current ? "page" : undefined}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <a className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline" href="https://candor.themethodic.com/docs">
          Candor docs
        </a>
      </div>
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
  )
}
