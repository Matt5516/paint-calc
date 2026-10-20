/* CoatMath UI: one script for all seven tools (form[data-tool]). Math lives in calc.js. State goes in the URL. */
addEventListener('DOMContentLoaded', function () { 'use strict';
  var C = window.CMCalc, form = document.getElementById('cmForm'); if (!form) return;
  var $ = function (i) { return document.getElementById(i); }, n = UI.num, tool = form.dataset.tool;
  var out = $('cmOut'), last = '';
  function fmt(x, dp) { return (Math.round(x * Math.pow(10, dp || 0)) / Math.pow(10, dp || 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp || 0 }); }
  function d2(x) { return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function m(x) { return UI.money(x, Math.abs(x - Math.round(x)) < 0.005); }
  function esc(s) { return UI.esc(s); }
  function stat(k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function prices(p) { return { gal: n(p + 'g'), qt: n(p + 'q'), bucket: n(p + 'b') }; }

  // ---------- generic row editor (rooms, walls, shapes) ----------
  function editor(o) {
    var box = $(o.box), uid = 0, hid = $(o.hidden);
    function parse(s) { return s.split('|').filter(Boolean).map(function (r) { return r.split(':'); }); }
    function field(f, v, id) {
      if (f.hide) return '';
      if (f.opts) return '<div class="' + (f.cls || '') + '"><label for="' + id + '">' + f.label + '</label><select id="' + id + '" data-i="' + f.i + '">' + f.opts.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === v ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>';
      return '<div class="' + (f.cls || '') + '"><label for="' + id + '">' + f.label + '</label><input id="' + id + '" data-i="' + f.i + '" type="number" inputmode="decimal" min="0" step="' + (f.step || 'any') + '" value="' + esc(v == null ? '' : v) + '"></div>';
    }
    function fill(el, vals) {
      var idx = box.children.length; for (var k = 0; k < box.children.length; k++) if (box.children[k] === el) idx = k;
      var fs = o.fields(vals), id = ++uid;
      el.setAttribute('aria-label', o.noun + ' ' + (idx + 1));
      el.innerHTML = '<div class="cm-t"><b>' + o.noun + ' ' + (idx + 1) + '</b><span data-sum></span></div>' + fs.map(function (f) { return field(f, vals[f.i], 'f' + id + '_' + f.i); }).join('') +
        '<button type="button" class="icon-btn rm" aria-label="Remove ' + o.noun.toLowerCase() + ' ' + (idx + 1) + '"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>';
    }
    function add(vals) { var el = document.createElement('div'); el.className = 'cm-row'; el.setAttribute('role', 'group'); box.appendChild(el); fill(el, vals); return el; }
    function read() {
      return Array.prototype.map.call(box.children, function (el) {
        var v = []; el.querySelectorAll('[data-i]').forEach(function (x) { v[+x.dataset.i] = x.value; });
        for (var i = 0; i < o.width; i++) if (v[i] == null) v[i] = (el._v && el._v[i]) || ''; el._v = v.slice(); return v;
      });
    }
    function set(rows) { box.innerHTML = ''; rows.forEach(function (r) { var el = add(r); el._v = r.slice(); }); }
    function enc(rows) { return rows.map(function (r) { return r.join(':'); }).join('|'); }
    function rowsFromHidden() { var r = parse(hid.value); return r.length ? r : o.def.map(function (x) { return x.slice(); }); }
    set(rowsFromHidden());
    $(o.addBtn).addEventListener('click', function () { var rows = read(), prev = rows[rows.length - 1] || o.def[0]; var nv = o.blank ? o.blank(prev) : o.def[0].slice(); var el = add(nv); el._v = nv.slice(); var f = el.querySelector('input'); if (f) f.focus(); form.dispatchEvent(new Event('input', { bubbles: true })); });
    box.addEventListener('click', function (e) { var b = e.target.closest('.rm'); if (!b) return; var rows = read(), i = Array.prototype.indexOf.call(box.children, b.closest('.cm-row'));
      rows.splice(i, 1); if (!rows.length) rows = [o.blank ? o.blank(o.def[0]) : o.def[0].slice()]; set(rows); form.dispatchEvent(new Event('input', { bubbles: true })); });
    if (o.onType) box.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.i === String(o.typeIdx)) { var el = e.target.closest('.cm-row'), v = read()[Array.prototype.indexOf.call(box.children, el)]; fill(el, v); el._v = v.slice(); } });
    return { read: read, enc: enc, def: enc(o.def), box: box, hid: hid };
  }
  function num(x) { x = parseFloat(x); return isFinite(x) ? x : 0; }

  // ---------- diagrams ----------
  var FILL = 'color-mix(in srgb,var(--brand) 20%,transparent)', ST = 'var(--brand)', OPEN = 'color-mix(in srgb,var(--ink) 18%,transparent)';
  function strip(segs, label) { // flattened walls side by side: segs [{w,h,doors,windows,name}]
    var tw = segs.reduce(function (a, s) { return a + s.w; }, 0), mh = Math.max.apply(null, segs.map(function (s) { return s.h; }).concat([1]));
    if (!(tw > 0)) return '';
    var W = 360, k = Math.min((W - 20 - 4 * (segs.length - 1)) / tw, 110 / mh), x = 10, base = 128, s = '<svg class="chart cm-dia" viewBox="0 0 ' + W + ' 168" role="img" aria-label="' + esc(label) + '">';
    segs.forEach(function (g, i) {
      var w = g.w * k, h = g.h * k, y = base - h; s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" style="fill:' + FILL + ';stroke:' + ST + '" stroke-width="2"/>';
      var cur = 1, ops = []; for (var a = 0; a < Math.min(g.doors, 6); a++) ops.push([3, 6.67, 0, 'd']); for (a = 0; a < Math.min(g.windows, 10); a++) ops.push([3, 5, 2.5, 'w']);
      ops.forEach(function (p) { if (cur + p[0] + 0.5 <= g.w) { s += '<rect x="' + (x + cur * k).toFixed(1) + '" y="' + (base - (p[2] + Math.min(p[1], g.h - p[2])) * k).toFixed(1) + '" width="' + (p[0] * k).toFixed(1) + '" height="' + (Math.min(p[1], g.h - p[2]) * k).toFixed(1) + '" rx="2" style="fill:' + (p[3] === 'd' ? 'var(--accent)' : OPEN) + ';stroke:' + ST + '" stroke-width="1"/>'; cur += p[0] + 1; } });
      s += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (base + 15) + '" text-anchor="middle">' + fmt(g.w, 1) + ' ft</text>';
      if (i === 0) s += '<text x="' + (x + 4) + '" y="' + (y - 5).toFixed(1) + '">' + fmt(g.h, 1) + ' ft high</text>'; x += w + 4;
    });
    return s + '<text x="180" y="162" text-anchor="middle">' + esc(label) + ' · yellow = door, grey = window</text></svg>';
  }
  function topdown(l, w, label) {
    if (!(l > 0 && w > 0)) return ''; var k = Math.min(300 / l, 100 / w), rw = l * k, rh = w * k, x = (360 - rw) / 2, y = 14 + (100 - rh) / 2;
    return '<svg class="chart cm-dia" viewBox="0 0 360 150" role="img" aria-label="' + esc(label) + '"><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + rw.toFixed(1) + '" height="' + rh.toFixed(1) + '" rx="4" style="fill:' + FILL + ';stroke:' + ST + '" stroke-width="3"/>' +
      '<text x="180" y="' + (y + rh / 2 + 4).toFixed(1) + '" text-anchor="middle">' + fmt(l * w, 0) + ' sq ft</text><text x="180" y="' + (y + rh + 16).toFixed(1) + '" text-anchor="middle">' + fmt(l, 1) + ' ft</text><text x="' + (x - 6).toFixed(1) + '" y="' + (y + rh / 2 + 4).toFixed(1) + '" text-anchor="end">' + fmt(w, 1) + ' ft</text></svg>';
  }
  function vaultSvg(w, rise, l) {
    if (!(w > 0 && rise > 0)) return ''; var k = Math.min(240 / w, 100 / rise), x = 60, base = 128, pw = w * k, ph = rise * k;
    return '<svg class="chart cm-dia" viewBox="0 0 360 160" role="img" aria-label="Vaulted ceiling side view"><polygon points="' + x + ',' + base + ' ' + (x + pw / 2) + ',' + (base - ph) + ' ' + (x + pw) + ',' + base + '" style="fill:' + FILL + ';stroke:' + ST + '" stroke-width="3"/>' +
      '<text x="' + (x + pw / 2) + '" y="' + (base + 16) + '" text-anchor="middle">' + fmt(w, 1) + ' ft across</text><text x="' + (x + pw / 2 + 6) + '" y="' + (base - ph / 2) + '">' + fmt(rise, 1) + ' ft rise</text><text x="180" y="156" text-anchor="middle">Side view · each slope runs ' + fmt(l, 1) + ' ft long</text></svg>';
  }
  function house(ex, label) {
    var w = Math.max(ex.perimeter / 4, 1), h = ex.height; if (!(ex.perimeter > 0 && h > 0)) return '';
    var k = Math.min(260 / w, 100 / (h + (ex.gables > 0 ? 6 : 0))), pw = w * k, ph = h * k, x = (360 - pw) / 2, base = 140, y = base - ph, s = '<svg class="chart cm-dia" viewBox="0 0 360 168" role="img" aria-label="' + esc(label) + '">';
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + ph.toFixed(1) + '" style="fill:' + FILL + ';stroke:' + ST + '" stroke-width="2.5"/>';
    if (ex.gables > 0) s += '<polygon points="' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + pw / 2).toFixed(1) + ',' + (y - 6 * k).toFixed(1) + ' ' + (x + pw).toFixed(1) + ',' + y.toFixed(1) + '" style="fill:' + FILL + ';stroke:' + ST + '" stroke-width="2.5"/>';
    s += '<rect x="' + (x + pw * 0.45).toFixed(1) + '" y="' + (base - 7 * k).toFixed(1) + '" width="' + (3 * k).toFixed(1) + '" height="' + (7 * k).toFixed(1) + '" style="fill:var(--accent);stroke:' + ST + '"/>';
    var wc = Math.min(4, Math.max(1, Math.round(ex.windowsCount || 0))); for (var i = 0; i < wc; i++) s += '<rect x="' + (x + pw * (0.08 + i * 0.12)).toFixed(1) + '" y="' + (y + ph * 0.3).toFixed(1) + '" width="' + (3 * k).toFixed(1) + '" height="' + (4 * k).toFixed(1) + '" style="fill:' + OPEN + ';stroke:' + ST + '"/>';
    return s + '<text x="180" y="162" text-anchor="middle">' + esc(label) + '</text></svg>';
  }

  // ---------- shared result panel ----------
  function panel(sum, o) {
    o = o || {}; var L = sum.lines, h = '';
    if (!L.length) return '<div class="empty">' + UI.icon('chart') + '<p><strong>' + (o.empty || 'Add your measurements') + '</strong><br>Your cans show up here as you type.</p></div>';
    var one = L.length === 1, big;
    if (one) big = 'Buy ' + esc(L[0].mix.label) + ' of ' + esc(L[0].label.toLowerCase()) + ', about ' + m(sum.cost) + '.';
    else big = 'Your shopping list: about ' + m(sum.cost) + '.';
    h += '<h2>' + UI.icon('check') + 'Buy this</h2>';
    h += '<div class="verdict good"><span class="vicon">' + UI.icon('check') + '</span><div><strong class="big">' + big + '</strong><span>' +
      (one ? 'You need ' + d2(L[0].gallons) + ' gallons. This mix holds ' + d2(L[0].mix.capacity) + ', so about ' + d2(L[0].mix.leftover) + ' gallon is left over.' :
        L.map(function (l) { return esc(l.mix.label) + ' of ' + esc(l.label.toLowerCase()); }).join(' · ')) + '</span></div></div>';
    h += '<div class="stats s3">' + stat('Area to cover', fmt(sum.area, 0) + ' sq ft') + stat('Gallons needed (exact)', d2(sum.gallons)) + stat('Cost of this mix', m(sum.cost)) + '</div>';
    h += '<div class="stats">' + stat('Leftover', '~' + d2(sum.leftover) + ' gal') + stat('Round up to whole gallons', m(sum.roundUpCost)) + '</div>';
    var diff = sum.roundUpCost - sum.cost;
    h += '<p class="cm-alt"><strong>Round-up alternative:</strong> ' + L.map(function (l) { return esc(l.roundUp.label) + ' of ' + esc(l.label.toLowerCase()); }).join(', ') + ' costs ' + m(sum.roundUpCost) +
      (diff > 0.004 ? ', so the mix above saves ' + m(diff) + '.' : diff < -0.004 ? ', which is ' + m(-diff) + ' less than the mix, but you would run short. Stick with the mix.' : ', the same price as the mix.') + '</p>';
    if (!one || o.table) h += '<div class="table-scroll"><table class="cm-tbl"><caption class="sr-only">Shopping list</caption><thead><tr><th scope="col">Item</th><th scope="col" class="r">Sq ft</th><th scope="col" class="r">Gallons</th><th scope="col">Buy</th><th scope="col" class="r">Cost</th></tr></thead><tbody>' +
      L.map(function (l) { return '<tr><td>' + esc(l.label) + '</td><td class="r">' + fmt(l.area, 0) + '</td><td class="r">' + d2(l.gallons) + '</td><td>' + esc(l.mix.label) + '</td><td class="r">' + m(l.mix.cost) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="r">' + fmt(sum.area, 0) + '</td><td class="r">' + d2(sum.gallons) + '</td><td></td><td class="r">' + m(sum.cost) + '</td></tr></tfoot></table></div>';
    if (o.after) h += o.after;
    if (o.diagram) h += o.diagram;
    h += '<p class="hint">' + (o.note || '') + ' Prices are typical 2026 US figures. Swap in your store’s. Check the coverage on your can’s label.</p>';
    h += '<div class="actions no-print"><button type="button" class="btn ghost sm" data-print>' + UI.icon('copy') + 'Print shopping list</button><button type="button" class="btn ghost sm" id="copySum">' + UI.icon('copy') + 'Copy list</button></div>';
    last = 'CoatMath shopping list: ' + L.map(function (l) { return l.mix.label + ' of ' + l.label.toLowerCase() + ' (' + d2(l.gallons) + ' gal needed)'; }).join('; ') + '. About ' + m(sum.cost) + '. ' + location.href;
    return h;
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#copySum')) UI.copy(last, 'Shopping list copied'); });

  function show() { // [data-show="id=a|b"] elements appear only for those values
    form.querySelectorAll('[data-show]').forEach(function (el) { var p = el.dataset.show.split('='), v = $(p[0]) ? $(p[0]).value : ''; el.hidden = p[1].split('|').indexOf(v) < 0; });
  }
  function validate() {
    var bad = 0; form.querySelectorAll('input[type=number]').forEach(function (el) { var b = el.value !== '' && (+el.value < 0 || !isFinite(+el.value)); el.setAttribute('aria-invalid', b ? 'true' : 'false'); if (b) bad++; }); return bad;
  }
  var ALERT = '<div class="alert err">' + UI.icon('alert') + '<div>Negative or invalid numbers. Fix the highlighted fields.</div></div>';
  function coats() { return Math.max(1, Math.min(4, Math.round(n('co')) || 1)); }
  function wasteP() { return n('ws'); }

  // ---------- tools ----------
  var T = {}, ed = {};

  T.paint = {
    init: function () {
      ed.rooms = editor({ box: 'rooms', addBtn: 'addRoom', hidden: 'rm', noun: 'Room', width: 5, def: [['12', '12', '8', '1', '2']], blank: function (p) { return ['', '', p[2] || '8', '0', '0']; },
        fields: function () { return [{ i: 0, label: 'Length ft', cls: 's3' }, { i: 1, label: 'Width ft', cls: 's3' }, { i: 2, label: 'Wall height ft', cls: 's3' }, { i: 3, label: 'Doors', step: 1, cls: 's3' }, { i: 4, label: 'Windows', step: 1, cls: 's3' }]; } });
    },
    run: function () {
      var rows = ed.rooms.read(), ds = n('ds'), wz = n('wz'), cv = n('cv'), co = coats(), ws = wasteP(), P = prices('p'), R = prices('r');
      var rooms = rows.map(function (r) { return { l: num(r[0]), w: num(r[1]), h: num(r[2]), doors: num(r[3]), windows: num(r[4]) }; });
      var walls = 0, ceil = 0, trim = 0, per = [];
      rooms.forEach(function (r, i) { var g = C.wallArea(r), o = C.openingsArea({ doors: r.doors, windows: r.windows, doorSize: ds, windowSize: wz }), net = C.netArea(g, o); walls += net; ceil += C.ceilingArea(r.l, r.w); trim += C.trimArea(r).area;
        per.push({ g: g, o: o, net: net, gal: C.gallonsNeeded(net, co, cv, ws) });
        var s = form.querySelectorAll('#rooms [data-sum]')[i]; if (s) s.textContent = net ? fmt(net, 0) + ' sq ft of wall' : ''; });
      var lines = [C.line({ label: 'Wall paint', area: walls, coats: co, coverage: cv, waste: ws, prices: P })];
      var useCeil = $('ce').value === '1', usePr = $('pr').value === '1', useTrim = $('tr').value === '1';
      if (useCeil) lines.push(C.line({ label: 'Ceiling paint', area: ceil, coats: co, coverage: n('cc'), waste: ws, prices: P }));
      if (usePr) lines.push(C.line({ label: 'Primer', area: walls + (useCeil ? ceil : 0), coats: 1, coverage: n('pc'), waste: ws, prices: R }));
      if (useTrim) lines.push(C.line({ label: 'Trim paint', area: trim, coats: co, coverage: cv, waste: ws, prices: P }));
      var sum = C.summary(lines), after = '';
      if (rooms.length > 1) after = '<div class="table-scroll"><table class="cm-tbl"><caption class="sr-only">Wall paint by room</caption><thead><tr><th scope="col">Room</th><th scope="col" class="r">Gross sq ft</th><th scope="col" class="r">Openings</th><th scope="col" class="r">Wall sq ft</th><th scope="col" class="r">Gallons</th></tr></thead><tbody>' +
        per.map(function (p, i) { return '<tr><td>Room ' + (i + 1) + '</td><td class="r">' + fmt(p.g, 0) + '</td><td class="r">−' + fmt(p.o, 0) + '</td><td class="r">' + fmt(p.net, 0) + '</td><td class="r">' + d2(p.gal) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="r">' + fmt(per.reduce(function (a, p) { return a + p.g; }, 0), 0) + '</td><td class="r">−' + fmt(per.reduce(function (a, p) { return a + p.o; }, 0), 0) + '</td><td class="r">' + fmt(walls, 0) + '</td><td class="r">' + d2(per.reduce(function (a, p) { return a + p.gal; }, 0)) + '</td></tr></tfoot></table></div>';
      var r0 = rooms[0], g0 = C.wallArea(r0);
      var w4 = [r0.l, r0.w, r0.l, r0.w].map(function (w) { return { w: w, h: r0.h, doors: 0, windows: 0 }; }), oi = 0, q; for (q = 0; q < Math.min(r0.doors || 0, 8); q++) w4[oi++ % 4].doors++; for (q = 0; q < Math.min(r0.windows || 0, 16); q++) w4[oi++ % 4].windows++;
      var dia = strip(w4, 'Room 1 walls laid flat') || '';
      var note = 'Wall area = perimeter × height − doors − windows (' + fmt(g0, 0) + ' − ' + fmt(per[0].o, 0) + ' = ' + fmt(per[0].net, 0) + ' sq ft for room 1). Gallons = area × coats ÷ coverage.' + (useTrim ? ' Trim = baseboard + door and window casing, about ' + C.TRIM_IN + ' in wide (' + fmt(trim, 0) + ' sq ft).' : '');
      return panel(sum, { after: after, diagram: dia, note: note, empty: 'Add a room’s length, width and height' });
    } };

  T.wall = {
    init: function () {
      ed.walls = editor({ box: 'walls', addBtn: 'addWall', hidden: 'wl', noun: 'Wall', width: 4, def: [['12', '8', '0', '0']], blank: function (p) { return ['', p[1] || '8', '0', '0']; },
        fields: function () { return [{ i: 0, label: 'Width ft', cls: 's3' }, { i: 1, label: 'Height ft', cls: 's3' }, { i: 2, label: 'Doors', step: 1, cls: 's3' }, { i: 3, label: 'Windows', step: 1, cls: 's3' }]; } });
    },
    run: function () {
      var rows = ed.walls.read(), ds = n('ds'), wz = n('wz'), co = coats(), cv = n('cv'), ws = wasteP(), P = prices('p'), R = prices('r');
      var segs = rows.map(function (r) { return { w: num(r[0]), h: num(r[1]), doors: num(r[2]), windows: num(r[3]) }; }), tot = 0;
      segs.forEach(function (s, i) { var net = C.netArea(s.w * s.h, C.openingsArea({ doors: s.doors, windows: s.windows, doorSize: ds, windowSize: wz })); tot += net; var el = form.querySelectorAll('#walls [data-sum]')[i]; if (el) el.textContent = net ? fmt(net, 0) + ' sq ft' : ''; });
      var lines = [C.line({ label: segs.length === 1 ? 'Accent wall paint' : 'Wall paint', area: tot, coats: co, coverage: cv, waste: ws, prices: P })];
      if ($('pr').value === '1') lines.push(C.line({ label: 'Primer', area: tot, coats: 1, coverage: n('pc'), waste: ws, prices: R }));
      return panel(C.summary(lines), { diagram: strip(segs, 'Your walls laid flat'), note: 'Each wall is width × height minus its doors and windows.', empty: 'Add a wall’s width and height' });
    } };

  T.ceiling = {
    init: function () {},
    run: function () {
      var co = coats(), cv = n('cv'), ws = wasteP(), vault = $('ty').value === 'vaulted', P = prices('p'), R = prices('r'), area, dia = '', l = n('l'), w = n('w'), rise = n('rs');
      if ($('md').value === 'sf') area = n('sf');
      else if (vault) { area = C.vaultedCeilingArea(l, w, rise); dia = vaultSvg(w, rise, l); } else { area = C.ceilingArea(l, w); dia = topdown(l, w, 'Ceiling seen from below'); }
      var lines = [C.line({ label: 'Ceiling paint', area: area, coats: co, coverage: cv, waste: ws, prices: P })];
      if ($('pr').value === '1') lines.push(C.line({ label: 'Primer', area: area, coats: 1, coverage: n('pc'), waste: ws, prices: R }));
      return panel(C.summary(lines), { diagram: dia, note: vault && $('md').value !== 'sf' ? 'Vaulted: two slopes, each √((width ÷ 2)² + rise²) × length, so ' + fmt(area, 0) + ' sq ft instead of ' + fmt(l * w, 0) + ' flat.' : 'Ceiling area = length × width.', empty: 'Add the ceiling’s length and width' });
    } };

  T.exterior = {
    init: function () {},
    run: function () {
      var co = coats(), cv = n('cv'), ws = wasteP(), P = prices('p'), R = prices('r'), gn = Math.round(n('gn'));
      var gables = []; for (var i = 0; i < gn && i < 20; i++) gables.push({ w: n('gw'), rise: n('gr') });
      var ex = C.exteriorArea({ l: n('l'), w: n('w'), perimeter: n('pm') > 0 ? n('pm') : null, stories: n('st'), height: n('ht') > 0 ? n('ht') : null, gables: gables, doors: n('dr'), windows: n('wn'), garage: n('gd'), doorSize: n('ds'), windowSize: n('wz'), garageSize: n('gs') });
      var lines = [C.line({ label: 'Exterior paint', area: ex.net, coats: co, coverage: cv, waste: ws, prices: P })];
      if ($('pr').value === '1') lines.push(C.line({ label: 'Primer', area: ex.net, coats: 1, coverage: n('pc'), waste: ws, prices: R }));
      ex.windowsCount = n('wn');
      return panel(C.summary(lines), { diagram: house(ex, 'House side, schematic'), note: 'Walls ' + fmt(ex.perimeter, 0) + ' ft around × ' + fmt(ex.height, 1) + ' ft = ' + fmt(ex.walls, 0) + ' sq ft' + (ex.gables ? ', + gables ' + fmt(ex.gables, 0) + ' sq ft' : '') + ', − openings ' + fmt(ex.openings, 0) + ' = ' + fmt(ex.net, 0) + ' sq ft. Buckets are 5 gallons.', empty: 'Add the house length and width' });
    } };

  T.primer = {
    init: function () {},
    run: function () {
      var co = coats(), ws = wasteP(), R = prices('r'), area = n('ar');
      var line = C.line({ label: 'Primer', area: area, coats: co, coverage: n('cv'), waste: ws, prices: R });
      var tips = { drywall: 'New drywall is porous and soaks up paint. One coat of drywall primer evens it out so the paint color looks uniform.', glossy: 'Glossy surfaces need a bonding primer so the paint grips. Scuff-sand first and wipe off dust.', dark: 'Going dark to light: a primer (ideally tinted toward the new color) cuts the number of paint coats. PaintCare notes a very dark to very light change can take three or four coats.', stain: 'Stain-blocking primers seal water, smoke and marker stains. Stubborn stains may need a second coat; let the first dry fully.' };
      return panel(C.summary([line]), { note: (tips[$('sf').value] || '') + ' Coats and coverage are starting points. Check your primer’s label.', empty: 'Add the area to prime' });
    } };

  T.cost = {
    init: function () {},
    run: function () {
      var co = coats(), ws = wasteP(), area = Math.max(0, n('rc')) * Math.max(0, n('ra')), gp = n('gp');
      var P = C.scalePrices(C.PRICES.paint, gp), R = C.PRICES.primer, lines = [C.line({ label: 'Paint', area: area, coats: co, coverage: n('cv'), waste: ws, prices: P })];
      if ($('pr').value === '1') lines.push(C.line({ label: 'Primer', area: area, coats: 1, coverage: n('pc'), waste: ws, prices: R }));
      var sum = C.summary(lines), sup = n('su'), diy = C.diyCost(sum.cost, 0, sup), pro = C.proCost(area, n('pf'), n('pt')), after;
      after = '<div class="stats">' + stat('DIY: paint + supplies', m(diy)) + stat('Pro quote', pro == null ? 'Add a quote' : m(pro)) + '</div>';
      if (pro != null) after += '<p class="cm-alt"><strong>' + (pro > diy ? 'DIY costs ' + m(pro - diy) + ' less' : pro < diy ? 'The pro quote is ' + m(diy - pro) + ' less' : 'Same cost') + '</strong> before counting your time. Paint ' + m(sum.cost) + ' + supplies ' + m(sup) + ' = ' + m(diy) + '.</p>';
      else after += '<p class="cm-alt">Got a pro quote? Enter it above (a total, or a price per sq ft) to compare it with your DIY cost of ' + m(diy) + '. Paint ' + m(sum.cost) + ' + supplies ' + m(sup) + '.</p>';
      return panel(sum, { after: after, note: 'Your time isn’t priced in. Quart and bucket prices scale from your gallon price.', empty: 'Add rooms and wall area' });
    } };

  T.sqft = {
    init: function () {
      var U = [['ft', 'feet'], ['in', 'inches'], ['yd', 'yards'], ['m', 'meters']], TY = [['rect', 'Rectangle'], ['lshape', 'L-shape'], ['circle', 'Circle'], ['tri', 'Triangle']], SG = [['+', 'Add'], ['-', 'Subtract']];
      var LB = { rect: ['Length', 'Width'], lshape: ['Outer length', 'Outer width', 'Notch length', 'Notch width'], circle: ['Diameter'], tri: ['Base', 'Height'] };
      ed.shapes = editor({ box: 'shapes', addBtn: 'addShape', hidden: 'sh', noun: 'Area', width: 7, typeIdx: 0, onType: true, def: [['rect', 'ft', '+', '20', '15', '', '']], blank: function (p) { return ['rect', p[1] || 'ft', '+', '', '', '', '']; },
        fields: function (v) { var lb = LB[v[0]] || LB.rect; return [{ i: 0, label: 'Shape', opts: TY, cls: 's3' }, { i: 2, label: 'Add or subtract', opts: SG, cls: 's3' }, { i: 1, label: 'Units', opts: U, cls: 's3' },
          { i: 3, label: lb[0] + ' ' + '', cls: 's3' }, { i: 4, label: lb[1] || '', hide: !lb[1], cls: 's3' }, { i: 5, label: lb[2] || '', hide: !lb[2], cls: 's3' }, { i: 6, label: lb[3] || '', hide: !lb[3], cls: 's3' }]; } });
    },
    run: function () {
      var shapes = ed.shapes.read().map(function (r) { return { type: r[0], unit: r[1], sign: r[2] === '-' ? -1 : 1, a: num(r[3]), b: num(r[4]), c: num(r[5]), d: num(r[6]) }; });
      var res = C.squareFootage(shapes, n('cp') || 0);
      shapes.forEach(function (s, i) { var el = form.querySelectorAll('#shapes [data-sum]')[i]; if (el) el.textContent = (res.parts[i] < 0 ? '−' : '') + fmt(Math.abs(res.parts[i]), 2) + ' sq ft'; });
      if (!(res.sqft > 0)) { $('toPaint').hidden = true; return '<div class="empty">' + UI.icon('chart') + '<p><strong>Add your measurements</strong><br>Your total shows up here as you type.</p></div>'; }
      var f = shapes[0], rl, rw;
      if (shapes.length === 1 && f.type === 'rect') { rl = C.toFeet(f.a, f.unit); rw = C.toFeet(f.b, f.unit); } else { rl = rw = Math.sqrt(res.sqft); }
      var a = $('toPaintLink'); a.href = UI.root() + 'paint-calculator/?rm=' + [fmt(rl, 2).replace(/,/g, ''), fmt(rw, 2).replace(/,/g, ''), 8, 0, 0].join(':'); $('toPaint').hidden = false;
      $('toPaintTxt').textContent = shapes.length === 1 && f.type === 'rect' ? 'Treats it as a ' + fmt(rl, 1) + ' × ' + fmt(rw, 1) + ' ft room with 8 ft walls.' : 'Treats it as a square room of ' + fmt(rl, 1) + ' ft per side with 8 ft walls (edit it in the paint calculator).';
      var h = '<h2>' + UI.icon('chart') + 'Total area</h2><div class="verdict good"><span class="vicon">' + UI.icon('check') + '</span><div><strong class="big">' + fmt(res.sqft, 2) + ' square feet</strong><span>' + fmt(res.sqyd, 2) + ' square yards · ' + fmt(res.m2, 2) + ' square meters</span></div></div>';
      h += '<div class="stats s3">' + stat('Square feet', fmt(res.sqft, 2)) + stat('Square yards', fmt(res.sqyd, 2)) + stat('Square meters', fmt(res.m2, 2)) + '</div>';
      if (res.cost != null && n('cp') > 0) h += '<div class="stats">' + stat('Cost at ' + m(n('cp')) + ' per sq ft', m(res.cost)) + stat('Acres', fmt(res.sqft / 43560, 4)) + '</div>';
      if (shapes.length > 1) h += '<div class="table-scroll"><table class="cm-tbl"><caption class="sr-only">Areas</caption><thead><tr><th scope="col">Area</th><th scope="col">Shape</th><th scope="col" class="r">Sq ft</th></tr></thead><tbody>' + shapes.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc({ rect: 'Rectangle', lshape: 'L-shape', circle: 'Circle', tri: 'Triangle' }[s.type]) + (s.sign < 0 ? ' (subtract)' : '') + '</td><td class="r">' + (res.parts[i] < 0 ? '−' : '') + fmt(Math.abs(res.parts[i]), 2) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      h += '<p class="hint">Rectangle = length × width. L-shape = outer length × outer width − notch. Circle = π × (diameter ÷ 2)². Triangle = ½ × base × height. 1 sq yd = 9 sq ft.</p>';
      last = 'Area: ' + fmt(res.sqft, 2) + ' sq ft (' + fmt(res.sqyd, 2) + ' sq yd, ' + fmt(res.m2, 2) + ' m²). ' + location.href;
      h += '<div class="actions no-print"><button type="button" class="btn ghost sm" id="copySum">' + UI.icon('copy') + 'Copy result</button></div>';
      return h;
    } };

  // ---------- wire up ----------
  var tl = T[tool]; if (!tl) return;
  UI.readState();
  tl.init();
  var withSegs = UI.segs; if (withSegs) UI.segs(function () { render(); });
  UI.syncPresets && UI.syncPresets();
  // surface / siding selects set the matching coats or coverage
  var SIDE = { smooth: 350, clapboard: 300, rough: 250, stucco: 200 }, SURF = { drywall: 1, glossy: 1, dark: 1, stain: 2 };
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'sd' && SIDE[t.value]) { $('cv').value = SIDE[t.value]; }
    if (t.id === 'sf' && SURF[t.value]) { $('co').value = SURF[t.value]; UI.syncSegs && UI.syncSegs(); }
    if (t.id === 'md' || t.id === 'ty') { /* handled by data-show */ }
  });
  function render() {
    show(); var bad = validate();
    var more = tool === 'paint' || tool === 'wall' || tool === 'sqft'; if (more && ed) Object.keys(ed).forEach(function (k) { var e = ed[k]; var enc = e.enc(e.read()); e.hid.value = enc === e.def ? e.def : enc; });
    history.replaceState(null, '', UI.stateURL());
    out.innerHTML = bad ? ALERT : tl.run();
    UI.syncPresets && UI.syncPresets();
  }
  var deb = UI.debounce(render, 40);
  form.addEventListener('input', deb); form.addEventListener('change', deb);
  render();
});
