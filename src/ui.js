// UI: entity picker, sliders, sin/con tratamiento, schematic, "¿Qué está pasando?", charts,
// event log, compare table and self-test. Exposes window.__sim for automated checks.
import { ENTITIES, GAUGES, PRESETS, simulate, defaults } from './model.js';
import { STR } from './i18n.js';
import { drawSchematic } from './schematic.js';
import { lineChart, dataTable } from './charts.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

const S = {
  lang: ['es', 'en'].includes(params.get('lang')) ? params.get('lang')
      : store.get('lang') || ((navigator.language || 'es').startsWith('es') ? 'es' : 'en'),
  entity: ENTITIES[0].key, p: {}, preset: '', view: 'treated', t: 0, playing: false, speed: 1,
  runs: null, table: false, tab: 'sim', quiz: { score: 0, n: 0, q: null, answered: null },
};

const tr = (path, ...args) => {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), STR[S.lang]);
  if (typeof v === 'function') v = v(...args, fmt);
  return v ?? path;
};
const ent = () => ENTITIES.find(e => e.key === S.entity);
function fmt(v, dec = 0) {
  return new Intl.NumberFormat(S.lang === 'es' ? 'es-ES' : 'en-GB', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v);
}

function compute() {
  const e = ent();
  S.runs = {
    untreated: simulate(e.key, S.p, false),
    treated: e.treat ? simulate(e.key, S.p, true) : null,
  };
  if (!e.treat) S.view = 'untreated';
}
const run = () => S.runs[S.view] || S.runs.untreated;
function pointAt(r, t) {
  const pts = r.points;
  let best = pts[0];
  for (const p of pts) { if (p.t <= t + 1e-9) best = p; else break; }
  return best;
}

/* ---------- static text ---------- */
function renderStatic() {
  document.documentElement.lang = S.lang;
  document.title = tr('title');
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = tr(n.dataset.i18n); });
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === S.lang));
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== S.tab; });
}

/* ---------- controls ---------- */
function renderPicker() {
  $('#picker').innerHTML = ENTITIES.map(e =>
    `<button type="button" data-entity="${e.key}" aria-pressed="${e.key === S.entity}">${tr(`ent.${e.key}.name`)}</button>`).join('');
  $('#picker').querySelectorAll('button').forEach(b => b.onclick = () => selectEntity(b.dataset.entity));
  const sel = $('#preset');
  sel.innerHTML = `<option value="">${tr('ui.presetNone')}</option>` +
    Object.keys(PRESETS).map(k => `<option value="${k}" ${k === S.preset ? 'selected' : ''}>${tr(`presets.${k}`)}</option>`).join('');
}

function renderParams() {
  const e = ent();
  const box = $('#params');
  box.innerHTML = e.params.map(p => {
    const label = tr(`params.${p.key}`);
    if (p.type === 'choice') {
      return `<label class="ctl"><span>${label}</span><select data-p="${p.key}">${p.options.map(o =>
        `<option value="${o}" ${S.p[p.key] === o ? 'selected' : ''}>${tr(`choice.${p.key}.${o}`)}</option>`).join('')}</select></label>`;
    }
    return `<label class="ctl"><span>${label}: <b data-v="${p.key}">${fmt(S.p[p.key], p.dec || 0)}</b> ${p.unit || ''}</span>
      <input type="range" data-p="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${S.p[p.key]}"></label>`;
  }).join('');
  box.querySelectorAll('[data-p]').forEach(inp => {
    inp.oninput = () => {
      const def = e.params.find(q => q.key === inp.dataset.p);
      S.p[def.key] = def.type === 'choice' ? inp.value : +inp.value;
      if (def.type !== 'choice') box.querySelector(`[data-v="${def.key}"]`).textContent = fmt(S.p[def.key], def.dec || 0);
      S.preset = ''; $('#preset').value = '';
      compute(); renderDynamic();
    };
  });
  const tbox = $('#treat');
  if (e.treat) {
    tbox.innerHTML = `<div class="seg" role="group" aria-label="${tr('ui.view')}">
      <button type="button" data-view="untreated" aria-pressed="${S.view === 'untreated'}">${tr('ui.treatOff')}</button>
      <button type="button" data-view="treated" aria-pressed="${S.view === 'treated'}">${tr('ui.treatOn')}</button></div>
      <p class="hint">${tr(`ent.${e.key}.tto`)}</p>`;
    tbox.querySelectorAll('button').forEach(b => b.onclick = () => { S.view = b.dataset.view; renderParams(); renderDynamic(); });
  } else {
    tbox.innerHTML = `<p class="hint">${tr('ui.noTreatment')} ${tr(`ent.${e.key}.tto`)}</p>`;
  }
}

/* ---------- dynamic ---------- */
function renderDynamic() {
  const e = ent();
  const r = run();
  const pt = pointAt(r, S.t);
  // schematic
  drawSchematic($('#schematic'), e, pt, tr);
  $('#entTitle').textContent = tr(`ent.${e.key}.name`);
  $('#entWhat').textContent = tr(`ent.${e.key}.what`);
  const badge = pt.badge ? tr(`badge.${pt.badge}`) : '';
  $('#badge').textContent = badge; $('#badge').hidden = !badge;
  // clock
  $('#clock').textContent = `${fmt(S.t, e.dt < 1 ? 1 : 0)} / ${fmt(e.tMax)} ${tr(`units.${e.unit}`)}`;
  $('#scrub').max = e.tMax; $('#scrub').step = e.dt; $('#scrub').value = S.t;
  // steps
  const seen = new Set(r.points.filter(p => p.t <= S.t + 1e-9).flatMap(p => p.active));
  $('#steps').innerHTML = e.steps.map(k => {
    const cls = pt.active.includes(k) ? 'on' : seen.has(k) ? 'done' : '';
    return `<li class="${cls}">${tr(`ent.${e.key}.steps.${k}`)}</li>`;
  }).join('');
  // tiles
  $('#tiles').innerHTML = e.tiles.map(g => {
    const G = GAUGES[g]; const v = pt.g[g];
    const out = G.normal && (v < G.normal[0] || v > G.normal[1]);
    return `<div class="tile ${out ? 'out' : ''}"><span class="lab">${tr(`gauges.${g}`)}</span>
      <span class="val">${fmt(v, G.dec)}</span> <span class="unit">${G.unit}</span>
      ${out ? `<span class="flag">${v < G.normal[0] ? '↓' : '↑'} ${tr('ui.outOfRange')}</span>` : ''}</div>`;
  }).join('');
  // charts
  const series = (g) => {
    const mk = (rr, cls, label) => ({ cls, label, values: rr.points.map(p => ({ t: p.t, v: p.g[g] })) });
    const s = [mk(S.runs.untreated, 'untreated', e.treat ? tr('ui.legendUntreated') : tr(`gauges.${g}`))];
    if (S.runs.treated) s.push(mk(S.runs.treated, 'treated', tr('ui.legendTreated')));
    return s;
  };
  $('#charts').innerHTML = '';
  for (const g of e.charts) {
    const G = GAUGES[g];
    const wrap = document.createElement('figure'); wrap.className = 'chartbox';
    wrap.innerHTML = `<figcaption>${tr(`gauges.${g}`)} <span class="unit">(${G.unit})</span></figcaption><div class="cbody"></div>`;
    $('#charts').appendChild(wrap);
    const opts = { title: tr(`gauges.${g}`), unit: G.unit, series: series(g), tMax: e.tMax, playhead: S.t,
      normal: G.normal, fmt: v => fmt(v, G.dec), fmtT: t => fmt(t, e.dt < 1 && e.tMax < 10 ? 1 : 0),
      timeLabel: tr(`units.${e.unit}`), yMin: G.yMin, yMax: G.yMax };
    const body = wrap.querySelector('.cbody');
    if (S.table) dataTable(body, opts, { time: tr(`units.${e.unit}`) }); else lineChart(body, opts);
  }
  $('#legend').hidden = !e.treat;
  $('#tableBtn').textContent = S.table ? tr('ui.chart') : tr('ui.table');
  // log
  const evs = r.events.filter(ev => ev.t <= S.t + 1e-9);
  $('#log').innerHTML = evs.length ? evs.map(ev =>
    `<li><span class="lt">${fmt(ev.t, e.dt < 1 ? 1 : 0)} ${tr(`units.${e.unit}`)}</span> ${tr(`ev.${ev.key}`, ...(ev.args || []))}</li>`).join('')
    : `<li class="muted">${tr('ui.logEmpty')}</li>`;
  $('#playBtn').textContent = S.playing ? tr('ui.pause') : tr('ui.play');
}

function renderRef() {
  $('#ref').innerHTML = STR[S.lang].ref.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

function renderCompare() {
  const cols = STR[S.lang].ui.compareCols;
  $('#compare').innerHTML = `<table class="cmp"><thead><tr><th>${tr('ui.entity')}</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
    ENTITIES.map(e => `<tr><th scope="row"><button type="button" class="link" data-go="${e.key}">${tr(`ent.${e.key}.name`)}</button></th>
      <td>${tr(`ent.${e.key}.what`)}</td><td>${tr(`ent.${e.key}.params`)}</td><td>${tr(`ent.${e.key}.sees`)}</td><td>${tr(`ent.${e.key}.tto`)}</td></tr>`).join('') +
    '</tbody></table>';
  $('#compare').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { S.tab = 'sim'; selectEntity(b.dataset.go); renderStatic(); });
}

/* ---------- quiz ---------- */
function newQuestion() {
  const pool = [...ENTITIES];
  const right = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter(e => e !== right).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [right, ...others].sort(() => Math.random() - 0.5).map(e => e.key);
  const kind = ['sees', 'what', 'params'][Math.floor(Math.random() * 3)];
  S.quiz.q = { right: right.key, opts, kind }; S.quiz.answered = null;
}
function renderQuiz() {
  if (!S.quiz.q) newQuestion();
  const q = S.quiz.q;
  $('#quiz').innerHTML = `<p class="qtype">${tr(`ui.quizKind.${q.kind}`)}</p>
    <blockquote>${tr(`ent.${q.right}.${q.kind}`)}</blockquote>
    <div class="qopts">${q.opts.map(k => {
      let cls = '';
      if (S.quiz.answered) cls = k === q.right ? 'ok' : k === S.quiz.answered ? 'ko' : '';
      return `<button type="button" data-a="${k}" class="${cls}" ${S.quiz.answered ? 'disabled' : ''}>${tr(`ent.${k}.name`)}</button>`;
    }).join('')}</div>
    <p class="qres" aria-live="polite">${S.quiz.answered ? (S.quiz.answered === q.right ? tr('ui.correct') : tr('ui.wrong')) : ''}</p>
    <p>${tr('ui.quizScore')}: <b>${S.quiz.score}/${S.quiz.n}</b> <button type="button" id="qnext">${tr('ui.quizNext')}</button></p>`;
  $('#quiz').querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    S.quiz.answered = b.dataset.a; S.quiz.n++; if (b.dataset.a === q.right) S.quiz.score++; renderQuiz();
  });
  $('#qnext').onclick = () => { newQuestion(); renderQuiz(); };
}

/* ---------- actions ---------- */
function selectEntity(key, keepParams) {
  S.entity = key; S.t = 0; S.playing = false;
  if (!keepParams) S.p = defaults(key);
  S.view = ent().treat ? 'treated' : 'untreated';
  compute(); renderPicker(); renderParams(); renderDynamic();
}
function applyPreset(key) {
  const pr = PRESETS[key]; if (!pr) return;
  S.preset = key;
  S.entity = pr.entity; S.p = { ...defaults(pr.entity), ...pr.params }; S.t = 0; S.playing = false;
  S.view = ENTITIES.find(e => e.key === pr.entity).treat ? (pr.view || 'treated') : 'untreated';
  compute(); renderPicker(); renderParams(); renderDynamic();
}
function setLang(l) {
  S.lang = l; store.set('lang', l);
  const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
  renderStatic(); renderPicker(); renderParams(); renderDynamic(); renderRef(); renderCompare(); renderQuiz();
}

let last = 0;
function loop(ts) {
  if (S.playing) {
    const e = ent();
    const dtReal = last ? (ts - last) / 1000 : 0;
    S.t = Math.min(e.tMax, S.t + dtReal * (e.tMax / 14) * S.speed);
    if (S.t >= e.tMax) S.playing = false;
    renderDynamic();
  }
  last = ts;
  requestAnimationFrame(loop);
}

function init() {
  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderStatic(); if (S.tab === 'quiz') renderQuiz(); });
  $('#preset').onchange = e => { if (e.target.value) applyPreset(e.target.value); };
  $('#playBtn').onclick = () => { if (S.t >= ent().tMax) S.t = 0; S.playing = !S.playing; renderDynamic(); };
  $('#resetBtn').onclick = () => { S.t = 0; S.playing = false; renderDynamic(); };
  $('#endBtn').onclick = () => { S.t = ent().tMax; S.playing = false; renderDynamic(); };
  $('#scrub').oninput = e => { S.t = +e.target.value; S.playing = false; renderDynamic(); };
  $('#speed').onchange = e => { S.speed = +e.target.value; };
  $('#tableBtn').onclick = () => { S.table = !S.table; renderDynamic(); };
  const pk = params.get('preset');
  if (pk && PRESETS[pk]) applyPreset(pk);
  else selectEntity(ENTITIES.some(e => e.key === params.get('entity')) ? params.get('entity') : ENTITIES[0].key);
  renderStatic(); renderRef(); renderCompare(); renderDynamic();
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderDynamic, 120); });
  requestAnimationFrame(loop);
}

window.__sim = {
  get state() { return { lang: S.lang, entity: S.entity, preset: S.preset, view: S.view, t: S.t, p: { ...S.p } }; },
  runs: () => S.runs,
  current: () => pointAt(run(), S.t),
  seek: t => { S.t = Math.max(0, Math.min(ent().tMax, t)); S.playing = false; renderDynamic(); },
  preset: k => applyPreset(k),
  entity: k => selectEntity(k),
  setView: v => { S.view = v; renderParams(); renderDynamic(); },
  setLang,
};
init();
