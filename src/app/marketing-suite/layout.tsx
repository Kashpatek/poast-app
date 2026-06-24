import RouteChrome from "../route-chrome";

// Wraps this standalone (new-tab) route in the shared themed shell so it
// inherits the active theme's backdrop + a Back-to-POAST pill. Classic is a
// no-op pass-through (see route-chrome.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RouteChrome>{children}</RouteChrome>;
}
