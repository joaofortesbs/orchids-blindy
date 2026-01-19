"use client";

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, BookOpen, Headphones, Video, GraduationCap, Search, Filter, ChevronDown, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { Book } from '@/lib/types/visoes';

interface FontesConhecimentoPageProps {
  books: Book[];
  onAddBook: (book: Omit<Book, 'id'>) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onRemoveBook: (id: string) => void;
  onClose: () => void;
}

const BOOK_TYPES = [
  { value: 'all', label: 'Todos', icon: Filter },
  { value: 'book', label: 'Livros', icon: BookOpen },
  { value: 'podcast', label: 'Podcasts', icon: Headphones },
  { value: 'video', label: 'Vídeos', icon: Video },
  { value: 'course', label: 'Cursos', icon: GraduationCap },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'reading', label: 'Em progresso' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'not_started', label: 'Não iniciados' },
];

export function FontesConhecimentoPage({
  books,
  onAddBook,
  onUpdateProgress,
  onRemoveBook,
  onClose,
}: FontesConhecimentoPageProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const filteredBooks = books.filter(book => {
    if (selectedType !== 'all' && book.type !== selectedType) return false;
    
    if (selectedStatus === 'reading' && (book.progress === 0 || book.progress === 100)) return false;
    if (selectedStatus === 'completed' && book.progress !== 100) return false;
    if (selectedStatus === 'not_started' && book.progress !== 0) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
    }
    
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen className="w-4 h-4" />;
      case 'podcast': return <Headphones className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'course': return <GraduationCap className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    return BOOK_TYPES.find(t => t.value === type)?.label || 'Livro';
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
        <aside className="w-64 bg-[#0a0f1f] border-r border-[#00f6ff]/10 flex flex-col">
          <div className="p-4 border-b border-[#00f6ff]/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00f6ff]/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#00f6ff]" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Fontes</h2>
                <p className="text-white/40 text-xs">de Conhecimento</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm placeholder:text-white/30"
              />
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {BOOK_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  selectedType === type.value
                    ? 'bg-[#00f6ff]/10 text-[#00f6ff] border border-[#00f6ff]/20'
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <type.icon className="w-4 h-4" />
                <span className="text-sm">{type.label}</span>
                <span className="ml-auto text-xs text-white/30">
                  {type.value === 'all' 
                    ? books.length 
                    : books.filter(b => b.type === type.value).length}
                </span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-[#00f6ff]/10">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
              style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </motion.button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="p-6 border-b border-[#00f6ff]/10 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {selectedType === 'all' ? 'Todas as Fontes' : getTypeLabel(selectedType)}
              </h1>
              <p className="text-white/40 text-sm">
                {filteredBooks.length} {filteredBooks.length === 1 ? 'item' : 'itens'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm hover:border-[#00f6ff]/30 transition-colors"
                >
                  <Filter className="w-4 h-4 text-white/60" />
                  {STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}
                  <ChevronDown className="w-4 h-4 text-white/40" />
                </button>

                <AnimatePresence>
                  {showTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-xl overflow-hidden z-10"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status.value}
                          onClick={() => {
                            setSelectedStatus(status.value);
                            setShowTypeDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors ${
                            selectedStatus === status.value ? 'text-[#00f6ff]' : 'text-white/60'
                          }`}
                        >
                          {status.label}
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
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {filteredBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-6">
                  <BookOpen className="w-12 h-12 text-[#00f6ff]/40" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Nenhuma fonte encontrada</h2>
                <p className="text-white/50 max-w-md mb-6">
                  {searchQuery 
                    ? 'Tente uma busca diferente ou adicione uma nova fonte de conhecimento.'
                    : 'Comece adicionando livros, podcasts, vídeos ou cursos para organizar seu aprendizado.'}
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
                  style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Primeira Fonte
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredBooks.map((book, index) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative bg-[#0a0f1f] rounded-xl border border-white/5 overflow-hidden hover:border-[#00f6ff]/20 transition-all"
                  >
                    <div className="aspect-[3/4] relative bg-gradient-to-b from-[#0a0f1f] to-[#010516]">
                      {book.coverUrl ? (
                        <img 
                          src={book.coverUrl} 
                          alt={book.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {getTypeIcon(book.type)}
                        </div>
                      )}

                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[#00f6ff] text-[10px] font-medium flex items-center gap-1">
                          {getTypeIcon(book.type)}
                          {getTypeLabel(book.type)}
                        </span>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0a0f1f] to-transparent" />

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setEditingBook(book)}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-white" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onRemoveBook(book.id)}
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="text-white font-medium text-sm truncate">{book.title}</p>
                      <p className="text-white/40 text-xs truncate">{book.author}</p>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/40">Progresso</span>
                          <span className="text-[#00f6ff]">{book.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${book.progress}%` }}
                            className="h-full bg-[#00f6ff] rounded-full"
                            style={{ boxShadow: '0 0 8px rgba(0, 246, 255, 0.5)' }}
                          />
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={book.progress}
                          onChange={(e) => onUpdateProgress(book.id, parseInt(e.target.value))}
                          className="w-full mt-2 accent-[#00f6ff] cursor-pointer"
                          style={{ height: '4px' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {(showAddModal || editingBook) && (
          <AddBookModal
            book={editingBook}
            onAdd={(book) => {
              onAddBook(book);
              setShowAddModal(false);
              setEditingBook(null);
            }}
            onClose={() => {
              setShowAddModal(false);
              setEditingBook(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddBookModal({
  book,
  onAdd,
  onClose,
}: {
  book?: Book | null;
  onAdd: (book: Omit<Book, 'id'>) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<'book' | 'podcast' | 'video' | 'course'>(book?.type || 'book');
  const [title, setTitle] = useState(book?.title || '');
  const [author, setAuthor] = useState(book?.author || '');
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl || '');
  const [progress, setProgress] = useState(book?.progress || 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (title && author) {
      onAdd({
        type,
        title,
        author,
        coverUrl,
        progress,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {book ? 'Editar' : 'Adicionar'} Fonte
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-2 block">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {(['book', 'podcast', 'video', 'course'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                    type === t
                      ? 'border-[#00f6ff] bg-[#00f6ff]/10 text-[#00f6ff]'
                      : 'border-white/10 text-white/60 hover:border-white/20'
                  }`}
                >
                  {t === 'book' && <BookOpen className="w-5 h-5" />}
                  {t === 'podcast' && <Headphones className="w-5 h-5" />}
                  {t === 'video' && <Video className="w-5 h-5" />}
                  {t === 'course' && <GraduationCap className="w-5 h-5" />}
                  <span className="text-xs">
                    {t === 'book' && 'Livro'}
                    {t === 'podcast' && 'Podcast'}
                    {t === 'video' && 'Vídeo'}
                    {t === 'course' && 'Curso'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome do conteúdo"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Autor/Criador</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nome do autor ou criador"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Capa (opcional)</label>
            <div className="flex gap-3">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-32 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-[#00f6ff]/50 transition-colors overflow-hidden"
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-white/30" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="URL da imagem"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm mb-2"
                />
                <p className="text-white/30 text-xs">Ou clique na imagem para fazer upload</p>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Progresso: {progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full accent-[#00f6ff]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#00f6ff]/30 text-[#00f6ff] font-medium hover:bg-[#00f6ff]/10 transition-colors"
            >
              Cancelar
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
              style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
            >
              {book ? 'Salvar' : 'Adicionar'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
