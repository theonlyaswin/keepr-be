import {
  ArrowRight,
  Bath,
  Car,
  Coffee,
  ConciergeBell,
  Dumbbell,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  Snowflake,
  Sparkles,
  Utensils,
  Waves,
  Wifi,
} from "lucide-react"
import { useState, type ComponentType } from "react"

import type { PublicEngine, PublicSite, RoomTypeBrief, SiteSection } from "@/lib/api"
import { FONT_SETS, inkColor, mutedColor, tokensFor } from "@shared/theme"
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
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

const AMENITY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  coffee: Coffee,
  car: Car,
  utensils: Utensils,
  pool: Waves,
  waves: Waves,
  gym: Dumbbell,
  dumbbell: Dumbbell,
  spa: Sparkles,
  bath: Bath,
  ac: Snowflake,
  service: ConciergeBell,
}

function amenityIcon(name: string | null) {
  if (!name) return Sparkles
  return AMENITY_ICONS[name.toLowerCase()] ?? Sparkles
}

export interface SectionContext {
  site: PublicSite
  engine: PublicEngine | null
  theme: ThemeConfig
  onBook: () => void
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// the shared shell every section sits in
// ---------------------------------------------------------------------------

function Band({
  ctx,
  children,
  tight,
}: {
  ctx: SectionContext
  children: React.ReactNode
  tight?: boolean
}) {
  return (
    <section className={tight ? "px-6 py-10 sm:py-12" : "px-6 py-16 sm:py-24"}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
      <span className="sr-only">{ctx.site.slug}</span>
    </section>
  )
}

/** Eyebrow, headline, optional subhead — the same three lines above every section. */
function Heading({
  section,
  ctx,
  fallback,
  center,
}: {
  section: SiteSection
  ctx: SectionContext
  fallback: string
  center?: boolean
}) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  const eyebrow = str(section.data, "eyebrow")
  const subhead = str(section.data, "subhead")

  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <div
          className="mb-3 text-[11px] tracking-[0.18em] uppercase"
          style={{ color: ctx.theme.accent_color }}
        >
          {eyebrow}
        </div>
      )}
      <h2
        className="text-3xl leading-[1.05] sm:text-4xl"
        style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
      >
        {str(section.data, "headline") ?? fallback}
      </h2>
      {subhead && (
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
          {subhead}
        </p>
      )}
    </div>
  )
}

function PillButton({
  ctx,
  children,
  onClick,
}: {
  ctx: SectionContext
  children: React.ReactNode
  onClick: () => void
}) {
  const t = tokensFor(ctx.theme)
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-6 py-3 text-[15px] transition-transform hover:-translate-y-px"
      style={t.button}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

function Hero({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  const image = str(section.data, "image") ?? ctx.engine?.hero_image ?? ctx.theme.background_image
  const overlay = `rgba(12,10,7,${Math.max(ctx.theme.background_overlay, 0.34)})`

  return (
    <section
      className="relative flex min-h-[86vh] items-end px-6 pt-28 pb-16"
      style={
        image
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(12,10,7,.28) 0%, ${overlay} 60%, rgba(12,10,7,.72) 100%), url(${image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: ctx.theme.dark_mode ? "#15120c" : "#241d15" }
      }
    >
      <div className="mx-auto w-full max-w-6xl">
        {str(section.data, "eyebrow") && (
          <div className="mb-4 text-[11px] tracking-[0.22em] text-white/75 uppercase">
            {str(section.data, "eyebrow")}
          </div>
        )}
        <h1
          className="max-w-4xl text-[13vw] leading-[0.95] text-white sm:text-6xl lg:text-7xl"
          style={{ ...t.heading, fontFamily: fonts.display }}
        >
          {str(section.data, "headline") ?? ctx.site.property.name}
        </h1>
        {str(section.data, "subhead") && (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            {str(section.data, "subhead")}
          </p>
        )}
        {ctx.site.booking_enabled && (
          <div className="mt-9">
            <PillButton ctx={ctx} onClick={ctx.onBook}>
              {str(section.data, "cta_label") ?? "Check availability"}
              <ArrowRight className="size-4" />
            </PillButton>
          </div>
        )}
      </div>
    </section>
  )
}

/** The facts a guest scans before reading a word of prose. */
function Highlights({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
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

  return (
    <Band ctx={ctx} tight>
      <div className="grid gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-4" style={t.surface}>
        {items.map((item) => (
          <div key={item.label} className="px-6 py-7">
            <div
              className="text-2xl leading-none sm:text-3xl"
              style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
            >
              {item.value}
            </div>
            <div className="mt-2 text-[13px]" style={{ color: inkColor(ctx.theme) }}>
              {item.label}
            </div>
            {item.hint && (
              <div className="mt-0.5 text-[11px]" style={{ color: mutedColor(ctx.theme) }}>
                {item.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </Band>
  )
}

function About({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const image = str(section.data, "image")
  return (
    <Band ctx={ctx}>
      <div className={`grid items-center gap-12 ${image ? "lg:grid-cols-2" : ""}`}>
        <div>
          <Heading section={section} ctx={ctx} fallback="About" />
          {str(section.data, "body") && (
            <p
              className="mt-6 max-w-prose text-[17px] leading-[1.7]"
              style={{ color: mutedColor(ctx.theme) }}
            >
              {str(section.data, "body")}
            </p>
          )}
        </div>
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-[26rem] w-full object-cover"
            style={{ borderRadius: t.surface.borderRadius }}
          />
        )}
      </div>
    </Band>
  )
}

function RoomCard({ room, ctx }: { room: RoomTypeBrief; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  return (
    <div className="flex flex-col overflow-hidden" style={t.surface}>
      <div
        className="h-44 w-full"
        style={{
          background: `linear-gradient(135deg, ${ctx.theme.primary_color}1f, ${ctx.theme.accent_color}3d)`,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div
          className="text-xl leading-tight"
          style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
        >
          {room.name}
        </div>
        <div className="mt-1.5 text-[13px]" style={{ color: mutedColor(ctx.theme) }}>
          Sleeps {room.occupancy} · {room.num_rooms} available
        </div>

        <div className="mt-6 flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="text-[11px] tracking-wide uppercase" style={{ color: mutedColor(ctx.theme) }}>
              From
            </div>
            <div
              className="text-2xl leading-none"
              style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
            >
              {money(room.base_rate, ctx.site.property.currency)}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: mutedColor(ctx.theme) }}>
              per night
            </div>
          </div>
          {ctx.site.booking_enabled && (
            <button
              onClick={ctx.onBook}
              className="shrink-0 px-5 py-2.5 text-[13px] transition-transform hover:-translate-y-px"
              style={t.button}
            >
              Book
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Rooms({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const rooms = ctx.engine?.room_types ?? []
  if (rooms.length === 0) return null
  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="Rooms" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <RoomCard key={room.code} room={room} ctx={ctx} />
        ))}
      </div>
    </Band>
  )
}

/** Dining, wellness, the walk to the viewpoint — anything with a picture and a story. */
function Experiences({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  const items = list(section.data, "items").filter((i) => typeof i.title === "string" && i.title)
  if (items.length === 0) return null

  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="Experiences" />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((item, index) => {
          const image = typeof item.image === "string" ? item.image : null
          return (
            <article key={index} className="overflow-hidden" style={t.surface}>
              {image ? (
                <img src={image} alt="" loading="lazy" className="h-56 w-full object-cover" />
              ) : (
                <div
                  className="h-56 w-full"
                  style={{
                    background: `linear-gradient(150deg, ${ctx.theme.accent_color}2e, ${ctx.theme.primary_color}1a)`,
                  }}
                />
              )}
              <div className="p-6">
                <h3
                  className="text-lg leading-tight"
                  style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
                >
                  {String(item.title)}
                </h3>
                {typeof item.blurb === "string" && item.blurb && (
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
                    {item.blurb}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </Band>
  )
}

function Amenities({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const items = list(section.data, "items")
  if (items.length === 0) return null
  const t = tokensFor(ctx.theme)
  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="Amenities" />
      <div className="mt-10 flex flex-wrap gap-2.5">
        {items.map((item, index) => {
          const Icon = amenityIcon(typeof item.icon === "string" ? item.icon : null)
          return (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px]"
              style={t.chip}
            >
              <Icon className="size-4" />
              {typeof item.label === "string" ? item.label : ""}
            </span>
          )
        })}
      </div>
    </Band>
  )
}

/** First image large, the rest quartered beside it — a spread rather than a grid of squares. */
function Gallery({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const images = strings(section.data, "images")
  if (images.length === 0) return null
  const t = tokensFor(ctx.theme)
  const [lead, ...rest] = images
  const radius = t.surface.borderRadius

  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="Gallery" />
      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <img
          src={lead}
          alt=""
          loading="lazy"
          className="h-64 w-full object-cover lg:h-[32rem]"
          style={{ borderRadius: radius }}
        />
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {rest.slice(0, 4).map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                className="h-40 w-full object-cover lg:h-[15.5rem]"
                style={{ borderRadius: radius }}
              />
            ))}
          </div>
        )}
      </div>
    </Band>
  )
}

function Offers({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const offers = ctx.engine?.offers ?? []
  if (offers.length === 0) return null
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="Offers" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <div key={offer.id} className="flex flex-col p-7" style={t.surface}>
            <div
              className="text-xl leading-tight"
              style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
            >
              {offer.title}
            </div>
            {offer.blurb && (
              <p className="mt-2.5 flex-1 text-[14px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
                {offer.blurb}
              </p>
            )}
            {offer.coupon_code && (
              <div className="mt-5">
                <span className="px-3 py-1.5 font-mono text-xs" style={t.chip}>
                  {offer.coupon_code}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Band>
  )
}

function Testimonials({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const items = list(section.data, "items").filter((i) => typeof i.quote === "string" && i.quote)
  if (items.length === 0) return null
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  return (
    <Band ctx={ctx}>
      <Heading section={section} ctx={ctx} fallback="What guests say" center />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((item, index) => (
          <figure key={index} className="p-7" style={t.surface}>
            <blockquote
              className="text-[17px] leading-[1.6]"
              style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
            >
              “{String(item.quote)}”
            </blockquote>
            <figcaption className="mt-4 text-[12px]" style={{ color: mutedColor(ctx.theme) }}>
              {typeof item.author === "string" ? item.author : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </Band>
  )
}

function Location({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const address = str(section.data, "address") ?? ctx.site.property.address
  const map = str(section.data, "map_embed")
  const distances = list(section.data, "distances").filter(
    (d) => typeof d.value === "string" && d.value
  )

  return (
    <Band ctx={ctx}>
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <Heading section={section} ctx={ctx} fallback="Finding us" />
          {address && (
            <p
              className="mt-6 flex gap-2.5 text-[15px] leading-relaxed"
              style={{ color: inkColor(ctx.theme) }}
            >
              <MapPin className="mt-1 size-4 shrink-0" style={{ color: ctx.theme.accent_color }} />
              <span>{address}</span>
            </p>
          )}
          {str(section.data, "directions") && (
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: mutedColor(ctx.theme) }}>
              {str(section.data, "directions")}
            </p>
          )}
          {distances.length > 0 && (
            <dl className="mt-8 space-y-0">
              {distances.map((d, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-4 py-3"
                  style={{ borderTop: `1px solid ${mutedColor(ctx.theme)}22` }}
                >
                  <dt className="text-[14px]" style={{ color: mutedColor(ctx.theme) }}>
                    {typeof d.label === "string" ? d.label : ""}
                  </dt>
                  <dd className="text-[14px] tabular-nums" style={{ color: inkColor(ctx.theme) }}>
                    {String(d.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {map && (
          <iframe
            src={map}
            title="Map"
            className="h-80 w-full border-0 lg:h-full lg:min-h-[22rem]"
            style={{ borderRadius: t.surface.borderRadius }}
            loading="lazy"
          />
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
    <Band ctx={ctx}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Heading section={section} ctx={ctx} fallback="Before you book" />
        <div>
          {items.map((item, index) => {
            const isOpen = open === index
            return (
              <div
                key={index}
                style={{ borderTop: `1px solid ${mutedColor(ctx.theme)}26` }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex w-full items-center gap-4 py-5 text-left"
                >
                  <span
                    className="flex-1 text-[16px] leading-snug"
                    style={{ color: inkColor(ctx.theme) }}
                  >
                    {String(item.q)}
                  </span>
                  {isOpen ? (
                    <Minus className="size-4 shrink-0" style={{ color: ctx.theme.accent_color }} />
                  ) : (
                    <Plus className="size-4 shrink-0" style={{ color: mutedColor(ctx.theme) }} />
                  )}
                </button>
                {isOpen && typeof item.a === "string" && (
                  <p
                    className="max-w-prose pb-6 text-[15px] leading-relaxed"
                    style={{ color: mutedColor(ctx.theme) }}
                  >
                    {item.a}
                  </p>
                )}
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
  const t = tokensFor(ctx.theme)
  return (
    <Band ctx={ctx} tight>
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Heading section={section} ctx={ctx} fallback="Get in touch" />
        <div className="flex flex-wrap gap-2.5">
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px]"
              style={t.chip}
            >
              <Mail className="size-4" style={{ color: ctx.theme.accent_color }} /> {email}
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px]"
              style={t.chip}
            >
              <Phone className="size-4" style={{ color: ctx.theme.accent_color }} /> {phone}
            </a>
          )}
        </div>
      </div>
    </Band>
  )
}

function Cta({ section, ctx }: { section: SiteSection; ctx: SectionContext }) {
  const t = tokensFor(ctx.theme)
  const fonts = FONT_SETS[ctx.theme.font_set]
  return (
    <Band ctx={ctx}>
      <div className="px-8 py-16 text-center" style={t.surface}>
        <h2
          className="mx-auto max-w-2xl text-3xl leading-[1.05] sm:text-4xl"
          style={{ ...t.heading, fontFamily: fonts.display, color: inkColor(ctx.theme) }}
        >
          {str(section.data, "headline") ?? "Ready when you are"}
        </h2>
        {str(section.data, "subhead") && (
          <p
            className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed"
            style={{ color: mutedColor(ctx.theme) }}
          >
            {str(section.data, "subhead")}
          </p>
        )}
        {ctx.site.booking_enabled && (
          <div className="mt-8">
            <PillButton ctx={ctx} onClick={ctx.onBook}>
              {str(section.data, "cta_label") ?? "Book now"}
              <ArrowRight className="size-4" />
            </PillButton>
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
