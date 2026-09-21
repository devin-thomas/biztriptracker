import { ExpenseRecord, TripRecord, DEFAULT_CATEGORIES } from '../types/expense.js';
import { neonClient } from '../services/neonClient.js';
import { IExpenseStorage } from './IExpenseStorage.js';

type TripRow = { id: string; name: string; destination: string; start_date: string; end_date: string; purpose: string | null; client_or_event: string | null; notes: string | null; settings: TripRecord['settings']; created_at: string; updated_at: string };
type ExpenseRow = { id: string; trip_id: string; date: string; merchant: string; description: string; category: string; amount: number; currency: string; payment_method: string; reimbursable_amount: number; personal_amount: number; reimbursement_status: ExpenseRecord['reimbursementStatus']; notes: string | null; receipt: ExpenseRecord['receipt'] | null; source: ExpenseRecord['source']; calculation: ExpenseRecord['calculation'] | null; created_at: string; updated_at: string };

function client() {
  if (!neonClient) throw new Error('Neon Auth and Data API are not configured.');
  return neonClient;
}

export class NeonExpenseStorage implements IExpenseStorage {
  async getAllTrips(): Promise<TripRecord[]> {
    const { data, error } = await client().from('trips').select('*').order('start_date', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data || []) as TripRow[]).map(this.fromTripRow);
  }

  async getTripById(id: string): Promise<TripRecord | null> {
    const { data, error } = await client().from('trips').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.fromTripRow(data as TripRow) : null;
  }

  async saveTrip(trip: TripRecord): Promise<void> {
    const { error } = await client().from('trips').upsert({ id: trip.id, name: trip.name, destination: trip.destination, start_date: trip.startDate, end_date: trip.endDate, purpose: trip.purpose ?? null, client_or_event: trip.clientOrEvent ?? null, notes: trip.notes ?? null, settings: trip.settings, created_at: trip.createdAt, updated_at: trip.updatedAt });
    if (error) throw new Error(error.message);
  }

  async deleteTrip(id: string): Promise<void> {
    const { error } = await client().from('trips').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getExpensesForTrip(tripId: string): Promise<ExpenseRecord[]> {
    const { data, error } = await client().from('expenses').select('*').eq('trip_id', tripId).order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data || []) as ExpenseRow[]).map(this.fromExpenseRow);
  }

  async getExpenseById(id: string): Promise<ExpenseRecord | null> {
    const { data, error } = await client().from('expenses').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? this.fromExpenseRow(data as ExpenseRow) : null;
  }

  async saveExpense(expense: ExpenseRecord): Promise<void> {
    const { error } = await client().from('expenses').upsert(this.toExpenseRow(expense));
    if (error) throw new Error(error.message);
  }

  async saveExpenses(expenses: ExpenseRecord[]): Promise<void> {
    if (expenses.length === 0) return;
    const { error } = await client().from('expenses').upsert(expenses.map((expense) => this.toExpenseRow(expense)));
    if (error) throw new Error(error.message);
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await client().from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteExpensesForTrip(tripId: string): Promise<void> {
    const { error } = await client().from('expenses').delete().eq('trip_id', tripId);
    if (error) throw new Error(error.message);
  }

  async getCustomCategories(): Promise<string[]> {
    const { data, error } = await client().from('categories').select('name').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data || []) as Array<{ name: string }>).map((category) => category.name);
  }

  async addCustomCategory(category: string): Promise<void> {
    const name = category.trim();
    if (!name || DEFAULT_CATEGORIES.includes(name)) return;
    const { error } = await client().from('categories').upsert({ name });
    if (error) throw new Error(error.message);
  }

  async exportAllData() {
    const trips = await this.getAllTrips();
    const expenses = (await Promise.all(trips.map((trip) => this.getExpensesForTrip(trip.id)))).flat();
    return { version: 1, exportedAt: new Date().toISOString(), trips, expenses, customCategories: await this.getCustomCategories() };
  }

  async importAllData(data: { trips: TripRecord[]; expenses: ExpenseRecord[]; customCategories?: string[] }): Promise<void> {
    for (const trip of data.trips) await this.saveTrip(trip);
    await this.saveExpenses(data.expenses);
    for (const category of data.customCategories || []) await this.addCustomCategory(category);
  }

  async removeLegacyDemoData(): Promise<void> {}

  async clearAllData(): Promise<void> {
    const trips = await this.getAllTrips();
    for (const trip of trips) await this.deleteTrip(trip.id);
    const { error } = await client().from('categories').delete().neq('name', '');
    if (error) throw new Error(error.message);
  }

  private fromTripRow(row: TripRow): TripRecord {
    return { id: row.id, name: row.name, destination: row.destination, startDate: row.start_date, endDate: row.end_date, purpose: row.purpose || undefined, clientOrEvent: row.client_or_event || undefined, notes: row.notes || undefined, settings: row.settings, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private fromExpenseRow(row: ExpenseRow): ExpenseRecord {
    return { id: row.id, tripId: row.trip_id, date: row.date, merchant: row.merchant, description: row.description, category: row.category, amount: Number(row.amount), currency: row.currency, paymentMethod: row.payment_method, reimbursableAmount: Number(row.reimbursable_amount), personalAmount: Number(row.personal_amount), reimbursementStatus: row.reimbursement_status, notes: row.notes || undefined, receipt: row.receipt || undefined, source: row.source, calculation: row.calculation || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private toExpenseRow(expense: ExpenseRecord) {
    return { id: expense.id, trip_id: expense.tripId, date: expense.date, merchant: expense.merchant, description: expense.description, category: expense.category, amount: expense.amount, currency: expense.currency, payment_method: expense.paymentMethod, reimbursable_amount: expense.reimbursableAmount, personal_amount: expense.personalAmount, reimbursement_status: expense.reimbursementStatus, notes: expense.notes ?? null, receipt: expense.receipt ?? null, source: expense.source, calculation: expense.calculation ?? null, created_at: expense.createdAt, updated_at: expense.updatedAt };
  }
}

export const expenseStorage = new NeonExpenseStorage();
