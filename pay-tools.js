// pay-tools.js — DIGIY PAY / coffre d’actions propre
// Doctrine : le pro clique plus qu’il n’écrit.
// DIGIY prépare le geste, le terrain valide avec sa vérité.
// Règle : jamais de téléphone, slug ou identifiant sensible dans l’URL visible.

(() => {
  "use strict";

  const CFG = {
    MODULE: "PAY",
    PATHS: {
      home: "./index.html",
      pin: "./pin.html",
      cockpit: "./cockpit.html",
      admin: "./admin.html",
      brain: "./brain-admin.html"
    },
    RPC: {
      LIST_MOVEMENTS: "digiy_pay_pro_list_movements",
      INSERT_MOVEMENT: "digiy_pay_pro_insert_movement",
      DELETE_MOVEMENT: "digiy_pay_pro_delete_movement"
    },
    STORAGE_KEYS: {
      SESSION_LIST: [
        "digiy_pay_session",
        "DIGIY_PAY_PRO_SESSION",
        "DIGIY_PAY_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_PAY"
      ],
      SLUG: "digiy_pay_slug",
      PHONE: "digiy_pay_phone",
      LAST_SLUG: "digiy_pay_last_slug"
    },
    CHANNELS: ["wave", "cash", "orange_money", "bank", "other"],
    SOURCE_MODULES: [
      "PAY", "DRIVER", "COMMERCE", "POS", "LOC", "MARKET",
      "BUILD", "RESA", "EXPLORE", "JOBS", "QR_PRO", "OTHER"
    ],
    SUPABASE_URL:
      window.DIGIY_SUPABASE_URL ||
      "https://wesqmwjjtsefyjnluosj.supabase.co",
    SUPABASE_ANON_KEY:
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3"
  };

  const SENSITIVE_QUERY_KEYS = [
    "phone", "tel", "owner_phone", "owner_id", "slug", "pay_slug",
    "subscription_slug", "business_phone", "wave_phone", "wallet_phone",
    "pay_phone", "access_note", "keybox_code", "keybox_location",
    "module", "return", "from", "v"
  ];

  const CACHE = { sb: null };

  function normSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normPhone(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function asError(message, extra = {}) {
    return { ok: false, error: String(message || "Erreur PAY."), ...extra };
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    return Math.round(Number(value || 0)).toLocaleString("fr-FR") + " F CFA";
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function cleanVisibleUrl() {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      SENSITIVE_QUERY_KEYS.forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });
      if (changed) history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function cleanInternalUrl(path, fallback = "./cockpit.html") {
    const raw = String(path || fallback).trim() || fallback;
    try {
      const url = new URL(raw, window.location.href);
      SENSITIVE_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
      if (url.origin !== window.location.origin) return fallback;
      const file = url.pathname.split("/").pop() || "cockpit.html";
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
        ) return;

        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;

        SENSITIVE_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
        const file = url.pathname.split("/").pop() || "index.html";
        link.setAttribute("href", `./${file}${url.search || ""}${url.hash || ""}`);
      });
    } catch (_) {}
  }

  function readOne(key) {
    try {
      return safeJsonParse(sessionStorage.getItem(key)) || safeJsonParse(localStorage.getItem(key));
    } catch (_) {
      return null;
    }
  }

  function readStoredSlug() {
    try {
      return normSlug(
        sessionStorage.getItem(CFG.STORAGE_KEYS.SLUG) ||
        sessionStorage.getItem(CFG.STORAGE_KEYS.LAST_SLUG) ||
        localStorage.getItem(CFG.STORAGE_KEYS.SLUG) ||
        localStorage.getItem(CFG.STORAGE_KEYS.LAST_SLUG) ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function readStoredPhone() {
    try {
      return normPhone(
        sessionStorage.getItem(CFG.STORAGE_KEYS.PHONE) ||
        localStorage.getItem(CFG.STORAGE_KEYS.PHONE) ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function getSession() {
    cleanVisibleUrl();

    if (window.DIGIY_SESSION && typeof window.DIGIY_SESSION.get === "function") {
      const session = window.DIGIY_SESSION.get();
      if (session && typeof session === "object") {
        return { ...session, slug: normSlug(session.slug || ""), phone: normPhone(session.phone || "") };
      }
    }

    for (const key of CFG.STORAGE_KEYS.SESSION_LIST) {
      const parsed = readOne(key);
      if (!parsed || typeof parsed !== "object") continue;

      const moduleName = String(parsed.module || parsed.module_code || "").trim().toUpperCase();
      if (moduleName && moduleName !== CFG.MODULE) continue;

      return { ...parsed, slug: normSlug(parsed.slug || ""), phone: normPhone(parsed.phone || "") };
    }

    return null;
  }

  function isAuthenticated() {
    const session = getSession();
    return !!(
      session &&
      (session.access || session.access_ok || session.ok || session.has_access) &&
      !session.preview
    );
  }

  function buildPinUrl(redirect = "") {
    const safe = String(redirect || "").trim().toLowerCase();
    const allowed = {
      cockpit: "cockpit",
      "cockpit.html": "cockpit",
      admin: "admin",
      "admin.html": "admin",
      brain: "brain",
      "brain-admin": "brain",
      "brain-admin.html": "brain"
    };
    const key = allowed[safe] || "";
    return cleanInternalUrl(`./pin.html${key ? `?redirect=${encodeURIComponent(key)}` : ""}`, "./pin.html");
  }

  function getContextSync() {
    const session = getSession() || {};
    const slug = normSlug(session.slug || readStoredSlug() || "");
    const phone = normPhone(session.phone || readStoredPhone() || "");

    return {
      ok: true,
      module: CFG.MODULE,
      slug,
      phone,
      access_ok: !!(session.access || session.access_ok || session.ok || session.has_access),
      preview: typeof session.preview === "boolean" ? !!session.preview : !isAuthenticated(),
      source: session.source || (window.DIGIY_SESSION ? "session.js" : "storage"),
      pin_url: buildPinUrl(),
      cockpit_url: cleanInternalUrl(CFG.PATHS.cockpit),
      admin_url: cleanInternalUrl(CFG.PATHS.admin)
    };
  }

  async function getContext() {
    return getContextSync();
  }

  async function requireContext(opts = {}) {
    const ctx = await getContext();
    if (!ctx.ok) return ctx;
    if (!ctx.slug && !opts.allowWithoutSlug) return asError("Repère PAY manquant.", { context: ctx, code: "missing_slug" });
    if (!ctx.phone && !opts.allowWithoutPhone) return asError("Téléphone PAY manquant.", { context: ctx, code: "missing_phone" });
    return ctx;
  }

  async function requireWriteAccess() {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;
    if (!ctx.access_ok || ctx.preview) {
      return asError("Code PAY requis pour modifier.", { context: ctx, code: "access_required" });
    }
    return ctx;
  }

  function go(path, mode = "href") {
    const url = cleanInternalUrl(path, CFG.PATHS.cockpit);
    if (mode === "replace") location.replace(url);
    else location.href = url;
    return { ok: true, url };
  }

  function goPin(redirect = "") {
    return go(buildPinUrl(redirect), "replace");
  }

  function goCockpit() {
    return go(CFG.PATHS.cockpit);
  }

  function goAdmin() {
    return go(CFG.PATHS.admin);
  }

  function getSupabaseClient() {
    if (CACHE.sb) return CACHE.sb;

    if (window.DIGIY_PAY_SB && typeof window.DIGIY_PAY_SB.rpc === "function") {
      CACHE.sb = window.DIGIY_PAY_SB;
      return CACHE.sb;
    }

    if (window.sb && typeof window.sb.rpc === "function") {
      CACHE.sb = window.sb;
      window.DIGIY_PAY_SB = CACHE.sb;
      return CACHE.sb;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") return null;

    CACHE.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: {
        storageKey: "digiy-pay-tools-auth-token",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }
    });

    window.DIGIY_PAY_SB = CACHE.sb;
    window.sb = CACHE.sb;
    return CACHE.sb;
  }

  async function callPayRpc(name, args = {}) {
    const sb = getSupabaseClient();
    if (!sb) return asError("Supabase indisponible.", { code: "supabase_missing", rpc: name });

    try {
      const { data, error } = await sb.rpc(name, args);
      if (error) {
        return asError(error.message || "RPC PAY impossible.", {
          code: error.code || "rpc_error",
          details: error.details || "",
          hint: error.hint || "",
          rpc: name,
          raw: error
        });
      }

      const payload = data && typeof data === "object" ? data : { data };
      if (payload.ok === false) {
        return asError(payload.error || "RPC PAY refusée.", {
          code: payload.error || "rpc_failed",
          rpc: name,
          payload
        });
      }

      return { ok: true, rpc: name, payload };
    } catch (err) {
      return asError(err?.message || "Erreur RPC PAY.", {
        code: err?.code || "rpc_exception",
        details: err?.details || "",
        hint: err?.hint || "",
        rpc: name,
        raw: err
      });
    }
  }

  function normalizeScope(value) {
    const v = String(value || "").toLowerCase();
    if (v === "personal" || v === "perso") return "perso";
    if (v === "saving" || v === "savings" || v === "epargne" || v === "épargne") return "savings";
    return "pro";
  }

  function normalizeKind(value, scope = "") {
    const v = String(value || "").toLowerCase();
    const cleanScope = normalizeScope(scope);
    if (cleanScope === "savings") return "saving";
    if (["sale", "expense", "saving", "transfer", "other"].includes(v)) return v;
    if (["debt_repayment", "home_expense", "credit_repayment", "emergency", "bill_due"].includes(v)) return "expense";
    return "other";
  }

  function normalizeChannel(value) {
    const v = String(value || "").toLowerCase();
    if (CFG.CHANNELS.includes(v)) return v;
    if (v === "bank_transfer" || v === "virement") return "bank";
    if (v === "manual" || v === "unknown" || v === "card") return "other";
    return "other";
  }

  function normalizeSourceModule(value) {
    const v = String(value || "PAY").toUpperCase();
    if (v === "CAISSE") return "POS";
    if (CFG.SOURCE_MODULES.includes(v)) return v;
    return "PAY";
  }

  function normalizeDirection(value, kind = "", scope = "") {
    const v = String(value || "").toLowerCase();
    if (v === "in" || v === "out") return v;
    if (normalizeScope(scope) === "savings") return "in";
    if (normalizeKind(kind, scope) === "sale") return "in";
    return "out";
  }

  function categoryLabel(value) {
    const map = {
      payment_received: "Paiement reçu",
      payment_proof: "Preuve reçue",
      payment_confirmed: "Paiement confirmé",
      payment_to_verify: "Paiement à vérifier",
      client_relaunch: "Client à relancer",
      daily_supplies: "Courses / ravitaillement journalier",
      monthly_supplies: "Courses / ravitaillement mensuel",
      food_home: "Nourriture maison",
      stock_purchase: "Achat stock boutique",
      restaurant_supplies: "Ravitaillement restaurant",
      fuel: "Carburant",
      vehicle_repair: "Panne / réparation véhicule",
      maintenance: "Entretien / maintenance",
      delivery: "Livraison / transport",
      rent_business: "Loyer activité",
      electricity: "Électricité",
      internet_phone: "Internet / téléphone",
      staff_payment: "Paiement équipe",
      supplier_payment: "Fournisseur",
      medicine: "Médicaments",
      hospitalization: "Hospitalisation",
      school_fees: "Frais scolaires",
      family_support: "Aide famille",
      emergency: "Imprévu / urgence",
      saving: "Mise de côté",
      opening_balance: "Fond de caisse de départ",
      salary_received: "Salaire reçu",
      owner_salary: "Salaire versé au pro",
      debt_received: "Remboursement reçu",
      home_expense: "Dépense maison",
      credit_repayment: "Crédit / emprunt remboursé",
      loan_received: "Emprunt reçu",
      debt_repayment: "Remboursement dette",
      bill_due: "Facture à régler",
      business_expense: "Dépense activité",
      quick_note: "Note rapide",
      other: "Autre"
    };
    return map[String(value || "")] || String(value || "");
  }

  function frequencyLabel(value) {
    const map = {
      one_time: "Ponctuel",
      daily: "Journalier",
      weekly: "Hebdomadaire",
      monthly: "Mensuel",
      unexpected: "Imprévu"
    };
    return map[String(value || "")] || String(value || "");
  }

  function buildMovementPayload(input = {}, ctx = {}) {
    const scope = normalizeScope(input.scope || input.ui_scope || "pro");
    const kind = normalizeKind(input.kind || "other", scope);
    const direction = normalizeDirection(input.direction || "", kind, scope);
    const amount = Math.round(Number(input.amount_xof || input.amount || 0));
    const sourceModule = normalizeSourceModule(input.source_module || input.sourceModule || "PAY");
    const channel = normalizeChannel(input.channel || "other");
    const category = String(input.category || "").trim();
    const label = String(
      input.label ||
      input.labelText ||
      input.complement ||
      categoryLabel(category) ||
      "Mouvement PAY"
    ).trim();
    const note = String(input.note_text || input.note || input.noteText || "").trim();
    const sourceId = String(input.source_id || input.sourceId || "").trim();
    const frequency = String(input.frequency || input.movement_frequency || "one_time").trim();

    return {
      slug: normSlug(ctx.slug || input.slug || ""),
      phone: normPhone(ctx.phone || input.phone || "") || null,
      direction,
      scope,
      kind,
      category: category || null,
      amount_xof: amount,
      currency_code: "XOF",
      channel,
      label,
      note_text: note || null,
      source_module: sourceModule,
      source_id: sourceId || null,
      origin: input.origin || "manual",
      movement_date: input.movement_date || input.movementDate || todayStr(),
      status: input.status || "posted",
      meta: {
        from_draft: !!input.from_draft || !!input.fromDraft,
        intent: input.intent || null,
        complement: input.complement || null,
        source_slug: input.source_slug || null,
        draft_source_module: input.draft_source_module || input.source_module || null,
        frequency,
        frequency_label: frequencyLabel(frequency),
        category_label: categoryLabel(category),
        doctrine_note: "Catégorie guidée par PAY pour réduire l’écriture du pro.",
        ...(input.meta && typeof input.meta === "object" ? input.meta : {})
      }
    };
  }

  function validateMovementPayload(payload = {}) {
    if (!payload.slug) return asError("Repère PAY manquant.", { code: "missing_slug" });
    if (!payload.phone) return asError("Téléphone PAY manquant.", { code: "missing_phone" });
    if (!payload.label) return asError("Libellé manquant.", { code: "missing_label" });
    if (!payload.amount_xof || payload.amount_xof <= 0) return asError("Montant invalide.", { code: "invalid_amount" });
    if (!payload.movement_date) return asError("Date manquante.", { code: "missing_date" });
    return { ok: true };
  }

  async function listMovements(input = {}) {
    const ctx = await requireContext();
    if (!ctx.ok) return ctx;

    const limit = Number(input.limit || input.p_limit || 30) || 30;
    const res = await callPayRpc(CFG.RPC.LIST_MOVEMENTS, {
      p_slug: ctx.slug,
      p_phone: ctx.phone,
      p_limit: limit
    });
    if (!res.ok) return res;

    const payload = res.payload || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    return { ok: true, tool: "list_movements", context: ctx, count: items.length, items, payload };
  }

  async function insertMovement(input = {}) {
    const ctx = await requireWriteAccess();
    if (!ctx.ok) return ctx;

    const payload = buildMovementPayload(input, ctx);
    const valid = validateMovementPayload(payload);
    if (!valid.ok) return { ...valid, payload };

    const res = await callPayRpc(CFG.RPC.INSERT_MOVEMENT, {
      p_slug: ctx.slug,
      p_phone: ctx.phone,
      p_payload: payload
    });
    if (!res.ok) return res;

    return { ok: true, tool: "insert_movement", context: ctx, payload, result: res.payload };
  }

  async function deleteMovement(input = {}) {
    const ctx = await requireWriteAccess();
    if (!ctx.ok) return ctx;

    const id = typeof input === "string"
      ? String(input || "").trim()
      : String(input.id || input.p_id || "").trim();

    if (!id) return asError("ID mouvement manquant.", { code: "missing_id", context: ctx });

    const res = await callPayRpc(CFG.RPC.DELETE_MOVEMENT, {
      p_slug: ctx.slug,
      p_phone: ctx.phone,
      p_id: id
    });
    if (!res.ok) return res;

    return { ok: true, tool: "delete_movement", context: ctx, id, result: res.payload };
  }

  function draftToAdminUrl(input = {}) {
    const scope = normalizeScope(input.scope || "pro");
    const kind = normalizeKind(input.kind || "", scope);
    const direction = normalizeDirection(input.direction || "", kind, scope);
    const channel = normalizeChannel(input.channel || "other");
    const sourceModule = normalizeSourceModule(input.source_module || input.sourceModule || "PAY");
    const params = new URLSearchParams();

    params.set("fromDraft", "1");
    params.set("direction", direction);
    params.set("scope", scope);
    params.set("kind", kind);
    params.set("channel", channel);
    params.set("source_module", sourceModule);

    if (input.amount_xof || input.amount) params.set("amount_xof", String(input.amount_xof || input.amount));
    if (input.category) params.set("category", String(input.category));
    if (input.frequency || input.movement_frequency) params.set("frequency", String(input.frequency || input.movement_frequency));
    if (input.movement_date || input.movementDate) params.set("movement_date", String(input.movement_date || input.movementDate));
    if (input.source_id || input.sourceId) params.set("source_id", String(input.source_id || input.sourceId));
    if (input.label || input.labelText) params.set("label", String(input.label || input.labelText));
    if (input.note || input.note_text || input.noteText) params.set("note", String(input.note || input.note_text || input.noteText));
    if (input.complement) params.set("complement", String(input.complement));
    if (input.intent) params.set("intent", String(input.intent));
    if (input.source_slug) params.set("source_slug", String(input.source_slug));

    return cleanInternalUrl(`./admin.html?${params.toString()}`, CFG.PATHS.admin);
  }

  function openDraftInAdmin(input = {}) {
    return go(draftToAdminUrl(input));
  }

  function buildQuickAction(action, extra = {}) {
    const key = String(action || "").trim().toLowerCase();
    const presets = {
      income: { label: "Encaissement client", direction: "in", scope: "pro", kind: "sale", channel: "wave", category: "payment_received", intent: "income" },
      proof: { label: "Preuve de paiement reçue", direction: "in", scope: "pro", kind: "sale", channel: "wave", category: "payment_proof", intent: "proof" },
      confirm: { label: "Paiement confirmé", direction: "in", scope: "pro", kind: "sale", channel: "wave", category: "payment_confirmed", intent: "confirm" },
      verify: { label: "Paiement à vérifier", direction: "in", scope: "pro", kind: "sale", channel: "wave", category: "payment_to_verify", intent: "verify" },
      relaunch: { label: "Client à relancer", direction: "in", scope: "pro", kind: "other", channel: "other", category: "client_relaunch", intent: "relaunch" },
      expense: { label: "Dépense activité", direction: "out", scope: "pro", kind: "expense", channel: "cash", category: "business_expense", intent: "expense" },
      home_expense: { label: "Dépense maison", direction: "out", scope: "perso", kind: "expense", channel: "cash", category: "home_expense", intent: "home_expense" },
      debt_paid: { label: "Dette remboursée", direction: "out", scope: "perso", kind: "expense", channel: "cash", category: "debt_repayment", intent: "debt_paid" },
      debt_repayment: { label: "Dette remboursée", direction: "out", scope: "perso", kind: "expense", channel: "cash", category: "debt_repayment", intent: "debt_paid" },
      debt_received: { label: "Remboursement reçu", direction: "in", scope: "perso", kind: "other", channel: "cash", category: "debt_received", intent: "debt_received" },
      credit_paid: { label: "Crédit ou emprunt remboursé", direction: "out", scope: "perso", kind: "expense", channel: "bank", category: "credit_repayment", intent: "credit_paid" },
      loan_received: { label: "Emprunt reçu", direction: "in", scope: "perso", kind: "other", channel: "cash", category: "loan_received", intent: "loan_received" },
      bill_due: { label: "Facture ou échéance à payer", direction: "out", scope: "pro", kind: "expense", channel: "other", category: "bill_due", status: "pending", intent: "bill_due" },
      emergency: { label: "Imprévu ou urgence", direction: "out", scope: "perso", kind: "expense", channel: "cash", category: "emergency", intent: "emergency" },
      saving: { label: "Mise de côté", direction: "in", scope: "savings", kind: "saving", channel: "cash", category: "saving", intent: "saving" },
      note: { label: "Note rapide PAY", direction: "in", scope: "pro", kind: "other", channel: "other", category: "quick_note", intent: "note" },
      opening_balance: { label: "Fond de caisse de départ", direction: "in", scope: "pro", kind: "other", channel: "cash", category: "opening_balance", frequency: "one_time", intent: "opening_balance" },
      salary_received: { label: "Salaire reçu", direction: "in", scope: "perso", kind: "other", channel: "bank", category: "salary_received", frequency: "monthly", intent: "salary_received" }
    };

    return { ...(presets[key] || presets.income), ...extra };
  }

  function computeStats(items = []) {
    const arr = Array.isArray(items) ? items : [];
    const totalIn = arr
      .filter((x) => String(x.direction || "") === "in" && String(x.scope || "") !== "savings")
      .reduce((sum, x) => sum + Number(x.amount_xof || 0), 0);
    const totalOut = arr
      .filter((x) => String(x.direction || "") === "out" && String(x.scope || "") !== "savings")
      .reduce((sum, x) => sum + Number(x.amount_xof || 0), 0);
    const totalSavings = arr
      .filter((x) => String(x.scope || "") === "savings")
      .reduce((sum, x) => sum + Number(x.amount_xof || 0), 0);

    return { total_in: totalIn, total_out: totalOut, total_savings: totalSavings, net: totalIn - totalOut, count: arr.length };
  }

  function textBlob(row = {}) {
    return [
      row.category, row.kind, row.label, row.note_text,
      row.source_module, row.channel, row.scope
    ].map((x) => String(x || "").toLowerCase()).join(" ");
  }

  function hasAny(row = {}, tokens = []) {
    const blob = textBlob(row);
    return tokens.some((token) => blob.includes(String(token || "").toLowerCase()));
  }

  function sameMonth(row = {}, date = new Date()) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const raw = String(row.movement_date || row.created_at || "").slice(0, 7);
    return raw === key;
  }

  function sumAmount(items = []) {
    return (Array.isArray(items) ? items : []).reduce((sum, x) => sum + Number(x.amount_xof || 0), 0);
  }

  function computeTerrainTemperature(items = [], opts = {}) {
    const arr = Array.isArray(items) ? items : [];
    const date = opts.date instanceof Date ? opts.date : new Date();
    const monthRows = opts.all_periods ? arr : arr.filter((row) => sameMonth(row, date));

    const houseRows = monthRows.filter((row) =>
      String(row.direction || "") === "out" &&
      (normalizeScope(row.scope) === "perso" ||
       hasAny(row, ["home_expense", "maison", "famille", "école", "ecole", "repas", "santé", "sante"]))
    );

    const debtPaidRows = monthRows.filter((row) =>
      String(row.direction || "") === "out" &&
      hasAny(row, ["debt_repayment", "dette", "remboursé", "remboursee", "tontine"])
    );

    const debtReceivedRows = monthRows.filter((row) =>
      String(row.direction || "") === "in" &&
      hasAny(row, ["debt_received", "remboursement reçu", "remboursement recu", "on m’a remboursé", "on m'a remboursé"])
    );

    const creditPaidRows = monthRows.filter((row) =>
      String(row.direction || "") === "out" &&
      hasAny(row, ["credit_repayment", "crédit", "credit", "échéance", "echeance", "emprunt remboursé", "emprunt rembourse"])
    );

    const loanReceivedRows = monthRows.filter((row) =>
      String(row.direction || "") === "in" &&
      hasAny(row, ["loan_received", "emprunt reçu", "emprunt recu", "j’ai emprunté", "j'ai emprunté", "prêt reçu", "pret recu"])
    );

    const billDueRows = monthRows.filter((row) =>
      hasAny(row, ["bill_due", "facture", "à payer", "a payer", "loyer", "fournisseur"])
    );

    const emergencyRows = monthRows.filter((row) =>
      String(row.direction || "") === "out" &&
      hasAny(row, ["emergency", "urgence", "imprévu", "imprevu", "panne", "santé urgente", "sante urgente"])
    );

    const savingRows = monthRows.filter((row) =>
      normalizeScope(row.scope) === "savings" ||
      hasAny(row, ["saving", "epargne", "épargne", "mise de côté", "mise de cote"])
    );

    const house = sumAmount(houseRows);
    const debt_paid = sumAmount(debtPaidRows);
    const debt_received = sumAmount(debtReceivedRows);
    const credit_paid = sumAmount(creditPaidRows);
    const loan_received = sumAmount(loanReceivedRows);
    const bill_due = sumAmount(billDueRows);
    const emergency = sumAmount(emergencyRows);
    const savings = sumAmount(savingRows);
    const debt_credit_pressure = Math.max(0, debt_paid + credit_paid + bill_due - debt_received);
    const pressure_total = house + debt_credit_pressure + loan_received + emergency;

    const month_in = monthRows
      .filter((x) => String(x.direction || "") === "in" && normalizeScope(x.scope) !== "savings")
      .reduce((sum, x) => sum + Number(x.amount_xof || 0), 0);

    let level = "calm";
    let label = "Température calme";

    if (emergency > 0 || pressure_total > month_in * 0.55) {
      level = "danger";
      label = "Attention terrain";
    } else if (loan_received > 0 || debt_credit_pressure > 0 || pressure_total > month_in * 0.30) {
      level = "pressure";
      label = "Pression visible";
    } else if (house > 0 || savings > 0) {
      level = "watch";
      label = "À suivre";
    }

    return {
      ok: true,
      month_rows: monthRows.length,
      house,
      debt_paid,
      debt_received,
      credit_paid,
      loan_received,
      bill_due,
      emergency,
      savings,
      debt_credit_pressure,
      pressure_total,
      month_in,
      level,
      label,
      message: "PAY lit la maison, les dettes, les crédits, les emprunts, les imprévus et la réserve."
    };
  }

  function listTools() {
    return [
      { name: "get_context", description: "Retourne le contexte PAY propre." },
      { name: "list_movements", description: "Charge les mouvements PAY via RPC." },
      { name: "insert_movement", description: "Ajoute un mouvement PAY via RPC." },
      { name: "delete_movement", description: "Supprime un mouvement PAY via RPC." },
      { name: "build_quick_action", description: "Prépare un geste PAY prêt à remplir." },
      { name: "compute_terrain_temperature", description: "Lit maison, dettes, crédits, emprunts et urgences." },
      { name: "draft_to_admin_url", description: "Prépare un brouillon vers admin.html." },
      { name: "open_draft_in_admin", description: "Ouvre admin.html avec un brouillon propre." },
      { name: "go_pin", description: "Ouvre le code PAY." },
      { name: "go_cockpit", description: "Ouvre l’espace PAY." },
      { name: "go_admin", description: "Ouvre la saisie PAY." }
    ];
  }

  async function runAction(name, payload = {}) {
    const key = String(name || "").trim().toLowerCase();

    const actions = {
      get_context: getContext,
      list_movements: listMovements,
      insert_movement: insertMovement,
      delete_movement: deleteMovement,
      build_quick_action: async () => ({
        ok: true,
        tool: "build_quick_action",
        action: buildQuickAction(payload.action || payload.intent || payload.code || payload.name || "income", payload)
      }),
      compute_terrain_temperature: async () => ({
        ok: true,
        tool: "compute_terrain_temperature",
        temperature: computeTerrainTemperature(payload.items || payload.movements || [], payload)
      }),
      draft_to_admin_url: async () => ({
        ok: true,
        tool: "draft_to_admin_url",
        url: draftToAdminUrl(payload)
      }),
      open_draft_in_admin: async () => openDraftInAdmin(payload),
      go_pin: async () => goPin(payload.redirect || ""),
      go_cockpit: async () => goCockpit(),
      go_admin: async () => goAdmin()
    };

    const fn = actions[key];
    if (!fn) return asError(`Action PAY inconnue: ${name}`, { code: "unknown_action", available: Object.keys(actions) });

    try {
      return await fn(payload);
    } catch (err) {
      return asError(err?.message || `Erreur pendant ${name}`, {
        code: err?.code || "action_exception",
        raw: err
      });
    }
  }

  async function ready() {
    const ctx = await getContext();
    return { ok: true, module: CFG.MODULE, context: ctx, tools: listTools() };
  }

  const api = {
    MODULE: CFG.MODULE,
    MODULE_LOWER: "pay",
    PATHS: CFG.PATHS,
    RPC: CFG.RPC,
    CHANNELS: CFG.CHANNELS,
    SOURCE_MODULES: CFG.SOURCE_MODULES,

    normSlug,
    normPhone,
    esc,
    money,
    todayStr,

    cleanVisibleUrl,
    cleanInternalUrl,
    keepLinksClean,

    getSupabaseClient,
    callPayRpc,

    getSession,
    isAuthenticated,
    getContext,
    requireContext,
    requireWriteAccess,

    normalizeScope,
    normalizeKind,
    normalizeChannel,
    normalizeSourceModule,
    normalizeDirection,

    categoryLabel,
    frequencyLabel,

    buildMovementPayload,
    validateMovementPayload,
    listMovements,
    insertMovement,
    deleteMovement,

    draftToAdminUrl,
    openDraftInAdmin,
    buildQuickAction,

    computeStats,
    computeTerrainTemperature,
    listTools,
    runAction,
    ready,

    go,
    goPin,
    goCockpit,
    goAdmin
  };

  cleanVisibleUrl();
  keepLinksClean();

  window.DIGIY_PAY_TOOLS = api;
  window.PAY_TOOLS = api;

  console.info("[DIGIY_PAY_TOOLS] coffre d’actions chargé — URL propre.");
})();
