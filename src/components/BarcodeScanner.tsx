import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUPPORTED_BARCODE_LENGTHS = new Set([8, 10, 12, 13, 14]);

function normalizeScannedCode(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s-]/g, "");
  if (/^\d+$/.test(compact)) return compact;
  if (/^\d{9}[\dXx]$/.test(compact)) return compact.toUpperCase();
  return trimmed;
}

async function buildReader() {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints as any, { delayBetweenScanAttempts: 80 } as any);
}

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const decodedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    decodedRef.current = false;
    setError(null);
    setCameraReady(false);

    (async () => {
      try {
        const reader = await buildReader();
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current,
          (result: any) => {
            if (decodedRef.current || !result) return;
            const code = normalizeScannedCode(result.getText?.() ?? String(result));
            if (!code) return;
            decodedRef.current = true;
            try {
              onResultRef.current(code);
            } finally {
              try { controls.stop(); } catch { /* noop */ }
            }
          },
        );
        controlsRef.current = controls;
        if (cancelled) {
          try { controls.stop(); } catch { /* noop */ }
          return;
        }
        setCameraReady(true);
        try {
          await (controls as any).switchTorch?.(false);
        } catch { /* noop */ }
      } catch (e: any) {
        console.error("Scanner error", e);
        if (!cancelled) {
          setError(
            String(e?.name ?? "").includes("NotAllowed") || e?.message?.includes("Permission")
              ? "Permissão de câmera negada. Conceda acesso à câmera no navegador."
              : "Não foi possível iniciar a câmera. Use o envio de imagem ou digite o código manualmente.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      setCameraReady(false);
      const c = controlsRef.current;
      controlsRef.current = null;
      if (c) { try { c.stop(); } catch { /* noop */ } }
    };
  }, [open]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const reader = await buildReader();
      const result = await reader.decodeFromImageUrl(url);
      const decoded = normalizeScannedCode(result.getText());
      if (!decoded) throw new Error("Código vazio");
      onResultRef.current(decoded);
    } catch {
      setError("Não foi possível ler o código da imagem. Tente outra foto com melhor iluminação e enquadramento.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const submitManual = () => {
    const v = normalizeScannedCode(manual);
    if (SUPPORTED_BARCODE_LENGTHS.has(v.length)) {
      onResultRef.current(v);
      setManual("");
    } else {
      setError("Digite a sequência completa do código (8, 10, 12, 13 ou 14 caracteres).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))] w-full max-h-[92dvh] p-4 sm:p-6 flex flex-col overflow-hidden gap-0">
        <DialogHeader className="shrink-0 pb-3">
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0 rounded-lg overflow-hidden bg-black border border-border/50" style={{ height: 220, maxHeight: "40dvh" }}>
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-x-[5%] top-1/2 h-px bg-destructive shadow-sm" />
          {!cameraReady && !error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
              Iniciando câmera…
            </div>
          )}
        </div>

        <div className="shrink-0 pt-3 min-h-0 overflow-y-auto">
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <p className="text-xs text-muted-foreground mb-3">
            Alinhe toda a largura do código horizontalmente com a linha vermelha e aproxime até as barras ficarem nítidas.
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
