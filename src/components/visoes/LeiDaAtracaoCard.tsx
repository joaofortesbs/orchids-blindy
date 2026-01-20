"use client";

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Image as ImageIcon, Sparkles, Loader2, GripVertical } from 'lucide-react';
import { VisionBoard } from '@/lib/types/visoes';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LeiDaAtracaoCardProps {
  images: VisionBoard[];
  onAddImage: (imageUrl: string) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages?: (images: VisionBoard[]) => void;
  onReset: () => void;
  onOpenFullscreen: () => void;
}

export function LeiDaAtracaoCard({
  images,
  onAddImage,
  onRemoveImage,
  onReorderImages,
  onReset,
  onOpenFullscreen,
}: LeiDaAtracaoCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) {
      setCurrentIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    if (currentIndex >= images.length && images.length > 0) {
      setCurrentIndex(0);
    }
  }, [images.length, currentIndex]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        onAddImage(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentImage = images[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 overflow-hidden h-full flex flex-col"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #00f6ff20 0%, transparent 70%)',
        }}
      />

      <div className="relative flex-1 min-h-[280px]">
        {currentImage ? (
          <div className="absolute inset-0 group">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImage.id}
                src={currentImage.imageUrl}
                alt="Vision Board"
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1f] via-transparent to-transparent" />
            
            <motion.button
              initial={{ opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              onClick={(e) => { e.stopPropagation(); onRemoveImage(currentImage.id); }}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-20"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {images.length > 1 && (
              <>
                <div className="absolute bottom-16 left-3 right-3 flex gap-1 overflow-hidden">
                  {images.slice(0, 5).map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden border transition-all ${
                        idx === currentIndex ? 'border-[#00f6ff] ring-1 ring-[#00f6ff]' : 'border-white/20'
                      }`}
                    >
                      <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {images.length > 5 && (
                    <div className="w-12 h-12 rounded-lg bg-black/50 flex items-center justify-center border border-white/20">
                      <span className="text-white/80 text-xs font-medium">+{images.length - 5}</span>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentIndex ? 'bg-[#00f6ff] w-4' : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-10 h-10 text-[#00f6ff]/40" />
              </div>
              <p className="text-white/40 text-sm">Adicione imagens para manifestar</p>
              <p className="text-white/30 text-xs mt-1">seus sonhos e objetivos</p>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 z-10">
          <motion.span 
            className="px-4 py-2 rounded-full border text-xs font-semibold tracking-wider uppercase flex items-center gap-2"
            style={{ 
              borderColor: '#00f6ff',
              color: '#00f6ff',
              backgroundColor: 'rgba(0, 246, 255, 0.1)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            LEI DA ATRAÇÃO
          </motion.span>
        </div>
      </div>

      <div className="relative z-10 p-4 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenFullscreen}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Manifestar Futuro
        </motion.button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
    </motion.div>
  );
}

function SortableImage({
  image,
  index,
  onRemove,
}: {
  image: VisionBoard;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative aspect-[4/3] rounded-xl overflow-hidden group border transition-all ${
        isDragging ? 'border-[#00f6ff] shadow-xl shadow-[#00f6ff]/20' : 'border-white/10 hover:border-[#00f6ff]/30'
      }`}
    >
      <img
        src={image.imageUrl}
        alt={`Vision ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
      
      <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-sm border border-white/30 flex items-center justify-center z-10">
        <span className="text-white text-xs font-bold">{index + 1}</span>
      </div>
      
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-1/2 -translate-x-1/2 p-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/60 hover:text-white cursor-grab active:cursor-grabbing transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <motion.button
        whileHover={{ scale: 1.1 }}
        onClick={(e) => { e.stopPropagation(); onRemove(image.id); }}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white/80 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <X className="w-4 h-4" />
      </motion.button>

      {image.id.startsWith('temp-') && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00f6ff] animate-spin" />
        </div>
      )}
    </div>
  );
}

interface VisionBoardFullscreenProps {
  images: VisionBoard[];
  onAddImage: (imageUrl: string) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages?: (images: VisionBoard[]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function VisionBoardFullscreen({
  images,
  onAddImage,
  onRemoveImage,
  onReorderImages,
  onReset,
  onClose,
}: VisionBoardFullscreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            onAddImage(reader.result as string);
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(images, oldIndex, newIndex);
        if (onReorderImages) {
          onReorderImages(newOrder);
        }
      }
    }
  }, [images, onReorderImages]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#010516] overflow-y-auto"
    >
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #00f6ff20 0%, transparent 50%)',
        }}
      />

      <div className="relative min-h-screen p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#00f6ff]" />
            <h1 className="text-2xl font-bold text-white">Vision Board</h1>
            <span className="text-white/40 text-sm ml-2">({images.length} {images.length === 1 ? 'imagem' : 'imagens'})</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
          >
            <X className="w-6 h-6 text-white/60" />
          </motion.button>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="w-24 h-24 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-6">
              {isUploading ? (
                <Loader2 className="w-12 h-12 text-[#00f6ff] animate-spin" />
              ) : (
                <ImageIcon className="w-12 h-12 text-[#00f6ff]/40" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Seu Vision Board está vazio</h2>
            <p className="text-white/50 text-center max-w-md mb-6">
              Adicione imagens que representem seus sonhos, objetivos e a vida que você deseja manifestar.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold disabled:opacity-50"
              style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              Adicionar Primeira Imagem
            </motion.button>
          </div>
        ) : (
          <>
            <p className="text-white/40 text-sm mb-4">Arraste pelo ícone no topo das imagens para reorganizar a ordem</p>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={images.map(img => img.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {images.map((image, index) => (
                    <SortableImage
                      key={image.id}
                      image={image}
                      index={index}
                      onRemove={onRemoveImage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold disabled:opacity-50"
                style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Adicionar Imagem
              </motion.button>

              {images.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:border-red-500/30 hover:text-red-400 transition-colors"
                >
                  Limpar Tudo
                </motion.button>
              )}
            </div>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
      </div>
    </motion.div>
  );
}
