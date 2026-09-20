import { IExpenseStorage, computeTripTotals } from './IExpenseStorage.js';
import { TripRecord, ExpenseRecord, DEFAULT_CATEGORIES } from '../types/expense.js';

const DB_NAME = 'BizTripExpenseTrackerDB';
const DB_VERSION = 1;

const STORES = {
  TRIPS: 'trips',
  EXPENSES: 'expenses',
  CATEGORIES: 'categories',
  METADATA: 'metadata',
};

// These IDs were used only by the old demo fixture. Keep the migration narrow
// so existing real trips and expenses are never removed.
const LEGACY_DEMO_TRIP_ID = 'trip-chicago-q3';
const LEGACY_DEMO_EXPENSE_IDS = [
  'exp-demo-1',
  'exp-demo-2',
  'exp-demo-3',
  'exp-demo-4',
  'exp-demo-5',
];

export class IndexedDbExpenseStorage implements IExpenseStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.TRIPS)) {
          db.createObjectStore(STORES.TRIPS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
          const expenseStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
          expenseStore.createIndex('by_trip', 'tripId', { unique: false });
          expenseStore.createIndex('by_date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'name' });
        }

        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });

    return this.dbPromise;
  }

  // --- TRIPS ---

  async getAllTrips(): Promise<TripRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRIPS, 'readonly');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.getAll();
      req.onsuccess = () => {
        const trips: TripRecord[] = req.result || [];
        // Sort trips newest first
        trips.sort((a, b) => b.startDate.localeCompare(a.startDate));
        resolve(trips);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getTripById(id: string): Promise<TripRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRIPS, 'readonly');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveTrip(trip: TripRecord): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRIPS, 'readwrite');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.put(trip);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTrip(id: string): Promise<void> {
    const db = await this.getDb();
    // Delete trip and its expenses
    await this.deleteExpensesForTrip(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRIPS, 'readwrite');
      const store = tx.objectStore(STORES.TRIPS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- EXPENSES ---

  async getExpensesForTrip(tripId: string): Promise<ExpenseRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readonly');
      const store = tx.objectStore(STORES.EXPENSES);
      const index = store.index('by_trip');
      const req = index.getAll(tripId);
      req.onsuccess = () => {
        const expenses: ExpenseRecord[] = req.result || [];
        // Default sort by date desc
        expenses.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
        resolve(expenses);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getExpenseById(id: string): Promise<ExpenseRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readonly');
      const store = tx.objectStore(STORES.EXPENSES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveExpense(expense: ExpenseRecord): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readwrite');
      const store = tx.objectStore(STORES.EXPENSES);
      const req = store.put(expense);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveExpenses(expenses: ExpenseRecord[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readwrite');
      const store = tx.objectStore(STORES.EXPENSES);
      for (const item of expenses) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteExpense(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readwrite');
      const store = tx.objectStore(STORES.EXPENSES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteExpensesForTrip(tripId: string): Promise<void> {
    const expenses = await this.getExpensesForTrip(tripId);
    if (expenses.length === 0) return;
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readwrite');
      const store = tx.objectStore(STORES.EXPENSES);
      for (const e of expenses) {
        store.delete(e.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- CATEGORIES ---

  async getCustomCategories(): Promise<string[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, 'readonly');
      const store = tx.objectStore(STORES.CATEGORIES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as { name: string }[];
        resolve(items.map((i) => i.name));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addCustomCategory(category: string): Promise<void> {
    const trimmed = category.trim();
    if (!trimmed) return;
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, 'readwrite');
      const store = tx.objectStore(STORES.CATEGORIES);
      const req = store.put({ name: trimmed });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- DATA PORTABILITY ---

  async exportAllData(): Promise<{
    version: number;
    exportedAt: string;
    trips: TripRecord[];
    expenses: ExpenseRecord[];
    customCategories: string[];
  }> {
    const trips = await this.getAllTrips();
    const db = await this.getDb();
    const expenses = await new Promise<ExpenseRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readonly');
      const store = tx.objectStore(STORES.EXPENSES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const customCategories = await this.getCustomCategories();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      trips,
      expenses,
      customCategories,
    };
  }

  async importAllData(data: {
    trips: TripRecord[];
    expenses: ExpenseRecord[];
    customCategories?: string[];
  }): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.TRIPS, STORES.EXPENSES, STORES.CATEGORIES],
        'readwrite'
      );
      const tripStore = tx.objectStore(STORES.TRIPS);
      const expStore = tx.objectStore(STORES.EXPENSES);
      const catStore = tx.objectStore(STORES.CATEGORIES);

      if (data.trips && Array.isArray(data.trips)) {
        for (const trip of data.trips) {
          tripStore.put(trip);
        }
      }

      if (data.expenses && Array.isArray(data.expenses)) {
        for (const exp of data.expenses) {
          expStore.put(exp);
        }
      }

      if (data.customCategories && Array.isArray(data.customCategories)) {
        for (const cat of data.customCategories) {
          catStore.put({ name: cat });
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.TRIPS, STORES.EXPENSES, STORES.CATEGORIES],
        'readwrite'
      );
      tx.objectStore(STORES.TRIPS).clear();
      tx.objectStore(STORES.EXPENSES).clear();
      tx.objectStore(STORES.CATEGORIES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeLegacyDemoData(): Promise<void> {
    const legacyTrip = await this.getTripById(LEGACY_DEMO_TRIP_ID);
    if (legacyTrip) {
      await this.deleteTrip(LEGACY_DEMO_TRIP_ID);
    }

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EXPENSES, 'readwrite');
      const store = tx.objectStore(STORES.EXPENSES);
      for (const expenseId of LEGACY_DEMO_EXPENSE_IDS) {
        store.delete(expenseId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton repository instance
export const expenseStorage = new IndexedDbExpenseStorage();
