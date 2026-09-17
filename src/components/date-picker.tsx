import { useEffect, useRef, useState } from "react"
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns"
import { CalendarDays, MoveRight } from "lucide-react"
import { DayPicker, type DateRange } from "react-day-picker"

import { AnchoredPanel, useWide } from "@/components/popover"
import { hairline, inkColor, mutedColor } from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The guest-facing calendar.
 *
 * It runs on react-day-picker, the same engine behind the admin's shadcn Calendar, so both
 * apps behave identically — same keyboard handling, same month navigation, same
 * accessibility. What it does NOT share is the styling: the shadcn component paints itself
 * with the admin's design tokens (`bg-primary`, `text-accent-foreground`), which do not
 * exist here and would drop a Keepr-coloured widget onto a hotel's own branded page. Every
 * colour below comes from the hotel's theme instead.
 */

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function iso(date: Date) {
  return format(date, "yyyy-MM-dd")
}

/**
 * The hotel's colours, handed to react-day-picker.
 *
 * These go on the DayPicker root itself, not a wrapper. The library's own stylesheet
 * declares every one of them on `.rdp-root`, and a declaration on the element beats a value
 * inherited from its parent — so setting them one level up silently left the calendar
 * painting selected days in the library's default blue.
 */
function calendarVars(theme: ThemeConfig): React.CSSProperties {
  return {
    // react-day-picker reads these custom properties for its day cells
    ["--rdp-accent-color" as string]: theme.primary_color,
    ["--rdp-accent-background-color" as string]: `${theme.primary_color}1f`,
    ["--rdp-day-height" as string]: "2.5rem",
    ["--rdp-day-width" as string]: "2.5rem",
    ["--rdp-day_button-height" as string]: "2.25rem",
    ["--rdp-day_button-width" as string]: "2.25rem",
    ["--rdp-day_button-border-radius" as string]: `${Math.min(theme.radius, 10)}px`,
    ["--rdp-selected-border" as string]: "none",
    ["--rdp-range_middle-background-color" as string]: `${theme.primary_color}1f`,
    ["--rdp-range_middle-color" as string]: inkColor(theme),
    ["--rdp-today-color" as string]: theme.accent_color,
    ["--rdp-nav_button-height" as string]: "2rem",
    ["--rdp-nav_button-width" as string]: "2rem",
    ["--rdp-weekday-opacity" as string]: "1",
    ["--rdp-weekday-text-transform" as string]: "uppercase",
    color: inkColor(theme),
    fontSize: "0.875rem",
  }
}

// ---------------------------------------------------------------------------
// the stay: arrival and departure, chosen together
// ---------------------------------------------------------------------------

/**
 * Two cells and one calendar.
 *
 * A stay is one decision made of two dates, and a guest thinks about it that way: they know
 * roughly when they arrive and how long they are staying. So both cells open the same
 * calendar, the cell you clicked is the one the calendar is waiting on, and the nights
 * count is shown as it is being built rather than left to be worked out.
 *
 * Nothing is written back to the page until the range is complete. Opening the panel to
 * glance at a month and closing it again must not cost a guest the dates they already had.
 */
export function StayField({
  from,
  to,
  onChange,
  theme,
  minDate,
  maxDate,
  maxNights,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  theme: ThemeConfig
  minDate?: Date
  maxDate?: Date
  maxNights?: number
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<"from" | "to">("from")
  const [draft, setDraft] = useState<DateRange | undefined>()
  const wide = useWide()
  const anchor = useRef<HTMLDivElement>(null)

  // The draft is seeded from the page every time the panel opens, so an abandoned edit is
  // simply forgotten.
  useEffect(() => {
    if (open) setDraft(toDate(from) ? { from: toDate(from), to: toDate(to) } : undefined)
  }, [open, from, to])

  const start = draft?.from
  const end = draft?.to
  const nights = start && end ? differenceInCalendarDays(end, start) : 0

  function openAt(cell: "from" | "to") {
    setEditing(cell)
    setOpen(true)
  }

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      setDraft(undefined)
      setEditing("from")
      return
    }
    setDraft(range)
    if (range.to && differenceInCalendarDays(range.to, range.from) >= 1) {
      onChange(iso(range.from), iso(range.to))
      setOpen(false)
      setEditing("from")
    } else {
      setEditing("to")
    }
  }

  return (
    <div ref={anchor}>
      <div className="flex">
        <Cell
          theme={theme}
          label="Arrive"
          value={from ? format(parseISO(from), "EEE d MMM") : null}
          placeholder="Add a date"
          active={open && editing === "from"}
          onClick={() => openAt("from")}
        />
        <div className="shrink-0 self-stretch" style={{ borderLeft: `1px solid ${hairline(theme, 2)}` }} />
        <Cell
          theme={theme}
          label="Depart"
          value={to ? format(parseISO(to), "EEE d MMM") : null}
          placeholder="Add a date"
          active={open && editing === "to"}
          onClick={() => openAt("to")}
        />
      </div>

      {open && (
        <AnchoredPanel
          theme={theme}
          anchor={anchor}
          onClose={() => setOpen(false)}
          className="w-max max-w-[calc(100vw-1.5rem)] p-4"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[13px]" style={{ color: inkColor(theme) }}>
              {!start
                ? "Pick the day you arrive"
                : !end
                  ? "Now pick the day you leave"
                  : `${nights} night${nights === 1 ? "" : "s"}`}
            </span>
            {start && (
              <button
                type="button"
                onClick={() => {
                  setDraft(undefined)
                  setEditing("from")
                }}
                className="kp-button ml-auto text-[12px] underline-offset-2 hover:underline"
                style={{ color: mutedColor(theme) }}
              >
                Clear
              </button>
            )}
          </div>

          <DayPicker
            style={calendarVars(theme)}
            mode="range"
            // A hotel stay is at least one night, so `min` is 2 days end to end.
            min={2}
            max={maxNights ? maxNights + 1 : undefined}
            numberOfMonths={wide ? 2 : 1}
            selected={editing === "to" && start && !end ? { from: start, to: undefined } : draft}
            defaultMonth={start ?? minDate}
            excludeDisabled
            disabled={[{ before: minDate ?? new Date() }, ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={handleSelect}
          />
        </AnchoredPanel>
      )}
    </div>
  )
}

/** One half of the stay field: a stacked label and value that is entirely clickable. */
function Cell({
  theme,
  label,
  value,
  placeholder,
  active,
  onClick,
}: {
  theme: ThemeConfig
  label: string
  value: string | null
  placeholder: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="kp-button kp-cell min-w-0 flex-1 px-4 py-3 text-left"
      style={{
        background: active ? `${theme.primary_color}12` : "transparent",
        border: "none",
        borderRadius: 0,
      }}
    >
      <span
        className="mb-0.5 block text-[10px] tracking-[0.16em] uppercase"
        style={{ color: active ? theme.primary_color : mutedColor(theme) }}
      >
        {label}
      </span>
      <span
        className="block truncate text-[15px]"
        style={{ color: value ? inkColor(theme) : mutedColor(theme) }}
      >
        {value ?? placeholder}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// a single date, for things like a date of birth
// ---------------------------------------------------------------------------

export function SingleDatePicker({
  value,
  onChange,
  theme,
  placeholder = "Select a date",
  minDate,
  maxDate,
  captionLayout = "dropdown",
}: {
  value: string
  onChange: (next: string) => void
  theme: ThemeConfig
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  captionLayout?: "label" | "dropdown"
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const selected = toDate(value)

  return (
    <div ref={anchor}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="kp-field kp-button flex w-full items-center gap-2 text-left"
        style={{
          background: theme.dark_mode ? "rgba(255,255,255,.05)" : "#ffffff",
          border: `1px solid ${hairline(theme, 3)}`,
          borderRadius: Math.min(theme.radius, 12),
          color: selected ? inkColor(theme) : mutedColor(theme),
          padding: "0.7rem 0.85rem",
          fontSize: "0.9375rem",
          lineHeight: "1.4",
        }}
      >
        <CalendarDays className="size-4 shrink-0" style={{ color: mutedColor(theme) }} />
        <span className="truncate">{selected ? format(selected, "d MMM yyyy") : placeholder}</span>
      </button>

      {open && (
        <AnchoredPanel theme={theme} anchor={anchor} onClose={() => setOpen(false)} className="p-3">
          <DayPicker
            style={calendarVars(theme)}
            mode="single"
            selected={selected}
            defaultMonth={selected ?? maxDate}
            captionLayout={captionLayout}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return
              onChange(iso(date))
              setOpen(false)
            }}
          />
        </AnchoredPanel>
      )}
    </div>
  )
}

/** A compact read-only rendering of a chosen stay: `3 Sep → 5 Sep`. */
export function StayLabel({ from, to, theme }: { from: string; to: string; theme: ThemeConfig }) {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return null
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: inkColor(theme) }}>
      {format(a, "d MMM")}
      <MoveRight className="size-3.5" style={{ color: mutedColor(theme) }} />
      {format(b, "d MMM")}
    </span>
  )
}
