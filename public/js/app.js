import { initMagnifier } from './magnifier.js';

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('//')) return url;
  return `${window.location.origin}${url}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getMaxScroll(viewport, track) {
  return Math.max(0, track.scrollWidth - viewport.clientWidth);
}

function createSmoothScroller(viewport, track) {
  let targetScroll = viewport.scrollLeft;
  let rafId = null;

  function clamp(value) {
    return Math.max(0, Math.min(getMaxScroll(viewport, track), value));
  }

  function tick() {
    const current = viewport.scrollLeft;
    const diff = targetScroll - current;

    if (Math.abs(diff) < 0.5) {
      viewport.scrollLeft = targetScroll;
      rafId = null;
      return;
    }

    viewport.scrollLeft = current + diff * 0.11;
    rafId = requestAnimationFrame(tick);
  }

  function scrollTo(value, instant = false) {
    targetScroll = clamp(value);

    if (instant) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      viewport.scrollLeft = targetScroll;
      return;
    }

    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function scrollBy(delta) {
    scrollTo(targetScroll + delta);
  }

  function syncTarget() {
    targetScroll = viewport.scrollLeft;
  }

  function cancel() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    syncTarget();
  }

  function applyMomentum(velocity) {
    if (Math.abs(velocity) < 0.35) return;
    scrollTo(targetScroll - velocity * 20);
  }

  return { scrollTo, scrollBy, syncTarget, cancel, applyMomentum };
}

function setGalleryScrollPosition(viewport, track, scroller, options = {}) {
  const { align = 'right' } = options;

  track.style.paddingLeft = '0';
  track.style.paddingRight = '0';

  const maxScroll = getMaxScroll(viewport, track);
  if (maxScroll > 0) {
    scroller.scrollTo(align === 'left' ? 0 : maxScroll, true);
    return;
  }

  if (align === 'left') {
    scroller.scrollTo(0, true);
    return;
  }

  track.style.paddingLeft = `${viewport.clientWidth - track.scrollWidth}px`;
  scroller.scrollTo(0, true);
}

function initHorizontalScroll(viewport, track, scroller, options = {}) {
  const { dragSelector = null, wheelTarget = window, isWheelActive = () => true, onTap = null } = options;
  const DRAG_THRESHOLD = 8;

  let isPointerDown = false;
  let isDragging = false;
  let didDrag = false;
  let pressedTarget = null;
  let startX = 0;
  let scrollStart = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let activePointerId = null;

  wheelTarget.addEventListener(
    'wheel',
    (e) => {
      if (!isWheelActive()) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const paragraphBody = e.target instanceof Element
        ? e.target.closest('.detail-paragraph-body')
        : null;
      if (paragraphBody && paragraphBody.scrollHeight > paragraphBody.clientHeight) {
        return;
      }
      e.preventDefault();
      scroller.scrollBy(e.deltaY);
    },
    { passive: false },
  );

  function canStartDrag(target) {
    if (!dragSelector) return true;
    return target.closest(dragSelector);
  }

  function startDrag(clientX) {
    scroller.cancel();
    isPointerDown = true;
    isDragging = false;
    didDrag = false;
    startX = clientX;
    lastX = clientX;
    lastTime = performance.now();
    velocity = 0;
    scrollStart = viewport.scrollLeft;
  }

  function moveDrag(clientX) {
    if (!isPointerDown) return;

    const deltaX = clientX - startX;
    if (!isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) return;

    if (!isDragging) {
      isDragging = true;
      didDrag = true;
      viewport.classList.add('is-dragging');
    }

    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (clientX - lastX) / dt;
    lastX = clientX;
    lastTime = now;

    viewport.scrollLeft = scrollStart - (clientX - startX);
    scroller.syncTarget();
  }

  function endDrag() {
    if (!isPointerDown) return;

    isPointerDown = false;

    if (isDragging) {
      isDragging = false;
      viewport.classList.remove('is-dragging');
      scroller.applyMomentum(velocity);
    }

    activePointerId = null;
  }

  const pointerOpts = { capture: true };

  viewport.addEventListener('pointerdown', (e) => {
    if (!canStartDrag(e.target)) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pressedTarget = dragSelector ? e.target.closest(dragSelector) : null;
    activePointerId = e.pointerId;
    if (pressedTarget) pressedTarget.setPointerCapture(e.pointerId);
    else viewport.setPointerCapture(e.pointerId);
    startDrag(e.clientX);
  }, pointerOpts);

  viewport.addEventListener('pointermove', (e) => {
    if (activePointerId !== e.pointerId) return;
    if (!isPointerDown) return;

    const deltaX = e.clientX - startX;
    if (!isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) return;

    e.preventDefault();
    moveDrag(e.clientX);
  }, pointerOpts);

  viewport.addEventListener('pointerup', (e) => {
    if (activePointerId !== e.pointerId) return;
    const tapTarget = pressedTarget && !didDrag ? pressedTarget : null;
    const captureEl = pressedTarget || viewport;
    pressedTarget = null;
    captureEl.releasePointerCapture(e.pointerId);
    endDrag();
    if (tapTarget && onTap) onTap(tapTarget);
  }, pointerOpts);

  viewport.addEventListener('pointercancel', (e) => {
    if (activePointerId !== e.pointerId) return;
    const captureEl = pressedTarget || viewport;
    pressedTarget = null;
    captureEl.releasePointerCapture(e.pointerId);
    endDrag();
  }, pointerOpts);

  viewport.addEventListener(
    'click',
    (e) => {
      if (didDrag) {
        e.preventDefault();
        e.stopPropagation();
        didDrag = false;
      }
    },
    true,
  );

  viewport.addEventListener('dragstart', (e) => e.preventDefault(), pointerOpts);

  return { getDidDrag: () => didDrag, resetDidDrag: () => { didDrag = false; } };
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');

  function open(src) {
    img.src = src;
    document.body.classList.add('lightbox-open');
    lightbox.hidden = false;
    closeBtn.hidden = false;
    requestAnimationFrame(() => {
      lightbox.classList.add('is-open');
      closeBtn.classList.add('is-visible');
      refreshMagnifierMirror();
    });
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function close() {
    lightbox.classList.remove('is-open');
    closeBtn.classList.remove('is-visible');
    document.body.classList.remove('lightbox-open');
    lightbox.setAttribute('aria-hidden', 'true');
    img.src = '';
    refreshMagnifierMirror();
  }

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  lightbox.addEventListener('click', close);
  img.addEventListener('click', (e) => e.stopPropagation());

  lightbox.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'opacity' && !lightbox.classList.contains('is-open')) {
      lightbox.hidden = true;
      closeBtn.hidden = true;
    }
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    },
    true,
  );

  return { open, close, isOpen: () => lightbox.classList.contains('is-open') };
}

/* ---------- Project detail ---------- */

let detailScroller = null;
let detailScrollInitialized = false;
let currentProject = null;
let activeSectionId = null;
let activeProjectId = null;
let magnifier = null;
let galleryResizeHandler = null;
let galleryHashHandled = false;
const lightbox = initLightbox();

function refreshMagnifierMirror() {
  magnifier?.refresh();
}

function sortMediaByOrder(media) {
  return media.slice().sort((a, b) => a.sort_order - b.sort_order);
}

function sidebarSpacerPanel() {
  return '<div class="detail-panel detail-panel--spacer" aria-hidden="true"></div>';
}

function renderActiveSectionTrack(project, section) {
  const panels = [];

  if (!section) {
    panels.push(`
      <div class="detail-panel detail-panel--empty">
        <p class="detail-empty-text">No sections yet.</p>
      </div>
    `);
    panels.push(sidebarSpacerPanel());
    return panels.join('');
  }

  const media = sortMediaByOrder(section.media);

  for (const m of media) {
    if (m.media_type === 'image') {
      panels.push(`
        <div class="detail-panel detail-panel--image">
          <figure
            class="detail-image-item${m.is_clickable ? ' is-clickable' : ''}"
            ${m.is_clickable ? `data-target="${escapeHtml(resolveUrl(m.target_media_url))}"` : ''}
          >
            <img src="${resolveUrl(m.media_url)}" alt="" loading="lazy" draggable="false" />
          </figure>
        </div>
      `);
    } else if (m.media_type === 'video_link') {
      panels.push(`
        <div class="detail-panel detail-panel--video">
          <a class="detail-video-link" href="${escapeHtml(m.media_url)}" target="_blank" rel="noopener noreferrer">
            Watch video
          </a>
        </div>
      `);
    } else if (m.media_type === 'black_rectangle') {
      const width = Number.isFinite(m.size) ? m.size : 80;
      panels.push(`
        <div
          class="detail-panel detail-panel--strip detail-panel--black-rectangle is-clickable"
          style="width:${width}px"
          data-target="${escapeHtml(resolveUrl(m.media_url))}"
        >
          <span class="detail-strip-label">${escapeHtml(m.title || '')}</span>
        </div>
      `);
    } else if (m.media_type === 'white_rectangle') {
      const width = Number.isFinite(m.size) ? m.size : 80;
      panels.push(`
        <div
          class="detail-panel detail-panel--strip detail-panel--white-rectangle"
          style="width:${width}px"
        >
          <span class="detail-strip-label">${escapeHtml(m.title || '')}</span>
        </div>
      `);
    } else if (m.media_type === 'paragraph') {
      const width = Number.isFinite(m.size) ? m.size : 280;
      const color = m.color === 'white' ? 'white' : 'black';
      panels.push(`
        <div
          class="detail-panel detail-panel--paragraph detail-panel--paragraph-${color}"
          style="width:${width}px"
        >
          <div class="detail-paragraph-body">${escapeHtml(m.body || '').replace(/\n/g, '<br>')}</div>
        </div>
      `);
    }
  }

  if (media.length === 0) {
    panels.push(`
      <div class="detail-panel detail-panel--empty">
        <p class="detail-empty-text">No media in this section.</p>
      </div>
    `);
  }

  panels.push(sidebarSpacerPanel());
  return panels.join('');
}

function renderSectionNav(project, activeId) {
  const nav = document.getElementById('project-section-nav');

  if (project.sections.length === 0) {
    nav.innerHTML = '';
    return;
  }

  nav.innerHTML = project.sections
    .map(
      (section) => `
    <button
      type="button"
      class="section-nav-item${section.id === activeId ? ' is-active' : ''}"
      data-section-id="${section.id}"
    >
      ${escapeHtml(section.title)}
    </button>
  `,
    )
    .join('');
}

async function waitForImages(container) {
  const images = container.querySelectorAll('img');
  await Promise.all(
    [...images].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}

function setSectionLoading(loading) {
  const viewport = document.getElementById('section-viewport');
  const loader = document.getElementById('section-loader');
  if (!viewport) return;

  viewport.classList.toggle('is-loading', loading);
  if (loader) loader.setAttribute('aria-hidden', loading ? 'false' : 'true');
}

async function showSection(sectionId) {
  if (!currentProject) return;

  const track = document.getElementById('section-track');
  const viewport = document.getElementById('section-viewport');
  const section = currentProject.sections.find((s) => s.id === sectionId) ?? null;

  activeSectionId = sectionId;
  renderSectionNav(currentProject, sectionId);

  setSectionLoading(true);
  track.innerHTML = renderActiveSectionTrack(currentProject, section);

  await waitForImages(track);

  if (detailScroller) {
    setGalleryScrollPosition(viewport, track, detailScroller, { align: 'right' });
  }

  void track.offsetWidth;
  setSectionLoading(false);
}

function initDetailScroll() {
  if (detailScrollInitialized) return;

  const viewport = document.getElementById('section-viewport');
  const track = document.getElementById('section-track');

  detailScroller = createSmoothScroller(viewport, track);
  initHorizontalScroll(viewport, track, detailScroller, {
    isWheelActive: () => document.getElementById('project-detail').classList.contains('is-open'),
    dragSelector: '.detail-panel--image, .detail-panel--video, .detail-panel--empty, .detail-panel--strip, .detail-panel--paragraph',
    onTap: (panel) => {
      const item = panel.querySelector('.detail-image-item.is-clickable');
      if (item?.dataset.target) {
        lightbox.open(item.dataset.target);
        return;
      }
      if (panel.classList.contains('detail-panel--black-rectangle') && panel.dataset.target) {
        lightbox.open(panel.dataset.target);
      }
    },
  });

  detailScrollInitialized = true;
}

function initSectionNav() {
  const nav = document.getElementById('project-section-nav');

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.section-nav-item');
    if (!btn || btn.dataset.sectionId === activeSectionId) return;
    showSection(btn.dataset.sectionId);
  });
}

async function openProjectDetail(projectId) {
  const detail = document.getElementById('project-detail');
  const track = document.getElementById('section-track');

  try {
    const project = await fetch(`/api/projects/${projectId}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load project');
      return r.json();
    });

    if (project.locale && project.locale !== currentLang) {
      if (history.state?.projectId || window.location.hash.startsWith('#project/')) {
        history.replaceState(null, '', window.location.pathname);
      }
      return;
    }

    currentProject = project;
    activeProjectId = projectId;
    document.getElementById('project-detail-title').textContent = project.title;
    document.getElementById('project-detail-desc').textContent = project.description || '';

    detail.hidden = false;
    detail.setAttribute('aria-hidden', 'false');

    initDetailScroll();

    const firstSectionId = project.sections[0]?.id ?? null;
    activeSectionId = null;
    track.innerHTML = '';
    setSectionLoading(true);
    requestAnimationFrame(() => detail.classList.add('is-open'));
    magnifier?.setAvailable(true);

    await showSection(firstSectionId);

    history.pushState({ projectId }, '', `#project/${projectId}`);
  } catch {
    /* keep gallery visible on error */
  }
}

function closeProjectDetail() {
  const detail = document.getElementById('project-detail');
  if (!detail.classList.contains('is-open')) return;

  magnifier?.setAvailable(false);
  detail.classList.remove('is-open');
  detail.setAttribute('aria-hidden', 'true');
  setSectionLoading(false);
  activeProjectId = null;
  currentProject = null;
  activeSectionId = null;

  detail.addEventListener(
    'transitionend',
    function onClose(e) {
      if (e.propertyName !== 'opacity' || detail.classList.contains('is-open')) return;
      detail.hidden = true;
      detail.removeEventListener('transitionend', onClose);
    },
    { once: true },
  );

  if (history.state?.projectId) {
    history.pushState(null, '', window.location.pathname);
  }
}

initSectionNav();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.isOpen() && !pageModal.isOpen()) closeProjectDetail();
});

document.querySelector('.brand-title')?.addEventListener('click', () => {
  if (activeProjectId) closeProjectDetail();
});

window.addEventListener('popstate', (e) => {
  if (e.state?.projectId) {
    openProjectDetail(e.state.projectId);
  } else {
    closeProjectDetail();
  }
});

/* ---------- i18n (menu + page modal titles) ---------- */

const I18N = {
  en: {
    home: 'Home',
    about: 'About Us',
    contact: 'Contact Us',
    menu: 'Menu',
    emptyAbout: 'About content coming soon.',
    emptyContact: 'Contact content coming soon.',
    emptyProjects: 'No projects yet.',
    loadError: 'Unable to load projects.',
  },
  fa: {
    home: 'صفحه اصلی',
    about: 'درباره ما',
    contact: 'تماس با ما',
    menu: 'منو',
    emptyAbout: 'محتوای درباره ما به‌زودی اضافه می‌شود.',
    emptyContact: 'محتوای تماس با ما به‌زودی اضافه می‌شود.',
    emptyProjects: 'هنوز پروژه‌ای اضافه نشده است.',
    loadError: 'بارگذاری پروژه‌ها ممکن نشد.',
  },
};

const LOCALE_STORAGE_KEY = 'm-studio-locale';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'fa' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return 'fa';
}

let currentLang = readStoredLocale();

function t(key) {
  return I18N[currentLang]?.[key] ?? I18N.en[key] ?? key;
}

function applyLanguage(lang, { reloadContent = false } = {}) {
  currentLang = I18N[lang] ? lang : 'fa';
  // Set lang for CSS content styling; do NOT set dir on <html> — chrome layout stays fixed.
  document.documentElement.lang = currentLang;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, currentLang);
  } catch {
    /* ignore */
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key && I18N.en[key] !== undefined) el.textContent = t(key);
  });

  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) menuToggle.setAttribute('aria-label', t('menu'));

  if (pageModal.isOpen() && pageModal.currentPage) {
    pageModal.refreshTitle();
    openCmsPage(pageModal.currentPage);
  }

  if (reloadContent) {
    if (activeProjectId) closeProjectDetail();
    loadProjects();
  }
}

function initLanguageSwitch() {
  document.querySelector('.lang-switch')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn || btn.dataset.lang === currentLang) return;
    applyLanguage(btn.dataset.lang, { reloadContent: true });
  });
  applyLanguage(currentLang);
}

/* ---------- CMS page modal (About / Contact) ---------- */
/* Admin-authored HTML is trusted CMS content and rendered via innerHTML. */

async function fetchSiteSettings() {
  const res = await fetch(`/api/site-settings?locale=${encodeURIComponent(currentLang)}`);
  if (!res.ok) throw new Error('Failed to load site settings');
  return res.json();
}

const pageModal = (() => {
  const root = document.getElementById('page-modal');
  const backdrop = document.getElementById('page-modal-backdrop');
  const titleEl = document.getElementById('page-modal-title');
  const bodyEl = document.getElementById('page-modal-body');
  const closeBtn = document.getElementById('page-modal-close');
  let currentPage = null;

  function isOpen() {
    return root.classList.contains('is-open');
  }

  function refreshTitle() {
    if (!currentPage) return;
    titleEl.textContent = currentPage === 'about' ? t('about') : t('contact');
  }

  function open(page, html) {
    currentPage = page;
    refreshTitle();

    const trimmed = (html || '').trim();
    if (trimmed) {
      bodyEl.classList.remove('page-modal-body--empty');
      // Trusted admin CMS HTML — intentional innerHTML for About/Contact pages.
      bodyEl.innerHTML = trimmed;
    } else {
      bodyEl.classList.add('page-modal-body--empty');
      bodyEl.textContent = page === 'about' ? t('emptyAbout') : t('emptyContact');
    }

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => root.classList.add('is-open'));
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    currentPage = null;

    root.addEventListener(
      'transitionend',
      function onClose(e) {
        if (e.propertyName !== 'opacity' || isOpen()) return;
        root.hidden = true;
        bodyEl.innerHTML = '';
        root.removeEventListener('transitionend', onClose);
      },
      { once: true },
    );
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  return {
    open,
    close,
    isOpen,
    get currentPage() {
      return currentPage;
    },
    refreshTitle,
  };
})();

async function openCmsPage(page) {
  try {
    const settings = await fetchSiteSettings();
    const html = page === 'about' ? settings.about_html : settings.contact_html;
    pageModal.open(page, html);
  } catch {
    pageModal.open(page, '');
  }
}

function goHome() {
  pageModal.close();
  if (activeProjectId) closeProjectDetail();
}

/* ---------- Site menu (hamburger) ---------- */

function initSiteMenu() {
  const toggle = document.getElementById('menu-toggle');
  const dropdown = document.getElementById('site-menu');
  const list = document.getElementById('site-menu-list');

  function isOpen() {
    return dropdown.classList.contains('open');
  }

  function open() {
    dropdown.hidden = false;
    requestAnimationFrame(() => dropdown.classList.add('open'));
    dropdown.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function hide() {
    dropdown.classList.remove('open');
    dropdown.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  }

  dropdown.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'opacity' && !isOpen()) dropdown.hidden = true;
  });

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen() ? hide() : open();
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && !dropdown.contains(e.target) && e.target !== toggle) hide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) hide();
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.site-menu-item');
    if (!item) return;
    hide();

    const action = item.dataset.action;
    if (action === 'home') goHome();
    else if (action === 'about') openCmsPage('about');
    else if (action === 'contact') openCmsPage('contact');
  });
}

/* ---------- Gallery ---------- */

async function loadProjects() {
  const track = document.getElementById('projects-track');
  const viewport = document.getElementById('projects-viewport');

  try {
    const projects = (
      await fetch(`/api/projects?locale=${encodeURIComponent(currentLang)}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load projects');
        return r.json();
      })
    )
      .slice()
      .reverse();

    if (projects.length === 0) {
      track.innerHTML = `<p class="projects-empty">${escapeHtml(t('emptyProjects'))}</p>`;
      return;
    }

    track.innerHTML = projects
      .map(
        (project, index) => `
      <button
        type="button"
        class="project-card"
        data-id="${project.id}"
        aria-label="${escapeHtml(project.title)}"
      >
        <img
          src="${resolveUrl(project.header_image_url)}"
          alt="${escapeHtml(project.title)}"
          loading="${index < 4 ? 'eager' : 'lazy'}"
          draggable="false"
        />
        <span class="project-card-overlay" aria-hidden="true">
          <span class="project-card-title">${escapeHtml(project.title)}</span>
        </span>
      </button>
    `,
      )
      .join('');

    const images = track.querySelectorAll('img');
    await Promise.all(
      [...images].map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
      ),
    );

    const scroller = createSmoothScroller(viewport, track);
    setGalleryScrollPosition(viewport, track, scroller);
    initHorizontalScroll(viewport, track, scroller, {
      dragSelector: '.project-card',
      isWheelActive: () => !document.getElementById('project-detail').classList.contains('is-open'),
      onTap: (card) => {
        if (card.dataset.id) openProjectDetail(card.dataset.id);
      },
    });

    if (galleryResizeHandler) {
      window.removeEventListener('resize', galleryResizeHandler);
    }
    galleryResizeHandler = () => setGalleryScrollPosition(viewport, track, scroller);
    window.addEventListener('resize', galleryResizeHandler);

    if (!galleryHashHandled) {
      galleryHashHandled = true;
      const hash = window.location.hash.match(/^#project\/(.+)$/);
      if (hash) openProjectDetail(hash[1]);
    }
  } catch {
    track.innerHTML = `<p class="projects-empty">${escapeHtml(t('loadError'))}</p>`;
  }
}

initLanguageSwitch();
initSiteMenu();
loadProjects();
magnifier = initMagnifier();

document.addEventListener('contextmenu', (e) => {
  if (e.target instanceof HTMLImageElement) e.preventDefault();
});
