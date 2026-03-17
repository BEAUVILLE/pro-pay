(async function boot(){
  const guard = await window.DIGIY_GUARD.ready({ requireAuth: true, redirect: "cockpit" });
  if(!guard || !guard.ok) return;

  SESSION = guard.session;
  SLUG = guard.slug || "";
  PHONE = guard.phone || "";

  await loadCockpit();
})();
