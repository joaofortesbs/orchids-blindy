"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';
import { BarChart3, TrendingUp, Zap, Pause, Target, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { PomodoroSession, PomodoroCategory, ChartViewType, ChartPeriod } from '@/lib/types/blindados';
import { LiveSession } from '@/hooks/useTimerPersistence';
import { timerSyncManager, LiveSessionEvent } from '@/lib/utils/timerSync';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval, parseISO, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeChartProps {
  sessions: PomodoroSession[];
  categories: PomodoroCategory[];
  liveSession?: LiveSession | null;
}

export function TimeChart({ sessions, categories, liveSession: propLiveSession }: TimeChartProps) {
  const [chartType, setChartType] = useState<ChartViewType>('bar');
  const [period, setPeriod] = useState<ChartPeriod>('daily');
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(true);
  const previousChartTypeRef = useRef<ChartViewType>(chartType);
  const [syncedSession, setSyncedSession] = useState<LiveSessionEvent | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!timerSyncManager) return;

    const unsubscribe = timerSyncManager.subscribe((session) => {
      setSyncedSession(session);
    });

    updateIntervalRef.current = setInterval(() => {
      if (timerSyncManager) {
        const active = timerSyncManager.getActiveSession();
        if (active) {
          setSyncedSession(active);
        }
      }
      setForceUpdate(prev => prev + 1);
    }, 500);

    return () => {
      unsubscribe();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const effectiveLiveSession = useMemo(() => {
    if (propLiveSession?.isRunning) {
      return {
        categoryId: propLiveSession.categoryId,
        elapsedMinutes: Math.floor(propLiveSession.elapsedSeconds / 60),
        elapsedSeconds: propLiveSession.elapsedSeconds,
        isRunning: true,
        isPaused: false,
      };
    }
    if (syncedSession) {
      return {
        categoryId: syncedSession.categoryId,
        elapsedMinutes: Math.floor(syncedSession.elapsedSeconds / 60),
        elapsedSeconds: syncedSession.elapsedSeconds,
        isRunning: syncedSession.isRunning,
        isPaused: syncedSession.isPaused || false,
      };
    }
    return null;
  }, [propLiveSession, syncedSession, forceUpdate]);

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
  }, [sessions, categories, period, effectiveLiveSession, forceUpdate]);

  const toggleCategory = useCallback((categoryId: string) => {
    setHiddenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const visibleCategories = useMemo(() => 
    categories.filter(c => !hiddenCategories.has(c.id)),
    [categories, hiddenCategories]
  );

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl p-3 shadow-xl">
        <p className="text-white/60 text-xs mb-2">{label}</p>
        {payload.map((entry, index) => {
          const category = categories.find(c => c.id === entry.name);
          const isLive = effectiveLiveSession?.categoryId === entry.name && effectiveLiveSession?.isRunning;
          const isPaused = effectiveLiveSession?.categoryId === entry.name && effectiveLiveSession?.isPaused;
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
                {isLive && <span className="text-[#00f6ff] ml-1 text-xs">(ao vivo)</span>}
                {isPaused && <span className="text-amber-400 ml-1 text-xs">(pausado)</span>}
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
  }, [sessions, effectiveLiveSession, forceUpdate]);

  const scoreData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (period) {
      case 'daily':
        startDate = subDays(now, 0);
        break;
      case 'weekly':
        startDate = startOfWeek(now, { locale: ptBR });
        endDate = endOfWeek(now, { locale: ptBR });
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'yearly':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
    }

    const periodSessions = sessions.filter((session) => {
      const sessionDate = parseISO(session.date);
      if (period === 'daily') {
        return format(sessionDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      }
      return isWithinInterval(sessionDate, { start: startDate, end: endDate });
    });

    const categoryTotals = categories.map((cat) => {
      const catSessions = periodSessions.filter(s => s.categoryId === cat.id);
      let totalMinutes = catSessions.reduce((acc, s) => acc + s.duration, 0);
      
      if (effectiveLiveSession && effectiveLiveSession.categoryId === cat.id) {
        totalMinutes += effectiveLiveSession.elapsedSeconds / 60;
      }

      return {
        id: cat.id,
        name: cat.name,
        value: Math.round(totalMinutes * 100) / 100,
        color: cat.color,
        sessions: catSessions,
        isLive: effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isRunning,
        isPaused: effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isPaused,
      };
    }).filter(cat => cat.value > 0 || cat.isLive);

    const allSessions = periodSessions.map((session) => {
      const cat = categories.find(c => c.id === session.categoryId);
      return {
        ...session,
        categoryName: cat?.name || 'Desconhecido',
        categoryColor: cat?.color || '#6b7280',
      };
    }).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const totalMinutes = categoryTotals.reduce((acc, cat) => acc + cat.value, 0);

    return {
      pieData: categoryTotals,
      allSessions,
      totalMinutes,
    };
  }, [sessions, categories, period, effectiveLiveSession, forceUpdate]);

  const formatTotalTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}m ${secs}s`;
  };

  const CustomLegend = () => (
    <div className="flex items-center gap-3 flex-wrap">
      {categories.map((cat) => {
        const isHidden = hiddenCategories.has(cat.id);
        const isLive = effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isRunning;
        const isPaused = effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isPaused;
        
        return (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
              isHidden ? 'opacity-30 hover:opacity-50' : 'opacity-100'
            }`}
          >
            <div 
              className={`w-3 h-3 rounded-full transition-all ${isLive ? 'animate-pulse ring-2 ring-offset-1 ring-offset-[#0a0f1f]' : ''}`}
              style={{ 
                backgroundColor: cat.color,
                ...(isLive && { boxShadow: `0 0 0 2px ${cat.color}` }),
              }}
            />
            <span className={`text-xs text-white ${isHidden ? 'line-through' : ''}`}>{cat.name}</span>
            {isLive && (
              <Zap className="w-3 h-3 text-[#00f6ff] animate-pulse" />
            )}
            {isPaused && (
              <Pause className="w-3 h-3 text-amber-400" />
            )}
          </button>
        );
      })}
    </div>
  );

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
            <CustomLegend />

            <div className="flex items-center gap-3">
              {effectiveLiveSession && (
                <motion.div
                  key={`live-${forceUpdate}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                    effectiveLiveSession.isPaused 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-[#00f6ff]/10 border-[#00f6ff]/30'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    effectiveLiveSession.isRunning 
                      ? 'bg-[#00f6ff] animate-pulse' 
                      : 'bg-amber-400'
                  }`} />
                  <span className={`text-xs font-medium tabular-nums ${
                    effectiveLiveSession.isPaused ? 'text-amber-400' : 'text-[#00f6ff]'
                  }`}>
                    {Math.floor(effectiveLiveSession.elapsedSeconds / 60)}m {effectiveLiveSession.elapsedSeconds % 60}s
                    {effectiveLiveSession.isPaused && <span className="ml-1 text-[10px]">(pausado)</span>}
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setChartType('score'); setSelectedSessionIndex(null); }}
                  className={`p-2 rounded-lg transition-colors ${
                    chartType === 'score' ? 'bg-[#00f6ff]/20 text-[#00f6ff]' : 'bg-white/5 text-white/40'
                  }`}
                >
                  <Target className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {chartType === 'score' ? (
              <div className="flex h-full gap-4">
                <div className="flex-1 flex items-center justify-center relative">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={scoreData.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="85%"
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={isAnimationEnabled}
                          stroke="none"
                        >
                          {scoreData.pieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color}
                              style={{
                                filter: entry.isLive && !entry.isPaused
                                  ? `drop-shadow(0 0 8px ${entry.color})`
                                  : entry.isPaused
                                    ? `drop-shadow(0 0 4px #f59e0b)`
                                    : undefined,
                                cursor: 'pointer',
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload[0]) return null;
                            const data = payload[0].payload;
                            const minutes = Math.floor(data.value);
                            const seconds = Math.round((data.value - minutes) * 60);
                            const percentage = scoreData.totalMinutes > 0 
                              ? Math.round((data.value / scoreData.totalMinutes) * 100) 
                              : 0;
                            return (
                              <div className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl p-3 shadow-xl">
                                <div className="flex items-center gap-2 mb-1">
                                  <div 
                                    className={`w-3 h-3 rounded-full ${data.isLive ? 'animate-pulse' : ''}`}
                                    style={{ backgroundColor: data.color }}
                                  />
                                  <span className="text-white font-medium text-sm">{data.name}</span>
                                  {data.isLive && <Zap className="w-3 h-3 text-[#00f6ff]" />}
                                  {data.isPaused && <Pause className="w-3 h-3 text-amber-400" />}
                                </div>
                                <div className="text-white text-lg font-bold tabular-nums">
                                  {minutes}m {seconds}s
                                </div>
                                <div className="text-white/50 text-xs">
                                  {percentage}% do total
                                </div>
                                <div className="text-white/40 text-xs mt-1">
                                  {data.sessions.length} {data.sessions.length === 1 ? 'sessão' : 'sessões'}
                                </div>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white tabular-nums">
                          {Math.floor(scoreData.totalMinutes)}m
                        </div>
                        <div className="text-xs text-white/50">
                          {scoreData.pieData.length} {scoreData.pieData.length === 1 ? 'categoria' : 'categorias'}
                        </div>
                        {effectiveLiveSession && (
                          <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${
                            effectiveLiveSession.isPaused ? 'text-amber-400' : 'text-[#00f6ff]'
                          }`}>
                            {effectiveLiveSession.isRunning ? (
                              <Zap className="w-3 h-3 animate-pulse" />
                            ) : (
                              <Pause className="w-3 h-3" />
                            )}
                            <span>ao vivo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-48 flex flex-col">
                  <div className="text-xs text-white/50 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Sessões ({scoreData.allSessions.length})</span>
                  </div>
                  
                  {scoreData.allSessions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-white/30">
                      Nenhuma sessão
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden flex flex-col">
                      {selectedSessionIndex !== null && scoreData.allSessions[selectedSessionIndex] ? (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex-1 flex flex-col"
                        >
                          <button
                            onClick={() => setSelectedSessionIndex(null)}
                            className="flex items-center gap-1 text-xs text-[#00f6ff] hover:text-[#00f6ff]/80 mb-2"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            Voltar
                          </button>
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: scoreData.allSessions[selectedSessionIndex].categoryColor }}
                              />
                              <span className="text-sm text-white font-medium">
                                {scoreData.allSessions[selectedSessionIndex].categoryName}
                              </span>
                            </div>
                            <div className="text-xl font-bold text-white tabular-nums">
                              {scoreData.allSessions[selectedSessionIndex].duration}m
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              {format(parseISO(scoreData.allSessions[selectedSessionIndex].completedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                          {scoreData.allSessions.slice(0, 10).map((session, idx) => (
                            <motion.button
                              key={session.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              onClick={() => setSelectedSessionIndex(idx)}
                              className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                            >
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: session.categoryColor }}
                              />
                              <div className="flex-1 text-left min-w-0">
                                <div className="text-xs text-white truncate">{session.categoryName}</div>
                                <div className="text-[10px] text-white/40">
                                  {format(parseISO(session.completedAt), 'HH:mm', { locale: ptBR })}
                                </div>
                              </div>
                              <div className="text-xs text-white/60 font-medium tabular-nums">
                                {session.duration}m
                              </div>
                              <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/40" />
                            </motion.button>
                          ))}
                          {scoreData.allSessions.length > 10 && (
                            <div className="text-xs text-white/30 text-center py-1">
                              +{scoreData.allSessions.length - 10} mais
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
                    {visibleCategories.map((cat) => (
                      <Bar 
                        key={cat.id}
                        dataKey={cat.id}
                        fill={cat.color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                        isAnimationActive={isAnimationEnabled}
                      >
                        {chartData.map((entry, index) => {
                          const isLive = effectiveLiveSession?.categoryId === cat.id && index === chartData.length - 1;
                          const isPaused = effectiveLiveSession?.categoryId === cat.id && effectiveLiveSession?.isPaused && index === chartData.length - 1;
                          return (
                            <Cell 
                              key={`cell-${index}`}
                              fill={cat.color}
                              style={{
                                filter: isLive && !isPaused
                                  ? `drop-shadow(0 0 8px ${cat.color})` 
                                  : isPaused 
                                    ? `drop-shadow(0 0 4px #f59e0b)`
                                    : undefined,
                              }}
                            />
                          );
                        })}
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
                    {visibleCategories.map((cat) => (
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
            )}
        </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-white/40">
              Hoje: <span className="text-[#00f6ff] font-medium tabular-nums">{formatTotalTime(totalTodayMinutes)}</span>
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
