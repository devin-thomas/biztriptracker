import React, { useState } from 'react';
import {
  ExpenseRecord,
  ExpenseFilterOptions,
  ReimbursementStatus,
  DEFAULT_CATEGORIES,
} from '../types/expense.js';
import { formatCurrency } from '../utils/money.js';
import {
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Copy,
  Receipt,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  Ban,
  FileText,
} from 'lucide-react';

interface ExpenseTableProps {
  expenses: ExpenseRecord[];
  allCategories: string[];
  onEditExpense: (expense: ExpenseRecord) => void;
  onDeleteExpense: (expenseId: string) => void;
  onDuplicateExpense: (expense: ExpenseRecord) => void;
  onAddNewManual: () => void;
  onViewReceipt: (expense: ExpenseRecord) => void;
  currency?: string;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  allCategories,
  onEditExpense,
  onDeleteExpense,
  onDuplicateExpense,
  onAddNewManual,
  onViewReceipt,
  currency = 'USD',
}) => {
  const [filterOptions, setFilterOptions] = useState<ExpenseFilterOptions>({
    searchQuery: '',
    category: 'all',
    reimbursementStatus: 'all',
    sortBy: 'date',
    sortDirection: 'desc',
  });

  const handleSort = (field: ExpenseFilterOptions['sortBy']) => {
    setFilterOptions((prev) => {
      if (prev.sortBy === field) {
        return {
          ...prev,
          sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        ...prev,
        sortBy: field,
        sortDirection: 'desc',
      };
    });
  };

  // Filter and sort items
  const filteredExpenses = expenses.filter((e) => {
    if (filterOptions.searchQuery) {
      const q = filterOptions.searchQuery.toLowerCase();
      const matchMerchant = e.merchant.toLowerCase().includes(q);
      const matchDesc = e.description.toLowerCase().includes(q);
      const matchNotes = e.notes ? e.notes.toLowerCase().includes(q) : false;
      const matchCategory = e.category.toLowerCase().includes(q);
      if (!matchMerchant && !matchDesc && !matchNotes && !matchCategory) return false;
    }

    if (filterOptions.category && filterOptions.category !== 'all') {
      if (e.category !== filterOptions.category) return false;
    }

    if (filterOptions.reimbursementStatus && filterOptions.reimbursementStatus !== 'all') {
      if (e.reimbursementStatus !== filterOptions.reimbursementStatus) return false;
    }

    return true;
  });

  filteredExpenses.sort((a, b) => {
    const dir = filterOptions.sortDirection === 'asc' ? 1 : -1;
    switch (filterOptions.sortBy) {
      case 'amount':
        return (a.amount - b.amount) * dir;
      case 'merchant':
        return a.merchant.localeCompare(b.merchant) * dir;
      case 'category':
        return a.category.localeCompare(b.category) * dir;
      case 'date':
      default:
        return ((a.date || '').localeCompare(b.date || '') || a.createdAt.localeCompare(b.createdAt)) * dir;
    }
  });

  const getStatusBadge = (status: ReimbursementStatus) => {
    switch (status) {
      case 'reimbursed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <CheckCircle className="w-3 h-3" /> Reimbursed
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <Clock className="w-3 h-3" /> Submitted
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Pending
          </span>
        );
      case 'non_reimbursable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <Ban className="w-3 h-3" /> Non-Reimbursable
          </span>
        );
    }
  };

  return (
    <div id="expense-table-card" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs overflow-hidden">
      {/* Table Action and Filter Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              id="expense-search-input"
              value={filterOptions.searchQuery}
              onChange={(e) => setFilterOptions({ ...filterOptions, searchQuery: e.target.value })}
              placeholder="Search payee, desc, or notes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <select
            id="expense-category-filter"
            value={filterOptions.category}
            onChange={(e) => setFilterOptions({ ...filterOptions, category: e.target.value })}
            className="text-xs py-1.5 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            id="expense-status-filter"
            value={filterOptions.reimbursementStatus}
            onChange={(e) =>
              setFilterOptions({
                ...filterOptions,
                reimbursementStatus: e.target.value as ReimbursementStatus | 'all',
              })
            }
            className="text-xs py-1.5 px-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="reimbursed">Reimbursed</option>
            <option value="non_reimbursable">Non-Reimbursable</option>
          </select>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            id="btn-manual-add-expense"
            onClick={onAddNewManual}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Add</span>
          </button>
        </div>
      </div>

      {/* Dense Expense Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th
                onClick={() => handleSort('date')}
                className="py-2.5 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('merchant')}
                className="py-2.5 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                <div className="flex items-center gap-1">
                  <span>Payee / Merchant</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-3">Description</th>
              <th
                onClick={() => handleSort('category')}
                className="py-2.5 px-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Total</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right">Reimbursable</th>
              <th className="py-2.5 px-3 text-right">Personal</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Receipt</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                  No expenses match your filters. Type an expense above or click "Manual Add".
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr
                  key={exp.id}
                  id={`expense-row-${exp.id}`}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {exp.date}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {exp.merchant}
                  </td>
                  <td className="py-2.5 px-3 max-w-[200px] truncate text-zinc-600 dark:text-zinc-400">
                    <span title={exp.description}>{exp.description}</span>
                    {exp.calculation && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                        {exp.calculation.formulaId}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {formatCurrency(exp.amount, exp.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                    {formatCurrency(exp.reimbursableAmount, exp.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-500 whitespace-nowrap">
                    {exp.personalAmount > 0 ? formatCurrency(exp.personalAmount, exp.currency) : '—'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {getStatusBadge(exp.reimbursementStatus)}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {exp.receipt ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(exp)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Attached</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditExpense(exp)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                      >
                        + Attach
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicateExpense(exp)}
                        title="Duplicate"
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditExpense(exp)}
                        title="Edit"
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        title="Delete"
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer info */}
      <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Showing {filteredExpenses.length} of {expenses.length} records</span>
        <span className="font-mono">Decimal-safe ledger</span>
      </div>
    </div>
  );
};
