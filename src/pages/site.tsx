import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, ArrowUpRight, Clock, Mail, MapPin, Menu, Phone, X } from "lucide-react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Eyebrow, money } from "@/components/primitives"
import { api, readableError } from "@/lib/api"
import type { PublicEngine, PublicSite, SiteSection } from "@/lib/api"
import { Loading, NotFound } from "@/pages/shell"
import { SectionRenderer, hasContent, imagePool, mapsLink } from "@/sections"
import type { SectionContext, StayQuery } from "@/sections"
import {
  FONT_SETS,
  OVER_IMAGE,
  backdropStyle,
  ensureFont,
  hairline,
  inkColor,
  mutedColor,
  popoverSurface,
  tokensFor,
} from "@shared/theme"

/** Set the tab title, description and share image from the hotel's own SEO settings. */
function useDocumentHead(site: PublicSite | undefined) {
  useEffect(() => {
    if (!site) return
    document.title = site.seo.title || site.property.name
    const meta = (attr: "name" | "property", key: string, content: string | null) => {
      if (!content) return
      let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
      if (!tag) {
        tag = document.createElement("meta")
        tag.setAttribute(attr, key)
        document.head.appendChild(tag)
      }
      tag.content = content
    }
    meta("name", "description", site.seo.description)
    meta("property", "og:title", site.seo.title || site.property.name)
    meta("property", "og:description", site.seo.description)
    meta("property", "og:image", site.seo.og_image)
  }, [site])
}

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])
  return scrolled
}

const NAV_LABELS: Partial<Record<SiteSection["kind"], string>> = {
  about: "About",
  rooms: "Rooms",
  experiences: "Experiences",
  amenities: "Amenities",
  gallery: "Gallery",
  offers: "Offers",
  location: "Location",
  contact: "Contact",
}

interface NavLink {
  id: string
  label: string
}

function navLinks(ctx: SectionContext): NavLink[] {
  const seen = new Set<string>()
  const links: NavLink[] = []
  for (const section of ctx.site.sections) {
    const label = NAV_LABELS[section.kind]
    if (!label || seen.has(label) || !hasContent(section, ctx)) continue
    seen.add(label)
    links.push({ id: section.id, label })
  }
  return links
}

function Brand({ ctx, light }: { ctx: SectionContext; light: boolean }) {
  const t = tokensFor(ctx.theme)
  const logo = ctx.engine?.logo
  return (
    <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="flex min-w-0 items-center gap-3">
      {logo ? (
        <img
          src={logo}
          alt={ctx.site.property.name}
          className="max-h-9 w-auto object-contain"
          style={light ? { filter: "drop-shadow(0 1px 6px rgba(0,0,0,.35))" } : undefined}
        />
      ) : (
        <span
          className="truncate text-[19px] leading-none"
          style={{
            ...t.heading,
            fontFamily: FONT_SETS[ctx.theme.font_set].display,
            color: light ? OVER_IMAGE.ink : inkColor(ctx.theme),
          }}
        >
          {ctx.site.property.name}
        </span>
      )}
    </a>
  )
}

/**
 * The bar across the top: clear over the hero photograph, solid once the page scrolls, so the
 * hotel's name and the one action that matters are always in reach.
 */
function TopBar({
  ctx,
  overHero,
  draft,
}: {
  ctx: SectionContext
  overHero: boolean
  draft: boolean
}) {
  const scrolled = useScrolled(40)
  const [menuOpen, setMenuOpen] = useState(false)
  const links = navLinks(ctx)
  const solid = scrolled || menuOpen || !overHero
  const light = !solid
  const t = tokensFor(ctx.theme)
  const theme = ctx.theme

  useEffect(() => {
    if (!menuOpen) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const go = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  const linkColor = light ? "rgba(255,255,255,.86)" : mutedColor(theme)

  return (
    <header className="kp-noprint fixed inset-x-0 top-0 z-40">
      {draft && (
        <div className="px-6 py-2 text-center text-[12px]" style={{ background: theme.accent_color, color: "#fff" }}>
          Draft preview — this page is not published yet. Only people with this link can see it.
        </div>
      )}
      <div
        className="transition-[background-color,box-shadow,backdrop-filter] duration-300"
        style={
          solid
            ? {
                background: popoverSurface(theme).background,
                boxShadow: `0 1px 0 ${hairline(theme, 2)}, 0 8px 24px -16px rgba(0,0,0,.25)`,
              }
            : { background: "linear-gradient(to bottom, rgba(10,8,5,.35), transparent)" }
        }
      >
        <div className="px-5 sm:px-8">
        <nav
          className={`mx-auto flex max-w-6xl items-center gap-6 transition-[height] duration-300 ${
            scrolled ? "h-16" : "h-20"
          }`}
          aria-label="Main"
        >
          <Brand ctx={ctx} light={light} />

          <ul className="ml-auto hidden items-center gap-7 lg:flex">
            {links.slice(0, 6).map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    go(link.id)
                  }}
                  className="text-[14px] transition-opacity hover:opacity-100"
                  style={{ color: linkColor }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {ctx.site.booking_enabled && (
              <button
                type="button"
                onClick={() => ctx.onBook()}
                className="kp-button hidden px-5 py-2.5 text-[14px] sm:inline-flex"
                style={
                  light
                    ? {
                        background: "rgba(255,255,255,.14)",
                        border: "1px solid rgba(255,255,255,.4)",
                        borderRadius: 9999,
                        color: "#fff",
                        fontWeight: 600,
                        backdropFilter: "blur(8px)",
                      }
                    : (t.button as React.CSSProperties)
                }
              >
                Book your stay
              </button>
            )}
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="kp-button flex size-10 items-center justify-center rounded-full lg:hidden"
                style={{ color: light ? "#fff" : inkColor(theme), background: "none", border: "none" }}
              >
                {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
          </div>
        </nav>
        </div>
      </div>

      {menuOpen && (
        <div
          className="kp-fade fixed inset-x-0 bottom-0 flex flex-col overflow-y-auto px-5 pt-6 pb-10 lg:hidden"
          style={{ top: draft ? 96 : 64, background: popoverSurface(theme).background }}
        >
          <ul>
            {links.map((link, i) => (
              <li key={link.id} className="kp-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <a
                  href={`#${link.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    go(link.id)
                  }}
                  className="flex items-center justify-between py-4 text-[26px] leading-tight"
                  style={{
                    ...t.heading,
                    fontFamily: FONT_SETS[theme.font_set].display,
                    color: inkColor(theme),
                    borderBottom: `1px solid ${hairline(theme, 1)}`,
                  }}
                >
                  {link.label}
                  <ArrowRight className="size-5" style={{ color: mutedColor(theme) }} />
                </a>
              </li>
            ))}
          </ul>
          {ctx.site.booking_enabled && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                ctx.onBook()
              }}
              className="kp-button mt-8 w-full py-4 text-[16px]"
              style={t.button as React.CSSProperties}
            >
              Book your stay
            </button>
          )}
        </div>
      )}
    </header>
  )
}

/** On a phone the booking action rides along the bottom once the hero has scrolled away. */
function MobileBookBar({ ctx }: { ctx: SectionContext }) {
  const past = useScrolled(typeof window === "undefined" ? 600 : window.innerHeight * 0.7)
  const rooms = ctx.engine?.room_types ?? []
  const from = rooms.length ? Math.min(...rooms.map((r) => r.base_rate).filter((r) => r > 0)) : 0
  const t = tokensFor(ctx.theme)
  if (!ctx.site.booking_enabled) return null

  return (
    <div
      className={`kp-noprint fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden ${
        past ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        background: popoverSurface(ctx.theme).background,
        boxShadow: `0 -1px 0 ${hairline(ctx.theme, 2)}, 0 -12px 24px -18px rgba(0,0,0,.35)`,
      }}
      aria-hidden={!past}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {Number.isFinite(from) && from > 0 ? (
            <>
              <div className="text-[11px] tracking-[0.12em] uppercase" style={{ color: mutedColor(ctx.theme) }}>
                Rooms from
              </div>
              <div className="text-[17px] leading-tight" style={{ color: inkColor(ctx.theme), fontWeight: 600 }}>
                {money(from, ctx.site.property.currency)}
                <span className="text-[12px] font-normal" style={{ color: mutedColor(ctx.theme) }}>
                  {" "}
                  / night
                </span>
              </div>
            </>
          ) : (
            <div className="truncate text-[14px]" style={{ color: inkColor(ctx.theme) }}>
              {ctx.site.property.name}
            </div>
          )}
        </div>
        <button
          type="button"
          tabIndex={past ? 0 : -1}
          onClick={() => ctx.onBook()}
          className="kp-button shrink-0 px-6 py-3 text-[15px]"
          style={t.button as React.CSSProperties}
        >
          Book now
        </button>
      </div>
    </div>
  )
}

function Footer({ ctx }: { ctx: SectionContext }) {
  const { theme, site } = ctx
  const t = tokensFor(theme)
  const p = site.property
  const place = [p.city, p.state, p.country].filter(Boolean).join(", ")
  const links = navLinks(ctx)
  const policies = ctx.engine?.policies
  const muted = mutedColor(theme)
  const ink = inkColor(theme)
  const query = p.address ?? (place ? `${p.name}, ${place}` : null)

  const column = (title: string, children: React.ReactNode) => (
    <div>
      <Eyebrow theme={theme} className="mb-4">
        {title}
      </Eyebrow>
      <div className="space-y-2.5 text-[14.5px] leading-relaxed">{children}</div>
    </div>
  )

  return (
    <footer className="px-5 pt-20 pb-28 sm:px-8 md:pb-10" style={{ borderTop: `1px solid ${hairline(theme, 2)}` }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,3fr))]">
          <div>
            <div
              className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.05]"
              style={{ ...t.heading, fontFamily: FONT_SETS[theme.font_set].display, color: ink }}
            >
              {p.name}
            </div>
            {ctx.engine?.tagline && (
              <p className="mt-3 max-w-xs text-[14.5px] leading-relaxed" style={{ color: muted }}>
                {ctx.engine.tagline}
              </p>
            )}
            {site.booking_enabled && (
              <button
                type="button"
                onClick={() => ctx.onBook()}
                className="kp-button mt-7 inline-flex items-center gap-2 px-5 py-2.5 text-[14px]"
                style={t.button as React.CSSProperties}
              >
                Book direct
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>

          {(p.address || place) &&
            column(
              "Visit",
              <>
                <p className="flex gap-2.5" style={{ color: ink }}>
                  <MapPin className="mt-1 size-3.5 shrink-0" style={{ color: muted }} />
                  <span>{p.address ?? place}</span>
                </p>
                {query && (
                  <a
                    href={mapsLink(query)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    style={{ color: muted }}
                  >
                    Directions <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </>,
            )}

          {(p.phone || p.email || policies) &&
            column(
              "Contact",
              <>
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2.5 hover:underline" style={{ color: ink }}>
                    <Phone className="size-3.5 shrink-0" style={{ color: muted }} />
                    {p.phone}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-2.5 break-all hover:underline" style={{ color: ink }}>
                    <Mail className="size-3.5 shrink-0" style={{ color: muted }} />
                    {p.email}
                  </a>
                )}
                {policies && (
                  <p className="flex items-center gap-2.5" style={{ color: muted }}>
                    <Clock className="size-3.5 shrink-0" />
                    In {policies.check_in_time} · Out {policies.check_out_time}
                  </p>
                )}
              </>,
            )}

          {links.length > 0 &&
            column(
              "Explore",
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={`#${link.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(link.id)?.scrollIntoView({ behavior: "smooth" })
                      }}
                      className="hover:underline"
                      style={{ color: ink }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>,
            )}
        </div>

        <div
          className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 pt-6 text-[12.5px]"
          style={{ borderTop: `1px solid ${hairline(theme, 1)}`, color: muted }}
        >
          <span>
            © {new Date().getFullYear()} {p.name}
          </span>
          {place && <span>{place}</span>}
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="ml-auto hover:underline">
            Back to top
          </a>
        </div>
      </div>
    </footer>
  )
}

export default function SitePage({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { slug: pathSlug } = useParams()
  const [params] = useSearchParams()
  const preview = params.get("preview")

  const siteQuery = useQuery({
    queryKey: ["site", slug, preview],
    queryFn: () =>
      api.get<PublicSite>(`/${slug}/site${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`),
    retry: false,
  })

  // The rooms and offers sections draw from the engine, so it is fetched alongside. A
  // failure here is not fatal: those two sections simply do not render.
  const engineQuery = useQuery({
    queryKey: ["engine", slug],
    queryFn: () => api.get<PublicEngine>(`/${slug}/engine`),
    retry: false,
    enabled: siteQuery.isSuccess,
  })

  useDocumentHead(siteQuery.data)

  useEffect(() => {
    if (siteQuery.data) ensureFont(siteQuery.data.theme.font_set)
  }, [siteQuery.data])

  if (siteQuery.isLoading) return <Loading />
  if (siteQuery.isError || !siteQuery.data) {
    return <NotFound message={readableError(siteQuery.error)} />
  }

  const site = siteQuery.data
  const theme = site.theme
  const engine = engineQuery.data ?? null
  const fonts = FONT_SETS[theme.font_set]

  // On a custom domain there is no slug in the URL, so the booking link must not invent
  // one — it stays on whatever address the guest arrived at.
  const bookPath = pathSlug ? `/book/${pathSlug}` : "/book"
  const ctx: SectionContext = {
    site,
    engine,
    theme,
    images: imagePool(site, engine),
    onBook: (stay?: StayQuery) => {
      if (!stay) return navigate(bookPath)
      const q = new URLSearchParams({
        in: stay.checkIn,
        out: stay.checkOut,
        adults: String(stay.occupancy.adults),
        children: String(stay.occupancy.children),
        rooms: String(stay.occupancy.rooms),
      })
      navigate(`${bookPath}?${q}`)
    },
  }
  const overHero = site.sections[0]?.kind === "hero"

  return (
    <main
      id="top"
      className="kp-js"
      style={
        {
          ...backdropStyle(theme),
          fontFamily: fonts.body,
          color: inkColor(theme),
          minHeight: "100vh",
          "--kp-focus": theme.primary_color,
        } as React.CSSProperties
      }
    >
      <TopBar ctx={ctx} overHero={overHero} draft={site.draft} />
      {/* without a hero the first section would slide under the fixed bar */}
      {!overHero && <div className={site.draft ? "h-28" : "h-20"} />}
      {site.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} ctx={ctx} />
      ))}
      <Footer ctx={ctx} />
      <MobileBookBar ctx={ctx} />
    </main>
  )
}
