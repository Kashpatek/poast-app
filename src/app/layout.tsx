import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "./error-boundary";
import { ToastProvider } from "./toast-context";
import { UserProvider } from "./user-context";
import { ThemeProvider } from "./theme-context";
import { DialogProvider } from "./dialog-context";
import { OnboardingProvider } from "./onboarding-context";

// Pre-hydration: set data-theme/data-bg from the saved pref BEFORE first paint
// so returning Stock/Glass users never flash the Classic default.
const THEME_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem('poast-theme')||'{}');var r=document.documentElement;var t=['classic','stock','glass'].indexOf(p.theme)>=0?p.theme:'classic';var b=['aurora','cockpit','iridescent'].indexOf(p.bg)>=0?p.bg:'aurora';r.setAttribute('data-theme',t);r.setAttribute('data-bg',b);}catch(e){}})();`;

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
      data-theme="classic"
      data-bg="aurora"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
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
