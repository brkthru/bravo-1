import { Decimal128 } from 'mongodb';
import BigNumber from 'bignumber.js';

// Configure BigNumber for financial calculations
// ADR 0019: Fixed-point decimal representation with 6 decimal places
BigNumber.config({
  DECIMAL_PLACES: 6,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-15, 20],
});

/**
 * Utility class for handling decimal conversions between MongoDB Decimal128,
 * BigNumber.js, and API string representations according to ADR 0019.
 */
export class MongoDecimal {
  /**
   * Convert various input types to MongoDB Decimal128 for storage
   * Ensures 6 decimal places of precision as per ADR 0019
   */
  static toDecimal128(value: BigNumber | string | number | null | undefined): Decimal128 | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      const bigNum = new BigNumber(value);
      if (bigNum.isNaN() || !bigNum.isFinite()) {
        throw new Error(`Invalid decimal value: ${value}`);
      }
      return Decimal128.fromString(bigNum.toFixed(6));
    } catch (error) {
      throw new Error(`Failed to convert to Decimal128: ${error}`);
    }
  }

  /**
   * Convert MongoDB Decimal128 to BigNumber for calculations
   */
  static toBigNumber(value: Decimal128 | string | number | null | undefined): BigNumber | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      if (value instanceof Decimal128) {
        return new BigNumber(value.toString());
      }
      return new BigNumber(value);
    } catch (error) {
      throw new Error(`Failed to convert to BigNumber: ${error}`);
    }
  }

  /**
   * Convert to string representation for API responses
   * Preserves full precision without exponential notation
   */
  static toAPIString(
    value: Decimal128 | BigNumber | string | number | null | undefined
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      if (value instanceof Decimal128) {
        return value.toString();
      }
      if (value instanceof BigNumber) {
        return value.toFixed();
      }
      return new BigNumber(value).toFixed();
    } catch (error) {
      throw new Error(`Failed to convert to API string: ${error}`);
    }
  }

  /**
   * Convert an object's financial fields to Decimal128
   * Used for ETL and data migration
   */
  static convertFieldsToDecimal128<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };

    for (const fieldPath of fields) {
      const value = this.getNestedValue(obj, fieldPath);
      if (value !== undefined && value !== null) {
        const decimal = this.toDecimal128(value);
        this.setNestedValue(result, fieldPath, decimal);
      }
    }

    return result;
  }

  /**
   * Convert an object's Decimal128 fields to strings for API response
   */
  static convertFieldsToString<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };

    for (const fieldPath of fields) {
      const value = this.getNestedValue(obj, fieldPath);
      if (value !== undefined && value !== null) {
        const stringValue = this.toAPIString(value);
        this.setNestedValue(result, fieldPath, stringValue);
      }
    }

    return result;
  }

  /**
   * Helper to get nested object value by path (e.g., 'budget.total')
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Helper to set nested object value by path
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * Rounding policies for different financial contexts
 * Based on ADR 0019 requirements
 */
export const RoundingPolicies = {
  // Storage: 6 decimal places (microdollar precision)
  STORAGE: {
    places: 6,
    mode: BigNumber.ROUND_HALF_UP,
  },

  // Display: 2 decimal places for dollars
  DISPLAY_DOLLARS: {
    places: 2,
    mode: BigNumber.ROUND_HALF_UP,
  },

  // Display: 3 decimal places for sub-cent precision
  DISPLAY_SUBCENT: {
    places: 3,
    mode: BigNumber.ROUND_HALF_UP,
  },

  // Unit costs: 4 decimal places
  UNIT_COST: {
    places: 4,
    mode: BigNumber.ROUND_HALF_UP,
  },

  // Percentages: 2 decimal places
  PERCENTAGE: {
    places: 2,
    mode: BigNumber.ROUND_HALF_UP,
  },

  // CPM conversion: 2 decimal places
  CPM: {
    places: 2,
    mode: BigNumber.ROUND_HALF_UP,
  },
};

/**
 * Apply a rounding policy to a BigNumber value
 */
export function applyRounding(value: BigNumber, policy: keyof typeof RoundingPolicies): BigNumber {
  const { places, mode } = RoundingPolicies[policy];
  return value.decimalPlaces(places, mode);
}
