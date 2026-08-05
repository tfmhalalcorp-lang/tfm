import { PAGE_TITLES } from './lib/role-access.js';

const viewRegistry = new Map();

/** Called by each view module at import time to register its render function. */
export function registerView(key, renderFn) {
  viewRegistry.set(key, renderFn);
}

export async function navigateTo(view) {
  const uiStore = Alpine.store('ui');
  uiStore.currentView = view;
  uiStore.sidebarOpen = false;
  uiStore.pageTitle = PAGE_TITLES[view] || view;

  const container = document.getElementById('view-container');
  const renderFn = viewRegistry.get(view);

  if (!renderFn) {
    container.innerHTML = `
      <div class="card text-center text-gray-500 py-16">
        <i class="fa-solid fa-triangle-exclamation text-3xl mb-3 text-amber-400"></i>
        <p>404: ไม่พบหน้า "${view}"</p>
      </div>`;
    return;
  }

  try {
    await renderFn(container);
  } catch (err) {
    console.error(`Failed to render view "${view}"`, err);
    container.innerHTML = `
      <div class="card text-center text-danger py-16">
        <i class="fa-solid fa-circle-exclamation text-3xl mb-3"></i>
        <p>เกิดข้อผิดพลาดในการโหลดหน้านี้: ${err.message || err}</p>
      </div>`;
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.store('ui', {
    sidebarOpen: false,
    currentView: '',
    pageTitle: '',
  });
});

window.navigateTo = navigateTo;
