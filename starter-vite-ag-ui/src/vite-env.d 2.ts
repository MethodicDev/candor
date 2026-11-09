/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The AG-UI endpoint. Empty or unset: the scripted in-browser agent. */
  readonly VITE_AGENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
