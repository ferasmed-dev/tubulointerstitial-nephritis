import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITIES, GAUGES, PRESETS, simulate, defaults, crFromFg } from '../src/model.js';
import { STR } from '../src/i18n.js';

const last = r => r.points[r.points.length - 1];
const at = (r, t) => r.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const min = (r, g) => Math.min(...r.points.map(p => p.g[g]));
const max = (r, g) => Math.max(...r.points.map(p => p.g[g]));
const evs = r => r.events.map(e => e.key);

/* ---------- generic: every entity ---------- */
for (const e of ENTITIES) {
  test(`${e.key}: well-formed output (defaults, extremes, both arms)`, () => {
    const variants = [defaults(e.key)];
    for (const p of e.params.filter(q => q.type !== 'choice')) {
      variants.push({ ...defaults(e.key), [p.key]: p.min }, { ...defaults(e.key), [p.key]: p.max });
    }
    for (const p of e.params.filter(q => q.type === 'choice')) for (const o of p.options) variants.push({ ...defaults(e.key), [p.key]: o });
    for (const v of variants) for (const tr of [false, true]) {
      const r = simulate(e.key, v, tr);
      assert.equal(r.points.length, Math.round(e.tMax / e.dt) + 1);
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i].t > r.points[i - 1].t);
      for (const pt of r.points) {
        for (const g of [...e.tiles, ...e.charts]) {
          assert.ok(Number.isFinite(pt.g[g]) && pt.g[g] >= 0, `${e.key} ${g}=${pt.g[g]}`);
          assert.ok(GAUGES[g], `gauge ${g} defined`);
        }
        for (const a of pt.active) assert.ok(e.steps.includes(a), `${e.key} unknown step ${a}`);
        assert.ok(pt.lesion >= 0 && pt.lesion <= 1);
      }
      for (const ev of r.events) assert.ok(ev.t >= 0 && ev.t <= e.tMax);
    }
  });
}

test('pure: same input → same output, params not mutated', () => {
  for (const e of ENTITIES) {
    const p = defaults(e.key); const copy = JSON.stringify(p);
    assert.deepEqual(simulate(e.key, p, true), simulate(e.key, p, true));
    assert.equal(JSON.stringify(p), copy);
  }
});

test('creatinine falls as GFR rises and is ~0.9 at 100 mL/min', () => {
  assert.ok(Math.abs(crFromFg(100) - 0.9) < 1e-9);
  assert.ok(crFromFg(30) > crFromFg(60));
});

test('i18n: every key used by the model exists in ES and EN', () => {
  for (const lang of ['es', 'en']) {
    const S = STR[lang];
    for (const e of ENTITIES) {
      const E = S.ent[e.key];
      for (const f of ['name', 'what', 'params', 'sees', 'tto']) assert.ok(E[f], `${lang} ${e.key}.${f}`);
      for (const st of e.steps) assert.ok(E.steps[st], `${lang} step ${e.key}.${st}`);
      for (const p of e.params) {
        assert.ok(S.params[p.key], `${lang} param ${p.key}`);
        if (p.type === 'choice') for (const o of p.options) assert.ok(S.choice[p.key][o], `${lang} choice ${p.key}.${o}`);
      }
      for (const g of [...e.tiles, ...e.charts]) assert.ok(S.gauges[g], `${lang} gauge ${g}`);
      assert.ok(S.units[e.unit]);
      for (const tr of [false, true]) {
        const r = simulate(e.key, defaults(e.key), tr);
        for (const ev of r.events) assert.equal(typeof S.ev[ev.key], 'function', `${lang} event ${ev.key}`);
        for (const pt of r.points) if (pt.badge) assert.ok(S.badge[pt.badge], `${lang} badge ${pt.badge}`);
      }
    }
    for (const k of Object.keys(PRESETS)) assert.ok(S.presets[k], `${lang} preset ${k}`);
  }
});

/* ---------- presets ---------- */
test('presets reference valid entities and parameters', () => {
  for (const [k, pr] of Object.entries(PRESETS)) {
    const e = ENTITIES.find(x => x.key === pr.entity);
    assert.ok(e, k);
    for (const pk of Object.keys(pr.params)) assert.ok(e.params.some(p => p.key === pk), `${k}.${pk}`);
    for (const ev of [...simulate(pr.entity, pr.params, false).events, ...simulate(pr.entity, pr.params, true).events]) {
      assert.equal(typeof STR.es.ev[ev.key], 'function', `${k} event ${ev.key}`);
    }
  }
});

/* ---------- mechanisms ---------- */
test('acute TIN: AKI after the latency; early withdrawal + steroids recovers more than late', () => {
  const u = simulate('nti_aguda', PRESETS.ibp_10_dias.params, false);
  assert.ok(at(u, 9).g.fg > 90 && at(u, 16).g.fg < 50, 'AKI starts after the 10-day latency');
  assert.ok(max(u, 'eos') > 4 && max(u, 'tamano') > 12, 'eosinophiluria and enlarged kidneys');
  const early = last(simulate('nti_aguda', PRESETS.ibp_10_dias.params, true)).g.fg;
  const late = last(simulate('nti_aguda', PRESETS.betalactamico_tardio.params, true)).g.fg;
  assert.ok(early > 85 && late < early - 8 && last(u).g.fg < 30);
  const re = simulate('nti_aguda', PRESETS.reexposicion.params, true);
  assert.ok(evs(re).includes('reexpo') && last(re).g.fg < 40, 're-exposure brings the AKI back');
});

test('chronic TIN: early acidosis, polyuria and disproportionate anaemia; salt-wasting keeps BP low', () => {
  const r = simulate('nti_cronica', PRESETS.ir_sin_hta.params, false);
  const tA = r.events.find(e => e.key === 'acidosis').t, tG3 = r.events.find(e => e.key === 'g3').t;
  assert.ok(tA < tG3, 'acidosis precedes CKD G3');
  assert.ok(max(r, 'diuresis') > 2.5 && min(r, 'hb') < 11 && last(r).g.tamano < 9);
  assert.ok(max(r, 'pas') < 115, 'salt-wasting: no HTA');
  assert.ok(max(simulate('nti_cronica', { ta: 'hta' }), 'pas') > 145);
  const t = simulate('nti_cronica', PRESETS.nti_cronica_obstructiva.params, true);
  assert.ok(last(t).g.fg > last(simulate('nti_cronica', PRESETS.nti_cronica_obstructiva.params, false)).g.fg + 40);
});

test('analgesics: dose-dependent; combinations worse; papillary necrosis; stopping slows loss', () => {
  const hi = last(simulate('analgesicos', { dosis: 4, combinacion: 'si' })).g.fg;
  const lo = last(simulate('analgesicos', { dosis: 1, combinacion: 'si' })).g.fg;
  const solo = last(simulate('analgesicos', { dosis: 4, combinacion: 'no' })).g.fg;
  assert.ok(hi < lo && hi < solo);
  const u = simulate('analgesicos', PRESETS.abuso_analgesicos.params, false);
  assert.ok(evs(u).includes('necrosis_papilar'));
  assert.ok(last(simulate('analgesicos', PRESETS.abuso_analgesicos.params, true)).g.fg > last(u).g.fg + 30);
});

test('lithium: nephrogenic DI (polyuria, dilute urine) grows with exposure and partly reverses when stopped', () => {
  const u = simulate('litio', PRESETS.litio_bipolar.params, false);
  assert.ok(last(u).g.diuresis > 4 && last(u).g.uosm < 250);
  assert.ok(at(u, 2).g.diuresis < at(u, 10).g.diuresis, 'cumulative effect');
  const t = simulate('litio', PRESETS.litio_bipolar.params, true);
  assert.ok(last(t).g.diuresis < last(u).g.diuresis - 1.5);
  assert.ok(last(simulate('litio', { niveles: 1.4 })).g.diuresis > last(simulate('litio', { niveles: 0.5 })).g.diuresis);
});

test('myeloma: casts cause AKI, worse with hypercalcaemia and dehydration; treatment preserves GFR', () => {
  const u = simulate('mieloma', PRESETS.mieloma_cilindros.params, false);
  assert.ok(last(u).g.fg < 15 && last(u).badge === 'rinon_mieloma');
  const mild = at(simulate('mieloma', { cadenas: 6, calcio: 10, deshidratacion: 'no' }), 3).g.fg;
  assert.ok(mild > at(u, 3).g.fg + 15, 'hypercalcaemia + dehydration accelerate the injury');
  const t = simulate('mieloma', PRESETS.mieloma_cilindros.params, true);
  assert.ok(last(t).g.fg > 50 && last(t).g.flc < 1.5 && last(t).g.ca < 10.5);
});

test('aristolochic acid: fast loss with herbs that continues after stopping; Balkan form is slow; no HTA', () => {
  const t = simulate('aristoloquico', PRESETS.hierbas_adelgazar.params, true);
  assert.ok(at(t, 4).g.fg < at(t, 1).g.fg - 40, 'keeps progressing after exposure stops at 1 year');
  const b = simulate('aristoloquico', PRESETS.balcanes.params, false);
  assert.ok(last(b).g.fg > 70);
  assert.ok(max(t, 'pas') < 130 && min(t, 'hco3') < 20);
  assert.ok(last(simulate('aristoloquico', PRESETS.hierbas_adelgazar.params, false)).g.uro > last(t).g.uro);
});

test('AD-TIN: normal GFR in childhood, ESRD in middle age; uromodulin → early hyperuricaemia and gout', () => {
  const u = simulate('ntiad', PRESETS.familia_gota.params);
  assert.ok(at(u, 15).g.fg > 100 && at(u, 70).g.fg < 15);
  const g3 = u.events.find(e => e.key === 'g3').t;
  assert.ok(g3 > 30 && g3 < 50, 'CKD G3 in the 4th–5th decade');
  assert.ok(evs(u).includes('gota') && at(u, 30).g.urico > 7);
  assert.ok(max(simulate('ntiad', { gen: 'muc1' }), 'urico') < max(u, 'urico'));
});
