"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/blindados/Sidebar';
import { PomodoroTimer } from '@/components/blindados/PomodoroTimer';
import { TimeChart } from '@/components/blindados/TimeChart';
import { KanbanBoard } from '@/components/blindados/KanbanBoard';
import { VisoesDashboard } from '@/components/visoes/VisoesDashboard';
import { AuthPage } from '@/components/auth/AuthPage';
import { useBlindadosData } from '@/hooks/useBlindadosData';
import { useAutoFix } from '@/hooks/useAutoFix';
import { LiveSession } from '@/hooks/useTimerPersistence';
import { useAuth } from '@/lib/contexts/AuthContext';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { downloadCSV } from '@/lib/utils/storage';
import { safeStorage } from '@/lib/utils/safeStorage';
import { STORAGE_KEYS } from '@/lib/utils/storage.constants';
import { format } from 'date-fns';

type Section = 'flows' | 'visoes';

function MainApp() {
  const {
    data,
    isLoaded,
    updateKanbanColumns,
    addKanbanColumn,
    deleteKanbanColumn,
    addKanbanCard,
    updateKanbanCard,
    deleteKanbanCard,
    moveCard,
    addPomodoroSession,
    updatePomodoroSettings,
  } = useBlindadosData();

  useAutoFix();

  const [activeSection, setActiveSection] = useState<Section>(() => {
    const saved = safeStorage.getString(STORAGE_KEYS.ACTIVE_SECTION);
    if (saved === 'flows' || saved === 'visoes') return saved;
    return 'flows';
  });
  
  const [collapsed, setCollapsed] = useState(() => {
    return safeStorage.getString(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });
  
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user, isLoading: authLoading, signOut } = useAuth();

  const mountedRef = useRef(true);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    safeStorage.setString(STORAGE_KEYS.ACTIVE_SECTION, activeSection);
  }, [activeSection]);

  useEffect(() => {
    safeStorage.setString(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
  }, [collapsed]);

  const handleSectionChange = useCallback((section: Section) => {
    if (section === activeSection || isTransitioning) return;
    
    setIsTransitioning(true);
    setActiveSection(section);
    
    transitionTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsTransitioning(false);
      }
    }, 300);
  }, [activeSection, isTransitioning]);

  const handleSessionComplete = useCallback((categoryId: string, duration: number) => {
    setLiveSession(null);
    addPomodoroSession({
      categoryId,
      duration,
      completedAt: new Date().toISOString(),
      date: format(new Date(), 'yyyy-MM-dd'),
    });
  }, [addPomodoroSession]);

  const handleLiveSessionUpdate = useCallback((session: LiveSession | null) => {
    setLiveSession(session);
  }, []);

  const handleExport = useCallback(() => {
    downloadCSV(data);
  }, [data]);

  const safeSettings = useMemo(() => ({
    categories: data.pomodoro?.settings?.categories || [],
    intervals: {
      shortBreak: data.pomodoro?.settings?.intervals?.shortBreak ?? 5,
      longBreak: data.pomodoro?.settings?.intervals?.longBreak ?? 15,
      cyclesUntilLongBreak: data.pomodoro?.settings?.intervals?.cyclesUntilLongBreak ?? 4,
    },
  }), [data.pomodoro?.settings]);

  const safeSessions = useMemo(() => data.pomodoro?.sessions || [], [data.pomodoro?.sessions]);
  const safeCategories = useMemo(() => data.pomodoro?.settings?.categories || [], [data.pomodoro?.settings?.categories]);
  const safeColumns = useMemo(() => data.kanban?.columns || [], [data.kanban?.columns]);

  if (!authLoading && !user) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  const showLoading = !isLoaded && safeCategories.length === 0;

  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#010516]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-[#00f6ff]/30 border-t-[#00f6ff] rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Carregando dados...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#010516] bg-grid">
      <Sidebar 
        onExport={handleExport} 
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onSignOut={signOut}
        userName={user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
      />

      <main className="flex-1 h-screen overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeSection === 'flows' ? (
            <motion.div
              key="flows"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full p-6 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: '45%', minHeight: '360px' }}>
                <PomodoroTimer
                  settings={safeSettings}
                  onSettingsChange={updatePomodoroSettings}
                  onSessionComplete={handleSessionComplete}
                  onLiveSessionUpdate={handleLiveSessionUpdate}
                />
                <TimeChart
                  sessions={safeSessions}
                  categories={safeCategories}
                  liveSession={liveSession}
                />
              </div>

              <div className="flex-1 min-h-0" style={{ height: '55%' }}>
                <KanbanBoard
                  columns={safeColumns}
                  onColumnsChange={updateKanbanColumns}
                  onAddColumn={addKanbanColumn}
                  onDeleteColumn={deleteKanbanColumn}
                  onAddCard={addKanbanCard}
                  onUpdateCard={updateKanbanCard}
                  onDeleteCard={deleteKanbanCard}
                  onMoveCard={moveCard}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="visoes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <VisoesDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
