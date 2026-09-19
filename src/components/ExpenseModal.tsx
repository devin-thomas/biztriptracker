import React, { useState } from 'react';
import {
  ExpenseRecord,
  PaymentMethod,
  ReimbursementStatus,
  ReceiptReference,
} from '../types/expense.js';
import { X, Upload, Trash2, Check, Paperclip, Calculator } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseRecord) => Promise<void>;
  tripId: string;
  categories: string[];
  initialExpense?: ExpenseRecord | null;
  defaultCurrency?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tripId,
  categories,
  initialExpense,
  defaultCurrency = 'USD',
}) => {
  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialExpense?.date || today);
  const [merchant, setMerchant] = useState(initialExpense?.merchant || '');
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [category, setCategory] = useState(initialExpense?.category || 'Meals');
  const [amount, setAmount] = useState<number>(initialExpense?.amount || 0);
  const [reimbursableAmount, setReimbursableAmount] = useState<number>(
    initialExpense?.reimbursableAmount !== undefined ? initialExpense.reimbursableAmount : (initialExpense?.amount || 0)
  );
  const [personalAmount, setPersonalAmount] = useState<number>(
    initialExpense?.personalAmount !== undefined ? initialExpense.personalAmount : 0
  );
  const [currency, setCurrency] = useState(initialExpense?.currency || defaultCurrency);
  const [paymentMethod, setPaymentMethod] = useState(initialExpense?.paymentMethod || 'corporate_card');
  const [reimbursementStatus, setReimbursementStatus] = useState<ReimbursementStatus>(
    initialExpense?.reimbursementStatus || 'pending'
  );
  const [notes, setNotes] = useState(initialExpense?.notes || '');
  const [receipt, setReceipt] = useState<ReceiptReference | undefined>(initialExpense?.receipt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleTotalAmountChange = (val: number) => {
    setAmount(val);
    // Default: update reimbursable if personal is 0
    if (personalAmount === 0) {
      setReimbursableAmount(val);
    } else {
      setReimbursableAmount(Math.max(0, val - personalAmount));
    }
  };

  const handleReimbursableChange = (val: number) => {
    setReimbursableAmount(val);
    setPersonalAmount(Math.max(0, amount - val));
  };

  const handlePersonalChange = (val: number) => {
    setPersonalAmount(val);
    setReimbursableAmount(Math.max(0, amount - val));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Receipt file exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceipt({
        id: `rcpt-${Date.now()}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant.trim()) {
      setFormError('Please provide a merchant or payee.');
      return;
    }
    if (amount <= 0) {
      setFormError('Total amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const now = new Date().toISOString();
    const record: ExpenseRecord = {
      id: initialExpense?.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tripId,
      date,
      merchant: merchant.trim(),
      description: description.trim() || merchant.trim(),
      category,
      amount: Math.round(amount * 100) / 100,
      currency,
      paymentMethod,
      reimbursableAmount: Math.round(reimbursableAmount * 100) / 100,
      personalAmount: Math.round(personalAmount * 100) / 100,
      reimbursementStatus,
      notes: notes.trim() || undefined,
      receipt,
      source: initialExpense?.source || 'manual',
      calculation: initialExpense?.calculation,
      createdAt: initialExpense?.createdAt || now,
      updatedAt: now,
    };

    try {
      await onSave(record);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="expense-modal-dialog"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {initialExpense ? 'Edit Expense Record' : 'Enter Expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 text-xs">
          {formError && (
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Merchant / Payee *</label>
              <input
                type="text"
                required
                placeholder="e.g. Delta Air Lines, Hyatt"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1 font-medium">Description</label>
            <input
              type="text"
              placeholder="e.g. Flight to Chicago for onsite"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="corporate_card">Corporate Card</option>
                <option value="personal_card">Personal Card</option>
                <option value="amex">Amex</option>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Amount & Splits */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2.5">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Financials & Split</span>
              <span className="text-[11px] font-normal text-zinc-500">Currency: {currency}</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-0.5">Total Amount *</label>
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-zinc-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount || ''}
                    onChange={(e) => handleTotalAmountChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-5 pr-2 py-1 font-bold rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-emerald-600 dark:text-emerald-400 mb-0.5 font-medium">
                  Reimbursable
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-zinc-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={reimbursableAmount || ''}
                    onChange={(e) => handleReimbursableChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-5 pr-2 py-1 font-semibold rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-amber-600 dark:text-amber-400 mb-0.5 font-medium">
                  Personal
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-zinc-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={personalAmount || ''}
                    onChange={(e) => handlePersonalChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-5 pr-2 py-1 font-semibold rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Reimbursement Status</label>
              <select
                value={reimbursementStatus}
                onChange={(e) => setReimbursementStatus(e.target.value as ReimbursementStatus)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="reimbursed">Reimbursed</option>
                <option value="non_reimbursable">Non-Reimbursable</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Receipt File</label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{receipt ? 'Change' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {receipt && (
                  <button
                    type="button"
                    onClick={() => setReceipt(undefined)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                    title="Remove receipt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {receipt && (
                <div className="mt-1 text-[11px] text-zinc-500 truncate">
                  📎 {receipt.fileName} ({(receipt.fileSize / 1024).toFixed(0)} KB)
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1 font-medium">Notes & Context</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client attendee list, reason for non-reimbursable split..."
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 font-medium rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
