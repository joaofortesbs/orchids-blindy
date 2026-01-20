"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode activated');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    } catch {
      setError('Erro ao atualizar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#010516] flex items-center justify-center p-4 relative overflow-hidden">
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #00f6ff08 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #7c3aed08 0%, transparent 40%)',
        }}
      />
      
      <div className="absolute inset-0 bg-grid opacity-30" />
      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f6ff]/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#7c3aed]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-[#0a0f1f]/90 backdrop-blur-xl rounded-3xl border border-[#00f6ff]/20 shadow-2xl shadow-[#00f6ff]/5 overflow-hidden">
          <div className="relative p-8 pb-6 border-b border-white/5">
            <div 
              className="absolute inset-0 opacity-50"
              style={{
                background: 'linear-gradient(135deg, #00f6ff10 0%, transparent 60%)',
              }}
            />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="relative flex justify-center mb-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] p-[2px]">
                <div className="w-full h-full rounded-2xl bg-[#0a0f1f] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#00f6ff]" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative text-center"
            >
              <h1 className="text-2xl font-bold text-white mb-1">
                {success ? 'Senha atualizada!' : 'Nova senha'}
              </h1>
              <p className="text-white/50 text-sm">
                {success ? 'Redirecionando para o login...' : 'Digite sua nova senha'}
              </p>
            </motion.div>
          </div>

          {success ? (
            <div className="p-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-white/70 text-center">Sua senha foi atualizada com sucesso!</p>
              </motion.div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-white/60 font-medium">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 focus:bg-white/10 outline-none text-white placeholder:text-white/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-white/40">Mínimo de 6 caracteres</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60 font-medium">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 focus:bg-white/10 outline-none text-white placeholder:text-white/30 transition-all"
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className="relative w-full py-4 rounded-xl font-semibold text-[#010516] overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed group"
                style={{
                  background: 'linear-gradient(135deg, #00f6ff 0%, #00d4ff 50%, #7c3aed 100%)',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[#010516]/30 border-t-[#010516] rounded-full animate-spin" />
                      Aguarde...
                    </>
                  ) : (
                    'Atualizar senha'
                  )}
                </span>
                
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff 0%, #00f6ff 50%, #a855f7 100%)',
                  }}
                />
              </motion.button>
            </form>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-white/30 text-xs mt-6"
        >
          Seus dados estão protegidos e seguros
        </motion.p>
      </motion.div>
    </div>
  );
}
