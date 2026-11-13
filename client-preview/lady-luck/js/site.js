/* ═══════════════════════════════════════════════════════════
   LADY LUCK — site behaviour
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ── page load ──────────────────────────────────────── */
  function ready() {
    document.body.classList.remove('is-loading');
    document.documentElement.classList.add('is-ready');
  }
  if (document.readyState === 'complete') {
    setTimeout(ready, 120);
  } else {
    window.addEventListener('load', () => setTimeout(ready, 120));
  }
  // safety net: never trap the page behind the loader
  setTimeout(ready, 3000);

  /* ── nav ────────────────────────────────────────────── */
  const nav = $('#nav');
  const burger = $('#burger');
  const mobileMenu = $('#mobileMenu');

  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('is-stuck');
    else nav.classList.remove('is-stuck');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : !mobileMenu.classList.contains('is-open');
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (burger) burger.addEventListener('click', () => toggleMenu());
  $$('#mobileMenu a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) toggleMenu(false);
  });

  /* ── reveal ─────────────────────────────────────────── */
  const revealEls = $$('.reveal');
  revealEls.forEach((el) => {
    const d = parseInt(el.dataset.delay || '0', 10);
    if (d) el.style.transitionDelay = (d * 90) + 'ms';
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // hero reveals immediately
  window.addEventListener('load', () => {
    $$('.hero .reveal').forEach((el) => el.classList.add('is-in'));
  });
  setTimeout(() => $$('.hero .reveal').forEach((el) => el.classList.add('is-in')), 600);

  /* ── hours ──────────────────────────────────────────── */
  const hoursRows = $$('#hours > div');
  const today = new Date().getDay();
  let todayText = 'Closed';

  const labels = {
    0: ['Sunday', 'Closed'],
    1: ['Monday', 'Closed'],
    2: ['Tuesday', '10am — 6pm'],
    3: ['Wednesday', '10am — 6pm'],
    4: ['Thursday', '10am — 6pm'],
    5: ['Friday', '10am — 8pm'],
    6: ['Saturday', '10am — 8pm']
  };

  hoursRows.forEach((row) => {
    const days = (row.dataset.day || '').split(',').map(Number);
    const match =
      (row.dataset.day === '2' && [2, 3, 4].includes(today)) ||
      (row.dataset.day === '5' && [5, 6].includes(today)) ||
      (row.dataset.day === '0' && [0, 1].includes(today));
    if (match) row.classList.add('is-today');
  });

  if (labels[today]) todayText = labels[today][1];
  const todayLabel = $('#todayLabel');
  if (todayLabel) todayLabel.textContent = todayText === 'Closed' ? 'Closed' : todayText;

  /* ── fortune ────────────────────────────────────────── */
  const fortunes = [
    'The dice say yes. Book the chair before you talk yourself out of it.',
    'A fine line is in your near future. Keep it small. Keep it yours.',
    'Someone with steady hands is thinking about you today.',
    'Luck is a habit. So is showing up on time for your appointment.',
    'Your next tattoo will find you before you find it.',
    'Today\u2019s colour is oxblood. Today\u2019s shape is a spade.',
    'A stranger will compliment your work this week. Say thank you.',
    'Avoid permanent decisions made in fluorescent lighting.',
    'You are somebody\u2019s favourite story. Act accordingly.',
    'The needle is friendly. The deposit is not optional.',
    'Good things come to those who book. Excellent things come to those who tip.',
    'There is a Friday the 13th with your name on it somewhere.',
    'A door opens on Green Street. Walk through it.'
  ];

  const rollBtn = $('#rollBtn');
  const fortuneText = $('#fortuneText');
  let lastFortune = -1;

  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      if (window.LadyLuckScene) window.LadyLuckScene.buzz('dice');
      rollBtn.classList.add('is-rolling');

      fortuneText.style.opacity = '0';
      setTimeout(() => {
        let i = Math.floor(Math.random() * fortunes.length);
        if (i === lastFortune) i = (i + 1) % fortunes.length;
        lastFortune = i;
        fortuneText.textContent = fortunes[i];
        fortuneText.style.opacity = '1';
      }, 260);

      setTimeout(() => rollBtn.classList.remove('is-rolling'), 950);
    });
  }

  /* ── lightbox ───────────────────────────────────────── */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const tiles = $$('.tile');
  let lbIndex = 0;

  function openLightbox(i) {
    lbIndex = (i + tiles.length) % tiles.length;
    const tile = tiles[lbIndex];
    lbImg.src = tile.dataset.full;
    lbImg.alt = tile.querySelector('img')?.alt || '';
    lbCap.textContent = tile.dataset.cap || '';
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  tiles.forEach((tile, i) => {
    tile.addEventListener('click', () => openLightbox(i));
  });

  $('#lbClose')?.addEventListener('click', closeLightbox);
  $('#lbPrev')?.addEventListener('click', () => openLightbox(lbIndex - 1));
  $('#lbNext')?.addEventListener('click', () => openLightbox(lbIndex + 1));
  lb?.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
    if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
  });

  /* ── year ───────────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();

