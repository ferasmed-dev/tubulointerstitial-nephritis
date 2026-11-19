// Dependency-free SVG line chart: one measure, up to two series (sin / con tratamiento),
// normal-range band, playhead, crosshair tooltip, direct end labels and a data-table view.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

function niceTicks(lo, hi, count = 4) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/**
 * opts: { title, unit, series:[{key,label,values:[{t,v}],cls}], tMax, playhead, normal:[lo,hi]|null,
 *         fmt:(v)=>string, fmtT:(t)=>string, timeLabel, yMin, yMax }
 */
export function lineChart(container, opts) {
  container.innerHTML = '';
  // Draw at the container's real width so text stays legible; narrow screens drop the direct labels (legend remains).
  const W = Math.max(300, Math.min(700, Math.round(container.clientWidth || 520)));
  const narrow = W < 450;
  const H = narrow ? 190 : 210, m = { l: 46, r: narrow ? 44 : 92, t: 12, b: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const all = opts.series.flatMap(s => s.values.map(p => p.v));
  let lo = opts.yMin ?? Math.min(...all, opts.normal ? opts.normal[0] : Infinity);
  let hi = opts.yMax ?? Math.max(...all, opts.normal ? opts.normal[1] : -Infinity);
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-6) { hi = lo + 1; }
  const pad = (hi - lo) * 0.08;
  if (opts.yMin === undefined) lo = Math.max(0, lo - pad);
  if (opts.yMax === undefined) hi = hi + pad;
  const x = t => m.l + (t / opts.tMax) * iw;
  const y = v => m.t + ih - ((v - lo) / (hi - lo)) * ih;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.title }, container);
  if (opts.normal) {
    const [a, b] = opts.normal;
    const y1 = y(Math.min(Math.max(b, lo), hi)), y2 = y(Math.max(Math.min(a, hi), lo));
    if (y2 > y1) el('rect', { x: m.l, y: y1, width: iw, height: y2 - y1, class: 'band' }, svg);
  }
  for (const v of niceTicks(lo, hi)) {
    el('line', { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v), class: 'grid' }, svg);
    const tx = el('text', { x: m.l - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    tx.textContent = opts.fmt(v);
  }
  for (const t of niceTicks(0, opts.tMax, 5)) {
    const tx = el('text', { x: x(t), y: H - 10, class: 'tick', 'text-anchor': 'middle' }, svg);
    tx.textContent = opts.fmtT(t);
  }
  el('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: 'axis' }, svg);
  const tl = el('text', { x: W - 4, y: H - 10, class: 'tick', 'text-anchor': 'end' }, svg);
  tl.textContent = opts.timeLabel;

  const labels = [];
  for (const s of opts.series) {
    const pts = s.values.filter(p => p.t <= opts.playhead + 1e-9);
    if (pts.length < 1) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    el('path', { d, class: `line ${s.cls}` }, svg);
    const last = pts[pts.length - 1];
    el('circle', { cx: x(last.t), cy: y(last.v), r: 4, class: `dot ${s.cls}` }, svg);
    labels.push({ s, yy: y(last.v), xx: x(last.t) });
  }
  // direct labels at the right margin, de-collided
  labels.sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < labels.length; i++) if (labels[i].yy - labels[i - 1].yy < 14) labels[i].yy = labels[i - 1].yy + 14;
  if (opts.series.length > 1 && !narrow) for (const L of labels) {
    const tx = el('text', { x: m.l + iw + 8, y: L.yy + 4, class: 'dlabel' }, svg);
    tx.textContent = L.s.label;
  }
  el('line', { x1: x(opts.playhead), x2: x(opts.playhead), y1: m.t, y2: m.t + ih, class: 'playhead' }, svg);

  // hover layer
  const hair = el('line', { y1: m.t, y2: m.t + ih, class: 'hair', visibility: 'hidden' }, svg);
  const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; container.appendChild(tip);
  const show = (clientX) => {
    const r = svg.getBoundingClientRect();
    const sx = (clientX - r.left) * (W / r.width);
    const t = Math.max(0, Math.min(opts.playhead, ((sx - m.l) / iw) * opts.tMax));
    hair.setAttribute('x1', x(t)); hair.setAttribute('x2', x(t)); hair.setAttribute('visibility', 'visible');
    const rows = opts.series.map(s => {
      const p = s.values.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), s.values[0]);
      return `<div><span class="sw ${s.cls}"></span>${s.label}: <b>${opts.fmt(p.v)}</b> ${opts.unit}</div>`;
    }).join('');
    tip.innerHTML = `<div class="tt">${opts.fmtT(t)} ${opts.timeLabel}</div>${rows}`;
    tip.hidden = false;
    const px = ((x(t)) / W) * r.width;
    tip.style.left = `${Math.min(px + 12, r.width - 170)}px`;
    tip.style.top = `8px`;
  };
  hit.addEventListener('mousemove', e => show(e.clientX));
  hit.addEventListener('touchmove', e => { show(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  hit.addEventListener('mouseleave', () => { tip.hidden = true; hair.setAttribute('visibility', 'hidden'); });
  return svg;
}

/** Data-table view of the same series (sampled). */
export function dataTable(container, opts, labels) {
  const n = opts.series[0].values.length;
  const stepIdx = Math.max(1, Math.round(n / 12));
  let html = `<table class="dtable"><caption>${opts.title} (${opts.unit})</caption><thead><tr><th>${labels.time}</th>`;
  html += opts.series.map(s => `<th>${s.label}</th>`).join('') + '</tr></thead><tbody>';
  for (let i = 0; i < n; i += stepIdx) {
    const t = opts.series[0].values[i].t;
    if (t > opts.playhead + 1e-9) break;
    html += `<tr><td>${opts.fmtT(t)}</td>` + opts.series.map(s => `<td>${opts.fmt(s.values[i].v)}</td>`).join('') + '</tr>';
  }
  container.innerHTML = html + '</tbody></table>';
}
