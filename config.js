/*
 * Budget engine demo: configuration
 *
 * Everything the demo shows comes from this file: the groups of sliders, the
 * starting numbers and the bases that calculated figures are worked out from.
 * Edit the numbers, or add and remove items, without touching main.js.
 *
 * Item types (see README.md for the full reference):
 *   "amount"  an absolute figure in £ billion, set directly with a slider
 *   "fixed"   an absolute figure with no slider, counted in the totals
 *   "rate"    a figure calculated as  rate x base,  where the base is worked
 *             out from the starting receipts, e.g. VAT, duties, benefit rates
 *   "banded"  a figure calculated from tax bands and thresholds applied to
 *             groups of typical taxpayers (cohorts)
 *
 * The sample data is simplified from the UK Budget 2025 forecasts for 2026 to
 * 2027 and is for demonstration only. It is not an official forecast.
 */
window.BUDGET_CONFIG = {
  title: "Budget balancer demo",
  intro: "Change the taxes and spending and see what happens to the deficit. " +
         "The sample figures are simplified UK numbers, for demonstration only.",

  locale: "en-GB",         // used for number formatting
  currencySymbol: "£",
  unit: "bn",              // all amounts are in billions
  baselineLabel: "Original",
  yourLabel: "Your budget",

  // Groups are shown in this order. side is "income" or "spending".
  groups: [
    {
      id: "taxes",
      side: "income",
      title: "Taxes set by rate",
      intro: "Each rate is multiplied by a base worked out from the starting receipts. " +
             "People are assumed to carry on spending and earning in the same way.",
      items: [
        // A "rate" item: receipts are what the starting rate raises (£bn).
        { id: "vat", type: "rate", label: "VAT headline rate", chartLabel: "VAT",
          rate: 20, receipts: 220, min: 0, max: 30, step: 0.5, format: "{value}%" },

        { id: "corpTax", type: "rate", label: "Corporation Tax main rate", chartLabel: "Corporation Tax",
          rate: 25, receipts: 104, min: 0, max: 40, step: 0.5, format: "{value}%" },

        // divisor 100 because the rate is in pence and the base is in billions of litres.
        { id: "fuelDuty", type: "rate", label: "Fuel duty per litre", chartLabel: "Fuel duty",
          rate: 53.95, receipts: 24.2, divisor: 100, min: 0, max: 120, step: 0.05,
          format: "{value}p a litre", minDecimals: 2, volumeUnit: "billion litres a year" }
      ]
    },
    {
      id: "incomeTax",
      side: "income",
      title: "Income Tax",
      intro: "Tax is worked out for a typical person in each group and multiplied by the number of people. " +
             "The result is scaled so that the starting settings raise the published total.",
      items: [
        // A "banded" item: allowance, bands (each with a rate and an upper limit) and cohorts.
        {
          id: "incomeTax", type: "banded", label: "Income Tax", chartLabel: "Income Tax",
          target: 359,                                  // £bn raised at the starting settings
          allowance: { label: "Personal allowance", value: 12570, min: 0, max: 30000, step: 10 },
          bands: [
            { name: "Basic rate",      rate: 20, limit: { value: 50270,  min: 0, max: 150000, step: 10 } },
            { name: "Higher rate",     rate: 40, limit: { value: 125140, min: 0, max: 500000, step: 10 } },
            { name: "Additional rate", rate: 45 }       // the last band has no upper limit
          ],
          rateRange: { min: 0, max: 60, step: 1 },
          cohorts: [                                    // income in £, people in millions
            { name: "Typical basic rate taxpayer",      income: 28500,  people: 31.42 },
            { name: "Typical higher rate taxpayer",     income: 71600,  people: 7.72 },
            { name: "Typical additional rate taxpayer", income: 285300, people: 1.29 }
          ]
        }
      ]
    },
    {
      id: "otherIncome",
      side: "income",
      title: "Other income",
      intro: "Absolute figures in £ billion.",
      items: [
        { id: "councilTax", type: "amount", label: "Council Tax", chartLabel: "Council Tax",
          value: 54, min: 0, max: 120, step: 1 },
        { id: "otherTaxes", type: "amount", label: "Other taxes", chartLabel: "Other taxes",
          value: 140, min: 0, max: 300, step: 1 },
        // A "fixed" item has no slider but is counted in the totals.
        { id: "otherReceipts", type: "fixed", label: "Other receipts (fixed)", chartLabel: "Other receipts",
          value: 120 }
      ]
    },
    {
      id: "benefits",
      side: "spending",
      title: "Benefits set by rate",
      intro: "Spending changes in proportion to the rate, with the same number of claimants.",
      items: [
        { id: "statePension", type: "rate", label: "State Pension: full weekly rate", chartLabel: "State Pension",
          rate: 241.3, receipts: 154.5, min: 0, max: 500, step: 0.1, minDecimals: 2, format: "£{value} a week" },
        { id: "universalCredit", type: "rate", label: "Universal Credit: monthly standard allowance", chartLabel: "Universal Credit",
          rate: 424.9, receipts: 97.8, min: 0, max: 900, step: 0.1, minDecimals: 2, format: "£{value} a month" }
      ]
    },
    {
      id: "services",
      side: "spending",
      title: "Public services",
      intro: "Absolute figures in £ billion.",
      items: [
        { id: "health", type: "amount", label: "Health", chartLabel: "Health", value: 294, min: 0, max: 600, step: 1 },
        { id: "education", type: "amount", label: "Education", chartLabel: "Education", value: 145, min: 0, max: 300, step: 1 },
        { id: "defence", type: "amount", label: "Defence", chartLabel: "Defence", value: 90, min: 0, max: 200, step: 1 },
        { id: "debtInterest", type: "amount", label: "Debt interest", chartLabel: "Debt interest", value: 135, min: 0, max: 300, step: 1 },
        { id: "otherSpending", type: "amount", label: "Everything else", chartLabel: "Everything else", value: 120, min: 0, max: 300, step: 1 }
      ]
    }
  ],

  // Optional: add your own item types here (see "Adding an item type" in README.md).
  customTypes: {}
};
