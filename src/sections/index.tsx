import {
  ArrowRight,
  Bath,
  BedDouble,
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ConciergeBell,
  CookingPot,
  Copy,
  Dumbbell,
  Eye,
  Flame,
  Images,
  Mail,
  MapPin,
  Maximize2,
  Minus,
  Mountain,
  Navigation,
  PawPrint,
  Phone,
  Plus,
  Quote,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Trees,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Waves,
  Wifi,
  Wine,
  X,
} from "lucide-react"
import { addDays, format } from "date-fns"
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react"
import { createPortal } from "react-dom"

import type { Occupancy } from "@/components/guest-picker"
import { Eyebrow, money, plural } from "@/components/primitives"
import { SearchRail } from "@/components/search-rail"
import type { PublicEngine, PublicSite, RoomTypeBrief, SiteSection } from "@/lib/api"
import {
  FONT_SETS,
  OVER_IMAGE,
  accentInk,
  alpha,
  hairline,
  inkColor,
  mutedColor,
  readableOn,
  selectedTint,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The hotel page, drawn from section data.
 *
 * Two rules hold every section together, and they are what make a page of mixed content
 * read as one design rather than a stack of widgets:
 *
 * 1. **One rhythm.** Every section is a `<Band>`: same max width, same vertical air, same
 *    eyebrow → headline → subhead heading block. Nothing sets its own margins.
 * 2. **Nothing invents colour.** Ink, muted ink, surfaces, buttons and chips all come from
 *    the shared theme tokens, so a hotel switching style or palette restyles the whole page
 *    and no section is left behind.
 *
 * A third keeps a young site from looking empty: every photograph the hotel has uploaded
 * anywhere — hero, gallery, rooms — goes into one pool, and decorative slots (the story, the
 * closing call to action) draw from it before falling back to a typographic layout. Slots
 * where a picture would be a claim, a room or a dish, never borrow.
 */

/** `data` is an open dict from the API, so every read goes through a narrowing helper. */
function str(data: Record<string, unknown>, key: string): string | null {
  const value = data[key]
  return typeof value === "string" && value.trim() ? value : null
}

function list(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = data[key]
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

function strings(data: Record<string, unknown>, key: string): string[] {
  const value = data[key]
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : []
}

type Icon = ComponentType<{ className?: string; style?: React.CSSProperties }>

const AMENITY_ICONS: [RegExp, Icon][] = [
  [/wi-?fi|internet/, Wifi],
  [/coffee|breakfast|tea/, Coffee],
  [/car|parking/, Car],
  [/utensils|restaurant|dining|food/, Utensils],
  [/pool|waves|swim/, Waves],
  [/gym|dumbbell|fitness/, Dumbbell],
  [/spa|sparkles|massage/, Sparkles],
  [/bath|tub|shower/, Bath],
  [/\bac\b|air|snowflake|cool/, Snowflake],
  [/service|concierge|reception|desk/, ConciergeBell],
  [/tv|television/, Tv],
  [/bar|wine|drinks/, Wine],
  [/laundry|shirt|ironing/, Shirt],
  [/pet|paw|dog/, PawPrint],
  [/garden|trees|lawn/, Trees],
  [/beach|umbrella/, Umbrella],
  [/mountain|trek|hill/, Mountain],
  [/fire|bonfire|flame/, Flame],
  [/kitchen|cooking/, CookingPot],
  [/shuttle|bus|transfer|pickup/, Bus],
  [/security|safe|cctv/, ShieldCheck],
]

function amenityIcon(...hints: (string | null | undefined)[]): Icon {
  for (const hint of hints) {
    if (!hint) continue
    const match = AMENITY_ICONS.find(([pattern]) => pattern.test(hint.toLowerCase()))
    if (match) return match[1]
  }
  return Sparkles
}

export interface StayQuery {
  checkIn: string
  checkOut: string
  occupancy: Occupancy
}

export interface SectionContext {
  site: PublicSite
  engine: PublicEngine | null
  theme: ThemeConfig
  /** Every photograph the hotel has uploaded anywhere, deduplicated, hero first. */
  images: string[]
  onBook: (stay?: StayQuery) => void
}

export function imagePool(site: PublicSite, engine: PublicEngine | null): string[] {
  const out: string[] = []
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim() && !out.includes(value)) out.push(value)
  }
  for (const s of site.sections) if (s.kind === "hero") push(s.data.image)
  push(engine?.hero_image)
  push(site.theme.background_image)
  for (const s of site.sections) {
    if (s.kind === "about") push(s.data.image)
    if (s.kind === "gallery") strings(s.data, "images").forEach(push)
  }
  engine?.room_types.forEach((room) => room.images?.forEach(push))
  return out
}

function heroImage(ctx: SectionContext, section?: SiteSection): string | null {
  const own = section ? str(section.data, "image") : null
  return own ?? ctx.engine?.hero_image ?? ctx.theme.background_image ?? ctx.images[0] ?? null
}

/** A decorative picture that is not the hero's, if the hotel has one to spare. */
function spareImage(ctx: SectionContext, from: "start" | "end"): string | null {
  const hero = heroImage(ctx)
  const others = ctx.images.filter((src) => src !== hero)
  if (others.length === 0) return null
  return from === "start" ? others[0] : others[others.length - 1]
}

export function mapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/**
 * Whether a section has anything to show.
 *
 * The renderer and the navigation both ask, so a menu never offers a link to a section that
 * quietly rendered nothing.
 */
export function hasContent(section: SiteSection, ctx: SectionContext): boolean {
  const d = section.data
  switch (section.kind) {
    case "rooms":
      return (ctx.engine?.room_types.length ?? 0) > 0
    case "offers":
      return (ctx.engine?.offers.length ?? 0) > 0
    case "gallery":
      return strings(d, "images").length > 0
    case "experiences":
      return list(d, "items").some((i) => typeof i.title === "string" && i.title)
    case "amenities":
      return list(d, "items").some((i) => typeof i.label === "string" && i.label)
    case "testimonials":
      return list(d, "items").some((i) => typeof i.quote === "string" && i.quote)
    case "faq":
      return list(d, "items").some((i) => typeof i.q === "string" && i.q)
    case "contact":
      return Boolean(str(d, "email") ?? ctx.site.property.email ?? str(d, "phone") ?? ctx.site.property.phone)
    default:
      return true
  }
}

// ---------------------------------------------------------------------------
// the shared shell every section sits in
// ---------------------------------------------------------------------------

/** Fades a block up the first time it scrolls into view, and never again. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`kp-reveal ${shown ? "is-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

function Band({
  section,
  children,
  tight,
}: {
  section: SiteSection
  children: React.ReactNode
  tight?: boolean
}) {
  return (
    <section
      id={section.id}
      className={`scroll-mt-20 px-5 sm:px-8 ${tight ? "py-10 sm:py-14" : "py-20 sm:py-28"}`}
    >
      <Reveal className="mx-auto w-full max-w-6xl">{children}</Reveal>
    </section>
  )
}

function display(ctx: SectionContext): React.CSSProperties {
  return {
    ...tokensFor(ctx.theme).heading,
    fontFamily: FONT_SETS[ctx.theme.font_set].display,
    color: inkColor(ctx.theme),
  }
}

/** Eyebrow, headline, optional subhead — the same three lines above every section. */
function Heading({
  section,
  ctx,
  fallback,
  center,
  action,
}: {
  section: SiteSection
  ctx: SectionContext
  fallback: string
  center?: boolean
  action?: React.ReactNode
}) {
  const eyebrow = str(section.data, "eyebrow")
  const subhead = str(section.data, "subhead")

  return (
    <div
      className={
        center
          ? "mx-auto max-w-2xl text-center"
          : "flex flex-wrap content-start items-end justify-between gap-x-10 gap-y-5"
      }
    >
      <div className={center ? "" : "max-w-2xl"}>
        {eyebrow && (
          <Eyebrow theme={ctx.theme} tone="accent" className="mb-4 flex items-center gap-3">
            {!center && <span className="h-px w-8" style={{ background: accentInk(ctx.theme) }} />}
            {eyebrow}
          </Eyebrow>
        )}
        <h2 className="text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.04]" style={display(ctx)}>
          {str(section.data, "headline") ?? fallback}
        </h2>
        {subhead && (
          <p
            className="mt-4 text-[16px] leading-relaxed sm:text-[17px]"
            style={{ color: mutedColor(ctx.theme) }}
          >
            {subhead}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

function PrimaryButton({
  ctx,
  children,
  onClick,
  size = "md",
}: {
  ctx: SectionContext
  children: React.ReactNode
  onClick: () => void
  size?: "md" | "lg"
}) {
  const t = tokensFor(ctx.theme)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kp-button inline-flex items-center gap-2 hover:-translate-y-px ${
        size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-[14px]"
      }`}
      style={t.button as React.CSSProperties}
    >
      {children}
    </button>
  )
}

function TextLink({
  ctx,
  children,
  href,
  onClick,
}: {
  ctx: SectionContext
  children: React.ReactNode
  href?: string
  onClick?: () => void
}) {
  const style = { color: inkColor(ctx.theme), borderBottom: `1px solid ${hairline(ctx.theme, 3)}` }
  const cls = "kp-button group inline-flex items-center gap-1.5 pb-1 text-[14px] font-medium"
  const inner = (
    <>
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} style={style}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={{ ...style, background: "none" }}>
      {inner}
    </button>
  )
}

/** The deep wash used wherever a photograph was expected and the hotel has none. */
function washGround(theme: ThemeConfig): React.CSSProperties {
  return {
    backgroundImage: `radial-gradient(120% 90% at 85% 10%, ${alpha(theme.accent_color, 0.55)} 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, ${alpha(
      theme.primary_color,
      0.6,
    )} 0%, transparent 60%)`,
    backgroundColor: theme.dark_mode ? "#110e09" : "#1f1912",
  }
}

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

function Hero({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  const image = heroImage(ctx, section)
  const center = str(section.data, "align") === "center"
  const eyebrow = str(section.data, "eyebrow")
  const subhead = str(section.data, "subhead")
  const engine = ctx.engine
  const searchable = ctx.site.booking_enabled && engine?.enabled

  const [checkIn, setCheckIn] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"))
  const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"))
  const [occupancy, setOccupancy] = useState<Occupancy>({ adults: 2, children: 0, rooms: 1 })

  return (
    <section id={section.id} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        {image ? (
          <>
            <img src={image} alt="" className="kp-drift h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, rgba(12,10,7,.55) 0%, rgba(12,10,7,${Math.max(
                  ctx.theme.background_overlay - 0.1,
                  0.18,
                )}) 30%, rgba(12,10,7,${Math.max(ctx.theme.background_overlay, 0.35)}) 62%, rgba(12,10,7,.82) 100%)`,
              }}
            />
          </>
        ) : (
          <div className="h-full w-full" style={washGround(ctx.theme)} />
        )}
      </div>

      <div
        className={`mx-auto mt-auto w-full max-w-6xl px-5 pt-36 pb-12 sm:px-8 sm:pb-16 ${
          center ? "text-center" : ""
        }`}
      >
        <div className="kp-rise">
          {eyebrow && (
            <div
              className={`mb-5 flex items-center gap-3 text-[11px] tracking-[0.24em] uppercase ${
                center ? "justify-center" : ""
              }`}
              style={{ color: OVER_IMAGE.muted }}
            >
              <MapPin className="size-3.5" />
              {eyebrow}
            </div>
          )}
          <h1
            className={`max-w-5xl text-[clamp(2.75rem,8.5vw,6.75rem)] leading-[0.94] ${center ? "mx-auto" : ""}`}
            style={{ ...t.heading, fontFamily: fonts.display, color: OVER_IMAGE.ink }}
          >
            {str(section.data, "headline") ?? ctx.site.property.name}
          </h1>
          {subhead && (
            <p
              className={`mt-6 max-w-xl text-[17px] leading-relaxed sm:text-lg ${center ? "mx-auto" : ""}`}
              style={{ color: "rgba(255,255,255,.86)" }}
            >
              {subhead}
            </p>
          )}
        </div>

        {searchable && engine ? (
          <div
            className={`kp-rise mt-10 max-w-4xl text-left sm:mt-12 ${center ? "mx-auto" : ""}`}
            style={{ animationDelay: "160ms" }}
          >
            <SearchRail
              engine={engine}
              theme={ctx.theme}
              checkIn={checkIn}
              checkOut={checkOut}
              onDates={(from, to) => {
                setCheckIn(from)
                setCheckOut(to)
              }}
              occupancy={occupancy}
              onOccupancy={setOccupancy}
              onSearch={() => ctx.onBook({ checkIn, checkOut, occupancy })}
              pending={false}
              label="Book now"
            />
          </div>
        ) : (
          ctx.site.booking_enabled && (
            <div className="kp-rise mt-10" style={{ animationDelay: "160ms" }}>
              <PrimaryButton ctx={ctx} size="lg" onClick={() => ctx.onBook()}>
                {str(section.data, "cta_label") ?? "Check availability"}
                <ArrowRight className="size-4" />
              </PrimaryButton>
            </div>
          )
        )}
      </div>

      <button
        type="button"
        aria-label="Scroll to content"
        onClick={() => window.scrollTo({ top: window.innerHeight - 64, behavior: "smooth" })}
        className="kp-button absolute bottom-5 left-1/2 hidden -translate-x-1/2 animate-bounce lg:block"
        style={{ color: OVER_IMAGE.muted, background: "none", border: "none" }}
      >
        <ChevronDown className="size-5" />
      </button>
    </section>
  )
}

/** The facts a guest scans before reading a word of prose. */
function Highlights({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const rooms = ctx.engine?.room_types ?? []

  const items = list(section.data, "items")
    .map((item) => {
      const label = typeof item.label === "string" ? item.label : ""
      let value = typeof item.value === "string" ? item.value : ""
      // the room count is ours to know, so it is filled in rather than typed by the hotel
      if (!value && /rooms?|suites?/i.test(label) && rooms.length) {
        value = String(rooms.reduce((n, r) => n + r.num_rooms, 0))
      }
      return { label, value, hint: typeof item.hint === "string" ? item.hint : "" }
    })
    .filter((item) => item.value)

  if (items.length === 0) return null
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[
    Math.min(items.length, 4) as 1 | 2 | 3 | 4
  ]

  return (
    <Band section={section} tight>
      {/* the gap between cells is painted with the hairline, so the dividers follow the grid
          at every breakpoint without each cell working out which of its edges to draw */}
      <div className="overflow-hidden" style={t.surface as React.CSSProperties}>
        <div className={`grid gap-px ${cols}`} style={{ background: hairline(ctx.theme, 1) }}>
        {items.map((item) => (
          <div key={item.label} className="px-7 py-8" style={{ background: t.surface.background }}>
            <div className="text-[clamp(1.75rem,3vw,2.5rem)] leading-none" style={display(ctx)}>
              {item.value}
            </div>
            <div className="mt-3 text-[14px] font-medium" style={{ color: inkColor(ctx.theme) }}>
              {item.label}
            </div>
            {item.hint && (
              <div className="mt-1 text-[12.5px]" style={{ color: mutedColor(ctx.theme) }}>
                {item.hint}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </Band>
  )
}

function About({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const image = str(section.data, "image") ?? spareImage(ctx, "start")
  const body = str(section.data, "body")
  const paragraphs = body ? body.split(/\n{2,}/) : []
  const place = [ctx.site.property.city, ctx.site.property.country].filter(Boolean).join(", ")

  if (!image) {
    // No picture to set beside it: the story carries the section on its own, set large.
    return (
      <Band section={section}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Heading section={section} ctx={ctx} fallback="About" />
          <div>
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={i === 0 ? "text-[clamp(1.25rem,2.2vw,1.6rem)] leading-[1.5]" : "mt-5 text-[17px] leading-[1.75]"}
                style={i === 0 ? display(ctx) : { color: mutedColor(ctx.theme) }}
              >
                {p}
              </p>
            ))}
            {place && (
              <div className="mt-8 flex items-center gap-2 text-[13px]" style={{ color: mutedColor(ctx.theme) }}>
                <MapPin className="size-3.5" style={{ color: accentInk(ctx.theme) }} />
                {place}
              </div>
            )}
          </div>
        </div>
      </Band>
    )
  }

  return (
    <Band section={section}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative order-last lg:order-first">
          {/* an offset frame in the accent: a hotel's photograph deserves a mount, not a box */}
          <div
            className="absolute -right-3 -bottom-3 hidden h-full w-full sm:block"
            style={{
              border: `1px solid ${alpha(ctx.theme.accent_color, 0.55)}`,
              borderRadius: t.surface.borderRadius,
            }}
            aria-hidden
          />
          <div className="kp-zoom relative overflow-hidden" style={{ borderRadius: t.surface.borderRadius }}>
            <img src={image} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[5/6]" />
          </div>
        </div>
        <div>
          <Heading section={section} ctx={ctx} fallback="About" />
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="mt-6 max-w-prose text-[17px] leading-[1.75]"
              style={{ color: mutedColor(ctx.theme) }}
            >
              {p}
            </p>
          ))}
          {ctx.site.booking_enabled && (
            <div className="mt-9">
              <TextLink ctx={ctx} onClick={() => ctx.onBook()}>
                Plan your stay
              </TextLink>
            </div>
          )}
        </div>
      </div>
    </Band>
  )
}

/** A room's photographs as a swipeable strip, with arrows for a pointer and dots for a count. */
function RoomPhotos({ room, ctx, tall }: { room: RoomTypeBrief; ctx: SectionContext; tall?: boolean }) {
  const images = room.images ?? []
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const aspect = tall ? "aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[26rem]" : "aspect-[4/3]"

  const go = (next: number) => {
    const node = track.current
    if (!node) return
    node.scrollTo({ left: node.clientWidth * next, behavior: "smooth" })
  }

  if (images.length === 0) {
    return (
      <div className={`relative flex items-center justify-center ${aspect}`} style={washGround(ctx.theme)}>
        <BedDouble className="size-10" style={{ color: "rgba(255,255,255,.55)" }} strokeWidth={1.25} />
      </div>
    )
  }

  return (
    <div className={`group/photos relative ${aspect}`}>
      <div
        ref={track}
        className="kp-snap absolute inset-0 flex overflow-x-auto"
        onScroll={(e) => {
          const node = e.currentTarget
          setIndex(Math.round(node.scrollLeft / Math.max(node.clientWidth, 1)))
        }}
      >
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${room.name}, photo ${i + 1}`}
            loading="lazy"
            className="h-full w-full shrink-0 object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          {[
            { dir: -1, Icon: ChevronLeft, side: "left-3", show: index > 0 },
            { dir: 1, Icon: ChevronRight, side: "right-3", show: index < images.length - 1 },
          ].map(({ dir, Icon: Arrow, side, show }) => (
            <button
              key={dir}
              type="button"
              aria-label={dir < 0 ? "Previous photo" : "Next photo"}
              onClick={() => go(index + dir)}
              className={`kp-button absolute top-1/2 ${side} hidden size-9 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/photos:opacity-100 focus-visible:opacity-100 md:flex ${
                show ? "" : "pointer-events-none !opacity-0"
              }`}
              style={{ background: "rgba(255,255,255,.92)", color: "#111", boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}
            >
              <Arrow className="size-4" />
            </button>
          ))}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <span
                key={src}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 16 : 6,
                  background: i === index ? "#fff" : "rgba(255,255,255,.55)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RoomCard({
  room,
  ctx,
  showPrice,
  wide,
}: {
  room: RoomTypeBrief
  ctx: SectionContext
  showPrice: boolean
  wide?: boolean
}) {
  const t = tokensFor(ctx.theme)
  const muted = mutedColor(ctx.theme)
  const facts: { icon: Icon; text: string }[] = [
    { icon: Users, text: `Sleeps ${room.occupancy}` },
    ...(room.bed_type ? [{ icon: BedDouble, text: room.bed_type }] : []),
    ...(room.size_sqm ? [{ icon: Maximize2, text: `${room.size_sqm} m²` }] : []),
    ...(room.view ? [{ icon: Eye, text: room.view }] : []),
  ]
  const amenities = room.amenities ?? []
  const subtitle = room.headline && room.headline !== room.name ? room.headline : null

  return (
    <article
      className={`flex h-full flex-col overflow-hidden ${wide ? "lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : ""}`}
      style={t.surface as React.CSSProperties}
    >
      <div className="relative">
        <RoomPhotos room={room} ctx={ctx} tall={wide} />
        {room.highlight && (
          <span
            className="absolute top-3 left-3 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase"
            style={{
              background: ctx.theme.accent_color,
              color: readableOn(ctx.theme.accent_color),
              borderRadius: 999,
            }}
          >
            {room.highlight}
          </span>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${wide ? "p-7 lg:p-10" : "p-6"}`}>
        <h3 className={`${wide ? "text-[28px]" : "text-[22px]"} leading-tight`} style={display(ctx)}>
          {room.name}
        </h3>
        {subtitle && (
          <p className="mt-1.5 text-[14px]" style={{ color: accentInk(ctx.theme) }}>
            {subtitle}
          </p>
        )}

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]" style={{ color: muted }}>
          {facts.map(({ icon: FactIcon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <FactIcon className="size-3.5 shrink-0" />
              {text}
            </li>
          ))}
        </ul>

        {room.description && (
          <p
            className={`mt-4 text-[14.5px] leading-relaxed ${wide ? "" : "line-clamp-3"}`}
            style={{ color: muted }}
          >
            {room.description}
          </p>
        )}

        {amenities.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {amenities.slice(0, wide ? 8 : 4).map((a) => {
              const AIcon = amenityIcon(a)
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px]"
                  style={t.chip as React.CSSProperties}
                >
                  <AIcon className="size-3" />
                  {a}
                </span>
              )
            })}
            {amenities.length > (wide ? 8 : 4) && (
              <span className="px-1.5 py-1 text-[12px]" style={{ color: muted }}>
                +{amenities.length - (wide ? 8 : 4)} more
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />
        <div
          className="mt-6 flex items-end justify-between gap-3 pt-5"
          style={{ borderTop: `1px solid ${hairline(ctx.theme, 1)}` }}
        >
          <div>
            {showPrice && room.base_rate > 0 ? (
              <>
                <div className="text-[11px] tracking-[0.14em] uppercase" style={{ color: muted }}>
                  From
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[26px] leading-none" style={display(ctx)}>
                    {money(room.base_rate, ctx.site.property.currency)}
                  </span>
                  <span className="text-[12px]" style={{ color: muted }}>
                    / night
                  </span>
                </div>
              </>
            ) : (
              <div className="text-[13px]" style={{ color: muted }}>
                {plural(room.num_rooms, "room")} of this type
              </div>
            )}
          </div>
          {ctx.site.booking_enabled && (
            <PrimaryButton ctx={ctx} onClick={() => ctx.onBook()}>
              Book
              <ArrowRight className="size-3.5" />
            </PrimaryButton>
          )}
        </div>
      </div>
    </article>
  )
}

function Rooms({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const rooms = ctx.engine?.room_types ?? []
  if (rooms.length === 0) return null
  const showPrice = section.data.show_prices !== false
  const single = rooms.length === 1

  return (
    <Band section={section}>
      <Heading
        section={section}
        ctx={ctx}
        fallback="Rooms"
        action={
          ctx.site.booking_enabled && !single ? (
            <TextLink ctx={ctx} onClick={() => ctx.onBook()}>
              Check availability
            </TextLink>
          ) : null
        }
      />
      <div
        className={`mt-12 grid gap-6 ${
          single ? "" : rooms.length === 2 || rooms.length === 4 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {rooms.map((room, i) => (
          <Reveal key={room.code} delay={(i % 3) * 90}>
            <RoomCard room={room} ctx={ctx} showPrice={showPrice} wide={single} />
          </Reveal>
        ))}
      </div>
    </Band>
  )
}

/** Dining, wellness, the walk to the viewpoint — anything with a picture and a story. */
function Experiences({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const items = list(section.data, "items").filter((i) => typeof i.title === "string" && i.title)
  if (items.length === 0) return null
  const radius = t.surface.borderRadius

  return (
    <Band section={section}>
      <Heading section={section} ctx={ctx} fallback="Experiences" />
      <div className={`mt-12 grid gap-5 ${items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {items.map((item, index) => {
          const image = typeof item.image === "string" && item.image ? item.image : null
          const blurb = typeof item.blurb === "string" ? item.blurb : null
          const number = String(index + 1).padStart(2, "0")

          return (
            <Reveal key={index} delay={(index % 3) * 90} className="h-full">
              {image ? (
                <article
                  className="kp-zoom relative flex aspect-[4/5] h-full flex-col justify-end overflow-hidden"
                  style={{ borderRadius: radius }}
                >
                  <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(10,8,5,.85) 0%, rgba(10,8,5,.25) 50%, transparent 75%)" }}
                  />
                  <div className="relative p-7">
                    <div className="text-[11px] tracking-[0.2em]" style={{ color: OVER_IMAGE.muted }}>
                      {number}
                    </div>
                    <h3
                      className="mt-2 text-[26px] leading-tight"
                      style={{ ...display(ctx), color: OVER_IMAGE.ink }}
                    >
                      {String(item.title)}
                    </h3>
                    {blurb && (
                      <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.82)" }}>
                        {blurb}
                      </p>
                    )}
                  </div>
                </article>
              ) : (
                <article className="flex h-full min-h-[18rem] flex-col p-8" style={t.surface as React.CSSProperties}>
                  <div className="text-[clamp(3rem,5vw,4rem)] leading-none" style={{ ...display(ctx), color: alpha(ctx.theme.accent_color, 0.85) }}>
                    {number}
                  </div>
                  <div className="mt-auto pt-10">
                    <h3 className="text-[24px] leading-tight" style={display(ctx)}>
                      {String(item.title)}
                    </h3>
                    {blurb && (
                      <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
                        {blurb}
                      </p>
                    )}
                  </div>
                </article>
              )}
            </Reveal>
          )
        })}
      </div>
    </Band>
  )
}

function Amenities({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const items = list(section.data, "items").filter((i) => typeof i.label === "string" && i.label)
  if (items.length === 0) return null

  return (
    <Band section={section}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
        <Heading section={section} ctx={ctx} fallback="Amenities" />
        <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          {items.map((item, index) => {
            const label = String(item.label)
            const AIcon = amenityIcon(typeof item.icon === "string" ? item.icon : null, label)
            return (
              <li
                key={index}
                className="flex items-center gap-3.5 py-4"
                style={{ borderTop: `1px solid ${hairline(ctx.theme, 2)}` }}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: selectedTint(ctx.theme), color: ctx.theme.primary_color }}
                >
                  <AIcon className="size-[18px]" />
                </span>
                <span className="text-[15px]" style={{ color: inkColor(ctx.theme) }}>
                  {label}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </Band>
  )
}

/** Full-screen photo viewer. Arrow keys step, Escape closes, the page underneath stays put. */
function Lightbox({
  images,
  start,
  onClose,
}: {
  images: string[]
  start: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(start)
  const step = useCallback(
    (dir: number) => setIndex((i) => (i + dir + images.length) % images.length),
    [images.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") step(1)
      if (e.key === "ArrowLeft") step(-1)
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose, step])

  const control = "kp-button flex size-11 items-center justify-center rounded-full text-white"
  const controlStyle = { background: "rgba(255,255,255,.12)" }

  return createPortal(
    <div
      className="kp-fade fixed inset-0 z-[70] flex flex-col"
      style={{ background: "rgba(8,7,5,.94)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-5 py-4 text-[13px] text-white/70">
        <span className="tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button type="button" aria-label="Close" className={control} style={controlStyle} onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-4 px-3 pb-8 sm:px-6">
        {images.length > 1 && (
          <button
            type="button"
            aria-label="Previous photo"
            className={`${control} hidden sm:flex`}
            style={controlStyle}
            onClick={(e) => {
              e.stopPropagation()
              step(-1)
            }}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <img
          key={images[index]}
          src={images[index]}
          alt={`Photo ${index + 1} of ${images.length}`}
          className="kp-fade max-h-full max-w-full rounded-md object-contain"
          onClick={(e) => {
            e.stopPropagation()
            if (images.length > 1) step(1)
          }}
        />
        {images.length > 1 && (
          <button
            type="button"
            aria-label="Next photo"
            className={`${control} hidden sm:flex`}
            style={controlStyle}
            onClick={(e) => {
              e.stopPropagation()
              step(1)
            }}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** A mosaic: the lead photograph spans a double cell, the rest tile around it. */
function Gallery({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const images = strings(section.data, "images")
  const [open, setOpen] = useState<number | null>(null)
  if (images.length === 0) return null
  const t = tokensFor(ctx.theme)
  const radius = t.surface.borderRadius
  const shown = images.slice(0, 5)
  const extra = images.length - shown.length

  const spans =
    shown.length === 1
      ? ["col-span-2 row-span-2 md:col-span-4"]
      : shown.length === 2
        ? ["col-span-2 row-span-2", "col-span-2 row-span-2"]
        : shown.length === 3
          ? ["col-span-2 row-span-2", "col-span-2 md:col-span-2", "col-span-2 md:col-span-2"]
          : shown.length === 4
            ? ["col-span-2 row-span-2", "col-span-2", "", ""]
            : ["col-span-2 row-span-2", "", "", "", ""]

  return (
    <Band section={section}>
      <Heading
        section={section}
        ctx={ctx}
        fallback="Gallery"
        action={
          images.length > 1 ? (
            <TextLink ctx={ctx} onClick={() => setOpen(0)}>
              View all {images.length} photos
            </TextLink>
          ) : null
        }
      />
      <div className="mt-12 grid auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] md:grid-cols-4 md:gap-4 lg:auto-rows-[15rem]">
        {shown.map((src, i) => {
          const last = i === shown.length - 1 && extra > 0
          return (
            <button
              key={src}
              type="button"
              onClick={() => setOpen(i)}
              className={`kp-zoom kp-button relative overflow-hidden ${spans[i] ?? ""}`}
              style={{ borderRadius: radius }}
              aria-label={`Open photo ${i + 1}`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              {last && (
                <span
                  className="absolute inset-0 flex items-center justify-center gap-2 text-[15px] font-medium text-white"
                  style={{ background: "rgba(10,8,5,.5)" }}
                >
                  <Images className="size-4" />+{extra} more
                </span>
              )}
            </button>
          )
        })}
      </div>
      {open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} />}
    </Band>
  )
}

function CouponCode({ code, ctx }: { code: string; ctx: SectionContext }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        })
      }}
      className="kp-button inline-flex items-center gap-2.5 px-3.5 py-2 text-[13px]"
      style={{
        border: `1px dashed ${alpha(ctx.theme.accent_color, 0.7)}`,
        borderRadius: 8,
        background: alpha(ctx.theme.accent_color, 0.08),
        color: inkColor(ctx.theme),
      }}
      aria-label={`Copy code ${code}`}
    >
      <span className="font-mono tracking-[0.08em]">{code}</span>
      {copied ? (
        <Check className="size-3.5" style={{ color: accentInk(ctx.theme) }} />
      ) : (
        <Copy className="size-3.5" style={{ color: mutedColor(ctx.theme) }} />
      )}
    </button>
  )
}

function Offers({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const offers = ctx.engine?.offers ?? []
  if (offers.length === 0) return null
  const t = tokensFor(ctx.theme)

  return (
    <Band section={section}>
      <Heading section={section} ctx={ctx} fallback="Offers" />
      <div className={`mt-12 grid gap-6 ${offers.length === 1 ? "" : offers.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {offers.map((offer, i) => (
          <Reveal key={offer.id} delay={(i % 3) * 90} className="h-full">
            <article className="flex h-full flex-col overflow-hidden" style={t.surface as React.CSSProperties}>
              {offer.image && (
                <div className="kp-zoom overflow-hidden">
                  <img src={offer.image} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-7">
                <Eyebrow theme={ctx.theme} tone="accent">
                  Book direct
                </Eyebrow>
                <h3 className="mt-2.5 text-[22px] leading-tight" style={display(ctx)}>
                  {offer.title}
                </h3>
                {offer.blurb && (
                  <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
                    {offer.blurb}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                  {offer.coupon_code ? <CouponCode code={offer.coupon_code} ctx={ctx} /> : <span />}
                  {ctx.site.booking_enabled && (
                    <TextLink ctx={ctx} onClick={() => ctx.onBook()}>
                      Book now
                    </TextLink>
                  )}
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Band>
  )
}

function Testimonials({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const items = list(section.data, "items").filter((i) => typeof i.quote === "string" && i.quote)
  if (items.length === 0) return null
  const t = tokensFor(ctx.theme)

  const author = (item: Record<string, unknown>) => (typeof item.author === "string" ? item.author : "")

  if (items.length === 1) {
    const item = items[0]
    return (
      <Band section={section}>
        <figure className="mx-auto max-w-4xl text-center">
          <Quote className="mx-auto size-9" style={{ color: accentInk(ctx.theme) }} strokeWidth={1.25} />
          <blockquote className="mt-7 text-[clamp(1.5rem,3.4vw,2.4rem)] leading-[1.3]" style={display(ctx)}>
            {String(item.quote)}
          </blockquote>
          {author(item) && (
            <figcaption className="mt-7 text-[13px] tracking-[0.14em] uppercase" style={{ color: mutedColor(ctx.theme) }}>
              {author(item)}
            </figcaption>
          )}
        </figure>
      </Band>
    )
  }

  return (
    <Band section={section}>
      <Heading section={section} ctx={ctx} fallback="What guests say" center />
      <div className={`mt-14 grid gap-6 ${items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {items.map((item, index) => {
          const name = author(item)
          return (
            <Reveal key={index} delay={(index % 3) * 90} className="h-full">
              <figure className="flex h-full flex-col p-8" style={t.surface as React.CSSProperties}>
                <Quote className="size-6" style={{ color: accentInk(ctx.theme) }} strokeWidth={1.5} />
                <blockquote className="mt-5 flex-1 text-[18px] leading-[1.55]" style={display(ctx)}>
                  {String(item.quote)}
                </blockquote>
                {name && (
                  <figcaption className="mt-7 flex items-center gap-3">
                    <span
                      className="flex size-9 items-center justify-center rounded-full text-[13px] font-semibold"
                      style={{ background: selectedTint(ctx.theme), color: ctx.theme.primary_color }}
                    >
                      {name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[13.5px]" style={{ color: inkColor(ctx.theme) }}>
                      {name}
                    </span>
                  </figcaption>
                )}
              </figure>
            </Reveal>
          )
        })}
      </div>
    </Band>
  )
}

function Location({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const address = str(section.data, "address") ?? ctx.site.property.address
  const map = str(section.data, "map_embed")
  const directions = str(section.data, "directions")
  const distances = list(section.data, "distances").filter((d) => typeof d.value === "string" && d.value)
  const place = [ctx.site.property.city, ctx.site.property.state, ctx.site.property.country]
    .filter(Boolean)
    .join(", ")
  const query = address ?? (place ? `${ctx.site.property.name}, ${place}` : null)
  const backdrop = map ? null : spareImage(ctx, "end")

  return (
    <Band section={section}>
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Heading section={section} ctx={ctx} fallback="Finding us" />
          {address && (
            <p className="mt-7 flex gap-3 text-[16px] leading-relaxed" style={{ color: inkColor(ctx.theme) }}>
              <MapPin className="mt-1 size-4 shrink-0" style={{ color: accentInk(ctx.theme) }} />
              <span>{address}</span>
            </p>
          )}
          {directions && (
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
              {directions}
            </p>
          )}
          {distances.length > 0 && (
            <dl className="mt-8">
              {distances.map((d, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-4 py-3.5"
                  style={{ borderTop: `1px solid ${hairline(ctx.theme, 2)}` }}
                >
                  <dt className="text-[14.5px]" style={{ color: mutedColor(ctx.theme) }}>
                    {typeof d.label === "string" ? d.label : ""}
                  </dt>
                  <dd className="text-[14.5px] tabular-nums" style={{ color: inkColor(ctx.theme) }}>
                    {String(d.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {query && (
            <div className="mt-8">
              <TextLink ctx={ctx} href={mapsLink(query)}>
                Get directions
              </TextLink>
            </div>
          )}
        </div>

        {map ? (
          <iframe
            src={map}
            title="Map"
            className="h-80 w-full border-0 lg:h-full lg:min-h-[26rem]"
            style={{ borderRadius: t.surface.borderRadius }}
            loading="lazy"
          />
        ) : (
          query && (
            <a
              href={mapsLink(query)}
              target="_blank"
              rel="noreferrer"
              className="kp-zoom group relative flex min-h-[20rem] items-end overflow-hidden lg:min-h-[26rem]"
              style={{ borderRadius: t.surface.borderRadius, ...(backdrop ? {} : washGround(ctx.theme)) }}
            >
              {backdrop && (
                <>
                  <img src={backdrop} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,8,5,.8), rgba(10,8,5,.1))" }} />
                </>
              )}
              <div className="relative flex w-full items-center gap-4 p-7">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,.95)", color: "#111" }}
                >
                  <Navigation className="size-5" />
                </span>
                <span>
                  <span className="block text-[18px] leading-tight" style={{ ...display(ctx), color: OVER_IMAGE.ink }}>
                    {ctx.site.property.name}
                  </span>
                  <span className="mt-1 block text-[13px]" style={{ color: OVER_IMAGE.muted }}>
                    Open in Google Maps
                  </span>
                </span>
                <ArrowRight
                  className="ml-auto size-5 transition-transform group-hover:translate-x-1"
                  style={{ color: OVER_IMAGE.ink }}
                />
              </div>
            </a>
          )
        )}
      </div>
    </Band>
  )
}

function Faq({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const items = list(section.data, "items").filter((i) => typeof i.q === "string" && i.q)
  const [open, setOpen] = useState<number | null>(0)
  if (items.length === 0) return null

  return (
    <Band section={section}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
        <Heading section={section} ctx={ctx} fallback="Before you book" />
        <div style={{ borderBottom: `1px solid ${hairline(ctx.theme, 2)}` }}>
          {items.map((item, index) => {
            const isOpen = open === index
            const panel = `${section.id}-faq-${index}`
            return (
              <div key={index} style={{ borderTop: `1px solid ${hairline(ctx.theme, 2)}` }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  className="kp-button flex w-full items-center gap-4 py-6 text-left"
                  style={{ background: "none" }}
                >
                  <span className="flex-1 text-[17px] leading-snug" style={{ color: inkColor(ctx.theme) }}>
                    {String(item.q)}
                  </span>
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                    style={{
                      background: isOpen ? selectedTint(ctx.theme) : "transparent",
                      border: `1px solid ${isOpen ? "transparent" : hairline(ctx.theme, 2)}`,
                      color: isOpen ? ctx.theme.primary_color : mutedColor(ctx.theme),
                    }}
                  >
                    {isOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                  </span>
                </button>
                <div
                  id={panel}
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    {typeof item.a === "string" && (
                      <p className="max-w-prose pr-12 pb-6 text-[15.5px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
                        {item.a}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Band>
  )
}

function Contact({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const email = str(section.data, "email") ?? ctx.site.property.email
  const phone = str(section.data, "phone") ?? ctx.site.property.phone
  if (!email && !phone) return null
  const t = tokensFor(ctx.theme)

  const cards = [
    ...(phone ? [{ icon: Phone, label: "Call us", value: phone, href: `tel:${phone.replace(/\s+/g, "")}` }] : []),
    ...(email ? [{ icon: Mail, label: "Write to us", value: email, href: `mailto:${email}` }] : []),
  ]

  return (
    <Band section={section}>
      <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Heading section={section} ctx={ctx} fallback="Get in touch" />
        <div className={`grid gap-4 ${cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {cards.map(({ icon: CIcon, label, value, href }) => (
            <a
              key={href}
              href={href}
              className="kp-button group flex items-center gap-4 p-5 hover:-translate-y-0.5"
              style={t.surface as React.CSSProperties}
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: selectedTint(ctx.theme), color: ctx.theme.primary_color }}
              >
                <CIcon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <Eyebrow theme={ctx.theme}>{label}</Eyebrow>
                <span className="mt-1 block truncate text-[15.5px]" style={{ color: inkColor(ctx.theme) }}>
                  {value}
                </span>
              </span>
              <ArrowRight
                className="ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: mutedColor(ctx.theme) }}
              />
            </a>
          ))}
        </div>
      </div>
    </Band>
  )
}

function Cta({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const image = spareImage(ctx, "end") ?? heroImage(ctx)
  const headline = str(section.data, "headline") ?? "Ready when you are"
  const subhead = str(section.data, "subhead")

  return (
    <Band section={section}>
      <div
        className="relative isolate overflow-hidden px-6 py-20 text-center sm:px-12 sm:py-28"
        style={{ borderRadius: t.surface.borderRadius, ...(image ? {} : washGround(ctx.theme)) }}
      >
        {image && (
          <>
            <img src={image} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10" style={{ background: "rgba(12,10,7,.55)" }} />
          </>
        )}
        <h2
          className="mx-auto max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02]"
          style={{ ...display(ctx), color: OVER_IMAGE.ink }}
        >
          {headline}
        </h2>
        {subhead && (
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,.84)" }}>
            {subhead}
          </p>
        )}
        {ctx.site.booking_enabled && (
          <div className="mt-10">
            <PrimaryButton ctx={ctx} size="lg" onClick={() => ctx.onBook()}>
              {str(section.data, "cta_label") ?? "Book now"}
              <ArrowRight className="size-4" />
            </PrimaryButton>
          </div>
        )}
      </div>
    </Band>
  )
}

// ---------------------------------------------------------------------------

const RENDERERS: Record<
  SiteSection["kind"],
  (props: { section: SiteSection; ctx: SectionContext }) => React.ReactElement | null
> = {
  hero: Hero,
  highlights: Highlights,
  about: About,
  rooms: Rooms,
  experiences: Experiences,
  amenities: Amenities,
  gallery: Gallery,
  offers: Offers,
  testimonials: Testimonials,
  location: Location,
  faq: Faq,
  contact: Contact,
  cta: Cta,
}

export function SectionRenderer({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const Component = RENDERERS[section.kind]
  // An unknown kind means the backend is ahead of this deploy. Skipping it is the only safe
  // answer — a half-rendered section on a hotel's homepage is worse than a missing one.
  if (!Component) return null
  return <Component section={section} ctx={ctx} />
}
