/**
 * Borrowing Power Calculator - ES6 Refactored Edition
 */

const LOAN_TERM_MONTHS = 360; // 30 Years
const INTEREST_RATE = 7.0; // 7.0% baseline interest rate
const ASSESSMENT_RATE_BUFFER = 3.0; // 3.0% buffer added to interest rates

class BorrowingCalculator {
    constructor(
        apiToken = process.env.API_TOKEN || 'pat_abcdefghijklmnopqrstuvwxyz0123456789',
        baseUrl = process.env.API_BASE_URL || 'http://localhost:3000'
    ) {
        this.apiToken = apiToken;
        this.baseUrl = baseUrl;
    }

    /**
     * Helper method to centralize HTTP requests and headers
     */
    async fetchJson(endpoint) {
        let response;
        try {
            response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (networkError) {
            // fetch() itself throws on network failures (server down, DNS, etc.)
            // before we ever get a response object to check.
            throw new Error(`Could not reach the calculation server at ${this.baseUrl}. Is it running?`);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API request failed with status ${response.status}`);
        }

        return response.json();
    }

    /**
     * Fetches annual tax calculation from local API server
     */
    async getTax(income) {
        const data = await this.fetchJson(`/api/tax?income=${income}`);
        return data.tax;
    }

    /**
     * Fetches monthly HEM baseline expenses from local API server
     */
    async getHEM(income, dependents) {
        const data = await this.fetchJson(`/api/hem?income=${income}&dependents=${dependents}`);
        return data.hem;
    }

    /**
     * Calculates total borrowing power amount and monthly repayment configuration
     */
    async calculateBorrowingPower(income, dependents, expenses, creditLimits, annualAssessmentRate) {
        // 1. Fetch tax and HEM baseline concurrently - neither depends on the other
        const [annualTax, baselineHEM] = await Promise.all([
            this.getTax(income),
            this.getHEM(income, dependents)
        ]);

        // 2. Calculate Net Monthly Income after tax deductions
        const netMonthlyIncome = (income - annualTax) / 12;

        // 3. Determine living expenses (User declared expenses vs HEM baseline, whichever is higher)
        const totalLivingExpenses = Math.max(expenses, baselineHEM);

        // 4. Calculate credit card liability (~3% of total limits)
        const creditCardLiability = creditLimits * 0.03;

        // 5. Calculate monthly repayment capacity
        const maxMonthlyRepayment = netMonthlyIncome - totalLivingExpenses - creditCardLiability;

        // Return early if user cannot afford a loan at all
        if (maxMonthlyRepayment <= 0) {
            return { maxLoanAmount: 0, monthlyRepayment: 0 };
        }

        // 6. Calculate monthly interest rate
        const monthlyRate = (annualAssessmentRate / 100) / 12;

        // 7. Calculate maximum borrowing power using amortization formula:
        // P = M * (1 - (1 + R)^-N) / R
        const maxLoanAmount = maxMonthlyRepayment * ((1 - Math.pow(1 + monthlyRate, -LOAN_TERM_MONTHS)) / monthlyRate);

        return {
            maxLoanAmount: Number(maxLoanAmount.toFixed(2)),
            monthlyRepayment: Number(maxMonthlyRepayment.toFixed(2))
        };
    }
}

/**
 * Parses a console input value into a non-negative number, or returns null if invalid.
 */
function parsePositiveNumber(rawValue) {
    if (rawValue.trim().startsWith('-')) {
        return null; // explicitly reject negative input
    }
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    const value = parseFloat(cleaned);
    if (!Number.isFinite(value) || value < 0) {
        return null;
    }
    return value;
}
/* c8 ignore start */
async function runConsoleMode() {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const calculator = new BorrowingCalculator();

    console.log("Mortgage Borrowing Power Calculator");
    console.log("===================================");

    rl.question("Gross Annual Income: $", (incomeInput) => {
        rl.question("Number of Dependents: ", (dependentsInput) => {
            rl.question("Declared Monthly Expenses: $", (expensesInput) => {
                rl.question("Total Credit Card Limits: $", async (creditLimitsInput) => {

                    const income = parsePositiveNumber(incomeInput);
                    const dependents = parsePositiveNumber(dependentsInput);
                    const expenses = parsePositiveNumber(expensesInput);
                    const creditLimits = parsePositiveNumber(creditLimitsInput);

                    if (income === null || dependents === null || expenses === null || creditLimits === null) {
                        console.error("\nError: All inputs must be valid, non-negative numbers.");
                        rl.close();
                        return;
                    }

                    const assessmentRate = INTEREST_RATE + ASSESSMENT_RATE_BUFFER;

                    try {
                        const result = await calculator.calculateBorrowingPower(
                            income,
                            Math.floor(dependents),
                            expenses,
                            creditLimits,
                            assessmentRate
                        );

                        console.log("\n--- Calculation Summary ---");
                        console.log(`Maximum Borrowing Power at ${INTEREST_RATE}%: $${result.maxLoanAmount.toLocaleString()}`);
                        console.log(`Assumed Monthly Mortgage Repayment: $${result.monthlyRepayment.toLocaleString()} over 30 years`);
                    } catch (error) {
                        console.error("\nError calculating borrowing power:", error.message);
                    }

                    rl.close();
                });
            });
        });
    });
}

if (require.main === module) {
    runConsoleMode();
}
/* c8 ignore stop */

module.exports = BorrowingCalculator;
module.exports.parsePositiveNumber = parsePositiveNumber;