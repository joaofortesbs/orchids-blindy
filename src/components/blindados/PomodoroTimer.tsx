"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Settings, ChevronDown, Plus, X, Volume2, VolumeX } from 'lucide-react';
import { PomodoroSettings, PomodoroCategory, DEFAULT_POMODORO_SETTINGS } from '@/lib/types/blindados';
import { useTimerPersistence, LiveSession } from '@/hooks/useTimerPersistence';

interface PomodoroTimerProps {
  settings: PomodoroSettings;
  onSettingsChange: (settings: PomodoroSettings) => void;
  onSessionComplete: (categoryId: string, duration: number) => void;
  onLiveSessionUpdate?: (session: LiveSession | null) => void;
}

const CATEGORY_STORAGE_KEY = 'blindy_selected_category_v1';
const DURATIONS_STORAGE_KEY = 'blindy_category_durations_v1';
const SOUND_STORAGE_KEY = 'blindy_sound_enabled_v1';

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function PomodoroTimer({ 
  settings, 
  onSettingsChange, 
  onSessionComplete,
  onLiveSessionUpdate 
}: PomodoroTimerProps) {
  const [selectedCategory, setSelectedCategory] = useState<PomodoroCategory>(() => {
    const storage = safeStorage();
    if (storage && settings.categories.length > 0) {
      const savedId = storage.getItem(CATEGORY_STORAGE_KEY);
      const found = settings.categories.find(c => c.id === savedId);
      if (found) return found;
    }
    return settings.categories[0] || { id: 'default', name: 'Foco', color: '#00f6ff', duration: 25 };
  });
  
  const [categoryDurations, setCategoryDurations] = useState<Record<string, number>>(() => {
    const storage = safeStorage();
    if (storage) {
      try {
        const saved = storage.getItem(DURATIONS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    const durations: Record<string, number> = {};
    settings.categories.forEach((cat) => {
      durations[cat.id] = cat.duration || 25;
    });
    return durations;
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const storage = safeStorage();
    if (storage) {
      const saved = storage.getItem(SOUND_STORAGE_KEY);
      return saved !== 'false';
    }
    return true;
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const storage = safeStorage();
    if (storage) {
      storage.setItem(CATEGORY_STORAGE_KEY, selectedCategory.id);
    }
  }, [selectedCategory.id]);

  useEffect(() => {
    const storage = safeStorage();
    if (storage) {
      storage.setItem(DURATIONS_STORAGE_KEY, JSON.stringify(categoryDurations));
    }
  }, [categoryDurations]);

  useEffect(() => {
    const storage = safeStorage();
    if (storage) {
      storage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (settings.categories.length > 0) {
      const durations: Record<string, number> = { ...categoryDurations };
      settings.categories.forEach((cat) => {
        if (!durations[cat.id]) {
          durations[cat.id] = cat.duration || 25;
        }
      });
      setCategoryDurations(durations);
      
      const currentCatExists = settings.categories.find(c => c.id === selectedCategory.id);
      if (!currentCatExists) {
        setSelectedCategory(settings.categories[0]);
      } else if (currentCatExists.name !== selectedCategory.name || currentCatExists.color !== selectedCategory.color) {
        setSelectedCategory(currentCatExists);
      }
    }
  }, [settings.categories]);

  const handleSessionComplete = useCallback((categoryId: string, durationMinutes: number) => {
    if (!mountedRef.current) return;
    
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const category = settings.categories.find(c => c.id === categoryId);
      new Notification('Pomodoro Concluído!', {
        body: `Sessão de ${category?.name || 'foco'} finalizada!`,
        icon: '/favicon.ico',
        tag: 'pomodoro-complete',
        requireInteraction: true,
      });
    }

    onSessionComplete(categoryId, durationMinutes);
  }, [soundEnabled, settings.categories, onSessionComplete]);

  const currentDuration = categoryDurations[selectedCategory.id] || 25;

  const {
    timeLeft,
    isRunning,
    liveSession,
    isLoaded,
    toggle,
    reset,
    setCategory,
    progress,
  } = useTimerPersistence(
    selectedCategory.id,
    currentDuration * 60,
    handleSessionComplete
  );

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2relegsZlOHBqnIkBkOl5NayZxMHSqHawo98JgZGtM7ClnsvCU202bmYezMKVLnP0peGPBBbr8jLo6FaIV29w72mZ1VXvtSlf1sABm2+zoWDNgA5r9a4mnFRHDLT//');
  }, []);

  useEffect(() => {
    if (onLiveSessionUpdate) {
      onLiveSessionUpdate(liveSession);
    }
  }, [liveSession, onLiveSessionUpdate]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleCategoryChange = useCallback((cat: PomodoroCategory) => {
    if (isRunning) return;
    setSelectedCategory(cat);
    setCategory(cat.id, (categoryDurations[cat.id] || 25) * 60);
    setShowCategoryDropdown(false);
  }, [isRunning, categoryDurations, setCategory]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleAddCategory = useCallback(() => {
    const newCategory: PomodoroCategory = {
      id: `cat-${Date.now()}`,
      name: 'Nova Categoria',
      color: '#00f6ff',
      duration: 25,
    };
    const newSettings: PomodoroSettings = {
      ...settings,
      categories: [...settings.categories, newCategory],
    };
    onSettingsChange(newSettings);
    setCategoryDurations(prev => ({ ...prev, [newCategory.id]: 25 }));
  }, [settings, onSettingsChange]);

  const handleUpdateCategory = useCallback((id: string, updates: Partial<PomodoroCategory>) => {
    const newSettings: PomodoroSettings = {
      ...settings,
      categories: settings.categories.map(cat =>
        cat.id === id ? { ...cat, ...updates } : cat
      ),
    };
    onSettingsChange(newSettings);
    if (selectedCategory.id === id) {
      setSelectedCategory(prev => ({ ...prev, ...updates }));
    }
  }, [settings, onSettingsChange, selectedCategory.id]);

  const handleDeleteCategory = useCallback((id: string) => {
    if (settings.categories.length <= 1) return;
    const newSettings: PomodoroSettings = {
      ...settings,
      categories: settings.categories.filter(cat => cat.id !== id),
    };
    onSettingsChange(newSettings);
    if (selectedCategory.id === id) {
      setSelectedCategory(newSettings.categories[0]);
    }
  }, [settings, onSettingsChange, selectedCategory.id]);

  const handleDurationChange = useCallback((catId: string, duration: number) => {
    setCategoryDurations(prev => ({ ...prev, [catId]: duration }));
    const newSettings: PomodoroSettings = {
      ...settings,
      categories: settings.categories.map(cat =>
        cat.id === catId ? { ...cat, duration } : cat
      ),
    };
    onSettingsChange(newSettings);
  }, [settings, onSettingsChange]);

  const displayTime = useMemo(() => formatTime(timeLeft), [timeLeft, formatTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${selectedCategory.color}20 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <motion.div
            className="px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase"
            style={{ 
              borderColor: selectedCategory.color,
              color: selectedCategory.color,
            }}
          >
            POMODORO
          </motion.div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#00f6ff]" />
              ) : (
                <VolumeX className="w-4 h-4 text-white/40" />
              )}
            </motion.button>

            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCategory.color }}
                />
                <span className="text-sm text-white">{selectedCategory.name}</span>
                <ChevronDown className="w-4 h-4 text-white/60" />
              </motion.button>

              <AnimatePresence>
                {showCategoryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full mt-2 right-0 w-48 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl overflow-hidden z-50"
                  >
                    {settings.categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat)}
                        className={`
                          w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors
                          ${selectedCategory.id === cat.id ? 'bg-white/10' : ''}
                          ${isRunning && selectedCategory.id !== cat.id ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-white">{cat.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
            >
              <Settings className="w-4 h-4 text-white/60" />
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <svg className="w-48 h-48 -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-white/5"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke={selectedCategory.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={553}
                strokeDashoffset={553 - (553 * progress) / 100}
                style={{
                  filter: `drop-shadow(0 0 8px ${selectedCategory.color}50)`,
                  transition: 'stroke-dashoffset 0.5s ease-out',
                }}
              />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-bold text-white tracking-tight font-mono tabular-nums">
                {displayTime}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={reset}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-white/60" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggle}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all"
            style={{ 
              backgroundColor: selectedCategory.color,
              color: '#010516',
              boxShadow: `0 0 30px ${selectedCategory.color}40`,
            }}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Iniciar</span>
              </>
            )}
          </motion.button>
        </div>

        {isRunning && liveSession && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-white/40 text-xs mt-4"
          >
            Sessão em andamento • {liveSession.elapsedMinutes} min
          </motion.p>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Configurações do Pomodoro</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </motion.button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3 text-white/60">
                    <span className="text-sm font-medium">Sessões de foco</span>
                  </div>
                  
                  <div className="space-y-3">
                    {settings.categories.map((cat) => (
                      <div key={cat.id} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={cat.color}
                          onChange={(e) => handleUpdateCategory(cat.id, { color: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => handleUpdateCategory(cat.id, { name: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                        />
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={categoryDurations[cat.id] || 25}
                          onChange={(e) => handleDurationChange(cat.id, parseInt(e.target.value) || 25)}
                          className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm text-center"
                        />
                        <span className="text-white/40 text-sm">min</span>
                        {settings.categories.length > 1 && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </motion.button>
                        )}
                      </div>
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddCategory}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#00f6ff]/30 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/5 transition-colors w-full justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar categoria
                  </motion.button>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3 text-white/60">
                    <span className="text-sm font-medium">Intervalos</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Intervalo curto</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.intervals.shortBreak}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          intervals: { ...settings.intervals, shortBreak: parseInt(e.target.value) || 5 }
                        })}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Intervalo longo</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings.intervals.longBreak}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          intervals: { ...settings.intervals, longBreak: parseInt(e.target.value) || 15 }
                        })}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1 block">Ciclos até o intervalo longo</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.intervals.cyclesUntilLongBreak}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      intervals: { ...settings.intervals, cyclesUntilLongBreak: parseInt(e.target.value) || 4 }
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold hover:bg-[#00f6ff]/90 transition-colors"
                >
                  Salvar configurações
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
