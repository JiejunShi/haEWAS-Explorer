// assets/main.js

const ANALYTICS_CONFIG = window.HAEWAS_CONFIG?.ANALYTICS || {};

// 1) Footer year
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
  updateUsageAnalytics();
});

// 2) Smooth same-page anchors
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (el) {
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.pushState(null, '', `#${id}`);
  }
});

// 3) Copy citation + toast
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#copyCitationBtn');
  if (!btn) return;
  const citation = 'Shengwei Li#, Chaorong Chen#, Shuting Zhou, Shengying Wang, Ya Allen Cui, Wei Li*, Jiejun Shi*. Incorporating methylation heterogeneity expands epigenome-wide association studies of human phenotypes. Preprint/Journal, 2026. DOI: TBD.';
  try {
    await navigator.clipboard.writeText(citation);
    showToast('Copied!');
  } catch {
    showToast('Copy failed');
  }
});

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
}

async function updateUsageAnalytics() {
  const visitEl = document.getElementById('globalVisitCount');
  const statusEl = document.getElementById('usageStatus');

  if (!visitEl) return;

  if (!ANALYTICS_CONFIG.visitsEndpoint) {
    visitEl.textContent = '--';
    if (statusEl) statusEl.textContent = 'Analytics pending setup.';
    return;
  }

  try {
    const res = await fetch(ANALYTICS_CONFIG.visitsEndpoint, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawCount =
      data.count ??
      data.visits ??
      data.pageviews ??
      data.value ??
      data.total ??
      '--';
    const visits = Number(String(rawCount).replace(/,/g, ''));
    visitEl.textContent = Number.isFinite(visits) ? visits.toLocaleString() : String(rawCount);
    if (statusEl) statusEl.textContent = 'Public usage statistics.';
  } catch (error) {
    visitEl.textContent = '--';
    if (statusEl) statusEl.textContent = 'Analytics unavailable.';
  }
}

// 4) Reveal-on-scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

