import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prospection — Outil interne",
  description: "Automatisation de la prospection pour agence digitale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/campaigns"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <Image
                src="/logo.png"
                alt="Prospection"
                width={28}
                height={28}
                className="rounded"
              />
              Prospection
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-600">
              <Link href="/campaigns" className="hover:text-neutral-900">
                Campagnes
              </Link>
              <Link href="/priority" className="hover:text-neutral-900">
                ★ Prioritaires
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
