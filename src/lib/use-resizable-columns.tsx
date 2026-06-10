import { useCallback, useEffect, useRef, useState } from "react";

/** Persisted resizable column widths via localStorage. */
export function useResizableColumns(storageKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch { return defaults; }
  });
  const dragging = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(widths)); } catch {}
  }, [storageKey, widths]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragging.current; if (!d) return;
    const w = Math.max(60, d.startW + (e.clientX - d.startX));
    setWidths((prev) => ({ ...prev, [d.key]: w }));
  }, []);
  const onMouseUp = useCallback(() => {
    dragging.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const startResize = (key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { key, startX: e.clientX, startW: widths[key] ?? defaults[key] ?? 120 };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const reset = () => setWidths(defaults);
  return { widths, startResize, reset };
}

export function Resizer({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none bg-transparent hover:bg-primary/40"
      aria-hidden="true"
    />
  );
}
