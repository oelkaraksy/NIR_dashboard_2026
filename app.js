// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  EGYPT NIR DASHBOARD — app.js                                           ║
// ║                                                                          ║
// ║  DATA YOU UPDATE EACH MONTH (in NIR_Data.csv):                          ║
// ║  Add one new row at the bottom with these columns:                       ║
// ║    Date               e.g.  Feb-2026                                     ║
// ║    NIR_USD_mn         Net International Reserves in USD millions         ║
// ║    Gross_Reserves_USD_mn  Gross reserves in USD millions                 ║
// ║    Gold_USD_mn        Gold value in USD millions                         ║
// ║    SDRs_USD_mn        SDR holdings in USD millions                       ║
// ║    Foreign_Currencies_USD_mn  FX reserves in USD millions               ║
// ║    Liquid_NIR_USD_mn  Liquid NIR in USD millions                         ║
// ║    Gold_Troy_Oz_thousands  Gold volume in THOUSANDS of troy ounces       ║
// ║      → e.g. if CBE reports 4,161,100 troy oz, enter 4161.1              ║
// ║    Gold_Share_Pct     Gold as % of gross reserves (e.g. 39.41)          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const DATA_URL = 'NIR_Data.csv';

// ── TROY → TONNES CONVERSION ──────────────────────────────────────────────────
// Official gold volumes from CBE are in troy ounces.
// Conversion: 1 troy ounce = 31.1035 grams = 0.0311035 kg
// Therefore:  1 metric tonne = 1,000,000 g ÷ 31.1035 g/troy oz = 32,150.75 troy oz
//
// In the CSV, Gold_Troy_Oz_thousands is stored in THOUSANDS of troy ounces.
// Formula applied in troyKToTonnes():
//   tonnes = (Gold_Troy_Oz_thousands × 1,000) ÷ 32,150.75
//
// To change this conversion factor, update TROY_OZ_PER_TONNE below:
const TROY_OZ_PER_TONNE = 32150.7467;

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  brand:   '#0E86C8',
  gold:    '#F4A800',
  fxGreen: '#7EC8A0',
  muted:   '#6B7A99',
  grid:    '#EEF4F8',
  dark:    '#152840',
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let allData = [];
const state = {
  nir:  { startIdx: 0 },
  troy: { startIdx: 0 },
  gold: { startIdx: 0 },
};
let nirChartObj, troyChartObj, goldStackObj;

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    complete: res => {
      allData = res.data.filter(r => r.Date && r.NIR_USD_mn);
      initDefaultRanges();
      render();
    },
    error: () => console.error('Could not load NIR_Data.csv')
  });
});

// ── DEFAULT START POINTS — all 3 charts open at 5 years ──────────────────────
function initDefaultRanges() {
  state.nir.startIdx  = idxFromEnd(60);
  state.troy.startIdx = idxFromEnd(60);
  state.gold.startIdx = idxFromEnd(60);
}

// ── FORMAT HELPERS ────────────────────────────────────────────────────────────
function toBn(mn) {
  if (mn == null || isNaN(mn)) return null;
  return mn / 1000;
}
function fmtBn(mn, dec = 2) {
  const v = toBn(mn);
  if (v == null) return '—';
  return v.toFixed(dec);
}

// Convert Gold_Troy_Oz_thousands → metric tonnes
function troyKToTonnes(troyOzThousands) {
  if (troyOzThousands == null || isNaN(troyOzThousands)) return null;
  return (troyOzThousands * 1000) / TROY_OZ_PER_TONNE;
}

// Format tonnes: no decimal, comma thousands separator  e.g. 4,161 t
function fmtTonnes(troyOzThousands) {
  const t = troyKToTonnes(troyOzThousands);
  if (t == null) return '—';
  return Math.round(t).toLocaleString('en-US') + ' t';
}

// MoM arrow
function momArrow(curr, prev) {
  if (!curr || !prev) return '';
  const d    = curr - prev;
  const dBn  = Math.abs(d / 1000).toFixed(2);
  const pct  = Math.abs((d / prev) * 100).toFixed(1);
  const cls  = d >= 0 ? 'up' : 'down';
  const arrow= d >= 0 ? '▲' : '▼';
  const sign = d >= 0 ? '+' : '−';
  return `<div class="kpi-change ${cls}">${arrow} ${sign}${dBn} bn &nbsp;(${pct}% MoM)</div>`;
}

// YoY arrow
function yoyArrow(curr, prevYear) {
  if (!curr || !prevYear) return '';
  const d    = curr - prevYear;
  const dBn  = Math.abs(d / 1000).toFixed(2);
  const pct  = Math.abs((d / prevYear) * 100).toFixed(1);
  const cls  = d >= 0 ? 'up' : 'down';
  const arrow= d >= 0 ? '▲' : '▼';
  const sign = d >= 0 ? '+' : '−';
  return `<div class="kpi-yoy ${cls}">${arrow} ${sign}${dBn} bn &nbsp;(${pct}% YoY)</div>`;
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  if (!allData.length) return;
  updateKPIs();
  renderNIRChart();
  renderTroyChart();
  renderGoldStackChart();
  renderTable();
  initSliders();
}

// ── KPI CARDS — MoM + YoY on all 4 cards ─────────────────────────────────────
function updateKPIs() {
  const n    = allData.length;
  const last = allData[n - 1];
  const prev = n > 1  ? allData[n - 2]  : null;   // 1 month ago (MoM)
  const yoy  = n > 12 ? allData[n - 13] : null;   // 12 months ago (YoY)

  document.getElementById('latestBadge').textContent = `Latest: ${last.Date}`;

  document.getElementById('kpi-nir').textContent    = fmtBn(last.NIR_USD_mn);
  document.getElementById('kpi-gold').textContent   = fmtBn(last.Gold_USD_mn);
  document.getElementById('kpi-fx').textContent     = fmtBn(last.Foreign_Currencies_USD_mn);
  document.getElementById('kpi-liquid').textContent = fmtBn(last.Liquid_NIR_USD_mn);

  // MoM — all 4 cards
  if (prev) {
    document.getElementById('kpi-nir-chg').innerHTML    = momArrow(last.NIR_USD_mn,                prev.NIR_USD_mn);
    document.getElementById('kpi-gold-chg').innerHTML   = momArrow(last.Gold_USD_mn,               prev.Gold_USD_mn);
    document.getElementById('kpi-fx-chg').innerHTML     = momArrow(last.Foreign_Currencies_USD_mn, prev.Foreign_Currencies_USD_mn);
    document.getElementById('kpi-liquid-chg').innerHTML = momArrow(last.Liquid_NIR_USD_mn,         prev.Liquid_NIR_USD_mn);
  }

  // YoY — all 4 cards
  if (yoy) {
    document.getElementById('kpi-nir-yoy').innerHTML    = yoyArrow(last.NIR_USD_mn,                yoy.NIR_USD_mn);
    document.getElementById('kpi-gold-yoy').innerHTML   = yoyArrow(last.Gold_USD_mn,               yoy.Gold_USD_mn);
    document.getElementById('kpi-fx-yoy').innerHTML     = yoyArrow(last.Foreign_Currencies_USD_mn, yoy.Foreign_Currencies_USD_mn);
    document.getElementById('kpi-liquid-yoy').innerHTML = yoyArrow(last.Liquid_NIR_USD_mn,         yoy.Liquid_NIR_USD_mn);
  }
}

// ── SLICE HELPERS ─────────────────────────────────────────────────────────────
function getSliceFrom(startIdx) { return allData.slice(startIdx); }
function idxFromEnd(n)          { return Math.max(0, allData.length - n); }

// ── CHART 1 — NIR HISTORICAL ──────────────────────────────────────────────────
// Gold rendered first → sits at the bottom of the stacked bar.
function renderNIRChart() {
  const data   = getSliceFrom(state.nir.startIdx);
  const labels = data.map(d => d.Date);

  const cfg = {
    type: 'bar',
    data: { labels, datasets: [
      {
        label: 'Gold',
        data:  data.map(d => toBn(d.Gold_USD_mn)),
        backgroundColor: 'rgba(244,168,0,0.80)',
        stack: 'comp',
        order: 2,
      },
      {
        label: 'Foreign Currencies',
        data:  data.map(d => toBn(d.Foreign_Currencies_USD_mn)),
        backgroundColor: 'rgba(126,200,160,0.60)',
        stack: 'comp',
        order: 2,
      },
      {
        label: 'NIR',
        type:  'line',
        data:  data.map(d => toBn(d.NIR_USD_mn)),
        borderColor: C.brand,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        order: 1,
      },
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle({
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: USD ${Number(ctx.parsed.y).toFixed(2)} bn`
          }
        })
      },
      scales: {
        x: xScale(),
        y: {
          stacked: true,
          ticks: { callback: v => v.toFixed(0) + ' bn', font: { size: 10, family: 'Barlow' }, color: C.muted },
          grid:   { color: C.grid },
          border: { display: false }
        }
      }
    }
  };

  if (nirChartObj) nirChartObj.destroy();
  nirChartObj = new Chart(document.getElementById('nirChart'), cfg);
  updateSliderLabels('nir', state.nir.startIdx, allData.length - 1);
}

// ── CHART 2 — GOLD VOLUME & VALUE ─────────────────────────────────────────────
function renderTroyChart() {
  const data   = getSliceFrom(state.troy.startIdx);
  const labels = data.map(d => d.Date);

  const cfg = {
    type: 'line',
    data: { labels, datasets: [
      {
        label: 'Volume — Left Axis (metric tonnes)',
        data:  data.map(d => troyKToTonnes(d.Gold_Troy_Oz_thousands)),
        borderColor: C.brand,
        backgroundColor: 'rgba(14,134,200,0.07)',
        borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y',
      },
      {
        label: 'Value — Right Axis (USD bn)',
        data:  data.map(d => toBn(d.Gold_USD_mn)),
        borderColor: C.gold,
        backgroundColor: 'rgba(244,168,0,0.07)',
        borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [5, 3], fill: false, yAxisID: 'y1',
      },
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle({
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 0)
                return ` Volume: ${Math.round(ctx.parsed.y).toLocaleString('en-US')} t`;
              return ` Value: USD ${ctx.parsed.y?.toFixed(2)} bn`;
            }
          }
        })
      },
      scales: {
        x: xScale(),
        y: {
          ticks: {
            callback: v => Math.round(v).toLocaleString('en-US') + ' t',
            font: { size: 10, family: 'Barlow' },
            color: C.muted
          },
          grid:   { color: C.grid },
          border: { display: false }
        },
        y1: {
          position: 'right',
          ticks: {
            callback: v => v.toFixed(0) + ' bn',
            font: { size: 10, family: 'Barlow' },
            color: C.muted
          },
          grid:   { drawOnChartArea: false },
          border: { display: false }
        }
      }
    }
  };

  if (troyChartObj) troyChartObj.destroy();
  troyChartObj = new Chart(document.getElementById('troyChart'), cfg);
  updateSliderLabels('troy', state.troy.startIdx, allData.length - 1);
}

// ── CHART 3 — COMPOSITION ─────────────────────────────────────────────────────
function renderGoldStackChart() {
  const data   = getSliceFrom(state.gold.startIdx);
  const labels = data.map(d => d.Date);

  const cfg = {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Gold %',  data: data.map(d => d.Gold_Share_Pct ?? 0),                                  backgroundColor: C.gold,    stack: 'a' },
      { label: 'Other %', data: data.map(d => parseFloat((100 - (d.Gold_Share_Pct ?? 0)).toFixed(2))), backgroundColor: C.fxGreen, stack: 'a' },
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipStyle({
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%` }
        })
      },
      scales: {
        x: xScale(),
        y: {
          stacked: true,
          max: 100,
          ticks: { callback: v => v + '%', font: { size: 10, family: 'Barlow' }, color: C.muted },
          grid:   { color: C.grid },
          border: { display: false }
        }
      }
    }
  };

  if (goldStackObj) goldStackObj.destroy();
  goldStackObj = new Chart(document.getElementById('goldStackChart'), cfg);
  updateSliderLabels('gold', state.gold.startIdx, allData.length - 1);
}

// ── TABLE ─────────────────────────────────────────────────────────────────────
function renderTable() {
  const rows = [...allData].reverse().slice(0, 60);
  document.getElementById('tableBody').innerHTML = rows.map(r => {
    const tonnes    = troyKToTonnes(r.Gold_Troy_Oz_thousands);
    const tonnesFmt = tonnes != null ? Math.round(tonnes).toLocaleString('en-US') + ' t' : '—';
    return `
    <tr>
      <td>${r.Date}</td>
      <td>${fmtBn(r.NIR_USD_mn)}</td>
      <td class="gold-cell">${fmtBn(r.Gold_USD_mn)}</td>
      <td>${fmtBn(r.Foreign_Currencies_USD_mn)}</td>
      <td>${fmtBn(r.Liquid_NIR_USD_mn)}</td>
      <td class="gold-cell">${r.Gold_Share_Pct?.toFixed(1) ?? '—'}%</td>
      <td class="gold-cell">${tonnesFmt}</td>
    </tr>`;
  }).join('');
}

// ── RANGE TAB CONTROLS ────────────────────────────────────────────────────────
function setNirRange(n, el) {
  state.nir.startIdx = idxFromEnd(n);
  document.querySelectorAll('#nirTabs .range-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  syncSlider('nir');
  renderNIRChart();
}

function setTroyRange(n, el) {
  state.troy.startIdx = idxFromEnd(n);
  document.querySelectorAll('#troyTabs .range-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  syncSlider('troy');
  renderTroyChart();
}

function setGoldRange(n, el) {
  state.gold.startIdx = idxFromEnd(n);
  document.querySelectorAll('#goldTabs .range-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  syncSlider('gold');
  renderGoldStackChart();
}

// ── SLIDER LOGIC ──────────────────────────────────────────────────────────────
function initSliders() {
  ['nir', 'troy', 'gold'].forEach(k => syncSlider(k));
}

function syncSlider(k) {
  const slider = document.getElementById(k + 'Slider');
  if (!slider || !allData.length) return;
  slider.max   = allData.length - 1;
  slider.value = state[k].startIdx;
  updateSliderLabels(k, state[k].startIdx, allData.length - 1);
}

function updateSliderLabels(k, startIdx, maxIdx) {
  const s = document.getElementById(k + 'SliderStart');
  const e = document.getElementById(k + 'SliderEnd');
  if (s && allData[startIdx]) s.textContent = allData[startIdx].Date;
  if (e && allData[maxIdx])   e.textContent = allData[maxIdx].Date;
}

function onNirSlider(el) {
  state.nir.startIdx = parseInt(el.value);
  document.querySelectorAll('#nirTabs .range-tab').forEach(b => b.classList.remove('active'));
  updateSliderLabels('nir', state.nir.startIdx, allData.length - 1);
  renderNIRChart();
}
function onTroySlider(el) {
  state.troy.startIdx = parseInt(el.value);
  document.querySelectorAll('#troyTabs .range-tab').forEach(b => b.classList.remove('active'));
  updateSliderLabels('troy', state.troy.startIdx, allData.length - 1);
  renderTroyChart();
}
function onGoldSlider(el) {
  state.gold.startIdx = parseInt(el.value);
  document.querySelectorAll('#goldTabs .range-tab').forEach(b => b.classList.remove('active'));
  updateSliderLabels('gold', state.gold.startIdx, allData.length - 1);
  renderGoldStackChart();
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────
function xScale() {
  return {
    ticks: { maxTicksLimit: 10, font: { size: 10, family: 'Barlow' }, color: C.muted, maxRotation: 0 },
    grid:   { display: false },
    border: { display: false },
  };
}
function tooltipStyle(extra = {}) {
  return {
    backgroundColor: C.dark,
    titleFont:  { family: 'Barlow', size: 11, weight: '600' },
    bodyFont:   { family: 'Barlow', size: 11 },
    padding: 10,
    cornerRadius: 6,
    ...extra,
  };
}
