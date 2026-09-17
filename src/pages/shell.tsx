import { Loader2, SearchX } from "lucide-react"

/**
 * The two states every public page can land in before it knows which hotel it is.
 *
 * Neither can use the hotel's theme, because the request that would tell us the theme is
 * the one that is still in flight or has just failed. So they are deliberately quiet and
 * neutral — a warm off-white that sits comfortably in front of any of the five styles
 * rather than a cool grey that clashes with three of them.
 */

const GROUND = "#faf9f7"
const INK = "#1c1a17"
const MUTED = "#7a746a"

export function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: GROUND }}
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="size-5 animate-spin" style={{ color: MUTED }} />
    </div>
  )
}

export function NotFound({ message }: { message?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: GROUND }}
    >
      <SearchX className="size-7" style={{ color: MUTED }} />
      <h1 className="text-[22px] leading-tight" style={{ color: INK }}>
        Nothing here
      </h1>
      <p className="max-w-sm text-[14px] leading-relaxed" style={{ color: MUTED }}>
        {message ?? "This address does not belong to a published hotel site."}
      </p>
    </div>
  )
}
