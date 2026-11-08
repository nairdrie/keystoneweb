/*
 * Keystone in-canvas editor (engine v2, edit mode only).
 *
 * Runs inside the sandboxed draft iframe (opaque origin) and talks to the
 * editor window only through postMessage. It never saves anything itself.
 *
 *   iframe → parent: ready, select, field (text edits), pick (image/link/bg),
 *                    global, list (item ops), scroll, navigate,
 *                    ask (a click on something the owner can't edit → Archie),
 *                    section (move/hide/show/duplicate/remove), section-ask,
 *                    section-content, add-section, remove (a field, list or background)
 *                    reload (a change couldn't be applied in place)
 *   parent → iframe: ks:scrollTo, ks:highlight, ks:preview-field, ks:ask-clear, ks:meta,
 *                    ks:apply (show an edit right away while it saves)
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var cfg = {};
  try { cfg = JSON.parse(html.getAttribute('data-ks-config') || '{}'); } catch (e) { cfg = {}; }
  if (cfg.mode !== 'edit' || window.parent === window) return;

  var target = cfg.editorOrigin || '*';

  // The formatting editor (ProseMirror, public/ks/text-editor.js) loads in the
  // background; until it's there, text is edited as plain contenteditable.
  var here = document.currentScript && document.currentScript.src;
  if (here) {
    var te = document.createElement('script');
    te.src = here.replace(/editor\.js(\?.*)?$/, 'text-editor.js?v=2');
    te.defer = true;
    document.head.appendChild(te);
  }
  function post(msg) {
    msg.source = 'ks-editor';
    msg.pageId = cfg.pageId;
    window.parent.postMessage(msg, target);
  }

  var style = document.createElement('style');
  style.textContent = [
    '[data-ks-f]{cursor:pointer;transition:outline-color .12s}',
    '[data-ks-f]:hover{outline:2px solid rgba(37,99,235,.9)!important;outline-offset:3px}',
    '[data-ks-t="text"]:hover,[data-ks-t="richtext"]:hover{cursor:text}',
    '[data-ks-g]:hover{outline:2px dashed rgba(124,58,237,.9)!important;outline-offset:3px;cursor:pointer}',
    '[data-ks-editing]{outline:2px solid #2563eb!important;outline-offset:3px;cursor:text!important;background:rgba(37,99,235,.06)}',
    '[data-ks-instance][data-ks-hidden]>*{opacity:.35!important}',
    '[data-ks-c]>[data-ks-sample]{opacity:.5;outline:1px dashed #94a3b8;outline-offset:2px}',
    '[data-ks-c]>*:not([data-ks-f]){cursor:help}',
    '.ks-sel>*{box-shadow:inset 0 0 0 2px rgba(37,99,235,.55)}',
    '#ks-item-bar{position:fixed;z-index:2147483647;display:none;gap:2px;padding:3px;background:#0f172a;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);font:600 12px/1 system-ui,sans-serif}',
    '#ks-item-bar button{all:unset;color:#fff;padding:6px 8px;border-radius:5px;cursor:pointer}',
    '#ks-item-bar button:hover{background:#334155}',
    '#ks-item-bar span{color:#94a3b8;padding:6px 6px 6px 8px}',
    '[data-ks-ask]{outline:2px dashed #8b5cf6!important;outline-offset:2px}',
    '#ks-item-bar.ks-ghost button:not([data-op="add"]):not([data-op="remove-list"]){display:none}',
    '#ks-item-bar .ks-sep{width:1px;align-self:stretch;margin:3px 2px;background:#334155;padding:0}',
    '.ks-ui{position:fixed;z-index:2147483647;display:none;align-items:center;gap:1px;padding:3px;background:#0f172a;border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,.28);font:600 12px/1 system-ui,sans-serif;color:#fff}',
    '.ks-ui button{all:unset;display:inline-flex;align-items:center;gap:5px;color:#e2e8f0;padding:6px 7px;border-radius:6px;cursor:pointer}',
    '.ks-ui button:hover{background:#334155;color:#fff}',
    '.ks-ui button[disabled]{opacity:.3;cursor:default;background:none}',
    '.ks-ui svg{width:15px;height:15px;flex:none}',
    '.ks-ui .ks-name{color:#94a3b8;padding:6px 8px 6px 7px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ks-ui .ks-sep{width:1px;align-self:stretch;margin:4px 3px;background:#334155}',
    '.ks-add{padding:0;border-radius:999px;background:#2563eb}',
    '.ks-add button{color:#fff;padding:6px 12px 6px 9px;border-radius:999px}',
    '.ks-add button:hover{background:#1d4ed8}',
    '#ks-rm-chip{padding:2px}',
    '#ks-rm-chip button{padding:4px 8px}',
    '[data-ks-instance].ks-hover>*{box-shadow:inset 0 0 0 2px rgba(37,99,235,.35)}',
    '#ks-empty-page{display:flex;justify-content:center;padding:96px 16px}',
  ].join('\n');
  document.head.appendChild(style);

  function instanceOf(el) {
    var inst = el && el.closest ? el.closest('[data-ks-instance]') : null;
    return inst ? inst.getAttribute('data-ks-instance') : null;
  }

  // ── Selection ────────────────────────────────────────────────────────────
  var selected = null;
  function select(instanceId, scroll) {
    if (selected) selected.classList.remove('ks-sel');
    selected = instanceId ? document.querySelector('[data-ks-instance="' + CSS.escape(instanceId) + '"]') : null;
    if (selected) {
      selected.classList.add('ks-sel');
      if (scroll) {
        var first = selected.firstElementChild;
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // ── Inline text editing ──────────────────────────────────────────────────
  var editing = null;
  var original = '';
  var textEd = null; // KsText handle while the formatting editor runs

  function inTextBar(node) {
    return !!(textEd && node && textEd.toolbar.contains(node));
  }

  function startEditing(el, point) {
    if (editing === el) return;
    if (editing) finishEditing(true);
    editing = el;
    original = el.innerHTML;
    el.setAttribute('data-ks-editing', '');
    if (window.KsText) {
      var styles = [];
      try { styles = JSON.parse(el.getAttribute('data-ks-st') || '[]'); } catch (e) { styles = []; }
      try {
        textEd = window.KsText.edit(el, {
          rich: el.getAttribute('data-ks-t') === 'richtext',
          styles: styles,
          colors: colors,
          // No links inside a link or button the designer made.
          allowLinks: !(el.closest('a,button') || el.querySelector('a[data-ks-f]')),
          point: point || null,
          onRemove: function () { finishEditing(false); removePart(el); },
        });
        return;
      } catch (err) {
        textEd = null;
        el.innerHTML = original;
      }
    }
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* ignore */ }
  }

  function finishEditing(save) {
    var el = editing;
    if (!el) return;
    editing = null;
    if (textEd) {
      var ed = textEd;
      textEd = null;
      var changed = save && ed.changed();
      var out = changed ? ed.html() : '';
      ed.destroy();
      el.removeAttribute('data-ks-editing');
      // Unchanged: put the designer's exact markup back.
      el.innerHTML = changed ? out : original;
      if (changed) sendField(el);
      return;
    }
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-ks-editing');
    if (!save) {
      el.innerHTML = original;
      return;
    }
    if (el.innerHTML === original) return;
    sendField(el);
  }

  function sendField(el) {
    var max = Number(el.getAttribute('data-ks-max')) || 0;
    if (max && el.textContent.length > max) {
      post({ type: 'notice', level: 'warning', message: 'That text is longer than this spot was designed for (' + max + ' characters). It may not fit well.' });
    }
    post({ type: 'field', instance: instanceOf(el), path: el.getAttribute('data-ks-f'), value: el.innerHTML });
  }

  document.addEventListener('keydown', function (e) {
    if (!editing || inTextBar(e.target)) return;
    var rich = editing.getAttribute('data-ks-t') === 'richtext';
    if (e.key === 'Escape') { e.preventDefault(); finishEditing(false); }
    else if (e.key === 'Enter' && !rich && !e.shiftKey) { e.preventDefault(); finishEditing(true); }
    else if (textEd) return; // the formatting editor handles its own shortcuts
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      document.execCommand(e.key === 'b' ? 'bold' : 'italic');
    }
  }, true);

  document.addEventListener('paste', function (e) {
    if (!editing || textEd) return; // the formatting editor cleans pasted text itself
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }, true);

  document.addEventListener('focusout', function (e) {
    if (!editing || (e.target !== editing && !inTextBar(e.target))) return;
    setTimeout(function () {
      if (!editing) return;
      var a = document.activeElement;
      if (a === editing || (a && editing.contains(a)) || inTextBar(a)) return;
      finishEditing(true);
    }, 0);
  }, true);

  // ── Ask Archie: describe exactly what was clicked ────────────────────────
  // Clicks that only end a text edit (mousedown blurred the field) don't ask.
  var downWhileEditing = false;
  document.addEventListener('mousedown', function (e) { downWhileEditing = !!editing && !inTextBar(e.target); }, true);

  var askEl = null;
  function clearAsk() {
    if (askEl) askEl.removeAttribute('data-ks-ask');
    askEl = null;
  }

  function cssPath(el, stop) {
    var parts = [];
    while (el && el !== stop && el.nodeType === 1 && el !== document.body && el !== html) {
      var part = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(part + '#' + CSS.escape(el.id)); break; }
      var cls = Array.prototype.filter.call(el.classList, function (c) { return c.indexOf('ks-') !== 0; }).slice(0, 3);
      if (cls.length) part += '.' + cls.map(function (c) { return CSS.escape(c); }).join('.');
      var parent = el.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(' > ');
  }

  function cleanHtml(el) {
    var copy = el.cloneNode(true);
    var all = [copy].concat(Array.prototype.slice.call(copy.querySelectorAll ? copy.querySelectorAll('*') : []));
    all.forEach(function (n) {
      if (!n.removeAttribute) return;
      ['data-ks-f', 'data-ks-t', 'data-ks-ask', 'data-ks-editing', 'contenteditable', 'spellcheck'].forEach(function (a) { n.removeAttribute(a); });
      if (n.classList) { n.classList.remove('ks-sel', 'ks-hover'); if (!n.classList.length) n.removeAttribute('class'); }
    });
    var out = copy.outerHTML || '';
    return out.length > 2500 ? out.slice(0, 2500) + '…' : out;
  }

  function hintsFor(el) {
    var hints = [];
    try {
      var cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') hints.push('has a CSS background image/gradient: ' + cs.backgroundImage.slice(0, 100));
      ['::before', '::after'].forEach(function (p) {
        var c = getComputedStyle(el, p).content;
        if (c && c !== 'none' && c !== 'normal') hints.push('draws a ' + p + ' pseudo-element (content: ' + c.slice(0, 40) + ')');
      });
      if (cs.position === 'absolute' || cs.position === 'fixed') hints.push('positioned ' + cs.position);
      var r = el.getBoundingClientRect();
      hints.push('about ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px at a ' + window.innerWidth + 'px wide viewport');
    } catch (err) { /* ignore */ }
    if (el.closest('[data-ks-static]')) hints.push('marked decorative (data-ks-static)');
    if (el.closest('[data-ks-l] > [data-ks-i]')) hints.push('inside list item ' + el.closest('[data-ks-l] > [data-ks-i]').getAttribute('data-ks-i') + ' of list "' + el.closest('[data-ks-l]').getAttribute('data-ks-l') + '"');
    return hints;
  }

  function ask(e) {
    var el = e.target;
    if (!el || el.nodeType !== 1 || el === document.body || el === html) el = null;
    var svg = el && el.closest ? el.closest('svg') : null;
    if (svg) el = svg; // report the whole graphic, not one path inside it
    var wrapper = el ? el.closest('[data-ks-instance]') : null;
    clearAsk();
    if (el) { askEl = el; el.setAttribute('data-ks-ask', ''); }
    var text = el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    var r = el ? el.getBoundingClientRect() : null;
    post({
      type: 'ask',
      x: e.clientX,
      y: e.clientY,
      // The editor places Archie beside this box (iframe viewport coordinates).
      rect: r ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom } : null,
      scrollY: Math.round(window.scrollY),
      target: {
        instance: wrapper ? wrapper.getAttribute('data-ks-instance') : null,
        section: wrapper ? wrapper.getAttribute('data-ks-section') : null,
        tag: el ? el.tagName.toLowerCase() : 'body',
        selector: el ? cssPath(el, wrapper) : null,
        text: text,
        html: el ? cleanHtml(el) : null,
        hints: el ? hintsFor(el) : [],
      },
    });
  }

  // ── Clicks ───────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#ks-item-bar,.ks-ui,#ks-empty-page,#ks-text-bar')) return;
    var link = e.target.closest ? e.target.closest('a[href]') : null;
    var field = e.target.closest ? e.target.closest('[data-ks-f]') : null;

    // Placeholder of an empty list: add the first item.
    var ghost = e.target.closest ? e.target.closest('[data-ks-l] > [data-ks-ghost]') : null;
    if (ghost) {
      e.preventDefault();
      var gl = ghost.parentElement;
      post({ type: 'list', op: 'add', instance: instanceOf(gl), path: gl.getAttribute('data-ks-l'), index: 0 });
      return;
    }
    // An older design's show/hide switch is just an area that can be removed from its chip.
    if (field && field.getAttribute('data-ks-t') === 'toggle') field = null;
    var global = e.target.closest ? e.target.closest('[data-ks-g]') : null;

    if (editing && field === editing) return; // clicks inside the active editor
    // Never navigate or submit while editing.
    if (link || (e.target.closest && e.target.closest('button,[type=submit]'))) e.preventDefault();

    var inst = instanceOf(e.target);
    if (inst) { select(inst); post({ type: 'select', instance: inst }); }

    if (global && (!field || global.contains(field) === false)) {
      e.preventDefault();
      post({ type: 'global', binding: global.getAttribute('data-ks-g') });
      return;
    }
    var collection = e.target.closest ? e.target.closest('[data-ks-c]') : null;
    if (collection && (!field || !collection.contains(field) || field === collection)) {
      e.preventDefault();
      post({ type: 'collection', kind: collection.getAttribute('data-ks-c'), sample: !!e.target.closest('[data-ks-sample]') });
      return;
    }
    if (field) {
      e.preventDefault();
      var t = field.getAttribute('data-ks-t');
      if (t === 'text' || t === 'richtext') { startEditing(field, { x: e.clientX, y: e.clientY }); return; }
      post({
        type: 'pick',
        instance: inst,
        path: field.getAttribute('data-ks-f'),
        fieldType: t,
        current: t === 'image' ? { src: field.getAttribute('src'), alt: field.getAttribute('alt') }
          : t === 'link' ? { href: field.getAttribute('href'), label: field.innerHTML, newTab: field.getAttribute('target') === '_blank' }
          : null,
      });
      return;
    }
    if (link) {
      var href = link.getAttribute('href') || '';
      var m = href.match(/\/v2r\/draft\/[^/]+(\/[^?#]*)?/);
      if (m) { post({ type: 'navigate', path: m[1] || '/' }); return; }
    }
    // Nothing the owner can edit here: offer Archie.
    if (downWhileEditing) { downWhileEditing = false; return; }
    e.preventDefault();
    ask(e);
  }, true);

  // ── List item toolbar ────────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.id = 'ks-item-bar';
  bar.innerHTML = '<span>Item</span><button data-op="up" title="Move up">↑</button><button data-op="down" title="Move down">↓</button><button data-op="duplicate" title="Duplicate">Copy</button><button data-op="add" title="Add new after">+ Add</button><button data-op="remove" title="Remove this item">Remove</button><span class="ks-sep"></span><button data-op="remove-list" title="Remove the whole list">Remove list</button>';
  document.body.appendChild(bar);
  var barItem = null;
  var hideTimer = null;

  function placeBar(item) {
    barItem = item;
    var r = item.getBoundingClientRect();
    bar.style.display = 'flex';
    var top = Math.max(4, r.top - 34);
    bar.style.top = top + 'px';
    bar.style.left = Math.max(4, Math.min(window.innerWidth - bar.offsetWidth - 4, r.right - bar.offsetWidth)) + 'px';
  }

  document.addEventListener('mouseover', function (e) {
    if (editing) return;
    if (e.target.closest && e.target.closest('#ks-item-bar')) { clearTimeout(hideTimer); return; }
    var item = e.target.closest ? e.target.closest('[data-ks-l] > [data-ks-i], [data-ks-l] > [data-ks-ghost]') : null;
    if (item) { clearTimeout(hideTimer); bar.classList.toggle('ks-ghost', item.hasAttribute('data-ks-ghost')); placeBar(item); }
    else {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { bar.style.display = 'none'; barItem = null; }, 400);
    }
  });
  window.addEventListener('scroll', function () { if (barItem) placeBar(barItem); }, { passive: true });

  bar.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || !barItem) return;
    e.preventDefault();
    e.stopPropagation();
    var list = barItem.parentElement;
    var index = Number(barItem.getAttribute('data-ks-i'));
    var count = list.querySelectorAll(':scope > [data-ks-i]').length;
    var op = btn.getAttribute('data-op');
    if (btn.getAttribute('data-op') === 'remove-list') {
      bar.style.display = 'none';
      removePart(list);
      return;
    }
    var msg = { type: 'list', instance: instanceOf(list), path: list.getAttribute('data-ks-l'), index: index };
    if (op === 'up') { if (index === 0) return; msg.op = 'move'; msg.to = index - 1; }
    else if (op === 'down') { if (index >= count - 1) return; msg.op = 'move'; msg.to = index + 1; }
    else if (op === 'add') { msg.op = 'add'; msg.index = barItem.hasAttribute('data-ks-ghost') ? 0 : index + 1; }
    else msg.op = op;
    bar.style.display = 'none';
    post(msg);
  });

  // ── Remove ───────────────────────────────────────────────────────────────
  // Anything the owner can edit can be removed (stored as hidden: true; the
  // editor offers Undo). A background only loses its image: its content stays.
  function removeKind(el) {
    if (el.hasAttribute('data-ks-l')) return 'list';
    var t = el.getAttribute('data-ks-t');
    return t === 'toggle' ? 'toggle' : t === 'bg' ? 'bg' : 'field';
  }
  function removePart(el) {
    var isList = el.hasAttribute('data-ks-l');
    var path = isList ? el.getAttribute('data-ks-l') : el.getAttribute('data-ks-f');
    if (!path) return;
    post({ type: 'remove', instance: instanceOf(el), path: path, kind: removeKind(el) });
  }

  var ICONS = {
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    list: '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  // Same sparkle as "Ask for a change" in the editor bar.
  var SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ks-sparkle" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#c084fc"/><stop offset="55%" stop-color="#818cf8"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs>'
    + '<path fill="url(#ks-sparkle)" transform="translate(-1.5 0)" d="M13 2 C13 6.5 14 7.5 22 11 C14 14.5 13 15.5 13 22 C13 15.5 12 14.5 4 11 C12 7.5 13 6.5 13 2 Z"/>'
    + '<path fill="url(#ks-sparkle)" d="M20 3 C20 4.6 20.3 4.9 22 5.5 C20.3 6.1 20 6.4 20 8 C20 6.4 19.7 6.1 18 5.5 C19.7 4.9 20 4.6 20 3 Z"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function ui(id, extraClass) {
    var el = document.createElement('div');
    el.id = id;
    el.className = 'ks-ui' + (extraClass ? ' ' + extraClass : '');
    document.body.appendChild(el);
    return el;
  }

  // Text has Remove in its formatting bar; images, links, backgrounds and lists get this chip.
  var optChip = ui('ks-rm-chip');
  var optEl = null;
  function removableAt(t) {
    var el = t.closest('[data-ks-f],[data-ks-l]');
    if (!el) return null;
    var type = el.getAttribute('data-ks-t');
    if (type === 'text' || type === 'richtext') return null;
    if (type === 'bg') {
      // Only when there's an image to remove.
      var bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none' || bg.indexOf('url(') === -1) return null;
    }
    return el;
  }
  function placeOptChip(el) {
    optEl = el;
    var kind = removeKind(el);
    var label = kind === 'bg' ? 'Remove background' : kind === 'list' ? 'Remove list' : 'Remove';
    var title = kind === 'bg' ? 'Remove the background image (the content stays)' : 'Remove this from your site';
    optChip.innerHTML = '<button type="button" title="' + title + '">' + icon('trash') + label + '</button>';
    optChip.style.display = 'flex';
    var r = el.getBoundingClientRect();
    optChip.style.top = Math.max(4, r.top + 4) + 'px';
    optChip.style.left = Math.max(4, Math.min(window.innerWidth - optChip.offsetWidth - 4, r.right - optChip.offsetWidth - 4)) + 'px';
  }
  function hideOptChip() { optChip.style.display = 'none'; optEl = null; }
  optChip.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!optEl) return;
    var el = optEl;
    hideOptChip();
    removePart(el);
  });

  // ── Section toolbar and "Add section" buttons ────────────────────────────
  var names = {};
  var colors = [];
  var secBar = ui('ks-section-bar');
  var addTop = ui('ks-add-top', 'ks-add');
  var addBottom = ui('ks-add-bottom', 'ks-add');
  addTop.innerHTML = addBottom.innerHTML = '<button type="button">' + icon('plus') + 'Add section</button>';
  var secWrap = null;
  var secTimer = null;

  function bodySections() {
    var main = document.getElementById('main');
    return main ? Array.prototype.filter.call(main.children, function (c) { return c.hasAttribute('data-ks-instance'); }) : [];
  }
  function isGlobal(wrap) { var p = wrap.parentElement; return !p || p.id !== 'main'; }
  // Section wrappers are display:contents, so measure their children.
  function sectionRect(wrap) {
    var top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    Array.prototype.forEach.call(wrap.children, function (c) {
      var r = c.getBoundingClientRect();
      if (!r.width && !r.height) return;
      top = Math.min(top, r.top); left = Math.min(left, r.left); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
    });
    return top === Infinity ? null : { top: top, left: left, right: right, bottom: bottom, width: right - left };
  }

  function btn(op, title, inner, disabled) {
    return '<button type="button" data-sop="' + op + '" title="' + title + '" aria-label="' + title + '"' + (disabled ? ' disabled' : '') + '>' + inner + '</button>';
  }

  function hideSectionUi() {
    secBar.style.display = addTop.style.display = addBottom.style.display = 'none';
    if (secWrap) secWrap.classList.remove('ks-hover');
    secWrap = null;
  }

  function showSection(wrap) {
    if (secWrap !== wrap) {
      if (secWrap) secWrap.classList.remove('ks-hover');
      secWrap = wrap;
      wrap.classList.add('ks-hover');
      var global = isGlobal(wrap);
      var hidden = wrap.hasAttribute('data-ks-hidden');
      var name = names[wrap.getAttribute('data-ks-section')] || 'Section';
      var h = '<span class="ks-name">' + esc(name) + (global ? ' · every page' : hidden ? ' · hidden' : '') + '</span>';
      if (!global) {
        var list = bodySections();
        var i = list.indexOf(wrap);
        h += btn('up', 'Move up', icon('up'), i <= 0)
          + btn('down', 'Move down', icon('down'), i === -1 || i >= list.length - 1)
          + (hidden ? btn('show', 'Show this section', icon('eye')) : '')
          + btn('duplicate', 'Duplicate', icon('copy'))
          + btn('remove', 'Delete', icon('trash'));
      }
      h += '<span class="ks-sep"></span>'
        + btn('content', 'Edit all content in this section', icon('list'))
        + btn('ask', 'Ask Archie to change this section', SPARKLE);
      secBar.innerHTML = h;
    }
    placeSection();
  }

  function placeSection() {
    if (!secWrap) return;
    var r = sectionRect(secWrap);
    if (!r || r.bottom < 0 || r.top > window.innerHeight) {
      secBar.style.display = addTop.style.display = addBottom.style.display = 'none';
      return;
    }
    secBar.style.display = 'flex';
    // Stays in view while scrolling through a tall section.
    secBar.style.top = Math.max(8, Math.min(r.top + 8, r.bottom - secBar.offsetHeight - 8)) + 'px';
    secBar.style.left = Math.max(8, r.left + 8) + 'px';

    var inst = secWrap.getAttribute('data-ks-instance');
    var global = isGlobal(secWrap);
    var first = !global && bodySections().indexOf(secWrap) === 0;
    var hasHeader = !!document.querySelector('[data-ks-instance="header"]');
    var cx = r.left + r.width / 2;
    function put(el, y, on) {
      if (!on || y < 0 || y > window.innerHeight) { el.style.display = 'none'; return; }
      el.style.display = 'flex';
      el.style.top = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, y - el.offsetHeight / 2)) + 'px';
      el.style.left = Math.max(4, cx - el.offsetWidth / 2) + 'px';
    }
    put(addTop, r.top, inst === 'footer' || (first && !hasHeader));
    put(addBottom, r.bottom, inst !== 'footer');
  }

  function insertIndex(which) {
    var list = bodySections();
    var inst = secWrap.getAttribute('data-ks-instance');
    if (inst === 'header') return 0;
    if (inst === 'footer') return list.length;
    var i = list.indexOf(secWrap);
    return which === 'top' ? i : i + 1;
  }
  function onAdd(which) {
    return function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (secWrap) post({ type: 'add-section', index: insertIndex(which) });
    };
  }
  addTop.addEventListener('click', onAdd('top'));
  addBottom.addEventListener('click', onAdd('bottom'));

  secBar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled || !secWrap) return;
    e.preventDefault();
    e.stopPropagation();
    var op = b.getAttribute('data-sop');
    var inst = secWrap.getAttribute('data-ks-instance');
    if (op === 'ask') {
      var br = b.getBoundingClientRect();
      post({
        type: 'section-ask',
        instance: inst,
        section: secWrap.getAttribute('data-ks-section'),
        x: br.right,
        y: br.top + br.height / 2,
        rect: { top: br.top, left: br.left, right: br.right, bottom: br.bottom },
        scrollY: Math.round(window.scrollY),
      });
      return;
    }
    if (op === 'content') { post({ type: 'section-content', instance: inst }); return; }
    var i = bodySections().indexOf(secWrap);
    var msg = { type: 'section', instance: inst, action: op };
    if (op === 'up') { msg.action = 'move'; msg.to = i - 1; }
    if (op === 'down') { msg.action = 'move'; msg.to = i + 1; }
    post(msg);
  });

  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('.ks-ui')) { clearTimeout(secTimer); return; }
    if (editing) return;
    var opt = removableAt(t);
    if (opt) { if (opt !== optEl) placeOptChip(opt); } else hideOptChip();
    var wrap = t.closest('[data-ks-instance]');
    clearTimeout(secTimer);
    if (wrap) showSection(wrap);
    else secTimer = setTimeout(hideSectionUi, 400);
  });
  html.addEventListener('mouseleave', function () {
    clearTimeout(secTimer);
    secTimer = setTimeout(function () { hideSectionUi(); hideOptChip(); }, 400);
  });
  window.addEventListener('scroll', function () { placeSection(); if (optEl) placeOptChip(optEl); }, { passive: true });
  window.addEventListener('resize', placeSection, { passive: true });

  // A page with no sections yet still needs a way to add one.
  function ensureEmptyPage() {
    var mainEl = document.getElementById('main');
    if (!mainEl || bodySections().length || document.getElementById('ks-empty-page')) return;
    var empty = document.createElement('div');
    empty.id = 'ks-empty-page';
    empty.innerHTML = '<div class="ks-ui ks-add" style="position:static;display:flex"><button type="button">' + icon('plus') + 'Add your first section</button></div>';
    empty.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); post({ type: 'add-section', index: 0 }); });
    mainEl.appendChild(empty);
  }
  ensureEmptyPage();

  // ── Changes applied in place (ks:apply) ──────────────────────────────────
  // The editor saves in the background; the page only re-renders when a
  // change can't be shown here (then we ask for it with "reload").
  function instEl(id) {
    return id ? document.querySelector('[data-ks-instance="' + CSS.escape(id) + '"]') : null;
  }
  function inInstance(id, selector) {
    var wrap = instEl(id);
    return wrap ? wrap.querySelector(selector) : null;
  }
  function fieldEl(id, path) { return inInstance(id, '[data-ks-f="' + CSS.escape(path) + '"]'); }
  function listEl(id, path) { return inInstance(id, '[data-ks-l="' + CSS.escape(path) + '"]'); }
  function setHidden(el, hidden) { if (hidden) el.setAttribute('data-ks-hidden', ''); else el.removeAttribute('data-ks-hidden'); }

  function refreshUi() {
    var w = secWrap;
    hideSectionUi();
    if (w && document.contains(w)) showSection(w);
    if (optEl) { if (document.contains(optEl)) placeOptChip(optEl); else hideOptChip(); }
    bar.style.display = 'none';
    barItem = null;
  }

  // List items carry their index in data-ks-i and in every field path inside
  // them ("stats.2.label"); keep both in step after items move.
  function reindex(list) {
    var listPath = list.getAttribute('data-ks-l');
    Array.prototype.forEach.call(list.querySelectorAll(':scope > [data-ks-i]'), function (item, i) {
      var old = item.getAttribute('data-ks-i');
      if (old === String(i)) return;
      var from = listPath + '.' + old + '.';
      var to = listPath + '.' + i + '.';
      Array.prototype.forEach.call(item.querySelectorAll('[data-ks-f],[data-ks-l]'), function (n) {
        ['data-ks-f', 'data-ks-l'].forEach(function (a) {
          var v = n.getAttribute(a);
          if (v && v.indexOf(from) === 0) n.setAttribute(a, to + v.slice(from.length));
        });
      });
      item.setAttribute('data-ks-i', String(i));
    });
  }

  function applySection(c) {
    var wrap = instEl(c.instance);
    if (!wrap) return false;
    if (c.action === 'hide' || c.action === 'show') { setHidden(wrap, c.action === 'hide'); return true; }
    if (c.action === 'remove') {
      if (editing && wrap.contains(editing)) finishEditing(false);
      if (selected === wrap) selected = null;
      wrap.remove();
      ensureEmptyPage();
      return true;
    }
    if (c.action === 'duplicate') {
      var copy = wrap.cloneNode(true);
      copy.setAttribute('data-ks-instance', c.created);
      copy.classList.remove('ks-hover', 'ks-sel');
      wrap.after(copy);
      return true;
    }
    if (c.action === 'move') {
      var list = bodySections();
      var from = list.indexOf(wrap);
      if (from === -1) return false;
      list.splice(from, 1);
      if (!list.length) return true;
      var to = Math.max(0, Math.min(list.length, Number(c.to)));
      if (to < list.length) list[to].before(wrap); else list[list.length - 1].after(wrap);
      if (wrap.firstElementChild) wrap.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return true;
    }
    return false;
  }

  function applyList(c) {
    var list = listEl(c.instance, c.path);
    if (!list) return false;
    var items = list.querySelectorAll(':scope > [data-ks-i]');
    var index = Number(c.index);
    var item = items[index];
    if (!item) return false;
    if (c.action === 'remove') {
      if (items.length <= 1) return false; // the empty-list placeholder comes from the server
      if (editing && item.contains(editing)) finishEditing(false);
      item.remove();
    } else if (c.action === 'duplicate') {
      item.after(item.cloneNode(true));
    } else if (c.action === 'move') {
      var to = Math.max(0, Math.min(items.length - 1, Number(c.to)));
      if (to === index) return true;
      if (to > index) items[to].after(item); else items[to].before(item);
    } else return false;
    reindex(list);
    return true;
  }

  function applyField(c) {
    var el = fieldEl(c.instance, c.path);
    var v = c.value;
    var obj = v && typeof v === 'object' ? v : null;
    if (!el) {
      // Showing/hiding a whole list goes through its path too.
      var list = listEl(c.instance, c.path);
      if (list && obj && typeof obj.hidden === 'boolean') { setHidden(list, obj.hidden); return true; }
      return false;
    }
    var t = el.getAttribute('data-ks-t');
    if (t === 'toggle') { setHidden(el, typeof v === 'boolean' ? !v : !!(obj && obj.hidden)); return true; }
    if (t === 'bg') {
      var bgSrc = typeof v === 'string' ? v : obj && obj.src;
      if (obj && obj.hidden) el.style.backgroundImage = 'none';
      else el.style.backgroundImage = bgSrc ? 'url("' + String(bgSrc).replace(/["\\\n\r]/g, '') + '")' : '';
      return true;
    }
    if (obj && typeof obj.hidden === 'boolean') setHidden(el, obj.hidden);
    if (el === editing) return true; // the owner is typing here right now
    if (t === 'text' || t === 'richtext') {
      if (typeof v === 'string') el.innerHTML = v;
      else if (obj && typeof obj.html === 'string') el.innerHTML = obj.html;
    } else if (t === 'image') {
      if (obj && obj.src) { el.setAttribute('src', obj.src); el.removeAttribute('srcset'); el.removeAttribute('sizes'); }
      if (obj && typeof obj.alt === 'string') el.setAttribute('alt', obj.alt);
    } else if (t === 'link') {
      if (obj && typeof obj.href === 'string') el.setAttribute('href', obj.href);
      if (obj && 'newTab' in obj) { if (obj.newTab) el.setAttribute('target', '_blank'); else el.removeAttribute('target'); }
      // A link wrapping other fields keeps its children; a plain one shows its label.
      if (obj && typeof obj.label === 'string' && !el.querySelector('[data-ks-f]')) el.innerHTML = obj.label;
    }
    return true;
  }

  function applyChange(c) {
    if (!c) return;
    var ok = false;
    try {
      if (c.op === 'section') ok = applySection(c);
      else if (c.op === 'list') ok = applyList(c);
      else if (c.op === 'field') ok = applyField(c);
      else if (c.op === 'visibility') {
        var el = c.kind === 'list' ? listEl(c.instance, c.path) : fieldEl(c.instance, c.path);
        if (el) { setHidden(el, !!c.hidden); ok = true; }
      }
    } catch (err) { ok = false; }
    refreshUi();
    if (!ok) post({ type: 'reload' });
  }

  // ── Messages from the editor ─────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data || {};
    if (d.type === 'ks:scrollTo') window.scrollTo(0, Number(d.y) || 0);
    if (d.type === 'ks:highlight') select(d.instance, true);
    if (d.type === 'ks:ask-clear') clearAsk();
    if (d.type === 'ks:meta') { names = d.names || {}; colors = d.colors || []; if (secWrap) { var w = secWrap; secWrap = null; showSection(w); } }
    if (d.type === 'ks:apply') applyChange(d.change);
  });

  var lastY = -1;
  window.addEventListener('scroll', function () {
    var y = Math.round(window.scrollY);
    if (Math.abs(y - lastY) < 20) return;
    lastY = y;
    post({ type: 'scroll', y: y });
  }, { passive: true });

  post({ type: 'ready' });
})();
