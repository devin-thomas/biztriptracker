# Trip Expense Tracker (V1)

A fast, decimal-safe business trip expense recording and reconciliation web application built with React, TypeScript, Vite, Tailwind CSS, and Gemini AI.

## Quick Start & Local Setup

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or bun

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `GEMINI_API_KEY` is populated with a valid Google Gemini API key:
```env
GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Install & Run
```bash
# Install dependencies
npm install

# Start development server (Express backend + Vite client)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
npm start
```

---

## Architectural Separation

The codebase is organized into isolated, decoupled modules:

- **Domain Models (`src/types/expense.ts`)**: Pure TypeScript contracts for `TripRecord`, `ExpenseRecord`, `TripTotals`, categories, and calculation metadata. No framework coupling.
- **Financial Precision (`src/utils/money.ts`)**: `DecimalMoney` utility class using integer cents arithmetic to completely eliminate IEEE-754 floating-point inaccuracies.
- **Derived Calculation Engine (`src/calculations/calculator.ts`)**: Reusable formula executor (Miles/MPG fuel consumption, IRS standard mileage reimbursement, per diem). Preserves input parameters for auditable expense records.
- **Storage Abstraction (`src/storage/IExpenseStorage.ts` & `src/storage/IndexedDbExpenseStorage.ts`)**: Repository interface with a browser-local IndexedDB implementation. Can be replaced with SQLite, Supabase, or Firestore without touching UI components.
- **Gemini AI Service (`src/ai/`)**:
  - `expensePrompt.ts`: System instructions, extraction schemas, and TypeScript response contracts.
  - `IExpenseParser.ts`: Service boundary interface.
  - `GeminiExpenseParser.ts`: Client implementation querying `/api/expenses/parse`.
  - `server.ts`: Secure backend API proxying Gemini calls with structured JSON Schema output (`responseSchema` & `responseMimeType: "application/json"`).
- **Import/Export (`src/importExport/expenseExporter.ts`)**: Portability module generating RFC 4180 CSV files and JSON schema backups with import validation.
- **Google Sheets Integration (`src/services/googleSheets.ts` & `src/services/googleAuth.ts`)**: Direct Google Sheets API integration exporting itemized reconciliation reports with frozen header rows.
- **UI Components (`src/components/`)**:
  - `ConversationalBox.tsx`: Fast natural-language expense parser with draft editing and ambiguity identification.
  - `TripTotalsBar.tsx`: Trip metrics (Total, Reimbursable, Personal, Reimbursed, Outstanding).
  - `ExpenseTable.tsx`: Compact ledger with search, filtering, sorting, and action controls.
  - `ExpenseModal.tsx`: Manual record entry fallback and split editor.
  - `TripModal.tsx`: Trip creation and travel policy settings.
  - `ExportModal.tsx`: Sheets export, CSV download, and JSON backup/restore.
  - `ReceiptViewerModal.tsx`: Receipt attachment viewer.

---

## Expense Data Model

Each recorded expense supports:
```typescript
export interface ExpenseRecord {
  id: string;
  tripId: string;
  date: string; // ISO YYYY-MM-DD
  merchant: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod | string;
  reimbursableAmount: number;
  personalAmount: number;
  reimbursementStatus: 'pending' | 'submitted' | 'reimbursed' | 'non_reimbursable';
  notes?: string;
  receipt?: ReceiptReference;
  source: 'manual' | 'ai_chat' | 'import' | 'calculated';
  calculation?: CalculationInput;
  createdAt: string;
  updatedAt: string;
}
```

## Conversational Entry Examples Supported
- *"Hotel was $112.10"*
- *"Paid 15.24 for parking"*
- *"Drove 575 miles and I expense fuel assuming 35 mpg, gas was 2.79 a gallon"*
- *"Lunch yesterday at Whataburger was $14.63 on my Amex"*
- *"Split that dinner: 32.50 reimbursable and 12 personal"*
- *"Actually change the parking expense to 18.50"*
