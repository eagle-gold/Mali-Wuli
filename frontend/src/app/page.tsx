import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import LandingArbre from "@/components/landing/LandingArbre";

const heading = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-landing-heading", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-landing-body", display: "swap" });

export const metadata: Metadata = {
  title: "Mali Wuli — L’arbre des Maliens d’ici et d’ailleurs",
  description: "Au Mali ou dans la diaspora, ajoutez votre feuille au réseau Mali Wuli : rencontres, mentorat, emploi et entraide. Créez votre profil gratuitement.",
};

export default function HomePage() {
  return <div className={`${heading.variable} ${body.variable}`}><LandingArbre /></div>;
}
