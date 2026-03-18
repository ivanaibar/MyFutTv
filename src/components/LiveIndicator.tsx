"use client";

export function LiveIndicator() {
  return (
    <span className="badge badge-error gap-1.5 text-xs font-bold animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-error-content" />
      EN DIRECTO
    </span>
  );
}
