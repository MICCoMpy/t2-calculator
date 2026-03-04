/**
 * T₂ Calculator — Frontend Application
 * Handles file upload, API communication, and result rendering.
 */

// ── Configuration ──────────────────────────────────────────────────────────
const CONFIG = {
  // Change this to your deployed backend URL.
  // For local development: http://localhost:8000
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://t2-calculator.onrender.com',  // ← Replace with your deployed backend URL
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_EXT: '.cif',
};

// ── DOM References ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dropZone    = $('dropZone');
const fileInput   = $('fileInput');
const dropContent = $('dropContent');
const fileReady   = $('fileReady');
const fileName    = $('fileName');
const fileSize    = $('fileSize');
const removeFile  = $('removeFile');
const computeBtn  = $('computeBtn');
const loadingState = $('loadingState');
const loadingStep = $('loadingStep');
const errorMsg    = $('errorMsg');
const errorText   = $('errorText');
const resultsPanel = $('resultsPanel');
const resetBtn    = $('resetBtn');
const rawToggle   = $('rawToggle');
const rawContent  = $('rawContent');
const rawJson     = $('rawJson');

// ── State ───────────────────────────────────────────────────────────────────
let currentFile = null;

// ── Lattice Canvas Background ───────────────────────────────────────────────
(function initLattice() {
  const canvas = $('latticeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); drawLattice(); });

  function drawLattice() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const spacing = 48;
    const cols = Math.ceil(w / spacing) + 2;
    const rows = Math.ceil(h / spacing) + 2;

    ctx.strokeStyle = 'rgba(0,212,170,0.07)';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = 'rgba(0,212,170,0.18)';

    // Grid lines
    for (let i = 0; i < cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * spacing, 0);
      ctx.lineTo(i * spacing, h);
      ctx.stroke();
    }
    for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * spacing);
      ctx.lineTo(w, j * spacing);
      ctx.stroke();
    }

    // Node dots at intersections (sparse)
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 3 === 0) {
          ctx.beginPath();
          ctx.arc(i * spacing, j * spacing, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawLattice();
})();

// ── Drag & Drop ─────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  })
);
dropZone.addEventListener('drop', e => {
  const files = e.dataTransfer?.files;
  if (files?.length) handleFile(files[0]);
});
dropZone.addEventListener('click', e => {
  if (e.target === removeFile || removeFile.contains(e.target)) return;
  fileInput.click();
});
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', e => {
  if (e.target.files?.length) handleFile(e.target.files[0]);
});
removeFile.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

// ── File Handling ───────────────────────────────────────────────────────────
function handleFile(file) {
  clearError();

  // Validate extension
  if (!file.name.toLowerCase().endsWith(CONFIG.ALLOWED_EXT)) {
    showError(`Invalid file type. Please upload a ${CONFIG.ALLOWED_EXT} file.`);
    return;
  }

  // Validate size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > CONFIG.MAX_FILE_SIZE_MB) {
    showError(`File too large (${sizeMB.toFixed(1)} MB). Maximum allowed is ${CONFIG.MAX_FILE_SIZE_MB} MB.`);
    return;
  }

  currentFile = file;

  // Update UI
  dropContent.hidden = true;
  fileReady.hidden   = false;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  computeBtn.disabled = false;

  // Reset result panel if previously shown
  resultsPanel.hidden = true;
}

function clearFile() {
  currentFile = null;
  fileInput.value = '';
  dropContent.hidden = false;
  fileReady.hidden   = true;
  computeBtn.disabled = true;
  clearError();
}

// ── Compute ─────────────────────────────────────────────────────────────────
computeBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  // Enter loading state
  setLoading(true);
  clearError();
  resultsPanel.hidden = true;

  try {
    const formData = new FormData();
    formData.append('file', currentFile);

    // Cycle loading messages
    const steps = [
      'Parsing CIF file…',
      'Extracting lattice parameters…',
      'Identifying atomic sites…',
      'Computing T₂ coherence time…',
      'Finalizing results…',
    ];
    let stepIdx = 0;
    loadingStep.textContent = steps[stepIdx];
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      loadingStep.textContent = steps[stepIdx];
    }, 1200);

    const response = await fetch(`${CONFIG.API_BASE}/compute`, {
      method: 'POST',
      body: formData,
    });

    clearInterval(stepInterval);

    if (!response.ok) {
      let detail = `Server error (HTTP ${response.status})`;
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }

    const data = await response.json();
    renderResults(data);

  } catch (err) {
    let msg = err.message;
    if (err instanceof TypeError && err.message.includes('fetch')) {
      msg = 'Cannot reach the backend server. Make sure it is running and the API_BASE URL is correct.';
    }
    showError(msg);
  } finally {
    setLoading(false);
  }
});

// ── Render Results ───────────────────────────────────────────────────────────
function renderResults(data) {
  // T2
  const { t2_value, t2_unit } = formatT2(data.T2);
  $('t2Value').textContent = t2_value;
  $('t2Unit').textContent  = t2_unit;

  // Formula & info
  $('resFormula').textContent      = data.chemical_formula    ?? '—';
  $('resNumAtoms').textContent     = data.num_atoms           ?? '—';
  $('resCrystalSystem').textContent = data.crystal_system     ?? '—';
  $('resSpaceGroup').textContent   = data.space_group         ?? '—';

  // Lattice parameters
  const lp = data.lattice_parameters ?? {};
  $('lat-a').textContent     = fmt(lp.a);
  $('lat-b').textContent     = fmt(lp.b);
  $('lat-c').textContent     = fmt(lp.c);
  $('lat-alpha').textContent = fmt(lp.alpha);
  $('lat-beta').textContent  = fmt(lp.beta);
  $('lat-gamma').textContent = fmt(lp.gamma);

  // Raw JSON
  rawJson.textContent = JSON.stringify(data, null, 2);

  // Show panel
  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Reset ────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  clearFile();
  resultsPanel.hidden = true;
  rawContent.hidden   = true;
  rawToggle.setAttribute('aria-expanded', 'false');
  document.getElementById('uploadSection').scrollIntoView({ behavior: 'smooth' });
});

// ── Raw Toggle ───────────────────────────────────────────────────────────────
rawToggle.addEventListener('click', () => {
  const expanded = rawToggle.getAttribute('aria-expanded') === 'true';
  rawToggle.setAttribute('aria-expanded', String(!expanded));
  rawContent.hidden = expanded;
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function setLoading(on) {
  loadingState.hidden = !on;
  computeBtn.style.display = on ? 'none' : '';
}

function showError(msg) {
  errorText.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorText.textContent = '';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmt(val, decimals = 4) {
  if (val === undefined || val === null) return '—';
  return Number(val).toFixed(decimals);
}

/**
 * Auto-scale T2 value to readable units.
 * Assumes T2 is returned in seconds from the backend.
 */
function formatT2(t2) {
  if (t2 === undefined || t2 === null) return { t2_value: '—', t2_unit: '' };
  const val = Number(t2);
  if (isNaN(val)) return { t2_value: String(t2), t2_unit: '' };
  if (val >= 1)          return { t2_value: val.toPrecision(4),             t2_unit: 's'  };
  if (val >= 1e-3)       return { t2_value: (val * 1e3).toPrecision(4),     t2_unit: 'ms' };
  if (val >= 1e-6)       return { t2_value: (val * 1e6).toPrecision(4),     t2_unit: 'μs' };
  if (val >= 1e-9)       return { t2_value: (val * 1e9).toPrecision(4),     t2_unit: 'ns' };
  return                        { t2_value: (val * 1e12).toPrecision(4),    t2_unit: 'ps' };
}
