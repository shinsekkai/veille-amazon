/* Veille produits Amazon — dashboard prototype (100% client, données de démo) */
(function () {
  "use strict";
  const DATA = window.VEILLE_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    marketplace: "fr",
    category: "all",
    search: "",
    minSales: 0,
    tab: "ranking",
    sort: "sales", // sales | rank
  };

  const catMeta = Object.fromEntries(DATA.categories.map(c => [c.name, c.emoji]));
  const mpMeta = Object.fromEntries(DATA.marketplaces.map(m => [m.id, m]));

  /* ---------- helpers ---------- */
  const fmt = n => n.toLocaleString("fr-FR");
  const money = (n, sym) => sym === "£"
    ? "£" + n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  function currentProducts() {
    return DATA.products.filter(p => {
      if (p.marketplace !== state.marketplace) return false;
      if (state.category !== "all" && p.category !== state.category) return false;
      if (p.monthlySales < state.minSales) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        if (!(p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q)))
          return false;
      }
      return true;
    });
  }

  function sparkline(hist, w = 92, h = 30, color) {
    const min = Math.min(...hist), max = Math.max(...hist);
    const range = max - min || 1;
    const pts = hist.map((v, i) => {
      const x = (i / (hist.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const up = hist[hist.length - 1] >= hist[0];
    const stroke = color || (up ? "#3fb950" : "#f85149");
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline fill="none" stroke="${stroke}" stroke-width="1.6" points="${pts.join(" ")}"/>
    </svg>`;
  }

  function changeBadge(cur, prev) {
    const diff = cur - prev;
    const pct = prev ? Math.round((diff / prev) * 100) : 0;
    if (Math.abs(pct) < 1) return `<span class="chg flat">–</span>`;
    const up = diff > 0;
    return `<span class="chg ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(pct)}%</span>`;
  }

  /* ---------- KPIs ---------- */
  function renderKpis() {
    const prods = DATA.products.filter(p => p.marketplace === state.marketplace);
    const totalSales = prods.reduce((s, p) => s + p.monthlySales, 0);
    const cats = new Set(prods.map(p => p.category));
    const top = prods.slice().sort((a, b) => b.monthlySales - a.monthlySales)[0];
    const sym = mpMeta[state.marketplace].symbol;
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="label">Produits suivis</div><div class="value">${fmt(prods.length)}</div><div class="sub">avec badge « vendus le mois dernier »</div></div>
      <div class="kpi"><div class="label">Ventes cumulées (30 j)</div><div class="value">${fmt(totalSales)} <span class="u">u.</span></div><div class="sub">sur ${mpMeta[state.marketplace].label}</div></div>
      <div class="kpi"><div class="label">Catégories actives</div><div class="value">${cats.size}</div><div class="sub">catégories Amazon natives</div></div>
      <div class="kpi"><div class="label">Top produit</div><div class="value" style="font-size:16px;line-height:1.3">${top ? top.emoji + " " + fmt(top.monthlySales) + " u." : "—"}</div><div class="sub">${top ? top.title.slice(0, 34) : ""}</div></div>`;
  }

  /* ---------- Ranking tab (grouped by category) ---------- */
  function renderRanking() {
    const prods = currentProducts();
    const host = $("#tab-ranking");
    if (!prods.length) { host.innerHTML = `<div class="empty">Aucun produit ne correspond aux filtres.</div>`; return; }

    const byCat = {};
    prods.forEach(p => { (byCat[p.category] = byCat[p.category] || []).push(p); });
    const cats = Object.keys(byCat).sort((a, b) =>
      byCat[b].reduce((s, p) => s + p.monthlySales, 0) - byCat[a].reduce((s, p) => s + p.monthlySales, 0));

    host.innerHTML = cats.map(cat => {
      const list = byCat[cat].slice().sort((a, b) => b.monthlySales - a.monthlySales);
      const total = list.reduce((s, p) => s + p.monthlySales, 0);
      const rows = list.map((p, i) => {
        const rank = i + 1;
        const rk = rank <= 3 ? `rank-${rank}` : "";
        return `<tr data-id="${p.id}">
          <td class="rank-cell ${rk}">#${rank}</td>
          <td><div class="cell-prod">
            <div class="thumb">${p.emoji}</div>
            <div><div class="prod-title">${p.title} ${p.isNew ? '<span class="pill new">nouveau</span>' : ""}</div>
            <div class="prod-sub">${p.brand} · ${p.asin} · ★ ${p.rating}</div></div>
          </div></td>
          <td class="num hide-sm">${money(p.price, p.symbol)}</td>
          <td class="num"><span class="sales">${fmt(p.monthlySales)}</span> <span class="prod-sub">u.</span></td>
          <td class="num">${changeBadge(p.monthlySales, p.prevMonthlySales)}</td>
          <td class="hide-sm">${sparkline(p.history)}</td>
        </tr>`;
      }).join("");
      return `<div class="cat-block">
        <div class="cat-head" data-cat="${cat}">
          <span class="emoji">${catMeta[cat]}</span>
          <div><h3>${cat}</h3><div class="count">${list.length} produit(s) classé(s)</div></div>
          <div class="total">Ventes cat. : <b>${fmt(total)} u.</b></div>
          <span class="chev">▼</span>
        </div>
        <div class="cat-body"><table>
          <thead><tr><th>Rang</th><th>Produit</th><th class="num hide-sm">Prix</th><th class="num">Ventes / mois</th><th class="num">Évol.</th><th class="hide-sm">30 j</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
    }).join("");

    $$(".cat-head", host).forEach(h => h.addEventListener("click", () => h.parentElement.classList.toggle("collapsed")));
    $$("tbody tr", host).forEach(tr => tr.addEventListener("click", () => openModal(+tr.dataset.id)));
  }

  /* ---------- Alerts ---------- */
  function buildAlerts() {
    const prods = DATA.products.filter(p => p.marketplace === state.marketplace);
    const alerts = [];
    const THRESHOLD = 3000;
    prods.forEach(p => {
      if (p.isNew) alerts.push({ type: "new", ic: "✨", p, t: `Nouveau produit détecté`, d: `${p.title} (${p.category}) — ${fmt(p.monthlySales)} ventes/mois dès son apparition.`, w: "aujourd'hui" });
      const rankDelta = p.prevRank - p.rank;
      if (rankDelta >= 2) alerts.push({ type: "rankup", ic: "⬆️", p, t: `Progression au classement`, d: `${p.title} passe de #${p.prevRank} à #${p.rank} dans « ${p.category} » (+${rankDelta} places).`, w: "24 h", key: rankDelta });
      else if (rankDelta <= -2) alerts.push({ type: "rankdown", ic: "⬇️", p, t: `Recul au classement`, d: `${p.title} recule de #${p.prevRank} à #${p.rank} dans « ${p.category} » (${rankDelta} places).`, w: "24 h", key: -rankDelta });
      if (p.monthlySales >= THRESHOLD && p.prevMonthlySales < THRESHOLD)
        alerts.push({ type: "threshold", ic: "🔥", p, t: `Seuil de ventes dépassé`, d: `${p.title} franchit ${fmt(THRESHOLD)} ventes/mois (${fmt(p.monthlySales)} u.).`, w: "24 h", key: p.monthlySales });
    });
    alerts.sort((a, b) => (b.key || 0) - (a.key || 0));
    return alerts;
  }

  function renderAlerts() {
    const alerts = buildAlerts();
    const host = $("#tab-alerts");
    $("#alerts-count").textContent = alerts.length;
    $("#alerts-count").style.display = alerts.length ? "" : "none";
    if (!alerts.length) { host.innerHTML = `<div class="empty">Aucune alerte sur ce marketplace.</div>`; return; }
    host.innerHTML = `<div class="alert-list">` + alerts.map(a => `
      <div class="alert type-${a.type}" data-id="${a.p.id}">
        <div class="ic">${a.ic}</div>
        <div class="body"><div class="t">${a.t}</div><div class="d">${a.d}</div></div>
        <div class="when">${a.w}</div>
      </div>`).join("") + `</div>`;
    $$(".alert", host).forEach(el => el.addEventListener("click", () => openModal(+el.dataset.id)));
  }

  /* ---------- Modal with detail chart ---------- */
  function lineChart(hist, w = 640, h = 220) {
    const pad = { l: 44, r: 12, t: 14, b: 24 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const min = Math.min(...hist), max = Math.max(...hist);
    const range = max - min || 1;
    const x = i => pad.l + (i / (hist.length - 1)) * iw;
    const y = v => pad.t + ih - ((v - min) / range) * ih;
    const line = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `${pad.l},${pad.t + ih} ${line} ${pad.l + iw},${pad.t + ih}`;
    const grid = [0, .25, .5, .75, 1].map(f => {
      const yy = pad.t + ih - f * ih; const val = Math.round(min + f * range);
      return `<line x1="${pad.l}" y1="${yy}" x2="${pad.l + iw}" y2="${yy}" stroke="#2b3345" stroke-width="1"/>
        <text x="${pad.l - 8}" y="${yy + 4}" fill="#6b7688" font-size="10" text-anchor="end">${fmt(val)}</text>`;
    }).join("");
    const labels = [0, Math.floor(hist.length / 2), hist.length - 1].map(i =>
      `<text x="${x(i)}" y="${h - 6}" fill="#6b7688" font-size="10" text-anchor="middle">J-${hist.length - 1 - i}</text>`).join("");
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
      <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff9900" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ff9900" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <polygon points="${area}" fill="url(#g1)"/>
      <polyline points="${line}" fill="none" stroke="#ff9900" stroke-width="2.2" stroke-linejoin="round"/>
      ${labels}
    </svg>`;
  }

  function openModal(id) {
    const p = DATA.products.find(x => x.id === id);
    if (!p) return;
    const peak = Math.max(...p.history), low = Math.min(...p.history);
    $("#modal-content").innerHTML = `
      <div class="modal-head">
        <div class="thumb">${p.emoji}</div>
        <div><h2>${p.title} ${p.isNew ? '<span class="pill new">nouveau</span>' : ""}</h2>
          <div class="meta">${p.brand} · ${p.category} · ${mpMeta[p.marketplace].flag} ${mpMeta[p.marketplace].label} · ASIN ${p.asin} · ★ ${p.rating} (${fmt(p.reviews)} avis)</div></div>
        <button class="modal-close" aria-label="Fermer">×</button>
      </div>
      <div class="modal-body">
        <div class="stat-row">
          <div class="stat"><div class="l">Ventes / mois</div><div class="v">${fmt(p.monthlySales)}</div></div>
          <div class="stat"><div class="l">Rang catégorie</div><div class="v">#${p.rank}</div></div>
          <div class="stat"><div class="l">Prix</div><div class="v" style="font-size:16px">${money(p.price, p.symbol)}</div></div>
          <div class="stat"><div class="l">Évol. 30 j</div><div class="v" style="font-size:16px">${changeBadge(p.monthlySales, p.prevMonthlySales)}</div></div>
        </div>
        <div class="chart-title">Évolution des ventes estimées — 30 derniers jours (pic ${fmt(peak)} · plancher ${fmt(low)})</div>
        <div class="chart-box">${lineChart(p.history)}</div>
      </div>`;
    $("#modal-content .modal-close").addEventListener("click", closeModal);
    $("#modal").classList.add("open");
  }
  function closeModal() { $("#modal").classList.remove("open"); }

  /* ---------- Export ---------- */
  function exportRows() {
    return currentProducts().slice().sort((a, b) => b.monthlySales - a.monthlySales).map(p => ({
      Marketplace: mpMeta[p.marketplace].label,
      Categorie: p.category,
      Rang_categorie: p.rank,
      ASIN: p.asin,
      Produit: p.title,
      Marque: p.brand,
      Prix: p.price,
      Devise: p.currency,
      Ventes_mois: p.monthlySales,
      Ventes_mois_precedent: p.prevMonthlySales,
      Note: p.rating,
      Avis: p.reviews,
      Nouveau: p.isNew ? "oui" : "non",
    }));
  }
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function exportCSV() {
    const rows = exportRows();
    if (!rows.length) return;
    const head = Object.keys(rows[0]);
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "﻿" + [head.join(";"), ...rows.map(r => head.map(k => esc(r[k])).join(";"))].join("\r\n");
    download(`veille-amazon-${state.marketplace}.csv`, csv, "text/csv;charset=utf-8");
  }
  function exportExcel() {
    const rows = exportRows();
    if (!rows.length) return;
    const head = Object.keys(rows[0]);
    const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const th = head.map(h => `<th style="background:#1F4E5F;color:#fff">${h}</th>`).join("");
    const trs = rows.map(r => `<tr>${head.map(k => `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>
      <body><table border="1">${`<tr>${th}</tr>`}${trs}</table></body></html>`;
    download(`veille-amazon-${state.marketplace}.xls`, html, "application/vnd.ms-excel");
  }

  /* ---------- render orchestrator ---------- */
  function renderAll() {
    renderKpis();
    renderRanking();
    renderAlerts();
  }
  function switchTab(tab) {
    state.tab = tab;
    $$(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("#tab-ranking").style.display = tab === "ranking" ? "" : "none";
    $("#tab-alerts").style.display = tab === "alerts" ? "" : "none";
  }

  /* ---------- init ---------- */
  function initControls() {
    // marketplace segmented
    $("#mp-switch").innerHTML = DATA.marketplaces.map(m =>
      `<button data-mp="${m.id}" class="${m.id === state.marketplace ? "active" : ""}" title="${m.country}">${m.flag} ${m.label}</button>`).join("");
    $$("#mp-switch button").forEach(b => b.addEventListener("click", () => {
      state.marketplace = b.dataset.mp;
      $$("#mp-switch button").forEach(x => x.classList.toggle("active", x === b));
      renderAll();
    }));
    // category select
    $("#f-cat").innerHTML = `<option value="all">Toutes les catégories</option>` +
      DATA.categories.map(c => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join("");
    $("#f-cat").addEventListener("change", e => { state.category = e.target.value; renderRanking(); });
    $("#f-search").addEventListener("input", e => { state.search = e.target.value; renderRanking(); });
    $("#f-min").addEventListener("input", e => { state.minSales = +e.target.value || 0; renderRanking(); });
    $("#btn-csv").addEventListener("click", exportCSV);
    $("#btn-xls").addEventListener("click", exportExcel);
    $$(".tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    // scan info
    const d = new Date(DATA.meta.lastScan);
    $("#scan-info").innerHTML = `<span class="dot"></span>Dernier scan : <b>${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</b> · prochain scan quotidien à 06:00`;
  }

  initControls();
  switchTab("ranking");
  renderAll();
})();
