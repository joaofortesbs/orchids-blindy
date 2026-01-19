export type Priority = 'alta' | 'media' | 'baixa';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  tags: string[];
  subtasks: SubTask[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface PomodoroCategory {
  id: string;
  name: string;
  color: string;
  duration?: number;
}

export interface PomodoroSettings {
  categories: PomodoroCategory[];
  intervals: {
    shortBreak: number;
    longBreak: number;
    cyclesUntilLongBreak: number;
  };
}

export interface PomodoroSession {
  id: string;
  categoryId: string;
  duration: number;
  completedAt: string;
  date: string;
}

export interface TimeChartData {
  date: string;
  categoryId: string;
  totalMinutes: number;
}

export type ChartViewType = 'bar' | 'line';
export type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BlindadosData {
  kanban: {
    columns: KanbanColumn[];
  };
  pomodoro: {
    settings: PomodoroSettings;
    sessions: PomodoroSession[];
  };
  lastUpdated: string;
}

export const DEFAULT_CATEGORIES: PomodoroCategory[] = [
  { id: 'produtividade', name: 'Produtividade', color: '#ef4444', duration: 25 },
  { id: 'estudos', name: 'Estudos', color: '#f59e0b', duration: 50 },
  { id: 'descanso', name: 'Descanso', color: '#6b7280', duration: 15 },
];

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  categories: DEFAULT_CATEGORIES,
  intervals: {
    shortBreak: 5,
    longBreak: 15,
    cyclesUntilLongBreak: 4,
  },
};

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'pendentes', title: 'PENDENTES', cards: [] },
  { id: 'em-execucao', title: 'EM EXECUÇÃO', cards: [] },
  { id: 'produzindo', title: 'PRODUZINDO', cards: [] },
  { id: 'concluidas', title: 'CONCLUÍDAS', cards: [] },
];

export const DEFAULT_DATA: BlindadosData = {
  kanban: {
    columns: DEFAULT_KANBAN_COLUMNS,
  },
  pomodoro: {
    settings: DEFAULT_POMODORO_SETTINGS,
    sessions: [],
  },
  lastUpdated: new Date().toISOString(),
};
