import { useCallback, useEffect, useRef } from "react";

const IDLE_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];

export function useIdleTimeout({ timeoutMs = 15 * 60 * 1000, onTimeout, enabled = true }) {
  const timerRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onTimeoutRef.current?.(), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) { clearTimeout(timerRef.current); return undefined; }

    reset();
    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [enabled, reset]);
}
