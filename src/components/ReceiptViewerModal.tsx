import React from 'react';
import { ExpenseRecord } from '../types/expense.js';
import { formatCurrency } from '../utils/money.js';
import { X, Receipt, Download } from 'lucide-react';

interface ReceiptViewerModalProps {
  expense: ExpenseRecord | null;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({ expense, onClose }) => {
  if (!expense || !expense.receipt) return null;

  const { receipt } = expense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Receipt: {expense.merchant}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          <div className="flex justify-between items-center text-zinc-500 text-[11px]">
            <span>Amount: {formatCurrency(expense.amount, expense.currency)}</span>
            <span>Date: {expense.date}</span>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded p-2 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 min-h-[220px]">
            {receipt.dataUrl ? (
              receipt.fileType.startsWith('image/') ? (
                <img
                  src={receipt.dataUrl}
                  alt={`Receipt for ${expense.merchant}`}
                  className="max-h-[380px] max-w-full object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-6 text-zinc-400">
                  <p className="font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    {receipt.fileName}
                  </p>
                  <p className="text-[11px] mb-3">PDF or non-image document attached.</p>
                  <a
                    href={receipt.dataUrl}
                    download={receipt.fileName}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File
                  </a>
                </div>
              )
            ) : (
              <span className="text-zinc-400 text-xs">No preview available</span>
            )}
          </div>

          <div className="text-[11px] text-zinc-400 text-center">
            Uploaded {new Date(receipt.uploadedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
