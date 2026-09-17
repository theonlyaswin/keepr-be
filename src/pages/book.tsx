import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import {
  ArrowRight,
  BadgePercent,
  CalendarX2,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Printer,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router-dom"

import { SingleDatePicker } from "@/components/date-picker"
import { occupancyLabel, type Occupancy } from "@/components/guest-picker"
import { Masthead, StickyBar, type Step } from "@/components/masthead"
import {
  Button,
  Chip,
  Eyebrow,
  Field,
  Input,
  PanelTitle,
  Rule,
  Select,
  Textarea,
  money,
  plural,
} from "@/components/primitives"
import { RoomCard } from "@/components/room-card"
import { SearchRail, StayBar } from "@/components/search-rail"
import { MobileActionBar, StaySummary } from "@/components/summary"
import { api, readableError } from "@/lib/api"
import type {
  Availability,
  BookResult,
  Confirmation,
  Offer,
  PaymentInit,
  PaymentStatusResult,
  PublicEngine,
  Quote,
} from "@/lib/api"
import { Loading, NotFound } from "@/pages/shell"
import {
  FONT_SETS,
  accentInk,
  alpha,
  backdropStyle,
  ensureFont,
  popoverSurface,
  hairline,
  inkColor,
  mutedColor,
  readableOn,
  tokensFor,
} from "@shared/theme"
import type { ThemeConfig } from "@shared/theme"

/**
 * The booking flow.
 *
 * Four steps, one page. The page is laid out to match the hotel's own site rather than to
 * be efficient with pixels: the same max width, the same display face at a size worth
 * reading, and the hotel's photograph at the top of the first step. A guest who has just
 * come from a full-bleed hero should not feel they have been handed off to a different
 * company to fill in a form.
 */

export default function BookPage({ slug }: { slug: string }) {
  const { slug: pathSlug } = useParams()
  const [searchParams] = useSearchParams()

  const engineQuery = useQuery({
    queryKey: ["engine", slug],
    queryFn: () => api.get<PublicEngine>(`/${slug}/engine`),
    retry: false,
  })

  const [step, setStep] = useState<Step>("search")
  const [checkIn, setCheckIn] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"))
  const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"))
  const [occupancy, setOccupancy] = useState<Occupancy>({
    adults: 2,
    children: 0,
    rooms: 1,
  })

  const [editingSearch, setEditingSearch] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [selections, setSelections] = useState<Record<string, number>>({})
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [requests, setRequests] = useState("")
  const [gender, setGender] = useState("")
  const [dob, setDob] = useState("")
  const [nationality, setNationality] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [city, setCity] = useState("")
  const [stateName, setStateName] = useState("")
  const [country, setCountry] = useState("")
  const [zip, setZip] = useState("")
  const [company, setCompany] = useState("")
  const [gstin, setGstin] = useState("")

  const [availability, setAvailability] = useState<Availability | null>(null)
  const [quote, setQuote] = useState<Quote | undefined>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [error, setError] = useState<string | null>(null)

  // "pah" (pay at hotel) or "online" (PhonePe). Only asked when a property offers both —
  // otherwise whichever one is available is used without a picker.
  const [paymentMethod, setPaymentMethod] = useState<"pah" | "online" | null>(null)
  const [paymentReference, setPaymentReference] = useState<string | null>(null)

  // A guest lands back here straight from PhonePe's hosted page, as a fresh page load — the
  // `pay` query param is the one thing that survives that round trip.
  useEffect(() => {
    const ref = searchParams.get("pay")
    if (ref) {
      setPaymentReference(ref)
      setStep("payment")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const theme = engineQuery.data?.theme

  useEffect(() => {
    if (theme) ensureFont(theme.font_set)
  }, [theme])

  // The tab is part of the page. A guest with six hotels open should be able to tell them
  // apart without clicking through.
  useEffect(() => {
    const name = engineQuery.data?.display_name
    if (name) document.title = `Book · ${name}`
  }, [engineQuery.data?.display_name])

  // The step is the page as far as a guest is concerned, so moving between steps starts at
  // the top the way a navigation would.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  const selectionPayload = () =>
    Object.entries(selections)
      .filter(([, units]) => units > 0)
      .map(([rate_plan_code, units]) => ({ rate_plan_code, units }))

  const search = useMutation({
    mutationFn: () =>
      api.get<Availability>(
        `/${slug}/availability?from=${checkIn}&to=${checkOut}&adults=${occupancy.adults}` +
          `&children=${occupancy.children}&rooms=${occupancy.rooms}`,
      ),
    onSuccess: (result) => {
      setAvailability(result)
      setSelections({})
      setQuote(undefined)
      setError(null)
      setEditingSearch(false)
      setStep("results")
    },
    onError: (e) => setError(readableError(e)),
  })

  const quoteCall = useMutation({
    mutationFn: (coupon: string | null) =>
      api.post<Quote>(`/${slug}/quote`, {
        check_in: checkIn,
        check_out: checkOut,
        adults: occupancy.adults,
        children: occupancy.children,
        rooms: occupancy.rooms,
        selections: selectionPayload(),
        coupon_code: coupon,
      }),
    onSuccess: (result) => {
      setQuote(result)
      setError(null)
    },
    onError: (e) => setError(readableError(e)),
  })

  const bookingPayload = () => ({
    check_in: checkIn,
    check_out: checkOut,
    adults: occupancy.adults,
    children: occupancy.children,
    rooms: occupancy.rooms,
    selections: selectionPayload(),
    coupon_code: appliedCoupon,
    guest: {
      first_name: firstName,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      special_requests: requests || null,
      gender: gender || null,
      date_of_birth: dob || null,
      nationality: nationality || null,
      address_line1: addressLine1 || null,
      city: city || null,
      state: stateName || null,
      country: country || null,
      zip_code: zip || null,
      company_name: company || null,
      gstin: gstin || null,
    },
  })

  const book = useMutation({
    mutationFn: () => api.post<BookResult>(`/${slug}/book`, bookingPayload()),
    onSuccess: (result) => {
      setConfirmation(result.confirmation)
      setError(null)
      setSheetOpen(false)
      setStep("done")
    },
    onError: (e) => setError(readableError(e)),
  })

  // Does NOT create a booking — stages a PendingPayment and opens a PhonePe order. The
  // browser leaves the app entirely on success, the one place this SPA does a real navigation.
  const initiatePayment = useMutation({
    mutationFn: () => api.post<PaymentInit>(`/${slug}/checkout/payment`, bookingPayload()),
    onSuccess: (result) => {
      window.location.href = result.payment_url
    },
    onError: (e) => setError(readableError(e)),
  })

  const retryPayment = useMutation({
    mutationFn: () => api.post<PaymentInit>(`/${slug}/checkout/payment/${paymentReference}/retry`),
    onSuccess: (result) => {
      window.location.href = result.payment_url
    },
    onError: (e) => setError(readableError(e)),
  })

  const paymentStatus = useQuery({
    queryKey: ["payment-status", slug, paymentReference],
    queryFn: () => api.get<PaymentStatusResult>(`/${slug}/checkout/payment/${paymentReference}/status`),
    enabled: step === "payment" && Boolean(paymentReference),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
  })

  // The webhook is the source of truth and may land before or after this poll notices —
  // either way, the moment the status turns "paid" the booking exists and this is the same
  // confirmation the pay-at-hotel path reaches, so it reuses the same "done" screen.
  useEffect(() => {
    if (paymentStatus.data?.status === "paid" && paymentStatus.data.confirmation) {
      setConfirmation(paymentStatus.data.confirmation)
      setStep("done")
    }
  }, [paymentStatus.data])

  const totalUnits = useMemo(
    () => Object.values(selections).reduce((sum, n) => sum + n, 0),
    [selections],
  )

  // Re-price whenever the basket changes. The server is the only thing that knows what a
  // selection costs, so the summary is never computed here.
  useEffect(() => {
    if (step !== "results" && step !== "checkout") return
    if (totalUnits === 0) {
      setQuote(undefined)
      return
    }
    quoteCall.mutate(appliedCoupon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, appliedCoupon, step])

  if (engineQuery.isLoading) return <Loading />
  if (engineQuery.isError || !engineQuery.data || !theme) {
    return <NotFound message={readableError(engineQuery.error)} />
  }

  const engine = engineQuery.data
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]
  const ink = inkColor(theme)
  const muted = mutedColor(theme)
  const backHref = pathSlug ? `/site/${pathSlug}` : "/"
  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)) || 0
  const detailsComplete = firstName.trim().length > 0 && Boolean(email.trim() || phone.trim())

  // Only asked when a property genuinely offers both; otherwise whichever exists is used.
  const bothMethodsOffered = engine.pay_at_hotel_enabled && engine.online_payment_enabled
  const chosenMethod: "pah" | "online" | null = bothMethodsOffered
    ? paymentMethod
    : engine.online_payment_enabled
      ? "online"
      : engine.pay_at_hotel_enabled
        ? "pah"
        : null
  const canBook = detailsComplete && chosenMethod !== null
  const confirmPending = book.isPending || initiatePayment.isPending

  function confirmBooking() {
    if (chosenMethod === "online") initiatePayment.mutate()
    else book.mutate()
  }

  function applyDates(from: string, to: string) {
    setCheckIn(from)
    setCheckOut(to)
  }

  /**
   * A veil over the hotel's background photograph, behind the content column.
   *
   * `backdropStyle` puts that photograph behind the whole page, which suits the marketing
   * site where almost every line of text sits inside a panel. This flow has headings,
   * captions and section labels that stand on the ground itself, and small text over
   * foliage cannot be read at any overlay setting the hotel is likely to pick. The veil
   * only appears when there is a photograph to soften.
   */
  const groundVeil: React.CSSProperties = theme.background_image
    ? {
        background: theme.dark_mode ? "rgba(10,12,16,.55)" : "rgba(255,255,255,.62)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }
    : {}

  const summary = (
    <StaySummary
      quote={quote}
      theme={theme}
      pending={quoteCall.isPending}
      checkIn={checkIn}
      checkOut={checkOut}
      nights={availability?.nights ?? nights}
      occupancyLine={occupancyLabel(occupancy)}
    >
      {step === "results" ? (
        <>
          <Button
            theme={theme}
            onClick={() => {
              setSheetOpen(false)
              setStep("checkout")
            }}
            disabled={totalUnits === 0 || !quote}
            size="lg"
            className="w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to details
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-[12px]" style={{ color: muted }}>
            {totalUnits === 0
              ? "Pick a room to continue"
              : `${plural(totalUnits, "room")} selected`}
          </p>
        </>
      ) : (
        <>
          {bothMethodsOffered && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button
                theme={theme}
                tone={chosenMethod === "online" ? "primary" : "quiet"}
                onClick={() => setPaymentMethod("online")}
                className="justify-center"
              >
                Pay now
              </Button>
              <Button
                theme={theme}
                tone={chosenMethod === "pah" ? "primary" : "quiet"}
                onClick={() => setPaymentMethod("pah")}
                className="justify-center"
              >
                Pay at hotel
              </Button>
            </div>
          )}
          <Button
            theme={theme}
            onClick={confirmBooking}
            disabled={!canBook || confirmPending || !quote}
            size="lg"
            className="w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmPending ? "Confirming" : chosenMethod === "online" ? "Continue to payment" : "Confirm booking"}
          </Button>
          <p className="text-center text-[12px]" style={{ color: muted }}>
            {!detailsComplete
              ? "Add your name and a way to reach you."
              : bothMethodsOffered && !chosenMethod
                ? "Choose how you'd like to pay."
                : chosenMethod === "online"
                  ? "You'll pay securely via PhonePe on the next screen."
                  : "No payment now — you settle at the hotel."}
          </p>
        </>
      )}
    </StaySummary>
  )

  return (
    <main
      style={
        {
          ...backdropStyle(theme),
          fontFamily: fonts.body,
          minHeight: "100vh",
          "--kp-focus": theme.primary_color,
        } as React.CSSProperties
      }
    >
      {step === "search" ? (
        <Masthead engine={engine} theme={theme} backHref={backHref} />
      ) : (
        <StickyBar engine={engine} theme={theme} backHref={backHref} step={step} />
      )}

      {/* The search rail overlaps the bottom of the photograph — the one place on the page
          where two layers meet, and the reason the masthead has extra padding beneath. */}
      {step === "search" && (
        <div className="relative z-20 mx-auto -mt-8 w-full max-w-6xl px-5 sm:px-8">
          <SearchRail
            engine={engine}
            theme={theme}
            checkIn={checkIn}
            checkOut={checkOut}
            onDates={applyDates}
            occupancy={occupancy}
            onOccupancy={setOccupancy}
            onSearch={() => search.mutate()}
            pending={search.isPending}
            disabled={!engine.enabled}
            label="Search rooms"
          />
        </div>
      )}

      {/* full-bleed, so the veil reads as the page ground rather than a box floating on it */}
      <div style={groundVeil}>
        <div
          className={[
            "mx-auto w-full max-w-6xl px-5 sm:px-8",
            step === "search" ? "py-14" : "py-6 sm:py-8",
            // clears the phone's fixed action bar, which is on screen for both middle steps
            step === "results" || step === "checkout" ? "pb-28 lg:pb-14" : "",
          ].join(" ")}
        >
          {!engine.enabled && (
            <Notice theme={theme}>
              Online booking is closed at the moment. Please contact the hotel directly
              {engine.property.phone ? ` on ${engine.property.phone}` : ""}.
            </Notice>
          )}

          {error && (
            <Notice theme={theme} urgent onDismiss={() => setError(null)}>
              {error}
            </Notice>
          )}

          {/* ---- step 1: what the hotel offers, while the dates are being chosen ---- */}
          {step === "search" && (
            <SearchAside
              engine={engine}
              theme={theme}
              appliedCoupon={appliedCoupon}
              onApplyOffer={(code) => {
                setCouponInput(code)
                setAppliedCoupon(code)
              }}
            />
          )}

          {/* ---- step 2: rooms ---- */}
          {step === "results" && availability && (
            <>
              <div className="mb-5">
                {editingSearch ? (
                  <SearchRail
                    engine={engine}
                    theme={theme}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onDates={applyDates}
                    occupancy={occupancy}
                    onOccupancy={setOccupancy}
                    onSearch={() => search.mutate()}
                    pending={search.isPending}
                    disabled={!engine.enabled}
                    label="Update"
                  />
                ) : (
                  <div className="p-4" style={t.surface as React.CSSProperties}>
                    <StayBar
                      theme={theme}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      occupancy={occupancy}
                      onEdit={() => setEditingSearch(true)}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div>
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <PanelTitle theme={theme}>
                      {availability.room_types.length === 0
                        ? "No rooms free"
                        : `${plural(availability.room_types.length, "room")} for your dates`}
                    </PanelTitle>
                    <span className="text-[13px]" style={{ color: muted }}>
                      Prices for {plural(availability.nights, "night")}
                    </span>
                  </div>

                  {availability.room_types.length === 0 ? (
                    <EmptyResults theme={theme} onChange={() => setEditingSearch(true)} />
                  ) : (
                    <div className="space-y-5">
                      {availability.room_types.map((room, i) => (
                        <RoomCard
                          key={room.room_type_code}
                          room={room}
                          index={i}
                          selections={selections}
                          onUnits={(code, next) =>
                            setSelections((prev) => ({ ...prev, [code]: next }))
                          }
                          theme={theme}
                          currency={availability.currency}
                          nights={availability.nights}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
                  {summary}
                </aside>
              </div>
            </>
          )}

          {/* ---- step 3: details ---- */}
          {step === "checkout" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="space-y-5">
                <section className="p-5 sm:p-6" style={t.surface as React.CSSProperties}>
                  <PanelTitle theme={theme}>Who is staying</PanelTitle>
                  <p className="mt-1.5 mb-5 text-[13.5px]" style={{ color: muted }}>
                    The hotel needs a name for the register and one way to reach you about the stay.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name" required theme={theme}>
                      <Input
                        theme={theme}
                        value={firstName}
                        autoComplete="given-name"
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </Field>
                    <Field label="Last name" theme={theme}>
                      <Input
                        theme={theme}
                        value={lastName}
                        autoComplete="family-name"
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </Field>
                    <Field label="Email" hint="for the confirmation" theme={theme}>
                      <Input
                        theme={theme}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                    <Field label="Phone" theme={theme}>
                      <Input
                        theme={theme}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                  </div>

                  <Rule theme={theme} className="my-5" />
                  <Eyebrow theme={theme} className="mb-3">
                    Saves you a form at the desk
                  </Eyebrow>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Gender" theme={theme}>
                      <Select
                        theme={theme}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Date of birth" theme={theme}>
                      <SingleDatePicker
                        value={dob}
                        onChange={setDob}
                        theme={theme}
                        placeholder="Select"
                        minDate={new Date(1920, 0, 1)}
                        maxDate={new Date()}
                      />
                    </Field>
                    <Field label="Nationality" theme={theme}>
                      <Input
                        theme={theme}
                        value={nationality}
                        autoComplete="country-name"
                        placeholder="Indian"
                        onChange={(e) => setNationality(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Anything we should know" theme={theme}>
                      <Textarea
                        theme={theme}
                        rows={3}
                        value={requests}
                        placeholder="A late arrival, a quiet room, a cot for a child…"
                        onChange={(e) => setRequests(e.target.value)}
                      />
                    </Field>
                  </div>
                </section>

                <details className="group overflow-hidden" style={t.surface as React.CSSProperties}>
                  <summary
                    className="flex cursor-pointer list-none items-center gap-3 p-5 text-[15px] sm:p-6"
                    style={{ color: ink }}
                  >
                    <ChevronRight
                      className="size-4 shrink-0 transition-transform group-open:rotate-90"
                      style={{ color: muted }}
                    />
                    Address and billing
                    <span className="ml-auto text-[12.5px]" style={{ color: muted }}>
                      Optional — needed for a GST invoice
                    </span>
                  </summary>
                  <div
                    className="space-y-4 p-5 pt-5 sm:p-6"
                    style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}
                  >
                    <Field label="Address" theme={theme}>
                      <Input
                        theme={theme}
                        value={addressLine1}
                        autoComplete="address-line1"
                        onChange={(e) => setAddressLine1(e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="City" theme={theme}>
                        <Input
                          theme={theme}
                          value={city}
                          autoComplete="address-level2"
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </Field>
                      <Field label="State" theme={theme}>
                        <Input
                          theme={theme}
                          value={stateName}
                          autoComplete="address-level1"
                          onChange={(e) => setStateName(e.target.value)}
                        />
                      </Field>
                      <Field label="Country" theme={theme}>
                        <Input
                          theme={theme}
                          value={country}
                          autoComplete="country-name"
                          onChange={(e) => setCountry(e.target.value)}
                        />
                      </Field>
                      <Field label="Postcode" theme={theme}>
                        <Input
                          theme={theme}
                          value={zip}
                          autoComplete="postal-code"
                          onChange={(e) => setZip(e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Company" theme={theme}>
                        <Input
                          theme={theme}
                          value={company}
                          autoComplete="organization"
                          onChange={(e) => setCompany(e.target.value)}
                        />
                      </Field>
                      <Field label="GSTIN" hint="puts your employer on the invoice" theme={theme}>
                        <Input
                          theme={theme}
                          mono
                          value={gstin}
                          placeholder="22AAAAA0000A1Z5"
                          onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        />
                      </Field>
                    </div>
                  </div>
                </details>

                <section className="p-5 sm:p-6" style={t.surface as React.CSSProperties}>
                  <div className="flex items-center gap-2">
                    <Tag className="size-4" style={{ color: accentInk(theme) }} />
                    <PanelTitle theme={theme} className="!text-[16px]">
                      Promo code
                    </PanelTitle>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Input
                      theme={theme}
                      mono
                      value={couponInput}
                      placeholder="MONSOON20"
                      aria-label="Promo code"
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setAppliedCoupon(couponInput.trim() || null)
                      }}
                      style={{ width: "auto", flex: "1 1 12rem" }}
                    />
                    <Button
                      theme={theme}
                      tone="quiet"
                      onClick={() => setAppliedCoupon(couponInput.trim() || null)}
                      disabled={!couponInput.trim() && !appliedCoupon}
                      className="disabled:opacity-40"
                    >
                      Apply
                    </Button>
                  </div>
                  {quote?.coupon_message && (
                    <p
                      className="mt-3 flex items-start gap-2 text-[13px]"
                      style={{
                        color: quote.discount > 0 ? accentInk(theme) : muted,
                      }}
                    >
                      {quote.discount > 0 && <Check className="mt-0.5 size-3.5 shrink-0" />}
                      {quote.coupon_message}
                    </p>
                  )}
                </section>

                {(engine.policies.cancellation || engine.policies.terms) && (
                  <section className="p-5 sm:p-6" style={t.surface as React.CSSProperties}>
                    <Eyebrow theme={theme} className="mb-3">
                      Before you confirm
                    </Eyebrow>
                    <div
                      className="space-y-2.5 text-[13.5px] leading-relaxed"
                      style={{ color: muted }}
                    >
                      {engine.policies.cancellation && <p>{engine.policies.cancellation}</p>}
                      {engine.policies.terms && <p>{engine.policies.terms}</p>}
                    </div>
                  </section>
                )}

                <button
                  type="button"
                  onClick={() => setStep("results")}
                  className="kp-button text-[13.5px] underline-offset-4 hover:underline"
                  style={{
                    color: muted,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  Back to rooms
                </button>
              </div>

              <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">{summary}</aside>
            </div>
          )}

          {/* ---- step 4: waiting on PhonePe ---- */}
          {step === "payment" && paymentStatus.data?.status !== "paid" && (
            <PaymentPending
              theme={theme}
              status={paymentStatus.isLoading ? "pending" : (paymentStatus.data?.status ?? "pending")}
              onCheckAgain={() => paymentStatus.refetch()}
              onRetry={() => retryPayment.mutate()}
              retrying={retryPayment.isPending}
            />
          )}

          {/* ---- step 5: confirmed ---- */}
          {step === "done" && confirmation && (
            <Confirmed confirmation={confirmation} theme={theme} backHref={backHref} />
          )}
        </div>
      </div>

      {/* the phone's persistent total and next step */}
      {(step === "results" || step === "checkout") && (
        <MobileActionBar
          theme={theme}
          total={quote ? money(quote.total, quote.currency) : null}
          caption={
            quote
              ? `${plural(totalUnits, "room")} · ${plural(availability?.nights ?? nights, "night")}`
              : "Nothing selected yet"
          }
          onOpenSummary={() => setSheetOpen(true)}
        >
          {step === "results" ? (
            <Button
              theme={theme}
              onClick={() => setStep("checkout")}
              disabled={totalUnits === 0 || !quote}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              theme={theme}
              onClick={confirmBooking}
              disabled={!canBook || confirmPending || !quote}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {chosenMethod === "online" ? "Continue to payment" : "Confirm"}
            </Button>
          )}
        </MobileActionBar>
      )}

      {sheetOpen && (
        <Sheet theme={theme} onClose={() => setSheetOpen(false)}>
          {summary}
        </Sheet>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// step one: everything worth knowing while the dates are still being decided
// ---------------------------------------------------------------------------

/**
 * The hotel's live offers and its arrival terms.
 *
 * Both were already in the engine payload and neither was ever drawn, which left the first
 * step as a search box on an empty page — and left a hotel's direct-booking discount
 * invisible on the one screen where it could win the booking.
 */
function SearchAside({
  engine,
  theme,
  appliedCoupon,
  onApplyOffer,
}: {
  engine: PublicEngine
  theme: ThemeConfig
  appliedCoupon: string | null
  onApplyOffer: (code: string) => void
}) {
  const t = tokensFor(theme)
  const offers = engine.offers.filter((o) => o.enabled)
  const cheapest = engine.room_types.reduce<number | null>(
    (low, r) => (low === null || r.base_rate < low ? r.base_rate : low),
    null,
  )

  return (
    <div className="space-y-12">
      {offers.length > 0 && (
        <section>
          <Eyebrow theme={theme} tone="accent">
            Booking direct
          </Eyebrow>
          <PanelTitle theme={theme} className="mt-2.5 !text-[26px]">
            Offers you will not find elsewhere
          </PanelTitle>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                theme={theme}
                applied={Boolean(offer.coupon_code) && offer.coupon_code === appliedCoupon}
                onApply={onApplyOffer}
              />
            ))}
          </div>
        </section>
      )}

      <section
        className="grid overflow-hidden sm:grid-cols-3"
        style={t.surface as React.CSSProperties}
      >
        <Fact
          theme={theme}
          index={0}
          icon={ShieldCheck}
          title={engine.pay_at_hotel_enabled ? "No card needed" : "Secure online payment"}
          body={
            engine.pay_at_hotel_enabled
              ? "Your room is held on your name alone. You settle the bill at the hotel."
              : "Pay online via PhonePe and your booking is confirmed the moment it clears."
          }
        />
        <Fact
          theme={theme}
          index={1}
          icon={BadgePercent}
          title={
            cheapest !== null
              ? `Rooms from ${money(cheapest, engine.property.currency)}`
              : "Direct rates"
          }
          body={
            cheapest !== null
              ? "Nightly rate before taxes. Your dates decide the final price."
              : "The rates here come straight from the hotel, with nothing added."
          }
        />
        <Fact
          theme={theme}
          index={2}
          icon={Clock}
          title={`Arrive from ${engine.policies.check_in_time}`}
          body={`Check out by ${engine.policies.check_out_time}. Ask about an early arrival when you book.`}
        />
      </section>
    </div>
  )
}

function OfferCard({
  offer,
  theme,
  applied,
  onApply,
}: {
  offer: Offer
  theme: ThemeConfig
  applied: boolean
  onApply: (code: string) => void
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]

  return (
    <article className="flex flex-col overflow-hidden" style={t.surface as React.CSSProperties}>
      {offer.image && (
        <img src={offer.image} alt="" loading="lazy" className="h-40 w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3
          className="text-[17px] leading-snug"
          style={{
            ...t.heading,
            fontFamily: fonts.display,
            color: inkColor(theme),
          }}
        >
          {offer.title}
        </h3>
        {offer.blurb && (
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: mutedColor(theme) }}>
            {offer.blurb}
          </p>
        )}
        {offer.coupon_code && (
          <div className="mt-auto flex items-center gap-2 pt-5">
            <Chip theme={theme}>
              <Tag className="size-3" />
              <span className="font-mono tracking-wider">{offer.coupon_code}</span>
            </Chip>
            <button
              type="button"
              onClick={() => onApply(offer.coupon_code!)}
              disabled={applied}
              className="kp-button ml-auto text-[13px] underline-offset-4 hover:underline disabled:no-underline"
              style={{
                color: applied ? accentInk(theme) : theme.primary_color,
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              {applied ? "Applied" : "Use this"}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function Fact({
  theme,
  index,
  icon: Icon,
  title,
  body,
}: {
  theme: ThemeConfig
  index: number
  icon: React.ComponentType<{
    className?: string
    style?: React.CSSProperties
  }>
  title: string
  body: string
}) {
  // Stacked on a phone, side by side above it — so the rule between cells has to change
  // edge at the same breakpoint the grid does.
  return (
    <div
      className="p-6 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-l"
      style={{
        borderColor: hairline(theme, 1),
        borderTopColor: index === 0 ? "transparent" : undefined,
      }}
    >
      <Icon className="size-4" style={{ color: accentInk(theme) }} />
      <div className="mt-3 text-[15px]" style={{ color: inkColor(theme) }}>
        {title}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: mutedColor(theme) }}>
        {body}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// the confirmation
// ---------------------------------------------------------------------------

/**
 * The end of the flow, and the only screen a guest is likely to screenshot.
 *
 * So the reference is the largest thing on it, the arrival and departure are stated as
 * times rather than dates alone, and what happens next is spelled out — that last part is a
 * real sequence, which is the only reason it is numbered.
 */
/**
 * The screen a guest sees between leaving PhonePe's hosted page and either landing on
 * `Confirmed` (once `status` turns "paid", handled by the effect that owns this step in
 * `BookPage`) or being offered a retry. `status === "pending"` covers both "still polling"
 * and "the first request hasn't come back yet" — there is nothing useful to tell those apart.
 */
function PaymentPending({
  theme,
  status,
  onCheckAgain,
  onRetry,
  retrying,
}: {
  theme: ThemeConfig
  status: "pending" | "failed"
  onCheckAgain: () => void
  onRetry: () => void
  retrying: boolean
}) {
  const t = tokensFor(theme)
  const muted = mutedColor(theme)

  if (status === "failed") {
    return (
      <div className="mx-auto max-w-md p-8 text-center" style={t.surface as React.CSSProperties}>
        <X className="mx-auto size-7" style={{ color: accentInk(theme) }} />
        <PanelTitle theme={theme} className="mt-4">
          Payment didn't go through
        </PanelTitle>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed" style={{ color: muted }}>
          Nothing was booked and nothing was charged. You can try again with the same details.
        </p>
        <div className="mt-6">
          <Button theme={theme} onClick={onRetry} disabled={retrying}>
            {retrying ? <Loader2 className="size-4 animate-spin" /> : null}
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-8 text-center" style={t.surface as React.CSSProperties}>
      <Loader2 className="mx-auto size-7 animate-spin" style={{ color: accentInk(theme) }} />
      <PanelTitle theme={theme} className="mt-4">
        Waiting for payment confirmation
      </PanelTitle>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed" style={{ color: muted }}>
        This updates on its own once PhonePe confirms your payment. If you already completed it
        and this is still showing, tap check again.
      </p>
      <div className="mt-6">
        <Button theme={theme} tone="quiet" onClick={onCheckAgain}>
          Check again
        </Button>
      </div>
    </div>
  )
}

function Confirmed({
  confirmation,
  theme,
  backHref,
}: {
  confirmation: Confirmation
  theme: ThemeConfig
  backHref: string
}) {
  const t = tokensFor(theme)
  const fonts = FONT_SETS[theme.font_set]
  const ink = inkColor(theme)
  const muted = mutedColor(theme)
  const paid = confirmation.payment_status === "paid"

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full"
          style={{ background: theme.accent_color }}
        >
          <Check
            className="size-7"
            style={{ color: readableOn(theme.accent_color) }}
            strokeWidth={2.5}
          />
        </div>
        <h1
          className="mt-6 text-[clamp(1.75rem,5vw,2.5rem)] leading-tight"
          style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
        >
          {paid ? "You're booked and paid" : "Your room is held"}
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: muted }}>
          {confirmation.property.name} is expecting you, {confirmation.guest_name}.
        </p>
      </div>

      <div className="mt-8 overflow-hidden" style={t.surface as React.CSSProperties}>
        <div className="p-6 text-center" style={{ background: alpha(theme.primary_color, 0.09) }}>
          <Eyebrow theme={theme}>Your reference</Eyebrow>
          <div
            className="mt-2 font-mono text-[clamp(1.5rem,6vw,2rem)] leading-none tracking-[0.14em]"
            style={{ color: ink }}
          >
            {confirmation.reference}
          </div>
        </div>

        <div
          className="grid sm:grid-cols-2"
          style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}
        >
          <div className="p-6">
            <Eyebrow theme={theme}>Arrive</Eyebrow>
            <div
              className="mt-2 text-[19px]"
              style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
            >
              {format(parseISO(confirmation.check_in), "EEEE d MMMM")}
            </div>
            <div className="mt-1 text-[13px]" style={{ color: muted }}>
              From {confirmation.check_in_time}
            </div>
          </div>
          <div className="p-6 sm:border-l" style={{ borderColor: hairline(theme, 1) }}>
            <Eyebrow theme={theme}>Depart</Eyebrow>
            <div
              className="mt-2 text-[19px]"
              style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
            >
              {format(parseISO(confirmation.check_out), "EEEE d MMMM")}
            </div>
            <div className="mt-1 text-[13px]" style={{ color: muted }}>
              By {confirmation.check_out_time}
            </div>
          </div>
        </div>

        <dl
          className="space-y-2.5 p-6 text-[14px]"
          style={{ borderTop: `1px solid ${hairline(theme, 1)}` }}
        >
          <Row
            label="Stay"
            value={`${plural(confirmation.nights, "night")} · ${plural(confirmation.rooms.length, "room")}`}
            theme={theme}
          />
          <Row
            label="Room charges"
            value={money(confirmation.amount_before_tax, confirmation.currency)}
            theme={theme}
          />
          <Row label="Taxes" value={money(confirmation.tax, confirmation.currency)} theme={theme} />
          <div
            className="flex items-baseline justify-between gap-3 pt-3"
            style={{ borderTop: `1px solid ${hairline(theme, 2)}` }}
          >
            <dt style={{ color: ink }}>{paid ? "Total paid" : "Total, payable at the hotel"}</dt>
            <dd
              className="text-[24px] leading-none tabular-nums"
              style={{ ...t.heading, fontFamily: fonts.display, color: ink }}
            >
              {money(confirmation.amount_after_tax, confirmation.currency)}
            </dd>
          </div>
        </dl>
      </div>

      <section className="mt-8">
        <PanelTitle theme={theme}>What happens next</PanelTitle>
        <ol className="mt-4 space-y-4">
          {[
            "A confirmation is on its way to the email or number you gave us.",
            "Show your reference at the desk when you arrive. Bring photo ID.",
            paid
              ? "Nothing more to settle — your stay is paid in full."
              : "Settle the whole bill at the hotel when you check out.",
          ].map((line, i) => (
            <li key={line} className="flex gap-4">
              <span
                className="flex size-7 shrink-0 items-center justify-center text-[13px] tabular-nums"
                style={{
                  border: `1px solid ${hairline(theme, 3)}`,
                  borderRadius: 9999,
                  color: muted,
                }}
              >
                {i + 1}
              </span>
              <span className="pt-1 text-[14.5px] leading-relaxed" style={{ color: ink }}>
                {line}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button theme={theme} tone="quiet" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print this page
        </Button>
        <Link
          to={backHref}
          className="kp-button inline-flex items-center px-1 text-[15px] underline-offset-4 hover:underline"
          style={{ color: muted }}
        >
          Back to {confirmation.property.name}
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value, theme }: { label: string; value: string; theme: ThemeConfig }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: mutedColor(theme) }}>{label}</dt>
      <dd className="text-right tabular-nums" style={{ color: inkColor(theme) }}>
        {value}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// small shared pieces
// ---------------------------------------------------------------------------

function Notice({
  theme,
  children,
  urgent,
  onDismiss,
}: {
  theme: ThemeConfig
  children: React.ReactNode
  urgent?: boolean
  onDismiss?: () => void
}) {
  const t = tokensFor(theme)
  return (
    <div
      role={urgent ? "alert" : "status"}
      className="mb-5 flex items-start gap-3 p-4"
      style={{
        ...(t.surface as React.CSSProperties),
        borderLeft: `3px solid ${accentInk(theme)}`,
      }}
    >
      <span className="flex-1 text-[14px] leading-relaxed" style={{ color: inkColor(theme) }}>
        {children}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="kp-button shrink-0"
          style={{
            color: mutedColor(theme),
            background: "transparent",
            border: "none",
            padding: 2,
          }}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

function EmptyResults({ theme, onChange }: { theme: ThemeConfig; onChange: () => void }) {
  const t = tokensFor(theme)
  return (
    <div className="p-10 text-center" style={t.surface as React.CSSProperties}>
      <CalendarX2 className="mx-auto size-7" style={{ color: mutedColor(theme) }} />
      <PanelTitle theme={theme} className="mt-4">
        Nothing free for those dates
      </PanelTitle>
      <p
        className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed"
        style={{ color: mutedColor(theme) }}
      >
        Every room is taken for the nights you asked for. Shifting your arrival by a day, or asking
        for fewer rooms, usually finds something.
      </p>
      <div className="mt-6">
        <Button theme={theme} onClick={onChange}>
          Change the dates
        </Button>
      </div>
    </div>
  )
}

/** The summary, brought up from the bottom of a phone screen. */
function Sheet({
  theme,
  onClose,
  children,
}: {
  theme: ThemeConfig
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        aria-label="Close the summary"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        style={{ border: "none" }}
      />
      <div
        className="relative max-h-[85vh] overflow-y-auto p-4"
        style={{
          ...(popoverSurface(theme) as React.CSSProperties),
          borderRadius: `${Math.max(theme.radius, 16)}px ${Math.max(theme.radius, 16)}px 0 0`,
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="kp-button flex size-9 items-center justify-center rounded-full"
            style={{
              background: theme.dark_mode ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.92)",
              color: theme.dark_mode ? "#fff" : "#111",
              border: "none",
            }}
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
