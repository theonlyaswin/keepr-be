import { ChevronDown, Minus, Plus } from "lucide-react"

import {
  FONT_SETS,
  accentInk,
  fieldStyle,
  hairline,
  inkColor,
  mutedColor,
  readableOn,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The small parts every screen of the booking flow is built from.
 *
 * They exist so the flow speaks with one voice. The old page set a font size and a colour at
 * each call site and drifted: labels were 11px in one panel and 12px in the next, and
 * dividers were written four different ways. Here a label is a label everywhere.
 */

/** An 11px letterspaced eyebrow — the device the marketing sections use above a headline. */
export function Eyebrow({
  children,
  theme,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode
  theme: ThemeConfig
  tone?: "muted" | "accent" | "over-image"
  className?: string
}) {
  const color =
    tone === "accent"
      ? accentInk(theme)
      : tone === "over-image"
        ? "rgba(255,255,255,.72)"
        : mutedColor(theme)
  return (
    <div className={`text-[11px] tracking-[0.16em] uppercase ${className}`} style={{ color }}>
      {children}
    </div>
  )
}

/** A panel heading, set in the hotel's display face. */
export function PanelTitle({
  children,
  theme,
  className = "",
}: {
  children: React.ReactNode
  theme: ThemeConfig
  className?: string
}) {
  const t = tokensFor(theme)
  return (
    <h2
      className={`text-[19px] leading-tight ${className}`}
      style={{ ...t.heading, fontFamily: FONT_SETS[theme.font_set].display, color: inkColor(theme) }}
    >
      {children}
    </h2>
  )
}

/**
 * A labelled field.
 *
 * The label is a real `<label>` wrapping its control, so a tap anywhere on the words focuses
 * the input — which matters far more on a phone than it reads on a spec.
 */
export function Field({
  label,
  hint,
  required,
  children,
  theme,
  className = "",
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  theme: ThemeConfig
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1.5">
        <Eyebrow theme={theme}>{label}</Eyebrow>
        {required && (
          <span className="text-[13px] leading-none" style={{ color: accentInk(theme) }} aria-hidden>
            •
          </span>
        )}
        {hint && (
          <span className="text-[11px]" style={{ color: mutedColor(theme) }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

/** A text input carrying the theme's field surface and a focus ring in the hotel's colour. */
export function Input({
  theme,
  mono,
  style,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { theme: ThemeConfig; mono?: boolean }) {
  return (
    <input
      {...props}
      className={`kp-field ${className}`}
      style={{
        ...(fieldStyle(theme) as React.CSSProperties),
        ...(mono
          ? { fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: "0.04em" }
          : null),
        ...style,
      }}
    />
  )
}

export function Textarea({
  theme,
  style,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { theme: ThemeConfig }) {
  return (
    <textarea
      {...props}
      className={`kp-field ${className}`}
      style={{ ...(fieldStyle(theme) as React.CSSProperties), resize: "vertical", ...style }}
    />
  )
}

/**
 * A select, with its chevron drawn rather than inherited.
 *
 * The native arrow differs on every platform and none of them match the lucide icons used
 * everywhere else in the flow, so `appearance: none` takes it away and one is rendered in
 * its place. It has to be a real element: the field surface sets the `background`
 * shorthand inline, which would wipe out any arrow painted as a background image.
 */
export function Select({
  theme,
  style,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { theme: ThemeConfig }) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={`kp-field ${className}`}
        style={{
          ...(fieldStyle(theme) as React.CSSProperties),
          appearance: "none",
          paddingRight: "2.4rem",
          ...style,
        }}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        style={{ color: mutedColor(theme) }}
        aria-hidden
      />
    </span>
  )
}

/** The one button in the flow. `tone` decides how loud it is, never which colour it invents. */
export function Button({
  theme,
  tone = "primary",
  size = "md",
  style,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  theme: ThemeConfig
  tone?: "primary" | "quiet" | "ghost"
  size?: "sm" | "md" | "lg"
}) {
  const t = tokensFor(theme)
  const pad = { sm: "0.5rem 0.9rem", md: "0.7rem 1.3rem", lg: "0.9rem 1.5rem" }[size]
  const font = { sm: "0.8125rem", md: "0.9375rem", lg: "1rem" }[size]

  const skin: React.CSSProperties =
    tone === "primary"
      ? (t.button as React.CSSProperties)
      : tone === "quiet"
        ? {
            background: "transparent",
            border: `1px solid ${hairline(theme, 3)}`,
            borderRadius: (t.button.borderRadius as number | string) ?? 8,
            color: inkColor(theme),
            fontWeight: 500,
          }
        : {
            background: "transparent",
            border: "none",
            color: mutedColor(theme),
            fontWeight: 500,
          }

  return (
    <button
      {...props}
      className={`kp-button inline-flex items-center justify-center gap-2 ${className}`}
      style={{ ...skin, padding: tone === "ghost" ? "0.4rem 0.2rem" : pad, fontSize: font, ...style }}
    >
      {children}
    </button>
  )
}

/**
 * Minus / count / plus.
 *
 * A native number input was doing this job. It gives a phone the wrong keyboard, draws
 * spinner arrows too small to hit, and lets someone type `47` into a field that means
 * adults. A stepper can only produce a number the hotel is able to honour.
 */
export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  theme,
  label,
  size = "md",
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  theme: ThemeConfig
  label: string
  size?: "sm" | "md"
}) {
  const t = tokensFor(theme)
  const box = size === "sm" ? "size-8" : "size-9"
  const icon = size === "sm" ? "size-3.5" : "size-4"

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(value - 1, min))}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
        className={`kp-button flex ${box} shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30`}
        style={t.chip as React.CSSProperties}
      >
        <Minus className={icon} />
      </button>
      <span
        className="w-8 text-center text-[15px] tabular-nums"
        style={{ color: inkColor(theme) }}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(value + 1, max))}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className={`kp-button flex ${box} shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30`}
        style={t.chip as React.CSSProperties}
      >
        <Plus className={icon} />
      </button>
    </div>
  )
}

/** A quiet tag: an amenity, a bed type, a badge. */
export function Chip({
  children,
  theme,
  tone = "quiet",
}: {
  children: React.ReactNode
  theme: ThemeConfig
  tone?: "quiet" | "accent"
}) {
  const t = tokensFor(theme)
  if (tone === "accent") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] tracking-[0.08em] uppercase"
        style={{
          background: theme.accent_color,
          // the fill is the hotel's; the text on it is whichever of black or white can be read
          color: readableOn(theme.accent_color),
          borderRadius: t.chip.borderRadius,
          border: t.chip.border,
          fontWeight: 600,
        }}
      >
        {children}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
      style={t.chip as React.CSSProperties}
    >
      {children}
    </span>
  )
}

/** A horizontal rule that matches whatever the hotel's style does to borders. */
export function Rule({ theme, className = "" }: { theme: ThemeConfig; className?: string }) {
  return <div className={className} style={{ borderTop: `1px solid ${hairline(theme, 2)}` }} />
}

export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
