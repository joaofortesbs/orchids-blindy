"use client";

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { GoalCategory, GoalAction, MainGoal } from '@/lib/types/visoes';

interface MetasPageProps {
  mainGoal: MainGoal | null;
  goalActions: GoalAction[];
  goalCategories: GoalCategory[];
  selectedYear: number;
  onSetMainGoal: (text: string, year: number) => void;
  onAddGoalAction: (text: string) => void;
  onToggleGoalAction: (id: string) => void;
  onRemoveGoalAction: (id: string) => void;
  onAddGoalToCategory: (categoryId: string, text: string) => void;
  onToggleGoalInCategory: (categoryId: string, goalId: string) => void;
  onRemoveGoalFromCategory: (categoryId: string, goalId: string) => void;
  onSetSelectedYear: (year: number) => void;
  onClose: () => void;
}

export function MetasPage({
  mainGoal,
  goalActions,
  goalCategories,
  selectedYear,
  onSetMainGoal,
  onAddGoalAction,
  onToggleGoalAction,
  onRemoveGoalAction,
  onAddGoalToCategory,
  onToggleGoalInCategory,
  onRemoveGoalFromCategory,
  onSetSelectedYear,
  onClose,
}: MetasPageProps) {
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [editingMainGoal, setEditingMainGoal] = useState(false);
  const [mainGoalText, setMainGoalText] = useState(mainGoal?.text || '');
  const [newActionText, setNewActionText] = useState('');
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newGoalText, setNewGoalText] = useState('');

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i);

  const dayOfYear = useMemo(() => {
    const now = new Date();
    const start = new Date(selectedYear, 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }, [selectedYear]);

  const totalDays = selectedYear % 4 === 0 ? 366 : 365;
  const progressPercent = Math.min((dayOfYear / totalDays) * 100, 100);

  const handleSaveMainGoal = () => {
    if (mainGoalText.trim()) {
      onSetMainGoal(mainGoalText.trim(), selectedYear);
      setEditingMainGoal(false);
    }
  };

  const handleAddAction = () => {
    if (newActionText.trim()) {
      onAddGoalAction(newActionText.trim());
      setNewActionText('');
    }
  };

  const handleAddGoal = (categoryId: string) => {
    if (newGoalText.trim()) {
      onAddGoalToCategory(categoryId, newGoalText.trim());
      setNewGoalText('');
      setAddingToCategory(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#010516] overflow-y-auto"
    >
      <div className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="relative">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              <span className="text-xl font-bold">{selectedYear}</span>
              <ChevronDown className="w-5 h-5 text-white/60" />
            </button>
            
            <AnimatePresence>
              {showYearDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 w-32 bg-[#0a0f1f] border border-white/10 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto"
                >
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        onSetSelectedYear(year);
                        setShowYearDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-white/5 transition-colors ${
                        year === selectedYear ? 'text-[#00f6ff]' : 'text-white/60'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-white/60" />
          </motion.button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-4 text-sm text-white/60 mb-2">
            <span>1 Janeiro</span>
            <div className="flex-1 relative h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-[#00f6ff] rounded-full"
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#00f6ff] rounded-full border-2 border-white"
                style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%)` }}
              />
            </div>
            <span>30 Junho</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full" />
            <span>31 Dezembro</span>
          </div>
          <p className="text-[#00f6ff] text-sm">Hoje</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full border border-[#00f6ff] text-xs font-medium text-[#00f6ff]">
                Objetivo Principal
              </span>
              <button
                onClick={() => setEditingMainGoal(true)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4 text-white/40" />
              </button>
            </div>
            
            {editingMainGoal ? (
              <div className="space-y-3">
                <textarea
                  value={mainGoalText}
                  onChange={(e) => setMainGoalText(e.target.value)}
                  placeholder="Qual é seu objetivo principal para este ano?"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMainGoal}
                    className="px-4 py-2 rounded-xl bg-[#00f6ff] text-white text-sm font-medium"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingMainGoal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xl text-white">
                "{mainGoal?.text || 'Defina seu objetivo principal'}"
              </p>
            )}
          </div>

          <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full border border-[#00f6ff] text-xs font-medium text-[#00f6ff]">
                O que preciso fazer?
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              {goalActions.map((action) => (
                <div key={action.id} className="flex items-center gap-3 group">
                  <button
                    onClick={() => onToggleGoalAction(action.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      action.completed 
                        ? 'bg-[#00f6ff] border-[#00f6ff]' 
                        : 'border-white/20 hover:border-[#00f6ff]'
                    }`}
                  >
                    {action.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${action.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>
                    {action.text}
                  </span>
                  <button
                    onClick={() => onRemoveGoalAction(action.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                  >
                    <X className="w-3 h-3 text-white/40" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                placeholder="Escreva algo.."
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
              <input
                type="text"
                placeholder="Escreva algo.."
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalCategories.map((category) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="text-white font-medium text-sm">{category.name}</span>
                </div>
                <button
                  onClick={() => setAddingToCategory(category.id)}
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors text-[#00f6ff]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {category.goals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => onToggleGoalInCategory(category.id, goal.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        goal.completed
                          ? 'bg-[#22c55e] border-[#22c55e]'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {goal.completed && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${goal.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>
                      {goal.text}
                    </span>
                    <button
                      onClick={() => onRemoveGoalFromCategory(category.id, goal.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-[#00f6ff]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {addingToCategory === category.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGoalText}
                      onChange={(e) => setNewGoalText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddGoal(category.id);
                        if (e.key === 'Escape') setAddingToCategory(null);
                      }}
                      placeholder="Nova meta..."
                      className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
                      autoFocus
                    />
                  </div>
                ) : category.goals.length === 0 ? (
                  <button
                    onClick={() => setAddingToCategory(category.id)}
                    className="w-full py-2 rounded-xl border border-dashed border-[#00f6ff]/30 text-[#00f6ff] text-sm hover:bg-[#00f6ff]/5 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar meta
                  </button>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
