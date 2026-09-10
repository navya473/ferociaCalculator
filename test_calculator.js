const assert = require('assert');
const BorrowingCalculator = require('./borrowingCalculator');
const { parsePositiveNumber } = BorrowingCalculator;

describe('BorrowingCalculator Tests', () => {
    let calculator;

    beforeEach(() => {
        calculator = new BorrowingCalculator();
        calculator.fetchJson = async (endpoint) => {
            if (endpoint.includes('/api/tax')) return { tax: 30000 };
            if (endpoint.includes('/api/hem')) return { hem: 3000 };
        };
    });

    it('should calculate borrowing power for standard values', async () => {
        const result = await calculator.calculateBorrowingPower(120000, 2, 3000, 10000, 7.5);
        assert.ok(result.maxLoanAmount > 0, 'Should yield a positive borrowing power amount');
    });

    it('should return 0 when repayment capacity is negative', async () => {
        calculator.fetchJson = async (endpoint) => {
            if (endpoint.includes('/api/tax')) return { tax: 5000 };
            if (endpoint.includes('/api/hem')) return { hem: 8000 };
        };
        const result = await calculator.calculateBorrowingPower(30000, 3, 4000, 5000, 7.5);
        assert.strictEqual(result.maxLoanAmount, 0);
        assert.strictEqual(result.monthlyRepayment, 0);
    });

    it('should propagate errors thrown while fetching data (e.g. network failure)', async () => {
      calculator.fetchJson = async () => {
          throw new Error('Could not reach the calculation server at http://localhost:3000. Is it running?');
      };
      await assert.rejects(
          () => calculator.calculateBorrowingPower(80000, 1, 2000, 5000, 7.5),
          /Could not reach the calculation server/
      );
  });
});

describe('parsePositiveNumber Tests', () => {
    it('should parse a plain number string', () => {
        assert.strictEqual(parsePositiveNumber('50000'), 50000);
    });

    it('should strip commas and dollar signs', () => {
        assert.strictEqual(parsePositiveNumber('$100,000'), 100000);
    });

    it('should return null for empty input', () => {
        assert.strictEqual(parsePositiveNumber(''), null);
    });

    it('should return null for non-numeric text', () => {
        assert.strictEqual(parsePositiveNumber('abc'), null);
    });

    it('should return null for negative input', () => {
        assert.strictEqual(parsePositiveNumber('-500'), null);
    });

    it('should parse decimal values correctly', () => {
        assert.strictEqual(parsePositiveNumber('1,000.50'), 1000.5);
    });
});