import ProfilPublic from "@/components/directory/ProfilPublic";
export default async function MembrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfilPublic profilId={id} />;
}
