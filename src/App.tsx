import { useEffect, useState } from "react"
import { Navigate, Route, Routes, useParams } from "react-router-dom"

import { resolveSlug } from "@/lib/slug"
import BookPage from "@/pages/book"
import { Loading, NotFound } from "@/pages/shell"
import SitePage from "@/pages/site"

/**
 * Works two ways, because the same build serves both.
 *
 * On the shared Keepr subdomain the hotel is named in the path (`/site/kochi-inn`). On a
 * hotel's own connected domain there is no slug to name — the hostname is the identity — so
 * the bare paths `/` and `/book` resolve it from the host instead.
 */
function WithResolvedSlug({ render }: { render: (slug: string) => React.ReactElement }) {
  const { slug: pathSlug } = useParams()
  const [slug, setSlug] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    resolveSlug(pathSlug).then((result) => {
      if (!cancelled) setSlug(result)
    })
    return () => {
      cancelled = true
    }
  }, [pathSlug])

  if (slug === undefined) return <Loading />
  if (slug === null) {
    return (
      <NotFound message="No hotel site is connected to this address yet." />
    )
  }
  return render(slug)
}

export default function App() {
  return (
    <Routes>
      {/* shared subdomain: the hotel is named in the path */}
      <Route path="/site/:slug" element={<WithResolvedSlug render={(s) => <SitePage slug={s} />} />} />
      <Route path="/book/:slug" element={<WithResolvedSlug render={(s) => <BookPage slug={s} />} />} />

      {/* a hotel's own domain: resolved from the hostname */}
      <Route path="/" element={<WithResolvedSlug render={(s) => <SitePage slug={s} />} />} />
      <Route path="/book" element={<WithResolvedSlug render={(s) => <BookPage slug={s} />} />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
