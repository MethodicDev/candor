import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Candor starter",
  description: "A Next.js app with Candor UI's agent chat on the Vercel AI SDK and the Claude Agent SDK.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
