import React, { useState, useEffect } from 'react';
import { TripRecord, ExpenseRecord, DEFAULT_CATEGORIES } from './types/expense.js';
import { expenseStorage } from './storage/IndexedDbExpenseStorage.js';
import { computeTripTotals } from './storage/IExpenseStorage.js';
import { geminiExpenseParser } from './ai/GeminiExpenseParser.js';
import { ParseExpenseResponse, ExpenseDraftItem } from './ai/expensePrompt.js';
import { TripTotalsBar } from './components/TripTotalsBar.js';
import { ConversationalBox } from './components/ConversationalBox.js';
import { ExpenseTable } from './components/ExpenseTable.js';
import { ExpenseModal } from './components/ExpenseModal.js';
import { TripModal } from './components/TripModal.js';
import { ExportModal } from './components/ExportModal.js';
import { ReceiptViewerModal } from './components/ReceiptViewerModal.js';
import { initAuth, googleSignIn, logout } from './services/googleAuth.js';
import { User } from 'firebase/auth';
import {
  Briefcase,
  Plus,
  Share2,
  Calendar,
  MapPin,
  Settings,
  ChevronDown,
  Moon,
  Sun,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Trips & Expenses State
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<ExpenseRecord | null>(null);

  // Auth state for Google Sheets
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    initAuth(
      (user) => setCurrentUser(user),
      () => setCurrentUser(null)
    );
  }, []);

  // Initialize and load data from IndexedDB
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      let allTrips = await expenseStorage.getAllTrips();

      // If database is completely empty on fresh checkout, seed a demo trip
      if (allTrips.length === 0) {
        const seeded = await expenseStorage.seedDemoData();
        allTrips = [seeded.trip];
      }

      setTrips(allTrips);
      const selected = allTrips[0] || null;
      setActiveTrip(selected);

      if (selected) {
        const tripExpenses = await expenseStorage.getExpensesForTrip(selected.id);
        setExpenses(tripExpenses);
      } else {
        setExpenses([]);
      }

      // Categories
      const storedCategories = await expenseStorage.getCustomCategories();
      const mergedCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...storedCategories]));
      setCustomCategories(mergedCategories);
    } catch (err) {
      console.error('Failed to load initial expense database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Switch trip handler
  const handleSelectTrip = async (tripId: string) => {
    const found = trips.find((t) => t.id === tripId) || null;
    setActiveTrip(found);
    if (found) {
      const tripExpenses = await expenseStorage.getExpensesForTrip(found.id);
      setExpenses(tripExpenses);
    } else {
      setExpenses([]);
    }
  };

  // Refresh active trip expenses
  const refreshExpenses = async (tripId: string) => {
    const list = await expenseStorage.getExpensesForTrip(tripId);
    setExpenses(list);
  };

  // Conversational parsing handler
  const handleParseAiMessage = async (text: string): Promise<ParseExpenseResponse> => {
    if (!activeTrip) {
      throw new Error('Please create or select an active trip first.');
    }

    setIsProcessingAi(true);
    try {
      const response = await geminiExpenseParser.parseExpenseMessage({
        message: text,
        trip: activeTrip,
        existingExpenses: expenses,
        customCategories,
      });
      return response;
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Commit parsed expenses from conversation
  const handleCommitParsedExpenses = async (drafts: ExpenseDraftItem[]) => {
    if (!activeTrip) return;
    const now = new Date().toISOString();

    const newRecords: ExpenseRecord[] = drafts.map((draft, idx) => ({
      id: `exp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      tripId: activeTrip.id,
      date: draft.date || new Date().toISOString().split('T')[0],
      merchant: draft.merchant || 'Expense Entry',
      description: draft.description || draft.merchant || 'Trip expense',
      category: draft.category || 'Other',
      amount: draft.amount,
      currency: draft.currency || activeTrip.settings.defaultCurrency || 'USD',
      paymentMethod: draft.paymentMethod || activeTrip.settings.defaultPaymentMethod || 'corporate_card',
      reimbursableAmount: draft.reimbursableAmount,
      personalAmount: draft.personalAmount,
      reimbursementStatus: draft.reimbursementStatus || 'pending',
      notes: draft.notes,
      source: draft.source || 'ai_chat',
      calculation: draft.calculation,
      createdAt: now,
      updatedAt: now,
    }));

    await expenseStorage.saveExpenses(newRecords);
    await refreshExpenses(activeTrip.id);
  };

  // Commit modification from conversation
  const handleCommitModifiedExpense = async (expenseId: string, updates: Partial<ExpenseDraftItem>) => {
    const existing = await expenseStorage.getExpenseById(expenseId);
    if (!existing) {
      throw new Error(`Expense with ID ${expenseId} not found.`);
    }

    const updated: ExpenseRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await expenseStorage.saveExpense(updated);
    if (activeTrip) {
      await refreshExpenses(activeTrip.id);
    }
  };

  // Delete expense handler
  const handleDeleteExpense = async (expenseId: string) => {
    await expenseStorage.deleteExpense(expenseId);
    if (activeTrip) {
      await refreshExpenses(activeTrip.id);
    }
  };

  // Duplicate expense handler
  const handleDuplicateExpense = async (exp: ExpenseRecord) => {
    if (!activeTrip) return;
    const now = new Date().toISOString();
    const duplicated: ExpenseRecord = {
      ...exp,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: `${exp.description} (Copy)`,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };
    await expenseStorage.saveExpense(duplicated);
    await refreshExpenses(activeTrip.id);
  };

  // Save manual / edited expense
  const handleSaveExpenseRecord = async (record: ExpenseRecord) => {
    await expenseStorage.saveExpense(record);
    if (activeTrip) {
      await refreshExpenses(activeTrip.id);
    }
  };

  // Save / create trip
  const handleSaveTrip = async (trip: TripRecord) => {
    await expenseStorage.saveTrip(trip);
    const all = await expenseStorage.getAllTrips();
    setTrips(all);
    setActiveTrip(trip);
    await refreshExpenses(trip.id);
  };

  // Clear demo data
  const handleClearDemoData = async () => {
    await expenseStorage.clearDemoData();
    setTrips([]);
    setActiveTrip(null);
    setExpenses([]);
  };

  // Computed financial totals
  const tripTotals = computeTripTotals(expenses);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white dark:selection:bg-zinc-200 dark:selection:text-zinc-900 antialiased">
      {/* Dense App Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xs shadow-xs">
                TT
              </div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline">
                Trip Expense Tracker
              </h1>
            </div>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

            {/* Trip Selector Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                id="trip-selector-dropdown"
                value={activeTrip?.id || ''}
                onChange={(e) => handleSelectTrip(e.target.value)}
                className="text-xs font-medium py-1 px-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-hidden max-w-[200px] sm:max-w-xs truncate cursor-pointer"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.destination})
                  </option>
                ))}
              </select>

              <button
                type="button"
                id="btn-new-trip"
                onClick={() => {
                  setEditingTrip(null);
                  setIsTripModalOpen(true);
                }}
                className="p-1 rounded text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Create New Trip"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {activeTrip && (
              <>
                <button
                  type="button"
                  id="btn-trip-settings"
                  onClick={() => {
                    setEditingTrip(activeTrip);
                    setIsTripModalOpen(true);
                  }}
                  className="p-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Trip Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  id="btn-open-export-modal"
                  onClick={() => setIsExportModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Export & Reconcile</span>
                </button>
              </>
            )}

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading trip expenses...</div>
        ) : !activeTrip ? (
          /* Empty Trip State */
          <div className="py-16 text-center max-w-md mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 shadow-xs">
            <Briefcase className="w-10 h-10 mx-auto text-zinc-400 mb-3" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              No Trips Recorded
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Create a trip to record, categorize, and reconcile your business travel expenses.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingTrip(null);
                setIsTripModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs cursor-pointer"
            >
              Create Business Trip
            </button>
          </div>
        ) : (
          <div>
            {/* Trip Metadata Header Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 mb-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {activeTrip.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {activeTrip.settings.defaultCurrency}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    {activeTrip.destination}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    {activeTrip.startDate} → {activeTrip.endDate}
                  </span>
                  {activeTrip.clientOrEvent && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-zinc-400" />
                      {activeTrip.clientOrEvent}
                    </span>
                  )}
                </div>
              </div>

              {activeTrip.notes && (
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 rounded border border-zinc-200/80 dark:border-zinc-800 max-w-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Policy: </span>
                  {activeTrip.notes}
                </div>
              )}
            </div>

            {/* Trip Totals Bar */}
            <TripTotalsBar totals={tripTotals} currency={activeTrip.settings.defaultCurrency} />

            {/* Conversational Expense-Entry Box */}
            <ConversationalBox
              onParseMessage={handleParseAiMessage}
              onCommitParsedExpenses={handleCommitParsedExpenses}
              onCommitModifiedExpense={handleCommitModifiedExpense}
              onDeleteExpenseRequest={handleDeleteExpense}
              isProcessing={isProcessingAi}
              currency={activeTrip.settings.defaultCurrency}
            />

            {/* Expense Table with Sorting, Filtering, and Actions */}
            <ExpenseTable
              expenses={expenses}
              allCategories={customCategories}
              onEditExpense={(exp) => {
                setEditingExpense(exp);
                setIsExpenseModalOpen(true);
              }}
              onDeleteExpense={handleDeleteExpense}
              onDuplicateExpense={handleDuplicateExpense}
              onAddNewManual={() => {
                setEditingExpense(null);
                setIsExpenseModalOpen(true);
              }}
              onViewReceipt={(exp) => setViewingReceiptExpense(exp)}
              currency={activeTrip.settings.defaultCurrency}
            />
          </div>
        )}
      </main>

      {/* Manual / Edit Expense Dialog */}
      {activeTrip && (
        <ExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          onSave={handleSaveExpenseRecord}
          tripId={activeTrip.id}
          categories={customCategories}
          initialExpense={editingExpense}
          defaultCurrency={activeTrip.settings.defaultCurrency}
        />
      )}

      {/* Create / Edit Trip Dialog */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setEditingTrip(null);
        }}
        onSave={handleSaveTrip}
        initialTrip={editingTrip}
      />

      {/* Export & Reconciliation Dialog */}
      {activeTrip && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          trip={activeTrip}
          expenses={expenses}
          allTrips={trips}
          onImportSuccess={loadInitialData}
          onClearDemoData={handleClearDemoData}
          currentUser={currentUser}
          onUserChanged={setCurrentUser}
        />
      )}

      {/* Attached Receipt Viewer */}
      <ReceiptViewerModal
        expense={viewingReceiptExpense}
        onClose={() => setViewingReceiptExpense(null)}
      />
    </div>
  );
}
