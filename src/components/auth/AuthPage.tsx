"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Sparkles, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('E-mail ou senha incorretos');
          } else {
            setError(error.message);
          }
        } else {
          onAuthSuccess();
        }
      } else {
        if (!fullName.trim()) {
          setError('Por favor, insira seu nome completo');
          setIsLoading(false);
          return;
        }
        if (!nickname.trim()) {
          setError('Por favor, insira um apelido');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName, nickname);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Este e-mail já está cadastrado');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess('Conta criada com sucesso! Você já pode fazer login.');
          setTimeout(() => {
            setIsLogin(true);
            setSuccess(null);
          }, 2000);
        }
      }
    } catch {
      setError('Ocorreu um erro. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccess(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setNickname('');
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
                {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h1>
              <p className="text-white/50 text-sm">
                {isLogin ? 'Entre para continuar sua jornada' : 'Comece sua jornada de produtividade'}
              </p>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 text-sm">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 font-medium">Nome completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Seu nome completo"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 focus:bg-white/10 outline-none text-white placeholder:text-white/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/60 font-medium">Apelido</label>
                    <div className="relative">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Como quer ser chamado?"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 focus:bg-white/10 outline-none text-white placeholder:text-white/30 transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm text-white/60 font-medium">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 focus:bg-white/10 outline-none text-white placeholder:text-white/30 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60 font-medium">Senha</label>
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
              {!isLogin && (
                <p className="text-xs text-white/40 mt-1">Mínimo de 6 caracteres</p>
              )}
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
                  isLogin ? 'Entrar' : 'Criar conta'
                )}
              </span>
              
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff 0%, #00f6ff 50%, #a855f7 100%)',
                }}
              />
            </motion.button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0a0f1f] text-white/40">ou</span>
              </div>
            </div>

            <p className="text-center text-white/50 text-sm">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button
                type="button"
                onClick={switchMode}
                className="ml-2 text-[#00f6ff] hover:text-[#00d4ff] font-medium transition-colors"
              >
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </form>
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
