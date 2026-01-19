"use client";

import { motion } from 'framer-motion';
import { FileText, StickyNote } from 'lucide-react';
import { Note } from '@/lib/types/visoes';

interface AnotacoesCardProps {
  notes: Note[];
  onAddNote: (title: string, content: string, color: string) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onRemoveNote: (id: string) => void;
  onOpenNotes: () => void;
}

export function AnotacoesCard({
  notes,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onOpenNotes,
}: AnotacoesCardProps) {
  const displayNotes = notes.slice(0, 3);
  const hasNotes = notes.length > 0;

  const getTimeAgo = (date: string) => {
    try {
      const diff = Date.now() - new Date(date).getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 60) return `há ${minutes} min`;
      if (hours < 24) return `há ${hours}h`;
      if (days < 30) return `há ${days} dias`;
      if (days < 365) return `há ${Math.floor(days / 30)} meses`;
      return `há ${Math.floor(days / 365)} ano(s)`;
    } catch {
      return 'recente';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full flex flex-col overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, #00f6ff20 0%, transparent 70%)',
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
          <StickyNote className="w-3 h-3" />
          ANOTAÇÕES
        </motion.span>
      </div>

      <div className="relative z-10 flex-1">
        {hasNotes ? (
          <div className="space-y-3">
            {displayNotes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 cursor-pointer group"
                onClick={onOpenNotes}
              >
                <div className="w-10 h-10 rounded-lg bg-[#00f6ff]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#00f6ff]/20 transition-colors">
                  <FileText className="w-5 h-5 text-[#00f6ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate group-hover:text-[#00f6ff] transition-colors">{note.title}</p>
                  <p className="text-white/40 text-xs">{getTimeAgo(note.updatedAt)}</p>
                </div>
                <div className="w-1 h-10 rounded-full bg-[#00f6ff]" />
              </motion.div>
            ))}
            {notes.length > 3 && (
              <p className="text-center text-[#00f6ff]/60 text-xs pt-1">
                +{notes.length - 3} notas
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-3">
              <StickyNote className="w-8 h-8 text-[#00f6ff]/40" />
            </div>
            <p className="text-white/40 text-sm">Nenhuma anotação</p>
            <p className="text-white/30 text-xs">criada ainda</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-end mt-4">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenNotes}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Minhas Notas
        </motion.button>
      </div>
    </motion.div>
  );
}
