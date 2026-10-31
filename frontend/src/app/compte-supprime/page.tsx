import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import CoqueAuth from "@/components/auth/CoqueAuth";
import { classesBouton } from "@/components/ui/classes";

export const metadata: Metadata = { title: "Compte supprimé — Mali Wuli", robots: { index: false } };

export default function CompteSupprimePage() {
  return (
    <CoqueAuth titre="Votre compte a été supprimé" sousTitre="Vos données personnelles ont été effacées de Mali Wuli. Merci d’avoir fait partie du réseau.">
      <div className="-mt-2 mb-7 flex justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-raised"><Check size={30} strokeWidth={2.8} aria-hidden="true" /></span>
      </div>
      <Link href="/" className={classesBouton({ taille: "lg", pleineLargeur: true })}>Retour à l’accueil</Link>
      <p className="mt-5 text-center text-sm text-ink-muted">
        Vous pourrez toujours <Link href="/register" className="font-semibold text-brand underline-offset-4 hover:underline">créer un nouveau compte</Link>.
      </p>
    </CoqueAuth>
  );
}
