import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "./error-boundary";
import { ToastProvider } from "./toast-context";
import { UserProvider } from "./user-context";
import { ThemeProvider } from "./theme-context";
import { DialogProvider } from "./dialog-context";
import { OnboardingProvider } from "./onboarding-context";

// Pre-hydration: set data-theme/data-bg from the saved pref BEFORE first paint.
// Default is Fresh (stock) — Classic only shows when the user has explicitly
// saved it. This fallback MUST match the static <html data-theme> attribute
// below and the ThemeProvider defaults so a no-pref visit has no flash/mismatch.
const THEME_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem('poast-theme')||'{}');var r=document.documentElement;var t=['classic','stock','glass'].indexOf(p.theme)>=0?p.theme:'stock';var b=['aurora','cockpit','iridescent'].indexOf(p.bg)>=0?p.bg:'aurora';r.setAttribute('data-theme',t);r.setAttribute('data-bg',b);}catch(e){}})();`;

// The Glass frosted-glass rule MUST live in a runtime <style>, not an imported
// .css file: the build CSS transform (Lightning/Turbopack) strips `backdrop-filter`
// from stylesheet rules (no browserslist → treated as unsupported), leaving an
// empty rule. Inline <style> text isn't run through that transform, so the blur
// survives verbatim and still reads --frost (the appearance slider). Any element
// tagged .lg or [data-glass] becomes frosted glass under the Glass theme.
const GLASS_FROST = `
[data-theme="glass"] .lg,
[data-theme="glass"] [data-glass]{
  -webkit-backdrop-filter:blur(var(--frost,14px)) saturate(1.4) brightness(1.03);
  backdrop-filter:blur(var(--frost,14px)) saturate(1.4) brightness(1.03);
}
@media (prefers-reduced-transparency: reduce){
  [data-theme="glass"] .lg,[data-theme="glass"] [data-glass]{
    -webkit-backdrop-filter:none;backdrop-filter:none;
  }
}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POAST // Content Command Center",
  description: "The content production suite for SemiAnalysis",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="stock"
      data-bg="aurora"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <style dangerouslySetInnerHTML={{ __html: GLASS_FROST }} />
        <ErrorBoundary>
          <UserProvider>
            <ThemeProvider>
              <ToastProvider>
                <DialogProvider>
                  <OnboardingProvider>{children}</OnboardingProvider>
                </DialogProvider>
              </ToastProvider>
            </ThemeProvider>
          </UserProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
