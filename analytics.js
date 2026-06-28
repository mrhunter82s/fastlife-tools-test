/* فست لایف — آنالیتیکسِ ابزارها (نسخهٔ کامل، نسخهٔ تست)
   داده‌ها در Supabase ذخیره می‌شود. هیچ اطلاعاتِ شخصی‌ای جمع نمی‌شود:
   فقط یک شناسهٔ تصادفیِ مرورگر (fl_vid)، نام ابزار، اکشن‌ها و مدت‌زمان‌ها.

   دو جدول:
     events  → یک ردیف به‌ازای هر جلسه، با active_seconds (زمانِ فعال).
     actions → یک ردیف به‌ازای هر اکشن/قدمِ سفر، با label و value (مثلاً ثانیه).

   API برای ابزارها:
     flLog(action, {label, value, nav})  → ثبتِ یک اکشن (هر بار). nav:true یعنی
                                            قبلِ رفتن به صفحهٔ دیگه (keepalive).
     flReach(action, {label, value})     → فقط بارِ اول در هر جلسه (برای قیف).
     flTrack(action)                     → معادلِ flReach (سازگاری با نسخهٔ قبل).
*/
(function () {
  "use strict";
  var SUPABASE_URL = "https://tgkoksukglkcnqkydafb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_33ulCqJBPT5btXV8cFuShg_OMDAKKpC";
  var BASE = SUPABASE_URL.replace(/\/+$/, "");
  var TOOL = (document.body && document.body.getAttribute("data-tool")) || document.title || location.pathname;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var vid;
  try {
    vid = localStorage.getItem("fl_vid");
    if (!vid) { vid = uuid(); localStorage.setItem("fl_vid", vid); }
  } catch (e) { vid = uuid(); }

  var sid = uuid();
  var startedAt = new Date().toISOString();
  var activeSeconds = 0;
  var STEP = 15; // هر ۱۵ ثانیه یک‌بار

  function fire(path, headersExtra, body, keepalive) {
    var h = {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json"
    };
    for (var k in headersExtra) h[k] = headersExtra[k];
    try {
      fetch(BASE + path, { method: "POST", headers: h, body: JSON.stringify(body), keepalive: !!keepalive });
    } catch (e) {}
  }

  /* ---------- events: زمانِ حضور ---------- */
  function sendEvent(isFinal) {
    fire("/rest/v1/events?on_conflict=session_id",
      { "Prefer": "resolution=merge-duplicates,return=minimal" },
      [{
        session_id: sid, visitor_id: vid, tool: TOOL,
        started_at: startedAt, updated_at: new Date().toISOString(),
        active_seconds: activeSeconds,
        user_agent: navigator.userAgent, referrer: document.referrer || null
      }],
      isFinal);
  }

  /* ---------- actions: اکشن‌ها / سفر / زمانِ هر بخش ---------- */
  function logAction(action, opts) {
    opts = opts || {};
    var row = { visitor_id: vid, session_id: sid, tool: TOOL, action: String(action) };
    if (opts.label != null) row.label = String(opts.label);
    if (opts.value != null && !isNaN(opts.value)) row.value = Math.round(Number(opts.value) * 100) / 100;
    fire("/rest/v1/actions", { "Prefer": "return=minimal" }, [row], !!opts.nav);
  }

  var _once = {};
  window.flLog = function (action, opts) {
    if (!action) return;
    logAction(action, opts);
  };
  window.flReach = function (action, opts) {
    if (!action || _once[action]) return;
    _once[action] = 1;
    logAction(action, opts);
  };
  window.flTrack = window.flReach; // سازگاری با نسخهٔ قبل
  window.flMeta = { vid: vid, sid: sid, tool: TOOL };

  /* ---------- چرخهٔ عمر ---------- */
  sendEvent(false);                  // ثبتِ ورود
  logAction("enter");                // قدمِ اولِ سفر

  var hb = setInterval(function () {
    if (document.visibilityState === "visible") { activeSeconds += STEP; sendEvent(false); }
  }, STEP * 1000);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendEvent(true);
  });
  window.addEventListener("pagehide", function () { clearInterval(hb); sendEvent(true); });
})();
