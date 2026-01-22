"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  TouchSensor,
  useDroppable,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreVertical, GripVertical, Trash2, X, Check, Pencil, Move, FolderKanban, Calendar, ChevronDown, Settings2, CheckCircle2, RotateCcw } from 'lucide-react';
import { KanbanColumn, KanbanCard, Priority, SubTask, KanbanProject, ColumnBehavior } from '@/lib/types/blindados';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onColumnsChange: (columns: KanbanColumn[]) => void;
  onUpdateColumn: (columnId: string, updates: { title?: string; behavior?: ColumnBehavior }) => void;
  onAddColumn: (title: string, behavior?: ColumnBehavior) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCard: (columnId: string, cardId: string, updates: Partial<KanbanCard>) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onMoveCard: (cardId: string, sourceColumnId: string, targetColumnId: string, targetIndex: number) => void;
  onUpdateCardPositions: (columnId: string, cards: KanbanCard[]) => void;
  isLoaded?: boolean;
  projects?: KanbanProject[];
  onAddProject?: (name: string, color: string) => void;
  onDeleteProject?: (projectId: string) => void;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
  selectedDate?: Date | null;
  onSelectDate?: (date: Date | null) => void;
}

const PROJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#a855f7',
  '#ec4899', '#f43f5e',
];

const priorityColors: Record<Priority, { bg: string; text: string; label: string }> = {
  alta: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'PRIORIDADE ALTA' },
  media: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'PRIORIDADE MÉDIA' },
  baixa: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'PRIORIDADE BAIXA' },
};

function ColumnMenu({ 
  column, 
  onRename, 
  onDelete, 
  onClose,
  onChangeBehavior 
}: { 
  column: KanbanColumn;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  onChangeBehavior: (behavior: ColumnBehavior) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      className="absolute right-0 top-8 z-50 w-56 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl shadow-xl overflow-hidden"
    >
      <div className="px-4 py-2 border-b border-white/5">
        <p className="text-xs text-white/40">Comportamento da coluna</p>
      </div>
      <button
        onClick={() => { onChangeBehavior('active'); onClose(); }}
        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
          column.behavior === 'active' ? 'bg-[#00f6ff]/10 text-[#00f6ff]' : 'text-white hover:bg-white/5'
        }`}
      >
        <RotateCcw className="w-4 h-4" />
        <div className="text-left">
          <div>Ativada</div>
          <div className="text-[10px] text-white/40">Tarefas continuam no dia seguinte</div>
        </div>
        {column.behavior === 'active' && <Check className="w-4 h-4 ml-auto" />}
      </button>
      <button
        onClick={() => { onChangeBehavior('completion'); onClose(); }}
        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
          column.behavior === 'completion' ? 'bg-green-500/10 text-green-400' : 'text-white hover:bg-white/5'
        }`}
      >
        <CheckCircle2 className="w-4 h-4" />
        <div className="text-left">
          <div>Conclusão</div>
          <div className="text-[10px] text-white/40">Tarefas somem no dia seguinte</div>
        </div>
        {column.behavior === 'completion' && <Check className="w-4 h-4 ml-auto" />}
      </button>
      <div className="border-t border-white/5 mt-1">
        <button
          onClick={() => { onRename(); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
        >
          <Pencil className="w-4 h-4 text-[#00f6ff]" />
          Renomear coluna
        </button>
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Excluir coluna
        </button>
      </div>
    </motion.div>
  );
}

function DroppableColumn({ 
  column, 
  children,
  isOver 
}: { 
  column: KanbanColumn; 
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id }
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto space-y-2 min-h-[100px] p-1 rounded-lg transition-all duration-200 ${
        isOver ? 'bg-[#00f6ff]/5 ring-2 ring-[#00f6ff]/30 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  );
}

function SortableColumn({
  column,
  children,
  onOpenMenu,
  isDraggingColumn,
  filteredCardCount,
}: {
  column: KanbanColumn;
  children: React.ReactNode;
  onOpenMenu: () => void;
  isDraggingColumn: boolean;
  filteredCardCount?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'sortable-column', column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 w-72 bg-[#010516]/50 rounded-xl border border-white/5 p-3 flex flex-col max-h-full transition-shadow ${
        isDragging ? 'shadow-xl shadow-[#00f6ff]/20 border-[#00f6ff]/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors"
          >
            <GripVertical className="w-4 h-4 text-white/30" />
          </div>
          <h3 className="text-xs font-semibold text-white/60 tracking-wider">{column.title}</h3>
          {column.behavior === 'completion' ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20" title="Tarefas concluídas não aparecem no dia seguinte">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00f6ff]/10 border border-[#00f6ff]/20" title="Tarefas continuam no dia seguinte">
              <RotateCcw className="w-3 h-3 text-[#00f6ff]" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 relative">
          <span className="text-xs text-white/30">{filteredCardCount !== undefined ? filteredCardCount : column.cards.length}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SortableCard({ 
  card, 
  columnId, 
  onEdit, 
  onDelete,
  isDraggingAny,
}: { 
  card: KanbanCard; 
  columnId: string; 
  onEdit: () => void; 
  onDelete: () => void;
  isDraggingAny: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id, 
    data: { type: 'card', columnId, card } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const completedSubtasks = card.subtasks.filter(s => s.completed).length;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={() => !isDraggingAny && onEdit()}
      className={`bg-[#0a0f1f] rounded-xl border p-3 group cursor-grab active:cursor-grabbing transition-all duration-200 touch-none select-none ${
        isDragging 
          ? 'border-[#00f6ff]/50 shadow-lg shadow-[#00f6ff]/10' 
          : 'border-white/5 hover:border-[#00f6ff]/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${priorityColors[card.priority].bg} ${priorityColors[card.priority].text}`}>
          {priorityColors[card.priority].label}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-1 rounded hover:bg-white/10 transition-colors">
            <GripVertical className="w-3 h-3 text-white/40" />
          </div>
        </div>
      </div>

      <p className="text-sm text-white mb-2 pointer-events-none">{card.title}</p>

      {card.subtasks.length > 0 && (
        <div className="flex items-center gap-1.5 text-white/40 text-xs pointer-events-none">
          <span>☰</span>
          <span>{completedSubtasks}/{card.subtasks.length}</span>
        </div>
      )}

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pointer-events-none">
          {card.tags.map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-0.5 rounded-full text-[10px] bg-[#00f6ff]/10 text-[#00f6ff]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CardOverlay({ card }: { card: KanbanCard }) {
  return (
    <motion.div 
      initial={{ scale: 1.02, rotate: 2 }}
      animate={{ scale: 1.05, rotate: 3 }}
      className="bg-[#0a0f1f] rounded-xl border border-[#00f6ff]/50 p-3 shadow-2xl shadow-[#00f6ff]/30 cursor-grabbing w-[280px]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${priorityColors[card.priority].bg} ${priorityColors[card.priority].text}`}>
          {priorityColors[card.priority].label}
        </span>
      </div>
      <p className="text-sm text-white">{card.title}</p>
    </motion.div>
  );
}

function ColumnOverlay({ column }: { column: KanbanColumn }) {
  return (
    <motion.div
      initial={{ scale: 1.02, rotate: 1 }}
      animate={{ scale: 1.03, rotate: 2 }}
      className="w-72 bg-[#010516]/90 rounded-xl border border-[#00f6ff]/50 p-3 shadow-2xl shadow-[#00f6ff]/30 cursor-grabbing"
    >
      <div className="flex items-center gap-2 mb-3">
        <GripVertical className="w-4 h-4 text-[#00f6ff]" />
        <h3 className="text-xs font-semibold text-white tracking-wider">{column.title}</h3>
        <span className="text-xs text-white/50 ml-auto">{column.cards.length}</span>
      </div>
      <div className="space-y-2 opacity-60">
        {column.cards.slice(0, 2).map(card => (
          <div key={card.id} className="bg-[#0a0f1f] rounded-lg p-2 border border-white/10">
            <p className="text-xs text-white/60 truncate">{card.title}</p>
          </div>
        ))}
        {column.cards.length > 2 && (
          <p className="text-xs text-white/40 text-center">+{column.cards.length - 2} mais</p>
        )}
      </div>
    </motion.div>
  );
}

export function KanbanBoard({
  columns,
  onColumnsChange,
  onUpdateColumn,
  onAddColumn,
  onDeleteColumn,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onUpdateCardPositions,
  isLoaded = true,
  projects = [],
  onAddProject,
  onDeleteProject,
  selectedProjectId = null,
  onSelectProject,
  selectedDate = null,
  onSelectDate,
}: KanbanBoardProps) {
  const hasTemporaryColumns = columns.some(c => c.id.startsWith('temp-'));
  const canDrag = isLoaded && !hasTemporaryColumns;
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [editingCard, setEditingCard] = useState<{ card: KanbanCard; columnId: string } | null>(null);
  const [addingCardToColumn, setAddingCardToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardPriority, setNewCardPriority] = useState<Priority>('media');
  const [newCardDueDate, setNewCardDueDate] = useState<string>('');
  const [openMenuColumnId, setOpenMenuColumnId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const originalCardPositionRef = useRef<{ cardId: string; columnId: string; index: number } | null>(null);
  
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shouldShowCard = useCallback((card: KanbanCard, columnBehavior: ColumnBehavior) => {
    if (selectedProjectId && card.projectId !== selectedProjectId) {
      return false;
    }
    
    if (selectedDate) {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      if (columnBehavior === 'completion' && card.completedAt) {
        const completedDate = format(parseISO(card.completedAt), 'yyyy-MM-dd');
        if (completedDate < selectedDateStr) {
          return false;
        }
      }
      
      if (card.dueDate) {
        return card.dueDate <= selectedDateStr;
      }
      
      return true;
    }
    
    return true;
  }, [selectedProjectId, selectedDate]);

  const getFilteredCards = useCallback((column: KanbanColumn) => {
    return column.cards.filter(card => shouldShowCard(card, column.behavior || 'active'));
  }, [shouldShowCard]);

  const handleAddProject = () => {
    if (newProjectName.trim() && onAddProject) {
      onAddProject(newProjectName.trim(), newProjectColor);
      setNewProjectName('');
      setNewProjectColor(PROJECT_COLORS[0]);
      setShowAddProjectModal(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumnByCardId = useCallback((cardId: string): string | null => {
    for (const column of columns) {
      if (column.cards.some(c => c.id === cardId)) {
        return column.id;
      }
    }
    return null;
  }, [columns]);

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    if (activeColumn) {
      const columnContainers = args.droppableContainers.filter(
        container => String(container.id).startsWith('column-')
      );
      return closestCenter({
        ...args,
        droppableContainers: columnContainers,
      });
    }

    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      let overId = getFirstCollision(pointerCollisions, 'id');
      
      if (overId) {
        const column = columns.find(c => c.id === overId);
        if (column && column.cards.length > 0) {
          const cardCollisions = rectIntersection({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              container => container.id !== overId && 
              column.cards.some(c => c.id === container.id)
            ),
          });
          
          if (cardCollisions.length > 0) {
            overId = cardCollisions[0].id;
          }
        }
        
        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }
    }

    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }

    if (lastOverIdRef.current) {
      return [{ id: lastOverIdRef.current }];
    }

    return [];
  }, [columns, activeColumn]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canDrag) {
      console.log('[KanbanBoard] Drag blocked - data not ready:', { isLoaded, hasTemporaryColumns });
      return;
    }
    
    const { active } = event;
    const activeData = active.data.current;
    
    console.log('[KanbanBoard] Drag started:', { id: active.id, type: activeData?.type });
    
    if (activeData?.type === 'card') {
      setActiveCard(activeData.card);
      setActiveColumnId(activeData.columnId);
      const column = columns.find(c => c.id === activeData.columnId);
      const cardIndex = column?.cards.findIndex(c => c.id === activeData.card.id) ?? -1;
      originalCardPositionRef.current = {
        cardId: activeData.card.id,
        columnId: activeData.columnId,
        index: cardIndex,
      };
      console.log('[KanbanBoard] Card drag started:', { cardId: activeData.card.id, columnId: activeData.columnId, index: cardIndex });
    } else if (activeData?.type === 'sortable-column') {
      setActiveColumn(activeData.column);
      console.log('[KanbanBoard] Column drag started:', { columnId: activeData.column.id, title: activeData.column.title });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (activeColumn) return;

    if (!activeCard) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    
    if (activeData?.type !== 'card') return;

    const sourceColumnId = activeData.columnId;
    let targetColumnId: string;
    
    if (overData?.type === 'card') {
      targetColumnId = overData.columnId;
    } else if (overData?.type === 'column') {
      targetColumnId = over.id as string;
    } else {
      targetColumnId = findColumnByCardId(over.id as string) || (over.id as string);
    }

    setOverColumnId(targetColumnId);

    if (sourceColumnId === targetColumnId) {
      const column = columns.find(c => c.id === sourceColumnId);
      if (!column) return;

      const activeIndex = column.cards.findIndex(c => c.id === active.id);
      const overIndex = overData?.type === 'card' 
        ? column.cards.findIndex(c => c.id === over.id)
        : column.cards.length;

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const newColumns = columns.map(col => {
          if (col.id === sourceColumnId) {
            return { ...col, cards: arrayMove(col.cards, activeIndex, overIndex) };
          }
          return col;
        });
        onColumnsChange(newColumns);
      }
      return;
    }

    const sourceColumn = columns.find(c => c.id === sourceColumnId);
    const targetColumn = columns.find(c => c.id === targetColumnId);

    if (!sourceColumn || !targetColumn) return;

    const activeCardData = sourceColumn.cards.find(c => c.id === active.id);
    if (!activeCardData) return;

    const overIndex = overData?.type === 'card' 
      ? targetColumn.cards.findIndex(c => c.id === over.id)
      : targetColumn.cards.length;

    const newColumns = columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, cards: col.cards.filter(c => c.id !== active.id) };
      }
      if (col.id === targetColumnId) {
        const newCards = [...col.cards];
        const insertIndex = overIndex >= 0 ? overIndex : col.cards.length;
        newCards.splice(insertIndex, 0, activeCardData);
        return { ...col, cards: newCards };
      }
      return col;
    });

    setActiveColumnId(targetColumnId);
    activeData.columnId = targetColumnId;
    onColumnsChange(newColumns);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('[KanbanBoard] Drag ended:', { activeId: active.id, overId: over?.id, hasActiveColumn: !!activeColumn, hasActiveCard: !!activeCard });

    if (activeColumn && over) {
      const activeId = active.id as string;
      const overId = over.id as string;

      // Extract column ID from either "column-{id}" or just "{id}" format
      const getColumnIndex = (id: string) => {
        // Try with prefix first
        let index = columns.findIndex(c => `column-${c.id}` === id);
        if (index === -1) {
          // Try without prefix (from DroppableColumn)
          index = columns.findIndex(c => c.id === id);
        }
        return index;
      };

      const oldIndex = getColumnIndex(activeId);
      const newIndex = getColumnIndex(overId);

      console.log('[KanbanBoard] Column drag end:', { activeId, overId, oldIndex, newIndex });

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newColumns = arrayMove(columns, oldIndex, newIndex);
        console.log('[KanbanBoard] Reordering columns - calling onColumnsChange with:', newColumns.map((c, i) => ({ id: c.id, title: c.title, pos: i })));
        onColumnsChange(newColumns);
      } else {
        console.log('[KanbanBoard] Column drag end - no reorder needed (same position or invalid indices)');
      }
    }

    if (activeCard && originalCardPositionRef.current) {
      const original = originalCardPositionRef.current;
      const currentColumnId = activeColumnId;
      
      console.log('[KanbanBoard] Card drag end:', { cardId: activeCard.id, originalColumnId: original.columnId, currentColumnId });
      
      if (currentColumnId && original.columnId !== currentColumnId) {
        const targetColumn = columns.find(c => c.id === currentColumnId);
        const targetIndex = targetColumn?.cards.findIndex(c => c.id === activeCard.id) ?? 0;
        console.log('[KanbanBoard] Card moved to different column - calling onMoveCard:', { cardId: activeCard.id, from: original.columnId, to: currentColumnId, targetIndex });
        onMoveCard(activeCard.id, original.columnId, currentColumnId, targetIndex);
      } else if (currentColumnId && original.columnId === currentColumnId) {
        const column = columns.find(c => c.id === currentColumnId);
        if (column) {
          const newIndex = column.cards.findIndex(c => c.id === activeCard.id);
          if (newIndex !== original.index) {
            console.log('[KanbanBoard] Card reordered within column - calling onUpdateCardPositions:', { columnId: currentColumnId, cardCount: column.cards.length, cards: column.cards.map((c, i) => ({ id: c.id, pos: i })) });
            onUpdateCardPositions(currentColumnId, column.cards);
          } else {
            console.log('[KanbanBoard] Card drag end - no position change');
          }
        }
      }
    }

    setActiveCard(null);
    setActiveColumn(null);
    setActiveColumnId(null);
    setOverColumnId(null);
    lastOverIdRef.current = null;
    originalCardPositionRef.current = null;
  };

  const handleAddColumn = () => {
    const title = newColumnTitle.trim();
    if (!title) return;
    
    // Immediately clear and close to prevent double-clicks
    setNewColumnTitle('');
    setShowAddColumn(false);
    
    // Fire and forget - optimistic update handles UI instantly
    onAddColumn(title);
  };

  const handleAddCard = (columnId: string) => {
    const title = newCardTitle.trim();
    if (!title) return;
    
    const priority = newCardPriority;
    const dueDate = newCardDueDate || undefined;
    const projectId = selectedProjectId || undefined;
    
    setNewCardTitle('');
    setNewCardPriority('media');
    setNewCardDueDate('');
    setAddingCardToColumn(null);
    
    onAddCard(columnId, {
      title,
      description: '',
      priority,
      tags: [],
      subtasks: [],
      dueDate,
      projectId,
    });
  };

  const handleRenameColumn = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column) {
      setRenamingColumnId(columnId);
      setRenameValue(column.title);
    }
  };

  const handleSaveRename = () => {
    if (renamingColumnId && renameValue.trim()) {
      onUpdateColumn(renamingColumnId, { title: renameValue.trim() });
    }
    setRenamingColumnId(null);
    setRenameValue('');
  };

  const columnIds = columns.map(c => `column-${c.id}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full overflow-hidden"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Quadro de tarefas</h2>
          
          <div className="relative" ref={projectDropdownRef}>
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-[#00f6ff]/30 transition-colors text-sm"
            >
              {selectedProject ? (
                <>
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: selectedProject.color }}
                  />
                  <span className="text-white">{selectedProject.name}</span>
                </>
              ) : (
                <>
                  <FolderKanban className="w-4 h-4 text-white/60" />
                  <span className="text-white/60">Todos</span>
                </>
              )}
              <ChevronDown className="w-4 h-4 text-white/40" />
            </button>
            
            <AnimatePresence>
              {showProjectDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-2 w-56 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <button
                    onClick={() => { onSelectProject?.(null); setShowProjectDropdown(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      !selectedProjectId ? 'bg-[#00f6ff]/10 text-[#00f6ff]' : 'text-white hover:bg-white/5'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>Todos os projetos</span>
                    {!selectedProjectId && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                  
                  {projects.length > 0 && (
                    <div className="border-t border-white/5">
                      {projects.map(project => (
                        <button
                          key={project.id}
                          onClick={() => { onSelectProject?.(project.id); setShowProjectDropdown(false); }}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                            selectedProjectId === project.id ? 'bg-[#00f6ff]/10 text-[#00f6ff]' : 'text-white hover:bg-white/5'
                          }`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate">{project.name}</span>
                          {selectedProjectId === project.id && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="border-t border-white/5">
                    <button
                      onClick={() => { setShowAddProjectModal(true); setShowProjectDropdown(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#00f6ff] hover:bg-white/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo projeto</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm ${
                selectedDate 
                  ? 'bg-[#00f6ff]/10 border-[#00f6ff]/30 text-[#00f6ff]' 
                  : 'bg-white/5 border-white/10 hover:border-[#00f6ff]/30 text-white/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              {selectedDate ? (
                <span>{format(selectedDate, "dd 'de' MMM", { locale: ptBR })}</span>
              ) : (
                <span>Data</span>
              )}
            </button>
            
            <AnimatePresence>
              {showDatePicker && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl shadow-xl z-50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-white/60">Filtrar por data</span>
                    {selectedDate && (
                      <button
                        onClick={() => { onSelectDate?.(null); setShowDatePicker(false); }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        onSelectDate?.(parseISO(e.target.value));
                      }
                      setShowDatePicker(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-[#00f6ff]/50 outline-none"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { onSelectDate?.(new Date()); setShowDatePicker(false); }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#00f6ff]/10 border border-[#00f6ff]/30 text-[#00f6ff] text-xs hover:bg-[#00f6ff]/20 transition-colors"
                    >
                      Hoje
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Novo Projeto</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Nome do projeto</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Ex: Trabalho, Pessoal, Estudos..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-[#00f6ff]/50 outline-none"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white/60 mb-2">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewProjectColor(color)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          newProjectColor === color ? 'ring-2 ring-offset-2 ring-offset-[#0a0f1f] ring-white scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddProjectModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#00f6ff] text-black font-medium hover:bg-[#00f6ff]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar projeto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100%-4rem)]">
            {columns.map((column) => (
              <SortableColumn
                key={column.id}
                column={column}
                onOpenMenu={() => setOpenMenuColumnId(column.id)}
                isDraggingColumn={activeColumn !== null}
                filteredCardCount={getFilteredCards(column).length}
              >
                <div className="relative">
                  <AnimatePresence>
                    {openMenuColumnId === column.id && (
                      <ColumnMenu
                        column={column}
                        onRename={() => handleRenameColumn(column.id)}
                        onDelete={() => onDeleteColumn(column.id)}
                        onClose={() => setOpenMenuColumnId(null)}
                        onChangeBehavior={(behavior) => onUpdateColumn(column.id, { behavior })}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {renamingColumnId === column.id ? (
                  <div className="mb-3 flex gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-[#00f6ff]/30 focus:border-[#00f6ff]/50 outline-none text-white text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') { setRenamingColumnId(null); setRenameValue(''); }
                      }}
                    />
                    <button
                      onClick={handleSaveRename}
                      className="p-1 rounded-lg bg-[#00f6ff]/20 text-[#00f6ff] hover:bg-[#00f6ff]/30 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}

                <DroppableColumn 
                  column={column} 
                  isOver={overColumnId === column.id && activeCard !== null}
                >
                  <SortableContext
                    items={column.cards.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence>
                      {getFilteredCards(column).map((card) => (
                        <SortableCard
                          key={card.id}
                          card={card}
                          columnId={column.id}
                          onEdit={() => setEditingCard({ card, columnId: column.id })}
                          onDelete={() => onDeleteCard(column.id, card.id)}
                          isDraggingAny={activeCard !== null}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                  
                  {column.cards.length === 0 && !activeCard && (
                    <div className="flex items-center justify-center h-20 text-white/20 text-xs">
                      Sem tarefas
                    </div>
                  )}
                </DroppableColumn>

                {addingCardToColumn === column.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Título da tarefa..."
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCard(column.id)}
                    />
                    <select
                      value={newCardPriority}
                      onChange={(e) => setNewCardPriority(e.target.value as Priority)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                    >
                      <option value="alta">Alta Prioridade</option>
                      <option value="media">Média Prioridade</option>
                      <option value="baixa">Baixa Prioridade</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white/40" />
                      <input
                        type="date"
                        value={newCardDueDate}
                        onChange={(e) => setNewCardDueDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddCard(column.id)}
                        className="flex-1 py-2 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-medium hover:bg-[#00f6ff]/90 transition-colors"
                      >
                        Adicionar
                      </button>
                      <button
                        onClick={() => {
                          setAddingCardToColumn(null);
                          setNewCardTitle('');
                        }}
                        className="px-3 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCardToColumn(column.id)}
                    className="mt-3 flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-[#00f6ff]/30 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/5 transition-colors justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar um card
                  </button>
                )}
              </SortableColumn>
            ))}

            {showAddColumn ? (
              <div className="flex-shrink-0 w-72 bg-[#010516]/50 rounded-xl border border-white/5 p-3">
                <input
                  type="text"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  placeholder="Nome da coluna..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm mb-3"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddColumn}
                    className="flex-1 py-2 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-medium hover:bg-[#00f6ff]/90 transition-colors"
                  >
                    Criar
                  </button>
                  <button
                    onClick={() => {
                      setShowAddColumn(false);
                      setNewColumnTitle('');
                    }}
                    className="px-3 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex-shrink-0 w-72 h-12 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#00f6ff]/30 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar coluna
              </button>
            )}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeCard && <CardOverlay card={activeCard} />}
          {activeColumn && <ColumnOverlay column={activeColumn} />}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {editingCard && (
          <EditCardModal
            card={editingCard.card}
            columnId={editingCard.columnId}
            onUpdate={(updates) => {
              onUpdateCard(editingCard.columnId, editingCard.card.id, updates);
              setEditingCard(null); // Explicitly close and clear
            }}
            onDelete={() => {
              if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
                onDeleteCard(editingCard.columnId, editingCard.card.id);
                setEditingCard(null);
              }
            }}
            onClose={() => setEditingCard(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditCardModal({
  card,
  columnId,
  onUpdate,
  onDelete,
  onClose,
}: {
  card: KanbanCard;
  columnId: string;
  onUpdate: (updates: Partial<KanbanCard>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [tags, setTags] = useState<string[]>(card.tags);
  const [subtasks, setSubtasks] = useState<SubTask[]>(card.subtasks);
  const [dueDate, setDueDate] = useState(card.dueDate || '');
  const [newTag, setNewTag] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  const handleSave = () => {
    const updates = {
      title: title.trim(),
      description: description?.trim() || '',
      priority,
      tags,
      subtasks,
      dueDate: dueDate || undefined,
    };
    console.log('[EditCardModal] Saving card:', card.id, 'Updates:', JSON.stringify(updates));
    console.log('[EditCardModal] Tags count:', tags.length, 'Subtasks count:', subtasks.length);
    onUpdate(updates);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([
        ...subtasks,
        { id: `subtask-${Date.now()}`, title: newSubtask.trim(), completed: false },
      ]);
      setNewSubtask('');
    }
  };

  const toggleSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    ));
  };

  const removeSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(s => s.id !== subtaskId));
  };

  const completedCount = subtasks.filter(s => s.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Editar Tarefa</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[#00f6ff]/30 focus:border-[#00f6ff]/50 outline-none text-[#00f6ff] text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Data de Entrega</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Etiquetas</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[#00f6ff]/10 text-[#00f6ff]"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Nova etiqueta..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-dashed border-[#00f6ff]/30 focus:border-[#00f6ff]/50 outline-none text-[#00f6ff] text-sm placeholder:text-[#00f6ff]/40"
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <button
                onClick={addTag}
                className="px-3 py-2 rounded-xl bg-[#00f6ff]/10 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Insira uma descrição detalhada..."
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/60">Checklist</label>
              <span className="text-xs text-white/40">{completedCount}/{subtasks.length}</span>
            </div>
            
            <div className="space-y-2 mb-3">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleSubtask(subtask.id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      subtask.completed 
                        ? 'bg-[#00f6ff] border-[#00f6ff]' 
                        : 'border-white/20 hover:border-[#00f6ff]/50'
                    }`}
                  >
                    {subtask.completed && <Check className="w-3 h-3 text-[#010516]" />}
                  </button>
                  <span className={`flex-1 text-sm ${subtask.completed ? 'text-white/40 line-through' : 'text-white'}`}>
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(subtask.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                  >
                    <X className="w-3 h-3 text-white/40" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Nova subtarefa..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-dashed border-[#00f6ff]/30 focus:border-[#00f6ff]/50 outline-none text-white text-sm placeholder:text-white/40"
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              />
              <button
                onClick={addSubtask}
                className="px-3 py-2 rounded-xl bg-[#00f6ff]/10 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir tarefa
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-medium hover:bg-[#00f6ff]/90 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
