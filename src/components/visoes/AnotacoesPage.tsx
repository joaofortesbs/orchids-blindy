"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, FileText, Folder, Search, Trash2, Clock, StickyNote } from 'lucide-react';
import { Note } from '@/lib/types/visoes';

interface AnotacoesPageProps {
  notes: Note[];
  onAddNote: (title: string, content: string, color: string) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onRemoveNote: (id: string) => void;
  onClose: () => void;
}

const NOTE_COLORS = [
  '#00f6ff',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
];

export function AnotacoesPage({
  notes,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onClose,
}: AnotacoesPageProps) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('#00f6ff');

  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setEditColor(selectedNote.color);
      setIsEditing(true);
    } else {
      setEditTitle('');
      setEditContent('');
      setEditColor('#00f6ff');
      setIsEditing(false);
    }
  }, [selectedNote]);

  const filteredNotes = notes.filter(note => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query);
    }
    return true;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleSaveNote = () => {
    if (!editTitle.trim()) return;

    if (selectedNote) {
      onUpdateNote(selectedNote.id, {
        title: editTitle,
        content: editContent,
        color: editColor,
      });
    } else {
      onAddNote(editTitle, editContent, editColor);
    }

    setSelectedNote(null);
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
  };

  const handleDeleteNote = () => {
    if (selectedNote) {
      onRemoveNote(selectedNote.id);
      setSelectedNote(null);
      setIsEditing(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedNote(null);
    setIsEditing(true);
    setEditTitle('');
    setEditContent('');
    setEditColor('#00f6ff');
  };

  const getTimeAgo = (date: string) => {
    try {
      const diff = Date.now() - new Date(date).getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 1) return 'agora';
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#010516] overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #00f6ff10 0%, transparent 50%)',
        }}
      />

      <div className="relative h-full flex">
        <aside className="w-80 bg-[#0a0f1f] border-r border-[#00f6ff]/10 flex flex-col">
          <div className="p-4 border-b border-[#00f6ff]/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00f6ff]/10 flex items-center justify-center">
                  <StickyNote className="w-5 h-5 text-[#00f6ff]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Anotações</h2>
                  <p className="text-white/40 text-xs">{notes.length} notas</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar notas..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm placeholder:text-white/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {sortedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-16 h-16 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-[#00f6ff]/40" />
                </div>
                <p className="text-white/40 text-sm">Nenhuma nota encontrada</p>
                <p className="text-white/30 text-xs mt-1">Crie sua primeira anotação</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sortedNotes.map((note) => (
                  <motion.button
                    key={note.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedNote(note)}
                    className={`w-full p-3 rounded-xl text-left transition-all group ${
                      selectedNote?.id === note.id
                        ? 'bg-[#00f6ff]/10 border border-[#00f6ff]/20'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-1 h-12 rounded-full flex-shrink-0"
                        style={{ backgroundColor: note.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{note.title}</p>
                        <p className="text-white/40 text-xs line-clamp-2 mt-1">
                          {note.content || 'Sem conteúdo'}
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-white/30">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{getTimeAgo(note.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#00f6ff]/10">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
              style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
            >
              <Plus className="w-4 h-4" />
              Nova Anotação
            </motion.button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="p-6 border-b border-[#00f6ff]/10 flex items-center justify-between">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título da nota..."
                  className="text-2xl font-bold text-white bg-transparent border-none outline-none placeholder:text-white/30"
                  autoFocus
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">
                  {selectedNote ? selectedNote.title : 'Selecione uma nota'}
                </h1>
              )}
              {selectedNote && (
                <p className="text-white/40 text-sm mt-1">
                  Última edição: {getTimeAgo(selectedNote.updatedAt)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isEditing && (
                <>
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
                    {NOTE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          editColor === color ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {selectedNote && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDeleteNote}
                      className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveNote}
                    className="px-4 py-2 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
                    style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
                  >
                    Salvar
                  </motion.button>
                </>
              )}

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6 text-white/60" />
              </motion.button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {isEditing ? (
              <div className="h-full">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Comece a escrever sua nota..."
                  className="w-full h-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/30 outline-none text-white text-sm resize-none leading-relaxed placeholder:text-white/30"
                />
              </div>
            ) : !selectedNote ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-6">
                  <FileText className="w-12 h-12 text-[#00f6ff]/40" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Nenhuma nota selecionada</h2>
                <p className="text-white/50 max-w-md mb-6">
                  Selecione uma nota na lista ou crie uma nova para começar.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
                  style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
                >
                  <Plus className="w-5 h-5" />
                  Criar Nova Nota
                </motion.button>
              </div>
            ) : (
              <div 
                className="p-6 rounded-xl bg-white/5 border-l-4 min-h-[200px]"
                style={{ borderColor: selectedNote.color }}
              >
                <p className="text-white/80 whitespace-pre-wrap leading-relaxed">
                  {selectedNote.content || 'Sem conteúdo'}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </motion.div>
  );
}
