/* CoatMath math: pure functions, no DOM. Works in the browser (window.CMCalc) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CMCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var r3 = function (x) { return Math.round(x * 1000) / 1000; };
  var num = function (x) { x = +x; return isFinite(x) ? x : 0; };
  var pos = function (x) { return Math.max(0, num(x)); };

  // Typical 2026 US mid-grade interior prices. Defaults only: every one is editable in the UI.
  var PRICES = { paint: { gal: 45, qt: 20, bucket: 200 }, primer: { gal: 30, qt: 15, bucket: 120 } };
  var COVERAGE = { wall: 350, ceiling: 350, primer: 250, trim: 350 };
  var COVER_PRESETS = [['Smooth', 400], ['Standard', 350], ['New drywall', 300], ['Textured / rough', 250]];
  var OPENING = { door: 20, window: 15, garage: 112 };
  var STORY_FT = 10;
  var TRIM_IN = 4; // trim width used for the trim estimate
  var DOOR_W = 3, DOOR_CASING_FT = 17, WINDOW_CASING_FT = 14; // door 3 ft wide, casing 7+7+3 ft; window casing ~3x4 ft = 14 ft
  var SIDING = { smooth: ['Smooth siding (vinyl, fiber cement)', 350], clapboard: ['Wood clapboard', 300], rough: ['Rough cedar', 250], stucco: ['Stucco or brick', 200] };

  // ---------- areas ----------
  function wallArea(room) { // gross wall area of a rectangular room: perimeter x height
    return 2 * (pos(room.l) + pos(room.w)) * pos(room.h);
  }
  function openingsArea(o) { // o: {doors, windows, doorSize, windowSize, garage, garageSize}
    o = o || {};
    return pos(o.doors) * (o.doorSize == null ? OPENING.door : pos(o.doorSize)) +
      pos(o.windows) * (o.windowSize == null ? OPENING.window : pos(o.windowSize)) +
      pos(o.garage) * (o.garageSize == null ? OPENING.garage : pos(o.garageSize));
  }
  function netArea(gross, openings) { // openings: a number (sq ft) or an array of numbers
    var o = Array.isArray(openings) ? openings.reduce(function (a, b) { return a + num(b); }, 0) : num(openings);
    return Math.max(0, num(gross) - o);
  }
  function roomNet(room, ob) { return netArea(wallArea(room), openingsArea({ doors: room.doors, windows: room.windows, doorSize: ob && ob.doorSize, windowSize: ob && ob.windowSize })); }
  function ceilingArea(l, w) { return pos(l) * pos(w); }
  function vaultedCeilingArea(l, w, rise) { // two sloped planes: each run is w/2, slope length = sqrt((w/2)^2 + rise^2)
    return 2 * pos(l) * Math.sqrt(Math.pow(pos(w) / 2, 2) + Math.pow(pos(rise), 2));
  }
  function gableArea(w, rise) { return 0.5 * pos(w) * pos(rise); }
  function exteriorArea(h) { // h: {perimeter | l,w, height | stories, gables:[{w,rise}], doors, windows, garage, ...sizes}
    var per = h.perimeter != null && h.perimeter !== '' ? pos(h.perimeter) : 2 * (pos(h.l) + pos(h.w));
    var ht = h.height != null && h.height !== '' && pos(h.height) > 0 ? pos(h.height) : pos(h.stories || 1) * STORY_FT;
    var walls = per * ht, gables = (h.gables || []).reduce(function (a, g) { return a + gableArea(g.w, g.rise); }, 0);
    var open = openingsArea(h), gross = walls + gables;
    return { perimeter: per, height: ht, walls: walls, gables: gables, gross: gross, openings: open, net: Math.max(0, gross - open) };
  }
  function trimArea(room) { // baseboard (perimeter minus door widths) + door/window casing, times TRIM_IN inches wide
    var doors = pos(room.doors), wins = pos(room.windows);
    var base = Math.max(0, 2 * (pos(room.l) + pos(room.w)) - doors * DOOR_W);
    var feet = base + doors * DOOR_CASING_FT + wins * WINDOW_CASING_FT;
    return { feet: feet, area: feet * TRIM_IN / 12 };
  }

  // ---------- gallons ----------
  function gallonsNeeded(area, coats, coverage, wastePct) {
    var cv = pos(coverage); if (!cv) return 0;
    return pos(area) * Math.max(0, num(coats)) / cv * (1 + pos(wastePct) / 100);
  }

  // ---------- can mix ----------
  // Cheapest mix of 5-gal buckets, 1-gal cans and quarts covering `gallons`. Works in quarter-gallon units
  // (quart = 1, gallon = 4, bucket = 20) with an exact DP. Ties: fewer containers, then less leftover.
  function canMix(gallons, prices) {
    var p = prices || PRICES.paint, need = Math.max(0, num(gallons));
    var N = Math.ceil(need * 4 - 1e-9);
    var c = { q: Math.round(pos(p.qt) * 100), g: Math.round(pos(p.gal) * 100), b: Math.round(pos(p.bucket) * 100) };
    var out = function (b, g, q, cost) {
      var cap = b * 5 + g + q / 4;
      return { bucket: b, gal: g, qt: q, cost: r2(cost / 100), capacity: cap, leftover: r3(Math.max(0, cap - need)), containers: b + g + q, label: mixLabel(b, g, q) };
    };
    if (N <= 0) return out(0, 0, 0, 0);
    var INF = Infinity, M = N + 20, cost = new Array(M + 1), cnt = new Array(M + 1), from = new Array(M + 1), i;
    for (i = 0; i <= M; i++) { cost[i] = INF; cnt[i] = 0; from[i] = null; }
    cost[0] = 0;
    var items = [[1, c.q, 'q'], [4, c.g, 'g'], [20, c.b, 'b']];
    for (i = 1; i <= M; i++) items.forEach(function (it) {
      var j = i - it[0]; if (j < 0 || cost[j] === INF) return;
      var cc = cost[j] + it[1], n = cnt[j] + 1;
      if (cc < cost[i] || (cc === cost[i] && n < cnt[i])) { cost[i] = cc; cnt[i] = n; from[i] = it[2]; }
    });
    var best = -1;
    for (i = N; i <= M; i++) {
      if (cost[i] === INF) continue;
      if (best < 0 || cost[i] < cost[best] || (cost[i] === cost[best] && cnt[i] < cnt[best])) best = i;
    }
    var b = 0, g = 0, q = 0, k = best;
    while (k > 0) { var f = from[k]; if (f === 'q') { q++; k -= 1; } else if (f === 'g') { g++; k -= 4; } else { b++; k -= 20; } }
    return out(b, g, q, cost[best]);
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function mixLabel(b, g, q) {
    var parts = [];
    if (b) parts.push(plural(b, 'five-gallon bucket'));
    if (g) parts.push(plural(g, 'gallon'));
    if (q) parts.push(plural(q, 'quart'));
    return parts.length ? parts.join(' + ') : 'nothing';
  }
  function roundUp(gallons, prices) { // the "just buy whole gallons" alternative
    var p = prices || PRICES.paint, need = Math.max(0, num(gallons)), n = Math.ceil(need - 1e-9);
    return { gal: n, cost: r2(n * pos(p.gal)), leftover: r3(n - need), label: n ? plural(n, 'gallon') : 'nothing' };
  }
  function line(o) { // one shopping-list line: {label, area, coats, coverage, waste, prices}
    var gal = gallonsNeeded(o.area, o.coats, o.coverage, o.waste), mix = canMix(gal, o.prices), up = roundUp(gal, o.prices);
    return { label: o.label, area: r2(pos(o.area)), coats: o.coats, coverage: o.coverage, gallons: gal, mix: mix, roundUp: up };
  }
  function scalePrices(base, gal) { // scale quart and bucket prices from a new gallon price (used by the grade presets)
    var k = pos(gal) / base.gal; return { gal: r2(gal), qt: r2(base.qt * k), bucket: r2(base.bucket * k) };
  }
  // The "buy this" summary for a list of lines
  function summary(lines) {
    var lns = lines.filter(function (l) { return l.area > 0; });
    var tot = lns.reduce(function (a, l) { a.area += l.area; a.gallons += l.gallons; a.cost += l.mix.cost; a.leftover += l.mix.leftover; a.up += l.roundUp.cost; return a; }, { area: 0, gallons: 0, cost: 0, leftover: 0, up: 0 });
    return { lines: lns, area: r2(tot.area), gallons: tot.gallons, cost: r2(tot.cost), leftover: r3(tot.leftover), roundUpCost: r2(tot.up) };
  }

  // ---------- square footage ----------
  var TO_FT = { ft: 1, in: 1 / 12, yd: 3, m: 1 / 0.3048, cm: 1 / 30.48 };
  var SQFT_PER_M2 = 10.763910416709722;
  function toFeet(v, unit) { return num(v) * (TO_FT[unit] || 1); }
  function sqftToSqyd(x) { return x / 9; }
  function sqftToM2(x) { return x * 0.09290304; }
  function shapeArea(s) { // s: {type, a, b, c, d, unit}; all lengths in s.unit, result in sq ft
    var u = s.unit || 'ft', a = toFeet(s.a, u), b = toFeet(s.b, u), c = toFeet(s.c, u), d = toFeet(s.d, u);
    switch (s.type) {
      case 'rect': return a * b;
      case 'lshape': return Math.max(0, a * b - c * d); // outer length a x width b, minus the notch c x d
      case 'circle': return Math.PI * Math.pow(a / 2, 2); // a = diameter
      case 'tri': return 0.5 * a * b; // base a, height b
      default: return 0;
    }
  }
  function squareFootage(shapes, costPerSqft) {
    var total = 0, parts = (shapes || []).map(function (s) {
      var sign = s.sign === -1 || s.sign === '-' ? -1 : 1, ar = shapeArea(s) * sign; total += ar; return ar;
    });
    total = Math.max(0, total);
    return { sqft: total, sqyd: sqftToSqyd(total), m2: sqftToM2(total), parts: parts, cost: costPerSqft ? r2(total * pos(costPerSqft)) : null };
  }

  // ---------- DIY vs pro ----------
  function diyCost(paintCost, primerCost, supplies) { return r2(num(paintCost) + num(primerCost) + pos(supplies)); }
  function proCost(area, perSqft, total) { return pos(total) > 0 ? r2(pos(total)) : (pos(perSqft) > 0 ? r2(pos(area) * pos(perSqft)) : null); }

  return { r2: r2, r3: r3, PRICES: PRICES, COVERAGE: COVERAGE, COVER_PRESETS: COVER_PRESETS, OPENING: OPENING, STORY_FT: STORY_FT, TRIM_IN: TRIM_IN, SIDING: SIDING,
    DOOR_W: DOOR_W, DOOR_CASING_FT: DOOR_CASING_FT, WINDOW_CASING_FT: WINDOW_CASING_FT,
    wallArea: wallArea, openingsArea: openingsArea, netArea: netArea, roomNet: roomNet, ceilingArea: ceilingArea, vaultedCeilingArea: vaultedCeilingArea,
    gableArea: gableArea, exteriorArea: exteriorArea, trimArea: trimArea, gallonsNeeded: gallonsNeeded, canMix: canMix, mixLabel: mixLabel, roundUp: roundUp,
    line: line, summary: summary, scalePrices: scalePrices, toFeet: toFeet, sqftToSqyd: sqftToSqyd, sqftToM2: sqftToM2, SQFT_PER_M2: SQFT_PER_M2,
    shapeArea: shapeArea, squareFootage: squareFootage, diyCost: diyCost, proCost: proCost };
});
