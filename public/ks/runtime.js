/*
 * Keystone site runtime (engine v2). Loaded on every agent-built page.
 *  - runs agent section/global JS modules (not while editing)
 *  - wires <form data-ks-form> to the Keystone inbox
 *  - records page views
 * Agent modules receive `ks`: { mode, siteId, pageId, track(event, data) }.
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var cfg = {};
  try { cfg = JSON.parse(html.getAttribute('data-ks-config') || '{}'); } catch (e) { cfg = {}; }
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
