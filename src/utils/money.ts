/**
 * Pure, precision decimal currency and financial arithmetic.
 * Avoids IEEE-754 floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004).
 * Internally stores amounts as integer cents (or micro-units for unit pricing).
 */

export class DecimalMoney {
  // Stored as integer cents (e.g. $14.63 -> 1463)
  readonly cents: number;

  constructor(cents: number) {
    this.cents = Math.round(cents);
  }

  static fromNumber(amount: number): DecimalMoney {
    if (isNaN(amount)) return new DecimalMoney(0);
    return new DecimalMoney(Math.round(amount * 100));
  }

  static fromString(val: string): DecimalMoney {
    if (!val) return new DecimalMoney(0);
    // Strip currency symbols and whitespace
    const clean = val.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? new DecimalMoney(0) : DecimalMoney.fromNumber(parsed);
  }

  static fromCents(cents: number): DecimalMoney {
    return new DecimalMoney(cents);
  }

  static zero(): DecimalMoney {
    return new DecimalMoney(0);
  }

  add(other: DecimalMoney): DecimalMoney {
    return new DecimalMoney(this.cents + other.cents);
  }

  subtract(other: DecimalMoney): DecimalMoney {
    return new DecimalMoney(this.cents - other.cents);
  }

  multiply(factor: number): DecimalMoney {
    return new DecimalMoney(Math.round(this.cents * factor));
  }

  divide(divisor: number): DecimalMoney {
    if (divisor === 0) return DecimalMoney.zero();
    return new DecimalMoney(Math.round(this.cents / divisor));
  }

  toNumber(): number {
    return this.cents / 100;
  }

  toFixed(decimals = 2): string {
    return (this.cents / 100).toFixed(decimals);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  equals(other: DecimalMoney): boolean {
    return this.cents === other.cents;
  }
}

/**
 * Format a number or DecimalMoney into a localized currency string
 */
export function formatCurrency(amount: number | DecimalMoney, currency = 'USD'): string {
  const num = typeof amount === 'number' ? amount : amount.toNumber();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

/**
 * Decimal-safe rounder for non-currency values like gallons or mileage
 */
export function roundToPrecision(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}
