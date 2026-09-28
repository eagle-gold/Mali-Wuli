import FicheEtablissement from "@/components/education/FicheEtablissement";

export default async function EtablissementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheEtablissement etablissementId={decodeURIComponent(id)} />;
}
