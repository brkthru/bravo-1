import * as z from 'zod/v4';
import type { Decimal128 } from 'mongodb';
import type BigNumber from 'bignumber.js';

// ADR 0019 compliant - MongoDB Decimal128 in storage, string in API
// This schema handles various input types and ensures proper decimal handling

/**
 * Base decimal schema that accepts multiple input formats
 * Used for API inputs where we need to parse strings/numbers into decimals
 */
export const DecimalSchema = z
  .union([
    z.string(),
    z.number(),
    z.custom<BigNumber>((val) => {
      // Check if it's a BigNumber-like object
      return val && typeof val === 'object' && 'toFixed' in val;
    }),
    z.custom<Decimal128>((val) => {
      // Check if it's a Decimal128 instance
      return val && typeof val === 'object' && val.constructor.name === 'Decimal128';
    }),
  ])
  .transform((val) => {
    // For API/validation purposes, we'll work with string representation
    // The actual BigNumber/Decimal128 conversion happens in the business logic
    if (typeof val === 'string') {
      const num = parseFloat(val);
      if (isNaN(num) || !isFinite(num)) {
        throw new Error(`Invalid decimal value: ${val}`);
      }
      return val; // Keep as string for precision
    }
    if (typeof val === 'number') {
      if (!isFinite(val)) {
        throw new Error(`Invalid decimal value: ${val}`);
      }
      return val.toString(); // Convert to string for precision
    }
    // For BigNumber or Decimal128, convert to string
    if (val && typeof val === 'object') {
      return val.toString();
    }
    return val;
  });

/**
 * Schema for BigNumber instances
 * Used internally when we need to ensure BigNumber type safety
 */
export const BigNumberSchema = z.custom<BigNumber>(
  (val) => {
    if (val && typeof val === 'object' && 'toFixed' in val) {
      return true;
    }
    return false;
  },
  {
    message: 'Invalid BigNumber instance',
  }
);

/**
 * Schema for MongoDB Decimal128 instances
 * Used for database operations
 */
export const Decimal128Schema = z.custom<Decimal128>(
  (val) => {
    return val && typeof val === 'object' && val.constructor.name === 'Decimal128';
  },
  {
    message: 'Invalid Decimal128 instance',
  }
);

// For API responses - ensures string representation
// Note: DecimalSchema already transforms to string, so this just passes through
export const DecimalStringSchema = DecimalSchema;

// Financial amount with precision
export const FinancialAmountSchema = DecimalSchema.refine((val) => {
  const num = parseFloat(val);
  return num >= 0;
}, 'Amount must be non-negative').refine((val) => {
  const num = parseFloat(val);
  return isFinite(num);
}, 'Amount must be finite');

// Percentage (0-100)
export const PercentageSchema = DecimalSchema.refine((val) => {
  const num = parseFloat(val);
  return num >= 0 && num <= 100;
}, 'Percentage must be between 0 and 100');

// Currency code
export const CurrencyCodeSchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).default('USD');

// Money with currency
export const MoneySchema = z.object({
  amount: FinancialAmountSchema,
  currency: CurrencyCodeSchema,
});

// Price per unit (CPM, CPC, etc.)
export const UnitPriceSchema = DecimalSchema.refine((val) => {
  const num = parseFloat(val);
  return num >= 0;
}, 'Unit price must be non-negative');

// Margin as percentage
export const MarginSchema = PercentageSchema;

// Markup rate as percentage
export const MarkupRateSchema = PercentageSchema;

// Referral rate as percentage
export const ReferralRateSchema = PercentageSchema;

// Export types for use in TypeScript
export type DecimalString = z.infer<typeof DecimalStringSchema>;
export type FinancialAmount = z.infer<typeof FinancialAmountSchema>;
export type Percentage = z.infer<typeof PercentageSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type UnitPrice = z.infer<typeof UnitPriceSchema>;
