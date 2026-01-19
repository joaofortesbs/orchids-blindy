"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Plus, Check } from 'lucide-react';
import { Reminder } from '@/lib/types/visoes';

interface LembretesCardProps {
  reminders: Reminder[];
  onAddReminder: (text: string, dueDate: string | null) => void;
  onToggleReminder: (id: string) => void;
  onRemoveReminder: (id: string) => void;
}

export function LembretesCard({
  reminders,
  onAddReminder,
  onToggleReminder,
  onRemoveReminder,
}: LembretesCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState('');

  const handleAdd = () => {
    if (newText.trim()) {
      onAddReminder(newText.trim(), null);
      setNewText('');
      setShowAddModal(false);
    }
  };

  const pendingReminders = reminders.filter(r => !r.completed);
  const hasReminders = pendingReminders.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full flex flex-col overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 0% 0%, #00f6ff20 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mb-4">
        <motion.span 
          className="px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-2"
          style={{ 
            borderColor: '#00f6ff',
            color: '#00f6ff',
          }}
        >
          <Bell className="w-3 h-3" />
          LEMBRETES
        </motion.span>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center">
        {hasReminders ? (
          <div className="w-full space-y-2 text-left">
            {pendingReminders.slice(0, 4).map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#010516]/50 border border-white/5 hover:border-[#00f6ff]/20 group transition-colors"
              >
                <button
                  onClick={() => onToggleReminder(reminder.id)}
                  className="w-5 h-5 rounded border border-[#00f6ff]/30 hover:border-[#00f6ff] hover:bg-[#00f6ff]/10 transition-colors flex-shrink-0 flex items-center justify-center"
                >
                  {reminder.completed && <Check className="w-3 h-3 text-[#00f6ff]" />}
                </button>
                <span className="flex-1 text-sm text-white/80 truncate">{reminder.text}</span>
                <button
                  onClick={() => onRemoveReminder(reminder.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                >
                  <X className="w-3 h-3 text-white/40" />
                </button>
              </div>
            ))}
            {pendingReminders.length > 4 && (
              <p className="text-center text-[#00f6ff]/60 text-xs pt-2">
                +{pendingReminders.length - 4} lembretes
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-[#00f6ff]/40" />
            </div>
            <p className="text-white/40 text-sm max-w-[240px] leading-relaxed">
              Organize suas ideias criando lembretes rápidos e fáceis de visualizar.
            </p>
          </>
        )}
      </div>

      <div className="relative z-10 flex justify-center mt-4">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Criar Lembrete
        </motion.button>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Novo Lembrete</h2>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
              
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="O que você precisa lembrar?"
                className="w-full px-4 py-3 rounded-xl bg-[#010516]/50 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm mb-4"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAdd}
                className="w-full py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
                style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
              >
                Adicionar Lembrete
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
