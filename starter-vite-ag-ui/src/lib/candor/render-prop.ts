import * as React from "react"

/**
 * Lets Candor's Radix-based primitives also take Base UI's `render` prop. In projects on a Base UI style
 * (shadcn's `base-*` styles), the shadcn CLI rewrites `<Trigger asChild><button/></Trigger>` into
 * `<Trigger render={<button/>}>`; this turns that back into Radix's asChild, so Candor works in either kind of project.
 */
export type RenderProp = {
  /**
   * Base UI's way to render as another element; the same as `asChild` with that element as the child. It takes an
   * element (`render={<a href="/docs" />}`), not Base UI's function form (`render={(props, state) => ...}`): the
   * function needs Base UI's own props and state, which Radix doesn't have to give it. The element keeps its own
   * children unless the component is given some.
   */
  render?: React.ReactElement | undefined
  /** Base UI's flag for a button rendered as another element; shadcn adds it with `render`. Radix doesn't need it. */
  nativeButton?: boolean | undefined
}

/**
 * Whether this is a production build. Bundlers replace `process.env.NODE_ENV` at build time (Vite and Next both do),
 * so the read works in the browser too; where nothing defines it, the answer is "production", so a page is never
 * crashed over a prop that only changes which element is drawn.
 */
const production = () => {
  try {
    return process.env.NODE_ENV === "production"
  } catch {
    return true
  }
}

export function withRender<P extends { asChild?: boolean | undefined; children?: React.ReactNode | undefined }>({ render, nativeButton: _nativeButton, ...props }: P & RenderProp): P {
  if (!render) return props as unknown as P
  if (!React.isValidElement(render)) {
    // Base UI's function form can't be honoured here (see RenderProp). Say so while building; in production draw the
    // primitive's own element rather than crash a page over a prop that only changes what element it is.
    if (!production()) throw new Error("Candor: `render` takes an element, such as render={<a href=\"/docs\" />}. The function form, render={(props, state) => ...}, is Base UI's own and isn't supported on Candor's Radix-based primitives; pass an element, or use asChild with a child.")
    return props as unknown as P
  }
  const children = props.children === undefined ? render : React.cloneElement(render, undefined, props.children)
  return { ...props, asChild: true, children } as unknown as P
}
