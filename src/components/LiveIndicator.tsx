"use client";

export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
      </span>
      EN DIRECTO
    </span>
  );
}
