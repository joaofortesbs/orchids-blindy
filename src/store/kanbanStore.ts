'use client';

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { KanbanColumn, KanbanCard } from '@/lib/types/blindados';

interface CardMoveOperation {
  id: string;
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  position: number;
  timestamp: number;
  retries: number;
}

interface CardPositionUpdate {
  id: string;
  columnId: string;
  cardPositions: { cardId: string; position: number }[];
  timestamp: number;
  retries: number;
}

type PendingOperation = 
  | { type: 'move'; data: CardMoveOperation }
  | { type: 'reorder'; data: CardPositionUpdate };

interface KanbanState {
  columns: KanbanColumn[];
  pendingOps: number;
  queue: PendingOperation[];
  lastSync: number;
  isProcessing: boolean;
  
  setColumns: (columns: KanbanColumn[]) => void;
  optimisticMoveCard: (cardId: string, sourceColumnId: string, targetColumnId: string, position: number) => void;
  optimisticReorderCards: (columnId: string, cards: KanbanCard[]) => void;
  processQueue: () => Promise<void>;
  confirmOperation: (opId: string) => void;
  failOperation: (opId: string) => void;
  forceSync: () => Promise<void>;
  clearQueue: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 500;

export const useKanbanStore = create<KanbanState>()(
  devtools(
    persist(
      (set, get) => ({
        columns: [],
        pendingOps: 0,
        queue: [],
        lastSync: 0,
        isProcessing: false,
        
        setColumns: (columns) => {
          set({ columns, lastSync: Date.now() });
        },
        
        optimisticMoveCard: (cardId, sourceColumnId, targetColumnId, position) => {
          const opId = `move-${cardId}-${Date.now()}`;
          
          set((state) => {
            const sourceColumn = state.columns.find(c => c.id === sourceColumnId);
            const card = sourceColumn?.cards.find(c => c.id === cardId);
            
            if (!card) return state;
            
            const newColumns = state.columns.map(col => {
              if (col.id === sourceColumnId) {
                return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
              }
              if (col.id === targetColumnId) {
                const newCards = [...col.cards];
                newCards.splice(position, 0, card);
                return { ...col, cards: newCards };
              }
              return col;
            });
            
            const newOp: PendingOperation = {
              type: 'move',
              data: {
                id: opId,
                cardId,
                sourceColumnId,
                targetColumnId,
                position,
                timestamp: Date.now(),
                retries: 0,
              },
            };
            
            return {
              columns: newColumns,
              pendingOps: state.pendingOps + 1,
              queue: [...state.queue, newOp],
            };
          });
          
          get().processQueue();
        },
        
        optimisticReorderCards: (columnId, cards) => {
          const opId = `reorder-${columnId}-${Date.now()}`;
          
          set((state) => {
            const newColumns = state.columns.map(col =>
              col.id === columnId ? { ...col, cards } : col
            );
            
            const newOp: PendingOperation = {
              type: 'reorder',
              data: {
                id: opId,
                columnId,
                cardPositions: cards.map((c, i) => ({ cardId: c.id, position: i })),
                timestamp: Date.now(),
                retries: 0,
              },
            };
            
            return {
              columns: newColumns,
              pendingOps: state.pendingOps + 1,
              queue: [...state.queue, newOp],
            };
          });
          
          get().processQueue();
        },
        
        processQueue: async () => {
          const state = get();
          if (state.isProcessing || state.queue.length === 0) return;
          
          set({ isProcessing: true });
          
          const queue = [...state.queue];
          
          for (const op of queue) {
            try {
              if (op.type === 'move') {
                const res = await fetch('/api/kanban/move-card', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cardId: op.data.cardId,
                    targetColumnId: op.data.targetColumnId,
                    position: op.data.position,
                  }),
                });
                
                if (res.ok) {
                  get().confirmOperation(op.data.id);
                  console.log('[KanbanStore] Move confirmed:', op.data.cardId);
                } else {
                  throw new Error(`HTTP ${res.status}`);
                }
              } else if (op.type === 'reorder') {
                const res = await fetch('/api/kanban/reorder-cards', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    columnId: op.data.columnId,
                    cardPositions: op.data.cardPositions,
                  }),
                });
                
                if (res.ok) {
                  get().confirmOperation(op.data.id);
                  console.log('[KanbanStore] Reorder confirmed:', op.data.columnId);
                } else {
                  throw new Error(`HTTP ${res.status}`);
                }
              }
            } catch (error) {
              console.error('[KanbanStore] Operation failed:', op, error);
              
              set((state) => ({
                queue: state.queue.map(q => {
                  if ((q.type === 'move' && q.data.id === op.data.id) ||
                      (q.type === 'reorder' && q.data.id === op.data.id)) {
                    const newRetries = q.data.retries + 1;
                    if (newRetries >= MAX_RETRIES) {
                      console.error('[KanbanStore] Max retries reached, dropping operation:', op);
                      get().failOperation(op.data.id);
                      return q;
                    }
                    return { ...q, data: { ...q.data, retries: newRetries } };
                  }
                  return q;
                }),
              }));
              
              const retryDelay = RETRY_DELAY_BASE * Math.pow(2, op.data.retries);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
          
          set({ isProcessing: false });
          
          if (get().queue.length > 0) {
            setTimeout(() => get().processQueue(), 100);
          }
        },
        
        confirmOperation: (opId) => {
          set((state) => ({
            pendingOps: Math.max(0, state.pendingOps - 1),
            queue: state.queue.filter(op => op.data.id !== opId),
          }));
        },
        
        failOperation: (opId) => {
          set((state) => ({
            pendingOps: Math.max(0, state.pendingOps - 1),
            queue: state.queue.filter(op => op.data.id !== opId),
          }));
        },
        
        forceSync: async () => {
          const state = get();
          if (state.pendingOps > 0 || state.queue.length > 0) {
            console.log('[KanbanStore] Skipping sync - pending operations:', state.pendingOps);
            return;
          }
          
          console.log('[KanbanStore] Force sync from database...');
          set({ lastSync: Date.now() });
        },
        
        clearQueue: () => {
          set({ queue: [], pendingOps: 0, isProcessing: false });
        },
      }),
      {
        name: 'kanban-storage',
        partialize: (state) => ({ 
          columns: state.columns,
          lastSync: state.lastSync,
        }),
      }
    ),
    { name: 'KanbanStore' }
  )
);
