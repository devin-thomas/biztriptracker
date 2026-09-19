import React, { useState } from 'react';
import { Sparkles, Send, Loader2, AlertCircle, Check, HelpCircle, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ParseExpenseResponse, ExpenseDraftItem } from '../ai/expensePrompt.js';
import { formatCurrency } from '../utils/money.js';

interface ConversationalBoxProps {
  onParseMessage: (text: string) => Promise<ParseExpenseResponse>;
  onCommitParsedExpenses: (expenses: ExpenseDraftItem[]) => Promise<void>;
  onCommitModifiedExpense?: (expenseId: string, updates: Partial<ExpenseDraftItem>) => Promise<void>;
  onDeleteExpenseRequest?: (expenseId: string) => Promise<void>;
  isProcessing: boolean;
  currency?: string;
}

export const ConversationalBox: React.FC<ConversationalBoxProps> = ({
  onParseMessage,
  onCommitParsedExpenses,
  onCommitModifiedExpense,
  onDeleteExpenseRequest,
  isProcessing,
  currency = 'USD',
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [lastParseResult, setLastParseResult] = useState<ParseExpenseResponse | null>(null);
  const [draftEdits, setDraftEdits] = useState<ExpenseDraftItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputMessage.trim();
    if (!clean || isProcessing) return;

    setErrorMessage(null);
    try {
      const result = await onParseMessage(clean);
      setLastParseResult(result);
      if (result.expensesToCreate && result.expensesToCreate.length > 0) {
        setDraftEdits([...result.expensesToCreate]);
      } else {
        setDraftEdits([]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to interpret expense message.');
    }
  };

  const handleDraftFieldChange = (index: number, field: keyof ExpenseDraftItem, value: any) => {
    setDraftEdits((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Rebalance reimbursable & personal when total or splits change
      if (field === 'amount') {
        const num = parseFloat(value) || 0;
        item.amount = num;
        item.reimbursableAmount = num;
        item.personalAmount = 0;
      } else if (field === 'reimbursableAmount') {
        const reimb = parseFloat(value) || 0;
        item.reimbursableAmount = reimb;
        item.personalAmount = Math.max(0, item.amount - reimb);
      } else if (field === 'personalAmount') {
        const pers = parseFloat(value) || 0;
        item.personalAmount = pers;
        item.reimbursableAmount = Math.max(0, item.amount - pers);
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleConfirmSave = async () => {
    if (draftEdits.length === 0) return;
    setIsCommitting(true);
    setErrorMessage(null);
    try {
      await onCommitParsedExpenses(draftEdits);
      // Reset after success
      setInputMessage('');
      setLastParseResult(null);
      setDraftEdits([]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save parsed expense.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleConfirmModify = async () => {
    if (!lastParseResult?.expenseToModify || !onCommitModifiedExpense) return;
    setIsCommitting(true);
    try {
      await onCommitModifiedExpense(
        lastParseResult.expenseToModify.targetExpenseId,
        lastParseResult.expenseToModify.updatedFields
      );
      setInputMessage('');
      setLastParseResult(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply modification.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!lastParseResult?.expenseToDeleteId || !onDeleteExpenseRequest) return;
    setIsCommitting(true);
    try {
      await onDeleteExpenseRequest(lastParseResult.expenseToDeleteId);
      setInputMessage('');
      setLastParseResult(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete expense.');
    } finally {
      setIsCommitting(false);
    }
  };

  const quickSamples = [
    'Hotel was $112.10',
    'Paid 15.24 for parking',
    'Lunch yesterday at Whataburger was $14.63 on my Amex',
    '575 miles, assume 35 mpg, gas was $2.79',
    'Split dinner: 32.50 reimbursable and 12 personal',
  ];

  return (
    <div id="conversational-expense-container" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-xs mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Conversational Expense Entry
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
          Powered by Gemini
        </span>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          id="conversational-expense-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="e.g. 'Hotel was $112.10', 'Drove 575 miles assuming 35 mpg at 2.79/gal', or 'Split dinner: 32.50 reimbursable and 12 personal'"
          rows={2}
          disabled={isProcessing}
          className="w-full text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 pr-24 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400 resize-none transition-all"
        />

        <div className="absolute right-2.5 bottom-3 flex items-center gap-1.5">
          <button
            type="submit"
            id="btn-parse-expense"
            disabled={!inputMessage.trim() || isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <span>Process</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick sample chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span className="text-[11px] text-zinc-400">Try:</span>
        {quickSamples.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInputMessage(sample);
            }}
            className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            "{sample}"
          </button>
        ))}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-3 p-3 text-xs rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <span className="font-medium">Notice: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Ambiguity / Clarification identification */}
      {lastParseResult && lastParseResult.intent === 'clarification_needed' && (
        <div id="clarification-alert" className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>Information Needed</span>
          </div>
          <p>{lastParseResult.clarificationMessage || lastParseResult.summary}</p>
          {lastParseResult.missingFields && lastParseResult.missingFields.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-amber-700">Missing fields:</span>
              {lastParseResult.missingFields.map((f, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-amber-200/60 dark:bg-amber-900/60 font-mono">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query Answer */}
      {lastParseResult && lastParseResult.intent === 'query_trip' && (
        <div className="mt-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-100 text-xs">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Expense Assistant Answer</span>
          </div>
          <p>{lastParseResult.queryAnswer || lastParseResult.summary}</p>
        </div>
      )}

      {/* Modify proposal */}
      {lastParseResult && lastParseResult.intent === 'modify_expense' && lastParseResult.expenseToModify && (
        <div className="mt-3 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Proposed Expense Modification
            </div>
            <span className="text-zinc-400">Target ID: {lastParseResult.expenseToModify.targetExpenseId}</span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">{lastParseResult.summary}</p>
          <div className="bg-white dark:bg-zinc-900 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] mb-3">
            {JSON.stringify(lastParseResult.expenseToModify.updatedFields, null, 2)}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLastParseResult(null)}
              className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleConfirmModify}
              disabled={isCommitting}
              className="px-3 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
            >
              {isCommitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Apply Modification
            </button>
          </div>
        </div>
      )}

      {/* Delete proposal */}
      {lastParseResult && lastParseResult.intent === 'delete_expense' && lastParseResult.expenseToDeleteId && (
        <div className="mt-3 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs">
          <div className="font-semibold text-rose-900 dark:text-rose-100 mb-1">
            Confirm Expense Deletion
          </div>
          <p className="text-rose-700 dark:text-rose-300 mb-3">{lastParseResult.summary}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLastParseResult(null)}
              className="px-2.5 py-1 text-xs rounded border border-zinc-300 hover:bg-white text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isCommitting}
              className="px-3 py-1 text-xs font-medium rounded bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1"
            >
              {isCommitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Delete Expense
            </button>
          </div>
        </div>
      )}

      {/* Structured Draft Review Table / Editor for New / Multiple / Calculated Expenses */}
      {draftEdits.length > 0 && (
        <div id="parsed-expense-draft-review" className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Parsed Result Review ({draftEdits.length} {draftEdits.length === 1 ? 'record' : 'records'})</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Verify or edit any interpreted field before saving to your trip ledger.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftEdits([]);
                  setLastParseResult(null);
                }}
                className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Discard
              </button>
              <button
                type="button"
                id="btn-save-parsed-expense"
                onClick={handleConfirmSave}
                disabled={isCommitting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save to Trip</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {draftEdits.map((draft, idx) => (
              <div
                key={idx}
                className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/80 text-xs"
              >
                {/* Calculation badge if derived */}
                {draft.calculation && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] flex items-center justify-between">
                    <span className="font-semibold">{draft.calculation.formulaLabel}</span>
                    <span className="font-mono">{draft.calculation.summary}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Date</label>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) => handleDraftFieldChange(idx, 'date', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Merchant / Payee</label>
                    <input
                      type="text"
                      value={draft.merchant}
                      onChange={(e) => handleDraftFieldChange(idx, 'merchant', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Category</label>
                    <input
                      type="text"
                      value={draft.category}
                      onChange={(e) => handleDraftFieldChange(idx, 'category', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Payment Method</label>
                    <input
                      type="text"
                      value={draft.paymentMethod}
                      onChange={(e) => handleDraftFieldChange(idx, 'paymentMethod', e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Total Amount</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-zinc-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) => handleDraftFieldChange(idx, 'amount', e.target.value)}
                        className="w-full pl-5 pr-2 py-1 text-xs font-semibold rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">
                      Reimbursable (Business)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-zinc-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.reimbursableAmount}
                        onChange={(e) => handleDraftFieldChange(idx, 'reimbursableAmount', e.target.value)}
                        className="w-full pl-5 pr-2 py-1 text-xs font-semibold rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">
                      Personal / Out-of-pocket
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1 text-zinc-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.personalAmount}
                        onChange={(e) => handleDraftFieldChange(idx, 'personalAmount', e.target.value)}
                        className="w-full pl-5 pr-2 py-1 text-xs font-semibold rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-0.5">Description & Notes</label>
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) => handleDraftFieldChange(idx, 'description', e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
