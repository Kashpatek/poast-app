import RouteChrome from "../route-chrome";

// Standalone (new-tab) route. This shell has no native back-to-hub link, so it
// opts into the floating Back-to-POAST pill (top-left is free here). Classic is
// a no-op pass-through (see route-chrome.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RouteChrome showBack>{children}</RouteChrome>;
}
