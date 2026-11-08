import * as React from "react"

/**
 * The app's words for its own concepts, so components read like the product:
 * one app says "org", another "project" or "workspace".
 */
export type Terms = {
  /** One place agents act in. */
  environment: string
  environments: string
  /** The paying customer that owns the environments. */
  account: string
  /** The product's own name, for labels like "In the app" and "What the app will read". */
  product: string
}

const defaults: Terms = { environment: "environment", environments: "environments", account: "account", product: "the app" }

const TermsContext = React.createContext<Terms>(defaults)

function TermsProvider({
  terms,
  children,
}: {
  /** The words to use; any left out fall back to the ones above. */
  terms: Partial<Terms>
  children: React.ReactNode
}) {
  const parent = React.useContext(TermsContext)
  const value = React.useMemo(() => ({ ...parent, ...terms }), [parent, terms])
  return <TermsContext.Provider value={value}>{children}</TermsContext.Provider>
}

/** The app's terms; defaults are "environment" and "account". */
function useTerms() {
  return React.useContext(TermsContext)
}

/** "Environment" from "environment": for headings and the start of a sentence. */
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export { TermsProvider, useTerms, capitalise }
