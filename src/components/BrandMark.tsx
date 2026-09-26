import { cn } from "@/lib/utils";

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <svg
      viewBox="214 151 895 877"
      className={cn("shrink-0", compact ? "h-8 w-8" : "h-14 w-14", className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lvn-orange" cx="49%" cy="46%" r="70%">
          <stop offset="0" stopColor="#ffad0b" />
          <stop offset="0.72" stopColor="#ffa000" />
          <stop offset="1" stopColor="#f99500" />
        </radialGradient>
      </defs>
      <rect x="214" y="151" width="895" height="877" rx="154" fill="url(#lvn-orange)" />
      <g fill="none" stroke="#090909" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
        <path d="M364 408v-15c0-52 43-95 95-95h402c53 0 96 43 96 96v14" />
        <path d="M348 849h620" />
        <path d="M492 849V471" />
        <path d="M825 849V471" />
      </g>
      <path fill="#080808" d="M538 453h165v17c-30 1-50 5-50 33v178c0 21 6 29 26 30h27c44 0 64-20 70-66h17v83H538v-13c35-3 39-10 39-37V503c0-28-6-33-39-37z" />
    </svg>
  );
}
