import { useEffect, useRef, useCallback } from "react";

interface FitOptions {
  maxLines?: number;   // default: 2
  initialRem?: number; // default: 1
  minRem?: number;     // default: 0.6
  step?: number;       // default: 0.05
}

/**
 * Imperatively reduces the font size of a span until its text fits within
 * `maxLines` lines. If it still overflows at `minRem`, applies -webkit-line-clamp.
 * Re-runs when `text` changes or when the parent element resizes.
 */
export function useFittingFontSize(text: string, opts: FitOptions = {}) {
  const { maxLines = 2, initialRem = 1, minRem = 0.6, step = 0.05 } = opts;
  const ref = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Reset any previous clamp/overflow
    el.style.display = "block";
    el.style.overflow = "visible";
    (el.style as unknown as Record<string, string>).webkitLineClamp = "unset";
    (el.style as unknown as Record<string, string>).webkitBoxOrient = "unset";
    el.style.fontSize = `${initialRem}rem`;

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const maxHeight = lineHeight * maxLines;

    let size = initialRem;
    while (el.scrollHeight > maxHeight + 1 && size > minRem) {
      size = Math.max(parseFloat((size - step).toFixed(3)), minRem);
      el.style.fontSize = `${size}rem`;
    }

    if (el.scrollHeight > maxHeight + 1) {
      // Still overflows at minimum — apply line-clamp
      el.style.display = "-webkit-box";
      (el.style as unknown as Record<string, string>).webkitBoxOrient = "vertical";
      (el.style as unknown as Record<string, string>).webkitLineClamp = String(maxLines);
      el.style.overflow = "hidden";
    }
  }, [maxLines, initialRem, minRem, step]);

  // Re-fit when text changes
  useEffect(() => {
    fit();
  }, [text, fit]);

  // Re-fit when parent container resizes (viewport change, etc.)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [fit]);

  return { ref };
}
