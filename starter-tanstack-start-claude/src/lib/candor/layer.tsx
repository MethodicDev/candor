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
 *                inside the dialog for its focus trap and outside click, but drawn over the viewport, unclipped.
 *   raising      A layer of another library opened from inside such a host (the app's Radix menu in a Candor dialog)
 *                portals to `<body>`, or to a container of the app's own, which the top layer is drawn over. While a
 *                host is in the top layer, each layer of another library added anywhere in `<body>` (outside other
 *                layers) is shown in the top layer too, above the host, with the styles the top layer's popover rules
 *                changed put back as they were. A host shown in the top layer again after it was lowered puts the
 *                layers raised before it back above it.
 *   Tab          Base UI's modal popups keep Tab inside with focus guards placed just outside the popup, which move
 *                focus back in on the next animation frame, so for that frame focus sits on a guard outside the dialog
 *                (KIT-83, Base UI 1.9.0's FloatingFocusManager). `wrapTab` on a modal popup's keydown moves focus from
 *                its last stop to its first (and back with Shift) in the same task, so a guard is never reached.
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

/** What can take focus with Tab: Base UI's focus guards, removed controls and hidden ones are left out below. */
const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, summary, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"], [tabindex]'

/** The stops Tab visits in `root`, in order: tabbable, enabled, shown and not a Base UI focus guard. */
function tabStops(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hasAttribute("data-base-ui-focus-guard") &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest("[inert]") &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden" &&
      // One radio of a group is a stop: the checked one, else the first.
      !(el instanceof HTMLInputElement && el.type === "radio" && el.name && !el.checked && root.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`))
  )
}

/**
 * On a modal popup's `onKeyDown`: Tab from its last stop goes to its first, and Shift+Tab from its first (or from the
 * popup itself) to its last, in the same task. Base UI's own wrap goes through a focus guard outside the popup and a
 * frame later; this one never leaves the popup. Keys from a layer opened inside it (portalled elsewhere in the DOM) are
 * left to that layer.
 */
export function wrapTab(event: React.KeyboardEvent<HTMLElement>) {
  // Option+Tab is how Safari reaches every control, so Alt is let through.
  if (event.key !== "Tab" || event.defaultPrevented || event.ctrlKey || event.metaKey) return
  const popup = event.currentTarget
  const from = event.target as Node
  if (!popup.contains(from)) return
  const stops = tabStops(popup)
  const first = stops[0]
  const last = stops[stops.length - 1]
  const to = !first ? popup : event.shiftKey ? (from === first || from === popup ? last : undefined) : from === last ? first : undefined
  if (!to) return
  event.preventDefault()
  // A foreign dialog around it (Radix's focus scope) would wrap to its own first stop: the popup's wrap is the one.
  event.stopPropagation()
  to.focus()
}

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

/** How many dialog-family roots (Dialog, Sheet, Drawer, AlertDialog) are around this point of the tree. */
const DialogDepth = React.createContext(0)
/** Whether the nearest dialog-family root around this point is modal (`modal` true, Base UI's default). */
const DialogModal = React.createContext(true)

/**
 * Gives `LayerPortal`s below the element their layer opened from (`useLayerRoot`'s `anchor`), and, for a dialog-family
 * root, tells the dialogs inside it that they are nested (`useNestedDialog`).
 */
export function LayerRoot({
  anchor,
  dialog = false,
  modal = true,
  children,
}: {
  /** The ref `useLayerRoot` returns as `anchor`: the trigger the layer last opened from, or the event's target. */
  anchor: React.RefObject<Element | null>
  /** The root is a dialog's, a sheet's, a drawer's or an alert dialog's, so a dialog opened inside it is nested. */
  dialog?: boolean | undefined
  /**
   * The dialog root's `modal`, when `dialog`: only a modal one (true, the default) blocks the page outside it, so only
   * a modal nested dialog draws the backdrop that catches an outside click.
   */
  modal?: boolean | "trap-focus" | undefined
  /** The layer's root and its parts. */
  children?: React.ReactNode | undefined
}) {
  const depth = React.useContext(DialogDepth)
  const outerModal = React.useContext(DialogModal)
  return (
    <DialogDepth.Provider value={dialog ? depth + 1 : depth}>
      <DialogModal.Provider value={dialog ? modal === true : outerModal}>
        <LayerAnchor.Provider value={anchor}>{children}</LayerAnchor.Provider>
      </DialogModal.Provider>
    </DialogDepth.Provider>
  )
}

/**
 * Whether the dialog whose parts call this is a modal one opened inside another dialog, sheet, drawer or alert dialog.
 * Base UI draws no backdrop for a nested dialog, so a click outside it lands on the outer one's backdrop and closes
 * neither (KIT-45); the nested one draws a transparent backdrop of its own (`nestedBackdrop`), which takes the click and
 * closes it alone, as Radix and the APG dialog pattern do. A nested dialog with `modal={false}` or `"trap-focus"`
 * leaves the page outside it usable, so it is false there: a backdrop would catch the clicks meant for the outer one.
 */
export function useNestedDialog(): boolean {
  const depth = React.useContext(DialogDepth)
  const modal = React.useContext(DialogModal)
  return depth > 1 && modal
}

/**
 * The props for a dialog-family overlay: for a nested dialog (`useNestedDialog`), Base UI's `forceRender` and a
 * transparent background, so the outer dialog's backdrop still dims the page once and an outside click closes only the
 * innermost dialog; else nothing.
 */
export function nestedBackdrop(nested: boolean): { forceRender?: boolean | undefined; className?: string | undefined } {
  return nested ? { forceRender: true, className: "bg-transparent" } : {}
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
  const lower = () => {
    if (host.matches(":popover-open")) host.hidePopover()
    host.removeAttribute("popover")
    raiseAbove(host, false)
  }
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
        raiseAbove(host, true)
        // Shown again after it was lowered: the layers raised while it was up were opened above it, so they go back on top.
        reraise()
      }
      host.style.left = "0px"
      host.style.top = "0px"
      return
    }
    if (topLayer && host.hasAttribute("popover")) lower()
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
      raiseAbove(host, false)
      observer?.disconnect()
      window.removeEventListener("resize", place)
      dialog.removeEventListener("animationend", place)
      dialog.removeEventListener("transitionend", place)
    },
  })
  return host
}

/**
 * Hosts in the top layer now, what watches `<body>` for other libraries' layers while there are any, and the layers it
 * raised (in the order they were raised).
 */
const raising = { hosts: new Set<HTMLElement>(), watcher: null as MutationObserver | null, raised: new Set<HTMLElement>() }

/** Counts a host in or out of the top layer; while one is in it, other libraries' new layers are raised above it. */
function raiseAbove(host: HTMLElement, inTopLayer: boolean) {
  if (inTopLayer) raising.hosts.add(host)
  else raising.hosts.delete(host)
  if (raising.hosts.size > 0 && !raising.watcher && typeof MutationObserver !== "undefined") {
    raising.watcher = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && isPortalled(node) && isForeignLayer(node)) raise(node)
    })
    // The whole of <body>: an app can portal its layers into a container of its own, not only into <body>.
    raising.watcher.observe(document.body, { childList: true, subtree: true })
  } else if (raising.hosts.size === 0 && raising.watcher) {
    raising.watcher.disconnect()
    raising.watcher = null
    // Kept while they are open: a host shown in the top layer again puts them back above it.
    for (const el of raising.raised) if (!el.isConnected || !el.matches(":popover-open")) raising.raised.delete(el)
  }
}

/**
 * Whether an element just added somewhere in `<body>` stands where a portal puts a layer: in `<body>` itself, or in a
 * container of the app's that isn't inside a layer (another library's, one already in the top layer, a Candor host or
 * Base UI's portal). Content a layer draws inside itself, and anything inside the dialog that holds a host, is left alone.
 */
function isPortalled(el: HTMLElement): boolean {
  const parent = el.parentElement
  if (!parent) return false
  if (parent === document.body) return true
  if (parent.closest(`${FOREIGN_LAYER},[data-state],[popover],[${LAYER_HOST}],[data-base-ui-portal]`)) return false
  for (const host of raising.hosts) if (host.parentElement?.contains(el)) return false
  return true
}

/**
 * Whether an element just added to `<body>` is a layer of another library: one of its dialogs, menus, lists or popper
 * wrappers, or a part Radix marks open or closed that a portal puts over the page (a dialog's overlay: in `<body>`
 * itself, or fixed to the viewport in the app's own container). A part marked open or closed elsewhere, such as a
 * tooltip's trigger the page shows behind a dialog, is the page's own and isn't raised. Base UI's portals, Candor's
 * hosts and anything already a popover are left alone.
 */
function isForeignLayer(el: HTMLElement): boolean {
  if (el.hasAttribute(LAYER_HOST) || el.hasAttribute("popover") || el.closest("[data-base-ui-portal]")) return false
  if (el.matches(FOREIGN_LAYER) || el.querySelector(FOREIGN_LAYER) !== null) return true
  return el.hasAttribute("data-state") && (el.parentElement === document.body || getComputedStyle(el).position === "fixed")
}

/** What the top layer's popover rules set (inset, size, margin, border, padding, overflow, colours, position). */
const POPOVER_STYLES = [
  "position",
  ...["top", "right", "bottom", "left", "width", "height"],
  ...["top", "right", "bottom", "left"].flatMap((side) => [`margin-${side}`, `padding-${side}`, `border-${side}-style`, `border-${side}-width`, `border-${side}-color`]),
  "overflow-x",
  "overflow-y",
  "color",
  "background-color",
]
/** Of those, the ones a stylesheet sets as lengths that the browser reports resolved: put back as `auto`. */
const SIZED = new Set(["top", "right", "bottom", "left", "width", "height"])

/**
 * Shows another library's layer in the top layer, above the hosts there, as a manual popover. Every style the popover
 * rules changed is put back as it was (the library's own and the app's styles win over those rules where they set a
 * value; what they leave unset would otherwise turn into the popover's border, padding and inset). It leaves the top
 * layer when the library removes it.
 */
function raise(el: HTMLElement) {
  if (typeof el.showPopover !== "function") return
  const before = getComputedStyle(el)
  const was = POPOVER_STYLES.map((name) => before.getPropertyValue(name))
  el.setAttribute("popover", "manual")
  try {
    el.showPopover()
  } catch {
    el.removeAttribute("popover")
    return
  }
  const now = getComputedStyle(el)
  POPOVER_STYLES.forEach((name, i) => {
    if (now.getPropertyValue(name) !== was[i]) el.style.setProperty(name, SIZED.has(name) ? "auto" : was[i]!)
  })
  raising.raised.add(el)
}

/**
 * Puts the layers raised earlier, and still open, back on top of the top layer in the order they were raised: a host
 * shown again was drawn above them. Focus inside one stays where it was.
 */
function reraise() {
  for (const el of [...raising.raised]) {
    if (!el.isConnected || !el.matches(":popover-open")) {
      raising.raised.delete(el)
      continue
    }
    const focused = document.activeElement
    el.hidePopover()
    el.showPopover()
    if (focused instanceof HTMLElement && el.contains(focused) && document.activeElement !== focused) focused.focus({ preventScroll: true })
  }
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
    // The ref is read here, not in the cleanup: the trigger the layer opened from, which the cleanup gives focus back to.
    const trigger = anchor?.current
    if (!used) return
    const leave = enterHost(used)
    return () => {
      leave()
      // Focus back on the trigger when the foreign dialog took it as the layer went: Radix moves focus to its dialog when
      // the focused element is removed, and in WebKit that can come after Base UI has given focus back.
      const dialog = used.parentElement
      setTimeout(() => {
        const to = trigger
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
