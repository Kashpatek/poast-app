import RouteChrome from "../route-chrome";

// POAST Studio has no native back-to-hub link and a "library" button occupies
// its top-left, so the Back-to-POAST pill goes top-right. Classic = no-op.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RouteChrome showBack backSide="right">{children}</RouteChrome>;
}
