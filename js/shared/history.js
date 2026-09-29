/* =============================================================================
   history.js — ongedaan maken en opnieuw, over de hele toestand van een tool
   -----------------------------------------------------------------------------
   De tool geeft twee functies: snapshot() geeft de toestand (JSON-baar),
   restore(toestand) zet hem terug in velden en preview. Na elke wijziging
   roept de tool commit(sleutel) aan. Snelle wijzigingen met dezelfde sleutel
   (typen in één veld) worden één stap, zolang er niet langer dan 700 ms
   tussen zit.

     const h = PM.history({ snapshot, restore, limit: 100 })
     h.commit('kop')        na een wijziging; sleutel = veld of handeling
     h.undo(), h.redo()     terug en weer vooruit
     h.canUndo, h.canRedo
     h.seal()               de volgende commit wordt zeker een nieuwe stap
     h.clear()              opnieuw beginnen vanaf de huidige toestand
     h.onChange(cb)         cb({ canUndo, canRedo, source }); geeft een afmelder
     h.bind({ undo, redo }) knoppen koppelen (disabled als het niet kan)

   Sneltoetsen: Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z en Ctrl + Y. In een
   tekstveld niet: daar doet de browser zelf het ongedaan maken van de tekst.
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Kern (zonder DOM, getest in tests/history.test.js)
     ------------------------------------------------------------------------- */

  function createHistory({ snapshot, restore, limit = 100, coalesceMs = 700, now = () => Date.now() } = {}) {
    if (typeof snapshot !== 'function' || typeof restore !== 'function') {
      throw new Error('PM.history heeft snapshot() en restore() nodig.');
    }
    const max = Math.max(1, limit | 0);
    const listeners = new Set();
    let past = [];
    let future = [];
    let present = JSON.stringify(snapshot());
    let lastKey = null;
    let lastTime = 0;
    let restoring = false;

    function notify(source) {
      const info = { canUndo: past.length > 0, canRedo: future.length > 0, source };
      listeners.forEach((cb) => cb(info));
    }

    // Geeft true als er een stap bij kwam of een stap werd bijgewerkt
    function commit(key = null) {
      if (restoring) return false;  // velden die tijdens restore() een event geven
      const next = JSON.stringify(snapshot());
      if (next === present) return false;
      const t = now();
      const coalesce = key != null && key === lastKey && t - lastTime <= coalesceMs && past.length > 0;
      if (!coalesce) {
        past.push(present);
        if (past.length > max) past = past.slice(past.length - max);
      }
      present = next;
      future = [];
      lastKey = key;
      lastTime = t;
      notify('commit');
      return true;
    }

    function apply(json, source) {
      restoring = true;
      try {
        restore(JSON.parse(json));
      } finally {
        restoring = false;
      }
      lastKey = null;
      notify(source);
    }

    function undo() {
      if (!past.length) return false;
      future.push(present);
      present = past.pop();
      apply(present, 'undo');
      return true;
    }

    function redo() {
      if (!future.length) return false;
      past.push(present);
      present = future.pop();
      apply(present, 'redo');
      return true;
    }

    return {
      commit,
      undo,
      redo,
      seal() { lastKey = null; },
      clear() {
        past = [];
        future = [];
        present = JSON.stringify(snapshot());
        lastKey = null;
        notify('clear');
      },
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      get canUndo() { return past.length > 0; },
      get canRedo() { return future.length > 0; },
      get size() { return { undo: past.length, redo: future.length }; },
      get isRestoring() { return restoring; },
    };
  }

  // Welke handeling hoort bij deze toets? 'undo', 'redo' of null
  function shortcutAction(e) {
    if (!e || e.altKey) return null;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return null;
    const key = String(e.key || '').toLowerCase();
    if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey) return 'redo';
    return null;
  }

  // Invoer waarin de browser zelf tekst ongedaan maakt (dus niet onze sneltoets)
  const NO_TEXT = ['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image'];
  function isTextEntry(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'SELECT') return true;   // pijltjes en letters kiezen hier een optie
    if (tag !== 'INPUT') return false;
    return !NO_TEXT.includes(String(el.type || 'text').toLowerCase());
  }

  /* ---------------------------------------------------------------------------
     Browser: sneltoetsen en knoppen
     ------------------------------------------------------------------------- */

  function history(options = {}) {
    const h = createHistory(options);
    const doc = global.document;
    if (!doc) return h;

    const announce = (msg) => global.PM && global.PM.announce && global.PM.announce(msg);

    doc.addEventListener('keydown', (e) => {
      const action = shortcutAction(e);
      if (!action || e.defaultPrevented || isTextEntry(e.target)) return;
      e.preventDefault();
      if (action === 'undo' ? h.undo() : h.redo()) announce(action === 'undo' ? 'ongedaan gemaakt' : 'opnieuw gedaan');
    });

    // Knoppen in de appbalk: disabled als er niets terug of vooruit te zetten is
    h.bind = function bind({ undo, redo } = {}) {
      const sync = () => {
        if (undo) undo.disabled = !h.canUndo;
        if (redo) redo.disabled = !h.canRedo;
      };
      if (undo) undo.addEventListener('click', () => { if (h.undo()) announce('ongedaan gemaakt'); });
      if (redo) redo.addEventListener('click', () => { if (h.redo()) announce('opnieuw gedaan'); });
      h.onChange(sync);
      sync();
      return h;
    };
    return h;
  }

  const api = { createHistory, shortcutAction, isTextEntry };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) {
    const PM = global.PM = global.PM || {};
    PM.history = Object.assign(history, api);
  }
})(typeof window !== 'undefined' ? window : globalThis);
