import { api, resolveUrl, loadingEvents } from './api.js';

const LOCALE_STORAGE_KEY = 'm-studio-admin-locale';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'fa' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return 'fa';
}

const state = {
  projects: [],
  currentProject: null,
  selectedId: null,
  isNew: false,
  headerFile: null,
  viewingPages: false,
  siteSettings: null,
  locale: readStoredLocale(),
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Global top progress bar, driven by every API request.
const bar = {
  pending: 0,
  get el() {
    return $('#top-progress');
  },
  get fill() {
    return $('#top-progress .top-progress-bar');
  },
  start() {
    this.pending++;
    this.el.classList.add('active');
  },
  progress(pct) {
    if (pct >= 100) {
      this.indeterminate();
      return;
    }
    this.el.classList.add('active', 'determinate');
    this.fill.style.width = `${pct}%`;
  },
  indeterminate() {
    this.el.classList.add('active');
    this.el.classList.remove('determinate');
    this.fill.style.width = '';
  },
  stop() {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) {
      this.el.classList.remove('active', 'determinate');
      this.fill.style.width = '';
    }
  },
};

loadingEvents.on('start', () => bar.start());
loadingEvents.on('stop', () => bar.stop());
loadingEvents.on('progress', (pct) => bar.progress(pct));

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  } else {
    btn.disabled = false;
    btn.classList.remove('is-loading');
  }
}

function toast(message, type = 'success') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const modal = $('#confirm-modal');
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;

    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onOk = (e) => {
      e.preventDefault();
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      modal.close();
      $('#confirm-cancel').removeEventListener('click', onCancel);
      $('#confirm-ok').removeEventListener('click', onOk);
    };

    $('#confirm-cancel').addEventListener('click', onCancel);
    $('#confirm-ok').addEventListener('click', onOk);
    modal.showModal();
  });
}

async function loadProjects() {
  state.projects = await api.listProjects(state.locale);
  renderSidebar();
}

function updateLocaleUI() {
  $$('.admin-lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.locale === state.locale);
  });
  const hint = $('#admin-lang-hint');
  if (hint) {
    hint.textContent =
      state.locale === 'fa' ? 'Editing Persian content' : 'Editing English content';
  }
}

async function setAdminLocale(locale) {
  if (locale !== 'fa' && locale !== 'en') return;
  if (locale === state.locale) return;

  state.locale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }

  state.selectedId = null;
  state.isNew = false;
  state.viewingPages = false;
  state.currentProject = null;
  state.headerFile = null;
  state.siteSettings = null;

  updateLocaleUI();

  const main = $('#main-content');
  main.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">◇</div>
      <h2>Select a project</h2>
      <p>Choose a project from the sidebar or create a new one for this language.</p>
    </div>
  `;

  try {
    await loadProjects();
    if (state.projects.length > 0) {
      await selectProject(state.projects[0].id);
    }
  } catch (err) {
    toast(`Failed to load ${locale.toUpperCase()} projects: ${err.message}`, 'error');
  }
}

function renderSidebar() {
  const list = $('#project-list');
  list.innerHTML = state.projects
    .map(
      (p) => `
    <button type="button" class="project-item ${!state.viewingPages && p.id === state.selectedId ? 'active' : ''}" data-id="${p.id}">
      ${escapeHtml(p.title)}
    </button>
  `,
    )
    .join('');

  $$('.project-item', list).forEach((btn) => {
    btn.addEventListener('click', () => selectProject(btn.dataset.id));
  });

  const pagesBtn = $('#btn-pages');
  if (pagesBtn) pagesBtn.classList.toggle('active', state.viewingPages);

  const active = $('.project-item.active', list);
  if (active) {
    active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function selectProject(id) {
  state.selectedId = id;
  state.isNew = false;
  state.viewingPages = false;
  state.headerFile = null;
  renderSidebar();

  const main = $('#main-content');
  main.classList.add('loading');

  try {
    state.currentProject = await api.getProject(id);
    renderEditor();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    main.classList.remove('loading');
  }
}

function showNewProject() {
  state.selectedId = null;
  state.isNew = true;
  state.viewingPages = false;
  state.currentProject = null;
  state.headerFile = null;
  renderSidebar();
  renderNewProjectForm();
}

async function showPagesEditor() {
  state.selectedId = null;
  state.isNew = false;
  state.viewingPages = true;
  state.currentProject = null;
  state.headerFile = null;
  renderSidebar();

  const main = $('#main-content');
  main.classList.add('loading');

  try {
    state.siteSettings = await api.getSiteSettings(state.locale);
    renderPagesEditor();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    main.classList.remove('loading');
  }
}

function renderPagesEditor() {
  const s = state.siteSettings || { about_html: '', contact_html: '' };
  const main = $('#main-content');
  const langLabel = state.locale === 'fa' ? 'Persian' : 'English';

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Pages (${langLabel})</h2>
        <p>Edit About Us and Contact Us for the ${langLabel} site only</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>About Us</h2></div>
      <div class="form-group">
        <label for="about-html">HTML content</label>
        <textarea id="about-html" class="html-editor" placeholder="<p>About the studio…</p>">${escapeHtml(s.about_html || '')}</textarea>
        <p class="form-hint">Rendered as HTML inside the public About modal (trusted admin content).</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Contact Us</h2></div>
      <div class="form-group">
        <label for="contact-html">HTML content</label>
        <textarea id="contact-html" class="html-editor" placeholder="<p>Email, phone, address…</p>">${escapeHtml(s.contact_html || '')}</textarea>
        <p class="form-hint">Rendered as HTML inside the public Contact modal (trusted admin content).</p>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-primary" id="btn-save-pages">Save Pages</button>
    </div>
  `;

  $('#btn-save-pages').addEventListener('click', savePages);
}

async function savePages() {
  const btn = $('#btn-save-pages');
  setButtonLoading(btn, true);
  try {
    state.siteSettings = await api.updateSiteSettings(
      {
        about_html: $('#about-html').value,
        contact_html: $('#contact-html').value,
        locale: state.locale,
      },
      state.locale,
    );
    toast('Pages saved');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function renderNewProjectForm() {
  const main = $('#main-content');
  const langLabel = state.locale === 'fa' ? 'Persian' : 'English';
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h2>New Project (${langLabel})</h2>
        <p>Create a new portfolio project for the ${langLabel} site</p>
      </div>
    </div>
    <div class="card">
      ${projectFormHtml({ title: '', description: '', header_image_url: '' })}
      <div class="form-actions">
        <button type="button" class="btn btn-primary" id="btn-create-project">Create Project</button>
        <button type="button" class="btn btn-ghost" id="btn-cancel-new">Cancel</button>
      </div>
    </div>
  `;

  bindProjectFormEvents(true);
  $('#btn-cancel-new').addEventListener('click', () => {
    state.isNew = false;
    $('#main-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <h2>Select a project</h2>
        <p>Choose a project from the sidebar or create a new one for this language.</p>
      </div>
    `;
  });
}

function renderEditor() {
  const p = state.currentProject;
  const main = $('#main-content');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h2>${escapeHtml(p.title)}</h2>
        <p>Manage project details, sections, and media</p>
      </div>
      <button type="button" class="btn btn-danger btn-sm" id="btn-delete-project">Delete Project</button>
    </div>

    <div class="card">
      <div class="card-header"><h2>Project Details</h2></div>
      ${projectFormHtml(p)}
      <div class="form-actions">
        <button type="button" class="btn btn-primary" id="btn-save-project">Save Changes</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Sections</h2>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-section">+ Add Section</button>
      </div>
      <div class="sections-list" id="sections-list">
        ${p.sections.map((s) => sectionHtml(s)).join('')}
      </div>
    </div>
  `;

  bindProjectFormEvents(false);
  bindSectionEvents();
  initSectionSortable();
  initMediaSortables();

  $('#btn-save-project').addEventListener('click', saveProject);
  $('#btn-delete-project').addEventListener('click', deleteProject);
  $('#btn-add-section').addEventListener('click', addSection);
}

function projectFormHtml(p) {
  const headerUrl = p.header_image_url || '';
  return `
    <div class="form-group">
      <label for="project-title">Title</label>
      <input type="text" id="project-title" value="${escapeHtml(p.title || '')}" placeholder="Project name" required />
    </div>
    <div class="form-group">
      <label for="project-description">Description</label>
      <textarea id="project-description" placeholder="Brief project description">${escapeHtml(p.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label>Header Image</label>
      <label class="file-upload" for="header-file-input">
        <input type="file" id="header-file-input" accept="image/*" />
        <p><strong>Click to upload</strong> or drag an image here</p>
        <p class="form-hint">Used as the hero/banner image on the portfolio</p>
      </label>
      <div class="image-preview ${headerUrl ? '' : 'hidden'}" id="header-preview">
        <img src="${resolveUrl(headerUrl)}" alt="Header preview" id="header-preview-img" />
      </div>
      <input type="hidden" id="header-image-url" value="${escapeHtml(headerUrl)}" />
    </div>
  `;
}

function mediaItemPreview(m) {
  if (m.media_type === 'image') {
    return `<img src="${resolveUrl(m.media_url)}" alt="" loading="lazy" />`;
  }
  if (m.media_type === 'video_link') {
    return `<span>▶ Video Link</span>`;
  }
  if (m.media_type === 'black_rectangle') {
    return `<span class="strip-preview strip-preview--black">${escapeHtml(m.title || 'Black strip')}</span>`;
  }
  if (m.media_type === 'white_rectangle') {
    return `<span class="strip-preview strip-preview--white">${escapeHtml(m.title || 'White strip')}</span>`;
  }
  if (m.media_type === 'paragraph') {
    const colorClass = m.color === 'white' ? 'strip-preview--white' : 'strip-preview--black';
    const preview = (m.body || 'Paragraph').slice(0, 80);
    return `<span class="strip-preview ${colorClass}">${escapeHtml(preview)}${(m.body || '').length > 80 ? '…' : ''}</span>`;
  }
  return `<span>${escapeHtml(m.media_type)}</span>`;
}

function mediaItemClass(m) {
  if (m.media_type === 'video_link') return 'video-item';
  if (m.media_type === 'black_rectangle') return 'strip-item strip-item--black';
  if (m.media_type === 'white_rectangle') return 'strip-item strip-item--white';
  if (m.media_type === 'paragraph') {
    return m.color === 'white'
      ? 'strip-item strip-item--white paragraph-item'
      : 'strip-item strip-item--black paragraph-item';
  }
  return '';
}

function sectionHtml(section) {
  const mediaItems = section.media
    .map(
      (m) => `
    <div class="media-item ${mediaItemClass(m)}" data-id="${m.id}">
      ${mediaItemPreview(m)}
      ${m.is_clickable ? '<span class="media-badge">Clickable</span>' : ''}
      ${m.size != null ? `<span class="media-badge media-badge--size">${m.size}px</span>` : ''}
      <span class="drag-handle">⋮⋮</span>
      <div class="media-actions">
        <button type="button" class="btn btn-danger btn-icon btn-sm btn-delete-media" data-id="${m.id}" title="Delete">✕</button>
      </div>
    </div>
  `,
    )
    .join('');

  return `
    <div class="section-card" data-id="${section.id}">
      <div class="section-header">
        <span class="drag-handle section-drag">⋮⋮</span>
        <input type="text" class="section-title-input" value="${escapeHtml(section.title)}" data-id="${section.id}" />
        <button type="button" class="btn btn-ghost btn-sm btn-delete-section" data-id="${section.id}">Delete</button>
      </div>
      <div class="section-body">
        <div class="media-grid" data-section-id="${section.id}">
          ${mediaItems || '<p class="form-hint" style="grid-column:1/-1">No media yet. Add images, videos, rectangles, or paragraphs below.</p>'}
        </div>
        <button type="button" class="collapsible-toggle btn-add-media-toggle" data-section="${section.id}">
          + Add media to this section
        </button>
        <div class="add-media-form hidden" id="add-media-${section.id}">
          <h4>Add Media</h4>
          <div class="form-group">
            <label>Type</label>
            <select class="media-type-select" data-section="${section.id}">
              <option value="image">Image</option>
              <option value="video_link">Video Link</option>
              <option value="black_rectangle">Black Rectangle</option>
              <option value="white_rectangle">White Rectangle</option>
              <option value="paragraph">Paragraph</option>
            </select>
          </div>
          <div class="media-image-fields" data-section="${section.id}">
            <div class="form-group">
              <label>Display Image</label>
              <input type="file" class="media-file-input" data-section="${section.id}" accept="image/*" />
            </div>
            <label class="checkbox-label">
              <input type="checkbox" class="is-clickable-check" data-section="${section.id}" />
              Clickable (opens high-res version)
            </label>
            <div class="target-file-group hidden" data-section="${section.id}">
              <div class="form-group">
                <label>High-Resolution Image</label>
                <input type="file" class="target-file-input" data-section="${section.id}" accept="image/*" />
                <p class="form-hint">Shown in lightbox when the display image is clicked</p>
              </div>
            </div>
          </div>
          <div class="media-video-fields hidden" data-section="${section.id}">
            <div class="form-group">
              <label>Video URL</label>
              <input type="url" class="video-url-input" data-section="${section.id}" placeholder="https://youtube.com/..." />
            </div>
          </div>
          <div class="media-rectangle-fields hidden" data-section="${section.id}">
            <div class="form-group">
              <label>Text</label>
              <input type="text" class="rectangle-title-input" data-section="${section.id}" placeholder="e.g. نقشه طبقه اول" />
            </div>
            <div class="form-group">
              <label>Size (width in px)</label>
              <input type="number" class="rectangle-size-input" data-section="${section.id}" min="20" max="600" value="80" />
              <p class="form-hint">Width of the vertical strip in the gallery</p>
            </div>
            <div class="rectangle-image-group" data-section="${section.id}">
              <div class="form-group">
                <label>Clickable Image</label>
                <input type="file" class="rectangle-file-input" data-section="${section.id}" accept="image/*" />
                <p class="form-hint">Opens in lightbox when the black strip is clicked</p>
              </div>
            </div>
          </div>
          <div class="media-paragraph-fields hidden" data-section="${section.id}">
            <div class="form-group">
              <label>متن پاراگراف</label>
              <textarea class="paragraph-body-input" data-section="${section.id}" rows="5" placeholder="متن طولانی پاراگراف را اینجا بنویسید..."></textarea>
            </div>
            <div class="form-group">
              <label>Size (width in px)</label>
              <input type="number" class="paragraph-size-input" data-section="${section.id}" min="20" max="600" value="280" />
              <p class="form-hint">Width of the paragraph panel in the gallery</p>
            </div>
            <div class="form-group">
              <label>رنگ پس‌زمینه</label>
              <select class="paragraph-color-select" data-section="${section.id}">
                <option value="white">سفید</option>
                <option value="black">مشکی</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm btn-submit-media" data-section="${section.id}">Upload</button>
        </div>
      </div>
    </div>
  `;
}

function bindProjectFormEvents(isNew) {
  const fileInput = $('#header-file-input');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    state.headerFile = file;
    const preview = $('#header-preview');
    const img = $('#header-preview-img');
    img.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  });

  if (isNew) {
    $('#btn-create-project').addEventListener('click', createProject);
  }
}

async function uploadHeaderIfNeeded() {
  if (state.headerFile) {
    const { url } = await api.uploadImage(state.headerFile);
    $('#header-image-url').value = url;
    state.headerFile = null;
    return url;
  }
  return $('#header-image-url').value;
}

function getProjectFormData() {
  return {
    title: $('#project-title').value.trim(),
    description: $('#project-description').value.trim() || null,
  };
}

async function createProject() {
  const data = getProjectFormData();
  if (!data.title) {
    toast('Title is required', 'error');
    return;
  }

  const btn = $('#btn-create-project');
  setButtonLoading(btn, true);
  bar.start();
  try {
    const headerUrl = await uploadHeaderIfNeeded();
    if (!headerUrl) {
      toast('Please upload a header image', 'error');
      return;
    }

    bar.indeterminate();
    const project = await api.createProject({
      ...data,
      header_image_url: headerUrl,
      locale: state.locale,
    });
    toast('Project created');
    await loadProjects();
    selectProject(project.id);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
    bar.stop();
  }
}

async function saveProject() {
  const data = getProjectFormData();
  if (!data.title) {
    toast('Title is required', 'error');
    return;
  }

  const btn = $('#btn-save-project');
  setButtonLoading(btn, true);
  bar.start();
  try {
    const headerUrl = await uploadHeaderIfNeeded();
    bar.indeterminate();
    await api.updateProject(state.selectedId, {
      ...data,
      header_image_url: headerUrl,
    });
    toast('Project saved');
    await loadProjects();
    selectProject(state.selectedId);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
    bar.stop();
  }
}

async function deleteProject() {
  const ok = await confirmDialog(
    'Delete Project',
    `Delete "${state.currentProject.title}"? All sections and media will be permanently removed.`,
  );
  if (!ok) return;

  try {
    await api.deleteProject(state.selectedId);
    toast('Project deleted');
    state.selectedId = null;
    state.currentProject = null;
    await loadProjects();
    $('#main-content').innerHTML = `
      <div class="empty-state" id="empty-state">
        <div class="empty-icon">◇</div>
        <h2>Select a project</h2>
        <p>Choose a project from the sidebar or create a new one to get started.</p>
      </div>
    `;
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function addSection() {
  const title = prompt('Section name (e.g. "Concept Sketches"):');
  if (!title?.trim()) return;

  const btn = $('#btn-add-section');
  setButtonLoading(btn, true);
  try {
    await api.createSection(state.selectedId, { title: title.trim() });
    toast('Section added');
    selectProject(state.selectedId);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function bindSectionEvents() {
  $$('.section-title-input').forEach((input) => {
    let timeout;
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          await api.updateSection(input.dataset.id, { title: input.value.trim() });
        } catch (err) {
          toast(err.message, 'error');
        }
      }, 600);
    });
  });

  $$('.btn-delete-section').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete Section', 'Delete this section and all its media?');
      if (!ok) return;
      try {
        await api.deleteSection(btn.dataset.id);
        toast('Section deleted');
        selectProject(state.selectedId);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  $$('.btn-add-media-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = $(`#add-media-${btn.dataset.section}`);
      form.classList.toggle('hidden');
      btn.textContent = form.classList.contains('hidden')
        ? '+ Add media to this section'
        : '− Hide add media form';
    });
  });

  $$('.media-type-select').forEach((select) => {
    select.addEventListener('change', () => {
      const sid = select.dataset.section;
      const type = select.value;
      const isVideo = type === 'video_link';
      const isRectangle = type === 'black_rectangle' || type === 'white_rectangle';
      const isParagraph = type === 'paragraph';
      const isBlack = type === 'black_rectangle';

      $(`.media-image-fields[data-section="${sid}"]`).classList.toggle(
        'hidden',
        isVideo || isRectangle || isParagraph,
      );
      $(`.media-video-fields[data-section="${sid}"]`).classList.toggle('hidden', !isVideo);
      $(`.media-rectangle-fields[data-section="${sid}"]`).classList.toggle('hidden', !isRectangle);
      $(`.media-paragraph-fields[data-section="${sid}"]`).classList.toggle('hidden', !isParagraph);
      $(`.rectangle-image-group[data-section="${sid}"]`).classList.toggle('hidden', !isBlack);
    });
  });

  $$('.is-clickable-check').forEach((check) => {
    check.addEventListener('change', () => {
      const sid = check.dataset.section;
      $(`.target-file-group[data-section="${sid}"]`).classList.toggle('hidden', !check.checked);
    });
  });

  $$('.btn-submit-media').forEach((btn) => {
    btn.addEventListener('click', () => submitMedia(btn.dataset.section));
  });

  $$('.btn-delete-media').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('Delete Media', 'Remove this media item?');
      if (!ok) return;
      try {
        await api.deleteMedia(btn.dataset.id);
        toast('Media deleted');
        selectProject(state.selectedId);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function submitMedia(sectionId) {
  const typeSelect = $(`.media-type-select[data-section="${sectionId}"]`);
  const mediaType = typeSelect.value;

  const fd = new FormData();
  fd.append('media_type', mediaType);

  if (mediaType === 'image') {
    const mediaFile = $(`.media-file-input[data-section="${sectionId}"]`).files[0];
    if (!mediaFile) {
      toast('Please select a display image', 'error');
      return;
    }
    fd.append('media_file', mediaFile);

    const isClickable = $(`.is-clickable-check[data-section="${sectionId}"]`).checked;
    fd.append('is_clickable', String(isClickable));

    if (isClickable) {
      const targetFile = $(`.target-file-input[data-section="${sectionId}"]`).files[0];
      if (!targetFile) {
        toast('High-resolution image required for clickable media', 'error');
        return;
      }
      fd.append('target_media_file', targetFile);
    }
  } else if (mediaType === 'video_link') {
    const videoUrl = $(`.video-url-input[data-section="${sectionId}"]`).value.trim();
    if (!videoUrl) {
      toast('Please enter a video URL', 'error');
      return;
    }
    fd.append('media_url', videoUrl);
    fd.append('is_clickable', 'false');
  } else if (mediaType === 'paragraph') {
    const body = $(`.paragraph-body-input[data-section="${sectionId}"]`).value.trim();
    const size = Number($(`.paragraph-size-input[data-section="${sectionId}"]`).value);
    const color = $(`.paragraph-color-select[data-section="${sectionId}"]`).value;

    if (!body) {
      toast('Please enter paragraph text', 'error');
      return;
    }
    if (!Number.isFinite(size) || size < 20) {
      toast('Size must be at least 20px', 'error');
      return;
    }

    fd.append('body', body);
    fd.append('size', String(size));
    fd.append('color', color);
    fd.append('is_clickable', 'false');
  } else {
    const title = $(`.rectangle-title-input[data-section="${sectionId}"]`).value.trim();
    const size = Number($(`.rectangle-size-input[data-section="${sectionId}"]`).value);

    if (!title) {
      toast('Please enter text for the rectangle', 'error');
      return;
    }
    if (!Number.isFinite(size) || size < 20) {
      toast('Size must be at least 20px', 'error');
      return;
    }

    fd.append('title', title);
    fd.append('size', String(size));
    fd.append('is_clickable', mediaType === 'black_rectangle' ? 'true' : 'false');

    if (mediaType === 'black_rectangle') {
      const mediaFile = $(`.rectangle-file-input[data-section="${sectionId}"]`).files[0];
      if (!mediaFile) {
        toast('Please select a clickable image', 'error');
        return;
      }
      fd.append('media_file', mediaFile);
    }
  }

  const btn = $(`.btn-submit-media[data-section="${sectionId}"]`);
  setButtonLoading(btn, true);

  try {
    await api.createMedia(sectionId, fd);
    toast('Media added');
    selectProject(state.selectedId);
  } catch (err) {
    toast(err.message, 'error');
    setButtonLoading(btn, false);
  }
}

function initSectionSortable() {
  const list = $('#sections-list');
  if (!list || !window.Sortable) return;

  Sortable.create(list, {
    handle: '.section-drag',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const items = $$('.section-card', list).map((el, index) => ({
        id: el.dataset.id,
        sort_order: index,
      }));

      if (items.length === 0) return;

      try {
        await api.reorderSections(items[0].id, items);
        toast('Sections reordered');
      } catch (err) {
        toast(err.message, 'error');
        selectProject(state.selectedId);
      }
    },
  });
}

function initMediaSortables() {
  if (!window.Sortable) return;

  $$('.media-grid').forEach((grid) => {
    const items = $$('.media-item', grid);
    if (items.length < 2) return;

    Sortable.create(grid, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: async () => {
        const sectionId = grid.dataset.sectionId;
        const mediaItems = $$('.media-item', grid).map((el, index) => ({
          id: el.dataset.id,
          sort_order: index,
        }));

        if (mediaItems.length === 0) return;

        try {
          const updated = await api.reorderMedia(mediaItems[0].id, mediaItems);
          const section = state.currentProject?.sections.find((s) => s.id === sectionId);
          if (section) section.media = updated;
          toast('Media reordered');
        } catch (err) {
          toast(err.message, 'error');
          selectProject(state.selectedId);
        }
      },
    });
  });
}

async function init() {
  updateLocaleUI();

  $$('.admin-lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setAdminLocale(btn.dataset.locale));
  });

  $('#btn-new-project').addEventListener('click', showNewProject);
  $('#btn-pages').addEventListener('click', showPagesEditor);

  try {
    await loadProjects();
    if (state.projects.length > 0) {
      selectProject(state.projects[0].id);
    }
  } catch (err) {
    toast(`Failed to load projects: ${err.message}`, 'error');
  }
}

init();
