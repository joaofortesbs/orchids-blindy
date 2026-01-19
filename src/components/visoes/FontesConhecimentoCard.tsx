"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, BookOpen, GraduationCap } from 'lucide-react';
import { Book } from '@/lib/types/visoes';

interface FontesConhecimentoCardProps {
  books: Book[];
  onAddBook: (book: Omit<Book, 'id'>) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onRemoveBook: (id: string) => void;
  onOpenOrganizar: () => void;
}

const BOOK_TYPES = [
  { value: 'book', label: 'Livros', icon: BookOpen },
  { value: 'podcast', label: 'Podcasts', icon: BookOpen },
  { value: 'video', label: 'Vídeos', icon: BookOpen },
  { value: 'course', label: 'Cursos', icon: GraduationCap },
];

export function FontesConhecimentoCard({
  books,
  onAddBook,
  onUpdateProgress,
  onRemoveBook,
  onOpenOrganizar,
}: FontesConhecimentoCardProps) {
  const [selectedType, setSelectedType] = useState<string>('book');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredBooks = books.filter(b => b.type === selectedType);
  const displayBooks = filteredBooks.slice(0, 3);

  const selectedTypeLabel = BOOK_TYPES.find(t => t.value === selectedType)?.label || 'Livros';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-5 h-full flex flex-col overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 0% 100%, #00f6ff20 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between mb-4">
        <motion.span 
          className="px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase flex items-center gap-2"
          style={{ 
            borderColor: '#00f6ff',
            color: '#00f6ff',
          }}
        >
          <GraduationCap className="w-3 h-3" />
          FONTES DE CONHECIMENTO
        </motion.span>
        
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs hover:border-[#00f6ff]/30 transition-colors"
          >
            {selectedTypeLabel}
            <ChevronDown className="w-3 h-3 text-white/60" />
          </button>
          
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-1 w-32 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-lg overflow-hidden z-10"
              >
                {BOOK_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => {
                      setSelectedType(type.value);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors ${
                      selectedType === type.value ? 'text-[#00f6ff]' : 'text-white/60'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex gap-3">
        {displayBooks.length > 0 ? (
          displayBooks.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex-1 relative rounded-xl overflow-hidden bg-[#010516]/50 border border-white/5 hover:border-[#00f6ff]/20 transition-colors group"
            >
              <div className="aspect-[3/4] relative">
                {book.coverUrl ? (
                  <img 
                    src={book.coverUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0f1f] to-[#010516]">
                    <BookOpen className="w-8 h-8 text-[#00f6ff]/20" />
                  </div>
                )}
                
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
                  <BookOpen className="w-3 h-3 text-[#00f6ff]" />
                  <span className="text-[#00f6ff] text-[10px] font-medium">
                    {BOOK_TYPES.find(t => t.value === book.type)?.label || 'Livro'}
                  </span>
                </div>
              </div>
              
              <div className="p-2">
                <p className="text-white text-xs font-bold truncate leading-tight">{book.title}</p>
                <p className="text-white/50 text-[10px] truncate">{book.author}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#00f6ff] rounded-full transition-all"
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                  <span className="text-[#00f6ff]/60 text-[10px]">{book.progress}%</span>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-3">
              <BookOpen className="w-8 h-8 text-[#00f6ff]/40" />
            </div>
            <p className="text-white/40 text-sm">Nenhum {selectedTypeLabel.toLowerCase()}</p>
            <p className="text-white/30 text-xs">adicionado ainda</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-end mt-4">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenOrganizar}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Organizar
        </motion.button>
      </div>
    </motion.div>
  );
}
