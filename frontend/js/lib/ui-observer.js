// Auto-initializes Flatpickr / Tom Select whenever new date inputs or
// <select> elements are added to the DOM anywhere (view swaps, modals,
// Alpine x-if/x-for insertions). Ported from the legacy app's
// ui_observer.js — still needed because Alpine's x-for/x-if inject real
// DOM nodes that these two third-party widgets don't know about.
import { initDatePickers, initSelects } from './ui-helpers.js';

let debounceTimer = null;

const observer = new MutationObserver((mutations) => {
  const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0);
  if (!hasAddedNodes) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    initDatePickers();
    initSelects();
  }, 60);
});

export function startUiObserver() {
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    initDatePickers();
    initSelects();
  });
}
