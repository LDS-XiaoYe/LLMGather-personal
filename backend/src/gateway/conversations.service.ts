import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ConversationSessionDto, ConversationSyncDto } from './dto/conversation-sync.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listByUser(userId: string): Promise<ConversationSessionDto[]> {
    const db = this.databaseService.connection;
    const sessions = await db.prepare(
      'SELECT id, title, chat_type as chatType, updated_at as updatedAt FROM conversations WHERE user_id = ? AND (deleted_at IS NULL OR deleted_at = 0) ORDER BY updated_at DESC',
    ).all(userId) as Array<{ id: string; title: string; chatType: string; updatedAt: number | string }>;
    console.log(`[listByUser] user ${userId}, found ${sessions.length} sessions`);

    const results: ConversationSessionDto[] = [];
    for (const session of sessions) {
      const messages = await db.prepare(
        'SELECT id, role, content, reasoning, model FROM conversation_messages WHERE conversation_id = ? AND (deleted_at IS NULL OR deleted_at = 0) ORDER BY sort_order ASC',
      ).all(session.id) as Array<{ id: number | string; role: 'user' | 'assistant'; content: string; reasoning?: string; model?: string }>;
      console.log(`[listByUser] session ${session.id} has ${messages.length} messages, roles: ${messages.map(m => m.role).join(',')}`);

      results.push({
        id: session.id,
        title: session.title,
        chatType: (session.chatType || 'direct') as 'direct' | 'battle' | 'group',
        updatedAt: typeof session.updatedAt === 'string' ? Number(session.updatedAt) : session.updatedAt,
        messages: messages.map((msg) => ({
          id: String(msg.id),
          role: msg.role,
          content: msg.content,
          reasoning: msg.reasoning ?? undefined,
          model: msg.model ?? undefined,
        })),
      });
    }
    return results;
  }

  /**
   * Upsert-based sync: only adds/updates sessions from the payload.
   * Never deletes conversations that are absent from the payload.
   * Soft-deleted conversations are never un-deleted by sync.
   */
  async syncByUser(userId: string, payload: ConversationSyncDto): Promise<void> {
    const db = this.databaseService.connection;
    console.log(`[syncByUser] starting sync for user ${userId}, sessions: ${payload.sessions.length}`);

    for (const session of payload.sessions) {
      try {
        console.log(`[syncByUser] processing session ${session.id}, messages: ${session.messages.length}, roles: ${session.messages.map(m => m.role).join(',')}`);
        // --- Upsert conversation row ---
        await db.prepare(
          `INSERT INTO conversations (id, user_id, chat_type, title, updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             title = IF(deleted_at IS NULL OR deleted_at = 0, VALUES(title), title),
             chat_type = IF(deleted_at IS NULL OR deleted_at = 0, VALUES(chat_type), chat_type),
             updated_at = IF(deleted_at IS NULL OR deleted_at = 0, VALUES(updated_at), updated_at)`,
        ).run(session.id, userId, session.chatType || 'direct', session.title, session.updatedAt, Date.now());

        // --- Replace messages for this conversation (only if not soft-deleted) ---
        const conv = await db.prepare(
          'SELECT id FROM conversations WHERE id = ? AND user_id = ? AND (deleted_at IS NULL OR deleted_at = 0)',
        ).get(session.id, userId) as { id: string } | undefined;

        if (conv) {
          console.log(`[syncByUser] conversation active, replacing ${session.messages.length} messages`);
          await db.prepare(
            'DELETE FROM conversation_messages WHERE conversation_id = ?',
          ).run(session.id);

          const insertMessage = db.prepare(
            'INSERT INTO conversation_messages (conversation_id, user_id, role, content, reasoning, model, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          );

          for (let idx = 0; idx < session.messages.length; idx++) {
            const message = session.messages[idx];
            await insertMessage.run(
              session.id,
              userId,
              message.role,
              message.content ?? '',
              message.reasoning ?? null,
              message.model ?? null,
              idx,
              Date.now(),
            );
          }
        } else {
          console.log(`[syncByUser] conversation not found or soft-deleted, skipping messages`);
        }
      } catch (error) {
        console.error(`[syncByUser] Failed to sync session ${session.id}:`, error);
        throw error;
      }
    }

    console.log(`[syncByUser] sync completed successfully`);
  }

  async softDelete(userId: string, sessionId: string): Promise<void> {
    const db = this.databaseService.connection;
    const row = await db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ? AND (deleted_at IS NULL OR deleted_at = 0)',
    ).get(sessionId, userId) as { id: string } | undefined;

    if (!row) {
      throw new NotFoundException('会话不存在或已删除');
    }

    const now = Date.now();
    // Soft-delete conversation
    await db.prepare(
      'UPDATE conversations SET deleted_at = ? WHERE id = ? AND user_id = ?',
    ).run(now, sessionId, userId);
    // Soft-delete its messages
    await db.prepare(
      'UPDATE conversation_messages SET deleted_at = ? WHERE conversation_id = ? AND user_id = ?',
    ).run(now, sessionId, userId);
  }
}
