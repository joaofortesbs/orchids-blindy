"use client";

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Image as ImageIcon, Sparkles } from 'lucide-react';
import { VisionBoard } from '@/lib/types/visoes';

interface LeiDaAtracaoCardProps {
  images: VisionBoard[];
  onAddImage: (imageUrl: string) => void;
  onRemoveImage: (id: string) => void;
  onReset: () => void;
  onOpenFullscreen: () => void;
}

export function LeiDaAtracaoCard({
  images,
  onAddImage,
  onRemoveImage,
  onReset,
  onOpenFullscreen,
}: LeiDaAtracaoCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onAddImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const featuredImage = images[0];

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
        {featuredImage ? (
          <div className="absolute inset-0">
            <img
              src={featuredImage.imageUrl}
              alt="Vision Board"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1f] via-transparent to-transparent" />
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

interface VisionBoardFullscreenProps {
  images: VisionBoard[];
  onAddImage: (imageUrl: string) => void;
  onRemoveImage: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export function VisionBoardFullscreen({
  images,
  onAddImage,
  onRemoveImage,
  onReset,
  onClose,
}: VisionBoardFullscreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onAddImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
              <ImageIcon className="w-12 h-12 text-[#00f6ff]/40" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Seu Vision Board está vazio</h2>
            <p className="text-white/50 text-center max-w-md mb-6">
              Adicione imagens que representem seus sonhos, objetivos e a vida que você deseja manifestar.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-semibold"
              style={{ boxShadow: '0 0 30px rgba(0, 246, 255, 0.3)' }}
            >
              <Plus className="w-5 h-5" />
              Adicionar Primeira Imagem
            </motion.button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {images.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden group border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
                >
                  <img
                    src={image.imageUrl}
                    alt={`Vision ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <motion.button
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    onClick={() => onRemoveImage(image.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/80 hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold"
                style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
              >
                <Plus className="w-4 h-4" />
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
          className="hidden"
        />
      </div>
    </motion.div>
  );
}
