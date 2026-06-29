import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chats, chatDocuments, messages, documents } from '@/lib/db/schema';
import type { AnswerSource } from '@/lib/retrieval/answer';

// Zentrale DB-Zugriffe rund um Chats (Persistenz + CRUD). Jeder Zugriff läuft –
// wie im Projekt vorgeschrieben – über den Drizzle-Client. Die Route Handler
// bleiben dadurch dünn und einheitlich.

export async function createChat(title?: string) {
  // title === undefined -> Drizzle lässt die Spalte weg -> DB-Default "Neuer Chat".
  const [row] = await db.insert(chats).values({ title }).returning({ id: chats.id });
  return row;
}

// Liste für die (spätere) Sidebar: neueste zuerst.
export async function listChats() {
  return db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .orderBy(desc(chats.updatedAt));
}

// Ein Chat mit seinen zugeordneten Dokumenten UND seinem Nachrichtenverlauf.
// null, wenn es den Chat nicht gibt.
export async function getChatWithDetails(id: string) {
  const [chat] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  if (!chat) return null;

  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceType: documents.sourceType,
      createdAt: documents.createdAt,
    })
    .from(chatDocuments)
    .innerJoin(documents, eq(chatDocuments.documentId, documents.id))
    .where(eq(chatDocuments.chatId, id))
    .orderBy(desc(chatDocuments.createdAt));

  const msgs = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      sources: messages.sources,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(messages.createdAt);

  return { ...chat, documents: docs, messages: msgs };
}

export async function deleteChat(id: string): Promise<boolean> {
  // chat_documents und messages hängen per ON DELETE CASCADE -> gehen mit weg.
  const deleted = await db.delete(chats).where(eq(chats.id, id)).returning({ id: chats.id });
  return deleted.length > 0;
}

// Bestehendes Bibliotheks-Dokument einem Chat zuordnen. Dedup über den
// zusammengesetzten PK (chatId, documentId) -> erneutes Zuordnen ist ein No-op.
export async function addDocumentToChat(chatId: string, documentId: string) {
  await db.insert(chatDocuments).values({ chatId, documentId }).onConflictDoNothing();
}

export async function removeDocumentFromChat(
  chatId: string,
  documentId: string,
): Promise<boolean> {
  const removed = await db
    .delete(chatDocuments)
    .where(and(eq(chatDocuments.chatId, chatId), eq(chatDocuments.documentId, documentId)))
    .returning({ documentId: chatDocuments.documentId });
  return removed.length > 0;
}

// Ob ein Dokument in der Bibliothek existiert (für saubere 404 beim Zuordnen).
export async function documentExists(documentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return Boolean(row);
}

// Alle Bibliotheks-Dokumente (global, chat-unabhängig).
export async function listDocuments() {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      sourceType: documents.sourceType,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .orderBy(desc(documents.createdAt));
}

export async function saveUserMessage(chatId: string, content: string) {
  await db.insert(messages).values({ chatId, role: 'user', content });
}

// Assistenten-Antwort speichern und chats.updatedAt aktualisieren (atomar via batch).
export async function saveAssistantMessage(
  chatId: string,
  content: string,
  sources: AnswerSource[],
) {
  await db.batch([
    db.insert(messages).values({
      chatId,
      role: 'assistant',
      content,
      sources: sources.length > 0 ? sources : null,
    }),
    db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId)),
  ]);
}
