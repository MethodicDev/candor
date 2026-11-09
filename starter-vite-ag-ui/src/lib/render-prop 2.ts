import * as React from "react"

/**
 * Lets Candor's Radix-based primitives also take Base UI's `render` prop. In projects on a Base UI style
 * (shadcn's `base-*` styles), the shadcn CLI rewrites `<Trigger asChild><button/></Trigger>` into
 * `<Trigger render={<button/>}>`; this turns that back into Radix's asChild, so Candor works in either kind of project.
 */
export type RenderProp = {
  /** Base UI's way to render as another element; the same as `asChild` with that element as the child. */
  render?: React.ReactElement | undefined
  /** Base UI's flag for a button rendered as another element; shadcn adds it with `render`. Radix doesn't need it. */
  nativeButton?: boolean | undefined
}

export function withRender<P extends { asChild?: boolean | undefined; children?: React.ReactNode | undefined }>({ render, nativeButton: _nativeButton, ...props }: P & RenderProp): P {
  if (!render) return props as unknown as P
  const children = props.children === undefined ? render : React.cloneElement(render, undefined, props.children)
  return { ...props, asChild: true, children } as unknown as P
}
