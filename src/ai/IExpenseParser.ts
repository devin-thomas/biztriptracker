import { TripRecord, ExpenseRecord } from '../types/expense.js';
import { ParseExpenseResponse } from './expensePrompt.js';

export interface ParseExpenseRequest {
  message: string;
  trip: TripRecord;
  existingExpenses: ExpenseRecord[];
  customCategories: string[];
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

export interface IExpenseParser {
  parseExpenseMessage(request: ParseExpenseRequest): Promise<ParseExpenseResponse>;
}
