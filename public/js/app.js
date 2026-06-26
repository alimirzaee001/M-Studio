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

    viewport.scrollLeft = current + diff * 0.14;
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
    if (Math.abs(velocity) < 0.5) return;
    scrollTo(targetScroll - velocity * 12);
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

  const images = sortMediaByOrder(section.media.filter((m) => m.media_type === 'image'));
  const videos = sortMediaByOrder(section.media.filter((m) => m.media_type === 'video_link'));

  for (const m of images) {
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
  }

  for (const video of videos) {
    panels.push(`
      <div class="detail-panel detail-panel--video">
        <a class="detail-video-link" href="${escapeHtml(video.media_url)}" target="_blank" rel="noopener noreferrer">
          Watch video
        </a>
      </div>
    `);
  }

  if (images.length === 0 && videos.length === 0) {
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
    dragSelector: '.detail-panel--image, .detail-panel--video, .detail-panel--empty',
    onTap: (panel) => {
      const item = panel.querySelector('.detail-image-item.is-clickable');
      if (item?.dataset.target) lightbox.open(item.dataset.target);
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

    await showSection(firstSectionId);

    history.pushState({ projectId }, '', `#project/${projectId}`);
  } catch {
    /* keep gallery visible on error */
  }
}

function closeProjectDetail() {
  const detail = document.getElementById('project-detail');
  if (!detail.classList.contains('is-open')) return;

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
  if (e.key === 'Escape' && !lightbox.isOpen()) closeProjectDetail();
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

/* ---------- Gallery ---------- */

function initProjectListMenu(projects, viewport, scroller, onOpenProject) {
  const toggle = document.getElementById('menu-toggle');
  const dropdown = document.getElementById('project-dropdown');
  const list = document.getElementById('project-list');

  if (projects.length === 0) {
    list.innerHTML = '<li class="project-list-empty">No projects yet.</li>';
  } else {
    list.innerHTML = projects
      .map(
        (project) => `
      <li>
        <button type="button" class="project-list-item" data-id="${project.id}" role="menuitem">
          ${escapeHtml(project.title)}
        </button>
      </li>
    `,
      )
      .join('');
  }

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
    const item = e.target.closest('.project-list-item');
    if (!item) return;

    if (onOpenProject) {
      onOpenProject(item.dataset.id);
    } else if (scroller) {
      const track = document.getElementById('projects-track');
      const card = track.querySelector(`.project-card[data-id="${item.dataset.id}"]`);
      if (card) {
        const target = card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2;
        scroller.scrollTo(target);
      }
    }
    hide();
  });
}

async function loadProjects() {
  const track = document.getElementById('projects-track');
  const viewport = document.getElementById('projects-viewport');

  try {
    const projects = (
      await fetch('/api/projects').then((r) => {
        if (!r.ok) throw new Error('Failed to load projects');
        return r.json();
      })
    )
      .slice()
      .reverse();

    if (projects.length === 0) {
      track.innerHTML = '<p class="projects-empty">No projects yet.</p>';
      initProjectListMenu(projects, viewport, null, openProjectDetail);
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

    initProjectListMenu(projects, viewport, scroller, openProjectDetail);

    window.addEventListener('resize', () => setGalleryScrollPosition(viewport, track, scroller));

    const hash = window.location.hash.match(/^#project\/(.+)$/);
    if (hash) openProjectDetail(hash[1]);
  } catch {
    track.innerHTML = '<p class="projects-empty">Unable to load projects.</p>';
  }
}

loadProjects();
magnifier = initMagnifier();

document.addEventListener('contextmenu', (e) => {
  if (e.target instanceof HTMLImageElement) e.preventDefault();
});
