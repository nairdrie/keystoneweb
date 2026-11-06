/*
 * Keystone in-canvas editor (engine v2, edit mode only).
 *
 * Runs inside the sandboxed draft iframe (opaque origin) and talks to the
 * editor window only through postMessage. It never saves anything itself.
 *
 *   iframe → parent: ready, select, field (text edits), pick (image/link/bg/toggle),
 *                    global, list (item ops), scroll, navigate
 *   parent → iframe: ks:scrollTo, ks:highlight, ks:preview-field
 */
(function () {
  'use strict';
  var html = document.documentElement;
  var cfg = {};
  try { cfg = JSON.parse(html.getAttribute('data-ks-config') || '{}'); } catch (e) { cfg = {}; }
  if (cfg.mode !== 'edit' || window.parent === window) return;

  var target = cfg.editorOrigin || '*';
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

  function startEditing(el) {
    if (editing === el) return;
    if (editing) finishEditing(true);
    editing = el;
    original = el.innerHTML;
    el.setAttribute('data-ks-editing', '');
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
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-ks-editing');
    if (!save) {
      el.innerHTML = original;
      return;
    }
    if (el.innerHTML === original) return;
    var max = Number(el.getAttribute('data-ks-max')) || 0;
    if (max && el.textContent.length > max) {
      post({ type: 'notice', level: 'warning', message: 'That text is longer than this spot was designed for (' + max + ' characters). It may not fit well.' });
    }
    post({ type: 'field', instance: instanceOf(el), path: el.getAttribute('data-ks-f'), value: el.innerHTML });
  }

  document.addEventListener('keydown', function (e) {
    if (!editing) return;
    var rich = editing.getAttribute('data-ks-t') === 'richtext';
    if (e.key === 'Escape') { e.preventDefault(); finishEditing(false); }
    else if (e.key === 'Enter' && !rich && !e.shiftKey) { e.preventDefault(); finishEditing(true); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      document.execCommand(e.key === 'b' ? 'bold' : 'italic');
    }
  }, true);

  document.addEventListener('paste', function (e) {
    if (!editing) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }, true);

  document.addEventListener('focusout', function (e) {
    if (editing && e.target === editing) setTimeout(function () { if (editing && document.activeElement !== editing) finishEditing(true); }, 0);
  }, true);

  // ── Clicks ───────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#ks-item-bar')) return;
    var link = e.target.closest ? e.target.closest('a[href]') : null;
    var field = e.target.closest ? e.target.closest('[data-ks-f]') : null;
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
      if (t === 'text' || t === 'richtext') { startEditing(field); return; }
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
      if (m) post({ type: 'navigate', path: m[1] || '/' });
    }
  }, true);

  // ── List item toolbar ────────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.id = 'ks-item-bar';
  bar.innerHTML = '<span>Item</span><button data-op="up" title="Move up">↑</button><button data-op="down" title="Move down">↓</button><button data-op="duplicate" title="Duplicate">Copy</button><button data-op="add" title="Add new after">+ Add</button><button data-op="remove" title="Remove">Remove</button>';
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
    var item = e.target.closest ? e.target.closest('[data-ks-l] > [data-ks-i]') : null;
    if (item) { clearTimeout(hideTimer); placeBar(item); }
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
    var msg = { type: 'list', instance: instanceOf(list), path: list.getAttribute('data-ks-l'), index: index };
    if (op === 'up') { if (index === 0) return; msg.op = 'move'; msg.to = index - 1; }
    else if (op === 'down') { if (index >= count - 1) return; msg.op = 'move'; msg.to = index + 1; }
    else if (op === 'add') { msg.op = 'add'; msg.index = index + 1; }
    else msg.op = op;
    bar.style.display = 'none';
    post(msg);
  });

  // ── Messages from the editor ─────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data || {};
    if (d.type === 'ks:scrollTo') window.scrollTo(0, Number(d.y) || 0);
    if (d.type === 'ks:highlight') select(d.instance, true);
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
