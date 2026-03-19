(function(){
  "use strict";

  const SESSION_KEY = "digiy_pay_session";
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

  function save(slug, phone){
    const cleanSlug = normalizeSlug(slug);
    const cleanPhone = normalizePhone(phone);

    if(!cleanSlug) return null;

    const payload = {
      slug: cleanSlug,
      phone: cleanPhone,
      module: MODULE_NAME,
      ts: Date.now()
    };

    try{
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }catch(_){}

    return payload;
  }

  function get(){
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return null;

      const parsed = safeJsonParse(raw);
      if(!parsed || typeof parsed !== "object"){
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      const slug = normalizeSlug(parsed.slug);
      const phone = normalizePhone(parsed.phone);
      const ts = Number(parsed.ts || 0);
      const moduleName = String(parsed.module || "").trim().toUpperCase();

      if(!slug){
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      if(moduleName && moduleName !== MODULE_NAME){
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      const age = Date.now() - ts;
      if(age > MAX_AGE_MS){
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return save(slug, phone);
    }catch(_){
      try{ localStorage.removeItem(SESSION_KEY); }catch(__){}
      return null;
    }
  }

  function clear(){
    try{
      localStorage.removeItem(SESSION_KEY);
    }catch(_){}
  }

  function requireSession(pinUrl){
    const s = get();
    if(!s){
      window.location.href = pinUrl || "./pin.html";
      return null;
    }
    return s;
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

  window.DIGIY_SESSION = {
    save,
    get,
    clear,
    require: requireSession,
    applyUrl,
    fromUrl,
    normalizeSlug,
    normalizePhone
  };
})();
