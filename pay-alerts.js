// pay-alerts.js — DIGIY PAY / chef de passe
// Rôle : lire derrière, réduire, remonter seulement les actions utiles.
// Doctrine : moins de fatigue, plus de terrain.
// Dépendance recommandée : session.js + pay-tools.js
//
// Ce fichier ne remet jamais phone, tel, slug ou wave_phone dans l’URL visible.

(() => {
  "use strict";

  const CFG = {
    MODULE: "PAY",
    MAX_ALERTS: 5,

    PATHS: {
      home: "./index.html",
      pin: "./pin.html",
      cockpit: "./cockpit.html",
      admin: "./admin.html",
      brain: "./brain-admin.html"
    },

    SENSITIVE_KEYS: [
      "phone",
      "tel",
      "owner_phone",
      "owner_id",
      "slug",
      "pay_slug",
      "subscription_slug",
      "business_phone",
      "wave_phone",
      "wallet_phone",
      "pay_phone",
      "access_note",
      "keybox_code",
      "keybox_location",
      "module",
      "return",
      "from"
    ]
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    const n = Number(value || 0);
    return Math.round(n).toLocaleString("fr-FR") + " F CFA";
  }

  function toTime(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function ageHours(value) {
    const t = toTime(value);
    if (!t) return 0;
    return Math.max(0, (Date.now() - t) / 36e5);
  }

  function cleanVisibleUrl() {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      CFG.SENSITIVE_KEYS.forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });

      if (changed) {
        history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function cleanInternalUrl(path, fallback = "./index.html") {
    try {
      const url = new URL(path || fallback, window.location.href);

      CFG.SENSITIVE_KEYS.forEach((key) => {
        url.searchParams.delete(key);
      });

      if (url.origin !== window.location.origin) {
        return fallback;
      }

      const file = url.pathname.split("/").pop() || "index.html";

      return `./${file}${url.search || ""}${url.hash || ""}`;
    } catch (_) {
      return fallback;
    }
  }

  function keepLinksClean(root = document) {
    try {
      root.querySelectorAll("a[href]").forEach((link) => {
        const href = link.getAttribute("href") || "";

        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("https://wa.me/")
        ) {
          return;
        }

        link.setAttribute("href", cleanInternalUrl(href, "./index.html"));
      });
    } catch (_) {}
  }

  function tools() {
    return window.DIGIY_PAY_TOOLS || window.PAY_TOOLS || null;
  }

  function normalizeText(row) {
    return [
      row?.label,
      row?.category,
      row?.kind,
      row?.status,
      row?.note_text,
      row?.source_module,
      row?.meta?.intent,
      row?.meta?.complement
    ]
      .join(" ")
      .toLowerCase();
  }

  function field(row, name, fallback = "") {
    return row && row[name] != null ? row[name] : fallback;
  }

  function isProof(row) {
    const txt = normalizeText(row);
    return (
      txt.includes("proof") ||
      txt.includes("preuve") ||
      txt.includes("reçu") ||
      txt.includes("recu") ||
      txt.includes("capture") ||
      txt.includes("payment_proof")
    );
  }

  function isConfirmed(row) {
    const txt = normalizeText(row);
    return (
      txt.includes("confirm") ||
      txt.includes("confirmé") ||
      txt.includes("confirme") ||
      txt.includes("validé") ||
      txt.includes("valide") ||
      txt.includes("payment_confirmed")
    );
  }

  function isToVerify(row) {
    const txt = normalizeText(row);
    return (
      txt.includes("verify") ||
      txt.includes("vérifier") ||
      txt.includes("verifier") ||
      txt.includes("à vérifier") ||
      txt.includes("a verifier") ||
      txt.includes("payment_to_verify")
    );
  }

  function isRelaunch(row) {
    const txt = normalizeText(row);
    return (
      txt.includes("relance") ||
      txt.includes("relancer") ||
      txt.includes("client_relaunch") ||
      txt.includes("à rappeler") ||
      txt.includes("a rappeler")
    );
  }

  function isIncome(row) {
    return String(row?.direction || "") === "in" && String(row?.scope || "") !== "savings";
  }

  function isExpense(row) {
    return String(row?.direction || "") === "out" && String(row?.scope || "") !== "savings";
  }

  function isSaving(row) {
    return String(row?.scope || "") === "savings";
  }

  function latestRows(rows = [], limit = 3) {
    return [...(rows || [])]
      .sort((a, b) => {
        const aa = toTime(a?.created_at || a?.movement_date);
        const bb = toTime(b?.created_at || b?.movement_date);
        return bb - aa;
      })
      .slice(0, limit);
  }

  function countRows(rows, predicate) {
    return (rows || []).filter(predicate).length;
  }

  function sumRows(rows, predicate) {
    return (rows || [])
      .filter(predicate)
      .reduce((sum, row) => sum + Number(row?.amount_xof || 0), 0);
  }

  function makeAlert(input) {
    return {
      id: input.id || `pay-alert-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      level: input.level || "info",
      icon: input.icon || "🔔",
      title: input.title || "Alerte PAY",
      text: input.text || "Une action est recommandée.",
      primaryLabel: input.primaryLabel || "Ouvrir",
      primaryHref: cleanInternalUrl(input.primaryHref || CFG.PATHS.cockpit),
      secondaryLabel: input.secondaryLabel || "",
      secondaryHref: input.secondaryHref ? cleanInternalUrl(input.secondaryHref) : "",
      reason: input.reason || "",
      priority: Number(input.priority || 50)
    };
  }

  function computeStats(rows = []) {
    const all = Array.isArray(rows) ? rows : [];
    const totalIn = sumRows(all, isIncome);
    const totalOut = sumRows(all, isExpense);
    const totalSavings = sumRows(all, isSaving);

    return {
      total: all.length,
      income_count: countRows(all, isIncome),
      expense_count: countRows(all, isExpense),
      savings_count: countRows(all, isSaving),
      proof_count: countRows(all, isProof),
      confirmed_count: countRows(all, isConfirmed),
      verify_count: countRows(all, isToVerify),
      relaunch_count: countRows(all, isRelaunch),
      total_in: totalIn,
      total_out: totalOut,
      total_savings: totalSavings,
      net: totalIn - totalOut
    };
  }

  function buildAlerts(rows = [], context = {}) {
    const all = Array.isArray(rows) ? rows : [];
    const stats = computeStats(all);
    const alerts = [];

    if (!context?.access_ok) {
      alerts.push(makeAlert({
        id: "access-required",
        level: "warning",
        icon: "🔒",
        title: "Code demandé",
        text: "Ouvre ton accès PAY pour lire les alertes réelles.",
        primaryLabel: "Entrer le code",
        primaryHref: CFG.PATHS.pin,
        reason: "Les données restent protégées tant que la session n’est pas ouverte.",
        priority: 100
      }));

      return alerts;
    }

    if (!all.length) {
      alerts.push(makeAlert({
        id: "no-movement",
        level: "warning",
        icon: "➕",
        title: "Aucun mouvement visible",
        text: "Ajoute une entrée, une dépense, une preuve ou une note rapide.",
        primaryLabel: "Ajouter",
        primaryHref: CFG.PATHS.admin,
        reason: "PAY devient utile quand le terrain garde une trace régulière.",
        priority: 92
      }));

      return alerts;
    }

    if (stats.verify_count > 0) {
      alerts.push(makeAlert({
        id: "to-verify",
        level: "hot",
        icon: "⏳",
        title: `${stats.verify_count} paiement(s) à vérifier`,
        text: "Contrôle le canal, le montant ou la preuve avant de confirmer.",
        primaryLabel: "Vérifier",
        primaryHref: CFG.PATHS.admin,
        reason: "Un paiement annoncé ne doit pas être considéré reçu avant vérification.",
        priority: 96
      }));
    }

    if (stats.proof_count > 0) {
      alerts.push(makeAlert({
        id: "proof-received",
        level: "action",
        icon: "🧾",
        title: `${stats.proof_count} preuve(s) repérée(s)`,
        text: "Lis la preuve, compare le montant, puis confirme si tout est propre.",
        primaryLabel: "Traiter",
        primaryHref: CFG.PATHS.admin,
        reason: "PAY garde la trace, mais le professionnel garde la décision.",
        priority: 92
      }));
    }

    if (stats.relaunch_count > 0) {
      alerts.push(makeAlert({
        id: "client-relaunch",
        level: "warning",
        icon: "📤",
        title: `${stats.relaunch_count} relance(s) client`,
        text: "Un client doit être rappelé ou une preuve doit être demandée.",
        primaryLabel: "Relancer",
        primaryHref: CFG.PATHS.admin,
        reason: "Une relance propre évite les oublis et protège la relation client.",
        priority: 88
      }));
    }

    if (stats.net < 0) {
      alerts.push(makeAlert({
        id: "net-negative",
        level: "warning",
        icon: "📉",
        title: "Net sous pression",
        text: `Lecture visible : ${money(stats.net)}. Regarde les sorties avant d’accélérer.`,
        primaryLabel: "Voir espace",
        primaryHref: CFG.PATHS.cockpit,
        reason: "Quand les sorties dépassent les entrées visibles, PAY doit appeler à la prudence.",
        priority: 82
      }));
    }

    if (stats.total_in > 0 && stats.total_savings <= 0) {
      alerts.push(makeAlert({
        id: "no-saving",
        level: "info",
        icon: "🛟",
        title: "Aucune réserve visible",
        text: "Même petite, une mise de côté protège le prochain pas.",
        primaryLabel: "Mettre de côté",
        primaryHref: CFG.PATHS.admin,
        reason: "La doctrine PAY garde l’épargne dans la logique de survie et de croissance.",
        priority: 70
      }));
    }

    const latest = latestRows(all, 1)[0];

    if (latest) {
      const amount = money(field(latest, "amount_xof", 0));
      const label = field(latest, "label", "Mouvement PAY");
      const module = field(latest, "source_module", "PAY");

      alerts.push(makeAlert({
        id: "latest-movement",
        level: "info",
        icon: "👁️",
        title: "Dernier mouvement visible",
        text: `${label} · ${amount} · ${module}`,
        primaryLabel: "Voir",
        primaryHref: CFG.PATHS.cockpit,
        reason: "Même sans urgence, le dernier geste reste accessible.",
        priority: 45
      }));
    }

    if (!alerts.length) {
      alerts.push(makeAlert({
        id: "nothing-urgent",
        level: "success",
        icon: "✅",
        title: "Rien d’urgent",
        text: "Le coffre est calme. Continue à noter les vrais gestes du terrain.",
        primaryLabel: "Actions",
        primaryHref: CFG.PATHS.home,
        reason: "Aucune alerte forte détectée.",
        priority: 30
      }));
    }

    return alerts
      .sort((a, b) => b.priority - a.priority)
      .slice(0, CFG.MAX_ALERTS);
  }

  async function readData() {
    cleanVisibleUrl();

    const helper = tools();

    if (!helper || typeof helper.runAction !== "function") {
      const alert = makeAlert({
        id: "helper-missing",
        level: "warning",
        icon: "⚠️",
        title: "Chef de passe sans câble",
        text: "Le fichier pay-tools.js doit être chargé avant pay-alerts.js.",
        primaryLabel: "Code",
        primaryHref: CFG.PATHS.pin,
        reason: "pay-alerts.js lit et réduit. pay-tools.js tient le câble vers les données.",
        priority: 100
      });

      return {
        ok: false,
        code: "helper_missing",
        context: null,
        rows: [],
        stats: computeStats([]),
        alerts: [alert]
      };
    }

    const ctxRes = await helper.runAction("get_context");

    const context = ctxRes?.context || ctxRes || {};

    if (!context?.access_ok) {
      const alerts = buildAlerts([], context);

      return {
        ok: false,
        code: "access_required",
        context,
        rows: [],
        stats: computeStats([]),
        alerts
      };
    }

    const data = await helper.runAction("list_movements", { limit: 40 });

    if (!data?.ok) {
      const alert = makeAlert({
        id: "read-error",
        level: "warning",
        icon: "⚠️",
        title: "Lecture PAY bloquée",
        text: data?.error || "Impossible de lire les mouvements PAY.",
        primaryLabel: "Recharger",
        primaryHref: CFG.PATHS.cockpit,
        secondaryLabel: "Code",
        secondaryHref: CFG.PATHS.pin,
        reason: "Le chef de passe n’a pas pu lire les mouvements via le câble PAY.",
        priority: 100
      });

      return {
        ok: false,
        code: data?.code || "read_error",
        context,
        rows: [],
        stats: computeStats([]),
        alerts: [alert],
        error: data?.error || ""
      };
    }

    const rows = Array.isArray(data.items) ? data.items : [];
    const stats = computeStats(rows);
    const alerts = buildAlerts(rows, context);

    return {
      ok: true,
      code: "ok",
      context,
      rows,
      stats,
      alerts
    };
  }

  function alertClass(level) {
    return {
      hot: "digiy-pay-alert-hot",
      action: "digiy-pay-alert-action",
      warning: "digiy-pay-alert-warning",
      success: "digiy-pay-alert-success",
      info: "digiy-pay-alert-info"
    }[level] || "digiy-pay-alert-info";
  }

  function renderAlert(alert) {
    return `
      <article class="digiy-pay-alert ${alertClass(alert.level)}">
        <div class="digiy-pay-alert-main">
          <div class="digiy-pay-alert-icon">${esc(alert.icon)}</div>
          <div>
            <strong>${esc(alert.title)}</strong>
            <p>${esc(alert.text)}</p>
          </div>
        </div>

        <div class="digiy-pay-alert-actions">
          <a class="digiy-pay-alert-btn primary" href="${esc(alert.primaryHref)}">${esc(alert.primaryLabel)}</a>
          ${
            alert.secondaryHref
              ? `<a class="digiy-pay-alert-btn" href="${esc(alert.secondaryHref)}">${esc(alert.secondaryLabel || "Voir")}</a>`
              : ""
          }
        </div>

        ${
          alert.reason
            ? `<details class="digiy-pay-alert-details">
                <summary>Pourquoi ?</summary>
                <div>${esc(alert.reason)}</div>
              </details>`
            : ""
        }
      </article>
    `;
  }

  function injectBaseStyle() {
    if (document.getElementById("digiyPayAlertsStyle")) return;

    const style = document.createElement("style");
    style.id = "digiyPayAlertsStyle";
    style.textContent = `
      .digiy-pay-alerts-wrap{
        display:grid;
        gap:10px;
      }

      .digiy-pay-alert{
        border:1px solid rgba(255,255,255,.13);
        border-radius:22px;
        background:rgba(255,255,255,.055);
        padding:13px;
        display:grid;
        gap:10px;
      }

      .digiy-pay-alert-main{
        display:flex;
        gap:10px;
        align-items:flex-start;
      }

      .digiy-pay-alert-icon{
        width:36px;
        height:36px;
        flex:0 0 auto;
        border-radius:14px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.08);
        font-size:18px;
      }

      .digiy-pay-alert strong{
        display:block;
        color:#ecfff4;
        font-size:15px;
        line-height:1.15;
        font-weight:1000;
      }

      .digiy-pay-alert p{
        margin:4px 0 0;
        color:rgba(236,255,244,.72);
        font-size:13px;
        line-height:1.4;
        font-weight:750;
      }

      .digiy-pay-alert-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .digiy-pay-alert-btn{
        min-height:42px;
        border-radius:15px;
        padding:10px 12px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        text-decoration:none;
        background:rgba(255,255,255,.08);
        color:#ecfff4;
        font-weight:950;
        border:1px solid rgba(255,255,255,.12);
      }

      .digiy-pay-alert-btn.primary{
        background:linear-gradient(135deg,#facc15,#eab308);
        color:#151515;
        border-color:transparent;
      }

      .digiy-pay-alert-details{
        border:1px solid rgba(255,255,255,.10);
        border-radius:18px;
        background:rgba(255,255,255,.035);
        overflow:hidden;
      }

      .digiy-pay-alert-details summary{
        cursor:pointer;
        list-style:none;
        padding:11px 12px;
        font-weight:950;
        color:#fff4bd;
      }

      .digiy-pay-alert-details summary::-webkit-details-marker{
        display:none;
      }

      .digiy-pay-alert-details div{
        padding:0 12px 12px;
        color:rgba(236,255,244,.72);
        font-size:13px;
        line-height:1.45;
        font-weight:750;
      }

      .digiy-pay-alert-hot{
        border-color:rgba(250,204,21,.30);
        background:rgba(250,204,21,.10);
      }

      .digiy-pay-alert-action{
        border-color:rgba(34,197,94,.26);
        background:rgba(34,197,94,.09);
      }

      .digiy-pay-alert-warning{
        border-color:rgba(250,204,21,.24);
        background:rgba(250,204,21,.08);
      }

      .digiy-pay-alert-success{
        border-color:rgba(34,197,94,.24);
        background:rgba(34,197,94,.09);
      }

      .digiy-pay-alert-info{
        border-color:rgba(56,189,248,.22);
        background:rgba(56,189,248,.07);
      }
    `;

    document.head.appendChild(style);
  }

  async function render(target = "#payAlerts") {
    injectBaseStyle();

    const node =
      typeof target === "string"
        ? document.querySelector(target)
        : target;

    if (!node) {
      return {
        ok: false,
        error: "Zone d’alertes PAY introuvable.",
        alerts: []
      };
    }

    node.innerHTML = `
      <div class="digiy-pay-alerts-wrap">
        <article class="digiy-pay-alert digiy-pay-alert-info">
          <div class="digiy-pay-alert-main">
            <div class="digiy-pay-alert-icon">🔎</div>
            <div>
              <strong>Lecture PAY…</strong>
              <p>DIGIY prépare les alertes utiles.</p>
            </div>
          </div>
        </article>
      </div>
    `;

    try {
      const data = await readData();
      const alerts = data.alerts || [];

      node.innerHTML = `
        <div class="digiy-pay-alerts-wrap">
          ${alerts.map(renderAlert).join("")}
        </div>
      `;

      keepLinksClean(node);

      return data;
    } catch (err) {
      console.error("[DIGIY_PAY_ALERTS]", err);

      const fallback = makeAlert({
        id: "alerts-error",
        level: "warning",
        icon: "⚠️",
        title: "Alerte non chargée",
        text: "Recharge la page ou entre ton code.",
        primaryLabel: "Code",
        primaryHref: CFG.PATHS.pin,
        reason: "Le chef de passe n’a pas pu lire les données.",
        priority: 100
      });

      node.innerHTML = `
        <div class="digiy-pay-alerts-wrap">
          ${renderAlert(fallback)}
        </div>
      `;

      keepLinksClean(node);

      return {
        ok: false,
        error: err?.message || "Erreur alertes PAY.",
        alerts: [fallback]
      };
    }
  }

  async function getAlerts() {
    const data = await readData();
    return data.alerts || [];
  }

  async function getSnapshot() {
    return await readData();
  }

  function installAutoRender() {
    const target =
      document.querySelector("[data-digiy-pay-alerts]") ||
      document.querySelector("#payAlerts");

    if (target) {
      render(target);
    }
  }

  const api = {
    CFG,
    cleanVisibleUrl,
    cleanInternalUrl,
    keepLinksClean,

    computeStats,
    buildAlerts,
    readData,

    render,
    getAlerts,
    getSnapshot,
    installAutoRender
  };

  cleanVisibleUrl();

  window.DIGIY_PAY_ALERTS = api;
  window.PAY_ALERTS = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAutoRender);
  } else {
    installAutoRender();
  }

  console.info("[DIGIY_PAY_ALERTS] chef de passe chargé.");
})();
