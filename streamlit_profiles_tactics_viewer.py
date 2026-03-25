"""
Streamlit app: Profiles and Tactics Viewer

Run:
  streamlit run streamlit_profiles_tactics_viewer.py
"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd
import streamlit as st


st.set_page_config(
    page_title="Profiles & Tactics Viewer",
    page_icon="🎯",
    layout="wide",
)


SAMPLE_PROFILES = [
    {
        "name": "Entry Fragger",
        "role": "Aggressive Initiator",
        "preferred_loadout": "Rifle + Utility",
        "strength": "Fast site entries",
        "risk": "High early-round exposure",
    },
    {
        "name": "Support Anchor",
        "role": "Defensive Utility",
        "preferred_loadout": "SMG + Full Utility",
        "strength": "Late-round retake setups",
        "risk": "Can be isolated on rotates",
    },
]

SAMPLE_TACTICS = [
    {
        "tactic": "A Split Pressure",
        "phase": "Mid-round",
        "objective": "Force rotations and create opening duels",
        "key_steps": "Default map control, smoke heaven, split from short and long",
        "difficulty": "Medium",
    },
    {
        "tactic": "Slow Contact B",
        "phase": "Late-round",
        "objective": "Exploit over-rotations and low utility",
        "key_steps": "Hold defaults, fake mid utility, contact walk through B",
        "difficulty": "Hard",
    },
]


def normalize_records(data: Any) -> pd.DataFrame:
    """Return a clean dataframe from JSON/list/dict-shaped data."""
    if data is None:
        return pd.DataFrame()

    if isinstance(data, dict):
        # Accept either a dict of lists or a single record.
        if all(isinstance(v, list) for v in data.values()):
            return pd.DataFrame(data)
        return pd.DataFrame([data])

    if isinstance(data, list):
        if not data:
            return pd.DataFrame()
        if all(isinstance(item, dict) for item in data):
            return pd.DataFrame(data)
        return pd.DataFrame({"value": data})

    return pd.DataFrame({"value": [str(data)]})


@st.cache_data(show_spinner=False)
def load_uploaded_json(file) -> pd.DataFrame:
    payload = json.load(file)
    return normalize_records(payload)


def filter_dataframe(df: pd.DataFrame, search_label: str) -> pd.DataFrame:
    if df.empty:
        return df

    query = st.text_input(search_label, "").strip().lower()
    if not query:
        return df

    mask = df.astype(str).apply(lambda col: col.str.lower().str.contains(query, na=False))
    return df[mask.any(axis=1)]


def render_table_section(
    title: str,
    sample_records: list[dict[str, Any]],
    uploader_label: str,
    search_label: str,
) -> None:
    st.subheader(title)
    st.caption("Upload a JSON/CSV file or use the built-in sample data.")

    use_sample = st.toggle(f"Use sample {title.lower()} data", value=True)
    upload = st.file_uploader(
        uploader_label,
        type=["json", "csv"],
        accept_multiple_files=False,
    )

    if upload is None and use_sample:
        df = pd.DataFrame(sample_records)
    elif upload is None:
        st.info("Upload data or enable sample mode to view entries.")
        return
    else:
        if upload.name.lower().endswith(".json"):
            df = load_uploaded_json(upload)
        else:
            df = pd.read_csv(upload)

    df = filter_dataframe(df, search_label)

    if df.empty:
        st.warning("No matching rows found.")
        return

    left, right = st.columns([3, 1])
    with left:
        st.dataframe(df, use_container_width=True, hide_index=True)
    with right:
        st.metric("Rows", len(df))
        st.metric("Columns", len(df.columns))
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download filtered CSV",
            data=csv,
            file_name=f"{title.lower().replace(' ', '_')}_filtered.csv",
            mime="text/csv",
        )


st.title("🎯 Profiles and Tactics Viewer")
st.write(
    "Browse player profiles and tactical playbooks side-by-side. "
    "Use sample records or upload your own JSON/CSV datasets."
)

profiles_tab, tactics_tab = st.tabs(["Profiles", "Tactics Viewer"])

with profiles_tab:
    render_table_section(
        title="Profiles",
        sample_records=SAMPLE_PROFILES,
        uploader_label="Upload profiles data (.json or .csv)",
        search_label="Search profiles",
    )

with tactics_tab:
    render_table_section(
        title="Tactics Viewer",
        sample_records=SAMPLE_TACTICS,
        uploader_label="Upload tactics data (.json or .csv)",
        search_label="Search tactics",
    )
