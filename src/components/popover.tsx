import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { popoverSurface } from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The floating panel behind the date and guest pickers.
 *
 * It renders into `document.body` rather than beside its trigger, which is not a detail.
 * The pickers live inside the search rail, and the rail is painted with the hotel's surface
 * token — which on the glass style carries a `backdrop-filter`. An element with a filter
 * becomes the containing block for its fixed descendants and clips them, so a panel
 * anchored the ordinary way would be positioned against the rail instead of the viewport on
 * exactly one of the five themes. A portal is the only version that behaves the same on all
 * five, and it also lets a panel escape a rail that is `overflow: hidden`.
 *
 * Position is measured from the trigger and clamped to the viewport, so a picker at the
 * right-hand end of the rail opens leftwards on a narrow screen instead of off the edge.
 */

const GAP = 8
const MARGIN = 12

const WIDE = "(min-width: 720px)"

/**
 * True when there is room for the two-month calendar.
 *
 * Read through `useSyncExternalStore` rather than a `useState` and a resize listener so the
 * first render already knows the answer — a one-month calendar that snaps to two after
 * mount is a visible jump on every open.
 */
export function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener("change", notify)
      return () => query.removeEventListener("change", notify)
    },
    () => window.matchMedia(WIDE).matches,
    () => true
  )
}

interface Placement {
  top: number
  left: number
  maxHeight: number
}

export function AnchoredPanel({
  theme,
  anchor,
  onClose,
  align = "start",
  children,
  className = "",
}: {
  theme: ThemeConfig
  anchor: React.RefObject<HTMLElement | null>
  onClose: () => void
  align?: "start" | "end"
  children: React.ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const measure = useCallback(() => {
    const trigger = anchor.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const rect = trigger.getBoundingClientRect()
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const { innerWidth: vw, innerHeight: vh } = window

    let left = align === "end" ? rect.right - width : rect.left
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - width - MARGIN))

    // Below the trigger by default; above it when there is no room below but there is above.
    let top = rect.bottom + GAP
    const fitsBelow = top + height <= vh - MARGIN
    const fitsAbove = rect.top - GAP - height >= MARGIN
    if (!fitsBelow && fitsAbove) top = rect.top - GAP - height

    setPlacement({ top, left, maxHeight: vh - top - MARGIN })
  }, [anchor, align])

  useLayoutEffect(measure, [measure, children])

  useEffect(() => {
    // `true` on the scroll listener catches scrolling inside any ancestor, not just the page.
    window.addEventListener("scroll", measure, true)
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("scroll", measure, true)
      window.removeEventListener("resize", measure)
    }
  }, [measure])

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchor.current?.contains(target)) return
      onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panelRef}
      className={`kp-pop ${className}`}
      style={{
        ...(popoverSurface(theme) as React.CSSProperties),
        position: "fixed",
        zIndex: 60,
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        maxHeight: placement?.maxHeight,
        overflowY: "auto",
        // Hidden for the one frame between mounting and being measured, so it is never
        // painted in the top-left corner first.
        visibility: placement ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  )
}
