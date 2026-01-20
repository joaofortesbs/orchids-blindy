"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { MainGoal } from '@/lib/types/visoes';

interface MetasCardProps {
  mainGoal: MainGoal | null;
  onSetGoal: (text: string, year: number) => void;
  onOpenMetas: () => void;
}

export function MetasCard({ mainGoal, onSetGoal, onOpenMetas }: MetasCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [goalText, setGoalText] = useState(mainGoal?.text || '');

  useEffect(() => {
    if (mainGoal?.text) {
      setGoalText(mainGoal.text);
    }
  }, [mainGoal?.text]);

  const handleSave = () => {
    if (goalText.trim()) {
      onSetGoal(goalText.trim(), new Date().getFullYear());
      setIsEditing(false);
    } else {
      setIsEditing(false);
    }
  };

  const handleStartEditing = () => {
    setGoalText(mainGoal?.text || '');
    setIsEditing(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full flex flex-col overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 100% 0%, #00f6ff20 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <motion.div
          className="px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2"
          style={{ 
            borderColor: '#00f6ff',
            color: '#00f6ff',
          }}
        >
          <Target className="w-3 h-3" />
          METAS
        </motion.div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4">
        {isEditing ? (
          <div className="w-full">
            <textarea
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setGoalText(mainGoal?.text || '');
                }
              }}
              placeholder="Escreva seu objetivo principal..."
              className="w-full text-center text-xl font-medium text-white bg-transparent border-b-2 border-[#00f6ff]/50 focus:border-[#00f6ff] outline-none resize-none italic py-2"
              rows={3}
              autoFocus
            />
            <p className="text-white/30 text-xs mt-2">Pressione Enter para salvar ou Esc para cancelar</p>
          </div>
        ) : (
          <div 
            className="flex items-start gap-2 cursor-pointer group w-full"
            onClick={handleStartEditing}
          >
            <span className="text-[#00f6ff] text-5xl font-serif leading-none flex-shrink-0">"</span>
            
            <div className="flex-1 flex items-center justify-center min-h-[80px]">
              {mainGoal?.text ? (
                <p className="text-xl font-medium text-white italic group-hover:text-white/80 transition-colors">
                  {mainGoal.text}
                </p>
              ) : (
                <div className="text-center">
                  <p className="text-white/40 text-lg italic mb-1">Defina seu objetivo principal</p>
                  <span className="text-[#00f6ff] text-sm hover:underline">Clique para adicionar</span>
                </div>
              )}
            </div>
            
            <span className="text-[#00f6ff] text-5xl font-serif leading-none flex-shrink-0">"</span>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-end mt-4">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenMetas}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Acessar
        </motion.button>
      </div>
    </motion.div>
  );
}
