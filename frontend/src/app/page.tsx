import type { Metadata } from "next";
import LandingArbre from "@/components/landing/LandingArbre";

export const metadata: Metadata = {
  title: "Mali Wuli — L’arbre des Maliens d’ici et d’ailleurs",
  description: "Au Mali ou dans la diaspora, ajoutez votre feuille au réseau Mali Wuli : rencontres, mentorat, emploi et entraide. Créez votre profil gratuitement.",
};

export default function HomePage() {
  return <LandingArbre />;
}
