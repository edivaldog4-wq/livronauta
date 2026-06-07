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
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled || !ref.current) return;
      const id = "scanner-region";
      ref.current.id = id;
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
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
          <div ref={ref} style={{ width: "100%", minHeight: 300 }} />
        </div>
        <p className="text-xs text-muted-foreground">Aponte a câmera para o código de barras ou QR Code do livro.</p>
      </DialogContent>
    </Dialog>
  );
}
