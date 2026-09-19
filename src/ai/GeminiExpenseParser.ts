import { IExpenseParser, ParseExpenseRequest } from './IExpenseParser.js';
import { ParseExpenseResponse } from './expensePrompt.js';
import { ExpenseCalculator } from '../calculations/calculator.js';

export class GeminiExpenseParser implements IExpenseParser {
  async parseExpenseMessage(request: ParseExpenseRequest): Promise<ParseExpenseResponse> {
    // 1. Client-side regex pre-checks for instant derived calculation if applicable
    // e.g. "575 miles, assume 35 mpg, gas was $2.79" or "Drove 575 miles and I expense fuel assuming 35 mpg, gas was 2.79 a gallon"
    const localCalc = this.tryQuickCalculation(request.message, request.trip);
    if (localCalc) {
      return localCalc;
    }

    // 2. Call server-side /api/expenses/parse
    const res = await fetch('/api/expenses/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: request.message,
        trip: request.trip,
        existingExpenses: request.existingExpenses,
        customCategories: request.customCategories,
        conversationHistory: request.conversationHistory,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${res.status}: ${res.statusText}`);
    }

    const data: ParseExpenseResponse = await res.json();
    return data;
  }

  /**
   * Fast, deterministic local solver for explicit fuel/mileage formula patterns
   * when offline or providing zero-latency calculations
   */
  private tryQuickCalculation(msg: string, trip: any): ParseExpenseResponse | null {
    const text = msg.toLowerCase();
    
    // Pattern: miles + mpg + gas price
    const milesMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:miles|mi\b)/);
    const mpgMatch = text.match(/(\d+(?:\.\d+)?)\s*mpg/);
    const gasMatch = text.match(/(?:gas|fuel|price)\s*(?:was|is|at)?\s*\$?(\d+(?:\.\d+)?)(?:\s*(?:a\s*gallon|per\s*gallon|\/gal))?/);

    if (milesMatch && mpgMatch && gasMatch) {
      const miles = parseFloat(milesMatch[1]);
      const mpg = parseFloat(mpgMatch[1]);
      const price = parseFloat(gasMatch[1]);

      if (miles > 0 && mpg > 0 && price > 0) {
        const calc = ExpenseCalculator.calculateFuelMpg({
          miles,
          mpg,
          pricePerGallon: price,
        });

        const today = new Date().toISOString().split('T')[0];
        return {
          intent: 'calculate_expense',
          confidence: 0.99,
          summary: `Calculated fuel expense for ${miles} miles assuming ${mpg} MPG at $${price.toFixed(2)}/gal: $${calc.amount.toFixed(2)}`,
          expensesToCreate: [
            {
              date: today,
              merchant: 'Fuel / Mileage Calculation',
              description: calc.suggestedDescription,
              category: 'Fuel',
              amount: calc.amount,
              currency: trip?.settings?.defaultCurrency || 'USD',
              paymentMethod: trip?.settings?.defaultPaymentMethod || 'personal_card',
              reimbursableAmount: calc.amount,
              personalAmount: 0,
              reimbursementStatus: 'pending',
              source: 'calculated',
              calculation: calc.calculation,
            },
          ],
        };
      }
    }

    return null;
  }
}

export const geminiExpenseParser = new GeminiExpenseParser();
