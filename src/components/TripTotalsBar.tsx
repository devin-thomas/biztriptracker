import React from 'react';
import { TripTotals } from '../types/expense.js';
import { formatCurrency } from '../utils/money.js';
import { Receipt, DollarSign, CreditCard, CheckCircle2, Clock } from 'lucide-react';

interface TripTotalsBarProps {
  totals: TripTotals;
  currency?: string;
}

export const TripTotalsBar: React.FC<TripTotalsBarProps> = ({ totals, currency = 'USD' }) => {
  return (
    <div id="trip-totals-bar" className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      <div id="metric-total-expenses" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
          <span>Total Expenses</span>
          <Receipt className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {formatCurrency(totals.totalExpenses, currency)}
        </div>
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          {totals.expenseCount} {totals.expenseCount === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div id="metric-reimbursable" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
          <span>Reimbursable</span>
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
          {formatCurrency(totals.reimbursableTotal, currency)}
        </div>
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          Company eligible
        </div>
      </div>

      <div id="metric-personal" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
          <span>Personal / Non-Reimb.</span>
          <CreditCard className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-zinc-700 dark:text-zinc-300 tracking-tight">
          {formatCurrency(totals.personalTotal, currency)}
        </div>
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          Out-of-pocket
        </div>
      </div>

      <div id="metric-reimbursed" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
          <span>Reimbursed</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
          {formatCurrency(totals.reimbursedTotal, currency)}
        </div>
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          Settled
        </div>
      </div>

      <div id="metric-outstanding" className="col-span-2 sm:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
          <span>Outstanding</span>
          <Clock className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
          {formatCurrency(totals.outstandingReimbursement, currency)}
        </div>
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          Pending payment
        </div>
      </div>
    </div>
  );
};
