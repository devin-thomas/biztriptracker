import { ExpenseRecord, TripRecord } from '../types/expense.js';
import { formatCurrency } from '../utils/money.js';

export interface ExportDataPayload {
  version: number;
  exportedAt: string;
  trip: TripRecord;
  expenses: ExpenseRecord[];
}

/**
 * Cleanly escapes CSV fields according to RFC 4180
 */
function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export class ExpenseExporter {
  /**
   * Generates a clean, professional CSV report for a trip and its expenses
   */
  static generateTripCsv(trip: TripRecord, expenses: ExpenseRecord[]): string {
    const headers = [
      'Expense ID',
      'Date',
      'Merchant / Payee',
      'Description',
      'Category',
      'Total Amount',
      'Currency',
      'Reimbursable Amount',
      'Personal Amount',
      'Payment Method',
      'Reimbursement Status',
      'Source',
      'Calculation Summary',
      'Notes',
      'Has Receipt',
    ];

    const rows: string[] = [];

    // Header comment block with trip metadata
    rows.push(`# Trip: ${trip.name} (${trip.destination})`);
    rows.push(`# Dates: ${trip.startDate} to ${trip.endDate}`);
    if (trip.purpose) rows.push(`# Purpose: ${trip.purpose}`);
    if (trip.clientOrEvent) rows.push(`# Client / Event: ${trip.clientOrEvent}`);
    rows.push('');

    // Column headers
    rows.push(headers.map(h => escapeCsvField(h)).join(','));

    for (const exp of expenses) {
      const row = [
        exp.id,
        exp.date,
        exp.merchant,
        exp.description,
        exp.category,
        exp.amount.toFixed(2),
        exp.currency,
        exp.reimbursableAmount.toFixed(2),
        exp.personalAmount.toFixed(2),
        exp.paymentMethod,
        exp.reimbursementStatus,
        exp.source,
        exp.calculation ? exp.calculation.summary : '',
        exp.notes || '',
        exp.receipt ? 'Yes' : 'No',
      ];
      rows.push(row.map(escapeCsvField).join(','));
    }

    return rows.join('\r\n');
  }

  /**
   * Generates formatted JSON data for trip backup or machine consumption
   */
  static generateTripJson(trip: TripRecord, expenses: ExpenseRecord[]): string {
    const payload: ExportDataPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      trip,
      expenses,
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Triggers browser download of a text blob
   */
  static downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates imported JSON payload and checks data integrity
   */
  static validateImportJson(raw: string): {
    valid: boolean;
    trip?: TripRecord;
    expenses?: ExpenseRecord[];
    trips?: TripRecord[];
    error?: string;
  } {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'File is not a valid JSON object.' };
      }

      // Check if it is a single-trip export
      if (parsed.trip && typeof parsed.trip.id === 'string' && Array.isArray(parsed.expenses)) {
        return {
          valid: true,
          trip: parsed.trip,
          expenses: parsed.expenses,
        };
      }

      // Check if it is a full repository backup
      if (Array.isArray(parsed.trips) && Array.isArray(parsed.expenses)) {
        return {
          valid: true,
          trips: parsed.trips,
          expenses: parsed.expenses,
        };
      }

      return {
        valid: false,
        error: 'JSON structure does not match expected trip or expense schema.',
      };
    } catch (err: any) {
      return { valid: false, error: `JSON Parse error: ${err.message || 'Invalid syntax'}` };
    }
  }
}
