import { Decimal128 } from 'mongodb';
import BigNumber from 'bignumber.js';
import { MongoDecimal, RoundingPolicies, applyRounding } from './decimal';

describe('MongoDecimal Utility - ADR 0019', () => {
  describe('toDecimal128', () => {
    it('should convert string to Decimal128', () => {
      const result = MongoDecimal.toDecimal128('123.456');
      expect(result).toBeInstanceOf(Decimal128);
      expect(result?.toString()).toBe('123.456000');
    });

    it('should convert number to Decimal128', () => {
      const result = MongoDecimal.toDecimal128(123.456);
      expect(result).toBeInstanceOf(Decimal128);
      expect(result?.toString()).toBe('123.456000');
    });

    it('should convert BigNumber to Decimal128', () => {
      const bigNum = new BigNumber('123.456789');
      const result = MongoDecimal.toDecimal128(bigNum);
      expect(result).toBeInstanceOf(Decimal128);
      expect(result?.toString()).toBe('123.456789');
    });

    it('should handle null and undefined', () => {
      expect(MongoDecimal.toDecimal128(null)).toBe(null);
      expect(MongoDecimal.toDecimal128(undefined)).toBe(null);
    });

    it('should throw on invalid values', () => {
      expect(() => MongoDecimal.toDecimal128('invalid')).toThrow();
      expect(() => MongoDecimal.toDecimal128(NaN)).toThrow();
      expect(() => MongoDecimal.toDecimal128(Infinity)).toThrow();
    });

    it('should maintain 6 decimal places precision', () => {
      const result = MongoDecimal.toDecimal128('123.123456789');
      expect(result?.toString()).toBe('123.123457'); // Rounded to 6 places
    });
  });

  describe('toBigNumber', () => {
    it('should convert Decimal128 to BigNumber', () => {
      const decimal = Decimal128.fromString('123.456789');
      const result = MongoDecimal.toBigNumber(decimal);
      expect(result).toBeInstanceOf(BigNumber);
      expect(result?.toString()).toBe('123.456789');
    });

    it('should convert string to BigNumber', () => {
      const result = MongoDecimal.toBigNumber('123.456');
      expect(result).toBeInstanceOf(BigNumber);
      expect(result?.toString()).toBe('123.456');
    });

    it('should convert number to BigNumber', () => {
      const result = MongoDecimal.toBigNumber(123.456);
      expect(result).toBeInstanceOf(BigNumber);
      expect(result?.toFixed(3)).toBe('123.456');
    });

    it('should handle null and undefined', () => {
      expect(MongoDecimal.toBigNumber(null)).toBe(null);
      expect(MongoDecimal.toBigNumber(undefined)).toBe(null);
    });
  });

  describe('toAPIString', () => {
    it('should convert Decimal128 to string', () => {
      const decimal = Decimal128.fromString('123.456789');
      const result = MongoDecimal.toAPIString(decimal);
      expect(result).toBe('123.456789');
    });

    it('should convert BigNumber to string without exponential notation', () => {
      const bigNum = new BigNumber('0.000001');
      const result = MongoDecimal.toAPIString(bigNum);
      expect(result).toBe('0.000001');
      expect(result).not.toContain('e');
    });

    it('should handle large numbers without exponential notation', () => {
      const bigNum = new BigNumber('1234567890.123456');
      const result = MongoDecimal.toAPIString(bigNum);
      expect(result).toBe('1234567890.123456');
      expect(result).not.toContain('e');
    });

    it('should handle null and undefined', () => {
      expect(MongoDecimal.toAPIString(null)).toBe(null);
      expect(MongoDecimal.toAPIString(undefined)).toBe(null);
    });
  });

  describe('convertFieldsToDecimal128', () => {
    it('should convert nested financial fields', () => {
      const obj = {
        id: '123',
        name: 'Test Campaign',
        budget: {
          total: '1000.50',
          allocated: 800.25,
          spent: new BigNumber('500.10'),
          remaining: '300.15',
        },
      };

      const fields = ['budget.total', 'budget.allocated', 'budget.spent', 'budget.remaining'];

      const result = MongoDecimal.convertFieldsToDecimal128(obj, fields);

      expect(result.budget.total).toBeInstanceOf(Decimal128);
      expect(result.budget.total.toString()).toBe('1000.500000');
      expect(result.budget.allocated).toBeInstanceOf(Decimal128);
      expect(result.budget.allocated.toString()).toBe('800.250000');
      expect(result.budget.spent).toBeInstanceOf(Decimal128);
      expect(result.budget.spent.toString()).toBe('500.100000');
      expect(result.budget.remaining).toBeInstanceOf(Decimal128);
      expect(result.budget.remaining.toString()).toBe('300.150000');
    });

    it('should handle missing fields gracefully', () => {
      const obj = {
        id: '123',
        budget: {
          total: '1000',
        },
      };

      const fields = [
        'budget.total',
        'budget.allocated', // Missing field
        'budget.nonexistent', // Non-existent path
      ];

      const result = MongoDecimal.convertFieldsToDecimal128(obj, fields);

      expect(result.budget.total).toBeInstanceOf(Decimal128);
      expect((result.budget as any).allocated).toBeUndefined();
    });
  });

  describe('convertFieldsToString', () => {
    it('should convert Decimal128 fields to strings', () => {
      const obj = {
        id: '123',
        budget: {
          total: Decimal128.fromString('1000.500000'),
          allocated: Decimal128.fromString('800.250000'),
        },
      };

      const fields = ['budget.total', 'budget.allocated'];
      const result = MongoDecimal.convertFieldsToString(obj, fields);

      expect(result.budget.total).toBe('1000.500000');
      expect(result.budget.allocated).toBe('800.250000');
    });
  });

  describe('RoundingPolicies', () => {
    it('should apply storage rounding (6 decimal places)', () => {
      const value = new BigNumber('123.123456789');
      const rounded = applyRounding(value, 'STORAGE');
      expect(rounded.toString()).toBe('123.123457');
    });

    it('should apply dollar display rounding (2 decimal places)', () => {
      const value = new BigNumber('123.456');
      const rounded = applyRounding(value, 'DISPLAY_DOLLARS');
      expect(rounded.toString()).toBe('123.46');
    });

    it('should apply sub-cent display rounding (3 decimal places)', () => {
      const value = new BigNumber('123.4567');
      const rounded = applyRounding(value, 'DISPLAY_SUBCENT');
      expect(rounded.toString()).toBe('123.457');
    });

    it('should apply unit cost rounding (4 decimal places)', () => {
      const value = new BigNumber('0.123456');
      const rounded = applyRounding(value, 'UNIT_COST');
      expect(rounded.toString()).toBe('0.1235');
    });

    it('should apply percentage rounding (2 decimal places)', () => {
      const value = new BigNumber('16.66666');
      const rounded = applyRounding(value, 'PERCENTAGE');
      expect(rounded.toString()).toBe('16.67');
    });

    it('should apply CPM rounding (2 decimal places)', () => {
      const value = new BigNumber('1.234');
      const rounded = applyRounding(value, 'CPM');
      expect(rounded.toString()).toBe('1.23');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small numbers', () => {
      const tiny = '0.000001';
      const decimal = MongoDecimal.toDecimal128(tiny);
      const bigNum = MongoDecimal.toBigNumber(decimal!);
      const str = MongoDecimal.toAPIString(bigNum);

      expect(decimal?.toString()).toBe('0.000001');
      expect(bigNum?.toString()).toBe('0.000001');
      expect(str).toBe('0.000001');
    });

    it('should handle very large numbers', () => {
      const large = '999999999.999999';
      const decimal = MongoDecimal.toDecimal128(large);
      const bigNum = MongoDecimal.toBigNumber(decimal!);
      const str = MongoDecimal.toAPIString(bigNum);

      expect(decimal?.toString()).toBe('999999999.999999');
      expect(bigNum?.toString()).toBe('999999999.999999');
      expect(str).toBe('999999999.999999');
    });

    it('should handle negative numbers', () => {
      const negative = '-123.456';
      const decimal = MongoDecimal.toDecimal128(negative);
      const bigNum = MongoDecimal.toBigNumber(decimal!);
      const str = MongoDecimal.toAPIString(bigNum);

      expect(decimal?.toString()).toBe('-123.456000');
      expect(bigNum?.toString()).toBe('-123.456');
      expect(str).toBe('-123.456');
    });

    it('should handle zero', () => {
      const zero = '0';
      const decimal = MongoDecimal.toDecimal128(zero);
      const bigNum = MongoDecimal.toBigNumber(decimal!);
      const str = MongoDecimal.toAPIString(bigNum);

      expect(decimal?.toString()).toBe('0.000000');
      expect(bigNum?.toString()).toBe('0');
      expect(str).toBe('0');
    });
  });
});
