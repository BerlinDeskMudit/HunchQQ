import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "HunchQQ — bet on anything, settle on-chain",
  description:
    "Decentralized prediction market on Solana devnet. Pooled Yes/No bets, PDA vaults, on-chain settlement. Technical demo — test tokens only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-gray-100 antialiased">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="border-t border-edge py-6 text-center text-xs text-gray-500">
            HunchQQ — devnet demo. Test tokens only, not a betting product.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
