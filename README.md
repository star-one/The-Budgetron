# Budget engine demo

A small, dependency-free starting point for "balance the budget" tools: sliders that change
taxes and spending, a sticky totals bar, and charts that compare the original figures with the
visitor's own.

It is a cut-down version of the engine behind the Budgetron at <https://hustings.org.uk/budget/>.
It mixes two kinds of figure:

- **Absolute figures**: an amount in £ billion that the visitor sets directly.
- **Calculated figures**: an amount worked out from a rate, or from tax bands and thresholds, and a
  base that is derived from the starting numbers. Change the rate and the amount follows.

There is no build step, no framework and no library. Plain HTML, CSS and JavaScript.

## Try it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server
```

## Files

| File | What it does |
|---|---|
| `config.js` | All the data: groups, items, starting numbers and bases. Edit this first. |
| `main.js` | The engine: builds the sliders, does the calculations, draws the charts. |
| `index.html` | The page skeleton. Loads `config.js` before `main.js`. |
| `style.css` | Layout, light and dark colours, slider styling. |
| `LICENSE` | MIT licence. |

## How it works

1. `config.js` sets `window.BUDGET_CONFIG`.
2. `main.js` reads it, asks each item's **type** for its starting state, and builds a labelled
   `<input type="range">` for every control.
3. Every slider movement calls `update()`, which recalculates every item, then refreshes the
   slider text, the totals bar and the two charts.
4. The starting figures are remembered as the baseline, so the charts always compare "original"
   with "yours", and **Reset** restores the starting values.

Income items add to the income total and spending items to the spending total. The deficit is
spending minus income (a negative deficit is shown as a surplus).

## Config reference

```js
window.BUDGET_CONFIG = {
  title, intro,                       // page heading and sentence
  locale, currencySymbol, unit,       // number formatting ("en-GB", "£", "bn")
  baselineLabel, yourLabel,           // chart column headings
  groups: [ { id, side, title, intro, items: [ ... ] } ],
  customTypes: { }                    // your own item types (see below)
};
```

`side` is `"income"` or `"spending"`. Every item has an `id` (unique), a `label` (shown on the
slider) and an optional `chartLabel` (shorter, used in the charts). The rest depends on `type`.

### `amount`: an absolute figure with a slider

```js
{ id: "health", type: "amount", label: "Health", value: 294, min: 0, max: 600, step: 1 }
```

### `fixed`: an absolute figure with no slider

```js
{ id: "otherReceipts", type: "fixed", label: "Other receipts (fixed)", value: 120 }
```

### `rate`: a calculated figure, rate × base

```js
{ id: "vat", type: "rate", label: "VAT headline rate",
  rate: 20, receipts: 220,            // the starting rate, and what it raises (£bn)
  min: 0, max: 30, step: 0.5,
  format: "{value}%" }
```

The base is worked out once as `receipts × divisor ÷ rate` (a 20% rate raising £220bn means a base
of £1,100bn). After that, `amount = rate ÷ divisor × base`. Optional fields:

- `divisor`: use `100` when the rate is in pence and the base is in billions of units
  (fuel duty in pence per litre, for example). Default `1`.
- `format`: how the value is shown, with `{value}` as the placeholder, e.g. `"£{value} a week"`.
- `minDecimals`: the least number of decimals to show (`2` gives `£241.30`).
- `volumeUnit`: if set, the detail line adds the base, e.g. `"billion litres a year"`.

This one type covers VAT, duties, benefit rates, or anything where the amount scales in proportion
to a rate.

### `banded`: tax bands and thresholds

```js
{ id: "incomeTax", type: "banded", label: "Income Tax", target: 359,
  allowance: { label: "Personal allowance", value: 12570, min: 0, max: 30000, step: 10 },
  bands: [
    { name: "Basic rate",  rate: 20, limit: { value: 50270, min: 0, max: 150000, step: 10 } },
    { name: "Higher rate", rate: 40 }                        // the last band has no limit
  ],
  rateRange: { min: 0, max: 60, step: 1 },
  cohorts: [ { name: "Typical taxpayer", income: 28500, people: 31.42 } ] }   // £, millions
```

The tax is worked out for one typical person in each cohort, band by band, and multiplied by the
number of people. `target` (optional) scales the result so the starting settings raise the
published total. Thresholds are kept in order if a slider is dragged past the next one.

This produces one slider for the allowance, one for each band's rate and one for each band limit.

## Adding an item type

A type is an object with up to four functions. Register it through `customTypes` in `config.js`:

```js
customTypes: {
  perPerson: {
    // starting control values, and anything worked out once
    init: function (item) { return { state: { amount: item.amount }, derived: {} }; },
    // the sliders for this item
    controls: function (item) {
      return [{ key: "amount", label: item.label, min: 0, max: 1000, step: 10,
                format: function (v) { return "£" + v + " each"; } }];
    },
    // the result in £ billion
    compute: function (item, state, derived) { return state.amount * item.people / 1000; },
    // optional text under the label
    detail: function (item, amount, group, derived) { return "Costs £" + amount.toFixed(1) + "bn"; }
  }
}
```

Then use `type: "perPerson"` on any item.

## Charts

Each side (income and spending) gets a chart with the original figures on the left, the visitor's
figures on the right and a ribbon joining each item. Items that have changed are drawn darker and
labelled with the change. They are plain SVG, drawn by `drawChart()` in `main.js`, with a text
alternative in `aria-label`. On narrow screens only the right-hand labels are shown.

## Accessibility

- Every slider has a real `<label>`, and the totals bar is a live region.
- Visible keyboard focus, a skip link, and large touch targets.
- Light and dark colours follow the device setting, and animation is off if the visitor asks for it.
- Colour is never the only signal: changes are also written out, such as `(+£55bn)`.

## Assumptions and limits

- Amounts are assumed to change in proportion to the rate. There is no behavioural response: raising a
  tax does not change how much people buy, earn or save.
- Items do not affect one another (a duty change does not alter VAT receipts, for example).
- The sample numbers are simplified, rounded and not consistent with any official forecast.
  Replace them with your own data and check your sources.

## Left out of this demo

The full Budgetron also has: a "your own salary" take-home pay calculator, a sticky diagram for each
section, a Share and Save as PNG or SVG export, and many more items and sources.

## Sample data

Simplified from public UK sources, for illustration only: the HM Treasury Budget 2025
(<https://www.gov.uk/government/publications/budget-2025-document/budget-2025-html>), the Office for
Budget Responsibility forecasts (<https://obr.uk/>), and the HMRC Income Tax liabilities statistics
(<https://www.gov.uk/government/statistics/income-tax-liabilities-by-taxpayers-marginal-rate>).

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. The code is plain ES5 style JavaScript
with no modules, so it also runs from a local file.

## Licence

MIT.
