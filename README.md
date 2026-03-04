# T₂ Calculator

**Quantum Coherence Time Analysis from Crystal Structures**

A full-stack web application that accepts crystallographic information files (`.cif`), parses them using `pymatgen`, and computes the spin–spin coherence time **T₂** for the material. The frontend deploys to **GitHub Pages**; the backend deploys to **Render**, **Railway**, or any Python hosting service.

---

## Live Demo

| Layer | URL |
|-------|-----|
| Frontend | `https://your-username.github.io/t2-calculator/` |
| Backend API | `https://your-app.onrender.com` |

---

## Project Structure

```
t2-calculator/
├── .github/
│   └── workflows/
│       └── deploy-frontend.yml   # Auto-deploy frontend to GitHub Pages
├── frontend/
│   ├── index.html                # Main HTML (single-page app)
│   ├── style.css                 # Scientific dark-theme stylesheet
│   └── app.js                   # Drag-and-drop UI + API integration
├── backend/
│   ├── main.py                   # FastAPI app + pymatgen CIF parser
│   ├── requirements.txt          # Python dependencies
│   ├── Procfile                  # Render/Railway process file
│   └── runtime.txt               # Python version pin
├── .gitignore
└── README.md
```

---

## Quick Start — Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-username/t2-calculator.git
cd t2-calculator
```

### 2. Run the Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Start the dev server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs at `http://localhost:8000/docs`.

### 3. Serve the Frontend

Open a new terminal:

```bash
cd frontend

# Option A: Python's built-in server
python -m http.server 5500

# Option B: VS Code Live Server (if you have it installed)
# Just open index.html → right-click → Open with Live Server

# Option C: npx serve
npx serve .
```

Open your browser at `http://localhost:5500`.

> **Note:** The frontend auto-detects `localhost` and points to `http://localhost:8000`. No configuration needed for local development.

---

## Implementing compute_T2

Open `backend/main.py` and find the `compute_T2` function:

```python
def compute_T2(structure: Structure) -> float:
    """
    Compute the spin–spin coherence time T₂ for a crystal structure.
    Returns T₂ in seconds.
    """
    # YOUR IMPLEMENTATION HERE
    return None
```

Replace the body with your physics model. Useful `pymatgen` attributes:

```python
# Composition
structure.composition                    # Composition object
structure.composition.formula            # e.g. "Fe2 O3"
structure.composition.reduced_formula    # e.g. "Fe2O3"

# Lattice
structure.lattice.a, .b, .c             # Lengths in Å
structure.lattice.alpha, .beta, .gamma  # Angles in degrees
structure.lattice.volume                # Volume in Å³

# Sites
structure.num_sites                     # Total number of sites
structure.sites                         # List of PeriodicSite objects
structure.species                       # List of Species

# Nearest-neighbor analysis
structure.get_neighbors(site, r=3.0)    # Neighbors within 3 Å
```

---

## Deployment

### Frontend → GitHub Pages

**Automatic (via GitHub Actions):**

1. Push your code to the `main` branch.
2. Go to your repository → **Settings** → **Pages**.
3. Under *Source*, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy-frontend.yml` runs automatically and deploys the `frontend/` folder.

**Manual:**

1. Go to **Settings → Pages**.
2. Source: Deploy from a branch.
3. Branch: `main`, folder: `/frontend`.
4. Save.

---

### Backend → Render (Free Tier)

1. Create a free account at [render.com](https://render.com).
2. Click **New → Web Service**.
3. Connect your GitHub repository.
4. Configure:
   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `backend` |
   | **Environment** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
5. Click **Create Web Service**.
6. Once deployed, copy your service URL (e.g. `https://t2-calc.onrender.com`).

---

### Backend → Railway

1. Create a free account at [railway.app](https://railway.app).
2. Click **New Project → Deploy from GitHub repo**.
3. Select your repository.
4. Set the **Root Directory** to `backend`.
5. Railway auto-detects Python and installs from `requirements.txt`.
6. Copy the generated domain URL.

---

### Connect Frontend to Deployed Backend

After deploying the backend, update `frontend/app.js`:

```javascript
const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://your-app.onrender.com',  // ← Replace with your deployed backend URL
  ...
};
```

Also update the CORS allowed origins in `backend/main.py`:

```python
ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "https://your-username.github.io",  # ← Add your GitHub Pages URL
]
```

And change `allow_origins=["*"]` to `allow_origins=ALLOWED_ORIGINS` for production security.

---

## API Reference

### `POST /compute`

Upload a CIF file and receive structure information + T₂.

**Request:** `multipart/form-data` with field `file` (`.cif`)

**Response:**
```json
{
  "chemical_formula": "Fe2 O3",
  "reduced_formula": "Fe2O3",
  "num_atoms": 10,
  "num_sites": 10,
  "lattice_parameters": {
    "a": 5.0356,
    "b": 5.0356,
    "c": 13.7489,
    "alpha": 90.0,
    "beta": 90.0,
    "gamma": 120.0,
    "volume": 301.87
  },
  "crystal_system": "trigonal",
  "space_group": "R-3c",
  "space_group_number": 167,
  "density": 5.2742,
  "T2": 1.25e-6,
  "T2_unit": "s"
}
```

**Error responses:**
- `400` — Invalid file type or empty file
- `413` — File too large (> 10 MB)
- `422` — CIF parsing failed
- `500` — Internal server error

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend UI | HTML5, CSS3 (custom), Vanilla JS |
| Fonts | Syne, DM Sans, DM Mono (Google Fonts) |
| Backend | FastAPI (Python 3.11) |
| Structure parsing | pymatgen |
| Deployment (frontend) | GitHub Pages |
| Deployment (backend) | Render / Railway |

---

## License

MIT — see [LICENSE](LICENSE) for details.
