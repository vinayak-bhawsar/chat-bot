import AppLayout from "@/components/layout/AppLayout";

interface ConversationPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const resolvedParams = await params;
  return <AppLayout initialConversationId={resolvedParams.id} />;
}
