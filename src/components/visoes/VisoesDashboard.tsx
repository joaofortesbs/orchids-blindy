"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisoesData } from '@/hooks/useVisoesData';
import { LeiDaAtracaoCard, VisionBoardFullscreen } from './LeiDaAtracaoCard';
import { MetasCard } from './MetasCard';
import { FontesConhecimentoCard } from './FontesConhecimentoCard';
import { MinhasFinancasCard } from './MinhasFinancasCard';
import { LembretesCard } from './LembretesCard';
import { AnotacoesCard } from './AnotacoesCard';
import { MetasPage } from './MetasPage';
import { FinancasPage } from './FinancasPage';
import { FontesConhecimentoPage } from './FontesConhecimentoPage';
import { AnotacoesPage } from './AnotacoesPage';

type ActivePage = 'dashboard' | 'visionboard' | 'metas' | 'financas' | 'fontes' | 'notas';

export function VisoesDashboard() {
  const {
    data,
    isLoaded,
    addVisionImage,
    removeVisionImage,
    reorderVisionImages,
    resetVisionBoard,
    setMainGoal,
    addGoalAction,
    toggleGoalAction,
    removeGoalAction,
    addGoalToCategory,
    toggleGoalInCategory,
    removeGoalFromCategory,
    addBook,
    updateBookProgress,
    removeBook,
    addReminder,
    toggleReminder,
    removeReminder,
    addNote,
    updateNote,
    removeNote,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
    addTransaction,
    updateTransaction,
    removeTransaction,
    toggleTransactionStatus,
    setFinancePeriod,
    setSelectedYear,
  } = useVisoesData();

  const [activePage, setActivePage] = useState<ActivePage>('dashboard');

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-[#010516]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-[#00f6ff]/30 border-t-[#00f6ff] rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Carregando visões...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
        <div className="h-full overflow-y-auto p-6 bg-[#010516]">
          <div 
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, #00f6ff10 0%, transparent 50%)',
            }}
          />

            <div className="relative z-10 grid grid-cols-3 gap-6">
            <div className="h-[380px]">
              <LeiDaAtracaoCard
                images={data.visionBoard}
                onAddImage={addVisionImage}
                onRemoveImage={removeVisionImage}
                onReorderImages={reorderVisionImages}
                onReset={resetVisionBoard}
                onOpenFullscreen={() => setActivePage('visionboard')}
              />
            </div>

              <div className="h-[380px]">
                <MetasCard
                  mainGoal={data.mainGoal}
                  onSetGoal={setMainGoal}
                  onOpenMetas={() => setActivePage('metas')}
                />
              </div>

              <div className="h-[380px]">
                <FontesConhecimentoCard
                  books={data.books}
                  onAddBook={addBook}
                  onUpdateProgress={updateBookProgress}
                  onRemoveBook={removeBook}
                  onOpenOrganizar={() => setActivePage('fontes')}
                />
              </div>

              <div className="h-[380px]">
                <MinhasFinancasCard
                  transactions={data.transactions}
                  onOpenFinancas={() => setActivePage('financas')}
                />
              </div>

              <div className="h-[380px]">
                <LembretesCard
                  reminders={data.reminders}
                  onAddReminder={addReminder}
                  onToggleReminder={toggleReminder}
                  onRemoveReminder={removeReminder}
                />
              </div>

              <div className="h-[380px]">
                <AnotacoesCard
                  notes={data.notes}
                  onAddNote={addNote}
                  onUpdateNote={updateNote}
                  onRemoveNote={removeNote}
                  onOpenNotes={() => setActivePage('notas')}
                />
              </div>
            </div>
        </div>

      <AnimatePresence>
        {activePage === 'visionboard' && (
            <VisionBoardFullscreen
              images={data.visionBoard}
              onAddImage={addVisionImage}
              onRemoveImage={removeVisionImage}
              onReorderImages={reorderVisionImages}
              onReset={resetVisionBoard}
              onClose={() => setActivePage('dashboard')}
            />
          )}

        {activePage === 'metas' && (
          <MetasPage
            mainGoal={data.mainGoal}
            goalActions={data.goalActions}
            goalCategories={data.goalCategories}
            selectedYear={data.selectedYear}
            onSetMainGoal={setMainGoal}
            onAddGoalAction={addGoalAction}
            onToggleGoalAction={toggleGoalAction}
            onRemoveGoalAction={removeGoalAction}
            onAddGoalToCategory={addGoalToCategory}
            onToggleGoalInCategory={toggleGoalInCategory}
            onRemoveGoalFromCategory={removeGoalFromCategory}
            onSetSelectedYear={setSelectedYear}
            onClose={() => setActivePage('dashboard')}
          />
        )}

        {activePage === 'financas' && (
          <FinancasPage
            bankAccounts={data.bankAccounts}
            transactions={data.transactions}
            financePeriod={data.financePeriod}
            onAddBankAccount={addBankAccount}
            onUpdateBankAccount={updateBankAccount}
            onRemoveBankAccount={removeBankAccount}
            onAddTransaction={addTransaction}
            onUpdateTransaction={updateTransaction}
            onRemoveTransaction={removeTransaction}
            onToggleTransactionStatus={toggleTransactionStatus}
            onSetFinancePeriod={setFinancePeriod}
            onClose={() => setActivePage('dashboard')}
          />
        )}

        {activePage === 'fontes' && (
          <FontesConhecimentoPage
            books={data.books}
            onAddBook={addBook}
            onUpdateProgress={updateBookProgress}
            onRemoveBook={removeBook}
            onClose={() => setActivePage('dashboard')}
          />
        )}

        {activePage === 'notas' && (
          <AnotacoesPage
            notes={data.notes}
            onAddNote={addNote}
            onUpdateNote={updateNote}
            onRemoveNote={removeNote}
            onClose={() => setActivePage('dashboard')}
          />
        )}
      </AnimatePresence>
    </>
  );
}
