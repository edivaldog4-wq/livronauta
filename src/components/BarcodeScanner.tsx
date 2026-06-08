import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const mod = await import("html5-qrcode");
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod as any;
      if (cancelled || !ref.current) return;
      const id = "scanner-region";
      ref.current.id = id;
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
      const scanner = new Html5Qrcode(id, { formatsToSupport: formats, verbose: false });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (vw: number, vh: number) => {
              const min = Math.min(vw, vh);
              const w = Math.floor(min * 0.85);
              return { width: w, height: Math.floor(w * 0.5) };
            },
            aspectRatio: 1.7777,
            disableFlip: false,
          },
          (decoded: string) => {
            onResult(decoded);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {},
        );
      } catch (e) {
        console.error("Scanner error", e);
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
  }, [open, onClose, onResult]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Escanear código</DialogTitle></DialogHeader>
        <div className="rounded-lg overflow-hidden bg-black">
          <div ref={ref} style={{ width: "100%", minHeight: 320 }} />
        </div>
        <p className="text-xs text-muted-foreground">
          Aponte a câmera para o código de barras (EAN-13) do livro, mantendo o código centralizado e com boa iluminação. Funciona melhor a ~10–15 cm de distância.
        </p>
      </DialogContent>
    </Dialog>
  );
}
