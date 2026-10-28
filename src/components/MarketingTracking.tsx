import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { recordMarketingConsent } from "@/lib/marketing.functions";
import { loadMarketingTags, MARKETING_CONSENT_KEY, revokeMarketingConsent, type MarketingConsent } from "@/lib/ad-tracking";

const SYNC_KEY = "livronauta_consent_synced";

export function MarketingTracking() {
  const href = useRouterState({ select: (state) => state.location.href });
  const { user } = useAuth();
  const record = useServerFn(recordMarketingConsent);
  const [consent, setConsent] = useState<MarketingConsent>(null);
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(MARKETING_CONSENT_KEY) as MarketingConsent;
    setConsent(saved);
    setDecided(saved === "granted" || saved === "denied");
    if (saved === "granted") void loadMarketingTags();
  }, []);

  useEffect(() => {
    if (consent === "granted") void loadMarketingTags();
  }, [href, consent]);

  // Persist the signed-in visitor's choice server-side so delayed payment reports honor it.
  useEffect(() => {
    if (!user || (consent !== "granted" && consent !== "denied")) return;
    const marker = `${user.id}:${consent}`;
    if (localStorage.getItem(SYNC_KEY) === marker) return;
    record({ data: { choice: consent, source: "banner" } })
      .then(() => localStorage.setItem(SYNC_KEY, marker))
      .catch(() => {});
  }, [user, consent, record]);

  const choose = (value: Exclude<MarketingConsent, null>) => {
    localStorage.setItem(MARKETING_CONSENT_KEY, value);
    setConsent(value);
    setDecided(true);
    if (value === "granted") void loadMarketingTags();
    else if (consent === "granted") {
      const finish = () => revokeMarketingConsent();
      if (user) record({ data: { choice: "denied", source: "banner" } }).then(() => localStorage.setItem(SYNC_KEY, `${user.id}:denied`)).finally(finish);
      else finish();
    }
  };

  return (
    <>
      {!decided && (
        <aside className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-md border border-border bg-card p-4 text-card-foreground shadow-xl" aria-label="Preferências de cookies">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Cookies, do seu jeito</p>
              <p className="text-sm text-muted-foreground">
                Com sua permissão, usamos cookies para medir e melhorar nossos anúncios. Você pode escolher agora e mudar de ideia quando quiser.{" "}
                <a href="/privacidade" className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Saiba mais</a>
              </p>
            </div>
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
