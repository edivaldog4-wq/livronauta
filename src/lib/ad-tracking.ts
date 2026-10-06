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

export async function loadMarketingTags() {
  if (loaded || localStorage.getItem(MARKETING_CONSENT_KEY) !== "granted") return;
  const { data } = await supabase.from("platform_settings").select("key,value").in("key", ["meta_pixel_id", "google_ads_id"]);
  const values = Object.fromEntries((data ?? []).map((entry) => [entry.key, entry.value]));
  const metaId = /^\d{8,20}$/.test(values.meta_pixel_id ?? "") ? values.meta_pixel_id : "";
  const googleId = /^AW-\d{8,14}$/.test(values.google_ads_id ?? "") ? values.google_ads_id : "";
  if (googleId) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
    window.gtag("js", new Date());
    window.gtag("config", googleId, { send_page_view: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`;
    document.head.appendChild(script);
  }
  if (metaId) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    } as Window["fbq"];
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
  if (localStorage.getItem(MARKETING_CONSENT_KEY) !== "granted") return;
  window.gtag?.("event", "page_view", { page_location: window.location.href, page_title: document.title });
  window.fbq?.("track", "PageView");
}

export function trackMarketingEvent(metaEvent: string, googleEvent: string) {
  if (localStorage.getItem(MARKETING_CONSENT_KEY) !== "granted") return;
  window.gtag?.("event", googleEvent);
  window.fbq?.("track", metaEvent);
}