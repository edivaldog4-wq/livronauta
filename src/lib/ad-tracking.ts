import { supabase } from "@/integrations/supabase/client";

export type MarketingConsent = "granted" | "denied" | null;
export const MARKETING_CONSENT_KEY = "livronauta_marketing_consent";
const CHECKOUT_FIRED_KEY = "livronauta_ic_fired";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string; disablePushState?: boolean };
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let loaded = false;
let loading: Promise<void> | null = null;
let lastPage = "";
// Page views are measured only on public pages; the plan page only allows the explicit checkout event.
const publicPaths = new Set(["/", "/auth", "/ajuda", "/privacidade", "/termos"]);

export const hasMarketingConsent = () => localStorage.getItem(MARKETING_CONSENT_KEY) === "granted";
export function canTrackMarketing() {
  return hasMarketingConsent() && publicPaths.has(window.location.pathname);
}

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
/** Meta browser identifiers, only with advertising consent. Never fabricated. */
export function metaBrowserIds() {
  if (!hasMarketingConsent()) return { fbp: null, fbc: null };
  return { fbp: readCookie("_fbp"), fbc: readCookie("_fbc") };
}

export async function loadMarketingTags() {
  if (!canTrackMarketing()) return;
  await ensureTags();
  trackPageView();
}

async function ensureTags() {
  if (!hasMarketingConsent()) return;
  if (loaded) return;
  if (loading) return loading;
  loading = initializeTags();
  try { await loading; } finally { loading = null; }
}

async function initializeTags() {
  const { data } = await supabase.from("platform_settings").select("key,value").in("key", ["meta_pixel_id", "google_ads_id"]);
  if (!hasMarketingConsent()) return;
  const values = Object.fromEntries((data ?? []).map((entry) => [entry.key, entry.value]));
  const metaId = /^\d{8,20}$/.test(values.meta_pixel_id ?? "") ? values.meta_pixel_id : "";
  const googleId = /^AW-\d{8,14}$/.test(values.google_ads_id ?? "") ? values.google_ads_id : "";
  if (googleId) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function () { window.dataLayer?.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", googleId, { send_page_view: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`;
    document.head.appendChild(script);
  }
  if (metaId && !window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
      else fbq.queue?.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.disablePushState = true; // no automatic page views on private pages
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/pt_BR/fbevents.js";
    document.head.appendChild(script);
    fbq("set", "autoConfig", false, metaId); // no automatic button/form collection
    fbq("init", metaId, {}, { agent: "lovable" });
  }
  loaded = true;
}

export function trackPageView() {
  if (!loaded || !canTrackMarketing()) return;
  const page = window.location.origin + window.location.pathname;
  if (lastPage === page) return;
  lastPage = page;
  window.gtag?.("event", "page_view", { page_location: page, page_title: document.title });
  window.fbq?.("track", "PageView");
}

export function revokeMarketingConsent() {
  window.fbq?.("consent", "revoke");
  window.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  window.location.reload();
}

export function trackMarketingEvent(metaEvent: string, googleEvent: string) {
  if (!loaded || !canTrackMarketing()) return;
  window.gtag?.("event", googleEvent);
  window.fbq?.("track", metaEvent);
}

/** Decides whether InitiateCheckout should fire for this charge (once per charge per browser). */
export function shouldFireCheckout(paymentId: string, value: number, fired: string[]) {
  return /^[A-Za-z0-9_-]{1,100}$/.test(paymentId) && Number.isFinite(value) && value > 0 && !fired.includes(paymentId);
}

/** InitiateCheckout for a real, opened Asaas charge. Fire-and-forget: never blocks checkout. */
export function trackInitiateCheckout(paymentId: string, value: number) {
  void (async () => {
    try {
      if (!hasMarketingConsent() || window.location.pathname !== "/plan") return;
      const fired: string[] = JSON.parse(sessionStorage.getItem(CHECKOUT_FIRED_KEY) ?? "[]");
      if (!shouldFireCheckout(paymentId, value, fired)) return;
      sessionStorage.setItem(CHECKOUT_FIRED_KEY, JSON.stringify([...fired, paymentId].slice(-20)));
      await ensureTags();
      if (!hasMarketingConsent()) return;
      const params = { value: Math.round(value * 100) / 100, currency: "BRL", content_name: "Livronauta Pro" };
      window.fbq?.("track", "InitiateCheckout", params, { eventID: `ic_${paymentId}` });
      window.gtag?.("event", "begin_checkout", { value: params.value, currency: "BRL" });
    } catch { /* marketing never affects billing */ }
  })();
}
