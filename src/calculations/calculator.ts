import { DecimalMoney, roundToPrecision } from '../utils/money.js';
import { CalculationInput } from '../types/expense.js';

export interface CalculationResult {
  amount: number;
  calculation: CalculationInput;
  suggestedCategory: string;
  suggestedDescription: string;
}

export interface FuelMpgParams {
  miles: number;
  mpg: number;
  pricePerGallon: number;
}

export interface MileageRateParams {
  miles: number;
  ratePerMile: number;
}

export interface PerDiemParams {
  days: number;
  ratePerDay: number;
}

export class ExpenseCalculator {
  /**
   * Fuel estimation formula:
   * gallons = miles / mpg
   * cost = gallons * pricePerGallon
   */
  static calculateFuelMpg(params: FuelMpgParams): CalculationResult {
    const { miles, mpg, pricePerGallon } = params;
    if (mpg <= 0) throw new Error('MPG must be greater than zero');
    if (miles < 0) throw new Error('Miles cannot be negative');
    if (pricePerGallon < 0) throw new Error('Price per gallon cannot be negative');

    const gallons = miles / mpg;
    const estimatedCost = gallons * pricePerGallon;
    const decimalCost = DecimalMoney.fromNumber(estimatedCost);

    return {
      amount: decimalCost.toNumber(),
      calculation: {
        formulaId: 'fuel_mpg',
        formulaLabel: 'Fuel Consumption (Miles / MPG × Price)',
        parameters: {
          miles,
          mpg,
          pricePerGallon,
          gallonsUsed: roundToPrecision(gallons, 2),
        },
        summary: `${miles} mi @ ${mpg} mpg (~${roundToPrecision(gallons, 1)} gal) × $${pricePerGallon.toFixed(2)}/gal`,
      },
      suggestedCategory: 'Fuel',
      suggestedDescription: `Fuel for ${miles} miles (${roundToPrecision(gallons, 1)} gal @ $${pricePerGallon.toFixed(2)}/gal)`,
    };
  }

  /**
   * Standard mileage reimbursement formula:
   * cost = miles * ratePerMile (e.g. IRS standard $0.67/mile)
   */
  static calculateMileage(params: MileageRateParams): CalculationResult {
    const { miles, ratePerMile } = params;
    const total = DecimalMoney.fromNumber(miles * ratePerMile);

    return {
      amount: total.toNumber(),
      calculation: {
        formulaId: 'standard_mileage',
        formulaLabel: 'Standard Mileage Reimbursement',
        parameters: {
          miles,
          ratePerMile,
        },
        summary: `${miles} miles × $${ratePerMile.toFixed(3)}/mi`,
      },
      suggestedCategory: 'Mileage',
      suggestedDescription: `Mileage reimbursement (${miles} mi @ $${ratePerMile}/mi)`,
    };
  }

  /**
   * Per Diem calculation
   */
  static calculatePerDiem(params: PerDiemParams): CalculationResult {
    const { days, ratePerDay } = params;
    const total = DecimalMoney.fromNumber(days * ratePerDay);

    return {
      amount: total.toNumber(),
      calculation: {
        formulaId: 'per_diem',
        formulaLabel: 'Per Diem Allowance',
        parameters: {
          days,
          ratePerDay,
        },
        summary: `${days} days × $${ratePerDay.toFixed(2)}/day`,
      },
      suggestedCategory: 'Meals',
      suggestedDescription: `Per diem allowance for ${days} days`,
    };
  }
}
