import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Mali Wuli — Le réseau qui unit les talents du Mali",
  description:
    "Mali Wuli connecte les talents qui vivent au Mali et ceux de la diaspora pour créer des synergies concrètes : orientation, mentorat, emploi, entraide.",
  keywords: ["Mali", "diaspora", "réseau", "mentorat", "emploi", "talents"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${playfair.variable}`}>
        {children}
      </body>
    </html>
  );
}
