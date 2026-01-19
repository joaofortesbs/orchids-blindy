"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { BarChart3, TrendingUp, Zap } from 'lucide-react';
import { PomodoroSession, PomodoroCategory, ChartViewType, ChartPeriod } from '@/lib/types/blindados';
import { LiveSession } from '@/hooks/useTimerPersistence';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval, parseISO, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIVE_SESSION_STORAGE_KEY = 'blindados_live_session_v2';

interface TimeChartProps {
  sessions: PomodoroSession[];
  categories: PomodoroCategory[];
  liveSession?: LiveSession | null;
}

function loadLiveSessionFromStorage(): { categoryId: string; elapsedSeconds: number; startedAt?: number } | null {
  try {
    const stored = localStorage.getItem(LIVE_SESSION_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.startedAt) {
        const now = Date.now();
        const elapsedSinceStart = Math.floor((now - data.startedAt) / 1000);
        return {
          ...data,
          elapsedSeconds: elapsedSinceStart,
        };
      }
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function TimeChart({ sessions, categories, liveSession }: TimeChartProps) {
  const [chartType, setChartType] = useState<ChartViewType>('bar');
  const [period, setPeriod] = useState<ChartPeriod>('daily');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(categories.map(c => c.id));
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(true);
  const previousChartTypeRef = useRef<ChartViewType>(chartType);
  const [storedLiveSession, setStoredLiveSession] = useState<{ categoryId: string; elapsedSeconds: number } | null>(null);

  useEffect(() => {
    const stored = loadLiveSessionFromStorage();
    if (stored && !liveSession) {
      setStoredLiveSession(stored);
    }
  }, [liveSession]);

  useEffect(() => {
    if (liveSession) {
      setStoredLiveSession(null);
    }
  }, [liveSession]);

  useEffect(() => {
    if (previousChartTypeRef.current !== chartType) {
      setIsAnimationEnabled(true);
      previousChartTypeRef.current = chartType;
      const timeout = setTimeout(() => {
        setIsAnimationEnabled(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [chartType]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsAnimationEnabled(false);
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  const effectiveLiveSession = liveSession || (storedLiveSession ? {
    categoryId: storedLiveSession.categoryId,
    elapsedMinutes: Math.floor(storedLiveSession.elapsedSeconds / 60),
    elapsedSeconds: storedLiveSession.elapsedSeconds,
    isRunning: false,
  } : null);

  const chartData = useMemo(() => {
    const now = new Date();
    let dateRange: Date[] = [];
    let labelFormat: string = '';

    switch (period) {
      case 'daily':
        dateRange = eachDayOfInterval({
          start: subDays(now, 6),
          end: now,
        });
        labelFormat = 'EEE';
        break;
      case 'weekly':
        dateRange = eachWeekOfInterval({
          start: subWeeks(now, 3),
          end: now,
        });
        labelFormat = "'Sem' w";
        break;
      case 'monthly':
        dateRange = eachMonthOfInterval({
          start: subMonths(now, 11),
          end: now,
        });
        labelFormat = 'MMM';
        break;
      case 'yearly':
        dateRange = [subYears(now, 4), subYears(now, 3), subYears(now, 2), subYears(now, 1), now];
        labelFormat = 'yyyy';
        break;
    }

    return dateRange.map((date, idx) => {
      const dataPoint: Record<string, number | string> = {
        name: format(date, labelFormat, { locale: ptBR }),
        date: date.toISOString(),
      };

      const isCurrentPeriod = idx === dateRange.length - 1;

      categories.forEach((cat) => {
        if (!selectedCategories.includes(cat.id)) {
          dataPoint[cat.id] = 0;
          return;
        }

        const filteredSessions = sessions.filter((session) => {
          const sessionDate = parseISO(session.date);
          let interval: { start: Date; end: Date };

          switch (period) {
            case 'daily':
              interval = { start: date, end: date };
              return format(sessionDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && session.categoryId === cat.id;
            case 'weekly':
              interval = { start: startOfWeek(date, { locale: ptBR }), end: endOfWeek(date, { locale: ptBR }) };
              break;
            case 'monthly':
              interval = { start: startOfMonth(date), end: endOfMonth(date) };
              break;
            case 'yearly':
              interval = { start: startOfYear(date), end: endOfYear(date) };
              break;
          }

          return isWithinInterval(sessionDate, interval) && session.categoryId === cat.id;
        });

        let totalMinutes = filteredSessions.reduce((acc, s) => acc + s.duration, 0);

        if (effectiveLiveSession && effectiveLiveSession.categoryId === cat.id && isCurrentPeriod) {
          totalMinutes += effectiveLiveSession.elapsedSeconds / 60;
        }

        dataPoint[cat.id] = Math.round(totalMinutes * 100) / 100;
      });

      return dataPoint;
    });
  }, [sessions, categories, period, selectedCategories, effectiveLiveSession]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl p-3 shadow-xl">
        <p className="text-white/60 text-xs mb-2">{label}</p>
        {payload.map((entry, index) => {
          const category = categories.find(c => c.id === entry.name);
          const isLive = effectiveLiveSession?.categoryId === entry.name;
          const minutes = Math.floor(entry.value);
          const seconds = Math.round((entry.value - minutes) * 60);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className={`w-2 h-2 rounded-full ${isLive ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: category?.color || entry.color }}
              />
              <span className="text-white">
                {category?.name}: {minutes}m {seconds}s
                {isLive && effectiveLiveSession?.isRunning && <span className="text-[#00f6ff] ml-1 text-xs">(ao vivo)</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const totalTodayMinutes = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let total = sessions
      .filter(s => s.date === today)
      .reduce((acc, s) => acc + s.duration, 0);
    
    if (effectiveLiveSession) {
      total += effectiveLiveSession.elapsedSeconds / 60;
    }
    
    return total;
  }, [sessions, effectiveLiveSession]);

  const formatTotalTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: 'radial-gradient(ellipse at 100% 0%, #00f6ff20 0%, transparent 70%)',
        }}
      />

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {categories.map((cat) => {
                const isLive = effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isRunning;
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                      selectedCategories.includes(cat.id) ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full ${isLive ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs text-white">{cat.name}</span>
                    {isLive && (
                      <Zap className="w-3 h-3 text-[#00f6ff] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {effectiveLiveSession && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00f6ff]/10 border border-[#00f6ff]/30"
                >
                  <div className={`w-2 h-2 rounded-full bg-[#00f6ff] ${effectiveLiveSession.isRunning ? 'animate-pulse' : ''}`} />
                  <span className="text-xs text-[#00f6ff] font-medium">
                    {Math.floor(effectiveLiveSession.elapsedSeconds / 60)}m {effectiveLiveSession.elapsedSeconds % 60}s
                  </span>
                </motion.div>
              )}

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setChartType('bar')}
                  className={`p-2 rounded-lg transition-colors ${
                    chartType === 'bar' ? 'bg-[#00f6ff]/20 text-[#00f6ff]' : 'bg-white/5 text-white/40'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setChartType('line')}
                  className={`p-2 rounded-lg transition-colors ${
                    chartType === 'line' ? 'bg-[#00f6ff]/20 text-[#00f6ff]' : 'bg-white/5 text-white/40'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff40" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#ffffff40" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.floor(value)}m`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {categories.filter(c => selectedCategories.includes(c.id)).map((cat) => (
                    <Bar 
                      key={cat.id}
                      dataKey={cat.id}
                      fill={cat.color}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                      isAnimationActive={isAnimationEnabled}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={cat.color}
                          style={{
                            filter: effectiveLiveSession?.categoryId === cat.id && index === chartData.length - 1 
                              ? `drop-shadow(0 0 8px ${cat.color})` 
                              : undefined,
                          }}
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff40" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#ffffff40" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.floor(value)}m`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {categories.filter(c => selectedCategories.includes(c.id)).map((cat) => (
                    <Line 
                      key={cat.id}
                      type="monotone"
                      dataKey={cat.id}
                      stroke={cat.color}
                      strokeWidth={2}
                      dot={{ fill: cat.color, strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      isAnimationActive={isAnimationEnabled}
                    />
                  ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-white/40">
              Hoje: <span className="text-[#00f6ff] font-medium">{formatTotalTime(totalTodayMinutes)}</span>
            </div>

            <div className="flex items-center justify-center gap-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as ChartPeriod[]).map((p) => (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === p 
                      ? 'bg-[#00f6ff]/20 text-[#00f6ff] border border-[#00f6ff]/30' 
                      : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'
                  }`}
                >
                  {p === 'daily' && 'Diário'}
                  {p === 'weekly' && 'Semanal'}
                  {p === 'monthly' && 'Mensal'}
                  {p === 'yearly' && 'Anual'}
                </motion.button>
              ))}
            </div>
          </div>
      </div>
    </motion.div>
  );
}
