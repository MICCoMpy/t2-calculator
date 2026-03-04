/**
 * T₂ Calculator — Frontend Application
 * Handles multi-file upload, API communication, and result rendering.
 */

// ── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://t2-calculator.onrender.com',
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_EXT: '.cif',
};

// ── DOM References ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dropZone          = $('dropZone');
const fileInput         = $('fileInput');
const dropContent       = $('dropContent');
const fileReady         = $('fileReady');
const fileList          = $('fileList');
const removeAllBtn      = $('removeFile');
const computeBtn        = $('computeBtn');
const loadingState      = $('loadingState');
const loadingStep       = $('loadingStep');
const errorMsg          = $('errorMsg');
const errorText         = $('errorText');
const resultsPanel      = $('resultsPanel');
const multiResultsCont  = $('multiResultsContainer');
const resetBtn          = $('resetBtn');
const rawToggle         = $('rawToggle');
const rawContent        = $('rawContent');
const rawJson           = $('rawJson');

// ── State ─────────────────────────────────────────────────────────────────────
let currentFiles = [];
let selectedDim = '3D';   // (4) tracks 2D / 3D selection

// ── Dimensionality selector ───────────────────────────────────────────────────
function selectDim(dim) {
  selectedDim = dim;
  document.getElementById('pill3D').classList.toggle('selected', dim === '3D');
  document.getElementById('pill2D').classList.toggle('selected', dim === '2D');
  document.getElementById('pill3D').setAttribute('aria-pressed', String(dim === '3D'));
  document.getElementById('pill2D').setAttribute('aria-pressed', String(dim === '2D'));
}

// ── Lattice Canvas Background ─────────────────────────────────────────────────
(function initLattice() {
  const canvas = $('latticeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', () => { resize(); draw(); });
  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const sp = 48;
    const cols = Math.ceil(w / sp) + 2, rows = Math.ceil(h / sp) + 2;
    ctx.strokeStyle = 'rgba(0,212,170,0.07)';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = 'rgba(0,212,170,0.18)';
    for (let i = 0; i < cols; i++) { ctx.beginPath(); ctx.moveTo(i*sp,0); ctx.lineTo(i*sp,h); ctx.stroke(); }
    for (let j = 0; j < rows; j++) { ctx.beginPath(); ctx.moveTo(0,j*sp); ctx.lineTo(w,j*sp); ctx.stroke(); }
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i+j) % 3 === 0) { ctx.beginPath(); ctx.arc(i*sp, j*sp, 1.5, 0, Math.PI*2); ctx.fill(); }
    }
  }
  draw();
})();

// ── Drag & Drop ───────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); })
);
dropZone.addEventListener('drop', e => {
  const files = e.dataTransfer?.files;
  if (files?.length) handleFiles(Array.from(files));
});
dropZone.addEventListener('click', e => {
  if (e.target === removeAllBtn || removeAllBtn.contains(e.target)) return;
  fileInput.click();
});
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', e => {
  if (e.target.files?.length) handleFiles(Array.from(e.target.files));
});
removeAllBtn.addEventListener('click', e => { e.stopPropagation(); clearFiles(); });

// ── File Handling ─────────────────────────────────────────────────────────────
// CHANGE 5: handle array of files, validate each
function handleFiles(files) {
  clearError();
  const valid = [];
  const errors = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(CONFIG.ALLOWED_EXT)) {
      errors.push(`"${file.name}" is not a .cif file.`);
      continue;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      errors.push(`"${file.name}" is too large (${sizeMB.toFixed(1)} MB, max ${CONFIG.MAX_FILE_SIZE_MB} MB).`);
      continue;
    }
    valid.push(file);
  }

  if (errors.length) {
    showError(errors.join(' '));
  }
  if (!valid.length) return;

  // Merge with existing files, deduplicating by name
  const existing = new Set(currentFiles.map(f => f.name));
  for (const f of valid) {
    if (!existing.has(f.name)) { currentFiles.push(f); existing.add(f.name); }
  }

  renderFileList();
  resultsPanel.hidden = true;
}

function renderFileList() {
  if (!currentFiles.length) { clearFiles(); return; }
  dropContent.hidden = true;
  fileReady.hidden   = false;
  fileList.innerHTML = '';
  currentFiles.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.id = `file-item-${idx}`;
    item.innerHTML = `
      <svg class="file-list-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <div class="file-list-info">
        <div class="file-list-name" title="${file.name}">${file.name}</div>
        <div class="file-list-size">${formatBytes(file.size)}</div>
      </div>
      <span class="file-list-status pending" id="status-${idx}">pending</span>
    `;
    fileList.appendChild(item);
  });
  computeBtn.disabled = false;
}

function clearFiles() {
  currentFiles = [];
  fileInput.value = '';
  dropContent.hidden = false;
  fileReady.hidden   = true;
  fileList.innerHTML = '';
  computeBtn.disabled = true;
  clearError();
}

// ── Compute ───────────────────────────────────────────────────────────────────
// CHANGE 4 & 5: show loading only after button press; process all files
computeBtn.addEventListener('click', async () => {
  if (!currentFiles.length) return;

  // CHANGE 4: show loading state only now (not before)
  setLoading(true);
  clearError();
  resultsPanel.hidden = true;
  multiResultsCont.innerHTML = '';

  const allResults = [];
  const steps = [
    'Parsing CIF file…',
    'Extracting lattice parameters…',
    'Identifying atomic sites…',
    'Computing T₂ coherence time…',
    'Finalizing results…',
  ];
  let stepIdx = 0;
  loadingStep.textContent = steps[0];
  const stepInterval = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    loadingStep.textContent = steps[stepIdx];
  }, 1200);

  // CHANGE 5: process each file sequentially, update its status tag
  for (let idx = 0; idx < currentFiles.length; idx++) {
    const file = currentFiles[idx];
    const statusEl = $(`status-${idx}`);

    if (statusEl) { statusEl.textContent = 'processing…'; statusEl.className = 'file-list-status loading'; }
    loadingStep.textContent = `Processing ${file.name}…`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dimensionality', selectedDim);   // (4) send 2D or 3D

      const response = await fetch(`${CONFIG.API_BASE}/compute`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let detail = `Server error (HTTP ${response.status})`;
        try { const err = await response.json(); detail = err.detail || detail; } catch {}
        throw new Error(detail);
      }

      const data = await response.json();
      data._filename = file.name;
      allResults.push({ ok: true, data, filename: file.name });

      if (statusEl) { statusEl.textContent = 'done'; statusEl.className = 'file-list-status done'; }

    } catch (err) {
      let msg = err.message;
      if (err instanceof TypeError && err.message.includes('fetch')) {
        msg = 'Cannot reach backend server.';
      }
      allResults.push({ ok: false, error: msg, filename: file.name });
      if (statusEl) { statusEl.textContent = 'error'; statusEl.className = 'file-list-status error'; }
    }
  }

  clearInterval(stepInterval);
  setLoading(false);

  // Render all results
  if (allResults.length) {
    renderAllResults(allResults);
  }
});

// ── Render Results ─────────────────────────────────────────────────────────────
// CHANGE 5: render one card per file
function renderAllResults(results) {
  multiResultsCont.innerHTML = '';
  const allData = results.filter(r => r.ok).map(r => r.data);

  results.forEach((result, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${idx * 0.07}s`;

    if (!result.ok) {
      card.innerHTML = `
        <div class="result-card-header">
          <span class="result-card-filename">${result.filename}</span>
          <span class="result-card-index">${idx + 1} / ${results.length}</span>
        </div>
        <div class="result-card-body">
          <div class="error-msg" style="margin:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
            </svg>
            ${result.error}
          </div>
        </div>
      `;
    } else {
      const d = result.data;
      const { t2_value, t2_unit } = formatT2(d.T2);
      const lp = d.lattice_parameters ?? {};
      card.innerHTML = `
        <div class="result-card-header">
          <span class="result-card-filename">${result.filename}</span>
          <span class="result-card-index">${idx + 1} / ${results.length}</span>
        </div>
        <div class="result-card-body">
          <div class="t2-hero">
            <div class="t2-label">Coherence Time</div>
            <div class="t2-value-wrap">
              <span class="t2-value">${t2_value}</span>
              <span class="t2-unit">${t2_unit}</span>
            </div>
            <div class="t2-desc">Computed spin coherence time T₂</div>
          </div>
          <div class="info-grid">
            <div class="info-card">
              <div class="info-card-label">Chemical Formula</div>
              <div class="info-card-value formula-value">${d.chemical_formula ?? '—'}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Number of Atoms</div>
              <div class="info-card-value">${d.num_atoms ?? '—'}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Crystal System</div>
              <div class="info-card-value">${d.crystal_system ?? '—'}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Space Group</div>
              <div class="info-card-value">${d.space_group ?? '—'}</div>
            </div>
          </div>
          <div class="lattice-section">
            <h3 class="section-subtitle">Lattice Parameters</h3>
            <div class="lattice-grid">
              ${[['a','a','Å'],['b','b','Å'],['c','c','Å'],['α','alpha','°'],['β','beta','°'],['γ','gamma','°']]
                .map(([sym,key,unit]) => `
                  <div class="lattice-card">
                    <span class="lattice-sym">${sym}</span>
                    <span class="lattice-val">${fmt(lp[key])}</span>
                    <span class="lattice-unit">${unit}</span>
                  </div>`).join('')}
            </div>
          </div>
        </div>
      `;
    }
    multiResultsCont.appendChild(card);
  });

  // Put all JSON in raw accordion
  rawJson.textContent = JSON.stringify(allData.length === 1 ? allData[0] : allData, null, 2);

  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  clearFiles();
  resultsPanel.hidden = true;
  multiResultsCont.innerHTML = '';
  rawContent.hidden = true;
  rawToggle.setAttribute('aria-expanded', 'false');
  $('uploadSection').scrollIntoView({ behavior: 'smooth' });
});

// ── Raw Toggle ────────────────────────────────────────────────────────────────
rawToggle.addEventListener('click', () => {
  const expanded = rawToggle.getAttribute('aria-expanded') === 'true';
  rawToggle.setAttribute('aria-expanded', String(!expanded));
  rawContent.hidden = expanded;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
// CHANGE 4: loading state toggled only by JS, never shown at page load
function setLoading(on) {
  loadingState.hidden = !on;
  computeBtn.style.display = on ? 'none' : '';
}

function showError(msg) { errorText.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorText.textContent = ''; }

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmt(val, decimals = 4) {
  if (val === undefined || val === null) return '—';
  return Number(val).toFixed(decimals);
}

// Auto-scale T2. Backend returns ms (per main.py T2_unit="ms")
function formatT2(t2) {
  if (t2 === undefined || t2 === null) return { t2_value: '—', t2_unit: '' };
  const val = Number(t2);
  if (isNaN(val)) return { t2_value: String(t2), t2_unit: '' };
  // Value is in ms from backend
  if (val >= 1000)  return { t2_value: (val / 1000).toPrecision(4), t2_unit: 's'  };
  if (val >= 1)     return { t2_value: val.toPrecision(4),           t2_unit: 'ms' };
  if (val >= 1e-3)  return { t2_value: (val * 1e3).toPrecision(4),  t2_unit: 'μs' };
  return                   { t2_value: (val * 1e6).toPrecision(4),  t2_unit: 'ns' };
}
