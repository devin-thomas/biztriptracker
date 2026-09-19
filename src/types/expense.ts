import { DecimalMoney } from '../utils/money.js';

export type ExpenseSource = 'manual' | 'ai_chat' | 'import' | 'calculated';

export type ReimbursementStatus = 'pending' | 'submitted' | 'reimbursed' | 'non_reimbursable';

export type PaymentMethod = 
  | 'corporate_card' 
  | 'personal_card' 
  | 'amex' 
  | 'visa' 
  | 'mastercard' 
  | 'cash' 
  | 'bank_transfer' 
  | 'other';

export interface CalculationInput {
  formulaId: 'fuel_mpg' | 'standard_mileage' | 'per_diem' | 'custom_split';
  formulaLabel: string;
  parameters: Record<string, number | string>;
  summary: string;
}

export interface ReceiptReference {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl?: string; // Stored in IndexedDB
  uploadedAt: string;
}

export interface ExpenseRecord {
  id: string;
  tripId: string;
  date: string; // ISO YYYY-MM-DD
  merchant: string;
  description: string;
  category: string;
  amount: number; // Stored as standard decimal number (e.g. 14.63)
  currency: string;
  paymentMethod: PaymentMethod | string;
  reimbursableAmount: number;
  personalAmount: number;
  reimbursementStatus: ReimbursementStatus;
  notes?: string;
  receipt?: ReceiptReference;
  source: ExpenseSource;
  calculation?: CalculationInput;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface TripSettings {
  defaultCurrency: string;
  defaultPaymentMethod?: string;
  mileageRatePerMile?: number; // e.g. 0.67 IRS rate
  perDiemRatePerDay?: number;
}

export interface TripRecord {
  id: string;
  name: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  purpose?: string;
  clientOrEvent?: string;
  notes?: string;
  settings: TripSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TripTotals {
  totalExpenses: DecimalMoney;
  reimbursableTotal: DecimalMoney;
  personalTotal: DecimalMoney;
  reimbursedTotal: DecimalMoney;
  outstandingReimbursement: DecimalMoney;
  expenseCount: number;
  categoryTotals: Record<string, DecimalMoney>;
}

export const DEFAULT_CATEGORIES: string[] = [
  'Lodging',
  'Transportation',
  'Fuel',
  'Mileage',
  'Parking',
  'Tolls',
  'Meals',
  'Airfare',
  'Rideshare',
  'Supplies',
  'Entertainment',
  'Other',
];

export interface ExpenseFilterOptions {
  searchQuery?: string;
  category?: string;
  reimbursementStatus?: ReimbursementStatus | 'all';
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'amount' | 'merchant' | 'category' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
}
