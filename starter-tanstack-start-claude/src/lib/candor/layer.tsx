import * as React from "react"

/**
 * How Candor's portalled layers (dialogs, sheets, popovers, menus, selects, tooltips) stay usable inside an app built
 * on another primitive library. Candor's primitives are on Base UI; a Radix app (shadcn's Radix styles) keeps its own
 * `components/ui/` beside `components/candor/ui/`, so a Candor popover often opens inside the app's own Radix dialog.
 * Three things go wrong there unless a layer does what this file does (internal/release-4.0/SPIKE.md measured each):
 *
 *   pointer      Radix's modal dialog sets `pointer-events: none` on `<body>` and turns it back on for its own layers.
 *                A layer portalled to `<body>` inherits `none` and every click falls through. Each portalled part takes
 *                `layerClass` (`pointer-events: auto`).
 *   containment  Radix's focus trap, outside-click and `aria-hidden` work by DOM containment: focus moving into a
 *                portal under `<body>` is pulled back, and a click there closes the dialog. Inside a dialog that isn't
 *                Base UI's, `LayerPortal` portals into a host `<div>` appended inside that dialog. The host is fixed,
 *                viewport-sized and its own containing block (`translateZ(0)`), offset by the dialog's position, so the
 *                dialog's transform doesn't squeeze a Candor dialog or move a list away from its trigger. In a dialog
 *                that clips (a max height and `overflow-y: auto`, say), the dialog's box would clip the host and its
 *                scroll would carry it, so the host is shown in the top layer instead (a manual `popover`): still
 *                inside the dialog for its focus trap and outside click, but drawn over the viewport, unclipped. A
 *                layer of another library opened from inside that host is drawn under it, as it isn't in the top layer.
 *   Escape       Radix dismisses its top layer from a document capture listener and calls `preventDefault()`; Base UI
 *                closes its own top layer too, so one Escape closed both. `useLayerRoot` ignores an Escape another
 *                library already handled. While a Candor layer is open in a host, Candor claims Escape first (before
 *                Radix sees it) unless focus is in another library's layer opened above Candor's.
 *
 * Outside a foreign dialog none of this changes anything: the host isn't made, and nothing claims Escape.
 */

/** On every portalled part (backdrop, positioner, popup, viewport): a layer under a Radix modal still takes the pointer. */
export const layerClass = "pointer-events-auto"

/** The attribute on a layer host. A layer opened from inside a host portals into the same host. */
export const LAYER_HOST = "data-candor-layer-host"

/** The shape of Base UI's change details that the Escape guard reads. */
type OpenChangeDetails = { reason?: string | undefined; event?: Event | undefined; trigger?: Element | undefined; cancel: () => void }

/** The element a layer opened from, kept by its root for its portal: the trigger, or the event's target. */
const LayerAnchor = React.createContext<React.RefObject<Element | null> | null>(null)

/** Escape events Candor claimed first; they still close Candor's own layer. */
const claimed = new WeakSet<Event>()

/** Whether a close is an Escape that another library already handled (it called `preventDefault()`). */
export function escapeHandledElsewhere(open: boolean, details: OpenChangeDetails): boolean {
  const event = details.event
  return !open && details.reason === "escape-key" && !!event?.defaultPrevented && !claimed.has(event)
}

/**
 * For a layer's root: wraps `onOpenChange` so an Escape another library handled doesn't also close this layer, and
 * remembers the element the layer opened from, for `LayerPortal`. Pass the result's `onOpenChange` to the Base UI
 * root and wrap it in `<LayerRoot anchor={…}>`.
 */
export function useLayerRoot<D extends OpenChangeDetails>(onOpenChange?: ((open: boolean, details: D) => void) | undefined) {
  const anchor = React.useRef<Element | null>(null)
  const handle = (open: boolean, details: D) => {
    if (escapeHandledElsewhere(open, details)) {
      details.cancel()
      return
    }
    if (open) {
      const target = details.event?.target
      anchor.current = details.trigger ?? (target instanceof Element ? target : null)
    }
    onOpenChange?.(open, details)
  }
  return { anchor, onOpenChange: handle }
}

/** Gives `LayerPortal`s below the element their layer opened from (`useLayerRoot`'s `anchor`). */
export function LayerRoot({
  anchor,
  children,
}: {
  /** The ref `useLayerRoot` returns as `anchor`: the trigger the layer last opened from, or the event's target. */
  anchor: React.RefObject<Element | null>
  /** The layer's root and its parts. */
  children?: React.ReactNode | undefined
}) {
  return <LayerAnchor.Provider value={anchor}>{children}</LayerAnchor.Provider>
}

/** Live hosts: how many open layers use each, and how to stop following its dialog. */
const hosts = new Map<HTMLElement, { users: number; stop: () => void }>()

/**
 * The dialog of another library that `from` is inside, if any: the nearest `role="dialog"` or `role="alertdialog"`
 * that isn't in one of Base UI's portals (Base UI nests its own layers itself).
 */
function foreignDialogOf(from: Element): HTMLElement | null {
  const dialog = from.closest<HTMLElement>('[role="dialog"],[role="alertdialog"]')
  return dialog && !dialog.closest("[data-base-ui-portal]") ? dialog : null
}

/** The host a layer opened from `from` portals into: an existing one around it, one made in its foreign dialog, or none. */
export function layerHostFor(from: Element | null | undefined): HTMLElement | null {
  if (!from || typeof document === "undefined") return null
  const existing = from.closest<HTMLElement>(`[${LAYER_HOST}]`)
  if (existing) return existing
  const dialog = foreignDialogOf(from)
  if (!dialog) return null
  const made = dialog.querySelector<HTMLElement>(`:scope > [${LAYER_HOST}]`)
  if (made) return made
  const host = document.createElement("div")
  host.setAttribute(LAYER_HOST, "")
  Object.assign(host.style, {
    position: "fixed",
    width: "100vw",
    height: "100vh",
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    padding: "0",
    border: "0",
    background: "transparent",
    overflow: "visible",
    pointerEvents: "none",
    // The top layer's popover styles set these; the host keeps the dialog's.
    right: "auto",
    bottom: "auto",
    color: "inherit",
    // Its own containing block, so the fixed layers inside it are placed against the viewport, not the dialog.
    transform: "translateZ(0)",
  })
  dialog.appendChild(host)
  const topLayer = typeof host.showPopover === "function"
  const clips = () => {
    const style = getComputedStyle(dialog)
    return style.overflowX !== "visible" || style.overflowY !== "visible"
  }
  const place = () => {
    // A dialog that clips would clip the host, and move it as it scrolls: the host goes to the top layer, where it is
    // placed against the viewport.
    if (topLayer && clips()) {
      if (!host.matches(":popover-open")) {
        host.popover = "manual"
        host.showPopover()
      }
      host.style.left = "0px"
      host.style.top = "0px"
      return
    }
    if (topLayer && host.hasAttribute("popover")) {
      if (host.matches(":popover-open")) host.hidePopover()
      host.removeAttribute("popover")
    }
    // The dialog's transform is the host's containing block: offset the host by the dialog's position so it covers the
    // viewport, and follow the dialog as it moves or animates in.
    const box = dialog.getBoundingClientRect()
    host.style.left = `${-box.left - dialog.clientLeft}px`
    host.style.top = `${-box.top - dialog.clientTop}px`
  }
  place()
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place)
  observer?.observe(dialog)
  window.addEventListener("resize", place)
  dialog.addEventListener("animationend", place)
  dialog.addEventListener("transitionend", place)
  hosts.set(host, {
    users: 0,
    stop: () => {
      observer?.disconnect()
      window.removeEventListener("resize", place)
      dialog.removeEventListener("animationend", place)
      dialog.removeEventListener("transitionend", place)
    },
  })
  return host
}

/** The layers of other libraries that can sit above a Candor layer and take Escape for themselves. */
const FOREIGN_LAYER = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'

/**
 * Whether Escape belongs to a layer of another library that is above Candor's: focus is in such a layer and that
 * layer doesn't hold a host in use (a dialog holding Candor's host is below Candor's layer).
 */
function foreignLayerAbove(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(`[${LAYER_HOST}]`)) return false
  const layer = target.closest(FOREIGN_LAYER)
  if (!layer || layer.closest("[data-base-ui-portal]")) return false
  for (const host of openHosts()) if (layer.contains(host)) return false
  return true
}

/**
 * The hosts holding a Candor layer that is open now. A layer whose portal stays mounted while it is closed (Base UI
 * keeps a select's list) still uses its host, but only an open one (`data-open`) claims Escape.
 */
function openHosts(): HTMLElement[] {
  return [...hosts].filter(([host, use]) => use.users > 0 && host.querySelector("[data-open]")).map(([host]) => host)
}

function claimEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || openHosts().length === 0 || foreignLayerAbove(event.target)) return
  event.preventDefault()
  claimed.add(event)
}

/** Open layers in hosts; while there are any, Candor claims Escape on the window's capture phase. */
const claims = { count: 0 }

/** Counts an open layer as its host's user, and starts claiming Escape. Answers how to stop. */
function enterHost(host: HTMLElement): () => void {
  const use = hosts.get(host)
  if (!use) return () => {}
  use.users += 1
  claims.count += 1
  if (claims.count === 1) window.addEventListener("keydown", claimEscape, true)
  return () => {
    use.users -= 1
    claims.count -= 1
    if (claims.count === 0) window.removeEventListener("keydown", claimEscape, true)
    // Once no open layer uses the host, it stops following its dialog and goes (after React has taken its portals out).
    queueMicrotask(() => {
      if (use.users > 0 || !hosts.has(host)) return
      use.stop()
      hosts.delete(host)
      host.remove()
    })
  }
}

/**
 * Mounted inside a layer's portal while the layer is open. In a host, it counts the layer as the host's user and
 * claims Escape on the window's capture phase, before another library's document listener sees it; when the layer
 * goes, it puts focus back on the trigger if the foreign dialog took it.
 */
function HostUse({ host, anchor }: { host: React.RefObject<HTMLElement | null>; anchor: React.RefObject<Element | null> | null }) {
  React.useEffect(() => {
    const used = host.current
    if (!used) return
    const leave = enterHost(used)
    return () => {
      leave()
      // Focus back on the trigger when the foreign dialog took it as the layer went: Radix moves focus to its dialog when
      // the focused element is removed, and in WebKit that can come after Base UI has given focus back.
      const dialog = used.parentElement
      setTimeout(() => {
        const to = anchor?.current
        const lost = document.activeElement === document.body || document.activeElement === dialog
        if (lost && to instanceof HTMLElement && to.isConnected && dialog?.contains(to)) to.focus()
      }, 0)
    }
  }, [host, anchor])
  return null
}

/**
 * The container a layer's portal is given: a ref that Base UI reads when the portal mounts, each time the layer opens,
 * and that answers the host for where it opened from (its anchor, else the focused element). `host` keeps the answer.
 */
function hostContainer(anchor: React.RefObject<Element | null> | null) {
  const host: { current: HTMLElement | null } = { current: null }
  const ref = {
    get current() {
      const from = anchor?.current?.isConnected ? anchor.current : typeof document === "undefined" ? null : document.activeElement
      host.current = layerHostFor(from)
      return host.current
    },
  } as React.RefObject<HTMLElement | null>
  return { host, ref }
}

/** A Base UI portal part (`Dialog.Portal`, `Popover.Portal`, …), which takes a container. */
type PortalPart<P> = React.ComponentType<P & { container?: React.RefObject<HTMLElement | null> | undefined; children?: React.ReactNode | undefined }>

/**
 * A layer's portal: Base UI's own (`portal`), into a host inside a foreign dialog when the layer opens from one, and
 * where Base UI puts it otherwise (`<body>`, or the portal of the Candor layer it opened from). Its other props go
 * to the portal.
 */
export function LayerPortal<P extends object>({
  portal: Portal,
  children,
  ...props
}: Omit<P, "container" | "children"> & {
  /** Base UI's portal part for this layer, such as `PopoverPrimitive.Portal`. */
  portal: PortalPart<P>
  children?: React.ReactNode | undefined
}) {
  const anchor = React.useContext(LayerAnchor)
  const [container] = React.useState(() => hostContainer(anchor))
  const part = { ...props, container: container.ref } as unknown as P & { container: React.RefObject<HTMLElement | null> }
  return (
    <Portal {...part}>
      <HostUse host={container.host} anchor={anchor} />
      {children}
    </Portal>
  )
}
