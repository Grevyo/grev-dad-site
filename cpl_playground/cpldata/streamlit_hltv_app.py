from pathlib import Path
from html import escape

COMPETITION_LOGOS_DIR = Path("competition_logos")


def sanitize_filename(value: str) -> str:
    value = str(value).strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def find_competition_logo(competition_name: str):
    stems = []
    if competition_name:
        raw = str(competition_name).strip()
        safe = sanitize_filename(raw)
        stems.extend([raw, safe, safe.replace('-', '_')])

        words = [w for w in re.split(r"[^a-z0-9]+", safe) if w]
        stop_words = {
            "season", "stage", "championship", "league", "tournament",
            "qualifier", "qualifiers", "series", "cup", "open", "world",
            "ladder", "masters", "playoffs", "playoff", "contenders"
        }
        core_words = [w for w in words if w not in stop_words and not w.isdigit()]
        if core_words:
            stems.append("-".join(core_words))
            stems.append("_".join(core_words))
            if len(core_words) >= 2:
                stems.append("-".join(core_words[:2]))
                stems.append("_".join(core_words[:2]))
            stems.extend(core_words)

    # de-duplicate preserving order
    seen = set()
    ordered_stems = []
    for stem in stems:
        key = stem.lower()
        if stem and key not in seen:
            seen.add(key)
            ordered_stems.append(stem)

    exts = [".png", ".jpg", ".jpeg", ".webp", ".svg"]

    for stem in ordered_stems:
        for ext in exts:
            candidate = COMPETITION_LOGOS_DIR / f"{stem}{ext}"
            if candidate.exists() and candidate.is_file():
                return candidate

    # loose stem contains match against existing files
    if COMPETITION_LOGOS_DIR.exists():
        files = [p for p in COMPETITION_LOGOS_DIR.iterdir() if p.is_file() and p.suffix.lower() in exts]
        lowered = [s.lower() for s in ordered_stems]
        for file in files:
            stem = file.stem.lower()
            if any(s == stem or s in stem or stem in s for s in lowered if s):
                return file

        for fallback in ["CPL", "cpl"]:
            for ext in exts:
                candidate = COMPETITION_LOGOS_DIR / f"{fallback}{ext}"
                if candidate.exists() and candidate.is_file():
                    return candidate

    return None


def safe_render_image(image_path, use_container_width=True):
    try:
        if image_path is not None and Path(image_path).exists():
            st.image(str(image_path), use_container_width=use_container_width)
            return True
    except Exception:
        return False
    return False

import base64
import re

import pandas as pd
import numpy as np
import streamlit as st
import altair as alt

# -----------------------------
# Page config
# -----------------------------
st.set_page_config(
    page_title="Grev's CPL Profile Page",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# -----------------------------
# Constants
# -----------------------------
PLAYERS_PATH = Path("PlayerDataMatser.csv")
TACTICS_PATH = Path("TacticsDataMaster.csv")
ACHIEVEMENTS_PATH = Path("Achievements.csv")  # pipe-delimited

MY_TEAM_NAME = "ᴍᴇᴅɪꜱᴘᴏʀᴛꜱ ⓜ"
PLAYER_PREFIX = "ⓜ | "

PLAYER_PHOTOS_DIR = Path("player_photos")
TEAM_LOGOS_DIR = Path("team_logos")
MAP_IMAGES_DIR = Path("map_images")

# -----------------------------
# Styling
# -----------------------------
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&display=swap');

    .stApp {
        background: #0b0f14;
        color: #e5e7eb;
    }

    .block-container {
        max-width: 1820px;
        padding-top: 4.6rem;
        padding-bottom: 1rem;
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .main-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 2.1rem;
        font-weight: 900;
        color: #f8fafc;
        letter-spacing: 0.04em;
        margin-bottom: 0.15rem;
        line-height: 1.05;
    }

    .main-subtitle {
        color: #9ca3af;
        font-size: 0.92rem;
        margin-bottom: 0.9rem;
    }

    .top-filter-shell {
        background: linear-gradient(180deg, #121a26 0%, #0f141d 100%);
        border: 1px solid #243042;
        border-radius: 16px;
        padding: 14px 16px 10px 16px;
        margin-bottom: 14px;
    }

    .profile-header {
        background: linear-gradient(180deg, #121a26 0%, #0f141d 100%);
        border: 1px solid #243042;
        border-radius: 16px;
        padding: 18px 20px;
        margin-bottom: 14px;
    }

    .section-shell {
        background: linear-gradient(180deg, #121a26 0%, #0d131c 100%);
        border: 1px solid #1f2937;
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 14px;
    }

    .section-title {
        font-size: 1.08rem;
        font-weight: 900;
        color: #f8fafc;
        margin-bottom: 10px;
    }

    .subtle-title {
        font-size: 0.88rem;
        font-weight: 800;
        color: #d1d5db;
        margin-bottom: 8px;
    }

    .player-name-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.55rem;
        font-weight: 900;
        color: #f8fafc;
        letter-spacing: 0.02em;
        line-height: 1.05;
        margin-bottom: 0.25rem;
    }

    .player-hero-meta {
        color: #d1d5db;
        font-size: 1rem;
        margin-bottom: 8px;
    }

    .pill {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        border: 1px solid #374151;
        background: #111827;
        color: #d1d5db;
        font-size: 0.8rem;
        margin-right: 6px;
        margin-bottom: 6px;
    }

    .profile-box {
        background: #0b1220;
        border: 1px solid #1f2937;
        border-radius: 14px;
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        font-size: 0.95rem;
        overflow: hidden;
        text-align: center;
        padding: 8px;
    }

    .team-logo-box {
        background: #0b1220;
        border: 1px solid #1f2937;
        border-radius: 14px;
        min-height: 160px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        font-size: 0.9rem;
        overflow: hidden;
        text-align: center;
    }

    .metric-box {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 14px;
        padding: 12px 14px;
        min-height: 82px;
    }

    .metric-label {
        color: #9ca3af;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
    }

    .metric-value {
        color: #f8fafc;
        font-size: 1.4rem;
        font-weight: 800;
        line-height: 1.1;
    }

    .metric-godlike { color: #22c55e; }
    .metric-excellent { color: #84cc16; }
    .metric-good { color: #eab308; }
    .metric-average { color: #f59e0b; }
    .metric-bad { color: #f97316; }
    .metric-awful { color: #ef4444; }

    .slider-stat {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 14px;
        padding: 10px 12px;
        min-height: 94px;
    }

    .slider-stat-top {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        margin-bottom: 10px;
    }

    .slider-stat-label {
        color: #9ca3af;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
    }

    .slider-stat-value {
        font-size: 1.28rem;
        font-weight: 900;
        text-align: center;
        line-height: 1.1;
    }

    .slider-bar {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ef4444 0%, #f59e0b 30%, #eab308 50%, #84cc16 72%, #22c55e 100%);
        position: relative;
        border: 1px solid #374151;
    }

    .slider-thumb {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #f8fafc;
        border: 2px solid #111827;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 5px rgba(0,0,0,0.45);
    }

    .rating-gauge-wrap {
        background: #0b1220;
        border: 1px solid #1f2937;
        border-radius: 14px;
        padding: 12px 14px;
        margin-top: 10px;
    }

    .rating-gauge-label {
        color: #9ca3af;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 10px;
        text-align: center;
    }

    .rating-dial {
        width: 220px;
        height: 120px;
        margin: 0 auto 8px auto;
        position: relative;
        overflow: hidden;
    }

    .rating-dial-arc {
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: conic-gradient(from 180deg, #ef4444 0deg, #f59e0b 55deg, #eab308 90deg, #84cc16 125deg, #22c55e 180deg);
        position: absolute;
        top: 0;
        left: 0;
    }

    .rating-dial-inner {
        width: 172px;
        height: 172px;
        border-radius: 50%;
        background: #0f141d;
        position: absolute;
        top: 24px;
        left: 24px;
    }

    .rating-dial-needle {
        position: absolute;
        left: 50%;
        bottom: 6px;
        width: 3px;
        height: 84px;
        background: #f8fafc;
        transform-origin: bottom center;
        border-radius: 999px;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
    }

    .rating-dial-cap {
        position: absolute;
        left: 50%;
        bottom: 0px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #f8fafc;
        transform: translateX(-50%);
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
    }

    .rating-gauge-scale {
        display: flex;
        justify-content: space-between;
        color: #9ca3af;
        font-size: 0.75rem;
        margin-top: 4px;
    }

    .rating-badge {
        margin: 10px auto 0 auto;
        width: 120px;
        text-align: center;
        border-radius: 12px;
        padding: 10px 12px;
        font-weight: 900;
        font-size: 1.2rem;
        border: 1px solid rgba(255,255,255,0.12);
    }

    .bg-godlike { background: #166534; color: #f8fafc; }
    .bg-excellent { background: #3f6212; color: #f8fafc; }
    .bg-good { background: #854d0e; color: #f8fafc; }
    .bg-average { background: #9a3412; color: #f8fafc; }
    .bg-bad { background: #9a3412; color: #f8fafc; }
    .bg-awful { background: #991b1b; color: #f8fafc; }

.header-achievements-title {
    font-size: 0.82rem;
    font-weight: 800;
    color: #d1d5db;
    margin-top: 2px;
    margin-bottom: 0;
}

.achievement-wrap-fixed {
    min-height: 78px;
    max-height: 78px;
    display: block;
    overflow: hidden;
    margin-top: 0;
    margin-bottom: 0;
}

.achievement-wrap-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-start;
    margin-top: 4px;
    margin-bottom: 0;
}

.achievement-empty {
    width: 100%;
    height: 70px;
    border: 1px dashed #243042;
    border-radius: 12px;
    background: rgba(11,18,32,0.25);
}

.achievement-inline-card,
.achievement-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
    padding: 0;
    margin: 0;
    width: 72px;
    min-width: 72px;
    max-width: 72px;
    box-sizing: border-box;
}

    .achievement-image-wrap {
        position: relative;
        width: 70px;
        height: 70px;
        margin: 0 auto;
    }

    .achievement-tier-overlay {
        position: absolute;
        left: 2px;
        bottom: 12px;
        z-index: 6;
    }

    .achievement-position-overlay {
        position: absolute;
        right: 2px;
        bottom: 12px;
        z-index: 6;
    }

    .achievement-season-overlay {
        position: absolute;
        top: -3px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 7;
        background: rgba(11, 15, 20, 0.88);
        color: #f8fafc;
        padding: 1px 4px;
        border-radius: 999px;
        font-size: 0.60rem;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
    }

    .achievement-title-overlay {
        position: absolute;
        bottom: -3px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 7;
        background: rgba(11, 15, 20, 0.88);
        color: #f8fafc;
        padding: 1px 4px;
        border-radius: 999px;
        font-size: 0.60rem;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
    }

    .achievement-missing {
        color: #6b7280;
        font-size: 0.48rem;
        text-align: center;
        padding-top: 24px;
    }

    .tier-pill,
    .position-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 2px 4px;
        border-radius: 999px;
        font-size: 0.46rem;
        font-weight: 900;
        border: 1px solid rgba(255,255,255,0.12);
        line-height: 1;
    }

    .tier-s { background: #7c5b12 !important; color: #fbbf24 !important; }
    .tier-a { background: #581c87 !important; color: #e9d5ff !important; }
    .tier-b { background: #1e3a8a !important; color: #93c5fd !important; }
    .tier-c { background: #14532d !important; color: #86efac !important; }
    .tier-open { background: #9a3412 !important; color: #fdba74 !important; }

    .position-pill { background: rgba(11, 15, 20, 0.92); }
    .position-gold { color: #fbbf24; }
    .position-silver { color: #d1d5db; }
    .position-bronze { color: #d97706; }
    .position-other { color: #f8fafc; }

    .tactic-row {
        background: #0b1220;
        border: 1px solid #1f2937;
        border-radius: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
    }

    .tactic-name {
        font-weight: 700;
        margin-bottom: 6px;
    }

    .small-note {
        color: #9ca3af;
        font-size: 0.8rem;
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        margin-bottom: 6px;
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 10px;
    }

    .info-label {
        color: #9ca3af;
        font-weight: 700;
    }

    .info-value {
        color: #f8fafc;
        font-weight: 800;
        text-align: right;
    }

    .map-card {
        background: #0b1220;
        border: 1px solid #1f2937;
        border-radius: 14px;
        overflow: hidden;
        margin-bottom: 10px;
        padding-top: 10px;
    }

    .map-card-title {
        padding: 8px 10px;
        background: #111827;
        border-top: 1px solid #1f2937;
        color: #f8fafc;
        font-weight: 900;
        text-align: center;
        margin-top: 8px;
    }

    .import-shell {
        position: sticky;
        bottom: 8px;
        background: linear-gradient(180deg, #121a26 0%, #0d131c 100%);
        border: 1px solid #1f2937;
        border-radius: 16px;
        padding: 12px 14px;
    }

    .import-title {
        font-size: 0.95rem;
        font-weight: 900;
        color: #f8fafc;
        margin-bottom: 8px;
    }

    div[data-testid="stSidebar"] {
        display: none;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Helpers
# -----------------------------
STAT_ICONS = {
    "Kills": "🔫",
    "Deaths": "☠️",
    "Dpm": "💥",
    "Mvps": "🏅",
    "Acc%": "🎯",
    "Matches": "🗂️",
    "Kd": "⚖️",
    "Kpr": "📈",
    "Adr": "🔥",
    "Impact": "🚀",
    "Hs%": "🧠",
    "Kpm": "⚡",
    "Rating": "⭐",
    "Tactic Matches": "🗂️",
    "Round Wins": "✅",
    "Round Losses": "❌",
    "Win Rate%": "📊",
    "Players Used": "👥",
    "Team Matches": "📋",
}

MAP_PALETTE = {
    "train": "#60a5fa",
    "castle": "#a78bfa",
    "dustline": "#f59e0b",
    "mill": "#34d399",
}

SIDE_PALETTE = {
    "red": "#ef4444",
    "blue": "#3b82f6",
}

def pretty_label(text: str) -> str:
    if text is None:
        return ""
    text = str(text).strip().replace("_", " ")
    text = " ".join(text.split())
    return text.title()

def stat_label_with_icon(label: str) -> str:
    icon = STAT_ICONS.get(label, "•")
    return f"{icon} {label}"

def clean_player_name(name: str) -> str:
    text = " ".join(str(name).strip().split())
    if text.startswith(PLAYER_PREFIX):
        text = text[len(PLAYER_PREFIX):].strip()
    text = re.sub(r"^[^A-Za-z0-9]*\|\s*", "", text)
    return text.casefold()

def clean_path_string(value: str) -> str:
    text = str(value).strip()
    return text.strip('"').strip("'")

def add_competition_group_column(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "competition" not in out.columns:
        out["competition"] = ""

    def _competition_group(value: str) -> str:
        text = str(value).strip()
        if not text:
            return "Unknown Competition"

        upper = text.upper()

        season_match = re.search(r"(?:SEASON\s*|S)(\d+)", upper)
        season_code = f"S{season_match.group(1)}" if season_match else ""

        if "CPL OPEN" in upper:
            return f"CPL Open {season_code}".strip() if season_code else "CPL Open"
        if "CPL WORLD LADDER" in upper:
            return f"CPL World Ladder {season_code}".strip() if season_code else "CPL World Ladder"
        if "CYBER X" in upper:
            return f"Cyber X {season_code}".strip() if season_code else "Cyber X"
        if "PUBMASTERS" in upper:
            return f"Pubmasters {season_code}".strip() if season_code else "Pubmasters"
        if "EMERALD LEAGUE" in upper:
            return text
        if "EPSYLUM OPEN QUALIFIER" in upper:
            return f"Epsylum Open Qualifier {season_code}".strip() if season_code else "Epsylum Open Qualifier"
        if "EPSYLUM SERIES" in upper:
            return f"Epsylum Series {season_code}".strip() if season_code else "Epsylum Series"
        return text

    out["competition_group"] = out["competition"].apply(_competition_group)
    return out

def unique_sorted(df: pd.DataFrame, column: str):
    if df.empty or column not in df.columns:
        return []
    vals = [v for v in df[column].dropna().astype(str).unique().tolist() if v != ""]
    return sorted(vals)

def fmt_num(val, digits=0):
    if pd.isna(val):
        return "-"
    if digits == 0:
        return f"{int(round(float(val)))}"
    return f"{float(val):.{digits}f}"

def find_image_file(base_dir: Path, base_name: str):
    if not base_name:
        return None
    raw = str(base_name).strip()
    for ext in ["png", "jpg", "jpeg", "webp"]:
        candidate = base_dir / f"{raw}.{ext}"
        if candidate.exists():
            return candidate
    return None

def find_map_image(map_name: str):
    if not map_name:
        return None
    candidate = MAP_IMAGES_DIR / f"{str(map_name).strip().lower()}.png"
    if candidate.exists():
        return candidate
    return None

def image_to_base64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("utf-8")

def extract_season_number(value):
    text = str(value).strip().upper()
    if not text:
        return pd.NA
    match = re.search(r"S(\d+)", text)
    if match:
        return int(match.group(1))
    match = re.search(r"SEASON\s+(\d+)", text)
    if match:
        return int(match.group(1))
    return pd.NA

def apply_date_filter(df: pd.DataFrame, mode: str, date_from=None, date_to=None) -> pd.DataFrame:
    if df.empty or "date" not in df.columns:
        return df

    out = df.copy()
    out["_filter_date"] = pd.to_datetime(out["date"], errors="coerce")

    if mode == "After Date" and date_from:
        out = out[out["_filter_date"] >= pd.to_datetime(date_from)]
    elif mode == "Before Date" and date_to:
        out = out[out["_filter_date"] <= pd.to_datetime(date_to)]
    elif mode == "Between Dates" and date_from and date_to:
        start = pd.to_datetime(date_from)
        end = pd.to_datetime(date_to)
        out = out[(out["_filter_date"] >= start) & (out["_filter_date"] <= end)]

    return out.drop(columns=["_filter_date"], errors="ignore")

# -----------------------------
# Metric helpers
# -----------------------------
def metric_class_for_value(label: str, value) -> str:
    if value is None or pd.isna(value):
        return "metric-average"

    label = str(label).lower()
    v = float(value)

    if label == "rating":
        if v >= 1.12: return "metric-godlike"
        if v >= 1.03: return "metric-excellent"
        if v >= 0.97: return "metric-good"
        if v >= 0.88: return "metric-average"
        if v >= 0.78: return "metric-bad"
        return "metric-awful"

    if label == "kd":
        if v >= 1.25: return "metric-godlike"
        if v >= 1.10: return "metric-excellent"
        if v >= 0.98: return "metric-good"
        if v >= 0.90: return "metric-average"
        if v >= 0.80: return "metric-bad"
        return "metric-awful"

    if label == "kpr":
        if v >= 0.95: return "metric-godlike"
        if v >= 0.80: return "metric-excellent"
        if v >= 0.68: return "metric-good"
        if v >= 0.58: return "metric-average"
        if v >= 0.48: return "metric-bad"
        return "metric-awful"

    if label == "adr":
        if v >= 95: return "metric-godlike"
        if v >= 82: return "metric-excellent"
        if v >= 68: return "metric-good"
        if v >= 58: return "metric-average"
        if v >= 48: return "metric-bad"
        return "metric-awful"

    if label == "impact":
        if v >= 1.8: return "metric-godlike"
        if v >= 1.0: return "metric-excellent"
        if v >= 0.3: return "metric-good"
        if v >= -0.1: return "metric-average"
        if v >= -0.6: return "metric-bad"
        return "metric-awful"

    if label == "hs%":
        if v >= 58: return "metric-godlike"
        if v >= 48: return "metric-excellent"
        if v >= 38: return "metric-good"
        if v >= 30: return "metric-average"
        if v >= 22: return "metric-bad"
        return "metric-awful"

    if label == "acc%":
        if v >= 55: return "metric-godlike"
        if v >= 46: return "metric-excellent"
        if v >= 36: return "metric-good"
        if v >= 28: return "metric-average"
        if v >= 20: return "metric-bad"
        return "metric-awful"

    if label == "win rate%":
        if v >= 70: return "metric-godlike"
        if v >= 60: return "metric-excellent"
        if v >= 50: return "metric-good"
        if v >= 40: return "metric-average"
        if v >= 30: return "metric-bad"
        return "metric-awful"

    return "metric-good"

def metric_bg_class_from_value(label, value):
    return metric_class_for_value(label, value).replace("metric-", "bg-")

def metric_card(label, value, raw_value=None):
    numeric_value = raw_value if raw_value is not None else value
    css_class = metric_class_for_value(label, numeric_value)
    pretty = stat_label_with_icon(label)
    st.markdown(
        f"""
        <div class='metric-box'>
            <div class='metric-label'>{pretty}</div>
            <div class='metric-value {css_class}'>{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def stat_slider_percent(label: str, value: float) -> float:
    label = str(label).lower()
    v = float(value)
    ranges = {
        "kd": (0.5, 1.5),
        "kpr": (0.3, 1.0),
        "adr": (30, 100),
        "impact": (-3.5, 2.0),
        "hs%": (10, 60),
        "acc%": (10, 60),
        "dpm": (100, 800),
        "kpm": (5, 30),
    }
    low, high = ranges.get(label, (0, 100))
    pct = ((v - low) / (high - low)) * 100 if high != low else 50
    return max(0.0, min(100.0, pct))

def slider_metric_card(label, value_str, raw_value):
    css_class = metric_class_for_value(label, raw_value)
    pct = stat_slider_percent(label, raw_value)
    pretty = stat_label_with_icon(label)
    st.markdown(
        f"""
        <div class='slider-stat'>
            <div class='slider-stat-top'>
                <div class='slider-stat-label'>{pretty}</div>
                <div class='slider-stat-value {css_class}'>{value_str}</div>
            </div>
            <div class='slider-bar'>
                <div class='slider-thumb' style='left:{pct}%;'></div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def calculate_player_metrics(player_df: pd.DataFrame) -> dict:
    if player_df.empty:
        return {
            "matches": 0, "kills": 0, "deaths": 0, "damage": 0, "rounds_played": 0,
            "mvps": 0, "kd": 0.0, "kpr": 0.0, "adr": 0.0, "dpm": 0.0,
            "kpm": 0.0, "impact": 0.0, "rating": 0.0, "hs_pct": 0.0, "accuracy_pct": 0.0,
        }

    matches = player_df["match_id"].nunique() if "match_id" in player_df.columns else 0
    kills = pd.to_numeric(player_df.get("kills", 0), errors="coerce").fillna(0).sum()
    deaths = pd.to_numeric(player_df.get("deaths", 0), errors="coerce").fillna(0).sum()
    damage = pd.to_numeric(player_df.get("damage", 0), errors="coerce").fillna(0).sum()
    rounds_played = pd.to_numeric(player_df.get("rounds_played", 0), errors="coerce").fillna(0).sum()
    mvps = pd.to_numeric(player_df.get("mvps", 0), errors="coerce").fillna(0).sum()
    hs_pct = pd.to_numeric(player_df.get("hs_pct", 0), errors="coerce").mean()
    accuracy_pct = pd.to_numeric(player_df.get("accuracy_pct", 0), errors="coerce").mean()

    kd = kills / deaths if deaths else float(kills)
    kpr = kills / rounds_played if rounds_played else 0.0
    dpr = deaths / rounds_played if rounds_played else 0.0
    adr = damage / rounds_played if rounds_played else 0.0
    dpm = damage / matches if matches else 0.0
    kpm = kills / matches if matches else 0.0
    impact = (kpr - dpr) * 10

    rating = (
        (kpr * 0.30)
        + ((adr / 100) * 0.25)
        + (kd * 0.20)
        + ((impact / 10) * 0.15)
        + ((0.0 if pd.isna(hs_pct) else hs_pct) / 100 * 0.10)
    )

    return {
        "matches": matches,
        "kills": kills,
        "deaths": deaths,
        "damage": damage,
        "rounds_played": rounds_played,
        "mvps": mvps,
        "kd": kd,
        "kpr": kpr,
        "adr": adr,
        "dpm": dpm,
        "kpm": kpm,
        "impact": impact,
        "rating": rating,
        "hs_pct": 0.0 if pd.isna(hs_pct) else hs_pct,
        "accuracy_pct": 0.0 if pd.isna(accuracy_pct) else accuracy_pct,
    }

def rating_angle(rating: float) -> float:
    low, high = 0.50, 1.50
    clamped = max(low, min(high, float(rating)))
    pct = (clamped - low) / (high - low)
    return -90 + (pct * 180)

def render_rating_gauge(rating: float):
    angle = rating_angle(rating)
    bg_class = metric_bg_class_from_value("rating", rating)
    css_class = metric_class_for_value("rating", rating)

    st.markdown(
        f"""
        <div class='rating-gauge-wrap'>
            <div class='rating-gauge-label'>Rating Meter</div>
            <div class='rating-dial'>
                <div class='rating-dial-arc'></div>
                <div class='rating-dial-inner'></div>
                <div class='rating-dial-needle' style='transform: translateX(-50%) rotate({angle}deg);'></div>
                <div class='rating-dial-cap'></div>
            </div>
            <div class='rating-badge {bg_class}'>{rating:.2f}</div>
            <div class='rating-gauge-scale'>
                <span>0.50</span>
                <span class='{css_class}' style='font-weight:700;'>1.00</span>
                <span>1.50</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# -----------------------------
# Normalization / loading
# -----------------------------
def normalize_players(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    numeric_cols = [
        "kills", "deaths", "mvps", "kpd", "accuracy_pct", "hs_pct",
        "damage", "rounds_played"
    ]
    for col in numeric_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")

    for col in [
        "match_id", "competition", "map", "my_team", "opponent_team",
        "player", "tier", "date", "time"
    ]:
        if col not in out.columns:
            out[col] = ""

    out["match_id"] = out["match_id"].fillna("").astype(str).str.strip()
    out["tier"] = out["tier"].fillna("").astype(str).str.strip()
    out = add_competition_group_column(out)
    return out

def normalize_tactics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    numeric_cols = ["wins", "losses", "total_rounds", "win_rate_pct"]
    for col in numeric_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")

    for col in [
        "match_id", "competition", "map", "my_team", "opponent_team",
        "side", "tier", "tactic_name", "date", "time"
    ]:
        if col not in out.columns:
            out[col] = ""

    out["match_id"] = out["match_id"].fillna("").astype(str).str.strip()
    out["tier"] = out["tier"].fillna("").astype(str).str.strip()
    out = add_competition_group_column(out)
    return out

def normalize_achievements(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(c).strip() for c in out.columns]

    for col in out.columns:
        if out[col].dtype == object:
            out[col] = out[col].fillna("").astype(str).str.strip()

    return out

def build_match_summary(players: pd.DataFrame, tactics: pd.DataFrame) -> pd.DataFrame:
    parts = []

    if not players.empty:
        p = players.copy()
        p["team"] = p["my_team"] if "my_team" in p.columns else ""
        keep_cols = [c for c in [
            "match_id", "date", "time", "map", "competition",
            "team", "opponent_team", "tier", "rounds_played"
        ] if c in p.columns]
        if keep_cols:
            p = p[keep_cols].drop_duplicates(subset=["match_id"])
            parts.append(p)

    if not tactics.empty:
        t = tactics.copy()
        keep_cols = [c for c in [
            "match_id", "date", "time", "map", "competition",
            "my_team", "opponent_team", "tier"
        ] if c in t.columns]
        if keep_cols:
            t = t[keep_cols].drop_duplicates(subset=["match_id"])
            parts.append(t)

    if not parts:
        return pd.DataFrame()

    matches = pd.concat(parts, ignore_index=True).drop_duplicates(subset=["match_id"], keep="first")

    if not players.empty and {"match_id", "kills", "deaths", "damage", "mvps", "player"}.issubset(players.columns):
        agg = players.groupby("match_id", as_index=False).agg(
            total_kills=("kills", "sum"),
            total_deaths=("deaths", "sum"),
            total_damage=("damage", "sum"),
            total_mvps=("mvps", "sum"),
            players_used=("player", "nunique"),
        )
        matches = matches.merge(agg, on="match_id", how="left")

    sort_cols = [c for c in ["date", "time"] if c in matches.columns]
    if sort_cols:
        matches = matches.sort_values(sort_cols, ascending=[False] * len(sort_cols))

    return matches

@st.cache_data
def load_standard_csv(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        return pd.DataFrame()
    try:
        df = pd.read_csv(p)
        df.columns = [str(c).strip() for c in df.columns]
        return df
    except Exception:
        return pd.DataFrame()

@st.cache_data
def load_achievements_csv(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        return pd.DataFrame()

    for kwargs in [
        {"sep": "|"},
        {"sep": None, "engine": "python"},
        {},
    ]:
        try:
            df = pd.read_csv(p, **kwargs)
            df.columns = [str(c).strip() for c in df.columns]
            if not df.empty or len(df.columns) > 1:
                return df
        except Exception:
            pass

    return pd.DataFrame()

@st.cache_data
def load_data(players_path: str, tactics_path: str, achievements_path: str):
    players = load_standard_csv(players_path)
    tactics = load_standard_csv(tactics_path)
    achievements = load_achievements_csv(achievements_path)

    if not players.empty:
        players = normalize_players(players)
    if not tactics.empty:
        tactics = normalize_tactics(tactics)
    if not achievements.empty:
        achievements = normalize_achievements(achievements)

    if not players.empty and not tactics.empty and "match_id" in players.columns and "match_id" in tactics.columns:
        player_lookup_cols = [c for c in [
            "match_id", "competition", "competition_group", "map", "my_team",
            "opponent_team", "tier", "date", "time"
        ] if c in players.columns]

        if player_lookup_cols:
            player_lookup = players[player_lookup_cols].copy()
            player_lookup["match_id"] = player_lookup["match_id"].fillna("").astype(str).str.strip()
            player_lookup = player_lookup.sort_values([c for c in ["date", "time"] if c in player_lookup.columns])
            player_lookup = player_lookup.drop_duplicates(subset=["match_id"], keep="last")

            tactics["match_id"] = tactics["match_id"].fillna("").astype(str).str.strip()
            tactics = tactics.merge(player_lookup, on="match_id", how="left", suffixes=("", "_player_lookup"))

            for col in ["competition", "competition_group", "map", "my_team", "opponent_team", "tier", "date", "time"]:
                lookup_col = f"{col}_player_lookup"
                if lookup_col in tactics.columns:
                    current = tactics[col].fillna("").astype(str).str.strip() if col in tactics.columns else ""
                    lookup = tactics[lookup_col].fillna("").astype(str).str.strip()
                    tactics[col] = np.where(current != "", current, lookup)
                    tactics.drop(columns=[lookup_col], inplace=True)

            if "tier" in tactics.columns:
                tactics["tier"] = tactics["tier"].fillna("").astype(str).str.strip()

            if "competition" in tactics.columns and "competition_group" not in tactics.columns:
                tactics = add_competition_group_column(tactics)

    matches = build_match_summary(players, tactics)
    return players, tactics, matches, achievements

# -----------------------------
# Achievements
# -----------------------------
def resolve_achievement_image_path(raw_link: str):
    raw_link = clean_path_string(raw_link)
    if not raw_link:
        return None

    candidate = Path(raw_link).expanduser()
    base_dirs = []

    try:
        base_dirs.append(Path(__file__).resolve().parent)
    except NameError:
        pass

    try:
        base_dirs.append(Path.cwd())
    except Exception:
        pass

    seen = set()
    ordered_base_dirs = []
    for base_dir in base_dirs:
        key = str(base_dir)
        if key not in seen:
            seen.add(key)
            ordered_base_dirs.append(base_dir)

    candidates = []
    if candidate.is_absolute():
        candidates.append(candidate)
    else:
        candidates.append(candidate)
        for base_dir in ordered_base_dirs:
            candidates.append((base_dir / candidate).resolve())

    seen = set()
    ordered_candidates = []
    for item in candidates:
        key = str(item)
        if key not in seen:
            seen.add(key)
            ordered_candidates.append(item)

    for item in ordered_candidates:
        if item.exists() and item.is_file():
            return item

    return None


def get_player_achievements(player_name: str, achievements_df: pd.DataFrame) -> list[dict]:
    if achievements_df.empty:
        return []

    cols = {str(c).strip().lower(): c for c in achievements_df.columns}

    def first_existing(*names):
        for name in names:
            col = cols.get(name)
            if col is not None:
                return col
        return None

    player_col = first_existing("player", "player_name", "name")
    if player_col is None:
        return []

    target_exact = str(player_name).strip()
    target_clean = clean_player_name(player_name)

    temp = achievements_df.copy()
    temp["_player_exact"] = temp[player_col].astype(str).str.strip()
    temp["_player_clean"] = temp[player_col].astype(str).apply(clean_player_name)

    player_rows = temp[temp["_player_exact"] == target_exact]
    if player_rows.empty:
        player_rows = temp[temp["_player_clean"] == target_clean]
    if player_rows.empty:
        prefixed_target = f"{PLAYER_PREFIX}{target_exact}".strip()
        player_rows = temp[temp["_player_exact"] == prefixed_target]
    if player_rows.empty:
        return []

    def parse_long_rows(rows: pd.DataFrame) -> list[dict]:
        title_col = first_existing("achievement_name", "title", "achievement", "achievement_title", "name")
        link_col = first_existing("achievement_link", "link", "image", "image_path", "achievement_image", "achievement_icon")
        tier_col = first_existing("achievement_tier", "tier")
        season_col = first_existing("season_name", "season", "achievement_season")
        position_col = first_existing("position", "place", "placement", "finish")

        if not any(col is not None for col in [title_col, link_col, tier_col, season_col, position_col]):
            return []

        found = []
        for _, row in rows.iterrows():
            title = str(row[title_col]).strip() if title_col and pd.notna(row[title_col]) else ""
            link = clean_path_string(row[link_col]) if link_col and pd.notna(row[link_col]) else ""
            tier = str(row[tier_col]).strip().upper() if tier_col and pd.notna(row[tier_col]) else ""
            season = str(row[season_col]).strip() if season_col and pd.notna(row[season_col]) else ""
            position = str(row[position_col]).strip() if position_col and pd.notna(row[position_col]) else ""

            if title or link or tier or season or position:
                found.append({
                    "title": title,
                    "link": link,
                    "tier": tier,
                    "season": season,
                    "position": position,
                })
        return found

    def parse_wide_row(row: pd.Series) -> list[dict]:
        found = []
        i = 1
        while True:
            title_col = first_existing(f"achievement_name{i}", f"title{i}", f"achievement{i}", f"achievement_title{i}")
            link_col = first_existing(f"achievement_link{i}", f"link{i}", f"image{i}", f"image_path{i}", f"achievement_image{i}", f"achievement_icon{i}")
            tier_col = first_existing(f"achievement_tier{i}", f"tier{i}")
            season_col = first_existing(f"season_name{i}", f"season{i}", f"achievement_season{i}")
            position_col = first_existing(f"position{i}", f"place{i}", f"placement{i}", f"finish{i}")

            if all(x is None for x in [title_col, link_col, tier_col, season_col, position_col]):
                break

            title = str(row[title_col]).strip() if title_col and pd.notna(row[title_col]) else ""
            link = clean_path_string(row[link_col]) if link_col and pd.notna(row[link_col]) else ""
            tier = str(row[tier_col]).strip().upper() if tier_col and pd.notna(row[tier_col]) else ""
            season = str(row[season_col]).strip() if season_col and pd.notna(row[season_col]) else ""
            position = str(row[position_col]).strip() if position_col and pd.notna(row[position_col]) else ""

            if title or link or tier or season or position:
                found.append({
                    "title": title,
                    "link": link,
                    "tier": tier,
                    "season": season,
                    "position": position,
                })
            i += 1

        return found

    achievements = parse_long_rows(player_rows)
    if not achievements:
        achievements = parse_wide_row(player_rows.iloc[0])

    def season_sort_key(value: str):
        text = str(value).strip().upper()
        m = re.search(r"S(\d+)", text)
        if m:
            return int(m.group(1))
        m = re.search(r"SEASON\s*(\d+)", text)
        if m:
            return int(m.group(1))
        return -1

    deduped = []
    seen = set()
    for ach in achievements:
        key = (
            str(ach.get("title", "")).strip().casefold(),
            str(ach.get("season", "")).strip().casefold(),
            str(ach.get("tier", "")).strip().casefold(),
            str(ach.get("position", "")).strip().casefold(),
            str(ach.get("link", "")).strip().casefold(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(ach)

    deduped.sort(key=lambda a: (season_sort_key(a.get("season", "")), a.get("title", "").casefold()), reverse=True)
    return deduped

def tier_class(tier: str) -> str:
    val = str(tier).strip().lower()
    if val == "s":
        return "tier-s"
    if val == "a":
        return "tier-a"
    if val == "b":
        return "tier-b"
    if val == "c":
        return "tier-c"
    return "tier-open"


def tier_badge_html(tier: str) -> str:
    val = str(tier).strip().upper()
    if not val:
        return ""
    if val == "OPEN":
        return "<span class='tier-pill tier-open'>🚪 OPEN</span>"
    return f"<span class='tier-pill {tier_class(val)}'>{escape(val)}</span>"


def position_class(position: str) -> str:
    val = str(position).strip().lower()
    if val == "1st":
        return "position-gold"
    if val == "2nd":
        return "position-silver"
    if val == "3rd":
        return "position-bronze"
    return "position-other"


def position_badge_html(position: str) -> str:
    val = str(position).strip()
    if not val:
        return ""
    return f"<span class='position-pill {position_class(val)}'>{escape(val)}</span>"


def build_achievement_card_html(achievement: dict) -> str:
    path = resolve_achievement_image_path(achievement.get("link", ""))
    badge_html = tier_badge_html(achievement.get("tier", ""))
    position_html = position_badge_html(achievement.get("position", ""))
    title = escape(str(achievement.get("title", "")).strip())
    season = escape(str(achievement.get("season", "")).strip())

    if path and path.exists():
        img_b64 = image_to_base64(path)
        suffix = path.suffix.lower()
        mime = "image/png"
        if suffix in {".jpg", ".jpeg"}:
            mime = "image/jpeg"
        elif suffix == ".webp":
            mime = "image/webp"
        elif suffix == ".svg":
            mime = "image/svg+xml"
        image_html = (
            f"<img src='data:{mime};base64,{img_b64}' width='70' height='70' "
            f"style='display:block; object-fit:contain; margin:0 auto;' />"
        )
    else:
        image_html = "<div class='achievement-missing'>Missing</div>"

    season_html = f"<div class='achievement-season-overlay'>{season}</div>" if season else ""
    title_html = f"<div class='achievement-title-overlay'>{title}</div>" if title else ""
    tier_overlay = f"<div class='achievement-tier-overlay'>{badge_html}</div>" if badge_html else ""
    position_overlay = f"<div class='achievement-position-overlay'>{position_html}</div>" if position_html else ""

    return (
        "<div class='achievement-inline-card'>"
        "<div class='achievement-image-wrap'>"
        + image_html
        + season_html
        + title_html
        + tier_overlay
        + position_overlay
        + "</div>"
        + "</div>"
    )


def render_header_achievements(player_name: str, achievements_df: pd.DataFrame):
    achievements = get_player_achievements(player_name, achievements_df)

    st.markdown("<div class='header-achievements-title'>Achievements</div>", unsafe_allow_html=True)

    if not achievements:
        st.markdown("<div class='achievement-wrap-compact'><div class='achievement-empty'></div></div>", unsafe_allow_html=True)
        return

    cards_html = [build_achievement_card_html(ach) for ach in achievements[:8]]

    st.markdown(
        "<div class='achievement-wrap-compact'>" + "".join(cards_html) + "</div>",
        unsafe_allow_html=True,
    )

# -----------------------------
# Performance summaries
# -----------------------------
def build_match_perf(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "match_id" not in df.columns:
        return pd.DataFrame()

    out = df.groupby("match_id", as_index=False).agg(
        date=("date", "first"),
        time=("time", "first"),
        competition=("competition", "first"),
        map=("map", "first"),
        opponent_team=("opponent_team", "first"),
        tier=("tier", "first"),
        kills=("kills", "sum"),
        deaths=("deaths", "sum"),
        damage=("damage", "sum"),
        mvps=("mvps", "sum"),
        rounds=("rounds_played", "sum"),
        hs_pct=("hs_pct", "mean"),
        accuracy_pct=("accuracy_pct", "mean"),
    )

    out["kd"] = (out["kills"] / out["deaths"].replace(0, pd.NA)).fillna(out["kills"])
    out["kda"] = ((out["kills"] + out["mvps"]) / out["deaths"].replace(0, pd.NA)).fillna(out["kills"] + out["mvps"])
    out["adr"] = (out["damage"] / out["rounds"].replace(0, pd.NA)).fillna(0)
    out["kpr"] = (out["kills"] / out["rounds"].replace(0, pd.NA)).fillna(0)
    out["impact"] = ((out["kills"] - out["deaths"]) / out["rounds"].replace(0, pd.NA) * 10).fillna(0)
    out["rating"] = (
        (out["kpr"] * 0.30)
        + ((out["adr"] / 100) * 0.25)
        + (out["kd"] * 0.20)
        + ((out["impact"] / 10) * 0.15)
        + ((out["hs_pct"].fillna(0)) / 100 * 0.10)
    )
    return out

def build_comp_perf(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "competition" not in df.columns:
        return pd.DataFrame()

    out = df.groupby("competition", as_index=False).agg(
        matches=("match_id", "nunique"),
        kills=("kills", "sum"),
        deaths=("deaths", "sum"),
        damage=("damage", "sum"),
        mvps=("mvps", "sum"),
        rounds=("rounds_played", "sum"),
        hs_pct=("hs_pct", "mean"),
        accuracy_pct=("accuracy_pct", "mean"),
        top_map=("map", lambda s: s.mode().iloc[0] if not s.mode().empty else ""),
    )

    out["kd"] = (out["kills"] / out["deaths"].replace(0, pd.NA)).fillna(out["kills"])
    out["kda"] = ((out["kills"] + out["mvps"]) / out["deaths"].replace(0, pd.NA)).fillna(out["kills"] + out["mvps"])
    out["adr"] = (out["damage"] / out["rounds"].replace(0, pd.NA)).fillna(0)
    out["kpr"] = (out["kills"] / out["rounds"].replace(0, pd.NA)).fillna(0)
    out["impact"] = ((out["kills"] - out["deaths"]) / out["rounds"].replace(0, pd.NA) * 10).fillna(0)
    out["rating"] = (
        (out["kpr"] * 0.30)
        + ((out["adr"] / 100) * 0.25)
        + (out["kd"] * 0.20)
        + ((out["impact"] / 10) * 0.15)
        + ((out["hs_pct"].fillna(0)) / 100 * 0.10)
    )
    return out

# -----------------------------
# Filtered data
# -----------------------------
def get_player_options(players: pd.DataFrame):
    if players.empty or "player" not in players.columns:
        return []

    rows = players[players["player"].astype(str).str.startswith(PLAYER_PREFIX, na=False)].copy()
    if rows.empty:
        return []

    if "date" not in rows.columns:
        return unique_sorted(rows, "player")

    date_text = rows["date"].astype(str).str.strip()

    if "time" in rows.columns:
        time_text = rows["time"].astype(str).str.strip()
        rows["_last_played"] = pd.to_datetime(
            date_text + " " + time_text,
            errors="coerce",
            dayfirst=False,
        )
    else:
        rows["_last_played"] = pd.to_datetime(date_text, errors="coerce", dayfirst=False)

    latest = (
        rows.groupby("player", as_index=False)["_last_played"]
        .max()
        .sort_values(["_last_played", "player"], ascending=[False, True], na_position="last")
    )

    return latest["player"].astype(str).tolist()

def apply_top_filters(players: pd.DataFrame, tactics: pd.DataFrame, selected_player: str | None,
                      selected_comp, selected_map, selected_tier, selected_opp, selected_side,
                      date_mode, date_from, date_to):
    if not players.empty and "player" in players.columns:
        player_rows = players[
            players["player"].astype(str).str.startswith(PLAYER_PREFIX, na=False)
        ].copy()
    else:
        player_rows = pd.DataFrame(columns=["player"])

    if not tactics.empty and "my_team" in tactics.columns:
        team_tactics = tactics[
            tactics["my_team"].astype(str).str.strip() == MY_TEAM_NAME
        ].copy()
    else:
        team_tactics = pd.DataFrame()

    fp = player_rows.copy()
    ft = team_tactics.copy()

    if selected_player and not fp.empty:
        fp = fp[fp["player"] == selected_player]

    if not fp.empty:
        if selected_comp:
            fp = fp[fp["competition"].isin(selected_comp)]
        if selected_map:
            fp = fp[fp["map"].isin(selected_map)]
        if selected_tier:
            fp = fp[fp["tier"].isin(selected_tier)]
        if selected_opp:
            fp = fp[fp["opponent_team"].isin(selected_opp)]
        fp = apply_date_filter(fp, date_mode, date_from, date_to)

    if not ft.empty:
        if selected_comp:
            ft = ft[ft["competition"].isin(selected_comp)]
        if selected_map:
            ft = ft[ft["map"].isin(selected_map)]
        if selected_tier:
            ft = ft[ft["tier"].isin(selected_tier)]
        if selected_opp:
            ft = ft[ft["opponent_team"].isin(selected_opp)]
        if selected_side:
            ft = ft[ft["side"].isin(selected_side)]
        ft = apply_date_filter(ft, date_mode, date_from, date_to)

    return fp, ft

# -----------------------------
# Rendering helpers
# -----------------------------
def render_info_card(rows: list[tuple[str, str]]):
    for label, value in rows:
        st.markdown(
            f"""
            <div class='info-row'>
                <span class='info-label'>{label}</span>
                <span class='info-value'>{value}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

def render_map_card(map_name: str):
    map_image = find_map_image(map_name)
    if map_image:
        st.markdown("<div class='map-card'>", unsafe_allow_html=True)
        st.markdown(
            f"<div class='map-card-title' style='margin-top:0; border-top:none; border-bottom:1px solid #1f2937;'>{pretty_label(map_name)}</div>",
            unsafe_allow_html=True,
        )
        st.image(str(map_image), use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.markdown("<div class='profile-box' style='min-height:180px;'>Map Image Missing</div>", unsafe_allow_html=True)

# -----------------------------
# Main rendering
# -----------------------------
def render_profile_header(player_name: str, player_df: pd.DataFrame, achievements_df: pd.DataFrame):
    if player_df.empty:
        st.warning("No rows found for this player with the current filters.")
        return

    metrics = calculate_player_metrics(player_df)
    photo_path = find_image_file(PLAYER_PHOTOS_DIR, player_name)
    logo_path = find_image_file(TEAM_LOGOS_DIR, MY_TEAM_NAME)

    st.markdown("<div class='profile-header'>", unsafe_allow_html=True)
    left, mid, right = st.columns([0.95, 1.9, 0.9])

    with left:
        if photo_path:
            st.image(str(photo_path), use_container_width=True)
        else:
            st.markdown("<div class='profile-box'>Player Image Placeholder</div>", unsafe_allow_html=True)

    with mid:
        st.markdown(f"<div class='player-name-title'>{player_name}</div>", unsafe_allow_html=True)
        st.markdown(f"<div class='player-hero-meta'>{MY_TEAM_NAME}</div>", unsafe_allow_html=True)
        st.markdown(f"<span class='pill'>{fmt_num(metrics['matches'])} matches</span>", unsafe_allow_html=True)
        render_header_achievements(player_name, achievements_df)
        render_rating_gauge(metrics["rating"])

    with right:
        if logo_path:
            st.image(str(logo_path), use_container_width=True)
        else:
            st.markdown("<div class='team-logo-box'>Team Logo Placeholder</div>", unsafe_allow_html=True)

    top1, top2, top3, top4, top5, top6 = st.columns(6)
    with top1:
        metric_card("Kills", fmt_num(metrics["kills"]), metrics["kills"])
    with top2:
        metric_card("Deaths", fmt_num(metrics["deaths"]), metrics["deaths"])
    with top3:
        metric_card("Dpm", fmt_num(metrics["dpm"], 1), metrics["dpm"])
    with top4:
        metric_card("Mvps", fmt_num(metrics["mvps"]), metrics["mvps"])
    with top5:
        metric_card("Acc%", fmt_num(metrics["accuracy_pct"], 1), metrics["accuracy_pct"])
    with top6:
        metric_card("Matches", fmt_num(metrics["matches"]), metrics["matches"])

    bot1, bot2, bot3, bot4, bot5, bot6 = st.columns(6)
    with bot1:
        slider_metric_card("Kd", fmt_num(metrics["kd"], 2), metrics["kd"])
    with bot2:
        slider_metric_card("Kpr", fmt_num(metrics["kpr"], 2), metrics["kpr"])
    with bot3:
        slider_metric_card("Adr", fmt_num(metrics["adr"], 1), metrics["adr"])
    with bot4:
        slider_metric_card("Impact", fmt_num(metrics["impact"], 2), metrics["impact"])
    with bot5:
        slider_metric_card("Hs%", fmt_num(metrics["hs_pct"], 1), metrics["hs_pct"])
    with bot6:
        slider_metric_card("Kpm", fmt_num(metrics["kpm"], 2), metrics["kpm"])

    st.markdown("</div>", unsafe_allow_html=True)

def render_best_match_section(best_match_df: pd.DataFrame, latest_season_label: str):
    st.markdown(
        f"<div class='section-title'>Best Performing Match ({latest_season_label})</div>",
        unsafe_allow_html=True,
    )

    if best_match_df.empty:
        st.info("No match data found.")
        return

    row = best_match_df.iloc[0]
    left, right = st.columns([1.0, 1.35])

    with left:
        render_map_card(row.get("map", ""))

    with right:
        render_info_card([
            ("Date", str(row.get("date", ""))),
            ("Time", str(row.get("time", ""))),
            ("Map", pretty_label(row.get("map", ""))),
            ("Competition", pretty_label(row.get("competition", ""))),
            ("Opponent", pretty_label(row.get("opponent_team", ""))),
            ("Tier", str(row.get("tier", "")).upper()),
        ])

        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

        r1, r2, r3, r4, r5 = st.columns(5)
        with r1:
            metric_card("Rating", fmt_num(row["rating"], 2), row["rating"])
        with r2:
            metric_card("Kills", fmt_num(row["kills"]), row["kills"])
        with r3:
            metric_card("Deaths", fmt_num(row["deaths"]), row["deaths"])
        with r4:
            slider_metric_card("Kd", fmt_num(row["kd"], 2), row["kd"])
        with r5:
            slider_metric_card("Adr", fmt_num(row["adr"], 1), row["adr"])

        r6, r7, r8, r9 = st.columns(4)
        with r6:
            metric_card("Mvps", fmt_num(row["mvps"]), row["mvps"])
        with r7:
            slider_metric_card("Kpr", fmt_num(row["kpr"], 2), row["kpr"])
        with r8:
            slider_metric_card("Hs%", fmt_num(row["hs_pct"], 1), row["hs_pct"])
        with r9:
            metric_card("Acc%", fmt_num(row["accuracy_pct"], 1), row["accuracy_pct"])

def render_best_comp_section(best_comp_df: pd.DataFrame, latest_season_label: str):
    st.markdown(
        f"<div class='section-title'>Best Performing Competition ({latest_season_label})</div>",
        unsafe_allow_html=True,
    )

    if best_comp_df.empty:
        st.info("No competition data found.")
        return

    row = best_comp_df.iloc[0]
    left, right = st.columns([1.0, 1.35])

    best_competition_name = row.get("competition", "")
    competition_logo = find_competition_logo(best_competition_name)

    with left:
        if not safe_render_image(competition_logo, use_container_width=True):
            st.markdown(
                f"<div class='profile-box' style='min-height:180px; display:flex; align-items:center; justify-content:center; text-align:center; padding:16px;'>"
                f"<div><strong>{escape(pretty_label(best_competition_name) or 'Competition')}</strong><br><span style='color:#9ca3af;'>Competition Logo Unavailable</span></div>"
                f"</div>",
                unsafe_allow_html=True,
            )

    with right:
        render_info_card([
            ("Competition", pretty_label(row.get("competition", ""))),
            ("Season Scope", latest_season_label),
            ("Matches", fmt_num(row.get("matches", 0))),
            ("Top Map", pretty_label(row.get("top_map", ""))),
        ])

        st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

        r1, r2, r3, r4, r5 = st.columns(5)
        with r1:
            metric_card("Rating", fmt_num(row["rating"], 2), row["rating"])
        with r2:
            metric_card("Kills", fmt_num(row["kills"]), row["kills"])
        with r3:
            metric_card("Deaths", fmt_num(row["deaths"]), row["deaths"])
        with r4:
            slider_metric_card("Kd", fmt_num(row["kd"], 2), row["kd"])
        with r5:
            slider_metric_card("Adr", fmt_num(row["adr"], 1), row["adr"])

        r6, r7, r8, r9 = st.columns(4)
        with r6:
            metric_card("Mvps", fmt_num(row["mvps"]), row["mvps"])
        with r7:
            slider_metric_card("Kpr", fmt_num(row["kpr"], 2), row["kpr"])
        with r8:
            slider_metric_card("Hs%", fmt_num(row["hs_pct"], 1), row["hs_pct"])
        with r9:
            metric_card("Acc%", fmt_num(row["accuracy_pct"], 1), row["accuracy_pct"])


def render_profile_tab(player_df: pd.DataFrame, team_visible_df: pd.DataFrame):
    if player_df.empty:
        st.info("No data.")
        return

    working = player_df.copy()
    working["_season_num"] = working["competition"].apply(extract_season_number) if "competition" in working.columns else pd.NA
    latest_season_num = working["_season_num"].dropna().max() if "_season_num" in working.columns else pd.NA

    if pd.notna(latest_season_num):
        latest_season_df = working[working["_season_num"] == latest_season_num].copy()
        latest_season_label = f"S{int(latest_season_num)}"
    else:
        latest_season_df = working.copy()
        latest_season_label = "Current Data"

    best_match_df = build_match_perf(latest_season_df).sort_values(
        ["rating", "kills", "adr", "kd"],
        ascending=[False, False, False, False]
    ).head(1)

    best_comp_df = build_comp_perf(latest_season_df).sort_values(
        ["rating", "matches", "kills", "adr"],
        ascending=[False, False, False, False]
    ).head(1)

    player_matches = working["match_id"].nunique() if "match_id" in working.columns else 0
    player_kills = pd.to_numeric(working.get("kills", 0), errors="coerce").fillna(0).sum()
    player_deaths = pd.to_numeric(working.get("deaths", 0), errors="coerce").fillna(0).sum()
    player_damage = pd.to_numeric(working.get("damage", 0), errors="coerce").fillna(0).sum()
    player_rounds = pd.to_numeric(working.get("rounds_played", 0), errors="coerce").fillna(0).sum()
    player_mvps = pd.to_numeric(working.get("mvps", 0), errors="coerce").fillna(0).sum()
    player_kd = player_kills / player_deaths if player_deaths else float(player_kills)
    player_adr = player_damage / player_rounds if player_rounds else 0.0

    team_working = team_visible_df.copy()
    team_matches = team_working["match_id"].nunique() if "match_id" in team_working.columns else 0
    team_players = team_working["player"].nunique() if "player" in team_working.columns else 0
    team_kills = pd.to_numeric(team_working.get("kills", 0), errors="coerce").fillna(0).sum()
    team_deaths = pd.to_numeric(team_working.get("deaths", 0), errors="coerce").fillna(0).sum()
    team_damage = pd.to_numeric(team_working.get("damage", 0), errors="coerce").fillna(0).sum()
    team_rounds = pd.to_numeric(team_working.get("rounds_played", 0), errors="coerce").fillna(0).sum()
    team_kd = team_kills / team_deaths if team_deaths else float(team_kills)
    team_adr = team_damage / team_rounds if team_rounds else 0.0

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        st.markdown("<div class='section-title'>Player Overview</div>", unsafe_allow_html=True)

        p1, p2, p3 = st.columns(3)
        with p1:
            metric_card("Matches", fmt_num(player_matches), player_matches)
        with p2:
            metric_card("Kills", fmt_num(player_kills), player_kills)
        with p3:
            metric_card("Deaths", fmt_num(player_deaths), player_deaths)

        p4, p5, p6 = st.columns(3)
        with p4:
            slider_metric_card("Kd", fmt_num(player_kd, 2), player_kd)
        with p5:
            slider_metric_card("Adr", fmt_num(player_adr, 1), player_adr)
        with p6:
            metric_card("Mvps", fmt_num(player_mvps), player_mvps)

        st.markdown("</div>", unsafe_allow_html=True)

    with col2:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        st.markdown("<div class='section-title'>Team Overview</div>", unsafe_allow_html=True)

        t1, t2, t3 = st.columns(3)
        with t1:
            metric_card("Team Matches", fmt_num(team_matches), team_matches)
        with t2:
            metric_card("Kills", fmt_num(team_kills), team_kills)
        with t3:
            metric_card("Deaths", fmt_num(team_deaths), team_deaths)

        t4, t5, t6 = st.columns(3)
        with t4:
            slider_metric_card("Kd", fmt_num(team_kd, 2), team_kd)
        with t5:
            slider_metric_card("Adr", fmt_num(team_adr, 1), team_adr)
        with t6:
            metric_card("Players Used", fmt_num(team_players), team_players)

        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
    render_best_match_section(best_match_df, latest_season_label)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
    render_best_comp_section(best_comp_df, latest_season_label)
    st.markdown("</div>", unsafe_allow_html=True)



def build_category_color_map(labels, palette=None):
    default_colors = [
        "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#ef4444", "#22c55e",
        "#06b6d4", "#f472b6", "#eab308", "#8b5cf6", "#14b8a6", "#fb7185",
    ]
    color_map = {}
    label_list = [str(x) for x in labels]
    for idx, label in enumerate(label_list):
        key = str(label).strip().lower()
        if palette and key in {str(k).strip().lower() for k in palette.keys()}:
            for pk, pv in palette.items():
                if str(pk).strip().lower() == key:
                    color_map[str(label)] = pv
                    break
        else:
            color_map[str(label)] = default_colors[idx % len(default_colors)]
    return color_map


def render_altair_bar_chart(df: pd.DataFrame, label_col: str, value_col: str, title: str, palette=None, max_rows: int = 10, height=None):
    st.markdown(f"<div class='subtle-title'>{title}</div>", unsafe_allow_html=True)

    if df.empty or label_col not in df.columns or value_col not in df.columns:
        st.info("No data.")
        return

    chart_df = df[[label_col, value_col]].copy()
    chart_df[label_col] = chart_df[label_col].astype(str).str.strip().replace({"": "Unknown"})
    chart_df[value_col] = pd.to_numeric(chart_df[value_col], errors="coerce").fillna(0)
    chart_df = chart_df.sort_values(value_col, ascending=False).head(max_rows)

    if chart_df.empty:
        st.info("No data.")
        return

    chart_df = chart_df.rename(columns={label_col: "label", value_col: "value"})
    color_map = build_category_color_map(chart_df["label"].tolist(), palette)
    chart_df["color"] = chart_df["label"].map(color_map)

    chart = (
        alt.Chart(chart_df)
        .mark_bar(cornerRadiusTopRight=6, cornerRadiusBottomRight=6)
        .encode(
            x=alt.X("value:Q", title=None),
            y=alt.Y("label:N", sort="-x", title=None),
            color=alt.Color("label:N", scale=alt.Scale(domain=list(color_map.keys()), range=list(color_map.values())), legend=None),
            tooltip=[alt.Tooltip("label:N", title="Label"), alt.Tooltip("value:Q", title="Value", format=".2f")],
        )
        .properties(height=height or max(260, len(chart_df) * 28))
    )
    st.altair_chart(chart, use_container_width=True)


def render_altair_line_chart(df: pd.DataFrame, x_col: str, y_col: str, title: str, color: str = "#60a5fa", height: int = 280):
    st.markdown(f"<div class='subtle-title'>{title}</div>", unsafe_allow_html=True)

    if df.empty or x_col not in df.columns or y_col not in df.columns:
        st.info("No data.")
        return

    chart_df = df[[x_col, y_col]].copy()
    chart_df[y_col] = pd.to_numeric(chart_df[y_col], errors="coerce")
    chart_df = chart_df.dropna(subset=[y_col])

    if chart_df.empty:
        st.info("No data.")
        return

    chart = (
        alt.Chart(chart_df)
        .mark_line(point=True, strokeWidth=3, color=color)
        .encode(
            x=alt.X(f"{x_col}:Q", title=None),
            y=alt.Y(f"{y_col}:Q", title=None),
            tooltip=[alt.Tooltip(f"{x_col}:Q", title="Match #"), alt.Tooltip(f"{y_col}:Q", title="Value", format=".2f")],
        )
        .properties(height=height)
    )
    st.altair_chart(chart, use_container_width=True)


def render_diverging_win_loss_chart(df: pd.DataFrame, label_col: str, wins_col: str, losses_col: str, title: str, max_rows: int = 10, height: int = 320):
    st.markdown(f"<div class='subtle-title'>{title}</div>", unsafe_allow_html=True)

    if df.empty or any(col not in df.columns for col in [label_col, wins_col, losses_col]):
        st.info("No data.")
        return

    chart_df = df[[label_col, wins_col, losses_col]].copy()
    chart_df[label_col] = chart_df[label_col].astype(str).str.strip().replace({"": "Unknown"})
    chart_df[wins_col] = pd.to_numeric(chart_df[wins_col], errors="coerce").fillna(0)
    chart_df[losses_col] = pd.to_numeric(chart_df[losses_col], errors="coerce").fillna(0)
    chart_df["net"] = chart_df[wins_col] - chart_df[losses_col]
    chart_df["total"] = chart_df[wins_col] + chart_df[losses_col]
    chart_df = chart_df[chart_df["total"] > 0].copy()

    if chart_df.empty:
        st.info("No data.")
        return

    if len(chart_df) > max_rows:
        lower_n = max_rows // 2
        upper_n = max_rows - lower_n
        negative_side = chart_df.sort_values(["net", "total"], ascending=[True, False]).head(lower_n)
        positive_side = chart_df.sort_values(["net", "total"], ascending=[False, False]).head(upper_n)
        chart_df = pd.concat([negative_side, positive_side], ignore_index=True).drop_duplicates(subset=[label_col])

    chart_df = chart_df.sort_values(["net", "total"], ascending=[True, False]).copy()
    chart_df["label"] = chart_df[label_col]

    long_df = pd.concat([
        pd.DataFrame({
            "label": chart_df["label"],
            "result": "Wins",
            "value": chart_df[wins_col],
            "signed_value": chart_df[wins_col],
            "net": chart_df["net"],
        }),
        pd.DataFrame({
            "label": chart_df["label"],
            "result": "Losses",
            "value": chart_df[losses_col],
            "signed_value": -chart_df[losses_col],
            "net": chart_df["net"],
        }),
    ], ignore_index=True)

    domain = ["Wins", "Losses"]
    colors = ["#22c55e", "#ef4444"]
    label_order = chart_df["label"].tolist()
    axis_max = max(float(chart_df[wins_col].max()), float(chart_df[losses_col].max()), 1.0)

    chart = (
        alt.Chart(long_df)
        .mark_bar()
        .encode(
            x=alt.X("signed_value:Q", title="Match Difference", scale=alt.Scale(domain=[-axis_max, axis_max], nice=False)),
            y=alt.Y("label:N", sort=label_order, title=None),
            color=alt.Color("result:N", scale=alt.Scale(domain=domain, range=colors), legend=alt.Legend(title=None, orient="bottom")),
            tooltip=[
                alt.Tooltip("label:N", title="Opponent"),
                alt.Tooltip("result:N", title="Result"),
                alt.Tooltip("value:Q", title="Matches", format=".0f"),
                alt.Tooltip("net:Q", title="Net W-L", format=".0f"),
            ],
        )
        .properties(height=height)
    )

    zero_rule = alt.Chart(pd.DataFrame({"x": [0]})).mark_rule(color="#6b7280").encode(x="x:Q")
    st.altair_chart(chart + zero_rule, use_container_width=True)


def render_color_bar_chart(df: pd.DataFrame, label_col: str, value_col: str, title: str, palette=None, max_rows: int = 10):
    render_altair_bar_chart(df, label_col, value_col, title, palette=palette, max_rows=max_rows)


def render_ranked_metric_block(df: pd.DataFrame, label_col: str, value_col: str, title: str, max_rows: int = 10, value_digits: int = 1, palette=None):
    render_altair_bar_chart(df, label_col, value_col, title, palette=palette, max_rows=max_rows)


def classify_tactic_bucket(value: str) -> str:
    raw = str(value).strip()
    if not raw:
        return "Unknown"

    upper = raw.upper()

    if upper.startswith("(P)") or upper.startswith("P"):
        return "Pistol"
    if upper.startswith("(E)") or upper.startswith("E"):
        return "Eco"
    if upper.startswith("(S)") or upper.startswith("S"):
        return "Standard"
    return "Other"


def render_side_split_bar_chart(df: pd.DataFrame, label_col: str, value_col: str, title: str, max_rows: int = 12, height: int | None = None):
    st.markdown(f"<div class='subtle-title'>{title}</div>", unsafe_allow_html=True)

    required = {label_col, value_col, 'side_clean'}
    if df.empty or not required.issubset(df.columns):
        st.info("No data.")
        return

    chart_df = df[[label_col, value_col, 'side_clean']].copy()
    chart_df[label_col] = chart_df[label_col].astype(str).str.strip().replace({'': 'Unknown'})
    chart_df['side_clean'] = chart_df['side_clean'].astype(str).str.strip().replace({'': 'Unknown'})
    chart_df[value_col] = pd.to_numeric(chart_df[value_col], errors='coerce').fillna(0)
    chart_df = chart_df[chart_df['side_clean'].isin(['Red', 'Blue'])].copy()

    if chart_df.empty:
        st.info("No data.")
        return

    # Each tactic should only appear on its real side. Collapse any duplicate rows for the
    # same tactic/side combination so we render one bar per tactic, coloured by side, with
    # no empty counterpart gap for the opposite side.
    chart_df = (
        chart_df.groupby([label_col, 'side_clean'], as_index=False)[value_col]
        .sum()
    )

    order_df = (
        chart_df.groupby(label_col, as_index=False)[value_col]
        .sum()
        .sort_values(value_col, ascending=False)
        .head(max_rows)
    )
    label_order = order_df[label_col].tolist()
    chart_df = chart_df[chart_df[label_col].isin(label_order)].copy()

    chart = (
        alt.Chart(chart_df)
        .mark_bar(cornerRadiusTopRight=5, cornerRadiusBottomRight=5)
        .encode(
            x=alt.X(f'{value_col}:Q', title=None),
            y=alt.Y(f'{label_col}:N', sort=label_order, title=None),
            color=alt.Color(
                'side_clean:N',
                scale=alt.Scale(domain=['Red', 'Blue'], range=['#ef4444', '#3b82f6']),
                legend=alt.Legend(title=None, orient='bottom')
            ),
            tooltip=[
                alt.Tooltip(f'{label_col}:N', title='Tactic'),
                alt.Tooltip('side_clean:N', title='Side'),
                alt.Tooltip(f'{value_col}:Q', title='Value', format='.2f'),
            ],
        )
        .properties(height=height or max(260, len(label_order) * 28))
    )
    st.altair_chart(chart, use_container_width=True)



def build_match_context(player_df: pd.DataFrame, tactics_df: pd.DataFrame | None = None):
    if player_df is None or player_df.empty:
        return None

    temp = player_df.copy()

    def clean_label(value, fallback):
        if pd.isna(value):
            return fallback
        value = str(value).strip()
        if not value or value.lower() in {"nan", "none", "null"}:
            return fallback
        return pretty_label(value)

    for col in ["kills", "deaths", "damage", "rounds_played", "accuracy_pct", "hs_pct", "mvps", "kpd"]:
        if col not in temp.columns:
            temp[col] = 0
        temp[col] = pd.to_numeric(temp[col], errors="coerce").fillna(0)

    for col in ["map", "competition", "opponent_team", "match_id", "date", "time"]:
        if col not in temp.columns:
            temp[col] = ""

    temp["map_clean"] = temp["map"].apply(lambda x: clean_label(x, "Unknown Map"))
    temp["competition_clean"] = temp["competition"].apply(lambda x: clean_label(x, "Unknown Competition"))
    temp["opp_clean"] = temp["opponent_team"].apply(lambda x: clean_label(x, "Unknown Opponent"))
    temp["_dt"] = pd.to_datetime(
        temp["date"].astype(str).str.strip() + " " + temp["time"].astype(str).str.strip(),
        errors="coerce",
    )

    match_summary = temp.groupby("match_id", as_index=False).agg(
        date=("date", "first"),
        time=("time", "first"),
        dt=("_dt", "min"),
        map_clean=("map_clean", "first"),
        competition_clean=("competition_clean", "first"),
        opp_clean=("opp_clean", "first"),
        kills=("kills", "sum"),
        deaths=("deaths", "sum"),
        damage=("damage", "sum"),
        rounds_played=("rounds_played", "sum"),
        accuracy_pct=("accuracy_pct", "mean"),
        hs_pct=("hs_pct", "mean"),
        mvps=("mvps", "sum"),
    )

    if match_summary.empty:
        return None

    match_summary["rating"] = match_summary.apply(lambda r: (r["kills"] / r["deaths"]) if r["deaths"] > 0 else float(r["kills"]), axis=1)
    match_summary["adr"] = match_summary.apply(lambda r: (r["damage"] / r["rounds_played"]) if r["rounds_played"] > 0 else 0, axis=1)

    map_breakdown = match_summary.groupby("map_clean", as_index=False).agg(matches=("match_id", "count"), damage=("damage", "sum"), rounds=("rounds_played", "sum"), rating=("rating", "mean"), adr=("adr", "mean"))
    map_breakdown["adr"] = (map_breakdown["damage"] / map_breakdown["rounds"].replace(0, pd.NA)).fillna(0)

    opp_breakdown = match_summary.groupby("opp_clean", as_index=False).agg(matches=("match_id", "count"), rating=("rating", "mean"), adr=("adr", "mean"), kills=("kills", "sum"), deaths=("deaths", "sum"))
    comp_breakdown = match_summary.groupby("competition_clean", as_index=False).agg(matches=("match_id", "count"), rating=("rating", "mean"), adr=("adr", "mean"))

    wl_breakdown = pd.DataFrame()
    if tactics_df is not None and not tactics_df.empty:
        t = tactics_df.copy()
        for col in ["match_id", "opponent_team"]:
            if col not in t.columns:
                t[col] = ""
        for col in ["wins", "losses"]:
            if col not in t.columns:
                t[col] = 0
            t[col] = pd.to_numeric(t[col], errors="coerce").fillna(0)
        t["opp_clean"] = t["opponent_team"].apply(lambda x: clean_label(x, "Unknown Opponent"))
        match_results = t.groupby("match_id", as_index=False).agg(opp_clean=("opp_clean", "first"), wins=("wins", "sum"), losses=("losses", "sum"))
        if not match_results.empty:
            match_results["match_win"] = (match_results["wins"] > match_results["losses"]).astype(int)
            match_results["match_loss"] = (match_results["losses"] > match_results["wins"]).astype(int)
            match_results["match_draw"] = (match_results["wins"] == match_results["losses"]).astype(int)
            wl_breakdown = match_results.groupby("opp_clean", as_index=False).agg(wins=("match_win", "sum"), losses=("match_loss", "sum"), draws=("match_draw", "sum"))
            wl_breakdown["matches"] = wl_breakdown[["wins", "losses", "draws"]].sum(axis=1)
            wl_breakdown["net"] = wl_breakdown["wins"] - wl_breakdown["losses"]

    seq_df = match_summary.sort_values(["dt", "date", "time", "match_id"]).reset_index(drop=True)
    seq_df["match_no"] = seq_df.index + 1
    seq_df["rolling_rating"] = seq_df["rating"].rolling(window=3, min_periods=1).mean()
    seq_df["rolling_adr"] = seq_df["adr"].rolling(window=3, min_periods=1).mean()

    return {
        "match_summary": match_summary,
        "map_breakdown": map_breakdown,
        "opp_breakdown": opp_breakdown,
        "comp_breakdown": comp_breakdown,
        "wl_breakdown": wl_breakdown,
        "seq_df": seq_df,
    }


def render_opponents_tab(player_df: pd.DataFrame, tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Opponents</div>", unsafe_allow_html=True)
    ctx = build_match_context(player_df, tactics_df)
    if not ctx:
        st.info("No opponent data in the current filter.")
        return

    opp = ctx["opp_breakdown"].sort_values(["matches", "rating"], ascending=[False, False]).copy()
    wl = ctx["wl_breakdown"].copy()
    if not wl.empty:
        opp = opp.merge(wl[["opp_clean", "wins", "losses", "draws", "matches", "net"]], on="opp_clean", how="left", suffixes=("", "_wl"))
        opp["wins"] = opp["wins"].fillna(0)
        opp["losses"] = opp["losses"].fillna(0)
        opp["draws"] = opp["draws"].fillna(0)
        opp["win_rate"] = (opp["wins"] / (opp["wins"] + opp["losses"] + opp["draws"]).replace(0, pd.NA) * 100).fillna(0)
    else:
        opp["wins"] = 0
        opp["losses"] = 0
        opp["draws"] = 0
        opp["win_rate"] = 0

    row1 = st.columns(2)
    with row1[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_diverging_win_loss_chart(opp, "opp_clean", "wins", "losses", "Win-Loss By Opponent", max_rows=14, height=420)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp.sort_values(["win_rate", "matches"], ascending=[False, False]), "opp_clean", "win_rate", "Win Rate By Opponent", max_rows=14, palette={"low": "#ef4444", "mid": "#f59e0b", "high": "#22c55e"})
        st.markdown("</div>", unsafe_allow_html=True)

    row2 = st.columns(3)
    with row2[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp, "opp_clean", "matches", "Matches Played By Opponent", max_rows=14)
        st.markdown("</div>", unsafe_allow_html=True)
    with row2[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp.sort_values("rating", ascending=False), "opp_clean", "rating", "Average Rating By Opponent", max_rows=14)
        st.markdown("</div>", unsafe_allow_html=True)
    with row2[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp.sort_values("adr", ascending=False), "opp_clean", "adr", "Average ADR By Opponent", max_rows=14)
        st.markdown("</div>", unsafe_allow_html=True)


def render_maps_tab(player_df: pd.DataFrame, tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Maps</div>", unsafe_allow_html=True)
    ctx = build_match_context(player_df, tactics_df)
    if not ctx:
        st.info("No map data in the current filter.")
        return

    maps = ctx["map_breakdown"].sort_values(["matches", "rating"], ascending=[False, False]).copy()
    row1 = st.columns(3)
    with row1[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(maps, "map_clean", "matches", "Matches By Map", palette=MAP_PALETTE, max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(maps.sort_values("rating", ascending=False), "map_clean", "rating", "Average Rating By Map", palette=MAP_PALETTE, max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(maps.sort_values("adr", ascending=False), "map_clean", "adr", "ADR By Map", palette=MAP_PALETTE, max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)

    if tactics_df is not None and not tactics_df.empty:
        temp = tactics_df.copy()
        for col in ["wins", "losses", "total_rounds"]:
            if col not in temp.columns:
                temp[col] = 0
            temp[col] = pd.to_numeric(temp[col], errors="coerce").fillna(0)
        for col in ["map", "side"]:
            if col not in temp.columns:
                temp[col] = ""
        temp["map_clean"] = temp["map"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Map")
        temp["side_clean"] = temp["side"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Side")
        side_map = temp.groupby(["map_clean", "side_clean"], as_index=False).agg(total_rounds=("total_rounds", "sum"), wins=("wins", "sum"))
        side_map["win_rate"] = (side_map["wins"] / side_map["total_rounds"].replace(0, pd.NA) * 100).fillna(0)
        row2 = st.columns(2)
        with row2[0]:
            st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
            render_altair_bar_chart(side_map.sort_values("total_rounds", ascending=False), "map_clean", "total_rounds", "Tactic Usage By Map", palette=MAP_PALETTE, max_rows=12)
            st.markdown("</div>", unsafe_allow_html=True)
        with row2[1]:
            st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
            render_altair_bar_chart(side_map.sort_values("win_rate", ascending=False), "map_clean", "win_rate", "Best Map Round Win Rate", palette=MAP_PALETTE, max_rows=12)
            st.markdown("</div>", unsafe_allow_html=True)


def render_form_tab(player_df: pd.DataFrame, tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Form</div>", unsafe_allow_html=True)
    ctx = build_match_context(player_df, tactics_df)
    if not ctx:
        st.info("No form data in the current filter.")
        return

    seq_df = ctx["seq_df"].copy()
    if seq_df.empty:
        st.info("No form data in the current filter.")
        return

    recent5 = seq_df.tail(5)
    recent10 = seq_df.tail(10)
    m1,m2,m3,m4 = st.columns(4)
    with m1:
        slider_metric_card("Last 5 Avg Rating", fmt_num(recent5["rating"].mean(), 2), recent5["rating"].mean())
    with m2:
        slider_metric_card("Last 10 Avg Rating", fmt_num(recent10["rating"].mean(), 2), recent10["rating"].mean())
    with m3:
        slider_metric_card("Last 5 ADR", fmt_num(recent5["adr"].mean(), 1), recent5["adr"].mean())
    with m4:
        metric_card("Recent Matches", fmt_num(len(recent10)), len(recent10))

    row1 = st.columns(3)
    with row1[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rating", "Rating By Match Sequence", color="#60a5fa")
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rolling_rating", "3-Match Average Rating", color="#34d399")
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rolling_adr", "3-Match Average ADR", color="#f59e0b")
        st.markdown("</div>", unsafe_allow_html=True)

def render_matches_tab(player_df: pd.DataFrame, tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Matches</div>", unsafe_allow_html=True)
    ctx = build_match_context(player_df, tactics_df)
    if not ctx:
        st.info("No match rows for current filter.")
        return

    match_summary = ctx["match_summary"]
    map_breakdown = ctx["map_breakdown"]
    opp_breakdown = ctx["opp_breakdown"]
    comp_breakdown = ctx["comp_breakdown"]
    wl_breakdown = ctx["wl_breakdown"]
    seq_df = ctx["seq_df"]

    top1, top2, top3, top4 = st.columns(4)
    with top1:
        metric_card("Matches", fmt_num(match_summary["match_id"].nunique()), match_summary["match_id"].nunique())
    with top2:
        metric_card("Kills", fmt_num(match_summary["kills"].sum()), match_summary["kills"].sum())
    with top3:
        metric_card("Deaths", fmt_num(match_summary["deaths"].sum()), match_summary["deaths"].sum())
    with top4:
        total_rounds = match_summary["rounds_played"].sum()
        total_damage = match_summary["damage"].sum()
        adr = total_damage / total_rounds if total_rounds else 0
        slider_metric_card("Adr", fmt_num(adr, 1), adr)

    row1 = st.columns(3)
    with row1[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(map_breakdown, "map_clean", "matches", "Matches By Map", palette=MAP_PALETTE, max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp_breakdown, "opp_clean", "matches", "Matches By Opponent", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(map_breakdown, "map_clean", "adr", "ADR By Map", palette=MAP_PALETTE, max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)

    row2 = st.columns(3)
    with row2[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp_breakdown, "opp_clean", "rating", "Average Rating By Opponent Team", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row2[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(comp_breakdown, "competition_clean", "matches", "Matches By Competition", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row2[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(comp_breakdown, "competition_clean", "rating", "Average Rating By Competition", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)

    row_wl = st.columns(2)
    with row_wl[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        if wl_breakdown.empty:
            st.markdown("<div class='subtle-title'>Win-Loss By Opponent</div>", unsafe_allow_html=True)
            st.info("No win/loss data.")
        else:
            render_diverging_win_loss_chart(wl_breakdown, "opp_clean", "wins", "losses", "Win-Loss By Opponent", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row_wl[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        if wl_breakdown.empty:
            st.markdown("<div class='subtle-title'>Win Rate By Opponent</div>", unsafe_allow_html=True)
            st.info("No win/loss data.")
        else:
            wl_rate = wl_breakdown.copy()
            wl_rate["win_rate"] = (wl_rate["wins"] / wl_rate["matches"].replace(0, pd.NA) * 100).fillna(0)
            render_altair_bar_chart(wl_rate.sort_values(["win_rate", "matches"], ascending=[False, False]), "opp_clean", "win_rate", "Win Rate By Opponent", max_rows=14, palette={"low": "#ef4444", "mid": "#f59e0b", "high": "#22c55e"})
        st.markdown("</div>", unsafe_allow_html=True)

    row3 = st.columns(3)
    with row3[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rating", "Rating By Match Sequence", color="#60a5fa")
        st.markdown("</div>", unsafe_allow_html=True)
    with row3[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rolling_rating", "3-Match Average Rating", color="#34d399")
        st.markdown("</div>", unsafe_allow_html=True)
    with row3[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_line_chart(seq_df, "match_no", "rolling_adr", "3-Match Average ADR", color="#f59e0b")
        st.markdown("</div>", unsafe_allow_html=True)



def render_tactic_recommendation_cards(summary_df: pd.DataFrame):
    st.markdown("<div class='subtle-title' style='margin-top:10px;'>Top 3 Recommended Tactics By Map & Side</div>", unsafe_allow_html=True)

    if summary_df.empty:
        st.info("No tactic recommendation data available.")
        return

    rec_df = summary_df.copy()
    rec_df = rec_df[rec_df["tactic_clean"].astype(str).str.strip() != ""]
    if rec_df.empty:
        st.info("No tactic recommendation data available.")
        return

    rec_df["win_rate_pct"] = pd.to_numeric(rec_df["win_rate_pct"], errors="coerce").fillna(0)
    rec_df["total_rounds"] = pd.to_numeric(rec_df["total_rounds"], errors="coerce").fillna(0)
    rec_df["matches"] = pd.to_numeric(rec_df["matches"], errors="coerce").fillna(0)
    rec_df["recommend_score"] = rec_df["win_rate_pct"] * 0.8 + rec_df["total_rounds"].clip(upper=15) * 1.5 + rec_df["matches"].clip(upper=8) * 1.0

    side_cards = []
    for (map_name, side_name), side_df in rec_df.groupby(["map_clean", "side_clean"], sort=False):
        side_label = pretty_label(side_name or "Unknown Side")
        eligible = side_df[side_df["total_rounds"] >= 3].copy()
        if eligible.empty:
            eligible = side_df.copy()
        eligible = eligible.sort_values(
            ["recommend_score", "win_rate_pct", "total_rounds", "matches", "tactic_clean"],
            ascending=[False, False, False, False, True],
        ).head(3)
        if not eligible.empty:
            side_cards.append((pretty_label(map_name), side_label, eligible))

    if not side_cards:
        st.info("No tactic recommendation data available.")
        return

    for start in range(0, len(side_cards), 2):
        cols = st.columns(min(2, len(side_cards) - start))
        for idx, (map_name, side_label, best_df) in enumerate(side_cards[start:start+2]):
            with cols[idx]:
                accent = "#ef4444" if "red" in side_label.lower() else "#3b82f6" if "blue" in side_label.lower() else "#6b7280"
                st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
                st.markdown(
                    f"<div class='subtle-title' style='color:{accent};'>{map_name} {side_label}</div>",
                    unsafe_allow_html=True,
                )
                for rank, (_, row) in enumerate(best_df.iterrows(), start=1):
                    wr = fmt_num(row.get("win_rate_pct", 0), 1)
                    rounds = fmt_num(row.get("total_rounds", 0))
                    matches = fmt_num(row.get("matches", 0))
                    bucket = pretty_label(row.get("tactic_bucket", "Other"))
                    tactic = pretty_label(row.get("tactic_clean", "Unknown Tactic"))
                    st.markdown(
                        f"""
                        <div style="border:1px solid #1f2937; border-left:4px solid {accent}; border-radius:14px; padding:10px 12px; margin-bottom:10px; background:rgba(17,24,39,0.65);">
                            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:4px;">
                                <span style="color:#f9fafb; font-weight:800;">#{rank} {tactic}</span>
                                <span style="color:{accent}; font-weight:800;">{wr}%</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:0.82rem; color:#cbd5e1;">
                                <span>{bucket}</span>
                                <span>•</span>
                                <span>{rounds} rounds</span>
                                <span>•</span>
                                <span>{matches} matches</span>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
                st.markdown("</div>", unsafe_allow_html=True)

def render_tactical_breakdown_tab(tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Tactical Breakdown</div>", unsafe_allow_html=True)

    if tactics_df.empty:
        st.info("No tactics data in the current filter.")
        return

    temp = tactics_df.copy()
    for col in ["wins", "losses", "total_rounds"]:
        if col not in temp.columns:
            temp[col] = 0
        temp[col] = pd.to_numeric(temp[col], errors="coerce").fillna(0)

    for col in ["map", "side", "tactic_name", "competition", "tier", "opponent_team", "match_id"]:
        if col not in temp.columns:
            temp[col] = ""

    temp["map_clean"] = temp["map"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Map")
    temp["side_clean"] = temp["side"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Side")
    temp["tactic_clean"] = temp["tactic_name"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Tactic")
    temp["competition_clean"] = temp["competition"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Competition")
    temp["tier_clean"] = temp["tier"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Tier")
    temp["opp_clean"] = temp["opponent_team"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Opponent")

    ctl1, ctl2, ctl3 = st.columns(3)
    map_options = sorted(temp["map_clean"].dropna().astype(str).unique().tolist())
    selected_map = ctl1.selectbox("Map", map_options, key="tbreak_map")

    map_df = temp[temp["map_clean"] == selected_map].copy()
    side_options = sorted(map_df["side_clean"].dropna().astype(str).unique().tolist())
    selected_side = ctl2.selectbox("Side", side_options, key="tbreak_side")

    side_df = map_df[map_df["side_clean"] == selected_side].copy()
    tactic_order = (
        side_df.groupby("tactic_clean", as_index=False)
        .agg(total_rounds=("total_rounds", "sum"), wins=("wins", "sum"))
        .sort_values(["total_rounds", "wins", "tactic_clean"], ascending=[False, False, True])["tactic_clean"]
        .tolist()
    )
    selected_tactic = ctl3.selectbox("Tactic", tactic_order, key="tbreak_tactic")

    focus = side_df[side_df["tactic_clean"] == selected_tactic].copy()
    if focus.empty:
        st.info("No tactic data for this selection.")
        return

    total_rounds = focus["total_rounds"].sum()
    wins = focus["wins"].sum()
    losses = focus["losses"].sum()
    matches = focus["match_id"].astype(str).nunique()
    win_rate = (wins / total_rounds * 100) if total_rounds else 0

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        metric_card("Win Rate%", fmt_num(win_rate, 1), win_rate)
    with m2:
        metric_card("Round Wins", fmt_num(wins), wins)
    with m3:
        metric_card("Round Losses", fmt_num(losses), losses)
    with m4:
        metric_card("Matches Used", fmt_num(matches), matches)

    comp_df = focus.groupby("competition_clean", as_index=False).agg(
        wins=("wins", "sum"),
        total_rounds=("total_rounds", "sum"),
        matches=("match_id", "nunique"),
    )
    comp_df["win_rate_pct"] = (comp_df["wins"] / comp_df["total_rounds"].replace(0, pd.NA) * 100).fillna(0)
    comp_df = comp_df.sort_values(["win_rate_pct", "matches", "total_rounds"], ascending=[False, False, False])

    tier_df = focus.groupby("tier_clean", as_index=False).agg(
        wins=("wins", "sum"),
        total_rounds=("total_rounds", "sum"),
        matches=("match_id", "nunique"),
    )
    tier_df["win_rate_pct"] = (tier_df["wins"] / tier_df["total_rounds"].replace(0, pd.NA) * 100).fillna(0)
    tier_df = tier_df.sort_values(["win_rate_pct", "matches", "total_rounds"], ascending=[False, False, False])

    opp_df = focus.groupby("opp_clean", as_index=False).agg(
        wins=("wins", "sum"),
        total_rounds=("total_rounds", "sum"),
        matches=("match_id", "nunique"),
    )
    opp_df["win_rate_pct"] = (opp_df["wins"] / opp_df["total_rounds"].replace(0, pd.NA) * 100).fillna(0)
    opp_df = opp_df.sort_values(["win_rate_pct", "matches", "total_rounds"], ascending=[False, False, False])

    row1 = st.columns(3)
    with row1[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(comp_df, "competition_clean", "win_rate_pct", "Win% By Competition", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(tier_df, "tier_clean", "win_rate_pct", "Win% By Tier", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row1[2]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp_df, "opp_clean", "win_rate_pct", "Win% Vs Opponents", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)

    row2 = st.columns(2)
    with row2[0]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(comp_df, "competition_clean", "matches", "Matches By Competition", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)
    with row2[1]:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        render_altair_bar_chart(opp_df, "opp_clean", "matches", "Matches Vs Opponents", max_rows=12)
        st.markdown("</div>", unsafe_allow_html=True)

    detail = focus.groupby(["competition_clean", "tier_clean", "opp_clean"], as_index=False).agg(
        wins=("wins", "sum"),
        losses=("losses", "sum"),
        total_rounds=("total_rounds", "sum"),
        matches=("match_id", "nunique"),
    )
    detail["win_rate_pct"] = (detail["wins"] / detail["total_rounds"].replace(0, pd.NA) * 100).fillna(0)
    detail = detail.sort_values(["win_rate_pct", "matches", "total_rounds"], ascending=[False, False, False])

    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
    st.markdown("<div class='subtle-title'>Detailed Tactical Context</div>", unsafe_allow_html=True)
    st.dataframe(
        detail.rename(columns={
            "competition_clean": "Competition",
            "tier_clean": "Tier",
            "opp_clean": "Opponent",
            "wins": "Wins",
            "losses": "Losses",
            "total_rounds": "Rounds",
            "matches": "Matches",
            "win_rate_pct": "Win%",
        }),
        use_container_width=True,
        hide_index=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

def render_tactics_tab(tactics_df: pd.DataFrame):
    st.markdown("<div class='section-title'>Tactics</div>", unsafe_allow_html=True)

    if tactics_df.empty:
        st.info("No tactics data in the current filter.")
        return

    temp = tactics_df.copy()
    for col in ["wins", "losses", "total_rounds"]:
        if col not in temp.columns:
            temp[col] = 0
        temp[col] = pd.to_numeric(temp[col], errors="coerce").fillna(0)

    for col in ["side", "tactic_name", "match_id", "map"]:
        if col not in temp.columns:
            temp[col] = ""

    temp["side_clean"] = temp["side"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Side")
    temp["tactic_clean"] = temp["tactic_name"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Tactic")
    temp["map_clean"] = temp["map"].apply(lambda x: pretty_label(x) if str(x).strip() else "Unknown Map")
    temp["tactic_bucket"] = temp["tactic_name"].apply(classify_tactic_bucket)

    summary = temp.groupby(["map_clean", "tactic_bucket", "side_clean", "tactic_clean"], as_index=False).agg(
        wins=("wins", "sum"),
        losses=("losses", "sum"),
        total_rounds=("total_rounds", "sum"),
        matches=("match_id", "nunique"),
    )
    summary["win_rate_pct"] = (summary["wins"] / summary["total_rounds"].replace(0, pd.NA) * 100).fillna(0)

    top = st.columns(4)
    total_matches = temp["match_id"].nunique()
    total_wins = summary["wins"].sum()
    total_losses = summary["losses"].sum()
    total_rounds = summary["total_rounds"].sum()
    overall_wr = (total_wins / total_rounds * 100) if total_rounds else 0
    with top[0]:
        metric_card("Tactic Matches", fmt_num(total_matches), total_matches)
    with top[1]:
        metric_card("Round Wins", fmt_num(total_wins), total_wins)
    with top[2]:
        metric_card("Round Losses", fmt_num(total_losses), total_losses)
    with top[3]:
        metric_card("Win Rate%", fmt_num(overall_wr, 1), overall_wr)

    render_tactic_recommendation_cards(summary)

    map_order = (
        summary.groupby("map_clean", as_index=False)
        .agg(total_rounds=("total_rounds", "sum"), matches=("matches", "sum"))
        .sort_values(["total_rounds", "matches", "map_clean"], ascending=[False, False, True])["map_clean"]
        .tolist()
    )

    bucket_order = ["Pistol", "Eco", "Standard", "Other"]

    for map_name in map_order:
        map_df = summary[summary["map_clean"] == map_name].copy()
        st.markdown(f"<div class='section-title' style='margin-top:18px;'>{map_name}</div>", unsafe_allow_html=True)

        for bucket in bucket_order:
            bucket_df = map_df[map_df["tactic_bucket"] == bucket].copy()
            if bucket_df.empty:
                continue

            st.markdown(f"<div class='subtle-title' style='margin-top:8px;'>{bucket} Tactics</div>", unsafe_allow_html=True)

            row1 = st.columns(2)
            with row1[0]:
                st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
                render_side_split_bar_chart(bucket_df, "tactic_clean", "total_rounds", f"Usage ({bucket} • {map_name})", max_rows=12)
                st.markdown("</div>", unsafe_allow_html=True)
            with row1[1]:
                st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
                render_side_split_bar_chart(bucket_df, "tactic_clean", "win_rate_pct", f"Win Rate ({bucket} • {map_name})", max_rows=12)
                st.markdown("</div>", unsafe_allow_html=True)

            eligible = bucket_df[bucket_df["total_rounds"] >= 3].copy()
            if not eligible.empty:
                best = eligible.sort_values(["win_rate_pct", "total_rounds"], ascending=[False, False]).head(10)
                worst = eligible.sort_values(["win_rate_pct", "total_rounds"], ascending=[True, False]).head(10)

                row2 = st.columns(2)
                with row2[0]:
                    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
                    render_side_split_bar_chart(best, "tactic_clean", "win_rate_pct", f"Best {bucket} Tactics ({map_name})", max_rows=10)
                    st.markdown("</div>", unsafe_allow_html=True)
                with row2[1]:
                    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
                    render_side_split_bar_chart(worst, "tactic_clean", "win_rate_pct", f"Worst {bucket} Tactics ({map_name})", max_rows=10)
                    st.markdown("</div>", unsafe_allow_html=True)

        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        side_split = (
            map_df.groupby("side_clean", as_index=False)
            .agg(total_rounds=("total_rounds", "sum"))
        )
        render_altair_bar_chart(side_split, "side_clean", "total_rounds", f"Side Split ({map_name})", palette=SIDE_PALETTE, max_rows=10)
        st.markdown("</div>", unsafe_allow_html=True)

def render_all_matches_tab(matches_df: pd.DataFrame):
    st.markdown("<div class='section-title'>All Matches</div>", unsafe_allow_html=True)

    if matches_df.empty:
        st.info("No matches loaded.")
        return

    left, right = st.columns(2)

    with left:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        by_map = matches_df.groupby("map", as_index=False).agg(
            matches=("map", "count"),
            total_kills=("total_kills", "sum"),
        )
        if not by_map.empty:
            by_map["Map"] = by_map["map"].apply(pretty_label)
            render_color_bar_chart(by_map, "Map", "matches", "Matches By Map", MAP_PALETTE)
            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            render_color_bar_chart(by_map, "Map", "total_kills", "Total Kills By Map", MAP_PALETTE)
        else:
            st.info("No map data.")
        st.markdown("</div>", unsafe_allow_html=True)

    with right:
        st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
        by_comp = matches_df.groupby("competition", as_index=False).agg(
            matches=("competition", "count"),
            total_damage=("total_damage", "sum"),
        )
        if not by_comp.empty:
            by_comp["Competition"] = by_comp["competition"].apply(pretty_label)
            by_comp = by_comp.sort_values("matches", ascending=False).head(10)
            render_color_bar_chart(by_comp, "Competition", "matches", "Matches By Competition")
            st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
            render_color_bar_chart(by_comp, "Competition", "total_damage", "Damage By Competition")
        else:
            st.info("No competition data.")
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Raw Match List</div>", unsafe_allow_html=True)
    st.dataframe(compact_match_rows(matches_df), use_container_width=True, hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)

def render_achievement_debug(player_name: str, achievements_df: pd.DataFrame):
    st.subheader("Achievement Debugger")

    if achievements_df.empty:
        st.error("Achievements.csv loaded as empty")
        return

    st.write("Selected player:", player_name)
    st.write("Clean selected player:", clean_player_name(player_name))
    st.write("Columns:", list(achievements_df.columns))

    if "player" not in achievements_df.columns:
        st.error("Achievements.csv is missing a 'player' column")
        return

    debug_df = achievements_df.copy()
    debug_df["_player_exact"] = debug_df["player"].astype(str).str.strip()
    debug_df["_player_clean"] = debug_df["player"].astype(str).apply(clean_player_name)

    st.dataframe(
        debug_df[["player", "_player_exact", "_player_clean"]],
        use_container_width=True,
        hide_index=True,
    )

# -----------------------------
# Compact tables
# -----------------------------
def compact_player_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    keep_cols = [
        "date", "time", "competition", "map", "opponent_team", "tier",
        "kills", "deaths", "mvps", "kpd", "accuracy_pct", "hs_pct", "damage", "rounds_played"
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()
    out.columns = [pretty_label(c) for c in out.columns]
    return out

def compact_match_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    keep_cols = [
        "date", "time", "competition", "map", "team", "opponent_team", "tier",
        "total_kills", "total_deaths", "total_damage", "total_mvps", "players_used"
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()
    out.columns = [pretty_label(c) for c in out.columns]
    return out

def compact_tactics_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    keep_cols = [
        "competition", "map", "opponent_team", "tier", "side", "tactic_name",
        "wins", "losses", "total_rounds", "win_rate_pct"
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()
    out.columns = [pretty_label(c) for c in out.columns]
    return out

# -----------------------------
# Top title
# -----------------------------
st.markdown("<div class='main-title'>Grev's CPL Profile Page</div>", unsafe_allow_html=True)
st.markdown(
    "<div class='main-subtitle'>Integrated player profiles, match analysis, tactics, opponents, maps, form, and local data import controls.</div>",
    unsafe_allow_html=True,
)


# -----------------------------
# Layout
# -----------------------------
st.markdown("<div class='top-filter-shell'>", unsafe_allow_html=True)

players_path = str(PLAYERS_PATH)
tactics_path = str(TACTICS_PATH)
achievements_path = str(ACHIEVEMENTS_PATH)

players_df, tactics_df, matches_df, achievements_df = load_data(
    players_path,
    tactics_path,
    achievements_path,
)

if players_df.empty and tactics_df.empty:
    st.warning("No CSVs loaded yet.")
    st.stop()

player_options = get_player_options(players_df)
if not player_options:
    st.warning("No Medicart player found.")
    st.stop()

all_player_rows = players_df[players_df["player"].astype(str).str.startswith(PLAYER_PREFIX, na=False)].copy()
all_tactic_rows = (
    tactics_df[tactics_df["my_team"].astype(str).str.strip() == MY_TEAM_NAME].copy()
    if (not tactics_df.empty and "my_team" in tactics_df.columns)
    else pd.DataFrame()
)

all_comps = sorted(set(unique_sorted(all_player_rows, "competition") + unique_sorted(all_tactic_rows, "competition")))
all_maps = sorted(set(unique_sorted(all_player_rows, "map") + unique_sorted(all_tactic_rows, "map")))
all_tiers = sorted(set(unique_sorted(all_player_rows, "tier") + unique_sorted(all_tactic_rows, "tier")))
all_opps = sorted(set(unique_sorted(all_player_rows, "opponent_team") + unique_sorted(all_tactic_rows, "opponent_team")))
all_sides = unique_sorted(all_tactic_rows, "side")

selected_player = st.session_state.get("selected_player_main", player_options[0])
if selected_player not in player_options:
    selected_player = player_options[0]

top_a, top_b, top_c, top_d, top_e, top_f, top_g = st.columns(
    [1.35, 1.2, 1.0, 0.85, 1.05, 0.9, 1.0],
    gap="small"
)

with top_a:
    selected_player = st.selectbox(
        "Player",
        player_options,
        index=player_options.index(selected_player),
        key="top_player_select",
    )
    st.session_state["selected_player_main"] = selected_player

with top_b:
    selected_comp = st.multiselect("Competition", all_comps, key="top_comp")
with top_c:
    selected_map = st.multiselect("Map", all_maps, key="top_map")
with top_d:
    selected_tier = st.multiselect("Tier", all_tiers, key="top_tier")
with top_e:
    selected_opp = st.multiselect("Opponent", all_opps, key="top_opp")
with top_f:
    selected_side = st.multiselect("Tactic Side", all_sides, key="top_side")
with top_g:
    date_mode = st.selectbox(
        "Date Mode",
        ["All Dates", "After Date", "Before Date", "Between Dates"],
        key="top_date_mode",
    )

date_from = None
date_to = None
if date_mode == "After Date":
    date_from = st.date_input("After", key="top_after")
elif date_mode == "Before Date":
    date_to = st.date_input("Before", key="top_before")
elif date_mode == "Between Dates":
    d1, d2 = st.columns(2)
    with d1:
        date_from = st.date_input("From", key="top_from")
    with d2:
        date_to = st.date_input("To", key="top_to")

st.markdown("</div>", unsafe_allow_html=True)

filtered_players, filtered_tactics = apply_top_filters(
    players_df,
    tactics_df,
    selected_player,
    selected_comp,
    selected_map,
    selected_tier,
    selected_opp,
    selected_side,
    date_mode,
    date_from,
    date_to,
)

if filtered_players.empty:
    st.warning("No rows found for the selected player with the current filters.")
    st.stop()

render_profile_header(selected_player, filtered_players, achievements_df)

filtered_match_ids = set(filtered_players["match_id"].dropna().astype(str).unique()) | set(
    filtered_tactics["match_id"].dropna().astype(str).unique()
)

if not matches_df.empty and filtered_match_ids:
    filtered_matches = matches_df[matches_df["match_id"].astype(str).isin(filtered_match_ids)].copy()
else:
    filtered_matches = matches_df.copy()

filtered_matches = apply_date_filter(filtered_matches, date_mode, date_from, date_to)

team_visible_df = players_df.copy()
if not team_visible_df.empty:
    team_visible_df = team_visible_df[
        team_visible_df["player"].astype(str).str.startswith(PLAYER_PREFIX, na=False)
    ].copy()
    team_visible_df = apply_date_filter(team_visible_df, date_mode, date_from, date_to)

profile_tab, matches_tab, opponents_tab, maps_tab, form_tab, tactics_tab, tactical_breakdown_tab, all_matches_tab, debugger_tab, csv_tab = st.tabs(
    ["Profile", "Matches", "Opponents", "Maps", "Form", "Tactics", "Tactical Breakdown", "All Matches", "Debugger", "CSV Import"]
)

with profile_tab:
    render_profile_tab(filtered_players, team_visible_df)

with matches_tab:
    render_matches_tab(filtered_players, filtered_tactics)

with opponents_tab:
    render_opponents_tab(filtered_players, filtered_tactics)

with maps_tab:
    render_maps_tab(filtered_players, filtered_tactics)

with form_tab:
    render_form_tab(filtered_players, filtered_tactics)

with tactics_tab:
    render_tactics_tab(filtered_tactics)

with tactical_breakdown_tab:
    render_tactical_breakdown_tab(filtered_tactics)

with all_matches_tab:
    render_all_matches_tab(filtered_matches)

with debugger_tab:
    render_achievement_debug(selected_player, achievements_df)

with csv_tab:
    st.markdown("<div class='section-shell'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>CSV Import Area</div>", unsafe_allow_html=True)
    st.text_input("Players CSV", str(PLAYERS_PATH), key="players_csv_display")
    st.text_input("Tactics CSV", str(TACTICS_PATH), key="tactics_csv_display")
    st.text_input("Achievements CSV", str(ACHIEVEMENTS_PATH), key="achievements_csv_display")
    st.caption("Display box for local import paths.")
    st.markdown("</div>", unsafe_allow_html=True)
