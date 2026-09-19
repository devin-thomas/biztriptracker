import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { EXPENSE_PARSER_SYSTEM_INSTRUCTION } from './src/ai/expensePrompt.js';
import { ExpenseCalculator } from './src/calculations/calculator.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy initializer for Gemini client to prevent crash on startup if missing key
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// JSON Schema for Gemini structured output
const parseResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        'create_expense',
        'create_multiple_expenses',
        'modify_expense',
        'delete_expense',
        'calculate_expense',
        'query_trip',
        'clarification_needed',
      ],
      description: 'The classified action or intent of the user message',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Value between 0 and 1 representing interpretation confidence',
    },
    summary: {
      type: Type.STRING,
      description: 'Short 1-sentence user-friendly summary of the parsed intent',
    },
    expensesToCreate: {
      type: Type.ARRAY,
      description: 'List of parsed expense draft items to create',
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: 'ISO Date YYYY-MM-DD' },
          merchant: { type: Type.STRING, description: 'Payee or Merchant' },
          description: { type: Type.STRING, description: 'Description of the item' },
          category: { type: Type.STRING, description: 'Expense category' },
          amount: { type: Type.NUMBER, description: 'Total gross amount' },
          currency: { type: Type.STRING, description: '3-letter currency code (e.g. USD)' },
          paymentMethod: { type: Type.STRING, description: 'Payment method used' },
          reimbursableAmount: { type: Type.NUMBER, description: 'Amount eligible for reimbursement' },
          personalAmount: { type: Type.NUMBER, description: 'Amount considered personal or non-reimbursable' },
          reimbursementStatus: {
            type: Type.STRING,
            enum: ['pending', 'submitted', 'reimbursed', 'non_reimbursable'],
          },
          notes: { type: Type.STRING, description: 'Additional contextual notes' },
          source: {
            type: Type.STRING,
            enum: ['ai_chat', 'calculated', 'manual'],
          },
          calculation: {
            type: Type.OBJECT,
            properties: {
              formulaId: { type: Type.STRING, enum: ['fuel_mpg', 'standard_mileage', 'per_diem', 'custom_split'] },
              formulaLabel: { type: Type.STRING },
              parameters: { type: Type.OBJECT },
              summary: { type: Type.STRING },
            },
          },
        },
        required: [
          'date',
          'merchant',
          'description',
          'category',
          'amount',
          'currency',
          'reimbursableAmount',
          'personalAmount',
          'reimbursementStatus',
        ],
      },
    },
    expenseToModify: {
      type: Type.OBJECT,
      properties: {
        targetExpenseId: { type: Type.STRING, description: 'ID of existing expense being changed' },
        updatedFields: { type: Type.OBJECT, description: 'Fields to update' },
        explanation: { type: Type.STRING, description: 'What was changed' },
      },
      required: ['targetExpenseId', 'updatedFields'],
    },
    expenseToDeleteId: {
      type: Type.STRING,
      description: 'ID of existing expense to delete if intent is delete_expense',
    },
    queryAnswer: {
      type: Type.STRING,
      description: 'Conversational answer if intent is query_trip',
    },
    clarificationMessage: {
      type: Type.STRING,
      description: 'Friendly message explaining missing details if clarification_needed',
    },
    missingFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Names of required fields that are missing',
    },
  },
  required: ['intent', 'confidence', 'summary', 'expensesToCreate'],
};

// API Route to parse expense conversation
app.post('/api/expenses/parse', async (req, res) => {
  try {
    const { message, trip, existingExpenses, customCategories, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    const today = new Date().toISOString().split('T')[0];

    // Format category list
    const availableCategories = (customCategories && customCategories.length > 0)
      ? customCategories.join(', ')
      : 'Lodging, Transportation, Fuel, Mileage, Parking, Tolls, Meals, Airfare, Rideshare, Supplies, Entertainment, Other';

    // Format existing expenses summary for contextual referencing
    const recentExpensesSummary = (existingExpenses || []).slice(0, 15).map((e: any) => 
      `- ID: ${e.id} | Date: ${e.date} | Merchant: "${e.merchant}" | Desc: "${e.description}" | Category: ${e.category} | Amount: $${e.amount} (Reimbursable: $${e.reimbursableAmount}, Personal: $${e.personalAmount}) | Status: ${e.reimbursementStatus}`
    ).join('\n') || '(No previous expenses recorded yet)';

    // Compile instructions with real trip parameters
    const systemPrompt = EXPENSE_PARSER_SYSTEM_INSTRUCTION
      .replace('{CURRENT_DATE}', today)
      .replace('{TRIP_NAME}', trip?.name || 'Current Trip')
      .replace('{TRIP_DESTINATION}', trip?.destination || 'N/A')
      .replace('{TRIP_CURRENCY}', trip?.settings?.defaultCurrency || 'USD')
      .replace('{TRIP_START_DATE}', trip?.startDate || today)
      .replace('{TRIP_END_DATE}', trip?.endDate || today)
      .replace('{TRIP_PAYMENT_METHOD}', trip?.settings?.defaultPaymentMethod || 'corporate_card')
      .replace('{AVAILABLE_CATEGORIES}', availableCategories)
      .replace('{EXISTING_EXPENSES_SUMMARY}', recentExpensesSummary);

    // Call Gemini with gemini-2.5-flash for speed and precision structured output
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: parseResponseSchema,
        temperature: 0.1, // High determinism for financial parsing
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini returned an empty response.');
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err: any) {
      console.error('Failed to parse Gemini output as JSON:', responseText);
      return res.status(502).json({
        error: 'Malformed AI response format.',
        details: err.message,
      });
    }

    // Safety checks & deterministic post-validation in application code
    if (parsedData.intent === 'create_expense' || parsedData.intent === 'create_multiple_expenses') {
      if (Array.isArray(parsedData.expensesToCreate)) {
        parsedData.expensesToCreate = parsedData.expensesToCreate.map((item: any) => {
          const total = Number(item.amount) || 0;
          let reimbursable = Number(item.reimbursableAmount);
          let personal = Number(item.personalAmount);

          if (isNaN(reimbursable) && isNaN(personal)) {
            reimbursable = total;
            personal = 0;
          } else if (isNaN(reimbursable)) {
            reimbursable = Math.max(0, total - personal);
          } else if (isNaN(personal)) {
            personal = Math.max(0, total - reimbursable);
          }

          return {
            ...item,
            amount: total,
            reimbursableAmount: reimbursable,
            personalAmount: personal,
            currency: item.currency || trip?.settings?.defaultCurrency || 'USD',
            paymentMethod: item.paymentMethod || trip?.settings?.defaultPaymentMethod || 'corporate_card',
            date: item.date || today,
            source: item.source || 'ai_chat',
            reimbursementStatus: item.reimbursementStatus || 'pending',
          };
        });
      }
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/expenses/parse:', error);
    const message = error.message || 'Internal server error processing expense.';
    const isApiKeyError = message.includes('API key') || message.includes('GEMINI_API_KEY');
    return res.status(isApiKeyError ? 401 : 500).json({
      error: isApiKeyError ? 'Missing or invalid GEMINI_API_KEY.' : message,
    });
  }
});

// Production & Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
