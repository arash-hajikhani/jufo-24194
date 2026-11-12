const D = {};
const LEVELS = ['3', '2', '1', '0'];
const AJG_ORDER = ['4*', '4', '3', '2', '1'];
const AJG_COLORS = { '4*': '#7f1d1d', '4': '#b45309', '3': '#0072B2', '2': '#56B4E9', '1': '#9ca3af' };

const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
const fmt = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (n, d = 1) => n == null ? '–' : (100 * n).toFixed(d) + '%';

let LC = {};      // level colors, resolved from CSS at init
let CH = {};      // channel colors

// ship-metric indices (order fixed by the build script)
const I = { out: 0, fwci: 1, cpp: 2, top10: 3, cs10: 4, prom: 5, intl: 6,
            vpp: 7, fwvi: 8, pol: 9, pat: 10, patpp: 11, h: 12 };

async function j(p) { const r = await fetch(p); if (!r.ok) throw new Error(p); return r.json(); }

async function init() {
  [D.meta, D.journals, D.prof, D.xwalk, D.traj, D.lvlTraj, D.corr, D.edges] = await Promise.all([
    j('data/meta.json'), j('data/journals.json'), j('data/level_profile.json'),
    j('data/crosswalk.json'), j('data/trajectories.json'),
    j('data/level_trajectories.json'), j('data/rank_corr.json'), j('data/outliers.json'),
  ]);
  D.fi = await j('data/fi_summary.json').catch(() => null);
  D.fit = await j('data/fi_fit.json').catch(() => null);
  LC = { '3': css('--l3'), '2': css('--l2'), '1': css('--l1'), '0': css('--l0') };
  CH = { cit: css('--ch-cit'), pol: css('--ch-pol'), pat: css('--ch-pat'), out: css('--ch-out') };
  Chart.defaults.font.family = css('--sans') || 'Inter, sans-serif';
  Chart.defaults.color = css('--ink-soft') || '#4a463f';
  Chart.defaults.animation = false;
  buildPercentiles();
  header(); kpis(); findings();
  chartGradient(); chartOverlap(); chartStanding(); edges(); chartQmap();
  crosswalk(); chartFt50(); fiFootprint(); fitSection();
  chartHeatmap(); chartScatter(); chartTrajectory(); chartInequality();
  explorer(); glossary();
}

/* percentile machinery: sorted value arrays per ship metric */
const SORTED = [];
function buildPercentiles() {
  const n = D.journals.ship.length;
  for (let k = 0; k < n; k++) {
    SORTED[k] = D.journals.rows.map(r => r.m[k]).filter(v => v != null).sort((a, b) => a - b);
  }
}
function pctOf(v, k) {
  const a = SORTED[k];
  if (v == null || !a.length) return null;
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < v) lo = mid + 1; else hi = mid; }
  return 100 * lo / (a.length - 1 || 1);
}
const lvlName = l => l == null ? 'not on JUFO' : `JUFO ${l}`;

function header() {
  document.getElementById('subtitle').textContent = D.meta.subtitle;
  document.getElementById('source-note').textContent = D.meta.source;
}

function kpis() {
  const h = D.meta.headline, n = D.meta.level_n;
  const items = [
    [fmt(D.meta.n_journals), 'journals, one measurement scale',
     `${fmt(n['3'])} at level 3 · ${fmt(n['2'])} at 2 · ${fmt(n['1'])} at 1 · ${fmt(n['0'])} at 0`],
    [fmt(h.fwci_l3, 2) + ' → ' + fmt(h.fwci_l0, 2), 'median FWCI, level 3 down to level 0',
     `a ${(h.fwci_l3 / h.fwci_l0).toFixed(1)}× spread in field-weighted citation impact`],
    [pc(h.ov21), 'of level-1 journals out-cite the median level-2 journal',
     'the levels overlap heavily — judge the journal, not the label'],
    [`${h.ft50_at3} / ${h.ft50_total}`, 'FT50 journals sit at JUFO level 3',
     'the famous exception: Harvard Business Review is level 1'],
  ];
  document.getElementById('kpis').innerHTML = items.map(([v, l, s]) =>
    `<div class="kpi"><div class="kpi-value">${v}</div><div class="kpi-label">${l}</div><div class="kpi-sub">${s}</div></div>`).join('');
}

function findings() {
  const h = D.meta.headline;
  const cards = [
    ['The levels are real — as strata',
     `Median field-weighted citation impact steps down cleanly: ${fmt(h.fwci_l3, 2)} at level 3, ` +
     `${fmt(h.fwci_l2, 2)} at 2, ${fmt(h.fwci_l1, 2)} at 1, ${fmt(h.fwci_l0, 2)} at 0. Across all ` +
     `24,194 journals the level correlates with FWCI at ρ = ${fmt(h.rho_fwci, 2)} — a genuine, but far from deterministic, quality signal.`],
    ['…but wide and heavily overlapping',
     `${pc(h.ov21)} of level-1 journals out-cite the median level-2 journal, ${pc(h.ov32)} of level 2 ` +
     `out-cite the median level 3, and 28% of level 0 out-cite the median level 1. A level describes ` +
     `a distribution; it is weak evidence about any single journal in it.`],
    ['JUFO and ABS agree only at the very top',
     `${h.abs_high_at_top} of ${h.abs_high_total} AJG 4/4* journals hold level 3 — near-perfect agreement. ` +
     `One tier down the systems part company: half of AJG 3 journals sit at level 2, most AJG 2 journals at ` +
     `level 1, and 41 journals the ABS rates 1–2 hold JUFO's top level.`],
    ['Societal reach is a different dimension',
     `Patent citations barely move across levels (ρ = 0.06) and policy attention is concentrated in a ` +
     `handful of journals. A classification built on scholarly standing cannot see these channels — worth ` +
     `remembering when a journal's case for promotion rests on societal impact.`],
  ];
  document.getElementById('findings-grid').innerHTML = cards.map(([t, s], i) =>
    `<article class="finding-card"><span class="finding-number">Finding ${i + 1}</span>
     <h3>${t}</h3><p>${s}</p></article>`).join('');
}

/* 1. the JUFO gradient */
function chartGradient() {
  const p = D.prof.profile;
  const labels = p.map(r => `JUFO ${r.level}`);
  const norm = k => { const top = p[0][k] || 1; return p.map(r => (r[k] || 0) / top); };
  new Chart(document.getElementById('chart-gradient'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Citation impact (FWCI)', data: norm('fwci'), backgroundColor: CH.cit },
        { label: 'Policy citations', data: norm('policy'), backgroundColor: CH.pol },
        { label: 'Patent citations', data: norm('patents'), backgroundColor: CH.pat },
        { label: 'Views per publication', data: norm('vpp'), backgroundColor: CH.out },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: 'median, scaled to level 3 = 1.0' }, min: 0, max: 1.05 },
                x: { grid: { display: false } } },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { afterLabel: (c) => {
          const r = p[c.dataIndex];
          const raw = [r.fwci, r.policy, r.patents, r.vpp][c.datasetIndex];
          return `median = ${fmt(raw, c.datasetIndex === 0 ? 2 : 1)}  (n=${fmt(r.n)})`;
        } } },
      },
    },
  });
  const rho = D.prof.level_rho;
  document.getElementById('gradient-note').innerHTML =
    `Raw medians, level 3 → 0 — FWCI: ${p.map(r => fmt(r.fwci, 2)).join(' / ')}; citing policy documents:
     ${p.map(r => fmt(r.policy)).join(' / ')}; patent citations: ${p.map(r => fmt(r.patents)).join(' / ')};
     views per publication: ${p.map(r => fmt(r.vpp, 1)).join(' / ')}. Spearman ρ between the level and each
     channel across journals: citations <strong>${fmt(rho.fwci, 2)}</strong>, policy <strong>${fmt(rho.policy, 2)}</strong>,
     views <strong>${fmt(rho.views, 2)}</strong>, patents <strong>${fmt(rho.patents, 2)}</strong>.`;
}

/* 2a. overlap strips on the FWCI-percentile axis */
function chartOverlap() {
  const qq = D.prof.quantiles;
  const labels = LEVELS.map(l => `JUFO ${l}`);
  const box = LEVELS.map(l => qq[l].pct.slice(1, 4));   // p25, p50, p75
  const whisk = LEVELS.map(l => [qq[l].pct[0], qq[l].pct[4]]);
  new Chart(document.getElementById('chart-overlap'), {
    data: {
      labels,
      datasets: [
        /* lower `order` draws later = on top; bars stay first so the category axis is inferred */
        { type: 'bar', label: '5th–95th percentile', data: whisk.map(w => [w[0], w[1]]), order: 2,
          backgroundColor: LEVELS.map(l => LC[l] + '4d'), grouped: false, barPercentage: 0.18, borderWidth: 0 },
        { type: 'bar', label: '25th–75th percentile', data: box.map(b => [b[0], b[2]]), order: 1,
          backgroundColor: LEVELS.map(l => LC[l]), grouped: false, barPercentage: 0.6, borderWidth: 0 },
        { type: 'scatter', label: 'median', data: box.map((b, i) => ({ x: b[1], y: i })), order: 0,
          pointStyle: 'line', rotation: 90, radius: 17, borderWidth: 3,
          borderColor: css('--surface'), hoverRadius: 17, hoverBorderWidth: 3 },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { min: 0, max: 100, title: { display: true, text: 'position in the whole JUFO population, by FWCI percentile →' } },
                y: { grid: { display: false } } },
      plugins: {
        legend: { position: 'bottom', labels: { filter: i => i.text !== 'median' } },
        tooltip: { callbacks: {
          label: (c) => {
            const l = LEVELS[c.dataIndex]; const q5 = qq[l].pct;
            return c.datasetIndex === 2 ? `median: p${fmt(q5[2])}` :
              c.datasetIndex === 1 ? `middle half: p${fmt(q5[1])}–p${fmt(q5[3])}` :
              `5th–95th: p${fmt(q5[0])}–p${fmt(q5[4])}`;
          } } },
      },
    },
  });
  const ov = Object.fromEntries(D.prof.overlap.map(o => [o.hi + o.lo, o]));
  document.getElementById('overlap-note').innerHTML =
    `Overlap, in numbers: <strong>${pc(ov['32'].lo_above_hi_median)}</strong> of level-2 journals sit above the
     level-3 median FWCI; <strong>${pc(ov['21'].lo_above_hi_median)}</strong> of level 1 above the level-2 median;
     <strong>${pc(ov['10'].lo_above_hi_median)}</strong> of level 0 above the level-1 median — but only
     <strong>${pc(ov['31'].lo_above_hi_median)}</strong> of level 1 clears the level-3 median.`;
}

/* 2b. journal standing: share of each level's journals that are top-decile journals */
function chartStanding() {
  const share = D.prof.standing_share
    ? LEVELS.map(l => D.prof.standing_share[l])
    : LEVELS.map(l => {
        const rs = D.journals.rows.filter(r => r.l === l && r.m[I.cs10] != null);
        return rs.length ? 100 * rs.filter(r => r.m[I.cs10] > 50).length / rs.length : 0;
      });
  new Chart(document.getElementById('chart-standing'), {
    type: 'bar',
    data: { labels: LEVELS.map(l => `JUFO ${l}`),
            datasets: [{ data: share, backgroundColor: LEVELS.map(l => LC[l]), borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100, title: { display: true, text: '% of journals with most output in the field’s top CiteScore decile' } },
                x: { grid: { display: false } } },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.parsed.y.toFixed(1)}% of level-${LEVELS[c.dataIndex]} journals` } } },
    },
  });
  const p = D.prof.profile;
  document.getElementById('standing-note').innerHTML =
    `Median share of output published while the journal ranked in its field's top CiteScore decile,
     level 3 → 0: <strong>${p.map(r => fmt(r.cs10, 1) + '%').join(' / ')}</strong>. Below level 2 the median
     journal never appears in the top decile — levels 1 and 0 are indistinguishable on journal standing.`;
}

/* 3. edge cases — journals that don't fit their level */
function edges() {
  const E = D.edges;
  const tbl = (rows) => `
    <table class="etable"><tr><th>Journal</th><th>Index</th><th>FWCI</th><th>FI papers</th><th>ABS</th></tr>
    ${rows.map(r => `<tr class="erow" data-e="${r.n.replace(/"/g, '&quot;')}::${r.l}">
      <td>${r.n}</td><td>${fmt(r.pct)}</td><td>${fmt(r.fwci, 2)}</td><td>${r.fi ? fmt(r.fi) : '–'}</td><td>${ajgPill(r.ajg) || '–'}</td></tr>`).join('')}
    </table>`;
  const block = (dir, key, openKey) => {
    const [a, b] = key.split(/[<>]/);
    const e = E[dir][key];
    const title = `JUFO ${a} → ${b} — <strong>${fmt(e.count)}</strong> journals ` +
      (dir === 'up' ? `above the level-${b} median` : `below the level-${b} median`);
    return `<details class="gloss edge-block"${key === openKey ? ' open' : ''}>
      <summary>${title}</summary>${tbl(e.rows)}</details>`;
  };
  document.getElementById('edges-up').innerHTML =
    ['2>3', '1>2', '0>1'].map(k => block('up', k, '2>3')).join('');
  document.getElementById('edges-down').innerHTML =
    ['3<2', '2<1', '1<0'].map(k => block('down', k, '3<2')).join('');
  document.querySelectorAll('.erow').forEach(tr => tr.onclick = () => {
    const [name, lvl] = tr.dataset.e.split('::');
    const row = D.journals.rows.find(x => x.n === name && x.l === lvl);
    openDetail(row);
    document.getElementById('journal-detail').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* 4. quality map */
function chartQmap() {
  const R = D.journals.rows;
  const pts = { '3': [], '2': [], '1': [], '0': [] };
  for (const r of R) {
    const x = pctOf(r.m[I.fwci], I.fwci);
    const pp = pctOf(r.m[I.pol], I.pol), qq = pctOf(r.m[I.pat], I.pat);
    if (x == null || (pp == null && qq == null)) continue;
    const y = Math.max(pp ?? 0, qq ?? 0);
    pts[r.l].push({ x, y, e: r.n, s: (qq ?? 0) > (pp ?? 0) ? 'patent' : 'policy' });
  }
  const style = { '3': [4.2, 'e6'], '2': [3.2, 'cc'], '1': [1.7, '73'], '0': [2.4, '99'] };
  new Chart(document.getElementById('chart-qmap'), {
    type: 'scatter',
    data: { datasets: LEVELS.map(l => ({
      label: `JUFO ${l}`, data: pts[l],
      backgroundColor: LC[l] + style[l][1],
      pointRadius: style[l][0], pointHoverRadius: 7, borderWidth: 0,
    })) },
    options: {
      responsive: true, maintainAspectRatio: false, normalized: true,
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: 'Scholarly standing — FWCI percentile within JUFO →' } },
        y: { min: 0, max: 100, title: { display: true, text: 'Societal reach — best of policy / patent percentile →' } },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: {
          label: c => `${c.raw.e}`,
          afterLabel: c => `citation p${c.raw.x.toFixed(0)} · societal p${c.raw.y.toFixed(0)} (${c.raw.s})`,
        } },
      },
    },
  });
}

/* 4. crosswalk matrix + mismatches + FT50 */
function crosswalk() {
  const t = D.xwalk.tab;
  const cols = [...LEVELS, 'none'];
  const seq = (a) => `rgba(42,120,214,${(0.06 + 0.8 * a).toFixed(3)})`;
  let html = '<table><tr><th class="rowh">ABS \\ JUFO</th>' +
    cols.map(c => `<th>${c === 'none' ? 'not on JUFO' : 'Level ' + c}</th>`).join('') + '<th>total</th></tr>';
  for (const a of AJG_ORDER) {
    const tot = cols.reduce((s, c) => s + t[a][c], 0);
    html += `<tr><th class="rowh">AJG ${a}</th>` + cols.map(c => {
      const v = t[a][c], sh = tot ? v / tot : 0;
      return `<td style="background:${seq(sh)}"><span class="cell-n">${fmt(v)}</span><span class="cell-p">${tot ? (100 * sh).toFixed(0) + '%' : ''}</span></td>`;
    }).join('') + `<td><span class="cell-n">${fmt(tot)}</span></td></tr>`;
  }
  html += '</table>';
  document.getElementById('xwalk-matrix').innerHTML = html;
  document.getElementById('xwalk-note').innerHTML =
    `Reading the diagonal: AJG 4* and 4 map almost perfectly onto level 3 (119 of 139). AJG 3 splits —
     half at level 2, a third at level 1. AJG 2 is overwhelmingly a level-1 rating in Finland, and
     ${fmt(D.xwalk.abs_total - D.xwalk.abs_matched)} AJG journals hold no JUFO level at all. The two systems
     rank <em>elites</em> the same way and everything else differently.`;
  document.getElementById('mm-high').innerHTML = D.xwalk.mismatch_high_abs.map(m =>
    `<li>${m.n} <span class="mm-fwci">AJG ${m.ajg}${m.fwci != null ? ' · FWCI ' + fmt(m.fwci, 2) : ''}</span></li>`).join('');
  document.getElementById('mm-low').innerHTML = D.xwalk.mismatch_low_abs.slice(0, 10).map(m =>
    `<li>${m.n} <span class="mm-fwci">AJG ${m.ajg}${m.fwci != null ? ' · FWCI ' + fmt(m.fwci, 2) : ''}</span></li>`).join('');
}

function chartFt50() {
  const f = D.xwalk.ft50;
  const counts = LEVELS.map(l => f.filter(r => r.jufo === l).length);
  document.getElementById('ft50-line').innerHTML =
    `<strong>The FT50, through Finnish eyes.</strong> The Financial Times' list of 53 elite business
     journals — the sample of the original FT50 study — maps onto JUFO like this:`;
  new Chart(document.getElementById('chart-ft50'), {
    type: 'bar',
    data: { labels: LEVELS.map(l => `JUFO ${l}`),
            datasets: [{ data: counts, backgroundColor: LEVELS.map(l => LC[l]), borderWidth: 0 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { title: { display: true, text: 'FT50 journals' }, ticks: { precision: 0 } },
                y: { grid: { display: false } } },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { afterLabel: c => f.filter(r => r.jufo === LEVELS[c.dataIndex])
          .map(r => r.n).slice(0, 8).join('\n') } } },
    },
  });
  const notTop = f.filter(r => r.jufo !== '3');
  document.getElementById('ft50-note').innerHTML =
    `The exceptions: ${notTop.map(r => `<strong>${r.n}</strong> (level ${r.jufo})`).join(', ')}.
     Harvard Business Review is the instructive one: enormous readership and a headline FWCI of 3.2,
     yet only 9% of its output reaches the top citation decile and it never ranks in its field's top
     CiteScore decile. A practitioner outlet with famous authors — the JUFO panel placed it at the
     basic level, and the numbers show what they saw past.`;
}

/* 6. the Finnish footprint */
function fiFootprint() {
  const F = D.fi;
  const sec = document.getElementById('finland');
  if (!F) { if (sec) sec.hidden = true; return; }
  document.getElementById('fi-total').textContent = fmt(F.n_fi_works);
  new Chart(document.getElementById('chart-fi-share'), {
    type: 'line',
    data: { datasets: LEVELS.map(l => ({
      label: `JUFO ${l}`, data: (F.share_trend[l] || []).map(([y, v]) => ({ x: y, y: v })),
      borderColor: LC[l], backgroundColor: LC[l], borderWidth: 2.5, tension: .25, pointRadius: 0,
    })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { type: 'linear', ticks: { callback: v => v }, title: { display: true, text: 'Publication year' } },
                y: { min: 0, title: { display: true, text: 'Finnish share of the level’s world output (%)' } } },
      plugins: { legend: { position: 'bottom' } },
      interaction: { mode: 'index', intersect: false },
    },
  });
  const b = F.by_level;
  document.getElementById('fi-share-note').innerHTML =
    `Finland's share of world output 2010–2026, level 3 → 0:
     <strong>${LEVELS.map(l => fmt(b[l].share, 2) + '%').join(' / ')}</strong>. Citations per Finnish
     paper follow the levels too: ${LEVELS.map(l => fmt(b[l].cpp, 1)).join(' / ')} (OpenAlex counts).
     The level-1 share has fallen from ~1.4% to ~1.0% since 2010 while level 3 holds — Finnish
     publishing is drifting up the ladder relative to the world.`;
  const inst = F.institutions;
  new Chart(document.getElementById('chart-fi-inst'), {
    type: 'bar',
    data: {
      labels: inst.map(i => i.n),
      datasets: LEVELS.map((l, k) => ({
        label: `JUFO ${l}`, data: inst.map(i => i.w[k]), backgroundColor: LC[l],
        borderColor: css('--surface'), borderWidth: 1,
      })),
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true, title: { display: true, text: 'Finland-affiliated papers in JUFO journals, 2010–2026' } },
                y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } } },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { afterLabel: c => {
          const i = inst[c.dataIndex];
          return `${(100 * c.parsed.x / i.tot).toFixed(1)}% of its ${fmt(i.tot)} JUFO papers`;
        } } },
      },
    },
  });
}

/* 7. better fits, worse fits */
function fitSection() {
  const T = D.fit;
  const sec = document.getElementById('fit');
  if (!T) { if (sec) sec.hidden = true; return; }

  /* a. Finnish share across within-level index deciles */
  new Chart(document.getElementById('chart-fit-decile'), {
    type: 'line',
    data: { datasets: LEVELS.map(l => ({
      label: `JUFO ${l}`,
      data: (T.deciles[l] || []).map((d, i) => ({ x: i + 1, y: d.share })),
      borderColor: LC[l], backgroundColor: LC[l], borderWidth: 2.5, tension: .25,
      pointRadius: 3, pointHoverRadius: 6,
    })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { type: 'linear', min: 0.5, max: 10.5,
             afterBuildTicks: a => { a.ticks = Array.from({ length: 10 }, (_, i) => ({ value: i + 1 })); },
             ticks: { autoSkip: false, callback: v => v === 1 ? 'd1 (top)' : v === 10 ? 'd10 (bottom)' : 'd' + v },
             title: { display: true, text: 'within-level decile by broad-impact index →  (d1 = strongest tenth of the level)' } },
        y: { min: 0, title: { display: true, text: 'Finnish share of the decile’s world output (%)' } },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { afterLabel: c => {
          const d = T.deciles[LEVELS[c.datasetIndex]][c.dataIndex];
          return `${fmt(d.fi)} Finnish papers of ${fmt(d.out)} (${d.nj} journals)`;
        } } },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
  const d3 = T.deciles['3'], d1 = T.deciles['1'];
  document.getElementById('fit-decile-note').innerHTML =
    `Level 1 falls from ${fmt(d1[0].share, 2)}% in the strongest decile to ${fmt(d1[9].share, 2)}%
     in the weakest (with a bump at d9) — Finns already favour the better level-1 venues.
     <strong>Level 3 inverts:</strong> the Finnish share peaks in deciles 7–9
     (${fmt(d3[7].share, 2)}–${fmt(d3[8].share, 2)}%), above the top decile (${fmt(d3[0].share, 2)}%).
     Decompose it before judging: decile 9 is more than half <em>Astronomy&nbsp;and&nbsp;Astrophysics</em>
     and decile 8 a third <em>Journal of High Energy Physics</em> — Finnish astronomy and particle
     physics publishing in their fields' standard flagships, which the index places low because those
     fields have no patent or policy channel. The pattern is a prompt for field-level scrutiny of the
     weak end of level 3, not proof of gaming.`;

  /* b. utilisation vs year-normalised Finnish impact */
  new Chart(document.getElementById('chart-fit-scatter'), {
    type: 'scatter',
    data: { datasets: LEVELS.map(l => ({
      label: `JUFO ${l}`,
      data: T.scatter.filter(r => r.l === l).map(r =>
        ({ x: r.cx, y: Math.min(r.fx, 3), e: r.n, fi: r.fi, share: r.share, fx: r.fx })),
      backgroundColor: LC[l] + 'a6', borderWidth: 0,
      pointRadius: ctx => Math.max(2, Math.min(11, Math.sqrt((ctx.raw?.fi || 1)) / 3)),
      pointHoverRadius: 12,
    })) },
    options: {
      responsive: true, maintainAspectRatio: false, normalized: true,
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: 'broad-impact index of the journal →' } },
        y: { min: 0, max: 3.05, title: { display: true, text: 'FI impact (1.0 = FI average, capped at 3)' },
             grid: { color: c => Math.abs(c.tick.value - 1) < 1e-9 ? css('--ink-faint') : css('--rule') } },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: {
          label: c => c.raw.e,
          afterLabel: c => `index ${fmt(c.raw.x, 0)} · FI impact ${fmt(c.raw.fx, 2)}× · ${fmt(c.raw.fi)} FI papers (${fmt(c.raw.share, 1)}% of output)`,
        } },
      },
    },
  });

  /* c+d. watch and gem lists */
  const ftbl = rows => `
    <table class="etable"><tr><th>Journal</th><th>Index</th><th>FI papers</th><th>FI share</th><th>FI impact</th></tr>
    ${rows.map(r => `<tr class="erow" data-e="${r.n.replace(/"/g, '&quot;')}::${r.l}">
      <td>${r.n}</td><td>${fmt(r.cx)}</td><td>${fmt(r.fi)}</td>
      <td>${r.share != null && r.share <= 100 ? fmt(r.share, 1) + '%' : '–'}</td>
      <td>${r.fx != null ? fmt(r.fx, 2) + '×' : '–'}</td></tr>`).join('')}
    </table>`;
  document.getElementById('fit-easy3').innerHTML = ftbl(T.easy3);
  document.getElementById('fit-gems').innerHTML = ftbl(T.gems);
  document.querySelectorAll('#fit .erow').forEach(tr => tr.onclick = () => {
    const [name, lvl] = tr.dataset.e.split('::');
    openDetail(D.journals.rows.find(x => x.n === name && x.l === lvl));
    document.getElementById('journal-detail').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* 8a. rank-correlation heatmap */
function chartHeatmap() {
  const { labels, rows, matrix } = D.corr;
  const short = l => (D.meta.metrics[l]?.short) || l;
  const pts = [];
  rows.forEach((r, i) => labels.forEach((c, k) => pts.push({ x: k, y: i, v: matrix[i][k] })));
  const col = v => v == null ? 'transparent'
    : v >= 0 ? `rgba(42,120,214,${0.08 + 0.85 * Math.min(1, v)})`
             : `rgba(227,73,72,${0.08 + 0.85 * Math.min(1, -v)})`;
  new Chart(document.getElementById('chart-heatmap'), {
    type: 'scatter',
    data: { datasets: [{
      data: pts, parsing: false, pointStyle: 'rect', borderWidth: 0,
      radius: (ctx) => { const a = ctx.chart.chartArea; return a ? Math.min(a.width / labels.length, a.height / rows.length) / 2 - 1 : 8; },
      backgroundColor: (ctx) => col(ctx.raw?.v),
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { left: 4 } },
      scales: {
        x: { min: -0.5, max: labels.length - 0.5, offset: false, grid: { display: false },
             afterBuildTicks: a => { a.ticks = labels.map((_, i) => ({ value: i })); },
             ticks: { autoSkip: false, maxRotation: 90, minRotation: 60, callback: v => short(labels[v]) || '' } },
        y: { min: -0.5, max: rows.length - 0.5, reverse: true, grid: { display: false },
             afterBuildTicks: a => { a.ticks = rows.map((_, i) => ({ value: i })); },
             ticks: { autoSkip: false, callback: v => short(rows[v]) || '' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${short(rows[c.raw.y])} ~ ${short(labels[c.raw.x])}: ρ = ${fmt(c.raw.v, 2)}` } },
      },
    },
  });
}

/* 5b. interactive scatter */
let scChart;
function chartScatter() {
  const opts = D.journals.ship_full;
  const short = m => D.meta.metrics[m]?.short || m;
  const mk = (sel, def) => { document.getElementById(sel).innerHTML =
    opts.map((m, i) => `<option value="${i}"${m === def ? ' selected' : ''}>${short(m)}</option>`).join(''); };
  mk('sc-x', 'Field Weighted Citation Impact excl self citations');
  mk('sc-y', 'Citing Policy Documents');
  const isCount = m => !D.meta.public && ['count'].includes(D.meta.metrics[m]?.unit);
  const axName = m => short(m) + (D.meta.public ? ' (percentile)' : '');
  const draw = () => {
    const xi = +document.getElementById('sc-x').value,
          yi = +document.getElementById('sc-y').value,
          by = document.getElementById('sc-color').value;
    if (scChart) scChart.destroy();
    const xm = opts[xi], ym = opts[yi];
    const lg = isCount(xm), lgy = isCount(ym);
    const groups = by === 'jufo' ? LEVELS : AJG_ORDER;
    const colorOf = g => by === 'jufo' ? LC[g] : AJG_COLORS[g];
    const key = r => by === 'jufo' ? r.l : r.a;
    const datasets = groups.map(g => ({
      label: by === 'jufo' ? `JUFO ${g}` : `AJG ${g}`,
      data: D.journals.rows.filter(r => key(r) === g)
        .map(r => ({ x: r.m[xi], y: r.m[yi], e: r.n }))
        .filter(p => p.x != null && p.y != null && (!lg || p.x > 0) && (!lgy || p.y > 0)),
      backgroundColor: colorOf(g) + '99', pointRadius: by === 'jufo' ? 1.9 : 2.6, borderWidth: 0,
    }));
    scChart = new Chart(document.getElementById('chart-scatter'), {
      type: 'scatter', data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false, normalized: true,
        scales: { x: { type: lg ? 'logarithmic' : 'linear', title: { display: true, text: axName(xm) } },
                  y: { type: lgy ? 'logarithmic' : 'linear', title: { display: true, text: axName(ym) } } },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { callbacks: { label: c => `${c.raw.e}: ${fmt(c.raw.x, 2)}, ${fmt(c.raw.y, 2)}` } },
        },
      },
    });
  };
  ['sc-x', 'sc-y', 'sc-color'].forEach(i => document.getElementById(i).onchange = draw);
  draw();
}

/* 6. trajectories */
let trajChart;
function chartTrajectory() {
  const short = m => D.meta.metrics[m]?.short || m;
  const sel = document.getElementById('traj-metric');
  sel.innerHTML = D.meta.key_trajectory_metrics.map(m => `<option value="${m}">${short(m)}</option>`).join('');
  const mode = document.getElementById('traj-mode');
  const draw = () => {
    const m = sel.value, byLvl = mode.value === 'level';
    if (trajChart) trajChart.destroy();
    let datasets;
    if (byLvl && D.lvlTraj[m]) {
      datasets = LEVELS.filter(l => D.lvlTraj[m][l]?.length).map(l => ({
        label: `JUFO ${l}`, data: D.lvlTraj[m][l].map(([y, v]) => ({ x: y, y: v })),
        borderColor: LC[l], backgroundColor: LC[l], tension: .25, pointRadius: 0, borderWidth: 2.5,
      }));
    } else {
      const t = D.traj[m] || [];
      datasets = [
        { label: 'median', data: t.map(d => ({ x: d.year, y: d.median })), borderColor: css('--accent'), borderWidth: 3, tension: .25, pointRadius: 0 },
        { label: '25–75th percentile', data: t.map(d => ({ x: d.year, y: d.p75 })), borderColor: 'transparent', backgroundColor: css('--accent-wash'), fill: '+1', pointRadius: 0 },
        { label: '', data: t.map(d => ({ x: d.year, y: d.p25 })), borderColor: 'transparent', pointRadius: 0, fill: false },
      ];
    }
    trajChart = new Chart(document.getElementById('chart-trajectory'), {
      type: 'line', data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { type: 'linear', ticks: { callback: v => v }, title: { display: true, text: 'Publication year' } },
                  y: { title: { display: true, text: short(sel.value) } } },
        plugins: { legend: { position: 'bottom', labels: { filter: i => i.text !== '' } } },
        interaction: { mode: 'index', intersect: false },
      },
    });
  };
  sel.onchange = mode.onchange = draw; draw();
}

/* 7. concentration */
function chartInequality() {
  const metrics = ['Citation Count excl self citations', 'Citing Policy Documents', 'Patent Citations', 'Scholarly Output'];
  const names = ['Citations', 'Citing policy docs', 'Patent citations', 'Output'];
  const colors = [CH.cit, CH.pol, CH.pat, CH.out];
  new Chart(document.getElementById('chart-inequality'), {
    type: 'line',
    data: {
      datasets: metrics.map((m, i) => ({
        label: names[i], borderColor: colors[i], backgroundColor: colors[i], borderWidth: 2.5, tension: .25, pointRadius: 0,
        data: (D.traj[m] || []).filter(d => d.gini != null).map(d => ({ x: d.year, y: d.gini })),
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { type: 'linear', ticks: { callback: v => v }, title: { display: true, text: 'Publication year' } },
                y: { title: { display: true, text: 'Gini coefficient across journals' }, min: 0, max: 1 } },
      plugins: { legend: { position: 'bottom' } },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

/* 8. explorer */
const lvlPill = l => `<span class="pill pill-lvl" style="background:${LC[l]}26">${l}</span>`;
const ajgPill = a => a ? `<span class="pill" style="background:${AJG_COLORS[a]}22;color:${AJG_COLORS[a]}">${a}</span>` : '';

function explorer() {
  document.getElementById('f-level').innerHTML = '<option value="">All levels</option>' +
    LEVELS.map(l => `<option value="${l}">JUFO ${l}</option>`).join('');
  document.getElementById('f-ajg').innerHTML = '<option value="">ABS: any</option>' +
    AJG_ORDER.map(a => `<option value="${a}">AJG ${a}</option>`).join('') +
    '<option value="__none">Not on ABS</option>';

  const QCOL = { 1: '#1baf7a', 2: '#6b7280', 3: '#6b7280', 4: '#e34948' };
  const PUB = !!D.meta.public;      // public build: per-journal values are percentile ranks
  const pv = k => r => r.m[k] == null ? '–' : 'p' + fmt(r.m[k]);
  const metricCols = PUB ? [
    [I.fwci, 'FWCI pctile', pv(I.fwci)],
    [I.out, 'Output pctile', pv(I.out)],
    [I.top10, 'Top-10% cited pctile', pv(I.top10)],
    [I.pol, 'Policy pctile', pv(I.pol)],
    [I.pat, 'Patents pctile', pv(I.pat)],
    [I.vpp, 'Views pctile', pv(I.vpp)],
  ] : [
    [I.fwci, 'FWCI', r => fmt(r.m[I.fwci], 2)],
    [I.out, 'Output', r => fmt(r.m[I.out])],
    [I.top10, 'Top-10% cited', r => r.m[I.top10] == null ? '–' : fmt(r.m[I.top10], 1) + '%'],
    [I.cs10, 'Top-decile journal', r => r.m[I.cs10] == null ? '–' : fmt(r.m[I.cs10], 0) + '%'],
    [I.pol, 'Policy', r => fmt(r.m[I.pol])],
    [I.pat, 'Patents', r => fmt(r.m[I.pat])],
    [I.vpp, 'Views/pub', r => fmt(r.m[I.vpp], 1)],
  ];
  const cols = [
    ['n', 'Journal', r => r.n + (r.f ? ' <span class="star" title="FT50">★</span>' : '')],
    ['l', 'JUFO', r => lvlPill(r.l)],
    ['q', 'Q', r => r.q ? `<span class="pill" style="background:${QCOL[r.q]}22;color:${QCOL[r.q]}">Q${r.q}</span>` : ''],
    ['cx', 'Index', r => r.cx == null ? '–' : fmt(r.cx)],
    ['a', 'ABS', r => ajgPill(r.a)],
    ...metricCols,
    ['fi', 'FI papers', r => r.fi && r.fi[0] ? fmt(r.fi[0]) : '–'],
  ];
  document.getElementById('tbl-head').innerHTML = cols.map(([k, l]) => `<th data-k="${k}">${l}</th>`).join('');

  let sortKey = I.fwci, asc = false;
  const get = (r, k) => typeof k === 'number' ? r.m[k] : k === 'fi' ? (r.fi ? r.fi[0] : 0) : r[k];
  const render = () => {
    const q = document.getElementById('f-search').value.toLowerCase();
    const lv = document.getElementById('f-level').value;
    const ag = document.getElementById('f-ajg').value;
    const ft = document.getElementById('f-ft50').checked;
    let rows = D.journals.rows.filter(r =>
      (!q || r.n.toLowerCase().includes(q)) && (!lv || r.l === lv) && (!ft || r.f) &&
      (!ag || (ag === '__none' ? !r.a : r.a === ag)));
    rows = rows.slice().sort((a, b) => {
      let x = get(a, sortKey), y = get(b, sortKey);
      const miss = v => v == null || v === '';
      if (miss(x) || miss(y)) return miss(x) - miss(y);   // blanks last, either direction
      if (typeof x === 'string' || typeof y === 'string')
        return asc ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
      return asc ? x - y : y - x;
    });
    document.getElementById('tbl-count').textContent = `${fmt(rows.length)} journal${rows.length === 1 ? '' : 's'}`;
    document.getElementById('tbl-body').innerHTML = rows.slice(0, 250).map((r) =>
      `<tr data-e="${r.n.replace(/"/g, '&quot;')}::${r.l}">${cols.map(([, , f]) => `<td>${f(r)}</td>`).join('')}</tr>`).join('');
    document.getElementById('tbl-more').textContent =
      rows.length > 250 ? `Showing the first 250 of ${fmt(rows.length)} — narrow the filters to see more.` : 'Click any row for the journal’s percentile profile.';
  };
  document.getElementById('tbl-head').onclick = e => {
    const kk = e.target.dataset.k; if (kk == null) return;
    const k = /^\d+$/.test(kk) ? +kk : kk;
    if (k === sortKey) asc = !asc; else { sortKey = k; asc = false; }
    render();
  };
  ['f-search', 'f-level', 'f-ajg', 'f-ft50'].forEach(id =>
    document.getElementById(id).addEventListener('input', render));
  document.getElementById('tbl-body').onclick = e => {
    const tr = e.target.closest('tr[data-e]');
    if (!tr) return;
    const [name, lvl] = tr.dataset.e.split('::');
    openDetail(D.journals.rows.find(x => x.n === name && x.l === lvl));
  };
  document.getElementById('detail-close').onclick = () =>
    document.getElementById('journal-detail').hidden = true;
  render();
}

/* per-journal percentile profile */
let profileChart;
const LEVEL_MEDIAN_PCT = {};
function levelMedianPct(l, ks) {
  if (LEVEL_MEDIAN_PCT[l]) return LEVEL_MEDIAN_PCT[l];
  const out = {};
  for (const k of ks) {
    const vs = D.journals.rows.filter(r => r.l === l).map(r => pctOf(r.m[k], k)).filter(v => v != null).sort((a, b) => a - b);
    out[k] = vs.length ? vs[Math.floor(vs.length / 2)] : null;
  }
  return LEVEL_MEDIAN_PCT[l] = out;
}

function openDetail(r) {
  if (!r) return;
  const PROF = [[I.fwci, 'FWCI'], [I.top10, 'Top-10% cited'], [I.cs10, 'Journal standing (CiteScore)'],
                [I.out, 'Output'], [I.vpp, 'Views/pub'], [I.pol, 'Policy docs'],
                [I.pat, 'Patent citations'], [I.intl, 'Intl collaboration'], [I.h, 'h-index']];
  const panel = document.getElementById('journal-detail');
  document.getElementById('detail-title').textContent = r.n;
  const PUB = !!D.meta.public;
  const rawStats = PUB
    ? ` &nbsp;·&nbsp; FWCI p${fmt(r.m[I.fwci])} &middot; output p${fmt(r.m[I.out])} &middot; policy p${fmt(r.m[I.pol])} &middot; patents p${fmt(r.m[I.pat])}`
    : ` &nbsp;·&nbsp; FWCI ${fmt(r.m[I.fwci], 2)} &middot; ${fmt(r.m[I.out])} papers &middot; ${fmt(r.m[I.pol])} policy citations &middot; ${fmt(r.m[I.pat])} patent citations`;
  document.getElementById('detail-meta-line').innerHTML =
    `${lvlPill(r.l)} JUFO level ${r.l}${r.q ? ` &middot; Q${r.q} of its level` : ''}${r.cx != null ? ` &middot; broad-impact index ${fmt(r.cx)}` : ''}${r.a ? ` &nbsp;·&nbsp; ${ajgPill(r.a)} ABS/AJG` : ''}${r.f ? ' &nbsp;·&nbsp; <span class="star">★ FT50</span>' : ''}` +
    rawStats +
    (r.fi && r.fi[0] ? ` &middot; <strong>${fmt(r.fi[0])} Finnish papers</strong>` +
      (!PUB && r.m[I.out] && r.fi[0] <= r.m[I.out] ? ` (${(100 * r.fi[0] / r.m[I.out]).toFixed(1)}% of output)` : '') +
      (r.fx != null ? ` &middot; FI impact ${fmt(r.fx, 2)}×` : '') : '');
  const ks = PROF.map(([k]) => k);
  const med = levelMedianPct(r.l, ks);
  panel.hidden = false;               // unhide BEFORE the chart measures its parent
  if (profileChart) profileChart.destroy();
  profileChart = new Chart(document.getElementById('chart-profile'), {
    data: {
      labels: PROF.map(([, l]) => l),
      datasets: [
        /* lower `order` draws later = on top; bar first so the category axis is inferred */
        { type: 'bar', label: r.n, data: ks.map(k => pctOf(r.m[k], k)), order: 1,
          backgroundColor: LC[r.l], borderWidth: 0, barPercentage: .62 },
        { type: 'scatter', label: `JUFO-${r.l} median`, data: ks.map((k, i) => ({ x: med[k], y: i })),
          order: 0, pointStyle: 'line', rotation: 90, radius: 13, borderWidth: 2.5,
          borderColor: css('--ink-faint'), hoverRadius: 13 },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { min: 0, max: 100, title: { display: true, text: 'percentile among all 24,194 JUFO journals →' } },
                y: { grid: { display: false } } },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: c => c.datasetIndex === 0
          ? `p${fmt(c.parsed.x)} among all JUFO journals`
          : `JUFO-${r.l} median: p${fmt(c.parsed.x)}` } },
      },
    },
  });
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* 9. glossary */
function glossary() {
  const byChan = {};
  Object.entries(D.meta.metrics).forEach(([m, d]) => (byChan[d.channel] ||= []).push([m, d]));
  document.getElementById('glossary-body').innerHTML = Object.entries(byChan).map(([ch, list]) =>
    `<details class="gloss"><summary>${ch} <span class="gloss-n">${list.length} indicators</span></summary>
      <ul>${list.map(([m, d]) => `<li><strong>${m.replace(/ excl self citations/, ' (excl. self-citations)')}</strong> <span class="gloss-unit">${d.unit}</span></li>`).join('')}</ul>
     </details>`).join('');
}

init().catch(e => {
  document.body.insertAdjacentHTML('afterbegin',
    `<pre style="padding:1rem;color:#b91c1c">Failed to load: ${e.message}</pre>`);
});
