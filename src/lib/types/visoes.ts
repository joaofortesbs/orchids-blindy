export interface VisionBoard {
  id: string;
  imageUrl: string;
  createdAt: string;
  position: number;
}

export interface MainGoal {
  id: string;
  text: string;
  year: number;
  createdAt: string;
}

export interface GoalAction {
  id: string;
  text: string;
  completed: boolean;
}

export interface GoalCategory {
  id: string;
  name: string;
  icon: string;
  goals: Goal[];
}

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
  categoryId: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  progress: number;
  type: 'book' | 'podcast' | 'video' | 'course';
}

export interface Reminder {
  id: string;
  text: string;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface FutureLetter {
  id: string;
  title: string;
  content: string;
  openDate: string;
  createdAt: string;
  isOpened: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'fiduciary' | 'crypto';
  accountType: string;
  personType: string;
  balance: number;
  notes: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'confirmed';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'boleto';

export interface Transaction {
  id: string;
  title: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes: string;
  bankAccountId: string | null;
}

export interface FinancePeriod {
  startDate: string;
  endDate: string;
}

export const EXPENSE_CATEGORIES = [
  'ALIMENTACAO',
  'TRANSPORTE',
  'MORADIA',
  'SAUDE',
  'EDUCACAO',
  'LAZER',
  'SERVICOS',
  'VESTUARIO',
  'OUTROS'
] as const;

export const INCOME_CATEGORIES = [
  'SALARIO',
  'FREELANCE',
  'INVESTIMENTOS',
  'VENDAS',
  'OUTROS'
] as const;

export const DEFAULT_GOAL_CATEGORIES: Omit<GoalCategory, 'goals'>[] = [
  { id: 'saude', name: 'Saúde', icon: '✦' },
  { id: 'conhecimento', name: 'Conhecimento aplicável', icon: '📋' },
  { id: 'financas', name: 'Finanças', icon: '💰' },
  { id: 'conquistas-pessoais', name: 'Conquistas Pessoais (Experiências)', icon: '🌐' },
  { id: 'habilidades', name: 'Habilidade e Hobbies', icon: '🎯' },
  { id: 'negocios', name: 'Negócios/Profissional', icon: '💼' },
  { id: 'conquistas-materiais', name: 'Conquistas Materiais', icon: '🏠' },
  { id: 'espiritualidade', name: 'Espiritualidade', icon: '🧘' },
  { id: 'tema-livre', name: 'Tema livre', icon: '✨' },
];

export interface VisoesData {
  visionBoard: VisionBoard[];
  mainGoal: MainGoal | null;
  goalActions: GoalAction[];
  goalCategories: GoalCategory[];
  books: Book[];
  reminders: Reminder[];
  notes: Note[];
  futureLetters: FutureLetter[];
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  selectedYear: number;
  financePeriod: FinancePeriod;
}

export const DEFAULT_VISOES_DATA: VisoesData = {
  visionBoard: [],
  mainGoal: null,
  goalActions: [],
  goalCategories: DEFAULT_GOAL_CATEGORIES.map(cat => ({ ...cat, goals: [] })),
  books: [],
  reminders: [],
  notes: [],
  futureLetters: [],
  bankAccounts: [],
  transactions: [],
  selectedYear: new Date().getFullYear(),
  financePeriod: {
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-01-31`,
  },
};
