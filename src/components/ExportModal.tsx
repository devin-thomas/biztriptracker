import React, { useState } from 'react';
import { TripRecord, ExpenseRecord } from '../types/expense.js';
import { ExpenseExporter } from '../importExport/expenseExporter.js';
import { GoogleSheetsService } from '../services/googleSheets.js';
import { googleSignIn, getAccessToken, logout } from '../services/googleAuth.js';
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripRecord;
  expenses: ExpenseRecord[];
  allTrips: TripRecord[];
  onImportSuccess: () => Promise<void>;
  onClearAllData: () => Promise<void>;
  currentUser: User | null;
  onUserChanged: (user: User | null) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  trip,
  expenses,
  allTrips,
  onImportSuccess,
  onClearAllData,
  currentUser,
  onUserChanged,
}) => {
  if (!isOpen) return null;

  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sheetResult, setSheetResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // CSV Export
  const handleExportCsv = () => {
    try {
      const csv = ExpenseExporter.generateTripCsv(trip, expenses);
      const fileName = `Trip_Expenses_${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_${trip.startDate}.csv`;
      ExpenseExporter.downloadFile(csv, fileName, 'text/csv');
    } catch (err: any) {
      setError(`CSV Export failed: ${err.message}`);
    }
  };

  // JSON Export (Trip or Full)
  const handleExportJson = () => {
    try {
      const json = ExpenseExporter.generateTripJson(trip, expenses);
      const fileName = `Trip_Backup_${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      ExpenseExporter.downloadFile(json, fileName, 'application/json');
    } catch (err: any) {
      setError(`JSON Export failed: ${err.message}`);
    }
  };

  // Google Sheets Export
  const handleExportGoogleSheets = async () => {
    setIsExportingSheets(true);
    setError(null);
    setSheetResult(null);

    try {
      let token = await getAccessToken();

      if (!token) {
        // Trigger Google Sign-In with popup
        const authRes = await googleSignIn();
        if (!authRes?.accessToken) {
          throw new Error('Sign-in cancelled or failed to retrieve access token.');
        }
        token = authRes.accessToken;
        onUserChanged(authRes.user);
      }

      const result = await GoogleSheetsService.exportTripToGoogleSheet(token, trip, expenses);
      setSheetResult({ url: result.spreadsheetUrl });
    } catch (err: any) {
      setError(err.message || 'Google Sheets export failed. Please check your network and authorization.');
    } finally {
      setIsExportingSheets(false);
    }
  };

  // JSON File Import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result as string;
        const validation = ExpenseExporter.validateImportJson(content);
        if (!validation.valid) {
          setError(validation.error || 'Invalid file contents.');
          setIsImporting(false);
          return;
        }

        const { expenseStorage } = await import('../storage/NeonExpenseStorage.js');
        if (validation.trip && validation.expenses) {
          await expenseStorage.saveTrip(validation.trip);
          await expenseStorage.saveExpenses(validation.expenses);
          setImportStatus(`Successfully imported trip "${validation.trip.name}" with ${validation.expenses.length} expenses!`);
        } else if (validation.trips && validation.expenses) {
          await expenseStorage.importAllData({
            trips: validation.trips,
            expenses: validation.expenses,
          });
          setImportStatus(`Successfully restored ${validation.trips.length} trips and ${validation.expenses.length} expenses!`);
        }

        await onImportSuccess();
      } catch (err: any) {
        setError(`Failed to import data: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="export-modal-dialog"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
      >
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Data Portability & Reconciliation Exports
            </h2>
            <p className="text-[11px] text-zinc-500">
              Trip: {trip.name} ({expenses.length} records)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {importStatus && (
            <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importStatus}</span>
            </div>
          )}

          {/* Export Options Grid */}
          <div className="space-y-2.5">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
              Export Formats
            </span>

            {/* Google Sheets Export */}
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Google Sheets Export</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Creates an itemized reconciliation spreadsheet with frozen headers and financial formulas.
                </p>
                {currentUser && (
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    Connected as: {currentUser.email}
                  </span>
                )}
              </div>
              <button
                type="button"
                id="btn-export-google-sheets"
                onClick={handleExportGoogleSheets}
                disabled={isExportingSheets}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isExportingSheets ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Sheet</span>
                  </>
                )}
              </button>
            </div>

            {sheetResult && (
              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                  Spreadsheet created successfully!
                </span>
                <a
                  href={sheetResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 underline"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* CSV Export */}
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Standard CSV Export (Excel / Numbers)</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  RFC 4180 compliant comma-separated file with full receipt, split, and formula details.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-csv"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>

            {/* JSON Export */}
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-600" />
                  <span>Full JSON Backup</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Machine-readable JSON schema preserving metadata, formulas, and receipt data.
                </p>
              </div>
              <button
                type="button"
                id="btn-export-json"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
              Restore / Import Data
            </span>
            <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
              <div className="text-zinc-500">
                <span>Select a previously exported JSON backup file</span>
              </div>
              <label className="cursor-pointer px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{isImporting ? 'Reading...' : 'Import JSON'}</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleFileImport}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Clean / Reset Demo Data */}
          <div className="pt-2 flex justify-between items-center text-[11px] text-zinc-400">
            <span>Local IndexedDB durability</span>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Clear all trips, expenses, and local categories from this browser?')) {
                  await onClearAllData();
                  onClose();
                }
              }}
              className="text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear all local data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
