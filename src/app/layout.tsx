import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import QueryProvider from "@/components/providers/QueryProvider";
import "./globals.css";

import { NavigationExperienceProvider, MotionProvider, ToasterWrapper } from "@/components/experience";
import PWAInstaller from "@/components/layout/PWAInstaller";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TAS ERP - Garment Manufacturing Intelligence Platform",
  description: "Garment Manufacturing Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
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
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
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
