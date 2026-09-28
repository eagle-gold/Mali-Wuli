import FicheEvenement from "@/components/evenements/FicheEvenement";

export default async function EvenementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheEvenement evenementId={id} />;
}
