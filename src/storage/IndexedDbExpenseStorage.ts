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

  // --- DATA PORTABILITY & SEEDING ---

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

  async clearDemoData(): Promise<void> {
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

  async seedDemoData(): Promise<{ trip: TripRecord; expenses: ExpenseRecord[] }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const demoTrip: TripRecord = {
      id: 'trip-chicago-q3',
      name: 'Q3 Client Summit & Onsite',
      destination: 'Chicago, IL',
      startDate: pastDate,
      endDate: futureDate,
      purpose: 'Annual Partner Review & Engineering Architecture Onsite',
      clientOrEvent: 'Apex Corp Partner Day',
      notes: 'Company policy: Meals capped at $75/day. Keep all receipts over $25.',
      settings: {
        defaultCurrency: 'USD',
        defaultPaymentMethod: 'corporate_card',
        mileageRatePerMile: 0.67,
        perDiemRatePerDay: 75.0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const demoExpenses: ExpenseRecord[] = [
      {
        id: 'exp-demo-1',
        tripId: demoTrip.id,
        date: pastDate,
        merchant: 'Hyatt Regency Chicago',
        description: 'Hotel room for 2 nights (Tax & fees included)',
        category: 'Lodging',
        amount: 342.8,
        currency: 'USD',
        paymentMethod: 'corporate_card',
        reimbursableAmount: 342.8,
        personalAmount: 0,
        reimbursementStatus: 'submitted',
        notes: 'Reservation #HY-99201',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp-demo-2',
        tripId: demoTrip.id,
        date: pastDate,
        merchant: 'O\'Hare International Airport',
        description: 'Terminal 3 long-term parking (Day 1-2)',
        category: 'Parking',
        amount: 38.5,
        currency: 'USD',
        paymentMethod: 'corporate_card',
        reimbursableAmount: 38.5,
        personalAmount: 0,
        reimbursementStatus: 'submitted',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp-demo-3',
        tripId: demoTrip.id,
        date: today,
        merchant: 'Whataburger',
        description: 'Lunch on travel day',
        category: 'Meals',
        amount: 14.63,
        currency: 'USD',
        paymentMethod: 'amex',
        reimbursableAmount: 14.63,
        personalAmount: 0,
        reimbursementStatus: 'pending',
        notes: 'Combo #2 with iced tea',
        source: 'ai_chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp-demo-4',
        tripId: demoTrip.id,
        date: today,
        merchant: 'The Capital Grille',
        description: 'Team dinner with client team (Partial personal split)',
        category: 'Meals',
        amount: 148.5,
        currency: 'USD',
        paymentMethod: 'personal_card',
        reimbursableAmount: 112.5,
        personalAmount: 36.0,
        reimbursementStatus: 'pending',
        notes: 'Alcoholic drinks ($36.00) kept as personal expense per company handbook.',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp-demo-5',
        tripId: demoTrip.id,
        date: today,
        merchant: 'Fuel Calculation',
        description: 'Fuel for 575 miles (16.4 gal @ $2.79/gal)',
        category: 'Fuel',
        amount: 45.84,
        currency: 'USD',
        paymentMethod: 'personal_card',
        reimbursableAmount: 45.84,
        personalAmount: 0,
        reimbursementStatus: 'pending',
        source: 'calculated',
        calculation: {
          formulaId: 'fuel_mpg',
          formulaLabel: 'Fuel Consumption (Miles / MPG × Price)',
          parameters: {
            miles: 575,
            mpg: 35,
            pricePerGallon: 2.79,
            gallonsUsed: 16.43,
          },
          summary: '575 mi @ 35 mpg (~16.4 gal) × $2.79/gal',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    await this.saveTrip(demoTrip);
    await this.saveExpenses(demoExpenses);

    return { trip: demoTrip, expenses: demoExpenses };
  }
}

// Singleton repository instance
export const expenseStorage = new IndexedDbExpenseStorage();
