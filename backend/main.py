"""
T₂ Calculator — FastAPI Backend
--------------------------------
Accepts .cif file uploads, parses them with pymatgen,
and returns structure info + computed T₂ coherence time.

Usage:
    uvicorn main:app --reload
"""

import io
import os
import tempfile
import logging
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# pymatgen imports
try:
    from pymatgen.core import Structure
    from pymatgen.io.cif import CifParser
    from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
except ImportError as e:
    raise ImportError(
        "pymatgen is required. Install it with: pip install pymatgen"
    ) from e

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="T₂ Calculator API",
    description="Parses CIF crystal structures and computes spin coherence time T₂.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Add your GitHub Pages domain here once deployed, e.g.:
# "https://your-username.github.io"
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    # Add your GitHub Pages URL here:
    # "https://your-username.github.io",
]

# For development convenience, allow all origins.
# In production, restrict to ALLOWED_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # ← Tighten this in production
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB
ALLOWED_EXTENSION   = ".cif"


# ── Response Schema ───────────────────────────────────────────────────────────
class LatticeParameters(BaseModel):
    a: float
    b: float
    c: float
    alpha: float
    beta: float
    gamma: float
    volume: float


class ComputeResponse(BaseModel):
    chemical_formula: str
    reduced_formula:  str
    num_atoms:        int
    num_sites:        int
    lattice_parameters: LatticeParameters
    crystal_system:   str
    space_group:      str
    space_group_number: int
    density:          float        # g/cm³
    T2:               float | None  # seconds (None if compute_T2 not yet implemented)
    T2_unit:          str


# ── T₂ Computation ────────────────────────────────────────────────────────────
def compute_T2(structure: Structure) -> float:
    """
    Compute the spin–spin coherence time T₂ for a crystal structure.

    *** PLACEHOLDER — implement your own physics here ***

    Parameters
    ----------
    structure : pymatgen.core.Structure
        Fully parsed crystal structure.

    Returns
    -------
    float
        T₂ value in **seconds**.
    """
    # ─────────────────────────────────────────────────────
    # TODO: Replace this placeholder with your T₂ model.
    #
    # Example inputs you may find useful:
    #
    #   structure.composition          → Composition object
    #   structure.lattice.abc          → (a, b, c) in Å
    #   structure.lattice.angles       → (α, β, γ) in degrees
    #   structure.lattice.volume       → Volume in Å³
    #   structure.num_sites            → Total number of sites
    #   structure.species              → List of Species objects
    #   structure.get_neighbors(site, r=3.0)  → Nearest neighbors
    #
    # For a magnetic resonance / spin-bath model you might
    # combine the nuclear spin bath density, dipolar coupling
    # constants, and cluster expansion methods here.
    # ─────────────────────────────────────────────────────

    # Temporary stub: returns None so the frontend shows "—"
    return None


# ── Utility Helpers ───────────────────────────────────────────────────────────
def validate_upload(file: UploadFile, content: bytes) -> None:
    """Raise HTTPException if the file fails validation."""
    # Extension check
    suffix = Path(file.filename or "").suffix.lower()
    if suffix != ALLOWED_EXTENSION:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{suffix}'. Only {ALLOWED_EXTENSION} files are accepted.",
        )
    # Size check
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). "
                   f"Maximum allowed is {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB.",
        )
    # Non-empty check
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")


def parse_cif(content: bytes) -> Structure:
    """Parse raw CIF bytes → pymatgen Structure. Raises HTTPException on failure."""
    try:
        # Write to a temp file so CifParser can read it
        with tempfile.NamedTemporaryFile(suffix=".cif", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        parser = CifParser(tmp_path)
        structures = parser.parse_structures(primitive=False)

        if not structures:
            raise ValueError("CifParser returned no structures.")

        return structures[0]

    except (ValueError, KeyError, IndexError) as exc:
        logger.warning("CIF parse failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse CIF file: {str(exc)}. "
                   "Please ensure the file is a valid crystallographic information file.",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected CIF parse error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=422,
            detail="Unexpected error while parsing the CIF file. "
                   "Please check that it is a valid .cif structure.",
        ) from exc
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", summary="Health check")
async def root():
    return {"status": "ok", "service": "T₂ Calculator API", "version": "1.0.0"}


@app.get("/health", summary="Health check")
async def health():
    return {"status": "healthy"}


@app.post(
    "/compute",
    response_model=ComputeResponse,
    summary="Upload a CIF file and compute T₂",
    description=(
        "Accepts a .cif crystal structure file. "
        "Parses lattice parameters and atomic sites using pymatgen, "
        "then calls compute_T2() to return the spin coherence time."
    ),
)
async def compute(file: UploadFile = File(..., description="CIF structure file")):
    # ── Read & validate ───────────────────────────────────────────────────────
    content = await file.read()
    validate_upload(file, content)

    logger.info("Received file: %s (%d bytes)", file.filename, len(content))

    # ── Parse structure ───────────────────────────────────────────────────────
    structure = parse_cif(content)

    # ── Symmetry analysis ─────────────────────────────────────────────────────
    try:
        analyzer  = SpacegroupAnalyzer(structure)
        sym_data  = analyzer.get_symmetry_dataset()
        crystal_system  = analyzer.get_crystal_system()
        space_group     = analyzer.get_space_group_symbol()
        space_group_num = analyzer.get_space_group_number()
    except Exception as exc:
        logger.warning("Symmetry analysis failed (non-fatal): %s", exc)
        crystal_system  = "unknown"
        space_group     = "unknown"
        space_group_num = 0

    # ── Lattice parameters ────────────────────────────────────────────────────
    lattice = structure.lattice
    a, b, c             = lattice.abc
    alpha, beta, gamma  = lattice.angles
    volume              = lattice.volume

    # ── Density ───────────────────────────────────────────────────────────────
    try:
        density = structure.density
    except Exception:
        density = 0.0

    # ── Compute T₂ ────────────────────────────────────────────────────────────
    T2_value = compute_T2(structure)

    # ── Build response ────────────────────────────────────────────────────────
    response = ComputeResponse(
        chemical_formula    = structure.composition.formula,
        reduced_formula     = structure.composition.reduced_formula,
        num_atoms           = len(structure),
        num_sites           = structure.num_sites,
        lattice_parameters  = LatticeParameters(
            a=round(a, 6),
            b=round(b, 6),
            c=round(c, 6),
            alpha=round(alpha, 6),
            beta=round(beta, 6),
            gamma=round(gamma, 6),
            volume=round(volume, 6),
        ),
        crystal_system      = crystal_system,
        space_group         = space_group,
        space_group_number  = space_group_num,
        density             = round(density, 4),
        T2                  = T2_value,
        T2_unit             = "s",
    )

    logger.info(
        "Result: formula=%s, atoms=%d, T2=%s",
        response.chemical_formula,
        response.num_atoms,
        T2_value,
    )

    return response


# ── Error handlers ────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )
