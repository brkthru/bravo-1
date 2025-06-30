/**
 * Examples demonstrating the Calculation Engine with separated concerns
 */

import BigNumber from 'bignumber.js';
import { calculationEngine } from './calculation-engine';

console.log('=== Calculation Engine Examples ===\n');

// Example 1: Pure Calculations (No Rounding)
console.log('1. Pure Calculations - Full Precision');
const revenue = new BigNumber('1000');
const cost = new BigNumber('333.33');

const marginResult = calculationEngine.calculate('marginPercentage', revenue, cost);
console.log(`Margin calculation result:`);
console.log(`  Raw value: ${marginResult.value.toString()}`); // 66.667
console.log(`  Version: ${marginResult.calculationVersion}`);
console.log(`  Formula: ${marginResult.formula}`);

// Example 2: Applying Different Precision Contexts
console.log('\n2. Different Precision Contexts');
const storageMargin = calculationEngine.withPrecision(marginResult, 'storage');
const displayMargin = calculationEngine.withPrecision(marginResult, 'display');

console.log(`  Storage (6 decimals): ${storageMargin.formattedValue.toFixed(6)}`);
console.log(`  Display (2 decimals): ${displayMargin.formattedValue.toFixed(2)}`);

// Example 3: Contextual Rounding Rules (YouTube CPV)
console.log('\n3. Contextual Rounding - YouTube CPV');
const spend = new BigNumber('100');
const views = new BigNumber('4321');

const cpvResult = calculationEngine.calculate('actualUnitCost', spend, views);
cpvResult.context = {
  platform: 'youtube',
  unitType: 'views',
  productType: 'cpv',
};

const youtubeCPV = calculationEngine.withPrecision(cpvResult, 'display');
console.log(`  YouTube CPV: $${youtubeCPV.formattedValue.toFixed(3)}`);
console.log(`  Applied rule: ${youtubeCPV.appliedRule}`);
console.log(`  Precision: ${youtubeCPV.precision} decimal places`);

// Example 4: Override Precision
console.log('\n4. Override Precision');
const overriddenCPV = calculationEngine.withPrecision(cpvResult, 'display', 'UNIT_COST');
console.log(`  Overridden CPV: $${overriddenCPV.formattedValue.toFixed(4)}`);
console.log(`  Override policy: ${overriddenCPV.overridePolicy}`);

// Example 5: Using the Calculation Service
console.log('\n5. Calculation Service Helper Methods');
const service = calculationEngine.getCalculationService();

// Format for display with platform context
const displayResult = service.formatUnitCost(
  new BigNumber('100'),
  new BigNumber('4321'),
  'youtube',
  'views'
);
console.log(`  Display result: ${displayResult.displayText}`);
console.log(`  Metadata: ${JSON.stringify(displayResult.metadata)}`);

// Calculate for storage
const storageResult = service.calculateForStorage(
  'marginPercentage',
  new BigNumber('1000'),
  new BigNumber('750')
);
console.log(`  Storage value: ${storageResult.stringValue}`);
console.log(`  Version: ${storageResult.metadata.calculationVersion}`);

// Example 6: Version Tracking
console.log('\n6. Version Tracking');
const complexCalc = calculationEngine.calculate('aggregatePlanCost', [
  { budget: '100.123456' },
  { budget: '200.234567' },
  { budget: '300.345678' },
]);
console.log(`  Aggregate sum: ${complexCalc.value.toString()}`);
console.log(`  Calculated with version: ${complexCalc.calculationVersion}`);
console.log(`  Calculated at: ${complexCalc.calculatedAt.toISOString()}`);

// Example 7: Working with Different Contexts
console.log('\n7. Context-Aware Calculations');

// Facebook video with custom precision
const fbResult = calculationEngine.calculate('actualUnitCost', spend, views);
fbResult.context = {
  platform: 'facebook',
  unitType: 'views',
  productType: 'video',
};
const fbFormatted = calculationEngine.withPrecision(fbResult, 'display');
console.log(`  Facebook video CPV: $${fbFormatted.formattedValue.toFixed(4)}`);
console.log(`  Applied rule: ${fbFormatted.appliedRule}`);

// Twitter (no special rule, uses default)
const twitterResult = calculationEngine.calculate('actualUnitCost', spend, new BigNumber('50'));
twitterResult.context = {
  platform: 'twitter',
  unitType: 'clicks',
};
const twitterFormatted = calculationEngine.withPrecision(twitterResult, 'display');
console.log(`  Twitter CPC: $${twitterFormatted.formattedValue.toFixed(2)}`);
console.log(`  Applied rule: ${twitterFormatted.appliedRule}`);

console.log('\n=== End of Examples ===');
