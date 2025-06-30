import BigNumber from 'bignumber.js';
import { RoundingPolicies, applyRounding } from '../utils/decimal';
import { MongoDecimal } from '../utils/decimal';

/**
 * Pure calculation methods interface (no rounding applied)
 */
export interface PureCalculationMethods {
  marginPercentage(revenue: BigNumber, cost: BigNumber): BigNumber;
  marginAmount(revenue: BigNumber, cost: BigNumber): BigNumber;
  actualUnitCost(spend: BigNumber, units: BigNumber): BigNumber;
  profitAmount(revenue: BigNumber, cost: BigNumber): BigNumber;
  markupAmount(cost: BigNumber, markupRate: BigNumber): BigNumber;
  aggregatePlanCost(plans: MediaPlan[]): BigNumber;
  aggregatePlanUnits(plans: MediaPlan[]): BigNumber;
  formatUnitPrice(price: BigNumber, unitType: string): PricingDisplay;
  compareAmounts(expected: BigNumber, actual: BigNumber, tolerance?: BigNumber): boolean;
}

/**
 * Calculation result with metadata
 */
export interface CalculationResult<T = BigNumber> {
  value: T;
  calculationVersion: string;
  calculatedAt: Date;
  formula?: string;
  context?: {
    platform?: string;
    unitType?: string;
    productType?: string;
  };
}

/**
 * Formatted result after applying precision
 */
export interface FormattedResult extends Omit<CalculationResult, 'context'> {
  formattedValue: BigNumber;
  precision: number;
  context: 'storage' | 'display' | 'api';
  appliedRule?: string;
  overridePolicy?: string;
  originalContext?: CalculationResult['context'];
}

/**
 * Display value for UI
 */
export interface DisplayValue {
  value: string;
  displayText: string;
  metadata: {
    calculationVersion: string;
    precision: number;
  };
}

/**
 * Storage value for database
 */
export interface StorageValue {
  decimal128: any; // MongoDB Decimal128
  stringValue: string;
  metadata: {
    calculationVersion: string;
    calculatedAt: Date;
  };
}

/**
 * Media plan interface
 */
export interface MediaPlan {
  budget: string | number | BigNumber;
  plannedUnits?: string | number | BigNumber;
  platform?: string;
}

/**
 * Pricing display format
 */
export interface PricingDisplay {
  unitPrice: string;
  displayPrice: string;
  displayFormat: string;
  displayUnit: string;
}

/**
 * Rounding policy type
 */
export interface RoundingPolicy {
  places: number;
  mode: BigNumber.RoundingMode;
}

/**
 * Calculation version with metadata and rounding rules
 */
export interface CalculationVersion {
  version: string;
  effectiveDate: Date;
  deprecated?: Date;
  description: string;
  calculations: PureCalculationMethods;
  formulas?: Record<string, string>;
  roundingRules?: {
    contextual: Array<{
      name: string;
      condition: (context: any) => boolean;
      policy: keyof typeof RoundingPolicies | RoundingPolicy;
    }>;
    defaults: {
      storage: keyof typeof RoundingPolicies;
      display: keyof typeof RoundingPolicies;
      api: keyof typeof RoundingPolicies;
    };
  };
}

/**
 * Calculation service for convenience methods
 */
export class CalculationService {
  constructor(private engine: CalculationEngine) {}

  formatUnitCost(
    spend: BigNumber,
    units: BigNumber,
    platform?: string,
    unitType?: string
  ): DisplayValue {
    const result = this.engine.calculate('actualUnitCost', spend, units);
    result.context = { platform, unitType, productType: this.inferProductType(unitType) };

    const formatted = this.engine.withPrecision(result, 'display');

    // Special formatting for YouTube CPV
    if (platform === 'youtube' && unitType === 'views') {
      return {
        value: formatted.formattedValue.toFixed(3),
        displayText: `$${formatted.formattedValue.toFixed(3)} CPV`,
        metadata: {
          calculationVersion: result.calculationVersion,
          precision: 3,
        },
      };
    }

    // Default formatting
    return {
      value: formatted.formattedValue.toFixed(formatted.precision),
      displayText: `$${formatted.formattedValue.toFixed(formatted.precision)}`,
      metadata: {
        calculationVersion: result.calculationVersion,
        precision: formatted.precision,
      },
    };
  }

  calculateForStorage(method: keyof PureCalculationMethods, ...args: any[]): StorageValue {
    const result = this.engine.calculate(method, ...args);
    const formatted = this.engine.withPrecision(result, 'storage');

    return {
      decimal128: MongoDecimal.toDecimal128(formatted.formattedValue),
      stringValue: formatted.formattedValue.toFixed(6),
      metadata: {
        calculationVersion: result.calculationVersion,
        calculatedAt: result.calculatedAt,
      },
    };
  }

  private inferProductType(unitType?: string): string {
    switch (unitType?.toLowerCase()) {
      case 'views':
      case 'view':
        return 'cpv';
      case 'clicks':
      case 'click':
        return 'cpc';
      case 'impressions':
      case 'impression':
        return 'cpm';
      default:
        return 'unknown';
    }
  }
}

/**
 * Calculation engine with separated calculation logic and rounding policies
 */
export class CalculationEngine {
  private versions: Map<string, CalculationVersion> = new Map();
  private currentVersion = '1.0.0';

  constructor() {
    this.registerV1();
  }

  /**
   * Get raw calculations (no rounding)
   */
  get calculations(): PureCalculationMethods {
    return this.getVersion().calculations;
  }

  /**
   * Calculate with result metadata
   */
  calculate(method: keyof PureCalculationMethods, ...args: any[]): CalculationResult {
    const version = this.getVersion();

    if (!version.calculations[method]) {
      throw new Error(`Calculation method "${method}" not found`);
    }

    const value = (version.calculations[method] as any)(...args);

    return {
      value,
      calculationVersion: version.version,
      calculatedAt: new Date(),
      formula: version.formulas?.[method],
    };
  }

  /**
   * Apply precision based on context
   */
  withPrecision(
    result: CalculationResult,
    intendedUse: 'storage' | 'display' | 'api',
    overridePolicy?: keyof typeof RoundingPolicies
  ): FormattedResult {
    const version = this.getVersion(result.calculationVersion);

    // 1. Check for override
    if (overridePolicy) {
      const policy = RoundingPolicies[overridePolicy];
      return {
        ...result,
        formattedValue: applyRounding(result.value, overridePolicy),
        precision: policy.places,
        context: intendedUse,
        overridePolicy,
        appliedRule: 'override',
        originalContext: result.context,
      };
    }

    // 2. Check contextual rules
    if (version.roundingRules?.contextual && result.context) {
      for (const rule of version.roundingRules.contextual) {
        if (rule.condition(result.context)) {
          const policy =
            typeof rule.policy === 'string' ? RoundingPolicies[rule.policy] : rule.policy;

          const formattedValue =
            typeof rule.policy === 'string'
              ? applyRounding(result.value, rule.policy)
              : result.value.decimalPlaces(policy.places, policy.mode);

          return {
            ...result,
            formattedValue,
            precision: policy.places,
            context: intendedUse,
            appliedRule: rule.name,
            originalContext: result.context,
          };
        }
      }
    }

    // 3. Use default for intended use
    const defaultPolicyName = version.roundingRules?.defaults[intendedUse] || 'STORAGE';
    const defaultPolicy = RoundingPolicies[defaultPolicyName];

    return {
      ...result,
      formattedValue: applyRounding(result.value, defaultPolicyName),
      precision: defaultPolicy.places,
      context: intendedUse,
      appliedRule: 'default',
      originalContext: result.context,
    };
  }

  /**
   * Get a specific version or current version
   */
  getVersion(version?: string): CalculationVersion {
    const v = version || this.currentVersion;
    const versionData = this.versions.get(v);

    if (!versionData) {
      throw new Error(`Calculation version "${v}" not found`);
    }

    return versionData;
  }

  /**
   * Get calculation service for convenience methods
   */
  getCalculationService(): CalculationService {
    return new CalculationService(this);
  }

  /**
   * Register version 1.0.0 with pure calculations and contextual rounding
   */
  private registerV1(): void {
    const calculations: PureCalculationMethods = {
      marginPercentage: (revenue: BigNumber, cost: BigNumber): BigNumber => {
        if (revenue.isZero()) {
          return new BigNumber(0);
        }
        return revenue.minus(cost).dividedBy(revenue).multipliedBy(100);
      },

      marginAmount: (revenue: BigNumber, cost: BigNumber): BigNumber => {
        return revenue.minus(cost);
      },

      actualUnitCost: (spend: BigNumber, units: BigNumber): BigNumber => {
        if (units.isZero()) {
          return new BigNumber(0);
        }
        return spend.dividedBy(units);
      },

      profitAmount: (revenue: BigNumber, cost: BigNumber): BigNumber => {
        return revenue.minus(cost);
      },

      markupAmount: (cost: BigNumber, markupRate: BigNumber): BigNumber => {
        return cost.multipliedBy(markupRate.dividedBy(100));
      },

      aggregatePlanCost: (plans: MediaPlan[]): BigNumber => {
        return plans.reduce((sum, plan) => {
          const budget = new BigNumber(plan.budget);
          return sum.plus(budget);
        }, new BigNumber(0));
      },

      aggregatePlanUnits: (plans: MediaPlan[]): BigNumber => {
        return plans.reduce((sum, plan) => {
          if (plan.plannedUnits) {
            const units = new BigNumber(plan.plannedUnits);
            return sum.plus(units);
          }
          return sum;
        }, new BigNumber(0));
      },

      formatUnitPrice: (price: BigNumber, unitType: string): PricingDisplay => {
        const basePrice = price.toFixed(6);

        switch (unitType.toLowerCase()) {
          case 'impressions':
          case 'impression':
            const cpm = price.multipliedBy(1000);
            return {
              unitPrice: basePrice,
              displayPrice: cpm.toFixed(2),
              displayFormat: `$${cpm.toFixed(2)} CPM`,
              displayUnit: 'CPM',
            };

          case 'clicks':
          case 'click':
            return {
              unitPrice: basePrice,
              displayPrice: price.toFixed(2),
              displayFormat: `$${price.toFixed(2)} CPC`,
              displayUnit: 'CPC',
            };

          case 'views':
          case 'view':
          case 'video_views':
            // CPV = cost per view
            return {
              unitPrice: basePrice,
              displayPrice: price.toFixed(2),
              displayFormat: `$${price.toFixed(2)} CPV`,
              displayUnit: 'CPV',
            };

          case 'conversions':
          case 'conversion':
            // CPA = cost per acquisition/conversion
            return {
              unitPrice: basePrice,
              displayPrice: price.toFixed(2),
              displayFormat: `$${price.toFixed(2)} CPA`,
              displayUnit: 'CPA',
            };

          case 'engagements':
          case 'engagement':
            // CPE = cost per engagement
            return {
              unitPrice: basePrice,
              displayPrice: price.toFixed(2),
              displayFormat: `$${price.toFixed(2)} CPE`,
              displayUnit: 'CPE',
            };

          default:
            // Generic cost
            return {
              unitPrice: basePrice,
              displayPrice: price.toFixed(2),
              displayFormat: `$${price.toFixed(2)}`,
              displayUnit: 'Cost',
            };
        }
      },

      compareAmounts: (expected: BigNumber, actual: BigNumber, tolerance?: BigNumber): boolean => {
        const diff = expected.minus(actual).abs();
        const tol = tolerance || new BigNumber('0.01');
        return diff.isLessThanOrEqualTo(tol);
      },
    };

    this.versions.set('1.0.0', {
      version: '1.0.0',
      effectiveDate: new Date('2025-01-01'),
      description: 'Calculation engine with separated calculation logic and rounding policies',
      calculations,
      formulas: {
        marginPercentage: '((revenue - cost) / revenue) * 100',
        marginAmount: 'revenue - cost',
        actualUnitCost: 'spend / units',
        profitAmount: 'revenue - cost',
        markupAmount: 'cost * (markupRate / 100)',
        aggregatePlanCost: 'sum(plan.budget)',
        aggregatePlanUnits: 'sum(plan.plannedUnits)',
      },
      roundingRules: {
        contextual: [
          {
            name: 'youtube_cpv_subcent',
            condition: (ctx) => ctx.platform === 'youtube' && ctx.unitType === 'views',
            policy: 'DISPLAY_SUBCENT',
          },
          {
            name: 'facebook_video_custom',
            condition: (ctx) => ctx.platform === 'facebook' && ctx.productType === 'video',
            policy: { places: 4, mode: BigNumber.ROUND_HALF_UP },
          },
        ],
        defaults: {
          storage: 'STORAGE',
          display: 'DISPLAY_DOLLARS',
          api: 'DISPLAY_DOLLARS',
        },
      },
    });
  }
}

// Export singleton instance
export const calculationEngine = new CalculationEngine();
