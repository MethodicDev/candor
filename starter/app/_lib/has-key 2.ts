import "server-only"
import { connection } from "next/server"

/**
 * Whether ANTHROPIC_API_KEY is set on the server. Read at request time (not
 * baked in at build), and only the yes/no reaches the browser, never the key.
 */
export async function hasAnthropicKey(): Promise<boolean> {
  await connection()
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}
