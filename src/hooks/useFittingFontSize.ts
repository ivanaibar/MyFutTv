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
 * Re-runs when `text` changes or when the element resizes.
 */
export function useFittingFontSize(text: string, opts: FitOptions = {}) {
  const { maxLines = 2, initialRem = 1, minRem = 0.6, step = 0.05 } = opts;
  const ref = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Fix 2: guard against unbounded loop when step is 0 or negative
    if (step <= 0) return;

    // Reset any previous clamp/overflow
    el.style.display = "block";
    el.style.overflow = "visible";
    el.style.webkitLineClamp = "unset";
    el.style.webkitBoxOrient = "unset";
    el.style.fontSize = `${initialRem}rem`;

    // Fix 1: getComputedStyle().lineHeight can return "normal" (NaN after parseFloat)
    const rawLineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const lineHeight = isNaN(rawLineHeight) ? initialRem * 16 * 1.2 : rawLineHeight;
    const maxHeight = lineHeight * maxLines;

    let size = initialRem;
    while (el.scrollHeight > maxHeight + 1 && size > minRem) {
      size = Math.max(parseFloat((size - step).toFixed(3)), minRem);
      el.style.fontSize = `${size}rem`;
    }

    if (el.scrollHeight > maxHeight + 1) {
      // Still overflows at minimum — apply line-clamp
      el.style.display = "-webkit-box";
      el.style.webkitBoxOrient = "vertical";
      el.style.webkitLineClamp = String(maxLines);
      el.style.overflow = "hidden";
    }
  }, [maxLines, initialRem, minRem, step]);

  // text is a dep to re-trigger when the displayed name changes;
  // fit() reads the DOM directly, not the text value
  useEffect(() => {
    fit();
  }, [text, fit]);

  // Re-fit when element resizes (viewport change, etc.)
  // Fix 3: observe el directly — a span reflows when its container changes width,
  // so observing the span itself is sufficient and avoids stale parent references
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  return { ref };
}
