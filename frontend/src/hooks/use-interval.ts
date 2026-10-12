"use client";

import * as React from "react";

/**
 * Declarative `setInterval`. Pass a callback and a delay (ms). Pass `null` to
 * pause. The callback is kept fresh on every render without resetting the
 * interval.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
