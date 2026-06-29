import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { getChatWithDetails } from '@/lib/chat/queries';
import { toUIMessages } from '@/lib/chat/to-ui-messages';
import ChatWorkspace from '@/components/chat/ChatWorkspace';

type Props = { params: Promise<{ locale: string; chatId: string }> };

const Uuid = z.string().uuid();

// /[locale]/c/[chatId] – ein Chat. Initialdaten serverseitig über dieselbe
// Stufe-1-Query laden, die auch GET /api/chats/[id] nutzt (kein HTTP-Umweg);
// Mutationen/Liste laufen clientseitig über die REST-Endpunkte.
export default async function ChatPage({ params }: Props) {
  const { locale, chatId } = await params;
  setRequestLocale(locale);

  if (!Uuid.safeParse(chatId).success) notFound();

  const chat = await getChatWithDetails(chatId);
  if (!chat) notFound();

  const initialMessages = toUIMessages(chat.messages);
  const initialDocuments = chat.documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    sourceType: doc.sourceType,
  }));

  // key={chatId} -> beim Chat-Wechsel frische useChat-Instanz (kein Vermischen).
  return (
    <ChatWorkspace
      key={chatId}
      chatId={chatId}
      initialMessages={initialMessages}
      initialDocuments={initialDocuments}
    />
  );
}
