import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { loadMarketingTags, MARKETING_CONSENT_KEY, trackPageView, type MarketingConsent } from "@/lib/ad-tracking";

export function MarketingTracking() {
  const href = useRouterState({ select: (state) => state.location.href });
  const [consent, setConsent] = useState<MarketingConsent>(null);
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(MARKETING_CONSENT_KEY) as MarketingConsent;
    setConsent(saved);
    setDecided(saved === "granted" || saved === "denied");
    if (saved === "granted") void loadMarketingTags();
  }, []);

  useEffect(() => {
    if (consent === "granted") trackPageView();
  }, [href, consent]);

  const choose = (value: Exclude<MarketingConsent, null>) => {
    localStorage.setItem(MARKETING_CONSENT_KEY, value);
    setConsent(value);
    setDecided(true);
    if (value === "granted") void loadMarketingTags();
  };

  return (
    <>
      {!decided && (
        <aside className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-md border border-border bg-card p-4 text-card-foreground shadow-xl" aria-label="Preferências de cookies">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Usamos cookies opcionais de publicidade para medir campanhas. Você pode aceitar ou recusar sem afetar o sistema.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => choose("denied")}>Recusar</Button>
              <Button size="sm" onClick={() => choose("granted")}>Aceitar</Button>
            </div>
          </div>
        </aside>
      )}
      {decided && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed bottom-3 right-3 z-40 h-8 bg-card text-xs shadow no-print"
          onClick={() => setDecided(false)}
        >
          Cookies
        </Button>
      )}
    </>
  );
}