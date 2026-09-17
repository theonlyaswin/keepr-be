import { ArrowLeft, Check } from "lucide-react"
import { Link } from "react-router-dom"

import { Eyebrow } from "@/components/primitives"
import type { PublicEngine } from "@/lib/api"
import {
  FONT_SETS,
  OVER_IMAGE,
  accentInk,
  alpha,
  hairline,
  inkColor,
  mutedColor,
  popoverSurface,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

export type Step = "search" | "results" | "checkout" | "payment" | "done"

export const STEPS: { key: Step; label: string }[] = [
  { key: "search", label: "Dates" },
  { key: "results", label: "Rooms" },
  { key: "checkout", label: "Details" },
  { key: "payment", label: "Payment" },
  { key: "done", label: "Confirmed" },
]

/**
 * The hotel, at the top of the page it sent you to.
 *
 * The engine already fetches a hero image, a logo and a tagline, and the old page rendered
 * none of them — a guest crossed from a full-bleed photograph on the hotel's site to a bare
 * form and had to take it on trust that they were still in the right place. This is the same
 * photograph, the same display face, the same scrim as the site's own hero, so the two pages
 * read as one journey.
 *
 * It only opens full height on the first step. Once a guest is choosing rooms the picture
 * has done its job and gets out of the way.
 */
export function Masthead({
  engine,
  theme,
  backHref,
}: {
  engine: PublicEngine
  theme: ThemeConfig
  backHref: string
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]
  const image = engine.hero_image ?? theme.background_image

  const ground = image
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(12,10,7,.30) 0%, rgba(12,10,7,${Math.max(
          theme.background_overlay,
          0.42
        )}) 55%, rgba(12,10,7,.80) 100%), url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        // No photograph: a deep ground washed with the hotel's own two colours, rather than
        // a flat grey. Matches the fallback the marketing hero uses.
        backgroundImage: `linear-gradient(150deg, ${alpha(theme.accent_color, 0.5)} 0%, ${alpha(
          theme.primary_color,
          0.28
        )} 58%, rgba(0,0,0,0) 100%)`,
        backgroundColor: theme.dark_mode ? "#15120c" : "#241d15",
      }

  return (
    <header
      className="relative flex min-h-[clamp(19rem,42vh,26rem)] flex-col px-5 pt-5 pb-16 sm:px-8 sm:pb-20"
      style={ground}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        {engine.logo ? (
          <img src={engine.logo} alt={engine.display_name} className="max-h-9 w-auto object-contain" />
        ) : (
          <span
            className="truncate text-[15px] text-white"
            style={{ ...t.heading, fontFamily: fonts.display }}
          >
            {engine.display_name}
          </span>
        )}
        <Link
          to={backHref}
          className="kp-button ml-auto inline-flex shrink-0 items-center gap-1.5 text-[13px]"
          style={{ color: OVER_IMAGE.muted }}
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Back to the hotel</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>

      <div className="mx-auto mt-auto w-full max-w-6xl pt-14">
        <Eyebrow theme={theme} tone="over-image">
          Reservations
        </Eyebrow>
        <h1
          className="mt-3 max-w-3xl text-[clamp(2rem,6vw,3.25rem)] leading-[1.03] text-white"
          style={{ ...t.heading, fontFamily: fonts.display }}
        >
          {engine.display_name}
        </h1>
        {engine.tagline && (
          <p
            className="mt-3 max-w-xl text-[15px] leading-relaxed sm:text-base"
            style={{ color: OVER_IMAGE.muted }}
          >
            {engine.tagline}
          </p>
        )}
      </div>
    </header>
  )
}

/**
 * The masthead once the picture has stepped aside: a sticky rule carrying the hotel, the
 * way back, and how far through the guest is.
 */
export function StickyBar({
  engine,
  theme,
  backHref,
  step,
}: {
  engine: PublicEngine
  theme: ThemeConfig
  backHref: string
  step: Step
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]

  return (
    <div
      className="sticky top-0 z-30 px-5 py-3 sm:px-8"
      style={{
        ...(popoverSurface(theme) as React.CSSProperties),
        borderRadius: 0,
        border: "none",
        borderBottom: `1px solid ${hairline(theme, 2)}`,
        boxShadow: "none",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        <Link
          to={backHref}
          className="kp-button inline-flex min-w-0 items-center gap-2"
          style={{ color: inkColor(theme) }}
        >
          <ArrowLeft className="size-4 shrink-0" style={{ color: mutedColor(theme) }} />
          {engine.logo ? (
            <img src={engine.logo} alt={engine.display_name} className="max-h-7 w-auto object-contain" />
          ) : (
            <span className="truncate text-[15px]" style={{ ...t.heading, fontFamily: fonts.display }}>
              {engine.display_name}
            </span>
          )}
        </Link>
        <div className="ml-auto min-w-0">
          <StepRail step={step} theme={theme} />
        </div>
      </div>
    </div>
  )
}

/**
 * How far through the booking a guest is.
 *
 * The four 20px circles this replaces were decoration: too small to read, and joined by
 * interpuncts that carried nothing. A filled track is the honest shape for progress, and
 * naming the step you are on matters more than numbering the ones you are not.
 */
export function StepRail({ step, theme }: { step: Step; theme: ThemeConfig }) {
  const index = STEPS.findIndex((s) => s.key === step)
  const current = STEPS[index]

  return (
    <nav aria-label="Booking progress">
      {/* the phone has no room for four labels, so it gets the one that is true right now */}
      <p className="text-[12px] sm:hidden" style={{ color: mutedColor(theme) }}>
        Step {index + 1} of {STEPS.length} ·{" "}
        <span style={{ color: inkColor(theme) }}>{current.label}</span>
      </p>

      <ol className="hidden items-end gap-2 sm:flex">
        {STEPS.map((s, i) => {
          const done = i < index
          const active = i === index
          return (
            <li key={s.key} className="w-[5.5rem]" aria-current={active ? "step" : undefined}>
              <div
                className="mb-1.5 flex items-center gap-1 text-[10.5px] tracking-[0.14em] uppercase"
                style={{ color: active ? inkColor(theme) : mutedColor(theme) }}
              >
                {done && <Check className="size-3" style={{ color: accentInk(theme) }} />}
                {s.label}
              </div>
              <div
                className="h-[3px] w-full transition-colors"
                style={{
                  background: done
                    ? alpha(theme.primary_color, 0.45)
                    : active
                      ? theme.primary_color
                      : hairline(theme, 2),
                }}
              />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
