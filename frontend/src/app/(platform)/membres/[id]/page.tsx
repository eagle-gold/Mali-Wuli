import ProfilMembre from "@/components/profile/ProfilMembre";

export default async function MembrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfilMembre membreId={id} />;
}
