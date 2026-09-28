import FormulaireEvenement from "@/components/evenements/FormulaireEvenement";

export default async function ProposerEvenementPage({ searchParams }: { searchParams: Promise<{ modifier?: string | string[] }> }) {
  const recherche = await searchParams;
  const evenementId = typeof recherche.modifier === "string" ? recherche.modifier : undefined;
  return <FormulaireEvenement key={evenementId || "nouveau"} evenementId={evenementId} />;
}
