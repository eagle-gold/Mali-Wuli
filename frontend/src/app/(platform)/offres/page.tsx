import { Suspense } from "react";
import OffresPage from "@/components/offres/OffresPage";
import { Chargement } from "@/components/community/CommunityUi";

export default function PageOffres() {
  return <Suspense fallback={<Chargement texte="Chargement des offres…" />}><OffresPage /></Suspense>;
}
