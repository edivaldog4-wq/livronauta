import { useEffect, useRef, useState } from "react";
import { createContactChallenge } from "@/lib/contact.functions";

export function ContactCaptcha({ onVerified }: { onVerified: (payload: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let widget: HTMLElement | undefined;
    const verified = (event: Event) => {
      const payload = (event as CustomEvent<{ payload?: string }>).detail?.payload;
      if (payload) onVerified(payload);
    };
    const setup = async () => {
      try {
        const [, , challenge] = await Promise.all([
          import("altcha"), import("altcha/i18n/pt-br"), createContactChallenge(),
        ]);
        if (disposed || !container.current) return;
        const element = document.createElement("altcha-widget");
        widget = element;
        element.addEventListener("verified", verified);
        element.setAttribute("challenge", JSON.stringify(challenge));
        element.setAttribute("language", "pt-br");
        container.current.replaceChildren(element);
      } catch {
        if (!disposed) setError(true);
      }
    };
    void setup();
    return () => {
      disposed = true;
      widget?.removeEventListener("verified", verified);
      widget?.remove();
    };
  }, [onVerified]);

  return <div className="min-h-20" ref={container} aria-live="polite">
    <p className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      {error ? "Não foi possível carregar a verificação. Feche e tente novamente." : "Carregando verificação..."}
    </p>
  </div>;
}