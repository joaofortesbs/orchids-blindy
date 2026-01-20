import { SupabaseClient } from '@supabase/supabase-js';
import { KanbanColumn, KanbanCard } from '@/lib/types/blindados';

const DEFAULT_COLUMNS = ['A FAZER', 'EM PROGRESSO', 'CONCLUÍDO'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;
const OPERATION_TIMEOUT_MS = 8000;

// Debug mode - set to true to see detailed logs
const DEBUG = true;

function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[KanbanService]', ...args);
}

export interface KanbanOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Utility: Execute with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (e) {
    clearTimeout(timeoutId!);
    throw e;
  }
}

// Utility: Retry with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(operation(), OPERATION_TIMEOUT_MS);
    } catch (e) {
      lastError = e as Error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}

export class KanbanService {
  constructor(private supabase: SupabaseClient, private userId: string) {
    debugLog('Initialized with userId:', userId);
  }

  // Verify that the user is authenticated and matches the expected userId
  private async verifyAuth(): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        console.error('[KanbanService] No authenticated user found');
        return false;
      }
      if (user.id !== this.userId) {
        console.error('[KanbanService] User ID mismatch:', { expected: this.userId, actual: user.id });
        return false;
      }
      debugLog('Auth verified for user:', user.id);
      return true;
    } catch (e) {
      console.error('[KanbanService] Auth verification failed:', e);
      return false;
    }
  }

  async loadColumns(): Promise<KanbanColumn[]> {
    try {
      const { data: columns, error: colError } = await this.supabase
        .from('kanban_columns')
        .select('*')
        .eq('user_id', this.userId)
        .order('position');

      if (colError) {
        console.error('KanbanService.loadColumns columns error:', colError.message, colError.hint);
        throw colError;
      }

      if (!columns || columns.length === 0) {
        return this.createDefaultColumns();
      }

      const { data: cards, error: cardError } = await this.supabase
        .from('kanban_cards')
        .select('*')
        .eq('user_id', this.userId)
        .order('position');

      if (cardError) {
        console.error('KanbanService.loadColumns cards error:', cardError.message);
        throw cardError;
      }

      const cardsMap = new Map<string, KanbanCard[]>();
      (cards || []).forEach(card => {
        const list = cardsMap.get(card.column_id) || [];
        list.push({
          id: card.id,
          title: card.title,
          description: card.description || '',
          priority: card.priority as 'alta' | 'media' | 'baixa',
          tags: card.tags || [],
          subtasks: card.subtasks || [],
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        });
        cardsMap.set(card.column_id, list);
      });

      return columns.map(col => ({
        id: col.id,
        title: col.title,
        cards: cardsMap.get(col.id) || [],
      }));
    } catch (e) {
      console.error('KanbanService.loadColumns error:', e);
      throw e;
    }
  }

  private async createDefaultColumns(): Promise<KanbanColumn[]> {
    const columns: KanbanColumn[] = [];

    for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
      const { data, error } = await this.supabase
        .from('kanban_columns')
        .insert({ user_id: this.userId, title: DEFAULT_COLUMNS[i], position: i })
        .select()
        .single();

      if (!error && data) {
        columns.push({ id: data.id, title: data.title, cards: [] });
      }
    }

    return columns;
  }

  async addColumn(title: string, position: number): Promise<KanbanColumn | null> {
    try {
      return await withRetry(async () => {
        const { data, error } = await this.supabase
          .from('kanban_columns')
          .insert({ user_id: this.userId, title: title.toUpperCase(), position })
          .select()
          .single();

        if (error) {
          console.error('KanbanService.addColumn error:', error.message);
          throw error;
        }

        return { id: data.id, title: data.title, cards: [] };
      });
    } catch (e) {
      console.error('KanbanService.addColumn failed after retries:', e);
      return null;
    }
  }

  async deleteColumn(columnId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kanban_columns')
      .delete()
      .eq('id', columnId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('KanbanService.deleteColumn error:', error.message);
      return false;
    }
    return true;
  }

  async addCard(columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>, position: number): Promise<KanbanCard | null> {
    try {
      return await withRetry(async () => {
        const { data, error } = await this.supabase
          .from('kanban_cards')
          .insert({
            user_id: this.userId,
            column_id: columnId,
            title: card.title,
            description: card.description || '',
            priority: card.priority || 'media',
            tags: card.tags || [],
            subtasks: card.subtasks || [],
            position,
          })
          .select()
          .single();

        if (error) {
          console.error('KanbanService.addCard error:', error.message, error.details);
          throw error;
        }

        return {
          id: data.id,
          title: data.title,
          description: data.description || '',
          priority: data.priority as 'alta' | 'media' | 'baixa',
          tags: data.tags || [],
          subtasks: data.subtasks || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      });
    } catch (e) {
      console.error('KanbanService.addCard failed after retries:', e);
      return null;
    }
  }

  async updateCard(cardId: string, updates: Partial<KanbanCard>): Promise<boolean> {
    try {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      
      // Map frontend fields to DB columns - JSONB columns receive arrays directly
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags; // JSONB - pass array directly
      if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks; // JSONB - pass array directly

      console.log('KanbanService.updateCard: userId=', this.userId, 'cardId=', cardId, 'updates=', dbUpdates);

      const { data, error } = await this.supabase
        .from('kanban_cards')
        .update(dbUpdates)
        .eq('id', cardId)
        .eq('user_id', this.userId)
        .select();

      if (error) {
        console.error('KanbanService.updateCard error:', error.message, error.details, error.code);
        return false;
      }
      
      const rowsAffected = data?.length || 0;
      console.log('KanbanService.updateCard: rowsAffected=', rowsAffected);
      
      // If no rows were affected, the update failed (likely RLS or card not found)
      if (rowsAffected === 0) {
        console.error('KanbanService.updateCard: No rows affected - card not found or RLS denied');
        return false;
      }
      
      return true;
    } catch (e) {
      console.error('KanbanService.updateCard exception:', e);
      return false;
    }
  }

  async deleteCard(cardId: string): Promise<boolean> {
    try {
      console.log('KanbanService.deleteCard: userId=', this.userId, 'cardId=', cardId);
      
      const { data, error } = await this.supabase
        .from('kanban_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', this.userId)
        .select();

      if (error) {
        console.error('KanbanService.deleteCard error:', error.message, error.details, error.code);
        return false;
      }
      
      const rowsAffected = data?.length || 0;
      console.log('KanbanService.deleteCard: rowsAffected=', rowsAffected);
      
      // If no rows were affected, the delete failed (likely RLS or card not found)
      if (rowsAffected === 0) {
        console.error('KanbanService.deleteCard: No rows affected - card not found or RLS denied');
        return false;
      }
      
      return true;
    } catch (e) {
      console.error('KanbanService.deleteCard exception:', e);
      return false;
    }
  }

  async moveCard(cardId: string, targetColumnId: string, position: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('kanban_cards')
      .update({ column_id: targetColumnId, position })
      .eq('id', cardId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('KanbanService.moveCard error:', error.message);
      return false;
    }
    return true;
  }

  async updateColumn(columnId: string, updates: { title?: string; position?: number }): Promise<boolean> {
    try {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title.toUpperCase();
      if (updates.position !== undefined) dbUpdates.position = updates.position;

      const { error } = await this.supabase
        .from('kanban_columns')
        .update(dbUpdates)
        .eq('id', columnId)
        .eq('user_id', this.userId);

      if (error) {
        console.error('KanbanService.updateColumn error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('KanbanService.updateColumn exception:', e);
      return false;
    }
  }

  async updateColumnPositions(columns: { id: string; position: number }[]): Promise<boolean> {
    if (columns.length === 0) {
      debugLog('updateColumnPositions: No columns to update');
      return true;
    }
    
    debugLog('updateColumnPositions: Starting update for', columns.length, 'columns');
    debugLog('updateColumnPositions: Column data:', JSON.stringify(columns));
    
    try {
      return await withRetry(async () => {
        let allSuccess = true;
        
        // Process all columns in parallel for speed
        const promises = columns.map(col => 
          this.supabase
            .from('kanban_columns')
            .update({ 
              position: col.position, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', col.id)
            .eq('user_id', this.userId)
            .select()
        );
        
        const results = await Promise.all(promises);
        
        for (let i = 0; i < results.length; i++) {
          const { data, error } = results[i];
          const col = columns[i];
          
          if (error) {
            console.error('[KanbanService] updateColumnPositions error for column', col.id, ':', error.message);
            throw error;
          }
          
          const rowsAffected = data?.length || 0;
          debugLog(`updateColumnPositions: Column ${col.id} - rows affected:`, rowsAffected);
          
          if (rowsAffected === 0) {
            console.error('[KanbanService] updateColumnPositions: No rows affected for column', col.id, '- RLS may be blocking update');
            allSuccess = false;
          }
        }
        
        if (allSuccess) {
          debugLog('updateColumnPositions: SUCCESS - All columns updated');
        } else {
          console.error('[KanbanService] updateColumnPositions: Some columns were not updated');
        }
        
        return allSuccess;
      });
    } catch (e) {
      console.error('[KanbanService] updateColumnPositions failed after retries:', e);
      return false;
    }
  }

  async updateCardPositions(columnId: string, cards: { id: string; position: number }[]): Promise<boolean> {
    if (cards.length === 0) {
      debugLog('updateCardPositions: No cards to update');
      return true;
    }
    
    // Validate columnId is not a temporary ID
    if (columnId.startsWith('temp-')) {
      console.error('[KanbanService] updateCardPositions: Cannot update cards in temporary column:', columnId);
      return false;
    }
    
    debugLog('updateCardPositions: Starting update for', cards.length, 'cards in column', columnId);
    
    // Filter out any temporary cards (they haven't been persisted yet)
    const validCards = cards.filter(c => !c.id.startsWith('temp-'));
    if (validCards.length === 0) {
      debugLog('updateCardPositions: All cards are temporary, skipping');
      return true;
    }
    
    if (validCards.length !== cards.length) {
      debugLog('updateCardPositions: Filtered out', cards.length - validCards.length, 'temporary cards');
    }
    
    try {
      return await withRetry(async () => {
        let allSuccess = true;
        
        // Process all valid cards in parallel for speed
        const promises = validCards.map(card =>
          this.supabase
            .from('kanban_cards')
            .update({ 
              position: card.position, 
              column_id: columnId, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', card.id)
            .eq('user_id', this.userId)
            .select()
        );
        
        const results = await Promise.all(promises);
        
        for (let i = 0; i < results.length; i++) {
          const { data, error } = results[i];
          const card = validCards[i];
          
          if (error) {
            // Check if it's a foreign key constraint error
            if (error.message.includes('violates foreign key constraint')) {
              console.error('[KanbanService] updateCardPositions: Column', columnId, 'does not exist in database. Foreign key violation.');
            } else {
              console.error('[KanbanService] updateCardPositions error for card', card.id, ':', error.message, error.code, error.details);
            }
            throw error;
          }
          
          const rowsAffected = data?.length || 0;
          debugLog(`updateCardPositions: Card ${card.id} - rows affected:`, rowsAffected);
          
          if (rowsAffected === 0) {
            console.error('[KanbanService] updateCardPositions: No rows affected for card', card.id, '- RLS may be blocking update');
            allSuccess = false;
          }
        }
        
        if (allSuccess) {
          debugLog('updateCardPositions: SUCCESS - All cards updated');
        }
        
        return allSuccess;
      });
    } catch (e) {
      console.error('[KanbanService] updateCardPositions failed after retries:', e);
      return false;
    }
  }
}
