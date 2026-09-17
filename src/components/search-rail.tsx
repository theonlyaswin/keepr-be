import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { Clock, Loader2, Pencil, Search } from "lucide-react"

import { StayField, StayLabel } from "@/components/date-picker"
import { GuestPicker, occupancyLabel, type Occupancy } from "@/components/guest-picker"
import { Button, plural } from "@/components/primitives"
import type { PublicEngine } from "@/lib/api"
import { hairline, mutedColor, tokensFor } from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The search, as one object.
 *
 * Four separate labelled fields and a button used to sit in a grid that reflowed into
 * something different at every breakpoint. A stay is one thing a guest is describing, so it
 * is drawn as one panel divided into cells — the shape every travel site has taught them to
 * read — and it stays that shape from a phone to a desktop.
 */
export function SearchRail({
  engine,
  theme,
  checkIn,
  checkOut,
  onDates,
  occupancy,
  onOccupancy,
  onSearch,
  pending,
  disabled,
  label = "Search",
}: {
  engine: PublicEngine
  theme: ThemeConfig
  checkIn: string
  checkOut: string
  onDates: (from: string, to: string) => void
  occupancy: Occupancy
  onOccupancy: (next: Occupancy) => void
  onSearch: () => void
  pending: boolean
  disabled?: boolean
  label?: string
}) {
  const t = tokensFor(theme)

  return (
    <div>
      <div className="overflow-hidden" style={t.surface as React.CSSProperties}>
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="lg:flex-[1.6]">
            <StayField
              from={checkIn}
              to={checkOut}
              onChange={onDates}
              theme={theme}
              minDate={new Date()}
              maxDate={addDays(new Date(), engine.max_advance_days)}
              maxNights={engine.max_stay_nights}
            />
          </div>

          <div
            className="shrink-0 lg:hidden"
            style={{ borderTop: `1px solid ${hairline(theme, 2)}` }}
            aria-hidden
          />
          <div
            className="hidden shrink-0 lg:block"
            style={{ borderLeft: `1px solid ${hairline(theme, 2)}` }}
            aria-hidden
          />

          <div className="lg:flex-1">
            <GuestPicker value={occupancy} onChange={onOccupancy} theme={theme} />
          </div>

          <div className="p-2.5">
            <Button
              theme={theme}
              onClick={onSearch}
              disabled={pending || disabled || !checkIn || !checkOut}
              size="md"
              className="h-full w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {label}
            </Button>
          </div>
        </div>

        {/* The arrival terms sit inside the panel rather than under it. Below it they were
            bare text on the page ground — which on the glass style is the hotel's own
            photograph, where nothing small is readable. */}
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-[12.5px]"
          style={{ color: mutedColor(theme), borderTop: `1px solid ${hairline(theme, 1)}` }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" />
            Arrive from {engine.policies.check_in_time}, leave by {engine.policies.check_out_time}
          </span>
          <span>Stays of up to {plural(engine.max_stay_nights, "night")}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * The search once it has been made: one line of what was asked for, and a way back to it.
 *
 * Keeping the whole search panel on screen through the results made it compete with the
 * rooms for attention, and it is the rooms a guest came to look at. This states the stay in
 * a sentence and hands the space back.
 */
export function StayBar({
  theme,
  checkIn,
  checkOut,
  occupancy,
  onEdit,
}: {
  theme: ThemeConfig
  checkIn: string
  checkOut: string
  occupancy: Occupancy
  onEdit: () => void
}) {
  const nights =
    checkIn && checkOut ? differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)) : 0

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
      <StayLabel from={checkIn} to={checkOut} theme={theme} />
      <span style={{ color: mutedColor(theme) }}>
        {plural(nights, "night")} · {occupancyLabel(occupancy)}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="kp-button ml-auto inline-flex items-center gap-1.5 text-[13px] underline-offset-4 hover:underline"
        style={{ color: theme.primary_color, background: "transparent", border: "none", padding: 0 }}
      >
        <Pencil className="size-3.5" />
        Change
      </button>
    </div>
  )
}
