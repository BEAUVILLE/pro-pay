(function(){
  "use strict";

  /*
    session.js — MON ARGENT / PRO PAY
    Rôle : garder la session locale 8h.
    Règle : ne jamais remettre phone / slug dans l’URL visible.
  */

  const SESSION_KEY = "digiy_pay_session";
  const MAIN_PRO_SESSION_KEY = "DIGIY_PAY_PRO_SESSION";

  const SESSION_KEYS = [
    "digiy_pay_session",
    "DIGIY_PAY_PRO_SESSION",
    "DIGIY_PAY_PIN_SESSION",
    "DIGIY_PIN_SESSION",
    "DIGIY_ACCESS",
    "DIGIY_SESSION_PAY"
  ];

  const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
  const MODULE_NAME = "PAY";

  const SENSITIVE_URL_KEYS = [
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
    "keybox_location"
  ];

  function normalizeSlug(v){
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normalizePhone(v){
    return String(v || "").replace(/[^\d]/g, "");
  }

  function safeJsonParse(raw){
    try{
      return JSON.parse(raw);
    }catch(_){
      return null;
    }
  }

  function cleanVisibleUrl(){
    try{
      const url = new URL(window.location.href);
      let changed = false;

      SENSITIVE_URL_KEYS.forEach(function(key){
        if(url.searchParams.has(key)){
          url.searchParams.delete(key);
          changed = true;
        }
      });

      if(changed){
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    }catch(_){}
  }

  function cleanInternalUrl(target){
    try{
      const url = new URL(target || "./pin.html", window.location.href);

      SENSITIVE_URL_KEYS.forEach(function(key){
        url.searchParams.delete(key);
      });

      if(url.origin !== window.location.origin){
        return "./pin.html";
      }

      const file = url.pathname.split("/").pop() || "pin.html";
      return "./" + file + url.search + url.hash;
    }catch(_){
      return target || "./pin.html";
    }
  }

  function safeRedirectName(value){
    const raw = String(value || "").trim().toLowerCase();

    const map = {
      "cockpit": "cockpit.html",
      "cockpit.html": "cockpit.html",
      "admin": "admin.html",
      "admin.html": "admin.html",
      "brain": "brain-admin.html",
      "brain-admin": "brain-admin.html",
      "brain-admin.html": "brain-admin.html",
      "pin": "pin.html",
      "pin.html": "pin.html"
    };

    return map[raw] || "cockpit.html";
  }

  function buildPayload(slug, phone){
    const cleanSlug = normalizeSlug(slug);
    const cleanPhone = normalizePhone(phone);
    const nowMs = Date.now();

    if(!cleanSlug) return null;

    return {
      slug: cleanSlug,
      phone: cleanPhone,
      module: MODULE_NAME,

      access: true,
      access_ok: true,
      ok: true,
      verified: true,
      has_access: true,

      verified_at: nowMs,
      validated_at: new Date(nowMs).toISOString(),
      ts: nowMs,

      reason: "pin_ok"
    };
  }

  function writePayload(payload){
    if(!payload) return null;

    SESSION_KEYS.forEach((key) => {
      try{
        localStorage.setItem(key, JSON.stringify(payload));
      }catch(_){}

      try{
        sessionStorage.setItem(key, JSON.stringify(payload));
      }catch(_){}
    });

    try{
      localStorage.setItem(MAIN_PRO_SESSION_KEY, JSON.stringify(payload));
      sessionStorage.setItem(MAIN_PRO_SESSION_KEY, JSON.stringify(payload));
    }catch(_){}

    /*
      Compatibilité interne :
      ces valeurs restent en stockage local pour les pages PRO,
      mais elles ne sont plus propagées dans les URLs visibles.
    */
    try{
      localStorage.setItem("digiy_pay_slug", payload.slug || "");
      localStorage.setItem("digiy_pay_phone", payload.phone || "");
      localStorage.setItem("digiy_pay_last_slug", payload.slug || "");

      sessionStorage.setItem("digiy_pay_slug", payload.slug || "");
      sessionStorage.setItem("digiy_pay_phone", payload.phone || "");
      sessionStorage.setItem("digiy_pay_last_slug", payload.slug || "");
    }catch(_){}

    /*
      Ne pas exposer phone/slug dans window.DIGIY_ACCESS.
      Les pages qui ont besoin de l’identité doivent passer par DIGIY_SESSION.get().
    */
    try{
      window.DIGIY_ACCESS = Object.assign({}, window.DIGIY_ACCESS || {}, {
        module: MODULE_NAME,
        ok: true,
        access_ok: true,
        verified: true,
        ts: payload.ts || Date.now()
      });
    }catch(_){}

    cleanVisibleUrl();
    return payload;
  }

  function save(slug, phone){
    const payload = buildPayload(slug, phone);
    return writePayload(payload);
  }

  function clear(){
    SESSION_KEYS.forEach((key) => {
      try{
        localStorage.removeItem(key);
      }catch(_){}

      try{
        sessionStorage.removeItem(key);
      }catch(_){}
    });

    try{
      localStorage.removeItem(MAIN_PRO_SESSION_KEY);
      sessionStorage.removeItem(MAIN_PRO_SESSION_KEY);
    }catch(_){}

    try{
      localStorage.removeItem("digiy_pay_slug");
      localStorage.removeItem("digiy_pay_phone");
      localStorage.removeItem("digiy_pay_last_slug");

      sessionStorage.removeItem("digiy_pay_slug");
      sessionStorage.removeItem("digiy_pay_phone");
      sessionStorage.removeItem("digiy_pay_last_slug");
    }catch(_){}

    try{
      window.DIGIY_ACCESS = {
        module: MODULE_NAME,
        ok: false,
        access_ok: false
      };
    }catch(_){}

    cleanVisibleUrl();
  }

  function readOne(key){
    try{
      return safeJsonParse(sessionStorage.getItem(key)) || safeJsonParse(localStorage.getItem(key));
    }catch(_){
      return null;
    }
  }

  function get(){
    try{
      cleanVisibleUrl();

      let parsed = null;

      for(const key of SESSION_KEYS){
        parsed = readOne(key);
        if(parsed && typeof parsed === "object") break;
      }

      if(!parsed || typeof parsed !== "object"){
        clear();
        return null;
      }

      const slug = normalizeSlug(parsed.slug);
      const phone = normalizePhone(parsed.phone);
      const moduleName = String(parsed.module || "").trim().toUpperCase();

      const verifiedAt = Number(parsed.verified_at || parsed.ts || 0) || 0;
      const validatedAt = parsed.validated_at ? new Date(parsed.validated_at).getTime() : 0;
      const lastSeen = verifiedAt || validatedAt || 0;

      const hasAccess =
        !!parsed.access ||
        !!parsed.access_ok ||
        !!parsed.ok ||
        !!parsed.has_access;

      if(!slug){
        clear();
        return null;
      }

      if(moduleName && moduleName !== MODULE_NAME){
        clear();
        return null;
      }

      if(!hasAccess){
        clear();
        return null;
      }

      if(!lastSeen){
        clear();
        return null;
      }

      const age = Date.now() - lastSeen;
      if(age > MAX_AGE_MS){
        clear();
        return null;
      }

      return writePayload({
        ...parsed,
        slug,
        phone,
        module: MODULE_NAME,
        access: true,
        access_ok: true,
        ok: true,
        verified: true,
        has_access: true,
        verified_at: parsed.verified_at || parsed.ts || Date.now(),
        validated_at: parsed.validated_at || new Date(Date.now()).toISOString(),
        ts: parsed.ts || Date.now()
      });
    }catch(_){
      clear();
      return null;
    }
  }

  function read(){
    return get();
  }

  function fromUrl(){
    /*
      Ancienne compatibilité neutralisée :
      on ne crée plus de session depuis ?slug=... ou ?phone=...
      car la session PRO doit venir du PIN.
    */
    cleanVisibleUrl();
    return null;
  }

  function applyUrl(){
    /*
      Ancien comportement : ajoutait ?slug=...&phone=...
      Nouveau comportement : nettoie seulement l’URL visible.
    */
    cleanVisibleUrl();
  }

  function boot(){
    cleanVisibleUrl();
    return get();
  }

  function buildPinUrl(pinUrl){
    try{
      const target = pinUrl || "./pin.html";
      const url = new URL(target, window.location.href);

      SENSITIVE_URL_KEYS.forEach(function(key){
        url.searchParams.delete(key);
      });

      const current = new URL(window.location.href);
      const redirect = safeRedirectName(current.searchParams.get("redirect") || current.pathname.split("/").pop() || "cockpit.html");

      if(!url.searchParams.get("redirect")){
        url.searchParams.set("redirect", redirect);
      }

      if(url.origin !== window.location.origin){
        return "./pin.html?redirect=" + encodeURIComponent(redirect);
      }

      const file = url.pathname.split("/").pop() || "pin.html";
      return "./" + file + url.search + url.hash;
    }catch(_){
      return pinUrl || "./pin.html";
    }
  }

  function requireSession(pinUrl){
    const s = get();

    if(!s){
      window.location.href = buildPinUrl(pinUrl);
      return null;
    }

    cleanVisibleUrl();
    return s;
  }

  cleanVisibleUrl();

  window.DIGIY_SESSION = {
    save,
    get,
    read,
    clear,
    require: requireSession,
    applyUrl,
    fromUrl,
    boot,
    cleanVisibleUrl,
    normalizeSlug,
    normalizePhone
  };
})();
