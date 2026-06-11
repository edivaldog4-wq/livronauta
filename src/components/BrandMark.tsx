import { cn } from "@/lib/utils";

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm",
        compact ? "h-8 w-8" : "h-14 w-14",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-2 top-2 h-2 rounded-t-full border-x border-t border-current/70" />
      <div className="absolute inset-x-2 bottom-2 h-1 border-t border-current/60" />
      <div className="absolute bottom-3 top-5 left-[30%] w-px bg-current/65" />
      <div className="absolute bottom-3 top-5 right-[30%] w-px bg-current/65" />
      <span className={cn("relative font-serif font-bold leading-none", compact ? "text-base" : "text-2xl")}>L</span>
    </div>
  );
}