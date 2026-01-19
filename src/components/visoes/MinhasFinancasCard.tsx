"use client";

import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction } from '@/lib/types/visoes';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface MinhasFinancasCardProps {
  transactions: Transaction[];
  onOpenFinancas: () => void;
}

export function MinhasFinancasCard({ transactions, onOpenFinancas }: MinhasFinancasCardProps) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const periodTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date >= monthStart && date <= monthEnd;
  });

  const totalIncome = periodTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = periodTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const periodLabel = `${format(monthStart, 'dd/MM/yyyy')} – ${format(monthEnd, 'dd/MM/yyyy')}`;

  const hasData = transactions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative bg-[#0a0f1f] rounded-2xl border border-[#00f6ff]/10 p-6 h-full flex flex-col overflow-hidden"
    >
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 100% 100%, #00f6ff20 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex items-center justify-between mb-6">
        <motion.span 
          className="px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase flex items-center gap-2"
          style={{ 
            borderColor: '#00f6ff',
            color: '#00f6ff',
          }}
        >
          <Wallet className="w-3 h-3" />
          MINHAS FINANÇAS
        </motion.span>
        <span className="text-xs text-white/40">{periodLabel}</span>
      </div>

      <div className="relative z-10 flex-1">
        {hasData ? (
          <>
            <p className="text-white/50 text-sm mb-1">Saldo do período</p>
            <p className={`text-4xl font-bold ${balance >= 0 ? 'text-[#00f6ff]' : 'text-red-400'}`}>
              {balance < 0 ? '-' : ''}R$ {Math.abs(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-[#010516]/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Entradas
                </div>
                <p className="text-emerald-400 text-xl font-semibold">
                  R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[#010516]/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Saídas
                </div>
                <p className="text-red-400 text-xl font-semibold">
                  R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-[#00f6ff]/10 flex items-center justify-center mb-3">
              <Wallet className="w-8 h-8 text-[#00f6ff]/40" />
            </div>
            <p className="text-white/40 text-sm">Nenhuma transação</p>
            <p className="text-white/30 text-xs">registrada ainda</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-center mt-6">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 246, 255, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenFinancas}
          className="px-6 py-2.5 rounded-xl bg-[#00f6ff] text-[#010516] text-sm font-semibold transition-all"
          style={{ boxShadow: '0 0 20px rgba(0, 246, 255, 0.3)' }}
        >
          Gerenciar
        </motion.button>
      </div>
    </motion.div>
  );
}
