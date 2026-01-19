import { BlindadosData, DEFAULT_DATA } from '../types/blindados';

const STORAGE_KEY = 'blindados_data';
const STORAGE_VERSION = '1.0.0';
const EXPIRY_DAYS = 180;

function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const canvasFingerprint = canvas.toDataURL();
  
  const screenData = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  
  const combinedString = `${canvasFingerprint}-${screenData}-${timezone}-${language}`;
  
  let hash = 0;
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

interface StorageWrapper {
  data: BlindadosData;
  fingerprint: string;
  expiresAt: string;
  version: string;
}

function getExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + EXPIRY_DAYS);
  return date.toISOString();
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function saveData(data: BlindadosData): void {
  try {
    const fingerprint = generateFingerprint();
    const wrapper: StorageWrapper = {
      data: {
        ...data,
        lastUpdated: new Date().toISOString(),
        version: STORAGE_VERSION,
      },
      fingerprint,
      expiresAt: getExpiryDate(),
      version: STORAGE_VERSION,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    } catch {
    }
    
    if ('indexedDB' in window) {
      saveToIndexedDB(wrapper);
    }
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

export function loadData(): BlindadosData {
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    
    if (localData) {
      const wrapper: StorageWrapper = JSON.parse(localData);
      
      if (!isExpired(wrapper.expiresAt)) {
        const newWrapper = {
          ...wrapper,
          expiresAt: getExpiryDate(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newWrapper));
        return wrapper.data;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    const sessionData = sessionStorage.getItem(STORAGE_KEY);
    if (sessionData) {
      const wrapper: StorageWrapper = JSON.parse(sessionData);
      if (!isExpired(wrapper.expiresAt)) {
        saveData(wrapper.data);
        return wrapper.data;
      }
    }
    
    return DEFAULT_DATA;
  } catch (error) {
    console.error('Error loading data:', error);
    return DEFAULT_DATA;
  }
}

async function saveToIndexedDB(wrapper: StorageWrapper): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BlindadosDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      store.put({ id: STORAGE_KEY, ...wrapper });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

export async function loadFromIndexedDB(): Promise<BlindadosData | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open('BlindadosDB', 1);
    
    request.onerror = () => resolve(null);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const getRequest = store.get(STORAGE_KEY);
      
      getRequest.onsuccess = () => {
        if (getRequest.result && !isExpired(getRequest.result.expiresAt)) {
          resolve(getRequest.result.data);
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => resolve(null);
    };
  });
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  
  if ('indexedDB' in window) {
    const request = indexedDB.open('BlindadosDB', 1);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      store.delete(STORAGE_KEY);
    };
  }
}

export function exportToCSV(data: BlindadosData): string {
  const rows: string[] = [];
  
  rows.push('=== SESSÕES POMODORO ===');
  rows.push('Data,Categoria,Duração (min)');
  
  data.pomodoro.sessions.forEach(session => {
    const category = data.pomodoro.settings.categories.find(c => c.id === session.categoryId);
    rows.push(`${session.date},${category?.name || session.categoryId},${session.duration}`);
  });
  
  rows.push('');
  rows.push('=== TAREFAS KANBAN ===');
  rows.push('Coluna,Título,Prioridade,Tags,Subtarefas Concluídas,Total Subtarefas');
  
  data.kanban.columns.forEach(column => {
    column.cards.forEach(card => {
      const completedSubtasks = card.subtasks.filter(s => s.completed).length;
      rows.push(`${column.title},"${card.title}",${card.priority},"${card.tags.join(', ')}",${completedSubtasks},${card.subtasks.length}`);
    });
  });
  
  return rows.join('\n');
}

export function downloadCSV(data: BlindadosData): void {
  const csv = exportToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `blindados_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
