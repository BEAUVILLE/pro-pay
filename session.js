(function(){
  "use strict";

  const SESSION_KEY = "digiy_pay_session";

  const SESSION_KEYS = [
    "digiy_pay_session",
    "DIGIY_PAY_PIN_SESSION",
    "DIGIY_PIN_SESSION",
    "DIGIY_ACCESS",
    "DIGIY_SESSION_PAY"
  ];

  const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
  const MODULE_NAME = "PAY";

  function normalizeSlug(v){
    return String(v || "").trim().toLowerCase();
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
      localStorage.setItem("digiy_pay_slug", payload.slug || "");
      localStorage.setItem("digiy_pay_phone", payload.phone || "");
      localStorage.setItem("digiy_pay_last_slug", payload.slug || "");

      sessionStorage.setItem("digiy_pay_slug", payload.slug || "");
      sessionStorage.setItem("digiy_pay_phone", payload.phone || "");
      sessionStorage.setItem("digiy_pay_last_slug", payload.slug || "");
    }catch(_){}

    try{
      window.DIGIY_ACCESS = Object.assign({}, window.DIGIY_ACCESS || {}, payload);
    }catch(_){}

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
      localStorage.removeItem("digiy_pay_slug");
      localStorage.removeItem("digiy_pay_phone");
      localStorage.removeItem("digiy_pay_last_slug");

      sessionStorage.removeItem("digiy_pay_slug");
      sessionStorage.removeItem("digiy_pay_phone");
      sessionStorage.removeItem("digiy_pay_last_slug");
    }catch(_){}
  }

  function readOne(key){
    try{
      return safeJsonParse(localStorage.getItem(key)) || safeJsonParse(sessionStorage.getItem(key));
    }catch(_){
      return null;
    }
  }

  function get(){
    try{
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

      return save(slug, phone);
    }catch(_){
      clear();
      return null;
    }
  }

  function read(){
    return get();
  }

  function fromUrl(){
    try{
      const url = new URL(window.location.href);
      const slug = normalizeSlug(url.searchParams.get("slug"));
      const phone = normalizePhone(url.searchParams.get("phone"));

      if(!slug) return null;
      return { slug, phone };
    }catch(_){
      return null;
    }
  }

  function applyUrl(slug, phone){
    try{
      const cleanSlug = normalizeSlug(slug);
      const cleanPhone = normalizePhone(phone);
      const url = new URL(window.location.href);

      if(cleanSlug) url.searchParams.set("slug", cleanSlug);
      else url.searchParams.delete("slug");

      if(cleanPhone) url.searchParams.set("phone", cleanPhone);
      else url.searchParams.delete("phone");

      window.history.replaceState({}, "", url.toString());
    }catch(_){}
  }

  function boot(){
    const urlCtx = fromUrl();

    if(urlCtx && urlCtx.slug){
      const saved = save(urlCtx.slug, urlCtx.phone);
      applyUrl(saved?.slug || urlCtx.slug, saved?.phone || urlCtx.phone);
      return saved || null;
    }

    const session = get();

    if(session){
      applyUrl(session.slug, session.phone);
      return session;
    }

    return null;
  }

  function buildPinUrl(pinUrl){
    try{
      const target = pinUrl || "./pin.html";
      const url = new URL(target, window.location.href);

      const current = new URL(window.location.href);
      const redirect = current.pathname.split("/").pop() || "cockpit.html";

      if(!url.searchParams.get("redirect")){
        url.searchParams.set("redirect", redirect);
      }

      const currentSession = get();
      if(currentSession?.slug) url.searchParams.set("slug", currentSession.slug);
      if(currentSession?.phone) url.searchParams.set("phone", currentSession.phone);

      return url.toString();
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

    applyUrl(s.slug, s.phone);
    return s;
  }

  window.DIGIY_SESSION = {
    save,
    get,
    read,
    clear,
    require: requireSession,
    applyUrl,
    fromUrl,
    boot,
    normalizeSlug,
    normalizePhone
  };
})();
