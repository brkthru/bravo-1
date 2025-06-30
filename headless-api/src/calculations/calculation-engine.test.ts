import BigNumber from 'bignumber.js';
import { CalculationEngine, CalculationResult, FormattedResult } from './calculation-engine';
import { RoundingPolicies } from '../utils/decimal';

describe('CalculationEngine - Separated Concerns', () => {
  let engine: CalculationEngine;

  beforeEach(() => {
    engine = new CalculationEngine();
  });

  describe('Pure Calculations (No Rounding)', () => {
    it('should calculate margin percentage without rounding', () => {
      const revenue = new BigNumber('1000');
      const cost = new BigNumber('333.33');

      const result = engine.calculate('marginPercentage', revenue, cost);

      // Should return full precision
      expect(result.value.toString()).toBe('66.667'); // Full precision
      expect(result.calculationVersion).toBe('1.0.0');
      expect(result.calculatedAt).toBeInstanceOf(Date);
      expect(result.formula).toBe('((revenue - cost) / revenue) * 100');
    });

    it('should calculate unit cost without rounding', () => {
      const spend = new BigNumber('100');
      const units = new BigNumber('3');

      const result = engine.calculate('actualUnitCost', spend, units);

      // Should return full precision (100/3 = 33.333...)
      // Note: BigNumber has limited precision, check that it's approximately correct
      expect(result.value.toString()).toMatch(/^33\.333333/);
      expect(result.calculationVersion).toBe('1.0.0');
    });

    it('should handle zero revenue in margin calculation', () => {
      const revenue = new BigNumber('0');
      const cost = new BigNumber('100');

      const result = engine.calculate('marginPercentage', revenue, cost);

      expect(result.value.toString()).toBe('0');
    });

    it('should handle zero units in unit cost calculation', () => {
      const spend = new BigNumber('100');
      const units = new BigNumber('0');

      const result = engine.calculate('actualUnitCost', spend, units);

      expect(result.value.toString()).toBe('0');
    });
  });

  describe('Precision Application', () => {
    it('should apply storage precision (6 decimal places)', () => {
      const revenue = new BigNumber('1000');
      const cost = new BigNumber('333.33');

      const result = engine.calculate('marginPercentage', revenue, cost);
      const formatted = engine.withPrecision(result, 'storage');

      expect(formatted.formattedValue.toFixed(6)).toBe('66.667000');
      expect(formatted.precision).toBe(6);
      expect(formatted.context).toBe('storage');
      expect(formatted.calculationVersion).toBe('1.0.0');
    });

    it('should apply display precision (2 decimal places)', () => {
      const revenue = new BigNumber('1000');
      const cost = new BigNumber('333.33');

      const result = engine.calculate('marginPercentage', revenue, cost);
      const formatted = engine.withPrecision(result, 'display');

      expect(formatted.formattedValue.toString()).toBe('66.67');
      expect(formatted.precision).toBe(2);
      expect(formatted.context).toBe('display');
    });

    it('should allow precision override', () => {
      const spend = new BigNumber('100');
      const units = new BigNumber('3');

      const result = engine.calculate('actualUnitCost', spend, units);
      const formatted = engine.withPrecision(result, 'display', 'UNIT_COST');

      expect(formatted.formattedValue.toString()).toBe('33.3333');
      expect(formatted.precision).toBe(4);
      expect(formatted.overridePolicy).toBe('UNIT_COST');
    });
  });

  describe('Contextual Rounding Rules', () => {
    it('should apply YouTube CPV sub-cent precision', () => {
      const spend = new BigNumber('100');
      const views = new BigNumber('4321');

      const result = engine.calculate('actualUnitCost', spend, views);
      result.context = {
        platform: 'youtube',
        unitType: 'views',
        productType: 'cpv',
      };

      const formatted = engine.withPrecision(result, 'display');

      // YouTube CPV should use DISPLAY_SUBCENT (3 decimal places)
      expect(formatted.formattedValue.toString()).toBe('0.023');
      expect(formatted.precision).toBe(3);
      expect(formatted.appliedRule).toBe('youtube_cpv_subcent');
    });

    it('should apply Facebook video custom precision', () => {
      const spend = new BigNumber('100');
      const views = new BigNumber('4321');

      const result = engine.calculate('actualUnitCost', spend, views);
      result.context = {
        platform: 'facebook',
        unitType: 'views',
        productType: 'video',
      };

      const formatted = engine.withPrecision(result, 'display');

      // Facebook video should use 4 decimal places
      expect(formatted.formattedValue.toString()).toBe('0.0231');
      expect(formatted.precision).toBe(4);
      expect(formatted.appliedRule).toBe('facebook_video_custom');
    });

    it('should fall back to default when no contextual rule matches', () => {
      const spend = new BigNumber('100');
      const clicks = new BigNumber('50');

      const result = engine.calculate('actualUnitCost', spend, clicks);
      result.context = {
        platform: 'twitter',
        unitType: 'clicks',
        productType: 'cpc',
      };

      const formatted = engine.withPrecision(result, 'display');

      // Should use default DISPLAY_DOLLARS (2 decimal places)
      expect(formatted.formattedValue.toFixed(2)).toBe('2.00');
      expect(formatted.precision).toBe(2);
      expect(formatted.appliedRule).toBe('default');
    });
  });

  describe('Version Management', () => {
    it('should track calculation version in results', () => {
      const result = engine.calculate('marginAmount', new BigNumber('1000'), new BigNumber('750'));

      expect(result.calculationVersion).toBe('1.0.0');
    });

    it('should include rounding rules in version', () => {
      const version = engine.getVersion('1.0.0');

      expect(version.roundingRules).toBeDefined();
      expect(version.roundingRules?.contextual).toHaveLength(2);
      expect(version.roundingRules?.defaults).toEqual({
        storage: 'STORAGE',
        display: 'DISPLAY_DOLLARS',
        api: 'DISPLAY_DOLLARS',
      });
    });
  });

  describe('Calculation Service Integration', () => {
    it('should format unit cost with platform context', () => {
      const service = engine.getCalculationService();

      const result = service.formatUnitCost(
        new BigNumber('100'),
        new BigNumber('4321'),
        'youtube',
        'views'
      );

      expect(result.value).toBe('0.023');
      expect(result.displayText).toBe('$0.023 CPV');
      expect(result.metadata.precision).toBe(3);
      expect(result.metadata.calculationVersion).toBe('1.0.0');
    });

    it('should calculate for storage with metadata', () => {
      const service = engine.getCalculationService();

      const result = service.calculateForStorage(
        'marginPercentage',
        new BigNumber('1000'),
        new BigNumber('333.33')
      );

      expect(result.decimal128).toBeDefined();
      expect(result.stringValue).toBe('66.667000');
      expect(result.metadata.calculationVersion).toBe('1.0.0');
      expect(result.metadata.calculatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Complex Calculations', () => {
    it('should handle aggregation without rounding intermediate results', () => {
      const plans = [{ budget: '100.123456' }, { budget: '200.234567' }, { budget: '300.345678' }];

      const result = engine.calculate('aggregatePlanCost', plans);

      // Should sum with full precision
      expect(result.value.toString()).toBe('600.703701');
    });

    it('should format CPM correctly', () => {
      const spend = new BigNumber('50');
      const impressions = new BigNumber('10000');

      const result = engine.calculate('actualUnitCost', spend, impressions);
      const pricing = engine.calculations.formatUnitPrice(result.value, 'impressions');

      expect(pricing.unitPrice).toBe('0.005000'); // Full precision
      expect(pricing.displayPrice).toBe('5.00'); // CPM format
      expect(pricing.displayFormat).toBe('$5.00 CPM');
      expect(pricing.displayUnit).toBe('CPM');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid calculation method', () => {
      expect(() => {
        engine.calculate('invalidMethod' as any);
      }).toThrow('Calculation method "invalidMethod" not found');
    });

    it('should handle missing version', () => {
      expect(() => {
        engine.getVersion('99.0.0');
      }).toThrow('Calculation version "99.0.0" not found');
    });
  });
});
