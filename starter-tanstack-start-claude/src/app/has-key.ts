import { createServerFn } from "@tanstack/react-start"

/**
 * Whether ANTHROPIC_API_KEY is set on the server. Read on each request (not baked in at build), and only the yes/no
 * reaches the browser, never the key.
 */
export const getHasKey = createServerFn({ method: "GET" }).handler(() => Boolean(process.env.ANTHROPIC_API_KEY?.trim()))
