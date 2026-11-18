/* Grafik tambahan: SPXID - OPS KPI Monitoring Dashboard_SOC - Daily_Table
   Dipasang di tab "Visualisasi Data". Memakai helper dari index.html (chartTheme, CHART_COLORS, dst). */
(function () {
  const KPI_WEBAPP_URL = 'https://script.google.com/a/macros/spxexpress.com/s/AKfycbxaYJwEYm9OBHs7QL1gmsX0UXP__zCFHO3loBOnAIInkgjTTgW6Zng5z_T5InFh5UdbcQ/exec'; // Endpoint KPI yang sudah berhasil dites
  const KPI_HEADER_ROW = 1; // nomor baris header di sheet; ubah jika header ada di baris lain
  const KEY = 'kpi_cfg_v1';
  let kpi = { headers: [], rows: [] };
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const $ = id => document.getElementById(id);
  const n = v => typeof v === 'number' ? v : (parseFloat(String(v).replace('%', '').replace(',', '.')) || 0);
  const fmt = x => Number(x).toLocaleString('id-ID', { maximumFractionDigits: 1 });

  function inject() {
    const grid = document.querySelector('#sec-visualisasi .charts-grid');
    if (!grid || $('kpi-config')) return;
    grid.insertAdjacentHTML('beforeend', `
      <div class="chart-card" id="kpi-config" style="grid-column:1/-1">
        <div class="chart-header"><div class="chart-title">SPXID - OPS KPI Monitoring SOC Daily <span class="kpi-bln" style="font-weight:400;color:var(--text-secondary);"></span></div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--text-secondary);">
          Tanggal: <select id="kpi-date" class="select-input"></select>
          Kategori: <select id="kpi-cat" class="select-input"></select>
          Nilai: <select id="kpi-val" class="select-input"></select>
          Agregasi: <select id="kpi-agg" class="select-input"><option value="sum">Jumlah</option><option value="avg">Rata-rata</option><option value="count">Hitung baris</option></select>
          <span id="kpi-info"></span>
        </div>
      </div>
      <div class="chart-card"><div class="chart-header"><div class="chart-title">SPXID KPI - Komposisi per Kategori <span class="kpi-bln" style="font-weight:400;color:var(--text-secondary);"></span></div></div><div id="kpi-donut" class="chart-container"></div></div>
      <div class="chart-card"><div class="chart-header"><div class="chart-title">SPXID KPI - Tren per Hari <span class="kpi-bln" style="font-weight:400;color:var(--text-secondary);"></span></div></div><div id="kpi-trend" class="chart-container"></div></div>`);
    chartInstances.kpiDonut = echarts.init($('kpi-donut'));
    chartInstances.kpiTrend = echarts.init($('kpi-trend'));
    ['kpi-date', 'kpi-cat', 'kpi-val', 'kpi-agg'].forEach(id => $(id).addEventListener('change', () => {
      cfg = { date: $('kpi-date').value, cat: $('kpi-cat').value, val: $('kpi-val').value, agg: $('kpi-agg').value };
      try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
      renderKpi();
    }));
    $('kpi-agg').value = cfg.agg || 'sum';
  }

  function opts(id, list, cur, first) {
    const el = $(id); el.innerHTML = '';
    if (first) el.add(new Option(first, ''));
    list.forEach(h => el.add(new Option(h, h)));
    el.value = list.indexOf(cur) > -1 ? cur : (first ? '' : (list[0] || ''));
  }

  function setup() {
    const H = kpi.headers, R = kpi.rows;
    const isDate = h => /date|tanggal|tgl/i.test(h) || R.slice(0, 20).some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[h])));
    const isNum = h => { const v = R.map(r => r[h]).filter(x => x !== '' && x != null); return v.length > 0 && v.filter(x => typeof x === 'number').length / v.length > 0.6; };
    const dates = H.filter(isDate), nums = H.filter(h => isNum(h) && !isDate(h)), cats = H.filter(h => !isNum(h) && !isDate(h));
    opts('kpi-date', dates, $('kpi-date').value || cfg.date, '(tanpa tanggal)');
    opts('kpi-cat', cats.length ? cats : H, $('kpi-cat').value || cfg.cat);
    opts('kpi-val', nums, $('kpi-val').value || cfg.val, '(hitung baris)');
    if (!$('kpi-date').value && dates.length && !cfg.date) $('kpi-date').value = dates[0];
  }

  function bulanAktif(d) {
    if (!d) return '';
    if (typeof bulanDipilih !== 'undefined' && bulanDipilih) return bulanDipilih;
    const m = kpi.rows.map(r => String(r[d]).slice(0, 7)).filter(s => /^\d{4}-\d{2}$/.test(s)).sort();
    return m[m.length - 1] || '';
  }
  function agg(rows, v, mode) {
    if (!rows.length) return 0;
    if (!v || mode === 'count') return rows.length;

    // Abaikan nilai kosong dan tanda '-' agar rata-rata tidak dianggap nol.
    const valid = rows
      .map(r => r[v])
      .filter(x => x !== '' && x !== null && x !== undefined && x !== '-')
      .map(n)
      .filter(Number.isFinite);

    if (!valid.length) return 0;

    const total = valid.reduce((a, x) => a + x, 0);
    return mode === 'avg' ? total / valid.length : total;
  }
  const r2 = x => Math.round(x * 100) / 100;

  function renderKpi() {
    if (!chartInstances.kpiDonut) return;
    const t = chartTheme(), d = $('kpi-date').value, c = $('kpi-cat').value, v = $('kpi-val').value, m = $('kpi-agg').value;
    const b = bulanAktif(d);
    const rows = b ? kpi.rows.filter(r => String(r[d]).slice(0, 7) === b) : kpi.rows;
    document.querySelectorAll('.kpi-bln').forEach(el => el.textContent = b ? '· ' + bulanLabel(b) : '');
    $('kpi-info').textContent = kpi.rows.length ? rows.length + ' dari ' + kpi.rows.length + ' baris' : 'Belum ada data';
    const empty = { show: true, text: 'Belum ada data', left: 'center', top: 'center', textStyle: { color: t.muted, fontSize: 14, fontWeight: 500 } };

    /* DONUT per kategori */
    const g = {};
    rows.forEach(r => { const k = (r[c] === '' || r[c] == null) ? '(kosong)' : String(r[c]); (g[k] = g[k] || []).push(r); });
    let data = Object.keys(g).map(k => ({ name: k, value: r2(agg(g[k], v, m)) })).filter(x => x.value > 0).sort((a, z) => z.value - a.value);
    if (data.length > 8) { const rest = data.slice(8).reduce((a, x) => a + x.value, 0); data = data.slice(0, 8).concat([{ name: 'Lainnya', value: r2(rest) }]); }
    const total = data.reduce((a, x) => a + x.value, 0);
    chartInstances.kpiDonut.setOption({
      color: CHART_COLORS,
      tooltip: Object.assign({ trigger: 'item', formatter: '{b}<br/><b>{c}</b> ({d}%)' }, t.tip),
      legend: { show: data.length > 0, bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: t.muted } },
      title: data.length === 0 ? empty : { text: fmt(total), subtext: v || 'Jumlah baris', left: 'center', top: '36%', textStyle: { color: '#fff', fontSize: 24, fontWeight: 700, textShadowColor: '#22d3ee', textShadowBlur: 12 }, subtextStyle: { color: t.muted, fontSize: 12 } },
      series: [{
        type: 'pie', radius: ['46%', '68%'], center: ['50%', '45%'],
        itemStyle: { borderRadius: 8, borderColor: t.card, borderWidth: 3, shadowBlur: 16, shadowColor: 'rgba(34,211,238,.35)' },
        label: { show: true, position: 'outside', color: t.text, fontWeight: 600, formatter: p => fmt(p.value) },
        labelLine: { length: 10, length2: 8, smooth: true, lineStyle: { color: t.grid } },
        emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 28, shadowColor: 'rgba(255,43,214,.6)' } },
        data: data
      }]
    }, true);

    /* TREN per hari */
    const gd = {};
    if (d) rows.forEach(r => { const k = String(r[d]).slice(0, 10); (gd[k] = gd[k] || []).push(r); });
    const keys = Object.keys(gd).sort(), vals = keys.map(k => r2(agg(gd[k], v, m)));
    const lbl = vals.length <= 16;
    chartInstances.kpiTrend.setOption({
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: '#a3ff12', type: 'dashed' } }, valueFormatter: x => fmt(x) }, t.tip),
      title: vals.length === 0 ? Object.assign({}, empty, { text: d ? 'Belum ada data' : 'Pilih kolom tanggal' }) : { show: false },
      grid: { left: 16, right: 20, top: 44, bottom: 8, containLabel: true },
      xAxis: catAxis(t, keys.map(k => tglIndo(k, true)), 0),
      yAxis: valAxis(t, v || 'Jumlah baris'),
      series: [{
        type: 'line', smooth: true, data: vals, symbol: 'circle', symbolSize: 8, showSymbol: vals.length <= 31,
        lineStyle: { width: 3, color: '#a3ff12', shadowBlur: 14, shadowColor: '#a3ff12' },
        itemStyle: { color: '#a3ff12', borderColor: '#fff', borderWidth: 1.5, shadowBlur: 10, shadowColor: '#a3ff12' },
        areaStyle: { color: vGradient('rgba(163,255,18,.35)', 'rgba(163,255,18,.02)') },
        label: { show: lbl, position: 'top', color: t.text, fontSize: 11, fontWeight: 600, formatter: p => fmt(p.value) },
        markPoint: (!lbl && vals.length) ? { data: [{ type: 'max', name: 'Tertinggi' }], symbolSize: 46, itemStyle: { color: '#a3ff12' }, label: { color: '#060913', fontWeight: 700 } } : undefined,
        markLine: vals.length ? { symbol: 'none', data: [{ type: 'average', name: 'Rata-rata' }], lineStyle: { color: '#ff2bd6', type: 'dashed', width: 1.5 }, label: { color: '#ff2bd6', position: 'insideEndTop', formatter: p => 'Rata-rata ' + fmt(p.value) } } : undefined
      }]
    }, true);
  }

  function loadKpi() {
    const base = KPI_WEBAPP_URL || (typeof REKAPAN_WEBAPP_URL !== 'undefined' ? REKAPAN_WEBAPP_URL : '');
    if (!base) return;
    const cb = 'handleKpiResponse';
    const old = $('kpi-data-script'); if (old) old.remove();
    window[cb] = function (res) {
      delete window[cb]; const s = $('kpi-data-script'); if (s) s.remove();
      if (!res || !res.success || !Array.isArray(res.rows)) { showToast('Data SPXID KPI gagal dibaca dari Web App.'); return; }
      kpi = { headers: res.headers || [], rows: res.rows };
      setup(); renderKpi();
    };
    const sc = document.createElement('script');
    sc.id = 'kpi-data-script';
    sc.src = base + '?type=kpi&header=' + KPI_HEADER_ROW + '&callback=' + cb + '&_=' + Date.now();
    sc.onerror = function () { delete window[cb]; sc.remove(); showToast('Gagal memuat data SPXID KPI. Periksa akses Web App.'); };
    document.body.appendChild(sc);
  }

  function start() {
    inject(); loadKpi();
    setInterval(loadKpi, 60000);
    const hook = (fn, act) => { const o = window[fn]; if (typeof o === 'function') window[fn] = function () { const r = o.apply(this, arguments); act(); return r; }; };
    hook('forceRefreshData', loadKpi);
    hook('changeBulan', renderKpi);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
