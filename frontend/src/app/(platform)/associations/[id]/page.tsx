import FicheAssociation from "@/components/associations/FicheAssociation";
export default async function AssociationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheAssociation associationId={id} />;
}
