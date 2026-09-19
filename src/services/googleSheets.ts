import { TripRecord, ExpenseRecord } from '../types/expense.js';
import { computeTripTotals } from '../storage/IExpenseStorage.js';

export class GoogleSheetsService {
  /**
   * Creates a new Google Spreadsheet and appends trip expense rows + summary
   */
  static async exportTripToGoogleSheet(
    accessToken: string,
    trip: TripRecord,
    expenses: ExpenseRecord[]
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const totals = computeTripTotals(expenses);

    // 1. Create a spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `Trip Expenses - ${trip.name} (${trip.destination})`,
        },
        sheets: [
          {
            properties: {
              title: 'Expense Report',
              gridProperties: {
                frozenRowCount: 6,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create Google Sheet: ${createRes.statusText}`);
    }

    const createdData = await createRes.json();
    const spreadsheetId = createdData.spreadsheetId;
    const spreadsheetUrl = createdData.spreadsheetUrl;

    // 2. Format values
    const values: any[][] = [
      ['TRIP EXPENSE RECONCILIATION REPORT', '', '', '', '', '', '', ''],
      ['Trip Name:', trip.name, '', 'Destination:', trip.destination, '', 'Dates:', `${trip.startDate} to ${trip.endDate}`],
      ['Total Expenses:', `$${totals.totalExpenses.toFixed(2)}`, '', 'Reimbursable:', `$${totals.reimbursableTotal.toFixed(2)}`, '', 'Personal:', `$${totals.personalTotal.toFixed(2)}`],
      ['Reimbursed:', `$${totals.reimbursedTotal.toFixed(2)}`, '', 'Outstanding:', `$${totals.outstandingReimbursement.toFixed(2)}`, '', 'Expense Count:', expenses.length],
      [''],
      [
        'Date',
        'Merchant',
        'Description',
        'Category',
        'Amount',
        'Reimbursable',
        'Personal',
        'Payment Method',
        'Status',
        'Source',
        'Calculation Details',
        'Notes',
      ],
    ];

    for (const e of expenses) {
      values.push([
        e.date,
        e.merchant,
        e.description,
        e.category,
        e.amount,
        e.reimbursableAmount,
        e.personalAmount,
        e.paymentMethod,
        e.reimbursementStatus,
        e.source,
        e.calculation?.summary || '',
        e.notes || '',
      ]);
    }

    // 3. Append values to Sheet
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Expense Report'!A1:L${values.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'Expense Report'!A1:L${values.length}`,
          majorDimension: 'ROWS',
          values,
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to populate Google Sheet: ${updateRes.statusText}`);
    }

    return { spreadsheetId, spreadsheetUrl };
  }
}
