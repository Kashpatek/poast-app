"use client";
// Shared touch / small-screen detector. On mobile there's no hover, and
// side-by-side layouts (rail + grid) don't fit — components switch to stacked,
// tap-driven variants when this is true. SSR-safe: starts false, settles on mount.
import { useEffect, useState } from "react";

export function useIsMobile(query = "(max-width: 760px)"): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return mobile;
}
