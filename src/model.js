// Tubulointerstitial nephritis simulator — pure model (no DOM).
// Simple time-course models; values marked "Model" are teaching assumptions tuned to the textbook course.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Steady-state creatinine from GFR (Model: ≈ 0.9 mg/dL at 100 mL/min, inverse relation). */
export const crFromFg = (fg) => clamp(90 / Math.max(fg, 4), 0.4, 20);

export const GAUGES = {
  fg: { unit: 'mL/min', dec: 0, normal: [90, 140], yMin: 0 },
  cr: { unit: 'mg/dL', dec: 1, normal: [0.6, 1.2], yMin: 0 },
  diuresis: { unit: 'L/24 h', dec: 1, normal: [0.8, 2.5], yMin: 0 },
  uosm: { unit: 'mOsm/kg', dec: 0, normal: [300, 1200], yMin: 0 },
  hco3: { unit: 'mEq/L', dec: 0, normal: [22, 26] },
  hb: { unit: 'g/dL', dec: 1, normal: [12, 17] },
  urico: { unit: 'mg/dL', dec: 1, normal: [3.5, 7.0] },
  tamano: { unit: 'cm', dec: 1, normal: [10, 12.5] },
  pas: { unit: 'mmHg', dec: 0, normal: [100, 139] },
  eos: { unit: '%', dec: 1, normal: [0, 1], yMin: 0 },          // urinary eosinophils (% of leukocytes)
  acum: { unit: 'kg', dec: 1, normal: null, yMin: 0 },          // cumulative analgesic dose
  ca: { unit: 'mg/dL', dec: 1, normal: [8.5, 10.5] },
  flc: { unit: 'g/24 h', dec: 1, normal: [0, 0.1], yMin: 0 },   // free light chains excreted
  uro: { unit: '%', dec: 1, normal: [0, 1], yMin: 0 },          // cumulative urothelial-cancer risk index (Model)
};

const R = (key, min, max, step, def, unit = '', dec = 0) => ({ key, min, max, step, def, unit, dec });
const Ch = (key, options, def) => ({ key, type: 'choice', options, def });

export const ENTITIES = [
  { key: 'nti_aguda', loc: 'intersticio', unit: 'days', tMax: 60, dt: 0.25, treat: true,
    params: [Ch('farmaco', ['betalactamico', 'aine', 'ibp'], 'betalactamico'), R('latencia', 1, 50, 1, 10, 'd'), R('dx', 2, 20, 1, 5, 'd'), Ch('reexpo', ['no', 'si'], 'no')],
    tiles: ['fg', 'cr', 'eos', 'tamano'], charts: ['fg', 'eos'],
    steps: ['farmaco', 'latencia', 'infiltrado', 'fra', 'sedimento', 'extrarrenal', 'retirada', 'fibrosis', 'reexpo'] },
  { key: 'nti_cronica', loc: 'intersticio', unit: 'years', tMax: 15, dt: 0.1, treat: true,
    params: [Ch('causa', ['toxicos', 'metabolica', 'obstructiva', 'inmunologica'], 'toxicos'), R('intensidad', 1, 10, 1, 6), Ch('ta', ['hta', 'pierde_sal'], 'hta'), R('inicio', 0.5, 10, 0.5, 3, '', 1)],
    tiles: ['fg', 'diuresis', 'hco3', 'hb', 'pas', 'tamano'], charts: ['fg', 'diuresis', 'hb'],
    steps: ['agresion', 'acidosis', 'poliuria', 'anemia', 'fibrosis', 'ta', 'tto'] },
  { key: 'analgesicos', loc: 'papila', unit: 'years', tMax: 20, dt: 0.1, treat: true,
    params: [R('dosis', 0.5, 5, 0.1, 3, '', 1), Ch('combinacion', ['si', 'no'], 'si'), R('suspension', 1, 15, 0.5, 6, '', 1)],
    tiles: ['fg', 'cr', 'acum', 'uro'], charts: ['fg', 'acum'],
    steps: ['consumo', 'isquemia_papilar', 'necrosis_papilar', 'nti', 'tumor', 'suspension'] },
  { key: 'litio', loc: 'colector', unit: 'years', tMax: 20, dt: 0.1, treat: true,
    params: [R('niveles', 0.4, 1.5, 0.05, 0.9, 'mEq/L', 2), R('suspension', 1, 15, 0.5, 8, '', 1)],
    tiles: ['diuresis', 'uosm', 'fg'], charts: ['diuresis', 'uosm', 'fg'],
    steps: ['acumulo', 'acuaporinas', 'di', 'poliuria', 'nti', 'suspension'] },
  { key: 'mieloma', loc: 'distal', unit: 'weeks', tMax: 12, dt: 0.1, treat: true,
    params: [R('cadenas', 0.5, 10, 0.5, 5, 'g/24 h', 1), R('calcio', 9, 15, 0.5, 12.5, 'mg/dL', 1), Ch('deshidratacion', ['si', 'no'], 'si')],
    tiles: ['fg', 'cr', 'ca', 'flc'], charts: ['fg', 'flc'],
    steps: ['cadenas', 'cilindros', 'obstruccion', 'hipercalcemia', 'fra', 'tto'] },
  { key: 'aristoloquico', loc: 'proximal', unit: 'years', tMax: 10, dt: 0.05, treat: true,
    params: [Ch('escenario', ['hierbas', 'balcanes'], 'hierbas'), R('exposicion', 1, 36, 1, 12, '')],
    tiles: ['fg', 'hco3', 'pas', 'uro'], charts: ['fg', 'uro'],
    steps: ['exposicion', 'aductos', 'fanconi', 'fibrosis', 'sin_hta', 'tumor', 'retirada'] },
  { key: 'ntiad', loc: 'asa', unit: 'years', tMax: 70, dt: 0.5, treat: false,
    params: [Ch('gen', ['umod', 'muc1', 'ren'], 'umod')],
    tiles: ['fg', 'urico', 'diuresis'], charts: ['fg', 'urico'],
    steps: ['mutacion', 'sedimento', 'isostenuria', 'hiperuricemia', 'ir', 'trs'] },
];

export function defaults(key) {
  const e = ENTITIES.find(x => x.key === key);
  return Object.fromEntries(e.params.map(p => [p.key, p.def]));
}

function runner(e, init, step) {
  const points = [], events = [], fired = new Set();
  const emit = (t, key, args = []) => { if (fired.has(key)) return; fired.add(key); events.push({ t, key, args }); };
  const st = { ...init };
  const n = Math.round(e.tMax / e.dt);
  for (let i = 0; i <= n; i++) {
    const t = +(i * e.dt).toFixed(6);
    const o = step(st, t, e.dt, emit);
    for (const k of Object.keys(o.g)) o.g[k] = Number.isFinite(o.g[k]) ? Math.max(0, o.g[k]) : 0;
    points.push({ t, g: o.g, active: o.active, lesion: clamp(o.lesion ?? 0, 0, 1), badge: o.badge || null });
  }
  return { points, events };
}
const ckd = (fg, t, emit) => { if (fg < 60) emit(t, 'g3', [60]); if (fg < 30) emit(t, 'g4', [30]); if (fg < 15) emit(t, 'g5', [15]); };
const E = (k) => ENTITIES.find(x => x.key === k);

const MODELS = {
  // Acute (immunoallergic) TIN: after a drug-specific latency, an eosinophil-rich interstitial infiltrate
  // develops over ~3 days → AKI. Stopping the drug + early prednisone resolves inflammation (τ ≈ 4 days);
  // fibrosis accumulates while inflammation persists (Model: 1 %/day at full activity), so delay matters.
  nti_aguda(p, treated) {
    const tStop = p.latencia + p.dx;
    const reT = 45;
    return runner(E('nti_aguda'), { I: 0, F: 0, stopped: false, re: false }, (s, t, dt, emit) => {
      let drive = t >= p.latencia ? 1 : 0;
      if (treated && t >= tStop) { if (!s.stopped) emit(t, 'retirada'); s.stopped = true; }
      if (s.stopped) drive = 0;
      if (treated && p.reexpo === 'si' && t >= reT) { if (!s.re) emit(t, 'reexpo'); s.re = true; drive = t >= reT + 2 ? 1 : 0; }
      const tau = drive ? 1.5 : (s.stopped ? 4 : 1.5);
      s.I += (drive - s.I) * Math.min(1, dt / tau);
      s.F = Math.min(0.6, s.F + 0.01 * s.I * dt);
      const fg = 100 * (1 - s.F) * (1 - 0.72 * s.I);
      const rash = p.farmaco === 'betalactamico';
      emit(0, 'farmaco');
      if (s.I > 0.5) emit(t, 'fra');
      if (s.F > 0.1) emit(t, 'fibrosis');
      const active = [];
      if (!s.stopped || s.re) active.push('farmaco');
      if (t < p.latencia) active.push('latencia');
      if (s.I > 0.2) active.push('infiltrado', 'sedimento');
      if (s.I > 0.5) active.push('fra');
      if (s.I > 0.3 && rash) active.push('extrarrenal');
      if (s.stopped && !s.re) active.push('retirada');
      if (s.F > 0.1) active.push('fibrosis');
      if (s.re) active.push('reexpo');
      return { g: { fg, cr: crFromFg(fg), eos: 6 * s.I, tamano: 11 + 1.6 * s.I - 2 * s.F },
        active, lesion: 0.8 * s.I + s.F, badge: s.I > 0.5 ? 'fra' : null };
    });
  },

  // Chronic TIN: slow fibrosis with early tubular acidosis, concentrating defect (polyuria), anaemia out of
  // proportion to GFR and shrinking kidneys; BP high (volume) or low (salt-wasting). Removing the cause slows loss.
  nti_cronica(p, treated) {
    const rate = 0.9 * p.intensidad;
    return runner(E('nti_cronica'), { fg: 95, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.inicio) { if (!s.on) emit(t, 'tto_causa'); s.on = true; }
      if (t > 0) s.fg = Math.max(5, s.fg - (s.on ? 1 : rate) * dt);
      const dmg = clamp((95 - s.fg) / 85, 0, 1);
      const tub = clamp(t * p.intensidad / 20, 0, 1);
      const hco3 = 24 - 6 * Math.max(tub, dmg) * (s.on ? 0.7 : 1);
      const diur = 1.5 + 1.8 * Math.max(tub * 0.6, dmg);
      const hb = 14 - 5.5 * dmg;
      const pas = p.ta === 'hta' ? 128 + 28 * dmg : 112 - 14 * dmg;
      if (hco3 < 22) emit(t, 'acidosis');
      if (diur > 2.5) emit(t, 'poliuria');
      if (hb < 12) emit(t, 'anemia');
      ckd(s.fg, t, emit);
      const active = ['agresion'];
      if (hco3 < 22) active.push('acidosis');
      if (diur > 2.5) active.push('poliuria');
      if (hb < 12) active.push('anemia');
      if (dmg > 0.3) active.push('fibrosis');
      if (dmg > 0.2) active.push('ta');
      if (s.on) active.push('tto');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), diuresis: diur, hco3, hb, pas, tamano: 11 - 2.8 * dmg },
        active, lesion: 0.2 + 0.8 * dmg, badge: s.fg < 30 && p.ta === 'pierde_sal' ? 'sin_hta' : null };
    });
  },

  // Analgesic nephropathy: dose-dependent; combinations (aspirin + others) roughly 1.6× more toxic (Model).
  // Papillary necrosis appears beyond ~10 kg cumulative (Model); stopping halts the analgesic-driven loss.
  analgesicos(p, treated) {
    const k = p.dosis * (p.combinacion === 'si' ? 1.6 : 1);
    return runner(E('analgesicos'), { fg: 95, acum: 0, on: true }, (s, t, dt, emit) => {
      if (treated && t >= p.suspension && s.on) { s.on = false; emit(t, 'suspension'); }
      if (t > 0) {
        if (s.on) s.acum += p.dosis * dt;
        s.fg = Math.max(5, s.fg - (0.8 + (s.on ? 0.9 * k : 0)) * dt);
      }
      const necro = s.acum > 10;
      if (necro) emit(t, 'necrosis_papilar');
      const uro = 0.12 * s.acum * (p.combinacion === 'si' ? 1.3 : 1);
      ckd(s.fg, t, emit);
      const active = [];
      if (s.on) active.push('consumo');
      if (s.acum > 4) active.push('isquemia_papilar');
      if (necro) active.push('necrosis_papilar');
      if (s.fg < 70) active.push('nti');
      if (uro > 2) active.push('tumor');
      if (!s.on) active.push('suspension');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), acum: s.acum, uro, hb: 14 - 4 * clamp((95 - s.fg) / 85, 0, 1) },
        active, lesion: clamp(s.acum / 25, 0, 1), badge: necro ? 'necrosis_papilar' : null };
    });
  },

  // Lithium: accumulates in collecting-duct cells → aquaporin-2 down-regulation → nephrogenic DI.
  // Polyuria grows with cumulative exposure (level × years); slow GFR loss; stopping partly reverses polyuria.
  litio(p, treated) {
    return runner(E('litio'), { fg: 100, cum: 0, on: true }, (s, t, dt, emit) => {
      if (treated && t >= p.suspension && s.on) { s.on = false; emit(t, 'suspension'); }
      if (t > 0 && s.on) s.cum += p.niveles * dt;
      if (t > 0) s.fg = Math.max(10, s.fg - (0.5 + (s.on ? 0.9 * p.niveles : 0)) * dt);
      if (!s.on) s.cum = Math.max(s.cum * 0.6, s.cum - 0.5 * dt);
      const di = 1 - Math.exp(-s.cum / 7);
      const diur = 1.5 + 4 * di;
      const uosm = 650 - 520 * di;
      if (p.niveles > 1.2) emit(0, 'toxicos');
      if (diur > 3) emit(t, 'di');
      ckd(s.fg, t, emit);
      const active = [];
      if (s.on) active.push('acumulo');
      if (di > 0.15) active.push('acuaporinas');
      if (diur > 3) active.push('di', 'poliuria');
      if (s.fg < 70) active.push('nti');
      if (!s.on) active.push('suspension');
      return { g: { diuresis: diur, uosm, fg: s.fg, cr: crFromFg(s.fg) }, active, lesion: 0.15 + 0.8 * di,
        badge: diur > 3 ? 'di' : null };
    });
  },

  // Myeloma cast nephropathy: light chains precipitate with Tamm-Horsfall protein in the distal tubule;
  // hypercalcaemia and dehydration aggravate it. Treatment (hydration, calcium correction, anti-myeloma
  // therapy) cuts light-chain production; renal recovery depends on how much tubule is already obstructed.
  mieloma(p, treated) {
    const tox = p.cadenas * (p.deshidratacion === 'si' ? 1.5 : 1) * (1 + 0.15 * Math.max(0, p.calcio - 10.5));
    return runner(E('mieloma'), { fg: 85, flc: p.cadenas, ca: p.calcio, obs: 0, on: false }, (s, t, dt, emit) => {
      if (treated && t >= 1) { if (!s.on) emit(t, 'tto'); s.on = true; }
      if (s.on) { s.flc += (p.cadenas * 0.15 - s.flc) * Math.min(1, dt / 1.5); s.ca += (9.8 - s.ca) * Math.min(1, dt / 0.6); }
      const load = s.flc * (s.on ? 1 : p.deshidratacion === 'si' ? 1.5 : 1) * (1 + 0.15 * Math.max(0, s.ca - 10.5));
      if (t > 0) s.obs = clamp(s.obs + (0.014 * load - (s.on ? 0.1 : 0) * s.obs) * dt, 0, 0.95);
      const fg = 85 * (1 - s.obs);
      if (s.ca > 10.5) emit(0, 'hipercalcemia');
      if (fg < 60) emit(t, 'fra');
      ckd(fg, t, emit);
      const active = ['cadenas'];
      if (s.obs > 0.05) active.push('cilindros');
      if (s.obs > 0.25) active.push('obstruccion');
      if (s.ca > 10.5) active.push('hipercalcemia');
      if (fg < 60) active.push('fra');
      if (s.on) active.push('tto');
      return { g: { fg, cr: crFromFg(fg), ca: s.ca, flc: s.flc }, active, lesion: s.obs + 0.1 * tox / 10,
        badge: fg < 60 ? 'rinon_mieloma' : null };
    });
  },

  // Aristolochic acid: DNA adducts → hypocellular fibrosis with marked tubular atrophy, Fanconi, no HTA.
  // Herbal (slimming) exposure: fast loss that continues after stopping; Balkan: very slow. Urothelial cancer risk ↑.
  aristoloquico(p, treated) {
    const fast = p.escenario === 'hierbas';
    const expoY = p.exposicion / 12;
    return runner(E('aristoloquico'), { fg: 100, dose: 0 }, (s, t, dt, emit) => {
      const exposed = treated ? t < expoY : true;
      if (treated && t >= expoY) emit(t, 'retirada');
      if (t > 0 && exposed) s.dose += dt;
      const rate = fast ? (exposed ? 20 : 16) * Math.min(1, s.dose / 0.5) : 1.6;
      if (t > 0) s.fg = Math.max(5, s.fg - rate * dt);
      const dmg = clamp((100 - s.fg) / 90, 0, 1);
      const uro = (fast ? 1.2 : 0.4) * s.dose + 3 * dmg;
      ckd(s.fg, t, emit);
      if (dmg > 0.15) emit(t, 'fanconi');
      const active = [];
      if (exposed) active.push('exposicion');
      active.push('aductos');
      if (dmg > 0.15) active.push('fanconi');
      if (dmg > 0.3) active.push('fibrosis');
      if (dmg > 0.3) active.push('sin_hta');
      if (uro > 3) active.push('tumor');
      if (treated && t >= expoY) active.push('retirada');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), hco3: 24 - 7 * dmg, pas: 122, uro }, active, lesion: 0.2 + 0.8 * dmg,
        badge: s.fg < 15 ? 'g5' : null };
    });
  },

  // Autosomal-dominant TIN (uromodulin 70 %, MUC1 25 %, renin 5 %): bland sediment, isosthenuria and, with
  // UMOD, early hyperuricaemia and gout; slow GFR loss from adolescence → ESRD in middle age (Model rates).
  ntiad(p) {
    const rate = { umod: 2.0, muc1: 2.4, ren: 1.7 }[p.gen];
    return runner(E('ntiad'), { fg: 110 }, (s, t, dt, emit) => {
      if (t > 15) s.fg = Math.max(5, s.fg - rate * dt);
      const urico = p.gen === 'umod' ? 5 + 4 * clamp((t - 10) / 20, 0, 1) : p.gen === 'ren' ? 5 + 2.5 * clamp((t - 10) / 20, 0, 1) : 5 + 1.5 * clamp((t - 30) / 30, 0, 1);
      const diur = 1.5 + 1 * clamp((t - 10) / 30, 0, 1);
      if (urico > 7) emit(t, 'gota');
      ckd(s.fg, t, emit);
      const active = ['mutacion', 'sedimento'];
      if (t > 12) active.push('isostenuria');
      if (urico > 7) active.push('hiperuricemia');
      if (s.fg < 60) active.push('ir');
      if (s.fg < 15) active.push('trs');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), urico, diuresis: diur }, active, lesion: clamp((110 - s.fg) / 100, 0.1, 1),
        badge: s.fg < 15 ? 'g5' : null };
    });
  },
};

export function simulate(key, params, treated = false) {
  const e = ENTITIES.find(x => x.key === key);
  if (!e) throw new Error(`unknown entity ${key}`);
  const p = { ...defaults(key), ...params };
  return MODELS[key](p, treated && e.treat);
}

export const PRESETS = {
  ibp_10_dias: { entity: 'nti_aguda', params: { farmaco: 'ibp', latencia: 10, dx: 4 } },
  betalactamico_tardio: { entity: 'nti_aguda', params: { farmaco: 'betalactamico', latencia: 8, dx: 18 } },
  reexposicion: { entity: 'nti_aguda', params: { farmaco: 'betalactamico', latencia: 10, dx: 4, reexpo: 'si' } },
  ir_sin_hta: { entity: 'nti_cronica', params: { causa: 'toxicos', intensidad: 7, ta: 'pierde_sal', inicio: 8 } },
  nti_cronica_obstructiva: { entity: 'nti_cronica', params: { causa: 'obstructiva', intensidad: 6, ta: 'hta', inicio: 3 } },
  abuso_analgesicos: { entity: 'analgesicos', params: { dosis: 4, combinacion: 'si', suspension: 6 } },
  litio_bipolar: { entity: 'litio', params: { niveles: 0.9, suspension: 8 } },
  litio_niveles_altos: { entity: 'litio', params: { niveles: 1.4, suspension: 5 } },
  mieloma_cilindros: { entity: 'mieloma', params: { cadenas: 6, calcio: 13, deshidratacion: 'si' } },
  hierbas_adelgazar: { entity: 'aristoloquico', params: { escenario: 'hierbas', exposicion: 12 } },
  balcanes: { entity: 'aristoloquico', params: { escenario: 'balcanes', exposicion: 36 } },
  familia_gota: { entity: 'ntiad', params: { gen: 'umod' } },
  ntiad_muc1: { entity: 'ntiad', params: { gen: 'muc1' } },
};
