"use client";

import { useState, useCallback } from 'react';
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

  const [activeSection, setActiveSection] = useState<Section>('flows');
  const [collapsed, setCollapsed] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const { user, isLoading: authLoading, signOut } = useAuth();

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

  if (!authLoading && !user) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  if (!isLoaded && !data.pomodoro?.settings?.intervals) {
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
        onSectionChange={setActiveSection}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onSignOut={signOut}
        userName={user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
      />

      <main className="flex-1 h-screen overflow-hidden">
        <AnimatePresence mode="wait">
          {activeSection === 'flows' ? (
            <motion.div
              key="flows"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full p-6 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: '45%', minHeight: '360px' }}>
                <PomodoroTimer
                  settings={data.pomodoro.settings}
                  onSettingsChange={updatePomodoroSettings}
                  onSessionComplete={handleSessionComplete}
                  onLiveSessionUpdate={handleLiveSessionUpdate}
                />
                <TimeChart
                  sessions={data.pomodoro.sessions}
                  categories={data.pomodoro.settings.categories}
                  liveSession={liveSession}
                />
              </div>

              <div className="flex-1 min-h-0" style={{ height: '55%' }}>
                <KanbanBoard
                  columns={data.kanban.columns}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
