/** Shown instead of the chat when the server has no ANTHROPIC_API_KEY. */
export function MissingKey() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="status" className="flex max-w-md flex-col gap-3 rounded-xl border bg-card p-5 text-sm shadow-xs">
        <h2 className="text-base font-semibold">Add an Anthropic API key to start chatting</h2>
        <p className="text-muted-foreground">
          The agent runs on your server with Claude, and <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> isn&rsquo;t set there.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Copy <code className="font-mono text-xs">.env.example</code> to <code className="font-mono text-xs">.env.local</code>.
          </li>
          <li>
            Put your key from{" "}
            <a className="text-foreground underline underline-offset-2" href="https://console.anthropic.com/settings/keys">
              the Claude Console
            </a>{" "}
            in it, and set <code className="font-mono text-xs">CANDOR_APPROVAL_SECRET</code> to a long random string.
          </li>
          <li>Restart the server. On Vercel, add both under Settings → Environment Variables and redeploy.</li>
        </ol>
      </div>
    </div>
  )
}
