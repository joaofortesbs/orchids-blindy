"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/blindados/Sidebar';
import { PomodoroTimer } from '@/components/blindados/PomodoroTimer';
import { TimeChart } from '@/components/blindados/TimeChart';
import { KanbanBoard } from '@/components/blindados/KanbanBoard';
import { VisoesDashboard } from '@/components/visoes/VisoesDashboard';
import { AuthPage } from '@/components/auth/AuthPage';
import { CreateOrganizationModal } from '@/components/blindados/CreateOrganizationModal';
import { TeamsSection } from '@/components/blindados/TeamsSection';
import { useBlindadosData } from '@/hooks/useBlindadosData';
import { useAutoFix } from '@/hooks/useAutoFix';
import { LiveSession } from '@/hooks/useTimerPersistence';
import { useAuth } from '@/lib/contexts/AuthContext';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { downloadCSV } from '@/lib/utils/storage';
import { safeStorage } from '@/lib/utils/safeStorage';
import { STORAGE_KEYS } from '@/lib/utils/storage.constants';
import { Organization, CreateOrganizationData } from '@/lib/types/organization';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

type Section = 'flows' | 'visoes' | 'painel' | 'equipes';

function MainApp() {
  const {
    data,
    isLoaded,
    updateKanbanColumns,
    updateKanbanColumn,
    addKanbanColumn,
    deleteKanbanColumn,
    addKanbanCard,
    updateKanbanCard,
    deleteKanbanCard,
    moveCard,
    updateCardPositions,
    addPomodoroSession,
    updatePomodoroSettings,
  } = useBlindadosData();

  useAutoFix();

  const [activeSection, setActiveSection] = useState<Section>(() => {
    const saved = safeStorage.getString(STORAGE_KEYS.ACTIVE_SECTION);
    if (saved === 'flows' || saved === 'visoes' || saved === 'painel' || saved === 'equipes') return saved as Section;
    return 'flows';
  });
  
  const [collapsed, setCollapsed] = useState(() => {
    return safeStorage.getString(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  });
  
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const { user, isLoading: authLoading, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);

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

  useEffect(() => {
    const loadOrganizations = async () => {
      if (!user) {
        setOrganizations([]);
        setSelectedOrganization(null);
        return;
      }

      try {
        const { data: membershipData } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (!membershipData || membershipData.length === 0) {
          setOrganizations([]);
          return;
        }

        const orgIds = membershipData.map(m => m.organization_id);
        
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)
          .order('created_at', { ascending: false });

        const orgs: Organization[] = (orgsData || []).map(o => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          businessModel: o.business_model,
          isPrivate: o.is_private,
          ownerId: o.owner_id,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }));

        setOrganizations(orgs);

        const savedOrgId = safeStorage.getString('selected_organization_id');
        if (savedOrgId) {
          const savedOrg = orgs.find(o => o.id === savedOrgId);
          if (savedOrg) {
            setSelectedOrganization(savedOrg);
          }
        }
      } catch (e) {
        console.warn('Failed to load organizations:', e);
      }
    };

    loadOrganizations();
  }, [user, supabase]);

  const handleSelectOrganization = useCallback((org: Organization | null) => {
    setSelectedOrganization(org);
    if (org) {
      safeStorage.setString('selected_organization_id', org.id);
    } else {
      safeStorage.remove('selected_organization_id');
    }
  }, []);

  const handleCreateOrganization = useCallback(async (data: CreateOrganizationData) => {
    if (!user) return;

    const slug = data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        slug: `${slug}-${Date.now().toString(36)}`,
        business_model: data.businessModel,
        is_private: data.isPrivate,
        owner_id: user.id,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Failed to create organization:', orgError);
      throw orgError;
    }

    await supabase
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      });

    for (const invite of data.invites) {
      if (invite.email) {
        await supabase
          .from('organization_invites')
          .insert({
            organization_id: orgData.id,
            email: invite.email.toLowerCase(),
            role: invite.role,
            invited_by: user.id,
          });
      }
    }

    const newOrg: Organization = {
      id: orgData.id,
      name: orgData.name,
      slug: orgData.slug,
      businessModel: orgData.business_model,
      isPrivate: orgData.is_private,
      ownerId: orgData.owner_id,
      createdAt: orgData.created_at,
      updatedAt: orgData.updated_at,
    };

    setOrganizations(prev => [newOrg, ...prev]);
    setSelectedOrganization(newOrg);
    safeStorage.setString('selected_organization_id', newOrg.id);
  }, [user, supabase]);

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
        organizations={organizations}
        selectedOrganization={selectedOrganization}
        onSelectOrganization={handleSelectOrganization}
        onCreateOrganization={() => setIsCreateOrgModalOpen(true)}
      />

      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
        onCreate={handleCreateOrganization}
      />

      <main className="flex-1 h-screen overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeSection === 'flows' && (
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
                  onUpdateColumn={updateKanbanColumn}
                  onAddColumn={addKanbanColumn}
                  onDeleteColumn={deleteKanbanColumn}
                  onAddCard={addKanbanCard}
                  onUpdateCard={updateKanbanCard}
                  onDeleteCard={deleteKanbanCard}
                  onMoveCard={moveCard}
                  onUpdateCardPositions={updateCardPositions}
                />
              </div>
            </motion.div>
          )}
          {activeSection === 'visoes' && (
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
          {activeSection === 'painel' && (
            <motion.div
              key="painel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full p-6"
            >
              <div className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f6ff]/20 to-[#7c3aed]/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00f6ff]"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Painel</h2>
                    <p className="text-sm text-white/40">Configurações da organização</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center h-[calc(100%-80px)] text-white/40">
                  <p className="text-lg mb-2">Configurações da Organização</p>
                  <p className="text-sm">Em breve: Gerencie as configurações da sua organização</p>
                </div>
              </div>
            </motion.div>
          )}
          {activeSection === 'equipes' && (
            <motion.div
              key="equipes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <TeamsSection />
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
