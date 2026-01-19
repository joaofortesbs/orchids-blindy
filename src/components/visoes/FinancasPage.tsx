"use client";

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Calendar, ChevronLeft, ChevronRight, MoreVertical, Check, Pencil, Trash2, DollarSign, Copy } from 'lucide-react';
import { BankAccount, Transaction, FinancePeriod, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PaymentMethod, TransactionType } from '@/lib/types/visoes';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear, addMonths, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface FinancasPageProps {
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  financePeriod: FinancePeriod;
  onAddBankAccount: (account: Omit<BankAccount, 'id'>) => void;
  onUpdateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  onRemoveBankAccount: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onRemoveTransaction: (id: string) => void;
  onToggleTransactionStatus: (id: string) => void;
  onSetFinancePeriod: (period: FinancePeriod) => void;
  onClose: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];

const BANKS = [
  'Inter', 'Nubank', 'Itaú', 'Bradesco', 'Santander', 'Caixa', 'Banco do Brasil', 'C6 Bank', 'PicPay', 'Mercado Pago', 'Outro'
];

export function FinancasPage({
  bankAccounts,
  transactions,
  financePeriod,
  onAddBankAccount,
  onUpdateBankAccount,
  onRemoveBankAccount,
  onAddTransaction,
  onUpdateTransaction,
  onRemoveTransaction,
  onToggleTransactionStatus,
  onSetFinancePeriod,
  onClose,
}: FinancasPageProps) {
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState<TransactionType | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  const periodStart = parseISO(financePeriod.startDate);
  const periodEnd = parseISO(financePeriod.endDate);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start: periodStart, end: periodEnd });
    });
  }, [transactions, periodStart, periodEnd]);

  const summary = useMemo(() => {
    const pending = {
      income: filteredTransactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
      expense: filteredTransactions.filter(t => t.type === 'expense' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
    };
    const confirmed = {
      income: filteredTransactions.filter(t => t.type === 'income' && t.status === 'confirmed').reduce((sum, t) => sum + t.amount, 0),
      expense: filteredTransactions.filter(t => t.type === 'expense' && t.status === 'confirmed').reduce((sum, t) => sum + t.amount, 0),
    };
    return {
      pending,
      confirmed,
      pendingBalance: pending.income - pending.expense,
      confirmedBalance: confirmed.income - confirmed.expense,
      totalBalance: (pending.income - pending.expense) + (confirmed.income - confirmed.expense),
    };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(selectedYear, 0, 1)),
      end: endOfYear(new Date(selectedYear, 0, 1)),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = transactions.filter(t => {
        const date = parseISO(t.date);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      return {
        name: format(month, 'MMM', { locale: ptBR }),
        despesas: monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
        receitas: monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      };
    });
  }, [transactions, selectedYear]);

  const totalPortfolio = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const periodLabel = `${format(periodStart, "dd 'de' MMM.", { locale: ptBR })} — ${format(periodEnd, "dd 'de' MMM. 'de' yyyy", { locale: ptBR })}`;

  const handleReplicateMonth = () => {
    const nextMonth = addMonths(periodStart, 1);
    onSetFinancePeriod({
      startDate: format(startOfMonth(nextMonth), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(nextMonth), 'yyyy-MM-dd'),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#010516] overflow-y-auto"
    >
      <div className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Minha carteira</h1>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-white/60" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Carteira</h2>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddAccountModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#00f6ff] text-[#010516] font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Novo Banco
              </motion.button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-white/40 text-sm border-b border-white/5">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Banco</th>
                    <th className="text-left py-2 font-medium">Tipo</th>
                    <th className="text-left py-2 font-medium">Saldo</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map((account, index) => (
                    <tr key={account.id} className="border-b border-white/5">
                      <td className="py-3 text-white/40">{index + 1}</td>
                      <td className="py-3 text-white">{account.name}</td>
                      <td className="py-3 text-white/60 uppercase text-sm">{account.type === 'fiduciary' ? 'Fiduciária' : 'Cripto'}</td>
                      <td className="py-3 text-white">{formatCurrency(account.balance)}</td>
                      <td className="py-3">
                        <button className="p-1 rounded hover:bg-white/5">
                          <MoreVertical className="w-4 h-4 text-white/40" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-white/60">Total</span>
              <span className={`text-xl font-bold ${totalPortfolio >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {formatCurrency(totalPortfolio)}
              </span>
            </div>
          </div>

          <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-white/80">
                Despesas e receitas
              </span>
              <div className="flex items-center gap-4">
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                >
                  {[2024, 2025, 2026, 2027].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                      <span className="text-white/60">Despesas</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
                      <span className="text-white/60">Receita</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0f1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Controle Financeiro</h2>
              <p className="text-white/40 text-sm">Exibindo lançamentos de {periodLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReplicateMonth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white text-sm"
              >
                <Copy className="w-4 h-4" />
                Replicar Mês
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#00f6ff] text-[#00f6ff] text-sm"
              >
                <Calendar className="w-4 h-4" />
                {periodLabel}
              </motion.button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">Futuro</p>
                  <p className="text-white/60 text-xs">Lançamentos ainda não efetivados</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white/5 text-white/60 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Próximos
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Total a receber</span>
                  <span className="text-[#22c55e] text-sm">↗ {formatCurrency(summary.pending.income)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-white/60 text-sm">Total a pagar</span>
                    <span className="text-[#ef4444] text-sm">↘ -{formatCurrency(summary.pending.expense)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between">
                    <span className="text-white/40 text-xs uppercase">Saldo Futuro</span>
                    <span className={summary.pendingBalance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                      {formatCurrency(summary.pendingBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">Efetivado</p>
                  <p className="text-white/60 text-xs">Lançamentos já confirmados</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white/5 text-white/60 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Confirmado
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Receitas</span>
                  <span className="text-[#22c55e] text-sm">↗ {formatCurrency(summary.confirmed.income)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-white/60 text-sm">Custos</span>
                    <span className="text-[#ef4444] text-sm">↘ -{formatCurrency(summary.confirmed.expense)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between">
                    <span className="text-white/40 text-xs uppercase">Saldo Efetivado</span>
                    <span className={summary.confirmedBalance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                      {formatCurrency(summary.confirmedBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-white/40" />
                <span className="text-white/40 text-xs">Saldo geral</span>
              </div>
              <p className={`text-4xl font-bold ${summary.totalBalance >= 0 ? 'text-white' : 'text-[#ef4444]'}`}>
                {summary.totalBalance < 0 ? '-' : ''}R$ {Math.abs(summary.totalBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-white/40 text-xs text-center mt-2 max-w-[200px]">
                Considera lançamentos futuros, recebidos e pagos para mostrar sua posição financeira consolidada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TransactionSection
              title="Detalhamento de RECEITA"
              icon={<DollarSign className="w-5 h-5 text-[#22c55e]" />}
              type="income"
              transactions={filteredTransactions.filter(t => t.type === 'income')}
              onAddTransaction={() => setShowAddTransactionModal('income')}
              onToggleStatus={onToggleTransactionStatus}
              onRemove={onRemoveTransaction}
              menuOpenFor={menuOpenFor}
              setMenuOpenFor={setMenuOpenFor}
            />

            <TransactionSection
              title="Detalhamento de CUSTO"
              icon={<DollarSign className="w-5 h-5 text-[#ef4444]" />}
              type="expense"
              transactions={filteredTransactions.filter(t => t.type === 'expense')}
              onAddTransaction={() => setShowAddTransactionModal('expense')}
              onToggleStatus={onToggleTransactionStatus}
              onRemove={onRemoveTransaction}
              menuOpenFor={menuOpenFor}
              setMenuOpenFor={setMenuOpenFor}
            />
          </div>
        </div>

        <AnimatePresence>
          {showAddAccountModal && (
            <AddAccountModal
              onAdd={(account) => {
                onAddBankAccount(account);
                setShowAddAccountModal(false);
              }}
              onClose={() => setShowAddAccountModal(false)}
            />
          )}

          {showAddTransactionModal && (
            <AddTransactionModal
              type={showAddTransactionModal}
              bankAccounts={bankAccounts}
              onAdd={(transaction) => {
                onAddTransaction(transaction);
                setShowAddTransactionModal(null);
              }}
              onClose={() => setShowAddTransactionModal(null)}
            />
          )}

          {showDatePicker && (
            <DatePickerModal
              currentPeriod={financePeriod}
              onSelect={(period) => {
                onSetFinancePeriod(period);
                setShowDatePicker(false);
              }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TransactionSection({
  title,
  icon,
  type,
  transactions,
  onAddTransaction,
  onToggleStatus,
  onRemove,
  menuOpenFor,
  setMenuOpenFor,
}: {
  title: string;
  icon: React.ReactNode;
  type: TransactionType;
  transactions: Transaction[];
  onAddTransaction: () => void;
  onToggleStatus: (id: string) => void;
  onRemove: (id: string) => void;
  menuOpenFor: string | null;
  setMenuOpenFor: (id: string | null) => void;
}) {
  const pending = transactions.filter(t => t.status === 'pending');
  const confirmed = transactions.filter(t => t.status === 'confirmed');
  const pendingTotal = pending.reduce((sum, t) => sum + t.amount, 0);
  const confirmedTotal = confirmed.reduce((sum, t) => sum + t.amount, 0);

  const buttonLabel = type === 'income' ? 'Adicionar Receita' : 'Adicionar Custo';
  const pendingLabel = type === 'income' ? 'A RECEBER' : 'A PAGAR';
  const confirmedLabel = type === 'income' ? 'RECEBIDOS' : 'PAGOS';

  return (
    <div className="bg-[#0a0f1f] rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <h3 className="text-white font-semibold">{title}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-white/40 text-xs uppercase mb-1">{pendingLabel}</p>
          <p className="text-white text-xl font-bold">R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-white/40 text-xs uppercase mb-1">{confirmedLabel}</p>
          <p className="text-white text-xl font-bold">R$ {confirmedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-white/60 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {pendingLabel}
          </span>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddTransaction}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#00f6ff] text-[#00f6ff] text-xs"
          >
            <Plus className="w-3 h-3" />
            {buttonLabel}
          </motion.button>
        </div>

        {pending.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/5">
                  <th className="text-left py-2 font-medium">Título</th>
                  <th className="text-left py-2 font-medium">Categoria</th>
                  <th className="text-left py-2 font-medium">Pagamento</th>
                  <th className="text-left py-2 font-medium">Valor</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onToggleStatus={onToggleStatus}
                    onRemove={onRemove}
                    menuOpenFor={menuOpenFor}
                    setMenuOpenFor={setMenuOpenFor}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-4">Nenhum lançamento pendente.</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white/60 text-sm">{confirmedLabel}</span>
        </div>

        {confirmed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/5">
                  <th className="text-left py-2 font-medium">Título</th>
                  <th className="text-left py-2 font-medium">Categoria</th>
                  <th className="text-left py-2 font-medium">Pagamento</th>
                  <th className="text-left py-2 font-medium">Valor</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onToggleStatus={onToggleStatus}
                    onRemove={onRemove}
                    menuOpenFor={menuOpenFor}
                    setMenuOpenFor={setMenuOpenFor}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-4">Nenhum lançamento efetivado ainda.</p>
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
  onToggleStatus,
  onRemove,
  menuOpenFor,
  setMenuOpenFor,
}: {
  transaction: Transaction;
  onToggleStatus: (id: string) => void;
  onRemove: (id: string) => void;
  menuOpenFor: string | null;
  setMenuOpenFor: (id: string | null) => void;
}) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 text-white text-sm">{transaction.title}</td>
      <td className="py-3">
        <span className={`px-2 py-1 rounded-lg text-xs uppercase ${
          transaction.type === 'expense' 
            ? 'bg-[#ef4444]/20 text-[#ef4444]' 
            : 'bg-[#22c55e]/20 text-[#22c55e]'
        }`}>
          {transaction.category}
        </span>
      </td>
      <td className="py-3 text-white/60 text-sm">
        {format(parseISO(transaction.date), 'dd/MM/yyyy')}
      </td>
      <td className="py-3 text-white text-sm">
        R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
      <td className="py-3 relative">
        <button
          onClick={() => setMenuOpenFor(menuOpenFor === transaction.id ? null : transaction.id)}
          className="p-1 rounded hover:bg-white/5"
        >
          <MoreVertical className="w-4 h-4 text-white/40" />
        </button>
        
        <AnimatePresence>
          {menuOpenFor === transaction.id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-full mt-1 w-48 bg-[#1a1f2e] border border-white/10 rounded-xl overflow-hidden z-10"
            >
              <button
                onClick={() => {
                  onToggleStatus(transaction.id);
                  setMenuOpenFor(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Marcar como {transaction.status === 'pending' ? 'pago' : 'pendente'}
              </button>
              <button
                onClick={() => {
                  onRemove(transaction.id);
                  setMenuOpenFor(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-[#ef4444] hover:bg-white/5 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </tr>
  );
}

function AddAccountModal({
  onAdd,
  onClose,
}: {
  onAdd: (account: Omit<BankAccount, 'id'>) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<'fiduciary' | 'crypto'>('fiduciary');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [personType, setPersonType] = useState('');
  const [balance, setBalance] = useState('0');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (name) {
      onAdd({
        name,
        type,
        accountType,
        personType,
        balance: parseFloat(balance.replace(',', '.')) || 0,
        notes,
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
        className="w-full max-w-lg bg-[#0a0f1f] border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Adicionar conta</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        <p className="text-white/50 text-sm mb-6">Organize suas contas bancárias e carteiras cripto em um só lugar.</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-2 block">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType('fiduciary')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  type === 'fiduciary' 
                    ? 'border-[#00f6ff] bg-[#00f6ff]/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${type === 'fiduciary' ? 'bg-[#00f6ff]' : 'border border-white/20'}`} />
                  <span className="text-white font-medium">Moeda fiduciária</span>
                </div>
                <p className="text-white/40 text-xs">Contas em bancos tradicionais ou digitais.</p>
              </button>
              <button
                onClick={() => setType('crypto')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  type === 'crypto' 
                    ? 'border-[#00f6ff] bg-[#00f6ff]/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${type === 'crypto' ? 'bg-[#00f6ff]' : 'border border-white/20'}`} />
                  <span className="text-white font-medium">Cripto</span>
                </div>
                <p className="text-white/40 text-xs">Exchanges, carteiras e custodians.</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Banco</label>
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="">Selecione</option>
                {BANKS.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Tipo de pessoa</label>
              <select
                value={personType}
                onChange={(e) => setPersonType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="">Selecione</option>
                <option value="pf">Pessoa Física</option>
                <option value="pj">Pessoa Jurídica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Tipo de conta</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="">Selecione</option>
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="investimento">Investimento</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Saldo</label>
              <input
                type="text"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
              <p className="text-white/30 text-xs mt-1">Você pode atualizar esse valor depois ao conciliar as transações.</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Observação (Opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Insira qualquer detalhe útil para lembrar depois (ex: limites, cartão vinculado, finalidade da conta...)"
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#00f6ff] text-[#00f6ff] font-medium hover:bg-[#00f6ff]/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-medium hover:bg-[#00d4e0] transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddTransactionModal({
  type,
  bankAccounts,
  onAdd,
  onClose,
}: {
  type: TransactionType;
  bankAccounts: BankAccount[];
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'confirmed'>('pending');

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = () => {
    if (title && category && amount) {
      onAdd({
        title,
        type,
        category,
        amount: parseFloat(amount.replace(',', '.')) || 0,
        date,
        paymentMethod,
        status,
        notes,
        bankAccountId: null,
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
        className="w-full max-w-lg bg-[#0a0f1f] border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">
            Adicionar {type === 'expense' ? 'Custo' : 'Receita'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        <p className="text-white/50 text-sm mb-6">
          Cadastre {type === 'expense' ? 'um novo custo para registrar seus gastos' : 'uma nova receita'}.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aluguel, Conta de luz..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[#00f6ff]/50 focus:border-[#00f6ff] outline-none text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Tipo</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'pending' | 'confirmed')}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="pending">Custo fixo</option>
                <option value="confirmed">Custo variável</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Forma de pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              >
                <option value="">Selecione</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Valor</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-1 block">Observação (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-[#00f6ff]/50 outline-none text-white text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <button
              onClick={() => setStatus(status === 'confirmed' ? 'pending' : 'confirmed')}
              className={`w-10 h-5 rounded-full transition-colors ${status === 'confirmed' ? 'bg-[#00f6ff]' : 'bg-white/20'}`}
            >
              <motion.div
                animate={{ x: status === 'confirmed' ? 20 : 2 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
            <div>
              <p className="text-white text-sm">Marcar como pago</p>
              <p className="text-white/40 text-xs">Quando ativado, será considerado um custo pago.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#00f6ff] text-[#00f6ff] font-medium hover:bg-[#00f6ff]/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-[#00f6ff] text-[#010516] font-medium hover:bg-[#00d4e0] transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DatePickerModal({
  currentPeriod,
  onSelect,
  onClose,
}: {
  currentPeriod: FinancePeriod;
  onSelect: (period: FinancePeriod) => void;
  onClose: () => void;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(parseISO(currentPeriod.startDate));
  const [endDate, setEndDate] = useState<Date | null>(parseISO(currentPeriod.endDate));

  const quickSelections = [
    { label: 'Este ano', period: { start: startOfYear(new Date()), end: endOfYear(new Date()) } },
    { label: 'Este mês', period: { start: startOfMonth(new Date()), end: endOfMonth(new Date()) } },
    { label: 'Últimos 60 dias', period: { start: subMonths(new Date(), 2), end: new Date() } },
    { label: 'Últimos 30 dias', period: { start: subMonths(new Date(), 1), end: new Date() } },
    { label: 'Últimos 7 dias', period: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() } },
  ];

  const handleApply = () => {
    if (startDate && endDate) {
      onSelect({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    }
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const days = [];
    
    const startDay = monthStart.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const isInRange = (date: Date) => {
      if (!startDate || !endDate) return false;
      return date >= startDate && date <= endDate;
    };

    const isStart = (date: Date) => startDate && format(date, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd');
    const isEnd = (date: Date) => endDate && format(date, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');

    return (
      <div>
        <p className="text-center text-white font-medium mb-4">
          {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/40 mb-2">
          {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, i) => (
            <button
              key={i}
              onClick={() => {
                if (date) {
                  if (!startDate || (startDate && endDate)) {
                    setStartDate(date);
                    setEndDate(null);
                  } else {
                    if (date < startDate) {
                      setEndDate(startDate);
                      setStartDate(date);
                    } else {
                      setEndDate(date);
                    }
                  }
                }
              }}
              disabled={!date}
              className={`
                p-2 text-sm rounded-lg transition-colors
                ${!date ? 'invisible' : ''}
                ${date && isInRange(date) ? 'bg-white/10' : ''}
                ${date && (isStart(date) || isEnd(date)) ? 'bg-[#00f6ff] text-white' : 'text-white/60 hover:bg-white/5'}
              `}
            >
              {date?.getDate()}
            </button>
          ))}
        </div>
      </div>
    );
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
        className="bg-[#0a0f1f] border border-white/10 rounded-2xl p-6"
      >
        <div className="flex gap-8">
          <div className="space-y-2">
            <p className="text-white/40 text-sm mb-3">Atalhos rápidos</p>
            {quickSelections.map((q) => (
              <button
                key={q.label}
                onClick={() => {
                  setStartDate(q.period.start);
                  setEndDate(q.period.end);
                }}
                className="w-full px-4 py-2 text-left text-white/60 text-sm rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                className="p-1 rounded hover:bg-white/5"
              >
                <ChevronLeft className="w-5 h-5 text-white/60" />
              </button>
            </div>
            
            {renderMonth(viewDate)}
            {renderMonth(addMonths(viewDate, 1))}
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="p-1 rounded hover:bg-white/5"
              >
                <ChevronRight className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-xl bg-[#00f6ff] text-white text-sm font-medium hover:bg-[#00d4e0]"
          >
            Aplicar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
