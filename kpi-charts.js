
/* ============================================================
   SPXID - OPS KPI Monitoring SOC Daily
   Standalone chart module
   ============================================================ */
(function () {
  'use strict';

  const KPI_WEBAPP_URL =
    'https://script.google.com/a/macros/spxexpress.com/s/AKfycbxaYJwEYm9OBHs7QL1gmsX0UXP__zCFHO3loBOnAIInkgjTTgW6Zng5z_T5InFh5UdbcQ/exec';

  const KPI_HEADER_ROW = 1;
  const KEY = 'kpi_cfg_v1';

  let kpi = { headers: [], rows: [] };
  let cfg = {};

  try {
    cfg = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    cfg = {};
  }

  const $ = id => document.getElementById(id);

  const n = v => {
    if (typeof v === 'number') return v;
    if (v === '' || v === null || v === undefined || v === '-') return NaN;
    return parseFloat(String(v).replace('%', '').replace(',', '.'));
  };

  const fmt = x =>
    Number(x).toLocaleString('id-ID', { maximumFractionDigits: 2 });

  // ==========================================================
  // HELPER MANDIRI - TIDAK BERGANTUNG PADA DASHBOARD UTAMA
  // ==========================================================

  function kpiTheme() {
    return {
      muted: '#94a3b8',
      text: '#e2e8f0',
      grid: 'rgba(148,163,184,.18)',
      card: '#1e293b',
      tip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0' }
      }
    };
  }

  function kpiColors() {
    return [
      '#22d3ee',
      '#ff2bd6',
      '#a3ff12',
      '#818cf8',
      '#f59e0b',
      '#fb7185',
      '#34d399'
    ];
  }

  function kpiDateLabel(key) {
    const p = String(key).split('-');
    return p.length === 3 ? p[2] + ' ' + p[1] : key;
  }

  function kpiCatAxis(t, data) {
    return {
      type: 'category',
      data: data,
      axisLabel: { color: t.muted },
      axisLine: { lineStyle: { color: t.grid } },
      axisTick: { show: false },
      splitLine: { show: false }
    };
  }

  function kpiValAxis(t, name) {
    return {
      type: 'value',
      name: name,
      nameTextStyle: { color: t.muted },
      axisLabel: { color: t.muted },
      splitLine: {
        lineStyle: { color: t.grid }
      }
    };
  }

  function kpiGradient(from, to) {
    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: from },
      { offset: 1, color: to }
    ]);
  }

  function kpiToast(message) {
    console.error('[SPXID KPI]', message);
    if (typeof showToast === 'function') {
      showToast(message);
    }
  }

  // ==========================================================
  // MEMBUAT PANEL KPI
  // ==========================================================

  function inject() {
    const grid = document.querySelector(
      '#sec-visualisasi .charts-grid'
    );

    if (!grid || $('kpi-config')) return;

    grid.insertAdjacentHTML('beforeend', `
      <div class="chart-card" id="kpi-config"
           style="grid-column:1/-1">

        <div class="chart-header">
          <div class="chart-title">
            SPXID - OPS KPI Monitoring SOC Daily
            <span class="kpi-bln"
                  style="font-weight:400;color:var(--text-secondary)">
            </span>
          </div>
        </div>

        <div style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
          font-size:12px;
          color:var(--text-secondary);
        ">
          Tanggal:
          <select id="kpi-date" class="select-input"></select>

          Kategori:
          <select id="kpi-cat" class="select-input"></select>

          Nilai:
          <select id="kpi-val" class="select-input"></select>

          Agregasi:
          <select id="kpi-agg" class="select-input">
            <option value="sum">Jumlah</option>
            <option value="avg">Rata-rata</option>
            <option value="count">Hitung baris</option>
          </select>

          <span id="kpi-info">Menunggu data...</span>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">
            SPXID KPI - Komposisi per Kategori
            <span class="kpi-bln"></span>
          </div>
        </div>
        <div id="kpi-donut" class="chart-container"></div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">
            SPXID KPI - Tren per Hari
            <span class="kpi-bln"></span>
          </div>
        </div>
        <div id="kpi-trend" class="chart-container"></div>
      </div>
    `);

    if (!window.echarts) {
      $('kpi-info').textContent =
        'Library ECharts belum dimuat';
      return;
    }

    if (!window.chartInstances ||
        typeof window.chartInstances !== 'object') {
      window.chartInstances = {};
    }

    chartInstances.kpiDonut = echarts.init($('kpi-donut'));
    chartInstances.kpiTrend = echarts.init($('kpi-trend'));

    ['kpi-date', 'kpi-cat', 'kpi-val', 'kpi-agg']
      .forEach(id => {
        $(id).addEventListener('change', function () {
          cfg = {
            date: $('kpi-date').value,
            cat: $('kpi-cat').value,
            val: $('kpi-val').value,
            agg: $('kpi-agg').value
          };

          try {
            localStorage.setItem(KEY, JSON.stringify(cfg));
          } catch (e) {}

          renderKpi();
        });
      });

    $('kpi-agg').value = cfg.agg || 'avg';
  }

  // ==========================================================
  // DROPDOWN
  // ==========================================================

  function opts(id, list, current, first) {
    const el = $(id);
    if (!el) return;

    el.innerHTML = '';

    if (first) {
      el.add(new Option(first, ''));
    }

    list.forEach(h => {
      el.add(new Option(h, h));
    });

    el.value = list.includes(current)
      ? current
      : (first ? '' : (list[0] || ''));
  }

  function setup() {
    const H = kpi.headers;
    const R = kpi.rows;

    const isDate = h =>
      /date|tanggal|tgl/i.test(h) ||
      R.slice(0, 20).some(r =>
        /^\d{4}-\d{2}-\d{2}/.test(String(r[h]))
      );

    const isNum = h => {
      const values = R
        .map(r => r[h])
        .filter(x => x !== '' && x != null && x !== '-');

      return values.length > 0 &&
        values.filter(x => typeof x === 'number').length /
        values.length > 0.6;
    };

    const dates = H.filter(h => isDate(h));
    const nums = H.filter(h => isNum(h) && !isDate(h));
    const cats = H.filter(h => !isNum(h) && !isDate(h));

    const defaultCat =
      H.includes('station_name')
        ? 'station_name'
        : (cats[0] || H[0]);

    const preferredMetrics = [
      '(C1) Completion within cutoff',
      '(C1 TP) TP Clean Floor',
      '(C2 TP) TP FIFO Bulky',
      'Persentase MTD',
      '(B2) Stuck > 48 h'
    ];

    const defaultVal =
      preferredMetrics.find(h => nums.includes(h)) ||
      nums.find(h => h !== '2490') ||
      nums[0];

    opts(
      'kpi-date',
      dates,
      cfg.date || 'date',
      '(tanpa tanggal)'
    );

    opts(
      'kpi-cat',
      cats.length ? cats : H,
      cfg.cat || defaultCat
    );

    opts(
      'kpi-val',
      nums,
      cfg.val || defaultVal,
      '(hitung baris)'
    );

    if (dates.includes('date')) {
      $('kpi-date').value = 'date';
    }
  }

  // ==========================================================
  // FILTER BULAN
  // ==========================================================

  function bulanAktif(d) {
    if (!d) return '';

    const months = kpi.rows
      .map(r => String(r[d]).slice(0, 7))
      .filter(s => /^\d{4}-\d{2}$/.test(s))
      .sort();

    return months[months.length - 1] || '';
  }

  // ==========================================================
  // AGREGASI DATA
  // ==========================================================

  function agg(rows, field, mode) {
    if (!rows.length) return 0;

    if (!field || mode === 'count') {
      return rows.length;
    }

    const valid = rows
      .map(r => r[field])
      .filter(x =>
        x !== '' &&
        x !== null &&
        x !== undefined &&
        x !== '-'
      )
      .map(n)
      .filter(Number.isFinite);

    if (!valid.length) return 0;

    const total = valid.reduce((a, b) => a + b, 0);

    return mode === 'avg'
      ? total / valid.length
      : total;
  }

  const r2 = x => Math.round(x * 100) / 100;

  // ==========================================================
  // RENDER GRAFIK
  // ==========================================================

  function renderKpi() {
    if (!chartInstances.kpiDonut ||
        !chartInstances.kpiTrend) return;

    const d = $('kpi-date').value;
    const c = $('kpi-cat').value;
    const v = $('kpi-val').value;
    const m = $('kpi-agg').value;

    const b = bulanAktif(d);

    const rows = b
      ? kpi.rows.filter(r =>
          String(r[d]).slice(0, 7) === b
        )
      : kpi.rows;

    $('kpi-info').textContent =
      kpi.rows.length
        ? rows.length + ' dari ' + kpi.rows.length + ' baris'
        : 'Belum ada data';

    const t = kpiTheme();

    document.querySelectorAll('.kpi-bln').forEach(el => {
      el.textContent = b ? '· ' + b : '';
    });

    const empty = {
      show: true,
      text: 'Belum ada data',
      left: 'center',
      top: 'center',
      textStyle: {
        color: t.muted,
        fontSize: 14
      }
    };

    // --------------------------------------------------------
    // DONUT
    // --------------------------------------------------------

    const groups = {};

    rows.forEach(r => {
      const key =
        r[c] === '' || r[c] == null
          ? '(kosong)'
          : String(r[c]);

      (groups[key] = groups[key] || []).push(r);
    });

    let data = Object.keys(groups)
      .map(key => ({
        name: key,
        value: r2(agg(groups[key], v, m))
      }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);

    if (data.length > 8) {
      const rest = data
        .slice(8)
        .reduce((a, x) => a + x.value, 0);

      data = data.slice(0, 8).concat([{
        name: 'Lainnya',
        value: r2(rest)
      }]);
    }

    const total = data.reduce(
      (a, x) => a + x.value, 0
    );

    chartInstances.kpiDonut.setOption({
      color: kpiColors(),

      tooltip: Object.assign({
        trigger: 'item',
        formatter: '{b}<br/><b>{c}</b> ({d}%)'
      }, t.tip),

      legend: {
        show: data.length > 0,
        bottom: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: t.muted }
      },

      title: data.length === 0
        ? empty
        : {
            text: fmt(total),
            subtext: v || 'Jumlah baris',
            left: 'center',
            top: '36%',
            textStyle: {
              color: '#fff',
              fontSize: 24,
              fontWeight: 700
            },
            subtextStyle: {
              color: t.muted
            }
          },

      series: [{
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '45%'],

        itemStyle: {
          borderRadius: 8,
          borderColor: t.card,
          borderWidth: 3
        },

        label: {
          show: true,
          position: 'outside',
          color: t.text,
          formatter: p => fmt(p.value)
        },

        labelLine: {
          length: 10,
          length2: 8,
          smooth: true
        },

        data: data
      }]
    }, true);

    // --------------------------------------------------------
    // TREND PER HARI
    // --------------------------------------------------------

    const daily = {};

    if (d) {
      rows.forEach(r => {
        const key = String(r[d]).slice(0, 10);

        (daily[key] = daily[key] || []).push(r);
      });
    }

    const keys = Object.keys(daily).sort();

    const vals = keys.map(key =>
      r2(agg(daily[key], v, m))
    );

    const labels = keys.map(kpiDateLabel);

    chartInstances.kpiTrend.setOption({
      tooltip: Object.assign({
        trigger: 'axis',
        axisPointer: { type: 'line' },
        valueFormatter: x => fmt(x)
      }, t.tip),

      title: vals.length === 0
        ? Object.assign({}, empty, {
            text: d ? 'Belum ada data' : 'Pilih kolom tanggal'
          })
        : { show: false },

      grid: {
        left: 16,
        right: 20,
        top: 44,
        bottom: 8,
        containLabel: true
      },

      xAxis: kpiCatAxis(t, labels),
      yAxis: kpiValAxis(t, v || 'Jumlah baris'),

      series: [{
        type: 'line',
        smooth: true,
        data: vals,
        symbol: 'circle',
        symbolSize: 8,

        lineStyle: {
          width: 3,
          color: '#a3ff12'
        },

        itemStyle: {
          color: '#a3ff12',
          borderColor: '#fff',
          borderWidth: 1.5
        },

        areaStyle: {
          color: kpiGradient(
            'rgba(163,255,18,.35)',
            'rgba(163,255,18,.02)'
          )
        },

        label: {
          show: vals.length <= 16,
          position: 'top',
          color: t.text,
          formatter: p => fmt(p.value)
        }
      }]
    }, true);
  }

  // ==========================================================
  // LOAD API KPI
  // ==========================================================

  function loadKpi() {
    const base = KPI_WEBAPP_URL;

    if (!base) {
      $('kpi-info').textContent =
        'URL Web App KPI belum diatur';
      return;
    }

    const old = $('kpi-data-script');

    if (old) old.remove();

    const cb = 'handleKpiResponse';

    window[cb] = function (res) {
      delete window[cb];

      const script = $('kpi-data-script');
      if (script) script.remove();

      if (!res || !res.success ||
          !Array.isArray(res.rows)) {
        $('kpi-info').textContent =
          'Respons API KPI tidak valid';
        return;
      }

      kpi = {
        headers: res.headers || [],
        rows: res.rows
      };

      console.log(
        '[SPXID KPI] Data berhasil diterima:',
        kpi.rows.length,
        'baris'
      );

      setup();
      renderKpi();
    };

    const script = document.createElement('script');

    script.id = 'kpi-data-script';

    script.src =
      base +
      '?type=kpi&header=' +
      KPI_HEADER_ROW +
      '&callback=' +
      cb +
      '&_=' +
      Date.now();

    script.onerror = function () {
      delete window[cb];

      $('kpi-info').textContent =
        'Gagal menghubungi Web App KPI';

      script.remove();
    };

    document.body.appendChild(script);
  }

  // ==========================================================
  // START
  // ==========================================================

  function start() {
    inject();

    if (!$('kpi-config')) return;

    loadKpi();

    setInterval(loadKpi, 60000);

    window.addEventListener('resize', function () {
      if (chartInstances.kpiDonut) {
        chartInstances.kpiDonut.resize();
      }

      if (chartInstances.kpiTrend) {
        chartInstances.kpiTrend.resize();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
