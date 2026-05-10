// pay-tools.js — DIGIY PAY / v1 coffre d’actions
// Doctrine : le pro clique plus qu’il n’écrit.
// DIGIY prépare le geste, le terrain valide avec sa vérité.
//
// Règle importante : ce helper ne remet jamais phone, tel, slug ou wave_phone
// dans l’URL visible. Le contexte reste dans session.js + stockage local sécurisé.

(() => {
  "use strict";

  const CFG = {
    MODULE: "PAY",
    MODULE_LOWER: "pay",

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

    CHANNELS: [
      "wave",
      "cash",
      "orange_money",
      "bank",
      "other"
    ],

    SOURCE_MODULES: [
      "PAY",
      "DRIVER",
      "COMMERCE",
      "POS",
      "LOC",
      "MARKET",
      "BUILD",
      "RESA",
      "EXPLORE",
      "JOBS",
      "QR_PRO",
      "OTHER"
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
  ];

  const CACHE = {
    sb: null
  };

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
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function asError(message, extra = {}) {
    return {
      ok: false,
      error: String(message || "Erreur PAY."),
      ...extra
    };
  }

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

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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

      if (changed) {
        history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function cleanInternalUrl(path, fallback = "./cockpit.html") {
    const raw = String(path || fallback).trim() || fallback;

    try {
      const url = new URL(raw, window.location.href);

      SENSITIVE_QUERY_KEYS.forEach((key) => {
        url.searchParams.delete(key);
      });

      if (url.origin !== window.location.origin) {
        return fallback;
      }

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
        ) {
          return;
        }

        const url = new URL(href, window.location.href);

        if (url.origin !== window.location.origin) return;

        SENSITIVE_QUERY_KEYS.forEach((key) => {
          url.searchParams.delete(key);
        });

        const file = url.pathname.split("/").pop() || "index.html";
        link.setAttribute("href", `./${file}${url.search || ""}${url.hash || ""}`);
      });
    } catch (_) {}
  }

  function readOne(key) {
    try {
      return (
        safeJsonParse(sessionStorage.getItem(key)) ||
        safeJsonParse(localStorage.getItem(key))
      );
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
        return {
          ...session,
          slug: normSlug(session.slug || ""),
          phone: normPhone(session.phone || "")
        };
      }
    }

    for (const key of CFG.STORAGE_KEYS.SESSION_LIST) {
      const parsed = readOne(key);

      if (!parsed || typeof parsed !== "object") continue;

      const moduleName = String(parsed.module || parsed.module_code || "")
        .trim()
        .toUpperCase();

      if (moduleName && moduleName !== CFG.MODULE) continue;

      return {
        ...parsed,
        slug: normSlug(parsed.slug || ""),
        phone: normPhone(parsed.phone || "")
      };
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

  function getContextSync() {
    const session = getSession() || {};

    const slug = normSlug(session.slug || readStoredSlug() || "");
    const phone = normPhone(session.phone || readStoredPhone() || "");

    return {
      ok: true,
      module: CFG.MODULE,
      slug,
      phone,
      access_ok: !!(
        session.access ||
        session.access_ok ||
        session.ok ||
        session.has_access
      ),
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

    if (!ctx.slug && !opts.allowWithoutSlug) {
      return asError("Repère PAY manquant.", { context: ctx, code: "missing_slug" });
    }

    if (!ctx.phone && !opts.allowWithoutPhone) {
      return asError("Téléphone PAY manquant.", { context: ctx, code: "missing_phone" });
    }

    return ctx;
  }

  async function requireWriteAccess() {
    const ctx = await requireContext();

    if (!ctx.ok) return ctx;

    if (!ctx.access_ok || ctx.preview) {
      return asError("Code PAY requis pour modifier.", {
        context: ctx,
        code: "access_required"
      });
    }

    return ctx;
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
    const suffix = key ? `?redirect=${encodeURIComponent(key)}` : "";

    return cleanInternalUrl(`./pin.html${suffix}`, "./pin.html");
  }

  function go(path, mode = "href") {
    const url = cleanInternalUrl(path, CFG.PATHS.cockpit);

    if (mode === "replace") {
      location.replace(url);
    } else {
      location.href = url;
    }

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

    if (window.sb && typeof window.sb.rpc === "function") {
      CACHE.sb = window.sb;
      return CACHE.sb;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }

    CACHE.sb = window.supabase.createClient(
      CFG.SUPABASE_URL,
      CFG.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
          }
        }
      }
    );

    return CACHE.sb;
  }

  async function callPayRpc(name, args = {}) {
    const sb = getSupabaseClient();

    if (!sb) {
      return asError("Supabase indisponible.", {
        code: "supabase_missing",
        rpc: name
      });
    }

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

      return {
        ok: true,
        rpc: name,
        payload
      };
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

    if (["debt_repayment", "emergency", "bill_due"].includes(v)) return "expense";

    return "other";
  }

  function normalizeChannel(value) {
    const v = String(value || "").toLowerCase();

    if (CFG.CHANNELS.includes(v)) return v;
    if (v === "bank_transfer") return "bank";
    if (v === "manual" || v === "unknown") return "other";

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

  function buildMovementPayload(input = {}, ctx = {}) {
    const scope = normalizeScope(input.scope || input.ui_scope || "pro");
    const kind = normalizeKind(input.kind || "other", scope);
    const direction = normalizeDirection(input.direction || "", kind, scope);
    const amount = Math.round(Number(input.amount_xof || input.amount || 0));

    const sourceModule = normalizeSourceModule(input.source_module || input.sourceModule || "PAY");
    const channel = normalizeChannel(input.channel || "other");

    const label = String(input.label || input.labelText || input.complement || "Mouvement PAY").trim();
    const note = String(input.note_text || input.note || input.noteText || "").trim();
    const category = String(input.category || "").trim();
    const sourceId = String(input.source_id || input.sourceId || "").trim();

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
        ...(input.meta && typeof input.meta === "object" ? input.meta : {})
      }
    };
  }

  function validateMovementPayload(payload = {}) {
    if (!payload.slug) return asError("Repère PAY manquant.", { code: "missing_slug" });
    if (!payload.phone) return asError("Téléphone PAY manquant.", { code: "missing_phone" });
    if (!payload.label) return asError("Libellé manquant.", { code: "missing_label" });
    if (!payload.amount_xof || payload.amount_xof <= 0) {
      return asError("Montant invalide.", { code: "invalid_amount" });
    }
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

    return {
      ok: true,
      tool: "list_movements",
      context: ctx,
      count: items.length,
      items,
      payload
    };
  }

  async function insertMovement(input = {}) {
    const ctx = await requireWriteAccess();

    if (!ctx.ok) return ctx;

    const payload = buildMovementPayload(input, ctx);
    const valid = validateMovementPayload(payload);

    if (!valid.ok) {
      return {
        ...valid,
        payload
      };
    }

    const res = await callPayRpc(CFG.RPC.INSERT_MOVEMENT, {
      p_slug: ctx.slug,
      p_phone: ctx.phone,
      p_payload: payload
    });

    if (!res.ok) return res;

    return {
      ok: true,
      tool: "insert_movement",
      context: ctx,
      payload,
      result: res.payload
    };
  }

  async function deleteMovement(input = {}) {
    const ctx = await requireWriteAccess();

    if (!ctx.ok) return ctx;

    const id =
      typeof input === "string"
        ? String(input || "").trim()
        : String(input.id || input.p_id || "").trim();

    if (!id) {
      return asError("ID mouvement manquant.", {
        code: "missing_id",
        context: ctx
      });
    }

    const res = await callPayRpc(CFG.RPC.DELETE_MOVEMENT, {
      p_slug: ctx.slug,
      p_phone: ctx.phone,
      p_id: id
    });

    if (!res.ok) return res;

    return {
      ok: true,
      tool: "delete_movement",
      context: ctx,
      id,
      result: res.payload
    };
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
      income: {
        label: "Encaissement client",
        direction: "in",
        scope: "pro",
        kind: "sale",
        channel: "wave",
        category: "income",
        intent: "income"
      },
      proof: {
        label: "Preuve de paiement reçue",
        direction: "in",
        scope: "pro",
        kind: "sale",
        channel: "wave",
        category: "payment_proof",
        intent: "proof"
      },
      confirm: {
        label: "Paiement confirmé",
        direction: "in",
        scope: "pro",
        kind: "sale",
        channel: "wave",
        category: "payment_confirmed",
        intent: "confirm"
      },
      verify: {
        label: "Paiement à vérifier",
        direction: "in",
        scope: "pro",
        kind: "sale",
        channel: "wave",
        category: "payment_to_verify",
        intent: "verify"
      },
      relaunch: {
        label: "Client à relancer",
        direction: "in",
        scope: "pro",
        kind: "other",
        channel: "other",
        category: "client_relaunch",
        intent: "relaunch"
      },
      saving: {
        label: "Mise de côté",
        direction: "in",
        scope: "savings",
        kind: "saving",
        channel: "cash",
        category: "saving",
        intent: "saving"
      },
      expense: {
        label: "Dépense activité",
        direction: "out",
        scope: "pro",
        kind: "expense",
        channel: "cash",
        category: "expense",
        intent: "expense"
      }
    };

    const base = presets[key] || presets.income;

    return {
      ...base,
      ...extra
    };
  }

  async function runAction(name, payload = {}) {
    const key = String(name || "").trim().toLowerCase();

    const actions = {
      get_context: getContext,
      list_movements: listMovements,
      insert_movement: insertMovement,
      delete_movement: deleteMovement,
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

    if (!fn) {
      return asError(`Action PAY inconnue: ${name}`, {
        code: "unknown_action",
        available: Object.keys(actions)
      });
    }

    try {
      return await fn(payload);
    } catch (err) {
      return asError(err?.message || `Erreur pendant ${name}`, {
        code: err?.code || "action_exception",
        raw: err
      });
    }
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

    return {
      total_in: totalIn,
      total_out: totalOut,
      total_savings: totalSavings,
      net: totalIn - totalOut,
      count: arr.length
    };
  }

  function listTools() {
    return [
      { name: "get_context", description: "Retourne le contexte PAY propre." },
      { name: "list_movements", description: "Charge les mouvements PAY via RPC." },
      { name: "insert_movement", description: "Ajoute un mouvement PAY via RPC." },
      { name: "delete_movement", description: "Supprime un mouvement PAY via RPC." },
      { name: "draft_to_admin_url", description: "Prépare un brouillon vers admin.html." },
      { name: "open_draft_in_admin", description: "Ouvre admin.html avec un brouillon propre." },
      { name: "go_pin", description: "Ouvre le code PAY." },
      { name: "go_cockpit", description: "Ouvre l’espace PAY." },
      { name: "go_admin", description: "Ouvre la saisie PAY." }
    ];
  }

  async function ready() {
    const ctx = await getContext();

    return {
      ok: true,
      module: CFG.MODULE,
      context: ctx,
      tools: listTools()
    };
  }

  const api = {
    MODULE: CFG.MODULE,
    MODULE_LOWER: CFG.MODULE_LOWER,
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

    buildMovementPayload,
    validateMovementPayload,
    listMovements,
    insertMovement,
    deleteMovement,

    draftToAdminUrl,
    openDraftInAdmin,
    buildQuickAction,

    computeStats,
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
