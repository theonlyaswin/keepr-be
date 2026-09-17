import { api } from "@/lib/api"

/**
 * Which hotel this page is for.
 *
 * Two ways in, and the order matters. On a hotel's own connected domain there is no slug in
 * the path — the hostname *is* the identity — so that is checked first and cached. On the
 * shared Keepr subdomain the slug is the first path segment.
 */

const HOST_CACHE_KEY = "keepr-host-slug"

/** Hosts that are ours, where the slug always comes from the path. */
function isPlatformHost(host: string) {
  const h = host.split(":")[0]
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".keepr.app") ||
    h === "keepr.app"
  )
}

export async function resolveSlug(pathSlug: string | undefined): Promise<string | null> {
  if (pathSlug) return pathSlug

  const host = window.location.host
  if (isPlatformHost(host)) return null

  // A custom domain serves one hotel for the life of the deployment, so the lookup is
  // cached — otherwise every navigation would spend a round trip re-learning it.
  try {
    const cached = sessionStorage.getItem(`${HOST_CACHE_KEY}:${host}`)
    if (cached) return cached
  } catch {
    /* private mode — just resolve it again */
  }

  try {
    const result = await api.get<{ slug: string | null; matched: boolean }>(
      `/resolve?host=${encodeURIComponent(host)}`
    )
    if (result.matched && result.slug) {
      try {
        sessionStorage.setItem(`${HOST_CACHE_KEY}:${host}`, result.slug)
      } catch {
        /* not worth failing over */
      }
      return result.slug
    }
  } catch {
    return null
  }
  return null
}
