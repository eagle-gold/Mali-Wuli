import { Suspense } from "react";
import ListeEvenements from "@/components/evenements/ListeEvenements";
import { Chargement } from "@/components/community/CommunityUi";

export default function EvenementsPage() {
  return <Suspense fallback={<Chargement texte="Chargement des événements…" />}><ListeEvenements /></Suspense>;
}
