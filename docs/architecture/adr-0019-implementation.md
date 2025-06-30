# ADR 0019 Implementation Guide

## Overview

This document describes the implementation of ADR 0019 (Fixed-point decimal representation) in the Bravo-1 system. The implementation ensures precise financial calculations throughout the application stack.

## Quick Start

### Running ETL with Decimal Support

```bash
# Transform PostgreSQL data with decimal precision
bun run scripts/etl/run-etl-decimal.ts transform

# Load data into MongoDB with Decimal128
bun run scripts/etl/run-etl-decimal.ts load

# Or run complete ETL
bun run scripts/etl/run-etl-decimal.ts
```

### Using Financial Calculations

```typescript
import { calculationEngine } from './backend/src/calculations/calculation-engine';
import { MongoDecimal } from './backend/src/utils/decimal';
import BigNumber from 'bignumber.js';

// Create financial values
const budget = new BigNumber('10000.50');
const spent = new BigNumber('3500.25');

// Perform calculations
const calc = calculationEngine.calculations;
const remaining = budget.minus(spent);
const spendPercentage = calc.marginPercentage(budget, spent);

// Store in MongoDB
const decimal128Budget = MongoDecimal.toDecimal128(budget);

// Convert for API response
const apiResponse = {
  budget: MongoDecimal.toAPIString(budget),
  spent: MongoDecimal.toAPIString(spent),
  remaining: MongoDecimal.toAPIString(remaining),
  spendPercentage: spendPercentage.toString(),
};
```

## Architecture Components

### 1. BigNumber.js Configuration

- **Precision**: 6 decimal places (microdollar precision)
- **Rounding**: ROUND_HALF_UP (banker's rounding)
- **No exponential notation**: Range [-15, 20]

### 2. MongoDB Decimal128

- Native decimal type in MongoDB
- 34 decimal digits of precision
- No precision loss in aggregations

### 3. Calculation Engine

- Versioned calculation methods
- Unit price formatting (CPM, CPC, CPV, etc.)
- Margin and profit calculations
- Amount comparison with tolerance
- Aggregate calculations

### 4. Decimal Utility

- Conversion between BigNumber, Decimal128, and strings
- Nested field conversion
- Null-safe operations

## Financial Fields Reference

### Campaign

```typescript
{
  budget: {
    total: Decimal128,      // Total campaign budget
    allocated: Decimal128,  // Sum of line item budgets
    spent: Decimal128,      // Actual spend to date
    remaining: Decimal128   // Budget - spent
  }
}
```

### Line Item

```typescript
{
  price: Decimal128,           // Total line item price
  unitPrice: Decimal128,       // Price per unit (CPC, CPM base)
  mediaBudget: Decimal128,     // Media spend budget
  targetUnitCost: Decimal128   // Target cost per unit
}
```

### Media Plan

```typescript
{
  budget: Decimal128,          // Plan budget
  plannedUnitCost: Decimal128, // Expected cost per unit
  actualSpend: Decimal128      // Actual spend (from platform)
}
```

## Common Calculations

### Unit Cost

```typescript
// Calculate actual cost per unit
const spend = new BigNumber('1000');
const units = new BigNumber('50000');
const unitCost = calc.actualUnitCost(spend, units); // 0.02
```

### CPM Formatting

```typescript
// Format cost per impression as CPM
const cpi = new BigNumber('0.001'); // $0.001 per impression
const formatted = calc.formatUnitPrice(cpi, 'impressions');
// Result: { displayFormat: "$1.00 CPM", displayUnit: "CPM" }
```

### Margin Calculation

```typescript
// Calculate margin percentage and amount
const revenue = new BigNumber('120');
const cost = new BigNumber('100');
const marginPct = calc.marginPercentage(revenue, cost); // 16.67%
const marginAmt = calc.marginAmount(revenue, cost); // $20.00
```

### Amount Comparison

```typescript
// Compare with tolerance (default 1 cent)
const expected = new BigNumber('100.00');
const actual = new BigNumber('100.005');
const isEqual = calc.compareAmounts(expected, actual); // true
```

## Testing

### Run Financial Tests

```bash
npm test -- --testPathPattern="(decimal|calculation-engine)"
```

### Test Coverage

- Precision maintenance (55 test cases)
- Expected vs actual comparisons
- Aggregation without drift
- Edge cases (very small/large numbers)
- MongoDB Decimal128 conversions
- Calculation version management

## Migration from Existing Data

### 1. Export PostgreSQL Data

Ensure you have the PostgreSQL export in `./data-export/`:

- campaigns.json
- strategies.json
- line_items.json
- users.json
- accounts.json

### 2. Transform with Decimal Precision

```bash
bun run scripts/etl/transform-postgres-data-decimal.ts
```

This creates `./data-transformed/campaigns-decimal.json` with:

- All financial fields converted to 6 decimal places
- Validation of financial values
- Precision metadata included

### 3. Load into MongoDB

```bash
bun run scripts/etl/load-data-decimal.ts
```

This:

- Converts strings to MongoDB Decimal128
- Creates proper indexes
- Validates storage precision

## API Integration

### Request (JSON with strings/numbers)

```json
{
  "budget": {
    "total": "10000.50",
    "allocated": 9500.25
  }
}
```

### Processing

```typescript
// Parse input
const total = new BigNumber(req.body.budget.total);
const allocated = new BigNumber(req.body.budget.allocated);

// Store in DB
const doc = {
  budget: {
    total: MongoDecimal.toDecimal128(total),
    allocated: MongoDecimal.toDecimal128(allocated),
  },
};
```

### Response (JSON with strings)

```json
{
  "budget": {
    "total": "10000.500000",
    "allocated": "9500.250000"
  }
}
```

## Frontend Integration

### Best Practices

1. Always receive financial values as strings
2. Never use JavaScript number type for money
3. Display formatting only (no calculations)
4. Use a decimal library if calculations needed

### Example Display Component

```typescript
interface BudgetProps {
  total: string;      // "10000.500000"
  allocated: string;  // "9500.250000"
}

function BudgetDisplay({ total, allocated }: BudgetProps) {
  // Format for display only
  const formatMoney = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  return (
    <div>
      <p>Total: {formatMoney(total)}</p>
      <p>Allocated: {formatMoney(allocated)}</p>
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **Precision Loss in Aggregation**
   - Ensure all fields are Decimal128 in MongoDB
   - Use `$sum` with Decimal128 fields

2. **API Returns Numbers Instead of Strings**
   - Check `MongoDecimal.toAPIString()` usage
   - Verify response transformation

3. **Comparison Failures**
   - Use `compareAmounts()` with appropriate tolerance
   - Default tolerance is 0.01 (1 cent)

4. **CPM Display Issues**
   - Remember CPM = CPI × 1000
   - Use `formatUnitPrice()` for correct display

### Validation Queries

```javascript
// Check if financial fields are Decimal128
db.campaigns.findOne({}, { budget: 1 });

// Verify precision in aggregation
db.campaigns.aggregate([
  {
    $group: {
      _id: null,
      total: { $sum: '$budget.total' },
    },
  },
]);
```

## Future Enhancements

1. **Configurable Precision**
   - Per-account decimal places
   - Currency-specific rounding

2. **Audit Trail**
   - Track calculation versions used
   - Log precision changes

3. **Performance Optimization**
   - Cached calculations
   - Batch decimal conversions

4. **Extended Currency Support**
   - Multi-currency with exchange rates
   - Locale-specific formatting
