/* Veille & Sourcing produits Amazon FBA — Objectif : Coût d'achat <= 5€ & Marge nette >= 20% */
(function () {
  "use strict";
  let DATA = window.VEILLE_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    marketplace: "fr",
    category: "all",
    search: "",
    minSales: 0,
    maxSales: 0,
    maxCost: 5.0,
    minMargin: 20,
    maxReviews: 0,
    sourcingMode: true,
    microNicheMode: false,
    tab: "ranking",
    justRefreshed: false,
  };

  const catMeta = Object.fromEntries(DATA.categories.map(c => [c.name, c.emoji]));
  const mpMeta = Object.fromEntries(DATA.marketplaces.map(m => [m.id, m]));

  /* ---------- helpers & FBA margin calculator ---------- */
  const fmt = n => Math.round(n).toLocaleString("fr-FR");
  const money = (n, sym = "€") => sym === "£"
    ? "£" + Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  function ensureMetrics(p) {
    const price = Number(p.price) || 19.99;
    const estCost = p.estSupplierCost !== undefined
      ? Number(p.estSupplierCost)
      : Math.round(Math.max(0.9, price * 0.14) * 100) / 100;
    const fbaFee = p.fbaFee !== undefined
      ? Number(p.fbaFee)
      : (price < 20 ? 3.15 : (price < 35 ? 3.45 : 4.50));
    const referralFee = Math.round(price * 0.15 * 100) / 100;
    const netProfit = Math.round((price - referralFee - fbaFee - estCost) * 100) / 100;
    const marginPct = price > 0 ? Math.round((netProfit / price) * 1000) / 10 : 0;
    const maxSupplierCost20 = Math.round(Math.max(0, price * 0.65 - fbaFee) * 100) / 100;
    const monthlyProfit = Math.round(netProfit * (p.monthlySales || 0));
    const isGem = estCost <= 5.0 && marginPct >= 20.0 && (p.reviews || 0) <= 1200;
    const isMicroNiche = (p.monthlySales >= 100 && p.monthlySales <= 450) && (p.reviews <= 250) && estCost <= 5.0 && marginPct >= 20.0;

    p.estSupplierCost = estCost;
    p.fbaFee = fbaFee;
    p.referralFee = referralFee;
    p.netProfit = netProfit;
    p.marginPct = marginPct;
    p.maxSupplierCost20 = maxSupplierCost20;
    p.monthlyProfit = monthlyProfit;
    p.isGem = isGem;
    p.isMicroNiche = isMicroNiche;
    const cleanTitle = p.title.replace(/\([^)]*\)/g, "").trim();
    if (!p.url || (!p.liveScraped && p.url.includes("/dp/"))) {
      const domain = (mpMeta[p.marketplace] && mpMeta[p.marketplace].label) || "amazon.fr";
      p.url = `https://www.${domain}/s?k=${encodeURIComponent(cleanTitle)}`;
    }
    if (!p.alibabaUrl) {
      p.alibabaUrl = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(cleanTitle.split(" ").slice(0, 5).join(" "))}`;
    }
    return p;
  }

  function prepareAllProducts() {
    DATA.products.forEach(ensureMetrics);
  }
  prepareAllProducts();

  function currentProducts() {
    return DATA.products.filter(p => {
      if (p.marketplace !== state.marketplace) return false;
      if (state.category !== "all" && p.category !== state.category) return false;
      if (p.monthlySales < state.minSales) return false;
      if (state.maxSales > 0 && p.monthlySales > state.maxSales) return false;
      if (state.maxCost > 0 && p.estSupplierCost > state.maxCost) return false;
      if (state.minMargin > 0 && p.marginPct < state.minMargin) return false;
      if (state.maxReviews > 0 && p.reviews > state.maxReviews) return false;
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

  /* ---------- KPIs orientés Sourcing ---------- */
  function renderKpis() {
    const allMp = DATA.products.filter(p => p.marketplace === state.marketplace);
    const filtered = currentProducts();
    const sym = mpMeta[state.marketplace].symbol;

    const avgMargin = filtered.length
      ? (filtered.reduce((s, p) => s + p.marginPct, 0) / filtered.length).toFixed(1)
      : "0.0";
    const avgCost = filtered.length
      ? (filtered.reduce((s, p) => s + p.estSupplierCost, 0) / filtered.length).toFixed(2)
      : "0.00";
    const avgProfitUnit = filtered.length
      ? (filtered.reduce((s, p) => s + p.netProfit, 0) / filtered.length).toFixed(2)
      : "0.00";
    const topGem = filtered.slice().sort((a, b) => b.monthlyProfit - a.monthlyProfit)[0];
    const salesRangeLabel = state.maxSales > 0
      ? `${state.minSales || 0}–${state.maxSales} ventes/m`
      : `Coût ≤ ${money(state.maxCost, sym)} & Marge ≥ ${state.minMargin}%`;

    $("#kpis").innerHTML = `
      <div class="kpi">
        <div class="label">Produits rentables retenus</div>
        <div class="value" style="color:var(--up)">${fmt(filtered.length)} <span class="u">/ ${fmt(allMp.length)}</span></div>
        <div class="sub">${salesRangeLabel}</div>
      </div>
      <div class="kpi">
        <div class="label">Marge nette moyenne</div>
        <div class="value">${avgMargin}% <span class="u">(+${money(avgProfitUnit, sym)}/u.)</span></div>
        <div class="sub">après 15% comm. Amazon + frais FBA</div>
      </div>
      <div class="kpi">
        <div class="label">Coût d'achat usine moyen</div>
        <div class="value">${money(avgCost, sym)} <span class="u">/ unité</span></div>
        <div class="sub">estimation sourcing Alibaba / FOB</div>
      </div>
      <div class="kpi">
        <div class="label">Meilleure opportunité</div>
        <div class="value" style="font-size:16px;line-height:1.3">${topGem ? topGem.emoji + " +" + fmt(topGem.monthlyProfit) + " " + sym + "/mois" : "—"}</div>
        <div class="sub">${topGem ? topGem.title.slice(0, 36) + "…" : "Aucun produit"}</div>
      </div>`;
  }

  /* ---------- Ranking tab (grouped by category) ---------- */
  function renderRanking() {
    const prods = currentProducts();
    const host = $("#tab-ranking");
    if (!prods.length) {
      host.innerHTML = `<div class="empty">Aucun produit ne correspond aux critères (essayez d'élargir Ventes max. ou Avis max.).</div>`;
      return;
    }

    const byCat = {};
    prods.forEach(p => { (byCat[p.category] = byCat[p.category] || []).push(p); });
    const cats = Object.keys(byCat).sort((a, b) =>
      byCat[b].reduce((s, p) => s + p.monthlyProfit, 0) - byCat[a].reduce((s, p) => s + p.monthlyProfit, 0));

    host.innerHTML = cats.map(cat => {
      const list = byCat[cat].slice().sort((a, b) => b.monthlySales - a.monthlySales);
      const totalSales = list.reduce((s, p) => s + p.monthlySales, 0);
      const rows = list.map((p, i) => {
        const rank = i + 1;
        const rk = rank <= 3 ? `rank-${rank}` : "";
        const flashCls = state.justRefreshed ? "row-flash" : "";
        const amzUrl = p.url;
        const microPill = p.isMicroNiche
          ? ' <span class="pill gem">🌱 Micro-Niche facile</span>'
          : (p.isGem ? ' <span class="pill gem">🎯 Pépite ≤5€</span>' : "");
        const livePill = p.liveScraped ? ' <span class="pill" style="color:var(--accent)">🟢 Live</span>' : "";
        const costCls = p.estSupplierCost <= 5.0 ? "cost-ok" : "cost-bad";
        const marginCls = p.marginPct >= 20.0 ? "ok" : "low";
        const entryDiff = p.reviews <= 150
          ? '<span style="color:var(--up)">🟢 Entrée facile</span>'
          : (p.reviews <= 400 ? '<span style="color:var(--accent)">🟡 Entrée moyenne</span>' : '<span style="color:var(--down)">🔴 Concurrentiel</span>');

        return `<tr data-id="${p.id}" class="${flashCls}">
          <td class="rank-cell ${rk}">#${rank}</td>
          <td><div class="cell-prod">
            <div class="thumb">${p.emoji}</div>
            <div>
              <div class="prod-title">${p.title} ${p.isNew ? '<span class="pill new">nouveau</span>' : ""}${microPill}${livePill}</div>
              <div class="prod-sub">
                ${p.brand} ·
                <a href="${amzUrl}" target="_blank" rel="noopener noreferrer" title="Ouvrir sur ${mpMeta[p.marketplace].label}">📦 Voir sur Amazon ↗</a> ·
                <a href="${p.alibabaUrl}" target="_blank" rel="noopener noreferrer" class="ali-link" title="Chercher un fournisseur sur Alibaba">🏭 Sourcer sur Alibaba ↗</a> ·
                ★ ${p.rating} (${fmt(p.reviews)} avis · ${entryDiff})
              </div>
            </div>
          </div></td>
          <td class="num hide-sm">
            <b>${money(p.price, p.symbol)}</b>
            <div class="prod-sub">FBA: -${money(p.fbaFee + p.referralFee, p.symbol)}</div>
          </td>
          <td class="num">
            <span class="${costCls}">${money(p.estSupplierCost, p.symbol)}</span>
            <div class="prod-sub" title="Coût d'achat maximum pour conserver 20% de marge nette">Max 20%: ${money(p.maxSupplierCost20, p.symbol)}</div>
          </td>
          <td class="num">
            <b>${p.netProfit >= 0 ? "+" : ""}${money(p.netProfit, p.symbol)}</b>
            <div><span class="margin-pill ${marginCls}">${p.marginPct}% marge</span></div>
          </td>
          <td class="num">
            <span class="sales">${fmt(p.monthlySales)}</span> <span class="prod-sub">u.</span>
            <div class="prod-sub" style="color:var(--up)">+${fmt(p.monthlyProfit)} ${p.symbol}/m</div>
          </td>
          <td class="hide-sm">${sparkline(p.history)}</td>
        </tr>`;
      }).join("");
      return `<div class="cat-block">
        <div class="cat-head" data-cat="${cat}">
          <span class="emoji">${catMeta[cat] || "📦"}</span>
          <div><h3>${cat}</h3><div class="count">${list.length} produit(s) rentable(s)</div></div>
          <div class="total">Volume cat. : <b>${fmt(totalSales)} ventes/mois</b></div>
          <span class="chev">▼</span>
        </div>
        <div class="cat-body"><table>
          <thead><tr>
            <th>Rang</th>
            <th>Produit &amp; Sourcing</th>
            <th class="num hide-sm">Prix Amazon</th>
            <th class="num">Coût Achat Est.</th>
            <th class="num">Marge Nette / u.</th>
            <th class="num">Ventes &amp; Profit / m</th>
            <th class="hide-sm">30 j</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
    }).join("");

    $$(".cat-head", host).forEach(h => h.addEventListener("click", () => h.parentElement.classList.toggle("collapsed")));
    $$("tbody tr", host).forEach(tr => tr.addEventListener("click", e => {
      if (e.target.closest("a")) return;
      openModal(+tr.dataset.id);
    }));
  }

  /* ---------- Alerts (orientées Opportunités Sourcing) ---------- */
  function buildAlerts() {
    const prods = DATA.products.filter(p => p.marketplace === state.marketplace);
    const alerts = [];
    prods.forEach(p => {
      if (p.isGem && p.marginPct >= 45 && p.reviews <= 400) {
        alerts.push({
          type: "threshold",
          ic: "🎯",
          p,
          t: `Pépite Sourcing détectée (${p.marginPct}% de marge nette)`,
          d: `${p.title} — Achat estimé ${money(p.estSupplierCost, p.symbol)} (≤ 5€), vendu ${money(p.price, p.symbol)} avec seulement ${fmt(p.reviews)} avis et ${fmt(p.monthlySales)} ventes/mois.`,
          w: "Opportunité",
          key: p.monthlyProfit,
        });
      }
      if (p.isNew && p.estSupplierCost <= 5.0) {
        alerts.push({
          type: "new",
          ic: "✨",
          p,
          t: `Nouveau produit sourçable à ≤ 5€`,
          d: `${p.title} (${p.category}) — Achat ~${money(p.estSupplierCost, p.symbol)} · +${money(p.netProfit, p.symbol)}/u. (${p.marginPct}%).`,
          w: "aujourd'hui",
          key: p.monthlySales,
        });
      }
      const rankDelta = (p.prevRank || p.rank) - p.rank;
      if (rankDelta >= 2 && p.estSupplierCost <= 5.0) {
        alerts.push({
          type: "rankup",
          ic: "⬆️",
          p,
          t: `Forte hausse dans « ${p.category} »`,
          d: `${p.title} gagne +${rankDelta} places (#${p.rank}) · Profit estimé : +${fmt(p.monthlyProfit)} ${p.symbol}/mois.`,
          w: "24 h",
          key: rankDelta * 1000,
        });
      }
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

  /* ---------- Modal avec Simulateur de Marge FBA Interactif ---------- */
  function lineChart(hist, w = 640, h = 200) {
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
    const amzUrl = p.url || `https://www.${mpMeta[p.marketplace].label}/dp/${p.asin}`;

    $("#modal-content").innerHTML = `
      <div class="modal-head">
        <div class="thumb">${p.emoji}</div>
        <div>
          <h2>${p.title} ${p.isGem ? '<span class="pill gem">🎯 Pépite ≤5€</span>' : ""}</h2>
          <div class="meta">${p.brand} · ${p.category} · ${mpMeta[p.marketplace].flag} ${mpMeta[p.marketplace].label} · ASIN ${p.asin} · ★ ${p.rating} (${fmt(p.reviews)} avis)</div>
        </div>
        <button class="modal-close" aria-label="Fermer">×</button>
      </div>
      <div class="modal-body">
        <div class="sim-box">
          <h4>
            <span>🧮 Simulateur de Rentabilité &amp; Sourcing FBA</span>
            <span id="sim-verdict"></span>
          </h4>
          <div class="sim-grid">
            <div class="field">
              <label for="sim-price">Prix vente Amazon (${p.symbol})</label>
              <input type="number" id="sim-price" step="0.5" min="1" value="${p.price}">
            </div>
            <div class="field">
              <label for="sim-cost">Coût achat fournisseur (${p.symbol})</label>
              <input type="number" id="sim-cost" step="0.1" min="0.1" value="${p.estSupplierCost}">
            </div>
            <div class="field">
              <label for="sim-fba">Frais livraison FBA (${p.symbol})</label>
              <input type="number" id="sim-fba" step="0.1" min="1" value="${p.fbaFee}">
            </div>
            <div class="field">
              <label for="sim-comm">Commission Amazon (%)</label>
              <input type="number" id="sim-comm" step="1" min="5" max="30" value="15">
            </div>
          </div>
          <div class="sim-breakdown" id="sim-breakdown"></div>
          <div class="sim-actions">
            <a class="btn primary" href="${p.alibabaUrl}" target="_blank" rel="noopener">🏭 Chercher ce produit sur Alibaba (≤ 5€) ↗</a>
            <a class="btn" href="${amzUrl}" target="_blank" rel="noopener">📦 Voir la fiche sur ${mpMeta[p.marketplace].label} ↗</a>
          </div>
        </div>

        <div class="stat-row">
          <div class="stat"><div class="l">Bénéfice net / unité</div><div class="v" id="sim-stat-profit">${money(p.netProfit, p.symbol)}</div></div>
          <div class="stat"><div class="l">Marge nette</div><div class="v" id="sim-stat-margin">${p.marginPct}%</div></div>
          <div class="stat"><div class="l">Coût achat MAX (20%)</div><div class="v" id="sim-stat-maxcost">${money(p.maxSupplierCost20, p.symbol)}</div></div>
          <div class="stat"><div class="l">Profit mensuel estimé</div><div class="v" id="sim-stat-monthly" style="color:var(--up)">+${fmt(p.monthlyProfit)} ${p.symbol}</div></div>
        </div>

        <div class="chart-title">Évolution des ventes mensuelles (${fmt(p.monthlySales)} u./mois · pic ${fmt(peak)} · plancher ${fmt(low)})</div>
        <div class="chart-box">${lineChart(p.history)}</div>
      </div>`;

    function updateSimulator() {
      const sPrice = parseFloat($("#sim-price").value) || 0;
      const sCost = parseFloat($("#sim-cost").value) || 0;
      const sFba = parseFloat($("#sim-fba").value) || 0;
      const sCommPct = parseFloat($("#sim-comm").value) || 15;
      const sComm = Math.round(sPrice * (sCommPct / 100) * 100) / 100;
      const sNet = Math.round((sPrice - sComm - sFba - sCost) * 100) / 100;
      const sMargin = sPrice > 0 ? Math.round((sNet / sPrice) * 1000) / 10 : 0;
      const sMaxCost20 = Math.round(Math.max(0, sPrice * (1 - sCommPct / 100 - 0.20) - sFba) * 100) / 100;
      const sMonthly = Math.round(sNet * p.monthlySales);

      const okCost = sCost <= 5.0;
      const okMargin = sMargin >= 20.0;

      $("#sim-verdict").innerHTML = (okCost && okMargin)
        ? `<span class="margin-pill ok">✅ Objectif respecté (Achat ≤ 5€ &amp; Marge ≥ 20%)</span>`
        : `<span class="margin-pill low">⚠️ Hors cible (${!okCost ? "Coût > 5€" : "Marge < 20%"})</span>`;

      $("#sim-breakdown").innerHTML = `
        <span>Prix vente : <b>${money(sPrice, p.symbol)}</b></span>
        <span>− Comm. Amazon (${sCommPct}%) : <b>-${money(sComm, p.symbol)}</b></span>
        <span>− Frais FBA : <b>-${money(sFba, p.symbol)}</b></span>
        <span>− Coût fournisseur : <b class="${okCost ? "cost-ok" : "cost-bad"}">-${money(sCost, p.symbol)}</b></span>
        <span>= Net : <b style="color:${okMargin ? "var(--up)" : "var(--down)"}">${sNet >= 0 ? "+" : ""}${money(sNet, p.symbol)} (${sMargin}%)</b></span>`;

      $("#sim-stat-profit").textContent = (sNet >= 0 ? "+" : "") + money(sNet, p.symbol);
      $("#sim-stat-profit").style.color = okMargin ? "var(--up)" : "var(--down)";
      $("#sim-stat-margin").textContent = sMargin + "%";
      $("#sim-stat-margin").style.color = okMargin ? "var(--up)" : "var(--down)";
      $("#sim-stat-maxcost").textContent = money(sMaxCost20, p.symbol);
      $("#sim-stat-monthly").textContent = (sMonthly >= 0 ? "+" : "") + fmt(sMonthly) + " " + p.symbol;
    }

    ["#sim-price", "#sim-cost", "#sim-fba", "#sim-comm"].forEach(sel => {
      $(sel, $("#modal-content")).addEventListener("input", updateSimulator);
    });
    updateSimulator();

    $("#modal-content .modal-close").addEventListener("click", closeModal);
    $("#modal").classList.add("open");
  }
  function closeModal() { $("#modal").classList.remove("open"); }

  /* ---------- Export CSV & Excel (avec colonnes Sourcing & Marge) ---------- */
  function exportRows() {
    return currentProducts().slice().sort((a, b) => b.monthlyProfit - a.monthlyProfit).map(p => ({
      Marketplace: mpMeta[p.marketplace].label,
      Categorie: p.category,
      Rang_categorie: p.rank,
      ASIN: p.asin,
      Produit: p.title,
      Marque: p.brand,
      Prix_Amazon: p.price,
      Cout_Achat_Estime_EUR: p.estSupplierCost,
      Cout_Achat_Max_Pour_20pct: p.maxSupplierCost20,
      Frais_FBA: p.fbaFee,
      Commission_Amazon_15pct: p.referralFee,
      Benefice_Net_Unitaire: p.netProfit,
      Marge_Nette_Pct: p.marginPct,
      Ventes_Mois: p.monthlySales,
      Profit_Mensuel_Estime: p.monthlyProfit,
      Avis: p.reviews,
      Note: p.rating,
      URL_Amazon: p.url || `https://www.${mpMeta[p.marketplace].label}/dp/${p.asin}`,
      URL_Sourcing_Alibaba: p.alibabaUrl,
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
    const csv = "\uFEFF" + [head.join(";"), ...rows.map(r => head.map(k => esc(r[k])).join(";"))].join("\r\n");
    download(`sourcing-amazon-${state.marketplace}.csv`, csv, "text/csv;charset=utf-8");
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
    download(`sourcing-amazon-${state.marketplace}.xls`, html, "application/vnd.ms-excel");
  }

  /* ---------- Scan status & Live Refresh ---------- */
  let toastTimer = null;
  function showToast(htmlMsg) {
    const el = $("#live-toast");
    if (!el) return;
    el.innerHTML = htmlMsg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 4800);
  }

  function renderScanInfo(scanning = false) {
    const host = $("#scan-info");
    if (!host) return;
    if (scanning) {
      host.innerHTML = `<span class="dot scanning"></span><b>Scan Sourcing Amazon (${mpMeta[state.marketplace].label}) en cours…</b>`;
      return;
    }
    const d = new Date(DATA.meta.lastScan);
    host.innerHTML = `<span class="dot"></span>Dernier scan : <b>${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b> · <span style="color:var(--up)">Sourcing ≤ 5€</span>`;
  }

  async function refreshDataLive() {
    const btn = $("#btn-refresh");
    const label = $("#refresh-label");
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.classList.add("loading");
    if (label) label.textContent = "Scan Sourcing…";
    renderScanInfo(true);

    let updatedData = null;
    let engineLabel = "";

    try {
      const resp = await fetch(`/api/refresh?mp=${encodeURIComponent(state.marketplace)}`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.products)) {
          updatedData = json;
          engineLabel = json.meta && json.meta.liveScrapedCount > 0
            ? `Scraping Amazon Live (${json.meta.liveScrapedCount} nouveaux produits)`
            : "Analyseur Sourcing Python";
        }
      }
    } catch (_) {
      // Fallback statique
    }

    if (!updatedData) {
      await new Promise(r => setTimeout(r, 380));
      if (typeof window.VEILLE_LIVE_TICK === "function") {
        updatedData = window.VEILLE_LIVE_TICK();
        engineLabel = "Moteur Sourcing embarqué";
      }
    }

    if (updatedData) {
      window.VEILLE_DATA = updatedData;
      DATA = updatedData;
      prepareAllProducts();
      state.justRefreshed = true;
      renderAll();
      setTimeout(() => { state.justRefreshed = false; }, 1300);

      const eligible = currentProducts().length;
      const ms = (DATA.meta && DATA.meta.durationMs) || 15;
      showToast(
        `✅ <b>Scan Sourcing terminé</b> (${engineLabel} · ${ms} ms)<br>` +
        `<span style="color:var(--text-dim)"><b>${fmt(eligible)} produits</b> respectent Coût ≤ ${state.maxCost}€ &amp; Marge ≥ ${state.minMargin}%</span>`
      );
    }

    renderScanInfo(false);
    btn.disabled = false;
    btn.classList.remove("loading");
    if (label) label.textContent = "Actualiser en direct";
  }

  async function hydrateFromJsonIfAvailable() {
    try {
      const resp = await fetch(`assets/data.json?t=${Date.now()}`, { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.products) && json.products.length) {
          window.VEILLE_DATA = json;
          DATA = json;
          prepareAllProducts();
          renderScanInfo(false);
          renderAll();
        }
      }
    } catch (_) {}
  }

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

  function initControls() {
    $("#mp-switch").innerHTML = DATA.marketplaces.map(m =>
      `<button data-mp="${m.id}" class="${m.id === state.marketplace ? "active" : ""}" title="${m.country}">${m.flag} ${m.label}</button>`).join("");
    $$("#mp-switch button").forEach(b => b.addEventListener("click", () => {
      state.marketplace = b.dataset.mp;
      $$("#mp-switch button").forEach(x => x.classList.toggle("active", x === b));
      renderAll();
    }));

    $("#f-cat").innerHTML = `<option value="all">Toutes les catégories</option>` +
      DATA.categories.map(c => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join("");
    $("#f-cat").addEventListener("change", e => { state.category = e.target.value; renderAll(); });
    $("#f-search").addEventListener("input", e => { state.search = e.target.value; renderAll(); });
    $("#f-min").addEventListener("input", e => {
      state.minSales = +e.target.value || 0;
      syncSourcingButtonState();
      renderAll();
    });
    if ($("#f-max-sales")) {
      $("#f-max-sales").addEventListener("input", e => {
        state.maxSales = +e.target.value || 0;
        syncSourcingButtonState();
        renderAll();
      });
    }

    if ($("#f-max-cost")) {
      $("#f-max-cost").addEventListener("input", e => {
        state.maxCost = parseFloat(e.target.value) || 0;
        syncSourcingButtonState();
        renderAll();
      });
    }
    if ($("#f-min-margin")) {
      $("#f-min-margin").addEventListener("input", e => {
        state.minMargin = parseFloat(e.target.value) || 0;
        syncSourcingButtonState();
        renderAll();
      });
    }
    if ($("#f-max-reviews")) {
      $("#f-max-reviews").addEventListener("change", e => {
        state.maxReviews = parseInt(e.target.value, 10) || 0;
        syncSourcingButtonState();
        renderAll();
      });
    }
    if ($("#btn-microniche")) {
      $("#btn-microniche").addEventListener("click", () => {
        state.microNicheMode = !state.microNicheMode;
        if (state.microNicheMode) {
          state.minSales = 100;
          state.maxSales = 350;
          state.maxReviews = 250;
          state.maxCost = 5.0;
          state.minMargin = 20;
        } else {
          state.minSales = 0;
          state.maxSales = 0;
          state.maxReviews = 0;
        }
        if ($("#f-min")) $("#f-min").value = state.minSales || "";
        if ($("#f-max-sales")) $("#f-max-sales").value = state.maxSales || "";
        if ($("#f-max-reviews")) $("#f-max-reviews").value = String(state.maxReviews);
        if ($("#f-max-cost")) $("#f-max-cost").value = state.maxCost;
        if ($("#f-min-margin")) $("#f-min-margin").value = state.minMargin;
        syncSourcingButtonState();
        renderAll();
      });
    }
    if ($("#btn-sourcing")) {
      $("#btn-sourcing").addEventListener("click", () => {
        state.sourcingMode = !state.sourcingMode;
        if (state.sourcingMode) {
          state.maxCost = 5.0;
          state.minMargin = 20;
        } else {
          state.maxCost = 500;
          state.minMargin = 0;
          state.maxSales = 0;
          state.minSales = 0;
          state.maxReviews = 0;
        }
        if ($("#f-max-cost")) $("#f-max-cost").value = state.maxCost;
        if ($("#f-min-margin")) $("#f-min-margin").value = state.minMargin;
        if ($("#f-max-sales")) $("#f-max-sales").value = state.maxSales || "";
        if ($("#f-min")) $("#f-min").value = state.minSales || "";
        if ($("#f-max-reviews")) $("#f-max-reviews").value = String(state.maxReviews);
        syncSourcingButtonState();
        renderAll();
      });
    }

    $("#btn-csv").addEventListener("click", exportCSV);
    $("#btn-xls").addEventListener("click", exportExcel);
    if ($("#btn-refresh")) $("#btn-refresh").addEventListener("click", refreshDataLive);
    $$(".tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    renderScanInfo(false);
  }

  function syncSourcingButtonState() {
    const btn = $("#btn-sourcing");
    const btnMicro = $("#btn-microniche");
    const isTarget = state.maxCost <= 5.0 && state.minMargin >= 20;
    const isMicro = isTarget && state.maxSales > 0 && state.maxSales <= 450;
    state.sourcingMode = isTarget;
    state.microNicheMode = isMicro;
    if (btn) {
      btn.classList.toggle("active-filter", isTarget);
      btn.innerHTML = isTarget
        ? "🎯 Achat ≤ 5€ &amp; Marge ≥ 20%"
        : "⚪ Voir uniquement Achat ≤ 5€ &amp; Marge ≥ 20%";
    }
    if (btnMicro) {
      btnMicro.classList.toggle("active-filter", isMicro);
      btnMicro.innerHTML = isMicro
        ? `🌱 Micro-Niche actif (${state.minSales || 100}–${state.maxSales} v./m) · Cliquer pour élargir`
        : "🌱 Mode Micro-Niche (100–350 v./m &amp; ≤ 250 avis)";
    }
  }

  initControls();
  syncSourcingButtonState();
  switchTab("ranking");
  renderAll();
  hydrateFromJsonIfAvailable();
})();
