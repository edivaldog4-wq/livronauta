import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod as any;
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];
        const scanner = new Html5Qrcode("scanner-region", {
          formatsToSupport: formats,
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (vw: number, vh: number) => {
              const min = Math.min(vw, vh);
              const w = Math.floor(min * 0.8);
              return { width: w, height: Math.floor(w * 0.45) };
            },
            aspectRatio: 1.7777,
            disableFlip: false,
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          (decoded: string) => {
            try {
              onResult(decoded);
            } finally {
              scanner.stop().catch(() => {});
            }
          },
          () => {},
        );
      } catch (e: any) {
        console.error("Scanner error", e);
        if (!cancelled) {
          setError(
            e?.message?.includes("Permission")
              ? "Permissão de câmera negada. Conceda acesso à câmera no navegador."
              : "Não foi possível iniciar a câmera. Use o envio de imagem ou digite o código manualmente.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear().catch(() => {}));
        scannerRef.current = null;
      }
    };
  }, [open, onResult]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const mod = await import("html5-qrcode");
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod as any;
      const tempId = "scanner-file-region";
      let el = document.getElementById(tempId);
      if (!el) {
        el = document.createElement("div");
        el.id = tempId;
        el.style.display = "none";
        document.body.appendChild(el);
      }
      const fs = new Html5Qrcode(tempId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      const decoded = await fs.scanFile(file, true);
      onResult(decoded);
    } catch (err: any) {
      setError("Não foi possível ler o código da imagem. Tente outra foto com melhor iluminação e enquadramento.");
    }
  };

  const submitManual = () => {
    const v = manual.trim();
    if (v.length >= 8) {
      onResult(v);
      setManual("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))] w-full max-h-[92dvh] p-4 sm:p-6 flex flex-col overflow-hidden gap-0">
        <DialogHeader className="shrink-0 pb-3">
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0 rounded-lg overflow-hidden bg-black border border-border/50" style={{ height: 220, maxHeight: "40dvh" }}>
          <div
            ref={ref}
            id="scanner-region"
            className="absolute inset-0 w-full h-full [&_video]:!w-full [&_video]:!h-full [&_video]:object-cover [&_canvas]:!w-full [&_canvas]:!h-full [&_img]:!w-full [&_img]:!h-full"
          />
        </div>

        <div className="shrink-0 pt-3 min-h-0 overflow-y-auto">
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <p className="text-xs text-muted-foreground mb-3">
            Centralize o código de barras EAN-13 horizontalmente, a ~10–20 cm da câmera, com boa luz.
            Se a câmera não capturar, envie uma foto ou digite o código.
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Enviar foto do código</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={handleFile} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Digitar código manualmente</Label>
              <div className="flex gap-2">
                <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="ISBN ou EAN" inputMode="numeric" />
                <Button type="button" onClick={submitManual}>Buscar</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
