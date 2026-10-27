import { supabase } from "@/integrations/supabase/client";

export type MarketingConsent = "granted" | "denied" | null;
export const MARKETING_CONSENT_KEY = "livronauta_marketing_consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: Window["fbq"];
  }
}

let loaded = false;
let loading: Promise<void> | null = null;
let lastPage = "";
const publicPaths = new Set(["/", "/auth", "/ajuda", "/privacidade", "/termos"]);

export function canTrackMarketing() {
  return localStorage.getItem(MARKETING_CONSENT_KEY) === "granted" && publicPaths.has(window.location.pathname);
}

export async function loadMarketingTags() {
  if (!canTrackMarketing()) return;
  if (loaded) { trackPageView(); return; }
  if (loading) return loading;
  loading = initializeTags();
  try { await loading; } finally { loading = null; }
}

async function initializeTags() {
  const { data } = await supabase.from("platform_settings").select("key,value").in("key", ["meta_pixel_id", "google_ads_id"]);
  if (!canTrackMarketing()) return;
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
  if (metaId) {
    const fbq: NonNullable<Window["fbq"]> = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    };
    if (fbq) {
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = "2.0";
      window.fbq = fbq;
      window._fbq = fbq;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/pt_BR/fbevents.js";
      document.head.appendChild(script);
      fbq("init", metaId);
    }
  }
  loaded = true;
  trackPageView();
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