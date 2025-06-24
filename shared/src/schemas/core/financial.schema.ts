import * as z from 'zod/v4';

// ADR 0019 compliant - MongoDB Decimal128 in storage, string in API
export const DecimalSchema = z.number()
  .or(z.string())
  .transform((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val);
      if (isNaN(num)) {
        throw new Error(`Invalid decimal value: ${val}`);
      }
      return num;
    }
    return val;
  });

// For API responses - converts numbers to strings
export const DecimalStringSchema = z.number()
  .transform((val) => val.toString());

// Financial amount with precision
export const FinancialAmountSchema = DecimalSchema
  .refine((val) => val >= 0, 'Amount must be non-negative')
  .refine((val) => Number.isFinite(val), 'Amount must be finite');

// Percentage (0-100)
export const PercentageSchema = DecimalSchema
  .refine((val) => val >= 0 && val <= 100, 'Percentage must be between 0 and 100');

// Currency code
export const CurrencyCodeSchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
  .default('USD');

// Money with currency
export const MoneySchema = z.object({
  amount: FinancialAmountSchema,
  currency: CurrencyCodeSchema,
});

// Price per unit (CPM, CPC, etc.)
export const UnitPriceSchema = DecimalSchema
  .refine((val) => val >= 0, 'Unit price must be non-negative');

// Margin as percentage
export const MarginSchema = PercentageSchema;

// Markup rate as percentage
export const MarkupRateSchema = PercentageSchema;

// Referral rate as percentage  
export const ReferralRateSchema = PercentageSchema;