import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User } from 'firebase/auth';
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, ChevronRight,
  ClipboardList, FileDown, FilePlus2, MapPin, MessageSquareText,
  MoreHorizontal, Plus, Settings2, SlidersHorizontal,
} from 'lucide-react';
import { TripRecord, ExpenseRecord, DEFAULT_CATEGORIES } from './types/expense.js';
import { expenseStorage } from './storage/IndexedDbExpenseStorage.js';
import { computeTripTotals } from './storage/IExpenseStorage.js';
import { geminiExpenseParser } from './ai/GeminiExpenseParser.js';
import { ParseExpenseResponse, ExpenseDraftItem } from './ai/expensePrompt.js';
import { formatCurrency } from './utils/money.js';
import { TripTotalsBar } from './components/TripTotalsBar.js';
import { ConversationalBox } from './components/ConversationalBox.js';
import { ExpenseTable } from './components/ExpenseTable.js';
import { ExpenseModal } from './components/ExpenseModal.js';
import { TripModal } from './components/TripModal.js';
import { ExportModal } from './components/ExportModal.js';
import { ReceiptViewerModal } from './components/ReceiptViewerModal.js';
import { initAuth } from './services/googleAuth.js';

type ViewKey = 'tripChooser' | 'tripHome' | 'addExpenseChoice' | 'chatExpense' | 'manualExpense' | 'reviewProject' | 'projectControls';

export default function App() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [view, setView] = useState<ViewKey>('tripChooser');
  const [direction, setDirection] = useState(1);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [manualReturnView, setManualReturnView] = useState<ViewKey>('tripHome');
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<ExpenseRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    initAuth(setCurrentUser, () => setCurrentUser(null));
  }, []);

  const navigate = (nextView: ViewKey, nextDirection = 1) => {
    setDirection(nextDirection);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      let allTrips = await expenseStorage.getAllTrips();
      if (allTrips.length === 0) {
        const seeded = await expenseStorage.seedDemoData();
        allTrips = [seeded.trip];
      }
      setTrips(allTrips);
      setActiveTrip(null);
      setExpenses([]);
      const storedCategories = await expenseStorage.getCustomCategories();
      setCustomCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...storedCategories])));
      navigate('tripChooser', -1);
    } catch (err) {
      console.error('Failed to load initial expense database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadInitialData(); }, []);

  const handleSelectTrip = async (tripId: string) => {
    const found = trips.find((trip) => trip.id === tripId) || null;
    setActiveTrip(found);
    if (found) {
      setExpenses(await expenseStorage.getExpensesForTrip(found.id));
      navigate('tripHome');
    }
  };

  const refreshExpenses = async (tripId: string) => setExpenses(await expenseStorage.getExpensesForTrip(tripId));

  const handleParseAiMessage = async (text: string): Promise<ParseExpenseResponse> => {
    if (!activeTrip) throw new Error('Please create or select an active trip first.');
    setIsProcessingAi(true);
    try {
      return await geminiExpenseParser.parseExpenseMessage({ message: text, trip: activeTrip, existingExpenses: expenses, customCategories });
    } finally {
      setIsProcessingAi(false);
    }
  };

  const handleCommitParsedExpenses = async (drafts: ExpenseDraftItem[]) => {
    if (!activeTrip) return;
    const now = new Date().toISOString();
    const records: ExpenseRecord[] = drafts.map((draft, index) => ({
      id: `exp-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
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
    await expenseStorage.saveExpenses(records);
    await refreshExpenses(activeTrip.id);
    navigate('tripHome', -1);
  };

  const handleCommitModifiedExpense = async (expenseId: string, updates: Partial<ExpenseDraftItem>) => {
    const existing = await expenseStorage.getExpenseById(expenseId);
    if (!existing) throw new Error(`Expense with ID ${expenseId} not found.`);
    await expenseStorage.saveExpense({ ...existing, ...updates, updatedAt: new Date().toISOString() });
    if (activeTrip) await refreshExpenses(activeTrip.id);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await expenseStorage.deleteExpense(expenseId);
    if (activeTrip) await refreshExpenses(activeTrip.id);
  };

  const handleDuplicateExpense = async (expense: ExpenseRecord) => {
    if (!activeTrip) return;
    const now = new Date().toISOString();
    await expenseStorage.saveExpense({ ...expense, id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, description: `${expense.description} (Copy)`, source: 'manual', createdAt: now, updatedAt: now });
    await refreshExpenses(activeTrip.id);
  };

  const handleSaveExpenseRecord = async (record: ExpenseRecord) => {
    await expenseStorage.saveExpense(record);
    if (activeTrip) await refreshExpenses(activeTrip.id);
    setIsExpenseModalOpen(false);
    setEditingExpense(null);
    navigate(manualReturnView, -1);
  };

  const handleSaveTrip = async (trip: TripRecord) => {
    await expenseStorage.saveTrip(trip);
    setTrips(await expenseStorage.getAllTrips());
    setActiveTrip(trip);
    await refreshExpenses(trip.id);
    setIsTripModalOpen(false);
    setEditingTrip(null);
    navigate('tripHome');
  };

  const handleClearDemoData = async () => {
    await expenseStorage.clearDemoData();
    setTrips([]);
    setActiveTrip(null);
    setExpenses([]);
    setIsExportModalOpen(false);
    navigate('tripChooser', -1);
  };

  const openManualEntry = (returnView: ViewKey = 'tripHome', expense: ExpenseRecord | null = null) => {
    setManualReturnView(returnView);
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
    navigate('manualExpense');
  };

  const renderView = () => {
    if (isLoading) return <div className="loading-state">Loading your trips<span className="loading-dots">...</span></div>;
    if (view === 'tripChooser') return <section className="flow-screen chooser-screen" aria-labelledby="chooser-title">
      <div className="step-heading"><span>01</span><div><h1 id="chooser-title">Choose a trip</h1><p>Start with the project you are working on today.</p></div></div>
      <div className="trip-list" role="list" aria-label="Available trips">
        {trips.map((trip) => <button key={trip.id} type="button" className="selection-tile trip-tile" onClick={() => void handleSelectTrip(trip.id)}><span className="tile-icon"><BriefcaseBusiness size={20} /></span><span className="tile-copy"><strong>{trip.name}</strong><small><MapPin size={13} />{trip.destination}</small><small><CalendarDays size={13} />{trip.startDate} to {trip.endDate}</small></span><ChevronRight className="tile-arrow" size={18} /></button>)}
      </div>
      <button type="button" className="secondary-action create-trip-action" onClick={() => { setEditingTrip(null); setIsTripModalOpen(true); }}><Plus size={16} /> Create a trip</button>
    </section>;
    if (!activeTrip) return null;
    const currency = activeTrip.settings.defaultCurrency || 'USD';
    const totals = computeTripTotals(expenses);
    if (view === 'tripHome') return <section className="flow-screen home-screen" aria-labelledby="home-title">
      <div className="screen-toolbar"><button type="button" className="icon-action" aria-label="Choose another trip" onClick={() => { setActiveTrip(null); setExpenses([]); navigate('tripChooser', -1); }}><ArrowLeft size={17} /></button><span className="toolbar-context">{activeTrip.destination}</span><button type="button" className="icon-action" aria-label="Open project controls" onClick={() => navigate('projectControls')}><MoreHorizontal size={19} /></button></div>
      <div className="home-intro"><span className="section-kicker">CURRENT TRIP</span><h1 id="home-title">{activeTrip.name}</h1><p><MapPin size={14} /> {activeTrip.destination} <span className="dot-separator">•</span> <CalendarDays size={14} /> {activeTrip.startDate} to {activeTrip.endDate}</p></div>
      <div className="home-summary"><div><span>Expenses</span><strong>{totals.expenseCount}</strong></div><div><span>Total</span><strong className="success-text">{formatCurrency(totals.totalExpenses, currency)}</strong></div></div>
      <div className="primary-actions-stack"><button type="button" className="primary-action primary-action-large" onClick={() => navigate('addExpenseChoice')}><Plus size={21} /> Add expense</button><button type="button" className="secondary-action secondary-action-large" onClick={() => navigate('reviewProject')}><ClipboardList size={18} /> Review project <ArrowRight size={16} /></button></div>
      {activeTrip.notes && <div className="policy-note"><SlidersHorizontal size={15} /><span><strong>Trip policy</strong>{activeTrip.notes}</span></div>}
    </section>;
    if (view === 'addExpenseChoice') return <section className="flow-screen choice-screen" aria-labelledby="add-title"><FlowBackButton label="Back to trip" onClick={() => navigate('tripHome', -1)} /><div className="step-heading compact-heading"><span>02</span><div><h1 id="add-title">Add an expense</h1><p>How do you want to add it?</p></div></div><div className="choice-list"><button type="button" className="selection-tile choice-tile selected-tile" onClick={() => navigate('chatExpense')}><span className="tile-icon"><MessageSquareText size={23} /></span><span className="tile-copy"><strong>Chat it in</strong><small>Describe what you spent in your own words.</small></span><ChevronRight className="tile-arrow" size={19} /></button><button type="button" className="selection-tile choice-tile" onClick={() => openManualEntry()}><span className="tile-icon"><FilePlus2 size={23} /></span><span className="tile-copy"><strong>Enter manually</strong><small>Fill in the details yourself.</small></span><ChevronRight className="tile-arrow" size={19} /></button></div></section>;
    if (view === 'chatExpense') return <section className="flow-screen chat-screen" aria-labelledby="chat-title"><FlowBackButton label="Back to add expense" onClick={() => navigate('addExpenseChoice', -1)} /><div className="step-heading compact-heading"><span>03</span><div><h1 id="chat-title">Chat it in</h1><p>Describe one or more expenses in your own words.</p></div></div><ConversationalBox onParseMessage={handleParseAiMessage} onCommitParsedExpenses={handleCommitParsedExpenses} onCommitModifiedExpense={handleCommitModifiedExpense} onDeleteExpenseRequest={handleDeleteExpense} isProcessing={isProcessingAi} currency={currency} /></section>;
    if (view === 'reviewProject') return <section className="review-screen" aria-labelledby="review-title"><div className="screen-toolbar"><button type="button" className="icon-action" aria-label="Back to trip home" onClick={() => navigate('tripHome', -1)}><ArrowLeft size={17} /></button><span className="toolbar-context">{activeTrip.name}</span><button type="button" className="icon-action" aria-label="Open project controls" onClick={() => navigate('projectControls')}><MoreHorizontal size={19} /></button></div><div className="step-heading compact-heading"><span>04</span><div><h1 id="review-title">Review project</h1><p>Check the details and keep your records ready.</p></div></div><TripTotalsBar totals={totals} currency={currency} /><ExpenseTable expenses={expenses} allCategories={customCategories} onEditExpense={(expense) => openManualEntry('reviewProject', expense)} onDeleteExpense={handleDeleteExpense} onDuplicateExpense={handleDuplicateExpense} onAddNewManual={() => navigate('addExpenseChoice')} onViewReceipt={setViewingReceiptExpense} currency={currency} /></section>;
    if (view === 'projectControls') return <section className="flow-screen controls-screen" aria-labelledby="controls-title"><FlowBackButton label="Back to trip" onClick={() => navigate('tripHome', -1)} /><div className="step-heading compact-heading"><span>••</span><div><h1 id="controls-title">Project controls</h1><p>Useful tools for this trip, kept out of the way until you need them.</p></div></div><div className="control-list"><button type="button" className="control-row" onClick={() => { setEditingTrip(activeTrip); setIsTripModalOpen(true); }}><Settings2 size={18} /><span><strong>Trip settings</strong><small>Edit dates, policy, and defaults.</small></span><ChevronRight size={17} /></button><button type="button" className="control-row" onClick={() => setIsExportModalOpen(true)}><FileDown size={18} /><span><strong>Export or reconcile</strong><small>Download, import, or send to Sheets.</small></span><ChevronRight size={17} /></button><button type="button" className="control-row" onClick={() => navigate('reviewProject')}><ClipboardList size={18} /><span><strong>Review expenses</strong><small>Open the full ledger and totals.</small></span><ChevronRight size={17} /></button></div></section>;
    return null;
  };

  return <div className="app-shell"><header className="brand-header"><div className="brand-lockup"><span className="brand-icon"><BriefcaseBusiness size={18} /></span><span>Trip Expense Tracker</span></div><span className="save-state">LOCAL WORKSPACE</span></header><main className="app-main"><div className="workflow-frame"><AnimatePresence mode="wait" custom={direction}><motion.div key={view} custom={direction} initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -18 }} transition={{ duration: 0.24, ease: [0.22, 0.8, 0.3, 1] }}>{renderView()}</motion.div></AnimatePresence></div></main>{activeTrip && <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(null); navigate(manualReturnView, -1); }} onSave={handleSaveExpenseRecord} tripId={activeTrip.id} categories={customCategories} initialExpense={editingExpense} defaultCurrency={activeTrip.settings.defaultCurrency || 'USD'} />}<TripModal isOpen={isTripModalOpen} onClose={() => { setIsTripModalOpen(false); setEditingTrip(null); }} onSave={handleSaveTrip} initialTrip={editingTrip} />{activeTrip && <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} trip={activeTrip} expenses={expenses} allTrips={trips} onImportSuccess={loadInitialData} onClearDemoData={handleClearDemoData} currentUser={currentUser} onUserChanged={setCurrentUser} />}<ReceiptViewerModal expense={viewingReceiptExpense} onClose={() => setViewingReceiptExpense(null)} /></div>;
}

function FlowBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="back-link" onClick={onClick}><ArrowLeft size={15} /> {label}</button>;
}
