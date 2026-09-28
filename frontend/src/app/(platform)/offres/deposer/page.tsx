"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FormulaireOffre from "@/components/offres/FormulaireOffre";

function DepotOffre() {
  const params = useSearchParams();
  const offreId = params.get("id")?.trim() || params.get("modifier")?.trim() || undefined;
  return <FormulaireOffre key={offreId || "nouvelle"} offreId={offreId} />;
}

export default function DeposerOffrePage() {
  return <Suspense fallback={<p role="status" className="p-6">Chargement du formulaire…</p>}><DepotOffre /></Suspense>;
}
