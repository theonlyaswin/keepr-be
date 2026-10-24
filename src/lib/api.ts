import type { ThemeConfig } from "@shared/theme"

/**
 * The public API client.
 *
 * Deliberately has no notion of a token or a session — every endpoint it touches is open,
 * addressed by site slug. If something here ever needs a credential, it belongs in the
 * admin app instead.
 */

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed with status ${status}`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  })
  if (!res.ok) {
    let detail: unknown
    try {
      const body = await res.json()
      detail = body?.detail ?? body
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
}

/** Turn whatever the API threw into a line a guest can act on. */
export function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined
      if (first?.msg) return first.msg
    }
    if (error.status === 404) return "We could not find that page."
    return "Something went wrong. Please try again."
  }
  return "We could not reach the hotel's booking system. Please try again."
}

// ---------------------------------------------------------------------------
// public response shapes
// ---------------------------------------------------------------------------

export interface PropertyBrief {
  name: string
  code: string
  city: string | null
  state: string | null
  country: string | null
  address: string | null
  currency: string
  email: string | null
  phone: string | null
}

export type SectionKind =
  | "hero"
  | "highlights"
  | "about"
  | "rooms"
  | "experiences"
  | "amenities"
  | "gallery"
  | "offers"
  | "testimonials"
  | "location"
  | "faq"
  | "contact"
  | "cta"

export interface SiteSection {
  id: string
  kind: SectionKind
  enabled: boolean
  variant: string
  data: Record<string, unknown>
}

export interface SeoSettings {
  title: string | null
  description: string | null
  og_image: string | null
}

export interface PublicSite {
  slug: string
  template_id: string
  theme: ThemeConfig
  seo: SeoSettings
  sections: SiteSection[]
  property: PropertyBrief
  booking_enabled: boolean
  /** True when opened with a preview token rather than being live. */
  draft: boolean
}

export interface Offer {
  id: string
  title: string
  blurb: string | null
  image: string | null
  coupon_code: string | null
  enabled: boolean
}

export interface Policies {
  check_in_time: string
  check_out_time: string
  cancellation: string | null
  terms: string | null
  children_policy: string | null
  pets_policy: string | null
}

export interface RoomTypeBrief {
  code: string
  name: string
  num_rooms: number
  occupancy: number
  base_rate: number
  headline: string | null
  description: string | null
  amenities: string[]
  images: string[]
  bed_type: string | null
  size_sqm: number | null
  view: string | null
  highlight: string | null
}

export interface PublicEngine {
  slug: string
  theme: ThemeConfig
  display_name: string
  tagline: string | null
  hero_image: string | null
  logo: string | null
  policies: Policies
  offers: Offer[]
  room_types: RoomTypeBrief[]
  property: PropertyBrief
  max_advance_days: number
  max_stay_nights: number
  enabled: boolean
  pay_at_hotel_enabled: boolean
  online_payment_enabled: boolean
}

export interface NightPrice {
  day: string
  rate: number
}

/** One way to buy a room type: an occupancy and meal plan, priced for the whole stay. */
export interface RatePlanOption {
  rate_plan_code: string
  rate_plan_name: string
  occupancy: number
  meal_plan: string
  nights: NightPrice[]
  subtotal: number
  avg_nightly: number
}

/**
 * One room type, with every plan that can be sold for the requested dates.
 *
 * Availability belongs to the room type, not the plan — the plans share the same rooms —
 * so it sits here rather than being repeated on each option.
 */
export interface RoomTypeAvailability {
  room_type_code: string
  room_type_name: string
  units_available: number
  headline: string | null
  description: string | null
  amenities: string[]
  images: string[]
  bed_type: string | null
  size_sqm: number | null
  view: string | null
  highlight: string | null
  from_subtotal: number
  rate_plans: RatePlanOption[]
}

export interface Availability {
  check_in: string
  check_out: string
  nights: number
  adults: number
  children: number
  rooms: number
  currency: string
  room_types: RoomTypeAvailability[]
}

export interface QuoteLine {
  room_type_code: string
  room_type_name: string
  rate_plan_code: string
  rate_plan_name: string
  units: number
  nights: NightPrice[]
  subtotal: number
}

export interface Quote {
  lines: QuoteLine[]
  currency: string
  nights: number
  subtotal: number
  discount: number
  coupon_code: string | null
  coupon_message: string | null
  taxable_value: number
  tax: number
  total: number
}

export interface Confirmation {
  reference: string
  status: string
  guest_name: string
  check_in: string
  check_out: string
  nights: number
  rooms: {
    room_code: string
    rate_plan_code: string | null
    guest_name: string | null
    adults: number
    children: number
    nights: NightPrice[]
  }[]
  currency: string
  amount_before_tax: number
  tax: number
  amount_after_tax: number
  payment_status: string
  check_in_time: string
  check_out_time: string
  booked_on: string
  property: PropertyBrief
}

export interface BookResult {
  confirmation: Confirmation
  quote: Quote
}

export interface PaymentInit {
  reference: string
  payment_url: string
  amount: number
  currency: string
}

export interface PaymentStatusResult {
  status: "pending" | "paid" | "failed"
  confirmation: Confirmation | null
}
