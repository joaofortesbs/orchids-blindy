"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Building2, Users, Lock, Globe, Loader2 } from 'lucide-react';
import { CreateOrganizationData, OrganizationInvite, BUSINESS_MODELS } from '@/lib/types/organization';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateOrganizationData) => Promise<void>;
}

export function CreateOrganizationModal({ isOpen, onClose, onCreate }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [businessModel, setBusinessModel] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [invites, setInvites] = useState<OrganizationInvite[]>([{ email: '', role: 'member' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddInvite = () => {
    setInvites([...invites, { email: '', role: 'member' }]);
  };

  const handleRemoveInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const handleInviteChange = (index: number, field: 'email' | 'role', value: string) => {
    const newInvites = [...invites];
    newInvites[index] = { ...newInvites[index], [field]: value };
    setInvites(newInvites);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nome da organização é obrigatório');
      return;
    }

    if (!businessModel) {
      setError('Selecione um modelo de negócio');
      return;
    }

    setIsLoading(true);
    try {
      await onCreate({
        name: name.trim(),
        businessModel,
        isPrivate,
        invites: invites.filter(i => i.email.trim()),
      });
      handleClose();
    } catch (e) {
      setError('Erro ao criar organização. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setBusinessModel('');
    setIsPrivate(false);
    setInvites([{ email: '', role: 'member' }]);
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#0a0f1f] border border-[#00f6ff]/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f6ff]/20 to-[#7c3aed]/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#00f6ff]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Nova Organização</h2>
                  <p className="text-xs text-white/40">Configure sua equipe</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm text-white/60">Nome da Organização</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Minha Empresa"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">Modelo de Negócio</label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setBusinessModel(model.id)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        businessModel === model.id
                          ? 'bg-[#00f6ff]/20 border-[#00f6ff]/50 text-[#00f6ff]'
                          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      } border`}
                    >
                      {model.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">Visibilidade</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
                      !isPrivate
                        ? 'bg-[#00f6ff]/20 border-[#00f6ff]/50 text-[#00f6ff]'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    } border`}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">Pública</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
                      isPrivate
                        ? 'bg-[#00f6ff]/20 border-[#00f6ff]/50 text-[#00f6ff]'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    } border`}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="text-sm">Privada</span>
                  </button>
                </div>
                <p className="text-xs text-white/40">
                  {isPrivate
                    ? 'Apenas membros convidados podem acessar'
                    : 'Qualquer pessoa pode solicitar participação'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/60 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Convidar Membros
                  </label>
                  <button
                    type="button"
                    onClick={handleAddInvite}
                    className="text-xs text-[#00f6ff] hover:text-[#00f6ff]/80 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {invites.map((invite, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={invite.email}
                        onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                        placeholder="email@exemplo.com"
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm placeholder:text-white/30"
                      />
                      <select
                        value={invite.role}
                        onChange={(e) => handleInviteChange(index, 'role', e.target.value as 'admin' | 'member')}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none"
                      >
                        <option value="member">Membro</option>
                        <option value="admin">Admin</option>
                      </select>
                      {invites.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(index)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] text-[#010516] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Organização'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
