import { SupabaseClient } from '@supabase/supabase-js';
import { KanbanColumn, KanbanCard } from '@/lib/types/blindados';

const DEFAULT_COLUMNS = ['A FAZER', 'EM PROGRESSO', 'CONCLUÍDO'];

export interface KanbanOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export class KanbanService {
  constructor(private supabase: SupabaseClient, private userId: string) {}

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
    const { data, error } = await this.supabase
      .from('kanban_columns')
      .insert({ user_id: this.userId, title: title.toUpperCase(), position })
      .select()
      .single();

    if (error) {
      console.error('KanbanService.addColumn error:', error.message);
      return null;
    }

    return { id: data.id, title: data.title, cards: [] };
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
      return null;
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
  }

  async updateCard(cardId: string, updates: Partial<KanbanCard>): Promise<boolean> {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks;

    const { error } = await this.supabase
      .from('kanban_cards')
      .update(dbUpdates)
      .eq('id', cardId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('KanbanService.updateCard error:', error.message);
      return false;
    }
    return true;
  }

  async deleteCard(cardId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kanban_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('KanbanService.deleteCard error:', error.message);
      return false;
    }
    return true;
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

  async updateColumnPositions(columns: { id: string; title: string; position: number }[]): Promise<boolean> {
    try {
      const promises = columns.map(col => 
        this.supabase
          .from('kanban_columns')
          .update({ position: col.position, title: col.title, updated_at: new Date().toISOString() })
          .eq('id', col.id)
          .eq('user_id', this.userId)
      );

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.error) {
          console.error('KanbanService.updateColumnPositions error:', result.error.message);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error('KanbanService.updateColumnPositions exception:', e);
      return false;
    }
  }

  async updateCardPositions(columnId: string, cards: { id: string; position: number }[]): Promise<boolean> {
    try {
      const promises = cards.map(card =>
        this.supabase
          .from('kanban_cards')
          .update({ position: card.position, column_id: columnId, updated_at: new Date().toISOString() })
          .eq('id', card.id)
          .eq('user_id', this.userId)
      );

      const results = await Promise.all(promises);

      for (const result of results) {
        if (result.error) {
          console.error('KanbanService.updateCardPositions error:', result.error.message);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error('KanbanService.updateCardPositions exception:', e);
      return false;
    }
  }
}
