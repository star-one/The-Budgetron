/*
 * Budget engine demo: the engine.
 *
 * Reads window.BUDGET_CONFIG (config.js), builds the sliders, works out every
 * figure, and keeps the totals and the two comparison charts up to date.
 * No libraries and no build step.
 *
 * Structure:
 *   1. Formatting helpers
 *   2. Item types: "amount", "fixed", "rate", "banded" (add your own in config.customTypes)
 *   3. Building the page from the config
 *   4. Calculating and updating
 *   5. Comparison charts (original on the left, yours on the right)
 *   6. Start-up, reset and resize
 */
(function () {
  "use strict";

  var config = window.BUDGET_CONFIG;
  var types = {};
  var entries = [];        // one per item: { item, group, type, state, defaults, derived, amount, baseline }
  var baselineSpending = 0; // total starting spending, used to show each amount as a share of the budget
  var resizeTimer = null;

  /* ---------- 1. Formatting helpers ---------- */

  function decimalsOf(step) {
    var text = String(step);
    return text.indexOf(".") === -1 ? 0 : text.split(".")[1].length;
  }

  function bn(amount) {
    return config.currencySymbol + Number(amount.toFixed(1)).toLocaleString(config.locale) + config.unit;
  }

  function signedBn(amount) {
    return (amount < 0 ? "\u2212" : "+") + bn(Math.abs(amount));
  }

  function share(amount) {
    return (amount / baselineSpending * 100).toFixed(1) + "%";
  }

  function money(value) {
    return config.currencySymbol + Math.round(value).toLocaleString(config.locale);
  }

  // "{value}%" -> "20%". The number of decimals follows the slider step.
  // Decimals shown run from item.minDecimals (default 0) up to the number of decimals in the step.
  function template(text, value, step, minDecimals) {
    return text.replace("{value}", Number(value).toLocaleString(config.locale, {
      minimumFractionDigits: minDecimals || 0, maximumFractionDigits: Math.max(decimalsOf(step), minDecimals || 0)
    }));
  }

  function verb(group) {
    return group.side === "income" ? "Raises " : "Costs ";
  }

  /* ---------- 2. Item types ----------
   * A type is an object with:
   *   init(item)                   -> { state, derived }  starting control values and anything worked out once
   *   controls(item, state)        -> array of { key, label, min, max, step, format(value) }  (none = no sliders)
   *   compute(item, state, derived)-> the amount in £ billion
   *   detail(item, amount, group)  -> optional text shown under the label
   */

  types.amount = {
    init: function (item) { return { state: { value: item.value }, derived: {} }; },
    controls: function (item) {
      return [{
        key: "value", label: item.label, min: item.min, max: item.max, step: item.step || 1,
        format: function (v) { return bn(v) + " (" + share(v) + " of the budget)"; }
      }];
    },
    compute: function (item, state) { return state.value; }
  };

  types.fixed = {
    init: function (item) { return { state: {}, derived: {} }; },
    controls: function () { return []; },
    compute: function (item) { return item.value; },
    detail: function (item, amount) { return item.label + ": " + bn(amount); }
  };

  // rate x base. The base ("volume") is worked out once, from the starting rate and receipts.
  types.rate = {
    init: function (item) {
      var divisor = item.divisor || 1;
      return { state: { rate: item.rate }, derived: { divisor: divisor, volume: item.receipts * divisor / item.rate } };
    },
    controls: function (item) {
      return [{
        key: "rate", label: item.label, min: item.min, max: item.max, step: item.step || 1,
        format: function (v) { return template(item.format || "{value}", v, item.step || 1, item.minDecimals); }
      }];
    },
    compute: function (item, state, derived) { return state.rate / derived.divisor * derived.volume; },
    detail: function (item, amount, group, derived) {
      var text = verb(group) + bn(amount);
      if (item.volumeUnit) {
        text += " from " + Number(derived.volume.toFixed(1)) + " " + item.volumeUnit;
      }
      return text;
    }
  };

  // Tax bands and thresholds applied to typical people, then scaled to the published total.
  function bandedTotal(item, state) {
    var limits = item.bands.map(function (band, i) { return band.limit ? state["limit" + i] : Infinity; });
    var total = 0;
    item.cohorts.forEach(function (cohort) {
      var lower = state.allowance;
      var tax = 0;
      item.bands.forEach(function (band, i) {
        var upper = Math.max(limits[i], lower);          // keeps the thresholds in order
        tax += state["rate" + i] / 100 * Math.max(0, Math.min(cohort.income, upper) - lower);
        lower = upper;
      });
      total += cohort.people * tax / 1000;               // people in millions x £ = £ million; /1000 = £ billion
    });
    return total;
  }

  types.banded = {
    init: function (item) {
      var state = { allowance: item.allowance.value };
      item.bands.forEach(function (band, i) {
        state["rate" + i] = band.rate;
        if (band.limit) { state["limit" + i] = band.limit.value; }
      });
      var scale = item.target ? item.target / bandedTotal(item, state) : 1;
      return { state: state, derived: { scale: scale } };
    },
    controls: function (item) {
      var list = [{ key: "allowance", label: item.allowance.label, min: item.allowance.min, max: item.allowance.max,
                    step: item.allowance.step, format: money }];
      item.bands.forEach(function (band, i) {
        list.push({ key: "rate" + i, label: band.name + " of " + item.label, min: item.rateRange.min,
                    max: item.rateRange.max, step: item.rateRange.step,
                    format: function (v) { return v + "%"; } });
        if (band.limit) {
          list.push({ key: "limit" + i, label: item.bands[i + 1].name + " starts at", min: band.limit.min,
                      max: band.limit.max, step: band.limit.step, format: money });
        }
      });
      return list;
    },
    compute: function (item, state, derived) { return bandedTotal(item, state) * derived.scale; },
    detail: function (item, amount, group) { return verb(group) + bn(amount) + " in total"; }
  };

  /* ---------- 3. Building the page from the config ---------- */

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.textContent = text; }
    return node;
  }

  function buildItems() {
    var custom = config.customTypes || {};
    Object.keys(custom).forEach(function (name) { types[name] = custom[name]; });

    config.groups.forEach(function (group) {
      group.items.forEach(function (item) {
        var type = types[item.type];
        if (!type) { throw new Error("Unknown item type: " + item.type); }
        var start = type.init(item);
        entries.push({
          item: item, group: group, type: type, state: start.state, derived: start.derived,
          defaults: JSON.parse(JSON.stringify(start.state)), amount: 0, baseline: 0
        });
      });
    });
  }

  function buildControls(container) {
    config.groups.forEach(function (group) {
      var section = element("section", "panel panel-" + group.side);
      section.id = "group-" + group.id;
      section.setAttribute("aria-labelledby", "heading-" + group.id);
      var heading = element("h2", "", group.title);
      heading.id = "heading-" + group.id;
      section.appendChild(heading);
      if (group.intro) { section.appendChild(element("p", "panel-intro", group.intro)); }
      var grid = element("div", "slider-grid");

      entries.filter(function (e) { return e.group === group; }).forEach(function (entry) {
        var controls = entry.type.controls(entry.item, entry.state);
        if (controls.length === 0) {
          var line = element("p", "fixed-line");
          line.id = "detail-" + entry.item.id;
          grid.appendChild(line);
          return;
        }
        var wrapper = grid;
        if (controls.length > 1) {                       // several sliders for one item: give them a sub-heading
          var block = element("div", "item-block");
          block.appendChild(element("h3", "", entry.item.label));
          var detail = element("p", "item-detail");
          detail.id = "detail-" + entry.item.id;
          block.appendChild(detail);
          wrapper = element("div", "slider-grid");
          block.appendChild(wrapper);
          grid.appendChild(block);
        }
        controls.forEach(function (control, index) {
          wrapper.appendChild(buildSlider(entry, control, controls.length === 1 && index === 0));
        });
      });
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function buildSlider(entry, control, withDetail) {
    var id = "ctl-" + entry.item.id + "-" + control.key;
    var tile = element("div", "slider");
    var label = element("label", "slider-name", control.label);
    label.setAttribute("for", id);
    var value = element("span", "slider-value");
    value.id = "val-" + entry.item.id + "-" + control.key;
    tile.appendChild(label);
    tile.appendChild(value);
    if (withDetail) {
      var detail = element("span", "slider-detail");
      detail.id = "detail-" + entry.item.id;
      tile.appendChild(detail);
    }
    var input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
    input.value = entry.state[control.key];
    input.addEventListener("input", function () {
      entry.state[control.key] = Number(input.value);
      update();
    });
    tile.appendChild(input);
    return tile;
  }

  /* ---------- 4. Calculating and updating ---------- */

  function calculate() {
    var totals = { income: 0, spending: 0 };
    entries.forEach(function (entry) {
      entry.amount = entry.type.compute(entry.item, entry.state, entry.derived);
      totals[entry.group.side] += entry.amount;
    });
    return totals;
  }

  function deficitText(deficit) {
    return deficit < -0.05 ? bn(-deficit) + " surplus" : bn(Math.max(deficit, 0));
  }

  function update() {
    var totals = calculate();
    entries.forEach(function (entry) {
      entry.type.controls(entry.item, entry.state).forEach(function (control) {
        var output = document.getElementById("val-" + entry.item.id + "-" + control.key);
        if (output) { output.textContent = control.format(entry.state[control.key]); }
      });
      var detail = document.getElementById("detail-" + entry.item.id);
      if (detail && entry.type.detail) {
        detail.textContent = entry.type.detail(entry.item, entry.amount, entry.group, entry.derived);
      }
    });
    var deficit = totals.spending - totals.income;
    document.getElementById("total-income").textContent = bn(totals.income);
    document.getElementById("total-spending").textContent = bn(totals.spending);
    document.getElementById("total-deficit").textContent = deficitText(deficit);
    drawCharts();
  }

  /* ---------- 5. Comparison charts ---------- */

  function drawChart(container, side, colour, title) {
    var rows = entries.filter(function (e) { return e.group.side === side; });
    var width = Math.max(Math.floor(container.clientWidth), 280);
    var compact = width < 560;                           // on narrow screens only the right-hand labels are shown
    var gap = 6, minPitch = 17, nodeW = compact ? 10 : 14, top = 24, bodyH = 200;
    var before = 0, now = 0;
    rows.forEach(function (e) { before += e.baseline; now += e.amount; });
    var scale = bodyH / Math.max(before * 1.1, now);
    var leftX = compact ? 8 : 190;
    var labelX = compact ? width - 170 + nodeW + 6 : width - 215;
    var rightX = compact ? width - 170 : labelX - 6 - nodeW;
    var height = top + bodyH + rows.length * minPitch + 8;
    var ribbons = "", nodes = "", labels = "", summary = [];
    var yLeft = top, yRight = top;

    rows.forEach(function (e) {
      var hL = Math.max(e.baseline * scale, 1.5), hR = Math.max(e.amount * scale, 1.5);
      var change = e.amount - e.baseline, changed = Math.abs(change) >= 0.05;
      var name = e.item.chartLabel || e.item.label;
      var mid = (leftX + nodeW + rightX) / 2;
      ribbons += '<path d="M' + (leftX + nodeW) + " " + yLeft + "C" + mid + " " + yLeft + "," + mid + " " + yRight + "," + rightX + " " + yRight +
        "L" + rightX + " " + (yRight + hR) + "C" + mid + " " + (yRight + hR) + "," + mid + " " + (yLeft + hL) + "," + (leftX + nodeW) + " " + (yLeft + hL) +
        'Z" fill="' + colour + '" fill-opacity="' + (changed ? 0.6 : 0.28) + '"/>';
      nodes += '<rect x="' + leftX + '" y="' + yLeft + '" width="' + nodeW + '" height="' + hL + '" rx="2" fill="' + colour + '"/>' +
               '<rect x="' + rightX + '" y="' + yRight + '" width="' + nodeW + '" height="' + hR + '" rx="2" fill="' + colour + '"/>';
      if (!compact) {
        labels += '<text x="' + (leftX - 6) + '" y="' + (yLeft + hL / 2) + '" text-anchor="end" dominant-baseline="central">' + name + " " + bn(e.baseline) + "</text>";
      }
      labels += '<text x="' + labelX + '" y="' + (yRight + hR / 2) + '" dominant-baseline="central">' + name + " " + bn(e.amount) + (changed ? " (" + signedBn(change) + ")" : "") + "</text>";
      summary.push(name + " " + bn(e.baseline) + " to " + bn(e.amount));
      yLeft += Math.max(hL + gap, minPitch);
      yRight += Math.max(hR + gap, minPitch);
    });

    var heads = '<text x="' + leftX + '" y="12" class="flow-muted">' + config.baselineLabel + " " + bn(before) + "</text>" +
                '<text x="' + rightX + '" y="12" class="flow-muted">' + config.yourLabel + " " + bn(now) + "</text>";
    var label = title + ", " + config.baselineLabel.toLowerCase() + " and your figures: " + summary.join("; ");
    container.innerHTML = '<svg viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height +
      '" role="img" aria-label="' + label + '"><title>' + label + "</title>" + ribbons + nodes + heads + labels + "</svg>";
  }

  function drawCharts() {
    drawChart(document.getElementById("chart-income"), "income", "#1D9E75", "Income");
    drawChart(document.getElementById("chart-spending"), "spending", "#D85A30", "Spending");
  }

  /* ---------- 6. Start-up, reset and resize ---------- */

  function reset() {
    entries.forEach(function (entry) {
      entry.state = JSON.parse(JSON.stringify(entry.defaults));
      entry.type.controls(entry.item, entry.state).forEach(function (control) {
        document.getElementById("ctl-" + entry.item.id + "-" + control.key).value = entry.state[control.key];
      });
    });
    update();
  }

  function start() {
    document.getElementById("page-title").textContent = config.title;
    document.getElementById("page-intro").textContent = config.intro;
    document.title = config.title;
    buildItems();

    var totals = calculate();                            // the starting figures are the baseline for the charts
    baselineSpending = totals.spending;
    entries.forEach(function (entry) { entry.baseline = entry.amount; });

    buildControls(document.getElementById("controls"));
    document.getElementById("reset").addEventListener("click", reset);
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawCharts, 150);
    });
    update();
  }

  document.addEventListener("DOMContentLoaded", start);

  // Exposed so that other scripts can add types or read the figures.
  window.BudgetEngine = {
    types: types,
    entries: entries,
    update: update,
    reset: reset
  };
})();
