import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import QueryProvider from "@/components/providers/QueryProvider";
import "./globals.css";
import "./splash-screen.css";

import { NavigationExperienceProvider, MotionProvider, ToasterWrapper } from "@/components/experience";
import PWAInstaller from "@/components/layout/PWAInstaller";
import SplashScreen from "@/components/experience/SplashScreen";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export const metadata: Metadata = {
  title: "TAS ERP - Garment Manufacturing Intelligence Platform",
  description: "Garment Manufacturing Intelligence Platform",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TAS ERP",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link
          rel="manifest"
          href="/manifest-light.json"
          media="(prefers-color-scheme: light)"
          data-pwa-manifest="light"
        />
        <link
          rel="manifest"
          href="/manifest-dark.json"
          media="(prefers-color-scheme: dark)"
          data-pwa-manifest="dark"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('tas-erp-theme');
                  var theme = 'system';
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.state && parsed.state.theme) {
                      theme = parsed.state.theme;
                    }
                  }
                  var resolved = theme;
                  if (theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', resolved);
                  if (resolved === 'dark') {
                    document.documentElement.classList.add('dark');
                  }

                  // Select the theme-specific PWA manifest before the app renders.
                  var manifestLinks = document.querySelectorAll('link[data-pwa-manifest]');
                  for (var i = 0; i < manifestLinks.length; i++) {
                    var link = manifestLinks[i];
                    var isMatchingTheme = link.getAttribute('data-pwa-manifest') === resolved;
                    link.setAttribute('media', isMatchingTheme ? 'all' : 'not all');
                  }

                  // Synchronous PWA splash check to prevent content flash before animation
                  var isSplashTest = new URLSearchParams(window.location.search).get('splash') === '1';
                  var isPWA = isSplashTest ||
                              window.matchMedia('(display-mode: standalone)').matches ||
                              window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                              window.matchMedia('(display-mode: fullscreen)').matches ||
                              window.matchMedia('(display-mode: minimal-ui)').matches ||
                              navigator.standalone === true ||
                              document.referrer.indexOf('android-app://') !== -1;

                  if (isSplashTest || (isPWA && !sessionStorage.getItem('tas-splash-shown'))) {
                    document.documentElement.classList.add('tas-pwa-splash');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <SplashScreen />
        <QueryProvider>
          <NavigationExperienceProvider>
            <MotionProvider>
              {children}
              <PWAInstaller />
              <ToasterWrapper />
            </MotionProvider>
          </NavigationExperienceProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
