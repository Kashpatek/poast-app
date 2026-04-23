import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "./error-boundary";
import { ToastProvider } from "./toast-context";
import { UserProvider } from "./user-context";
import { DialogProvider } from "./dialog-context";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <UserProvider>
            <ToastProvider>
              <DialogProvider>{children}</DialogProvider>
            </ToastProvider>
          </UserProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
