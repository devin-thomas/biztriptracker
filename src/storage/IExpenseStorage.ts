import { TripRecord, ExpenseRecord, TripTotals } from '../types/expense.js';
import { DecimalMoney } from '../utils/money.js';

export interface IExpenseStorage {
  // Trips
  getAllTrips(): Promise<TripRecord[]>;
  getTripById(id: string): Promise<TripRecord | null>;
  saveTrip(trip: TripRecord): Promise<void>;
  deleteTrip(id: string): Promise<void>;

  // Expenses
  getExpensesForTrip(tripId: string): Promise<ExpenseRecord[]>;
  getExpenseById(id: string): Promise<ExpenseRecord | null>;
  saveExpense(expense: ExpenseRecord): Promise<void>;
  saveExpenses(expenses: ExpenseRecord[]): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  deleteExpensesForTrip(tripId: string): Promise<void>;

  // Categories (extensible)
  getCustomCategories(): Promise<string[]>;
  addCustomCategory(category: string): Promise<void>;

  // Full state import/export
  exportAllData(): Promise<{
    version: number;
    exportedAt: string;
    trips: TripRecord[];
    expenses: ExpenseRecord[];
    customCategories: string[];
  }>;
  importAllData(data: {
    trips: TripRecord[];
    expenses: ExpenseRecord[];
    customCategories?: string[];
  }): Promise<void>;
  clearDemoData(): Promise<void>;
  seedDemoData(): Promise<{ trip: TripRecord; expenses: ExpenseRecord[] }>;
}

export function computeTripTotals(expenses: ExpenseRecord[]): TripTotals {
  let totalExpenses = DecimalMoney.zero();
  let reimbursableTotal = DecimalMoney.zero();
  let personalTotal = DecimalMoney.zero();
  let reimbursedTotal = DecimalMoney.zero();
  let outstandingReimbursement = DecimalMoney.zero();
  const categoryTotals: Record<string, DecimalMoney> = {};

  for (const exp of expenses) {
    const amt = DecimalMoney.fromNumber(exp.amount);
    const reimb = DecimalMoney.fromNumber(exp.reimbursableAmount);
    const pers = DecimalMoney.fromNumber(exp.personalAmount);

    totalExpenses = totalExpenses.add(amt);
    reimbursableTotal = reimbursableTotal.add(reimb);
    personalTotal = personalTotal.add(pers);

    if (exp.reimbursementStatus === 'reimbursed') {
      reimbursedTotal = reimbursedTotal.add(reimb);
    } else if (exp.reimbursementStatus === 'pending' || exp.reimbursementStatus === 'submitted') {
      outstandingReimbursement = outstandingReimbursement.add(reimb);
    }

    const cat = exp.category || 'Other';
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = DecimalMoney.zero();
    }
    categoryTotals[cat] = categoryTotals[cat].add(amt);
  }

  return {
    totalExpenses,
    reimbursableTotal,
    personalTotal,
    reimbursedTotal,
    outstandingReimbursement,
    expenseCount: expenses.length,
    categoryTotals,
  };
}
