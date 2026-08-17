import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/toast";
import { ClientProviders } from "@/components/ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "弓道的中管理",
  description: "弓道部の的中データを管理・分析するツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-50 text-stone-900">
        <ClientProviders>
          <Navigation />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
          <Toaster />
        </ClientProviders>
      </body>
    </html>
  );
}
