"""
Streamlit app: Profiles and Tactics Viewer

Run:
  streamlit run streamlit_profiles_tactics_viewer.py
"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd
import plotly.graph_objects as go
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
        "GrevScore": 78,
        "Red score": 71,
        "Blue score": 64,
    },
    {
        "name": "Support Anchor",
        "role": "Defensive Utility",
        "preferred_loadout": "SMG + Full Utility",
        "strength": "Late-round retake setups",
        "risk": "Can be isolated on rotates",
        "GrevScore": 62,
        "Red score": 58,
        "Blue score": 67,
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


def remove_team_score_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Remove Red score / Blue score columns from table display."""
    blocked = {"red score", "blue score"}
    keep_columns = [col for col in df.columns if str(col).strip().lower() not in blocked]
    return df[keep_columns]


def resolve_grevscore(df: pd.DataFrame) -> float | None:
    """Return an averaged GrevScore value between 0 and 100 when available."""
    score_column = next((col for col in df.columns if str(col).strip().lower() == "grevscore"), None)
    if score_column is None:
        return None

    series = pd.to_numeric(df[score_column], errors="coerce").dropna()
    if series.empty:
        return None

    return float(series.clip(lower=0, upper=100).mean())


def build_grevscore_gauge(score: float) -> go.Figure:
    """Build a compact gauge chart for GrevScore."""
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=score,
            number={"suffix": " / 100", "font": {"size": 36}},
            title={"text": "GrevScore", "font": {"size": 28}},
            gauge={
                "axis": {"range": [0, 100], "tickwidth": 1, "tickcolor": "#6b7280"},
                "bar": {"color": "#3b82f6", "thickness": 0.26},
                "bgcolor": "#0f172a",
                "steps": [
                    {"range": [0, 35], "color": "#7f1d1d"},
                    {"range": [35, 70], "color": "#78350f"},
                    {"range": [70, 100], "color": "#14532d"},
                ],
                "threshold": {
                    "line": {"color": "#e5e7eb", "width": 5},
                    "thickness": 0.75,
                    "value": score,
                },
            },
            domain={"x": [0, 1], "y": [0, 1]},
        )
    )
    fig.update_layout(
        height=250,
        margin=dict(l=10, r=10, t=40, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        font={"color": "#e5e7eb"},
    )
    return fig


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

    visible_df = remove_team_score_columns(df)
    grevscore = resolve_grevscore(df)

    selected_row = visible_df.iloc[0]
    name_column = next((col for col in visible_df.columns if str(col).strip().lower() == "name"), None)
    if name_column is not None:
        options = visible_df[name_column].astype(str).tolist()
        selected_name = st.selectbox(f"Pick an entry from {title.lower()} to inspect", options, index=0)
        matched = visible_df[visible_df[name_column].astype(str) == selected_name]
        if not matched.empty:
            selected_row = matched.iloc[0]

    top_left, top_mid, top_right = st.columns([1.2, 1.4, 1.2], gap="medium")
    with top_left:
        st.markdown("##### Player Card")
        card_lines = []
        for label in ("name", "role", "preferred_loadout", "strength", "risk"):
            column = next((col for col in visible_df.columns if str(col).strip().lower() == label), None)
            if column is not None:
                card_lines.append(f"**{column}:** {selected_row[column]}")
        if card_lines:
            st.markdown("\n\n".join(card_lines))
        else:
            st.info("No player profile fields detected in this dataset.")

    with top_mid:
        st.markdown("##### GrevScore")
        row_score = None
        row_score_column = next(
            (col for col in visible_df.columns if str(col).strip().lower() == "grevscore"),
            None,
        )
        if row_score_column is not None:
            row_score = pd.to_numeric(pd.Series([selected_row[row_score_column]]), errors="coerce").dropna()
            if not row_score.empty:
                row_score = float(row_score.iloc[0])

        score_to_render = row_score if row_score is not None else grevscore
        if score_to_render is not None:
            st.plotly_chart(build_grevscore_gauge(score_to_render), use_container_width=True)
            st.caption("Selected profile GrevScore (or filtered average if unavailable).")
        else:
            st.info("Add a GrevScore column (0-100) to render the score gauge.")

    with top_right:
        st.markdown("##### Headline Stats")
        st.metric("Filtered Rows", len(visible_df))
        st.metric("Visible Columns", len(visible_df.columns))
        numeric_cols = visible_df.select_dtypes(include="number")
        if not numeric_cols.empty:
            st.metric("Avg Numeric Value", f"{numeric_cols.mean(numeric_only=True).mean():.1f}")

    st.markdown("##### Data Table")
    table_col, chart_col = st.columns([2.2, 1], gap="medium")
    with table_col:
        st.dataframe(visible_df, use_container_width=True, hide_index=True)
        csv = visible_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download filtered CSV",
            data=csv,
            file_name=f"{title.lower().replace(' ', '_')}_filtered.csv",
            mime="text/csv",
        )
    with chart_col:
        st.markdown("##### Quick Metrics")
        row_numeric = pd.to_numeric(selected_row, errors="coerce").dropna()
        if not row_numeric.empty:
            metric_fig = go.Figure(
                data=[
                    go.Bar(
                        x=row_numeric.index.astype(str),
                        y=row_numeric.values,
                        marker_color="#3b82f6",
                    )
                ]
            )
            metric_fig.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                yaxis_title="Value",
            )
            st.plotly_chart(metric_fig, use_container_width=True)
        else:
            st.info("No numeric fields available for quick metric chart.")


st.title("HLTV CPL Profile Viewer")
st.write("Player analytics, form, achievements, and performance breakdowns.")

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
