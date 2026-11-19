// Schematic of a nephron in its interstitium. The site of the selected agent is highlighted and the lesion
// (infiltrate, casts, papillary necrosis, fibrosis…) grows with severity; kidney tone follows GFR.
export function drawSchematic(box, e, pt, tr) {
  const L = pt.lesion;
  const fg = pt.g.fg ?? 90;
  const on = (loc) => e.loc === loc;
  const hot = 'var(--hot)';
  const tube = (loc) => (on(loc) ? hot : 'var(--tissue-line)');
  const cls = (loc) => (on(loc) ? 'lbl-on' : '');
  const w = (loc) => (on(loc) ? 9 : 7);
  const dots = (n, x0, y0, wd, ht) => Array.from({ length: n }, (_, i) =>
    `<circle cx="${x0 + ((i * 53) % wd)}" cy="${y0 + ((i * 31) % ht)}" r="3.2" fill="${hot}" opacity=".8"/>`).join('');
  const fibro = Array.from({ length: Math.round(L * 18) }, (_, i) =>
    `<path d="M${120 + (i * 37) % 420} ${40 + (i * 23) % 170} l14 6" stroke="var(--muted)" stroke-width="1.5" opacity=".6"/>`).join('');
  box.innerHTML = `
<svg viewBox="0 0 700 260" role="img" aria-label="${tr('schem.aria')}">
  <rect x="20" y="14" width="600" height="232" rx="14" fill="var(--tissue)" opacity="${0.35 + 0.4 * Math.min(1, fg / 100)}"
        stroke="${on('intersticio') ? hot : 'none'}" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="36" y="34" class="${cls('intersticio')}">${tr('schem.intersticio')}</text>
  ${fibro}
  ${on('intersticio') ? dots(Math.round(4 + 26 * L), 140, 50, 380, 160) : ''}
  <!-- glomerulus -->
  <circle cx="90" cy="110" r="34" fill="var(--surface)" stroke="var(--tissue-line)" stroke-width="2"/>
  ${[0, 1, 2, 3].map(i => `<path d="M${70 + i * 4} ${96 + i * 5} q 18 20 38 14" stroke="var(--vessel)" stroke-width="3" fill="none"/>`).join('')}
  <text x="90" y="162" text-anchor="middle">${tr('schem.glomerulo')}</text>
  <!-- proximal tubule -->
  <path d="M124 110 C150 70 180 150 205 105 C225 70 250 140 270 100" stroke="${tube('proximal')}" stroke-width="${w('proximal')}" fill="none" stroke-linecap="round"/>
  <text x="200" y="66" text-anchor="middle" class="${cls('proximal')}">${tr('schem.proximal')}</text>
  ${on('proximal') && L > 0.2 ? `<text x="200" y="150" text-anchor="middle" class="lbl-on">${tr('schem.fanconi')}</text>` : ''}
  <!-- loop of Henle -->
  <path d="M270 100 V210 Q285 232 300 210 V110" stroke="var(--tissue-line)" stroke-width="6" fill="none"/>
  <path d="M300 210 V110" stroke="${tube('asa')}" stroke-width="${w('asa') + 2}" fill="none"/>
  <text x="335" y="190" class="${cls('asa')}">${tr('schem.asa')}</text>
  <!-- distal tubule -->
  <path d="M300 110 C320 70 360 140 390 95 C410 70 430 120 450 90" stroke="${tube('distal')}" stroke-width="${w('distal')}" fill="none" stroke-linecap="round"/>
  <text x="380" y="64" text-anchor="middle" class="${cls('distal')}">${tr('schem.distal')}</text>
  ${on('distal') ? Array.from({ length: Math.round(1 + 6 * L) }, (_, i) => `<rect x="${318 + i * 18}" y="${92 + (i % 2) * 8}" width="12" height="7" rx="3" fill="${hot}"/>`).join('') : ''}
  <!-- collecting duct -->
  <path d="M450 90 H520 V200" stroke="${tube('colector')}" stroke-width="${w('colector') + 2}" fill="none" stroke-linecap="round"/>
  <text x="532" y="120" class="${cls('colector')}">${tr('schem.colector')}</text>
  ${[0, 1, 2, 3].map(i => `<rect x="527" y="${132 + i * 14}" width="10" height="6" rx="2" fill="var(--s1)" opacity="${on('colector') ? Math.max(0.1, 1 - L) : 0.9}"/>`).join('')}
  <text x="532" y="196" class="${cls('colector')}" style="font-size:11px">${tr('schem.aqp')}</text>
  <!-- papilla -->
  <path d="M495 200 L545 200 L520 244 Z" fill="${on('papila') ? hot : 'var(--tissue-line)'}" opacity="${on('papila') ? 0.3 + 0.6 * L : 0.7}"/>
  <text x="560" y="236" class="${cls('papila')}">${tr('schem.papila')}</text>
  <!-- legend box: kidney size -->
  <text x="640" y="40" text-anchor="middle">${tr('schem.fg')}</text>
  <text x="640" y="62" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--ink)">${Math.round(fg)}</text>
  <rect x="628" y="74" width="24" height="160" rx="6" fill="none" stroke="var(--axis)"/>
  <rect x="628" y="${74 + 160 * (1 - Math.min(1, fg / 120))}" width="24" height="${160 * Math.min(1, fg / 120)}" rx="6" fill="var(--s1)" opacity=".7"/>
</svg>`;
}
