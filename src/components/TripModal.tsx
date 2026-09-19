import React, { useState } from 'react';
import { TripRecord } from '../types/expense.js';
import { X, Calendar, MapPin, Briefcase, FileText } from 'lucide-react';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trip: TripRecord) => Promise<void>;
  initialTrip?: TripRecord | null;
}

export const TripModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTrip,
}) => {
  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState(initialTrip?.name || '');
  const [destination, setDestination] = useState(initialTrip?.destination || '');
  const [startDate, setStartDate] = useState(initialTrip?.startDate || today);
  const [endDate, setEndDate] = useState(initialTrip?.endDate || today);
  const [purpose, setPurpose] = useState(initialTrip?.purpose || '');
  const [clientOrEvent, setClientOrEvent] = useState(initialTrip?.clientOrEvent || '');
  const [notes, setNotes] = useState(initialTrip?.notes || '');
  const [defaultCurrency, setDefaultCurrency] = useState(initialTrip?.settings?.defaultCurrency || 'USD');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(initialTrip?.settings?.defaultPaymentMethod || 'corporate_card');
  const [mileageRate, setMileageRate] = useState<number>(initialTrip?.settings?.mileageRatePerMile || 0.67);
  const [perDiemRate, setPerDiemRate] = useState<number>(initialTrip?.settings?.perDiemRatePerDay || 75);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Trip name is required.');
      return;
    }
    if (!destination.trim()) {
      setError('Destination is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const trip: TripRecord = {
      id: initialTrip?.id || `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      purpose: purpose.trim() || undefined,
      clientOrEvent: clientOrEvent.trim() || undefined,
      notes: notes.trim() || undefined,
      settings: {
        defaultCurrency,
        defaultPaymentMethod,
        mileageRatePerMile: mileageRate,
        perDiemRatePerDay: perDiemRate,
      },
      createdAt: initialTrip?.createdAt || now,
      updatedAt: now,
    };

    try {
      await onSave(trip);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="trip-modal-dialog"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {initialTrip ? 'Edit Trip Settings' : 'Create New Business Trip'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-500 mb-1 font-medium">Trip Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 EMEA Partner Summit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-zinc-500 mb-1 font-medium">Destination *</label>
            <input
              type="text"
              required
              placeholder="e.g. London, UK or Seattle, WA"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Client / Event</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp, AWS Summit"
                value={clientOrEvent}
                onChange={(e) => setClientOrEvent(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1 font-medium">Business Purpose</label>
              <input
                type="text"
                placeholder="e.g. Sales Onsite, Customer Training"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Reimbursement & Calculation policies */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded border border-zinc-200 dark:border-zinc-700 space-y-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
              Trip Reimbursement Settings
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-0.5">Default Currency</label>
                <select
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-0.5">IRS Mileage Rate ($/mi)</label>
                <input
                  type="number"
                  step="0.01"
                  value={mileageRate}
                  onChange={(e) => setMileageRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1 font-medium">Notes & Travel Policies</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Meals capped at $75/day. Hotel room rate max $250."
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 font-medium rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
