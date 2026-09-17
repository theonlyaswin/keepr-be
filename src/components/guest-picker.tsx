import { useRef, useState } from "react"
import { ChevronDown, Users } from "lucide-react"

import { AnchoredPanel } from "@/components/popover"
import { Counter, Rule, plural } from "@/components/primitives"
import { hairline, inkColor, mutedColor } from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

export interface Occupancy {
  adults: number
  children: number
  rooms: number
}

export function occupancyLabel({ adults, children, rooms }: Occupancy) {
  const guests = [plural(adults, "adult")]
  if (children > 0) guests.push(plural(children, "child", "children"))
  return `${guests.join(", ")} · ${plural(rooms, "room")}`
}

/**
 * Who is coming, as three steppers behind one summary line.
 *
 * The three native number inputs this replaces read as a form to fill in. A guest does not
 * think "adults: 2"; they think "two of us, one room". The trigger says that back to them
 * in those words, and the steppers underneath are the only way to change it — so the search
 * can never be sent an occupancy the hotel has no way to price.
 */
export function GuestPicker({
  value,
  onChange,
  theme,
  maxRooms = 10,
}: {
  value: Occupancy
  onChange: (next: Occupancy) => void
  theme: ThemeConfig
  maxRooms?: number
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

  return (
    <div ref={anchor}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="kp-button kp-cell flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left"
        style={{
          background: open ? `${theme.primary_color}12` : "transparent",
          border: "none",
          borderRadius: 0,
        }}
      >
        <span className="min-w-0 flex-1">
          <span
            className="mb-0.5 block text-[10px] tracking-[0.16em] uppercase"
            style={{ color: open ? theme.primary_color : mutedColor(theme) }}
          >
            Guests
          </span>
          <span className="block truncate text-[15px]" style={{ color: inkColor(theme) }}>
            {occupancyLabel(value)}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: mutedColor(theme) }}
        />
      </button>

      {open && (
        <AnchoredPanel
          theme={theme}
          anchor={anchor}
          onClose={() => setOpen(false)}
          align="end"
          className="w-[19rem] max-w-[calc(100vw-1.5rem)] p-4"
        >
          <Row
            theme={theme}
            title="Adults"
            hint="13 and over"
            value={value.adults}
            min={1}
            max={20}
            onChange={(adults) => onChange({ ...value, adults })}
          />
          <Rule theme={theme} className="my-3" />
          <Row
            theme={theme}
            title="Children"
            hint="12 and under"
            value={value.children}
            min={0}
            max={20}
            onChange={(children) => onChange({ ...value, children })}
          />
          <Rule theme={theme} className="my-3" />
          <Row
            theme={theme}
            title="Rooms"
            hint="How many to hold"
            value={value.rooms}
            min={1}
            max={maxRooms}
            onChange={(rooms) => onChange({ ...value, rooms })}
          />

          <p
            className="mt-4 flex items-start gap-2 pt-3 text-[12px] leading-relaxed"
            style={{ color: mutedColor(theme), borderTop: `1px solid ${hairline(theme, 1)}` }}
          >
            <Users className="mt-0.5 size-3.5 shrink-0" />
            Travelling with more than ten rooms? Contact the hotel and they will arrange it
            for you.
          </p>
        </AnchoredPanel>
      )}
    </div>
  )
}

function Row({
  theme,
  title,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  theme: ThemeConfig
  title: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px]" style={{ color: inkColor(theme) }}>
          {title}
        </div>
        <div className="text-[12px]" style={{ color: mutedColor(theme) }}>
          {hint}
        </div>
      </div>
      <Counter
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        theme={theme}
        label={title.toLowerCase()}
      />
    </div>
  )
}
