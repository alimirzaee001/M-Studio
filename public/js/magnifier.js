const ZOOM = 2.25;

function getLensRadius() {
  const size = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--magnifier-lens-size'),
  );
  return (Number.isFinite(size) ? size : 240) / 2;
}

export function initMagnifier() {
  const toggle = document.getElementById('magnifier-toggle');
  const root = document.getElementById('magnifier-root');
  const lens = document.getElementById('magnifier-lens');
  const inner = document.getElementById('magnifier-lens-inner');
  const page = document.querySelector('.page');
  const slot = toggle?.closest('.magnifier-slot') || toggle;

  if (!toggle || !root || !lens || !inner || !page) return null;

  let active = false;
  let available = false;
  let mirror = null;
  let rafId = null;
  let refreshTimer = null;
  let lastX = 0;
  let lastY = 0;

  const scrollPairs = ['projects-viewport', 'section-viewport'];

  function syncScroll() {
    if (!mirror) return;

    for (const id of scrollPairs) {
      const source = document.getElementById(id);
      const target = mirror.querySelector(`#${id}`);
      if (source && target) target.scrollLeft = source.scrollLeft;
    }
  }

  function updateLens(x, y) {
    const radius = getLensRadius();
    lens.style.left = `${x - radius}px`;
    lens.style.top = `${y - radius}px`;
    inner.style.transform = `translate(${radius - x * ZOOM}px, ${radius - y * ZOOM}px) scale(${ZOOM})`;
  }

  function buildMirror() {
    inner.innerHTML = '';
    mirror = page.cloneNode(true);
    mirror.classList.add('magnifier-mirror');
    mirror.removeAttribute('id');
    inner.appendChild(mirror);

    const lightboxOpen = document.body.classList.contains('lightbox-open');
    const lightbox = document.getElementById('lightbox');
    if (lightboxOpen && lightbox && !lightbox.hidden) {
      const lightboxClone = lightbox.cloneNode(true);
      lightboxClone.removeAttribute('id');
      lightboxClone.hidden = false;
      lightboxClone.setAttribute('aria-hidden', 'false');
      lightboxClone.classList.add('is-open', 'magnifier-mirror-lightbox');

      const liveImg = document.getElementById('lightbox-img');
      const cloneImg = lightboxClone.querySelector('.lightbox-img');
      if (liveImg && cloneImg) cloneImg.src = liveImg.src;

      inner.appendChild(lightboxClone);
    }

    // #region agent log
    fetch('http://127.0.0.1:7606/ingest/d480a2b4-f72d-4e9a-a787-d061d53c38ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ac2ea5'},body:JSON.stringify({sessionId:'ac2ea5',runId:'magnifier-lightbox',hypothesisId:'H1',location:'magnifier.js:buildMirror',message:'mirror built',data:{lightboxOpen,includesLightbox:lightboxOpen&&!!lightbox&&!lightbox.hidden,imgSrc:document.getElementById('lightbox-img')?.src||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    syncScroll();
  }

  function onPointerMove(e) {
    if (!active) return;

    lastX = e.clientX;
    lastY = e.clientY;

    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      root.classList.add('is-tracking');
      syncScroll();
      updateLens(lastX, lastY);
    });
  }

  function onResize() {
    if (!active) return;
    buildMirror();
    if (root.classList.contains('is-tracking')) updateLens(lastX, lastY);
  }

  function scheduleRefresh() {
    if (!active) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      buildMirror();
      if (root.classList.contains('is-tracking')) updateLens(lastX, lastY);
    }, 200);
  }

  function enable() {
    if (!available) return;
    active = true;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('magnifier-active');
    toggle.classList.add('is-active');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', 'جهت غیر فعال کردن کلید Esc روی کیبورد را فشار دهید');
    buildMirror();
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('scroll', syncScroll, true);
    window.addEventListener('resize', onResize);
  }

  function setAvailable(nextAvailable) {
    available = Boolean(nextAvailable);
    if (slot) slot.hidden = !available;
    if (!available) disable();
  }

  setAvailable(false);

  function disable() {
    active = false;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-tracking');
    document.body.classList.remove('magnifier-active');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Magnifying glass');
    inner.innerHTML = '';
    mirror = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('scroll', syncScroll, true);
    window.removeEventListener('resize', onResize);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (active) disable();
    else enable();
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && active) {
        e.preventDefault();
        e.stopImmediatePropagation();
        disable();
      }
    },
    true,
  );

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(page, { childList: true, subtree: true, attributes: true });

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    observer.observe(lightbox, { attributes: true, attributeFilter: ['class', 'hidden'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  return {
    refresh: () => {
      if (active) {
        buildMirror();
        if (root.classList.contains('is-tracking')) updateLens(lastX, lastY);
      }
    },
    disable,
    setAvailable,
    isActive: () => active,
    isAvailable: () => available,
  };
}
