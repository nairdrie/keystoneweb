/*
 * Keystone site runtime (engine v2). Loaded on every agent-built page.
 *  - runs agent section/global JS modules (not while editing)
 *  - wires <form data-ks-form> to the Keystone inbox
 *  - records page views
 *  - keeps the required "Powered by Keystone" link visible
 * Agent modules receive `ks`: { mode, siteId, pageId, track(event, data) }.
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var cfg = {};
  try {
    var cfgSource = html.getAttribute('data-ks-config') || (document.getElementById('ks-config') || {}).textContent || '{}';
    cfg = JSON.parse(cfgSource);
  } catch (e) { cfg = {}; }
  var published = cfg.mode === 'published';

  var ks = {
    mode: cfg.mode,
    siteId: cfg.siteId,
    pageId: cfg.pageId,
    track: function (event, data) {
      if (!published) return;
      try {
        if (typeof window.gtag === 'function') window.gtag('event', String(event), data || {});
      } catch (e) { /* ignore */ }
    },
  };

  function safely(fn, label) {
    try {
      var cleanup = fn();
      if (cleanup && typeof cleanup.then === 'function') cleanup.catch(function (e) { console.error('[keystone] ' + label, e); });
    } catch (e) {
      console.error('[keystone] ' + label, e);
    }
  }

  // ── Cart (same storage format as Keystone's checkout: localStorage cart_<siteId>) ──
  var CART_KEY = 'cart_' + cfg.siteId;
  function readCart() {
    try { var v = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage blocked */ }
    syncCart();
  }
  function cartCount() {
    return readCart().reduce(function (n, i) { return n + (Number(i.qty) || 0); }, 0);
  }
  function syncCart() {
    var count = cartCount();
    Array.prototype.forEach.call(document.querySelectorAll('[data-ks-cart-count]'), function (el) { el.textContent = String(count); });
    html.setAttribute('data-ks-cart', count ? 'filled' : 'empty');
    try { document.dispatchEvent(new CustomEvent('ks:cart', { detail: { count: count } })); } catch (e) { /* old browsers */ }
  }
  function addToCart(product, qty) {
    var items = readCart();
    var existing = items.find(function (i) { return i.productId === product.productId && !i.variants && !i.options; });
    if (existing) existing.qty += qty || 1;
    else items.push({ productId: product.productId, name: product.name, price_cents: product.price_cents, currency: product.currency || 'CAD', qty: qty || 1, image: product.image });
    writeCart(items);
  }
  ks.cart = {
    items: readCart,
    count: cartCount,
    add: function (product, qty) { addToCart(product, qty); },
    open: function () { if (published) location.href = '/cart'; },
  };
  syncCart();
  window.addEventListener('storage', function (e) { if (e.key === CART_KEY) syncCart(); });
  // Keystone's own flows (product pages, checkout) change the cart in this tab too.
  setInterval(function () {
    var count = cartCount();
    if (String(count) !== (html.getAttribute('data-ks-cart-n') || '')) { html.setAttribute('data-ks-cart-n', String(count)); syncCart(); }
  }, 1500);

  var toastTimer;
  function toast(message, linkText, href) {
    var el = document.getElementById('ks-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ks-toast';
      el.className = 'ks-toast';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:12px;align-items:center;' +
        'padding:12px 16px;border-radius:999px;background:var(--ks-toast-bg,#111);color:var(--ks-toast-fg,#fff);font:500 14px/1.2 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    var text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);
    if (linkText && href) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = linkText;
      a.style.cssText = 'color:inherit;font-weight:700;text-decoration:underline';
      el.appendChild(a);
    }
    el.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  // ── Actions: add-to-cart, open-cart, book ────────────────────────────────
  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-ks-action]') : null;
    if (!trigger || cfg.mode === 'edit') return;
    var action = trigger.getAttribute('data-ks-action');
    if (action === 'add-to-cart') {
      event.preventDefault();
      var holder = trigger.closest('[data-ks-product]');
      var product = null;
      try { product = holder ? JSON.parse(holder.getAttribute('data-ks-product')) : null; } catch (e) { product = null; }
      if (!product) { toast('Products appear here once they are added in Keystone.'); return; }
      if (product.needsOptions) { if (published) location.href = product.url; else toast('Choosing options happens on the product page.'); return; }
      addToCart(product, Number(trigger.getAttribute('data-ks-qty')) || 1);
      ks.track('add_to_cart', { item_id: product.productId });
      toast('Added to cart', published ? 'View cart' : '', '/cart');
    } else if (action === 'open-cart' || action === 'checkout') {
      event.preventDefault();
      if (published) location.href = '/cart';
      else toast('The cart opens on the live site.');
    } else if (action === 'book') {
      event.preventDefault();
      var svc = trigger.getAttribute('data-ks-service') || (trigger.closest('[data-ks-service]') || { getAttribute: function () { return ''; } }).getAttribute('data-ks-service');
      if (published) location.href = '/book' + (svc ? '?service=' + encodeURIComponent(svc) : '');
      else toast('Booking opens on the live site.');
    }
  });

  // ── Agent modules ────────────────────────────────────────────────────────
  if (cfg.mode !== 'edit') {
    html.classList.add('ks-js');
    var modules = document.querySelectorAll('script[type="text/ks-module"]');
    Array.prototype.forEach.call(modules, function (node) {
      var key = node.getAttribute('data-ks-js');
      var url;
      try {
        url = URL.createObjectURL(new Blob([node.textContent || ''], { type: 'text/javascript' }));
      } catch (e) { return; }
      import(url).then(function (mod) {
        var init = mod && mod.default;
        if (typeof init !== 'function') return;
        if (key === '@global') {
          safely(function () { return init(ks); }, 'global script');
          return;
        }
        var roots = document.querySelectorAll('[data-ks-section="' + key + '"]');
        Array.prototype.forEach.call(roots, function (root) {
          safely(function () { return init(root, ks); }, 'section ' + key);
        });
      }).catch(function (e) {
        console.error('[keystone] could not load script for ' + key, e);
      });
    });
  }

  // ── Forms ────────────────────────────────────────────────────────────────
  var KNOWN = { name: 1, email: 1, phone: 1, message: 1, _hp: 1 };

  function setState(form, state, text) {
    form.setAttribute('data-ks-form-state', state);
    var success = form.querySelector('[data-ks-form-success]');
    var error = form.querySelector('[data-ks-form-error]');
    if (success) success.hidden = state !== 'success';
    if (error) {
      error.hidden = state !== 'error';
      if (state === 'error' && text && !error.getAttribute('data-ks')) error.textContent = text;
    }
  }

  function tracking() {
    try { return JSON.parse(sessionStorage.getItem('ks_utm') || 'null') || undefined; } catch (e) { return undefined; }
  }

  try {
    var params = new URLSearchParams(location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(function (k) {
      if (params.get(k)) utm[k] = params.get(k);
    });
    if (Object.keys(utm).length) sessionStorage.setItem('ks_utm', JSON.stringify(utm));
  } catch (e) { /* ignore */ }

  document.addEventListener('submit', function (event) {
    var form = event.target && event.target.closest ? event.target.closest('form[data-ks-form]') : null;
    if (!form) return;
    event.preventDefault();
    if (!published) {
      setState(form, 'error', 'Forms are switched off in preview.');
      return;
    }
    if (form.getAttribute('data-ks-form-state') === 'sending') return;

    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (typeof value === 'string') data[key] = value.trim();
    });
    var extra = {};
    Object.keys(data).forEach(function (k) { if (!KNOWN[k]) extra[k] = data[k]; });
    var message = data.message || Object.keys(extra).map(function (k) { return k + ': ' + extra[k]; }).join('\n') || 'Form submission';

    setState(form, 'sending');
    var submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: cfg.siteId,
        name: data.name || data.email || 'Website visitor',
        email: data.email || '',
        phone: data.phone || '',
        message: message,
        _hp: data._hp || '',
        source_type: 'contact_form',
        metadata: { form: form.getAttribute('data-ks-form'), page: location.pathname, fields: extra },
        tracking: tracking(),
      }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
        setState(form, 'success');
        form.reset();
        ks.track('generate_lead', { form: form.getAttribute('data-ks-form') });
      });
    }).catch(function (e) {
      setState(form, 'error', e.message);
    }).finally(function () {
      if (submit) submit.disabled = false;
    });
  }, true);

  // Honeypot field for every Keystone form.
  Array.prototype.forEach.call(document.querySelectorAll('form[data-ks-form]'), function (form) {
    if (form.querySelector('input[name="_hp"]')) return;
    var hp = document.createElement('input');
    hp.type = 'text';
    hp.name = '_hp';
    hp.tabIndex = -1;
    hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0';
    form.appendChild(hp);
    var success = form.querySelector('[data-ks-form-success]');
    if (success) success.hidden = true;
  });

  // ── "Powered by Keystone" ────────────────────────────────────────────────
  // Required on every Keystone site. The renderer always outputs it (styled
  // slot or plain fallback); if CSS or a script hides it, add the fallback back.
  var BADGE_URL = 'https://keystoneweb.ca';
  // 'ok' | 'hidden' | 'faded' (faded = transparent, maybe a scroll-reveal animation that hasn't run yet)
  function badgeState(el) {
    if (!el || !el.isConnected || !el.getClientRects().length) return 'hidden';
    var link = el.tagName === 'A' ? el : el.querySelector('a[href^="' + BADGE_URL + '"]');
    if (!link || (link.getAttribute('href') || '').indexOf(BADGE_URL) !== 0) return 'hidden';
    if (!/powered by\s+keystone/i.test((el.textContent || '').replace(/\s+/g, ' '))) return 'hidden';
    var box = el.getBoundingClientRect();
    if (box.width < 40 || box.height < 8) return 'hidden';
    if (box.right <= 0 || box.left >= document.documentElement.scrollWidth || box.bottom + window.scrollY <= 0) return 'hidden';
    var style = getComputedStyle(el);
    if (style.visibility !== 'visible' || parseFloat(style.fontSize) < 9) return 'hidden';
    if (style.filter && style.filter !== 'none') return 'hidden';
    for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
      var s = node === el ? style : getComputedStyle(node);
      if (s.clipPath && s.clipPath !== 'none') return 'hidden';
      if (parseFloat(s.opacity) < 0.3) return 'faded';
    }
    return 'ok';
  }
  var badgeRestored = false;
  function restoreBadge() {
    if (badgeRestored || !document.body) return;
    badgeRestored = true;
    var badge = document.createElement('div');
    badge.setAttribute('data-ks-attribution', '');
    badge.setAttribute('data-ks-attribution-fallback', 'restored');
    badge.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;filter:none!important;' +
      'clip-path:none!important;position:relative!important;z-index:2147483647!important;margin:0!important;padding:12px 16px!important;' +
      'text-align:center!important;font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif!important;color:#444!important;background:#fff!important';
    badge.appendChild(document.createTextNode('Powered by '));
    var a = document.createElement('a');
    a.href = BADGE_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Keystone';
    a.style.cssText = 'color:inherit!important;text-decoration:underline!important;display:inline!important;visibility:visible!important;opacity:1!important';
    badge.appendChild(a);
    document.body.appendChild(badge);
  }
  function checkBadge(final) {
    if (badgeRestored) return;
    var slots = document.querySelectorAll('[data-ks-attribution]');
    var faded = [];
    for (var i = 0; i < slots.length; i++) {
      var state = badgeState(slots[i]);
      if (state === 'ok') return;
      if (state === 'faded') faded.push(slots[i]);
    }
    if (!faded.length || final || typeof IntersectionObserver !== 'function') { restoreBadge(); return; }
    // Give scroll-reveal animations a chance: re-check once the slot has been on screen for a moment.
    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      observer.disconnect();
      setTimeout(function () { checkBadge(true); }, 2500);
    });
    faded.forEach(function (el) { observer.observe(el); });
  }
  // After agent scripts have had a chance to run (they load as async modules).
  // Hidden (background) tabs may not be laid out yet, so wait until the page is shown.
  function scheduleBadgeCheck() {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', function onShow() {
        if (document.visibilityState === 'hidden') return;
        document.removeEventListener('visibilitychange', onShow);
        scheduleBadgeCheck();
      });
      return;
    }
    setTimeout(function () { checkBadge(false); }, 2000);
  }
  if (document.readyState === 'complete') scheduleBadgeCheck();
  else window.addEventListener('load', scheduleBadgeCheck);

  // ── Page views ───────────────────────────────────────────────────────────
  if (published && cfg.siteId) {
    var sessionId;
    try {
      sessionId = sessionStorage.getItem('ks_sid');
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('ks_sid', sessionId);
      }
    } catch (e) { sessionId = 'na'; }
    var send = function () {
      fetch('/api/sites/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: cfg.siteId, pagePath: location.pathname, referrer: document.referrer || null, sessionId: sessionId }),
        keepalive: true,
      }).catch(function () {});
    };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(send, { timeout: 3000 });
    else setTimeout(send, 1500);
  }

  // Phone clicks count as conversions.
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href^="tel:"]') : null;
    if (link) ks.track('phone_click', {});
  });
})();
