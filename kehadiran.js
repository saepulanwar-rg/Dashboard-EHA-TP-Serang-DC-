/* Menu "Kehadiran Tim": persentase masuk dari sheet schedule (lewat Web App KPI).
   Persentase masuk = hadir / (hadir + alpa + sakit + izin), hanya pada hari terjadwal (bukan OFF) yang sudah diisi. */
(function () {
  const BATAS_BAIK = 95, BATAS_CUKUP = 85; // batas warna hijau / kuning di tabel
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const diisi = o => o.hadir + o.alpa + o.sakit + o.izin;
  const pct = o => diisi(o) ? o.hadir / diisi(o) * 100 : null;
  const kls = p => p === null ? 'kpi-muted' : p >= BATAS_BAIK ? 'kpi-ok' : p >= BATAS_CUKUP ? 'kpi-warn' : 'kpi-bad';
  let data = null;

  function inject() {
    const menu = document.querySelector('.sidebar-menu'), body = $('capture-area');
    if (!menu || !body || $('sec-kehadiran')) return;
    const li = document.createElement('li');
    li.innerHTML = '<a href="#" onclick="switchTab(\'kehadiran\')"><i class="fa-solid fa-user-check"></i> Kehadiran Tim</a>';
    const kpi = Array.from(menu.children).find(x => /KPI/.test(x.textContent));
    menu.insertBefore(li, kpi ? kpi.nextSibling : null);
    const kartu = (acc, ic, judul, id) => '<div class="stat-card ' + acc + '"><div class="stat-icon"><i class="fa-solid ' + ic + '"></i></div><div class="stat-card-title">' + judul + '</div><div class="stat-card-value" id="' + id + '">-</div></div>';
    body.insertAdjacentHTML('beforeend', '<section id="sec-kehadiran" class="section-view"><div class="chart-card" style="margin-bottom:20px;padding:12px 20px;"><span style="font-size:13px;font-weight:600;margin-right:10px;"><i class="fa-solid fa-users"></i> Kelompok:</span><select id="kh-grup" class="select-input"><option value="">Semua</option></select></div>' +
      '<div class="stats-grid">' + kartu('acc-green', 'fa-user-check', 'Persentase Masuk (Periode)', 'kh-total') + kartu('acc-blue', 'fa-calendar-day', 'Persentase Masuk Hari Terakhir', 'kh-last') +
      kartu('acc-green', 'fa-circle-check', 'Total Hadir', 'kh-hadir') + kartu('acc-rose', 'fa-user-xmark', 'Alpa (A)', 'kh-alpa') + kartu('acc-amber', 'fa-briefcase-medical', 'Sakit (S)', 'kh-sakit') + kartu('acc-violet', 'fa-umbrella-beach', 'Izin / Cuti (I)', 'kh-izin') + '</div>' +
      '<div class="charts-grid">' +
      '<div class="chart-card"><div class="chart-header"><div class="chart-title">Persentase Masuk per Tim</div></div><div id="kh-chart-tim" class="chart-container"></div></div>' +
      '<div class="chart-card"><div class="chart-header"><div class="chart-title">Komposisi Kehadiran</div></div><div id="kh-chart-donut" class="chart-container"></div></div>' +
      '<div class="chart-card" style="grid-column:1/-1"><div class="chart-header"><div class="chart-title">Persentase Masuk per Hari</div></div><div id="kh-chart-hari" class="chart-container"></div></div></div>' +
      '<div class=\"table-toolbar\" style=\"margin-bottom:12px;\"><div class=\"chart-title\">Kehadiran per Orang</div></div><div id=\"kh-chips\" style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;\"></div>' +
      '<div id="kh-tabel-grup"></div><div style="margin-top:10px;font-size:12px;color:var(--text-secondary);" id="kh-info">Memuat data kehadiran...</div></section>');
    $('kh-chips').addEventListener('click', function (ev) { const b = ev.target.closest('button'); if (!b) return; timDipilih = b.getAttribute('data-t') || ''; renderChips(); renderTabel(); });
    $('kh-grup').addEventListener('change', function () { terapkan(); renderKh(); });
  }

  function charts() {
    ['tim', 'donut', 'hari'].forEach(k => { const el = $('kh-chart-' + k); if (el && el.offsetWidth && !chartInstances['kh' + k]) chartInstances['kh' + k] = echarts.init(el); });
  }

  const bar = p => p === null ? '-' : '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;"><div style="width:70px;height:6px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;"><div style="width:' + Math.min(100, p) + '%;height:100%;background:currentColor;"></div></div>' + fmtPct(p) + '</div>';

  let timDipilih = '';
  function renderChips() {
    if (!data.tim.some(x => x.team === timDipilih)) timDipilih = '';
    const chip = (t, label) => '<button class="btn' + (timDipilih === t ? ' btn-primary' : '') + '" data-t="' + esc(t) + '">' + esc(label) + '</button>';
    $('kh-chips').innerHTML = chip('', 'Semua Tim') + data.tim.map(x => chip(x.team, x.team + ' · ' + x.orang + ' orang · ' + fmtPct(pct(x)))).join('');
  }

  function renderTabel() {
    if (!data) return;
    const f = timDipilih, names = [];
    data.orang.forEach(o => { if (names.indexOf(o.grup) < 0) names.push(o.grup); });
    $('kh-tabel-grup').innerHTML = names.map(g => {
      const rows = data.orang.filter(o => o.grup === g && (!f || o.team === f)), tot = { hadir: 0, alpa: 0, sakit: 0, izin: 0 };
      if (f && !rows.length) return '';
      rows.forEach(o => Object.keys(tot).forEach(k => tot[k] += o[k]));
      const body = rows.map((o, i) => { const p = pct(o); return '<tr><td>' + (i + 1) + '</td><td>' + esc(o.nama) + '</td><td>' + esc(o.jobdesk) + '</td><td>' + esc(o.team) + '</td><td>' + o.hadir + '</td><td>' + o.alpa + '</td><td>' + o.sakit + '</td><td>' + o.izin + '</td><td class="' + kls(p) + '">' + bar(p) + '</td></tr>'; }).join('');
      return '<div class="table-card" style="margin-bottom:20px;"><div class="table-toolbar"><div class="chart-title">' + esc(g) + ' (' + rows.length + ' orang)</div><div class="' + kls(pct(tot)) + '" style="font-weight:700;">Persentase masuk ' + fmtPct(pct(tot)) + '</div></div>' +
        '<div class="kpi-table-wrap"><table class="kpi-table"><thead><tr><th>No</th><th>Nama</th><th>Job Desk (Ops)</th><th>Team</th><th>Hadir</th><th>Alpa</th><th>Sakit</th><th>Izin</th><th>% Masuk</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
    }).join('');
  }

  function renderKh() {
    if (!data) return;
    const t = chartTheme(), tot = data.total, hariIsi = data.hari.filter(h => diisi(h) > 0), last = hariIsi[hariIsi.length - 1];
    setText('kh-total', fmtPct(pct(tot)));
    setText('kh-last', last ? fmtPct(pct(last)) + ' (' + tglIndo(last.label, true) + ')' : '-');
    setText('kh-hadir', fmtAngka(tot.hadir)); setText('kh-alpa', fmtAngka(tot.alpa)); setText('kh-sakit', fmtAngka(tot.sakit)); setText('kh-izin', fmtAngka(tot.izin));
    setText('kh-info', diisi(tot) ? 'Periode ' + tglIndo(data.start) + ' sampai ' + tglIndo(data.end) + '. Hijau ≥ ' + BATAS_BAIK + '%, kuning ≥ ' + BATAS_CUKUP + '%. Hari OFF dan sel yang belum diisi tidak dihitung.' : 'Tabel kehadiran di sheet belum diisi (isi ✓ untuk masuk, A / S / I untuk tidak masuk).');
    renderChips();
    renderTabel();
    charts();
    const kosong = { show: !diisi(tot), text: 'Belum ada data kehadiran', left: 'center', top: 'center', textStyle: { color: t.muted, fontSize: 14, fontWeight: 500 } };
    const fm = v => v === null || v === undefined ? '-' : fmtPct(v);
    if (chartInstances.khtim) chartInstances.khtim.setOption({
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fm }, t.tip), title: kosong,
      grid: { left: 16, right: 16, top: 40, bottom: 8, containLabel: true },
      xAxis: catAxis(t, data.tim.map(x => x.team), 0), yAxis: Object.assign(valAxis(t, '%', v => v + '%'), { min: 0, max: 100 }),
      series: [{ type: 'bar', barMaxWidth: 56, data: data.tim.map(x => pct(x)), itemStyle: { borderRadius: [10, 10, 0, 0], color: vGradient('#39ff88', '#0f9d58'), shadowBlur: 16, shadowColor: 'rgba(57,255,136,.45)' }, label: { show: true, position: 'top', color: t.text, fontWeight: 600, formatter: p => p.value === null ? '' : fmtPct(p.value) } }]
    }, true);
    if (chartInstances.khdonut) {
      const d = [['Hadir', tot.hadir, '#39ff88'], ['Alpa', tot.alpa, '#ff2bd6'], ['Sakit', tot.sakit, '#ffb800'], ['Izin / Cuti', tot.izin, '#22d3ee']].filter(x => x[1] > 0).map(x => ({ name: x[0], value: x[1], itemStyle: { color: x[2] } }));
      chartInstances.khdonut.setOption({
        tooltip: Object.assign({ trigger: 'item', formatter: '{b}<br/><b>{c}</b> ({d}%)' }, t.tip),
        legend: { show: d.length > 0, bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: t.muted } },
        title: d.length ? { text: fmtPct(pct(tot)), subtext: 'Masuk', left: 'center', top: '36%', textStyle: { color: '#fff', fontSize: 24, fontWeight: 700 }, subtextStyle: { color: t.muted, fontSize: 12 } } : kosong,
        series: [{ type: 'pie', radius: ['46%', '68%'], center: ['50%', '45%'], itemStyle: { borderRadius: 8, borderColor: t.card, borderWidth: 3 }, label: { show: true, position: 'outside', color: t.text, fontWeight: 600, formatter: '{c}' }, data: d }]
      }, true);
    }
    if (chartInstances.khhari) chartInstances.khhari.setOption({
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: '#39ff88', type: 'dashed' } }, valueFormatter: fm }, t.tip), title: kosong,
      grid: { left: 16, right: 20, top: 40, bottom: 8, containLabel: true },
      xAxis: catAxis(t, data.hari.map(h => tglIndo(h.label, true)), 0), yAxis: Object.assign(valAxis(t, '%', v => v + '%'), { min: v => Math.max(0, Math.floor(v.min - 5)), max: 100 }),
      series: [{ type: 'line', smooth: true, connectNulls: false, data: data.hari.map(h => pct(h)), symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: '#39ff88', shadowBlur: 12, shadowColor: '#39ff88' }, itemStyle: { color: '#39ff88', borderColor: '#fff', borderWidth: 1.5 }, areaStyle: { color: vGradient('rgba(57,255,136,.3)', 'rgba(57,255,136,.02)') } }]
    }, true);
  }

  let all = null;
  const F = ['hadir', 'alpa', 'sakit', 'izin', 'jadwal'];
  function gabung(list) {
    const out = { start: list[0].start, end: list[0].end, hari: [], tim: [], orang: [], total: { hadir: 0, alpa: 0, sakit: 0, izin: 0, jadwal: 0 } }, idx = {};
    list.forEach(x => {
      if (x.start < out.start) out.start = x.start;
      if (x.end > out.end) out.end = x.end;
      x.hari.forEach(h => { let k = idx[h.label]; if (!k) { k = idx[h.label] = { label: h.label, hadir: 0, alpa: 0, sakit: 0, izin: 0, jadwal: 0 }; out.hari.push(k); } F.forEach(f => k[f] += h[f]); });
      out.tim = out.tim.concat(x.tim);
      out.orang = out.orang.concat(x.orang.map(o => Object.assign({ grup: x.nama }, o)));
      F.forEach(f => out.total[f] += x.total[f]);
    });
    out.hari.sort((a, b) => a.label < b.label ? -1 : 1);
    return out;
  }
  function terapkan() {
    if (!all) return;
    const sel = $('kh-grup'), cur = sel.value;
    sel.innerHTML = '<option value="">Semua</option>' + all.grup.map(x => '<option value="' + esc(x.nama) + '">' + esc(x.nama) + '</option>').join('');
    sel.value = all.grup.some(x => x.nama === cur) ? cur : '';
    const list = all.grup.filter(x => !sel.value || x.nama === sel.value);
    data = gabung(list.length ? list : all.grup);
  }

  function load() {
    const base = typeof KPI_WEBAPP_URL !== 'undefined' ? KPI_WEBAPP_URL : '';
    if (!base) return;
    const cb = 'handleKehadiranResponse';
    const old = $('kh-data-script'); if (old) old.remove();
    window[cb] = function (res) {
      delete window[cb]; const s = $('kh-data-script'); if (s) s.remove();
      if (!res || !res.success || !Array.isArray(res.grup)) { setText('kh-info', 'Data kehadiran gagal dimuat: ' + ((res && res.error) || 'Web App belum memakai kode kehadiran terbaru (deploy New version).')); return; }
      all = res; terapkan(); renderKh();
    };
    const sc = document.createElement('script');
    sc.id = 'kh-data-script';
    sc.src = base + '?type=kehadiran&callback=' + cb + '&_=' + Date.now();
    sc.onerror = function () { delete window[cb]; sc.remove(); setText('kh-info', 'Gagal memuat data kehadiran. Periksa akses Web App.'); };
    document.body.appendChild(sc);
  }

  function start() {
    inject(); load();
    setInterval(load, 60000);
    const orig = window.switchTab;
    window.switchTab = function (t) { orig.apply(this, arguments); if (t === 'kehadiran') setTimeout(function () { renderKh(); resizeAllCharts(); }, 100); };
    const rf = window.forceRefreshData;
    window.forceRefreshData = function () { const r = rf.apply(this, arguments); load(); return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
