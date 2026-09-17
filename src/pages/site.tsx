import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { api, readableError } from "@/lib/api"
import type { PublicEngine, PublicSite } from "@/lib/api"
import { Loading, NotFound } from "@/pages/shell"
import { SectionRenderer } from "@/sections"
import type { SectionContext } from "@/sections"
import { FONT_SETS, backdropStyle, ensureFont, inkColor, mutedColor, tokensFor } from "@shared/theme"

/** Set the tab title and description from the hotel's own SEO settings. */
function useDocumentHead(site: PublicSite | undefined) {
  useEffect(() => {
    if (!site) return
    document.title = site.seo.title || site.property.name
    const description = site.seo.description
    if (!description) return
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement("meta")
      tag.name = "description"
      document.head.appendChild(tag)
    }
    tag.content = description
  }, [site])
}

/**
 * A thin bar that sits over the hero and turns solid on scroll — the hotel's name always
 * reachable, and the one action that matters always one click away.
 */
function TopBar({ site, onBook }: { site: PublicSite; onBook: () => void }) {
  const t = tokensFor(site.theme)
  const fonts = FONT_SETS[site.theme.font_set]
  return (
    <header className="absolute inset-x-0 top-0 z-30 px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <span
          className="truncate text-lg text-white"
          style={{ ...t.heading, fontFamily: fonts.display }}
        >
          {site.property.name}
        </span>
        <span className="ml-auto hidden text-[13px] text-white/70 sm:inline">
          {[site.property.city, site.property.country].filter(Boolean).join(", ")}
        </span>
        {site.booking_enabled && (
          <button
            onClick={onBook}
            className="shrink-0 px-4 py-2 text-[13px] backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,.16)",
              border: "1px solid rgba(255,255,255,.35)",
              borderRadius: 9999,
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Book
          </button>
        )}
      </div>
    </header>
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
  const fonts = FONT_SETS[theme.font_set]

  const bookHref = pathSlug ? `/book/${pathSlug}` : "/book"
  const ctx: SectionContext = {
    site,
    engine: engineQuery.data ?? null,
    theme,
    // On a custom domain there is no slug in the URL, so the booking link must not invent
    // one — it stays on whatever address the guest arrived at.
    onBook: () => navigate(bookHref),
  }

  return (
    <main style={{ ...backdropStyle(theme), fontFamily: fonts.body, minHeight: "100vh" }}>
      {site.draft && (
        <div
          className="sticky top-0 z-40 px-6 py-2 text-center text-[12px]"
          style={{ background: theme.accent_color, color: "#fff" }}
        >
          Draft preview — this page is not published yet. Only people with this link can see it.
        </div>
      )}

      <div className="relative">
        <TopBar site={site} onBook={ctx.onBook} />
        {site.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} ctx={ctx} />
        ))}
      </div>

      <footer
        className="px-6 py-10"
        style={{ borderTop: `1px solid ${mutedColor(theme)}22` }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]">
          <span style={{ color: inkColor(theme) }}>{site.property.name}</span>
          <span style={{ color: mutedColor(theme) }}>
            {[site.property.city, site.property.state, site.property.country]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="ml-auto" style={{ color: mutedColor(theme) }}>
            © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </main>
  )
}
