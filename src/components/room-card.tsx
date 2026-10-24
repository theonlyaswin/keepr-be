import { useState } from "react"
import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ImageOff,
  Maximize2,
  Mountain,
  Utensils,
} from "lucide-react"

import { Chip, Counter, money } from "@/components/primitives"
import type { RoomTypeAvailability } from "@/lib/api"
import {
  FONT_SETS,
  accentInk,
  alpha,
  hairline,
  inkColor,
  mutedColor,
  selectedTint,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * A room type and every way it can be bought.
 *
 * The hierarchy is the whole design here. A guest scanning a list of rooms is answering two
 * questions in order — *do I want this room* and *what does it cost* — so the photograph and
 * the name carry the top half, and the price is the largest thing in the bottom half, set
 * in the hotel's display face. Previously the price was rendered smaller than the room name
 * it belonged to, which quietly made the list harder to scan than a plain table.
 */

/** Board basis as an icon. Codes vary by hotel, so the text is matched loosely. */
function mealIcon(meal: string) {
  const m = meal.toLowerCase()
  if (/breakfast|^cp$|^bb$/.test(m)) return Coffee
  if (/lunch|dinner|full|all.?incl|^map$|^ap$/.test(m)) return Utensils
  return BedDouble
}

export function RoomCard({
  room,
  selections,
  onUnits,
  theme,
  currency,
  nights,
  index,
}: {
  room: RoomTypeAvailability
  selections: Record<string, number>
  onUnits: (ratePlanCode: string, next: number) => void
  theme: ThemeConfig
  currency: string
  nights: number
  index: number
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]
  const [showAllAmenities, setShowAllAmenities] = useState(false)

  // Rooms of a type are shared by its plans, so picking two on one plan leaves fewer for
  // the rest. The steppers cap against what is left, not against the type's total.
  const takenHere = room.rate_plans.reduce((sum, p) => sum + (selections[p.rate_plan_code] ?? 0), 0)
  const remaining = Math.max(room.units_available - takenHere, 0)
  const scarce = room.units_available > 0 && room.units_available <= 3

  const visibleAmenities = showAllAmenities ? room.amenities : room.amenities.slice(0, 5)
  const hiddenCount = room.amenities.length - visibleAmenities.length

  return (
    <article
      className="kp-rise overflow-hidden"
      style={{ ...(t.surface as React.CSSProperties), animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="flex flex-col sm:flex-row">
        <Gallery images={room.images} theme={theme} name={room.room_type_name} />

        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className="text-[21px] leading-tight"
                style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(theme) }}
              >
                {room.headline || room.room_type_name}
              </h3>
              <div
                className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
                style={{ color: mutedColor(theme) }}
              >
                {room.bed_type && (
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble className="size-3.5" /> {room.bed_type}
                  </span>
                )}
                {room.size_sqm && (
                  <span className="inline-flex items-center gap-1.5">
                    <Maximize2 className="size-3.5" /> {room.size_sqm} m²
                  </span>
                )}
                {room.view && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mountain className="size-3.5" /> {room.view}
                  </span>
                )}
              </div>
            </div>
            {room.highlight && (
              <div className="shrink-0">
                <Chip theme={theme} tone="accent">
                  {room.highlight}
                </Chip>
              </div>
            )}
          </div>

          {room.description && (
            <p
              className="mt-3 max-w-prose text-[14px] leading-relaxed"
              style={{ color: mutedColor(theme) }}
            >
              {room.description}
            </p>
          )}

          {room.amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {visibleAmenities.map((a) => (
                <Chip key={a} theme={theme}>
                  {a}
                </Chip>
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllAmenities(true)}
                  className="kp-button px-1 text-[12px] underline underline-offset-2"
                  style={{ color: mutedColor(theme) }}
                >
                  {hiddenCount} more
                </button>
              )}
            </div>
          )}

          {scarce && (
            <p className="mt-4 text-[13px]" style={{ color: accentInk(theme) }}>
              Only {room.units_available === 1 ? "one room" : `${room.units_available} rooms`} left
              for these dates
            </p>
          )}
        </div>
      </div>

      {/* the ways to buy this room */}
      <div>
        {room.rate_plans.map((plan) => {
          const units = selections[plan.rate_plan_code] ?? 0
          const chosen = units > 0
          const MealIcon = mealIcon(plan.meal_plan)

          return (
            <div
              key={plan.rate_plan_code}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors sm:px-6"
              style={{
                borderTop: `1px solid ${hairline(theme, chosen ? 2 : 1)}`,
                background: chosen ? selectedTint(theme) : "transparent",
                boxShadow: chosen ? `inset 3px 0 0 0 ${theme.primary_color}` : "none",
              }}
            >
              <div className="flex min-w-[9rem] flex-1 items-center gap-2.5">
                <MealIcon className="size-4 shrink-0" style={{ color: mutedColor(theme) }} />
                <span className="text-[15px]" style={{ color: inkColor(theme) }}>
                  {plan.rate_plan_name}
                </span>
              </div>

              <div className="text-right">
                <div
                  className="text-[22px] leading-none tabular-nums"
                  style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(theme) }}
                >
                  {money(plan.subtotal, currency)}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: mutedColor(theme) }}>
                  {money(plan.avg_nightly, currency)} a night · {nights} night
                  {nights === 1 ? "" : "s"}
                </div>
              </div>

              <Counter
                value={units}
                onChange={(next) => onUnits(plan.rate_plan_code, next)}
                min={0}
                max={units + remaining}
                theme={theme}
                label={plan.rate_plan_name}
                size="sm"
              />
            </div>
          )
        })}
      </div>
    </article>
  )
}

/**
 * The room's photographs.
 *
 * Only the first image was ever shown, so a hotel that uploaded five got credit for one.
 * Paging is manual — nothing advances on its own, because a carousel that moves while you
 * are reading the room description is an interruption, not a feature.
 */
function Gallery({
  images,
  theme,
  name,
}: {
  images: string[]
  theme: ThemeConfig
  name: string
}) {
  const [at, setAt] = useState(0)

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-[4/3] w-full shrink-0 items-center justify-center sm:aspect-auto sm:w-[15rem] lg:w-[17rem]"
        style={{
          background: `linear-gradient(140deg, ${alpha(theme.primary_color, 0.3)}, ${alpha(theme.accent_color, 0.5)})`,
        }}
      >
        <ImageOff className="size-7" style={{ color: alpha(theme.accent_color, 0.8) }} />
      </div>
    )
  }

  const many = images.length > 1
  const step = (delta: number) => setAt((i) => (i + delta + images.length) % images.length)

  return (
    <div className="group relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-[15rem] lg:w-[17rem]">
      <img
        src={images[at]}
        alt={`${name}, photo ${at + 1} of ${images.length}`}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />

      {many && (
        <>
          <GalleryArrow side="left" onClick={() => step(-1)} label="Previous photo" />
          <GalleryArrow side="right" onClick={() => step(1)} label="Next photo" />
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setAt(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === at}
                className="kp-button size-1.5 rounded-full transition-all"
                style={{
                  background: i === at ? "#fff" : "rgba(255,255,255,.45)",
                  width: i === at ? "1rem" : undefined,
                  border: "none",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Visible by default, and only hidden-until-hover on pointer devices. A touch screen has no
 * hover state, so arrows that wait for one are arrows a phone can never reach.
 */
function GalleryArrow({
  side,
  onClick,
  label,
}: {
  side: "left" | "right"
  onClick: () => void
  label: string
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`kp-button absolute top-1/2 ${side === "left" ? "left-2" : "right-2"} flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
      style={{
        background: "rgba(255,255,255,.92)",
        color: "#1a1a1a",
        border: "none",
        borderRadius: 9999,
        boxShadow: "0 2px 8px rgba(0,0,0,.2)",
      }}
    >
      <Icon className="size-4" />
    </button>
  )
}
