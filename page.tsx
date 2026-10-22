import ChatApp from "@/components/ChatApp";

export default async function ConversationPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  return <ChatApp initialId={id} />;
}
