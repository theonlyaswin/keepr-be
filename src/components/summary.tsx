import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronDown, Loader2, MoveRight } from "lucide-react"

import { Eyebrow, money } from "@/components/primitives"
import type { Quote } from "@/lib/api"
import {
  FONT_SETS,
  accentInk,
  hairline,
  inkColor,
  mutedColor,
  popoverSurface,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * What the guest is buying, and what it costs.
 *
 * The one panel that has to be believed, so it is also the loudest thing on the page: the
 * total is set in the hotel's display face at the size a price deserves, not tucked into a
 * 14px row the way it was.
 */
export function StaySummary({
  quote,
  theme,
  pending,
  checkIn,
  checkOut,
  nights,
  occupancyLine,
  children,
}: {
  quote: Quote | undefined
  theme: ThemeConfig
  pending: boolean
  checkIn: string
  checkOut: string
  nights: number
  occupancyLine: string
  children?: React.ReactNode
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]
  const ink = inkColor(theme)
  const muted = mutedColor(theme)

  return (
    <div className="overflow-hidden" style={t.surface as React.CSSProperties}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow theme={theme}>Your stay</Eyebrow>
          {pending && (
            <Loader2 className="size-3.5 animate-spin" style={{ color: muted }} aria-label="Pricing" />
          )}
        </div>

        <div
          className="mt-2.5 flex items-center gap-2 text-[17px] leading-snug"
          style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
        >
          {format(parseISO(checkIn), "EEE d MMM")}
          <MoveRight className="size-4 shrink-0" style={{ color: muted }} />
          {format(parseISO(checkOut), "EEE d MMM")}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: muted }}>
          {nights} night{nights === 1 ? "" : "s"} · {occupancyLine}
        </div>
      </div>

      {!quote || quote.lines.length === 0 ? (
        <p
          className="px-5 pb-5 text-[13px] leading-relaxed"
          style={{ color: muted, borderTop: `1px solid ${hairline(theme, 1)}`, paddingTop: "1.25rem" }}
        >
          Choose a room and the price for your stay appears here, night by night.
        </p>
      ) : (
        <>
          <div style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}>
            {quote.lines.map((line) => (
              <LineRow key={line.rate_plan_code} line={line} currency={quote.currency} theme={theme} />
            ))}
          </div>

          <dl
            className="space-y-2 px-5 py-4 text-[13.5px]"
            style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}
          >
            <Money label="Room subtotal" value={money(quote.subtotal, quote.currency)} theme={theme} />
            {quote.discount > 0 && (
              <Money
                label={quote.coupon_code ? `Discount · ${quote.coupon_code}` : "Discount"}
                value={`−${money(quote.discount, quote.currency)}`}
                theme={theme}
                tone="accent"
              />
            )}
            <Money label="Taxes and fees" value={money(quote.tax, quote.currency)} theme={theme} />
          </dl>

          <div
            className="flex items-end justify-between gap-3 px-5 py-4"
            style={{ borderTop: `1px solid ${hairline(theme, 3)}` }}
          >
            <div>
              <Eyebrow theme={theme}>Total</Eyebrow>
              <div className="mt-0.5 text-[12px]" style={{ color: muted }}>
                All taxes included
              </div>
            </div>
            <div
              className="text-[30px] leading-none tabular-nums"
              style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
            >
              {money(quote.total, quote.currency)}
            </div>
          </div>
        </>
      )}

      {children && (
        <div className="space-y-2.5 p-5" style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * One chosen rate plan, with its nightly rates behind a disclosure.
 *
 * The per-night rates were already on the wire and thrown away — the old summary showed a
 * single sum for the stay. Rates move by the day, and a guest who cannot see why a two-night
 * stay costs what it does assumes the worst. So the nights are here, dated, adding up in
 * public. It stays collapsed because most guests only want the total; the ones who want the
 * arithmetic get it in one click.
 */
function LineRow({
  line,
  currency,
  theme,
}: {
  line: Quote["lines"][number]
  currency: string
  theme: ThemeConfig
}) {
  const [open, setOpen] = useState(false)
  const ink = inkColor(theme)
  const muted = mutedColor(theme)
  const canExpand = line.nights.length > 1

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px]" style={{ color: ink }}>
            {line.room_type_name}
            {line.units > 1 && <span style={{ color: muted }}> × {line.units}</span>}
          </div>
          <div className="text-[12px]" style={{ color: muted }}>
            {line.rate_plan_name}
          </div>
        </div>
        <div className="shrink-0 text-[14px] tabular-nums" style={{ color: ink }}>
          {money(line.subtotal, currency)}
        </div>
      </div>

      {canExpand && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="kp-button mt-1.5 inline-flex items-center gap-1 text-[12px]"
            style={{ color: muted, background: "transparent", border: "none", padding: 0 }}
          >
            <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide" : "See"} the {line.nights.length} nightly rates
          </button>

          {open && (
            <dl
              className="mt-2 space-y-1 pl-1 text-[12.5px]"
              style={{ borderLeft: `1px solid ${hairline(theme, 2)}` }}
            >
              {line.nights.map((night) => (
                <div key={night.day} className="flex justify-between gap-3 pl-3">
                  <dt style={{ color: muted }}>{format(parseISO(night.day), "EEE d MMM")}</dt>
                  <dd className="tabular-nums" style={{ color: ink }}>
                    {money(night.rate, currency)}
                  </dd>
                </div>
              ))}
              {line.units > 1 && (
                <div className="flex justify-between gap-3 pl-3" style={{ color: muted }}>
                  <dt>× {line.units} rooms</dt>
                  <dd />
                </div>
              )}
            </dl>
          )}
        </>
      )}
    </div>
  )
}

function Money({
  label,
  value,
  theme,
  tone = "normal",
}: {
  label: string
  value: string
  theme: ThemeConfig
  tone?: "normal" | "accent"
}) {
  const color = tone === "accent" ? accentInk(theme) : inkColor(theme)
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: tone === "accent" ? accentInk(theme) : mutedColor(theme) }}>{label}</dt>
      <dd className="tabular-nums" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

/**
 * The phone's version of the summary panel.
 *
 * On a narrow screen the sidebar falls below a long list of rooms, so a guest was choosing
 * rooms with no idea what they had spent and no visible way forward. This bar keeps the
 * total and the next step on screen, and opens the full breakdown when the total is tapped.
 */
export function MobileActionBar({
  theme,
  total,
  caption,
  onOpenSummary,
  children,
}: {
  theme: ThemeConfig
  total: string | null
  caption: string
  onOpenSummary: () => void
  children: React.ReactNode
}) {
  const fonts = FONT_SETS[theme.font_set]
  const t = tokensFor(theme)
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 py-3 lg:hidden"
      style={{
        ...(popoverSurface(theme) as React.CSSProperties),
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        onClick={onOpenSummary}
        className="kp-button min-w-0 flex-1 text-left"
        style={{ background: "transparent", border: "none", padding: 0 }}
      >
        <span
          className="block text-[20px] leading-none tabular-nums"
          style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(theme) }}
        >
          {total ?? "—"}
        </span>
        <span
          className="mt-1 flex items-center gap-1 text-[12px] underline-offset-2"
          style={{ color: mutedColor(theme) }}
        >
          {caption}
          <ChevronDown className="size-3 rotate-180" />
        </span>
      </button>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
