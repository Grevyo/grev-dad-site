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
        "tactic_name": "A Main Burst",
        "category": "Standard",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "S",
        "wins": 6,
        "losses": 7,
        "recommendation_score": 81,
        "confidence": "High",
        "reason": "Reliable mid-round conversion when utility timings are clean.",
    },
    {
        "tactic_name": "A Main Burst",
        "category": "Standard",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "A",
        "wins": 9,
        "losses": 7,
        "recommendation_score": 81,
        "confidence": "High",
        "reason": "Reliable mid-round conversion when utility timings are clean.",
    },
    {
        "tactic_name": "A Main Burst",
        "category": "Standard",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "B",
        "wins": 11,
        "losses": 7,
        "recommendation_score": 81,
        "confidence": "High",
        "reason": "Reliable mid-round conversion when utility timings are clean.",
    },
    {
        "tactic_name": "A Main Burst",
        "category": "Standard",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "C",
        "wins": 12,
        "losses": 6,
        "recommendation_score": 81,
        "confidence": "High",
        "reason": "Reliable mid-round conversion when utility timings are clean.",
    },
    {
        "tactic_name": "Banana Mid-Crumble",
        "category": "Mid",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "S",
        "wins": 7,
        "losses": 9,
        "recommendation_score": 73,
        "confidence": "Medium",
        "reason": "Useful when opponents over-rotate toward A pressure.",
    },
    {
        "tactic_name": "Banana Mid-Crumble",
        "category": "Mid",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "A",
        "wins": 9,
        "losses": 8,
        "recommendation_score": 73,
        "confidence": "Medium",
        "reason": "Useful when opponents over-rotate toward A pressure.",
    },
    {
        "tactic_name": "Banana Mid-Crumble",
        "category": "Mid",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "B",
        "wins": 10,
        "losses": 7,
        "recommendation_score": 73,
        "confidence": "Medium",
        "reason": "Useful when opponents over-rotate toward A pressure.",
    },
    {
        "tactic_name": "Banana Mid-Crumble",
        "category": "Mid",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "C",
        "wins": 8,
        "losses": 7,
        "recommendation_score": 73,
        "confidence": "Medium",
        "reason": "Useful when opponents over-rotate toward A pressure.",
    },
    {
        "tactic_name": "Late Ivy Pinch",
        "category": "Ivy",
        "map": "Train",
        "side": "T",
        "enemy_tier": "A",
        "wins": 5,
        "losses": 6,
        "recommendation_score": 66,
        "confidence": "Medium",
        "reason": "Provides map-control insurance in slower defaults.",
    },
    {
        "tactic_name": "Late Ivy Pinch",
        "category": "Ivy",
        "map": "Train",
        "side": "T",
        "enemy_tier": "B",
        "wins": 7,
        "losses": 6,
        "recommendation_score": 66,
        "confidence": "Medium",
        "reason": "Provides map-control insurance in slower defaults.",
    },
    {
        "tactic_name": "Fast Pistol Arc",
        "category": "Pistol",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "S",
        "wins": 3,
        "losses": 9,
        "recommendation_score": 52,
        "confidence": "Low",
        "reason": "High variance opener; only retain for surprise value.",
    },
    {
        "tactic_name": "Fast Pistol Arc",
        "category": "Pistol",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "A",
        "wins": 6,
        "losses": 8,
        "recommendation_score": 52,
        "confidence": "Low",
        "reason": "High variance opener; only retain for surprise value.",
    },
    {
        "tactic_name": "Fast Pistol Arc",
        "category": "Pistol",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "B",
        "wins": 8,
        "losses": 7,
        "recommendation_score": 52,
        "confidence": "Low",
        "reason": "High variance opener; only retain for surprise value.",
    },
    {
        "tactic_name": "B Fake Reset",
        "category": "Eco",
        "map": "Inferno",
        "side": "T",
        "enemy_tier": "A",
        "wins": 4,
        "losses": 8,
        "recommendation_score": 46,
        "confidence": "Low",
        "reason": "Overlaps with stronger economy-round calls in this pool.",
    },
]

TIER_ORDER = ["S", "A", "B", "C"]
MIN_TIER_SAMPLE = 5


def normalize_records(data: Any) -> pd.DataFrame:
    """Return a clean dataframe from JSON/list/dict-shaped data."""
    if data is None:
        return pd.DataFrame()

    if isinstance(data, dict):
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
    blocked = {"red score", "blue score"}
    keep_columns = [col for col in df.columns if str(col).strip().lower() not in blocked]
    return df[keep_columns]


def resolve_grevscore(df: pd.DataFrame) -> float | None:
    score_column = next((col for col in df.columns if str(col).strip().lower() == "grevscore"), None)
    if score_column is None:
        return None

    series = pd.to_numeric(df[score_column], errors="coerce").dropna()
    if series.empty:
        return None

    return float(series.clip(lower=0, upper=100).mean())


def build_grevscore_gauge(score: float) -> go.Figure:
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


def render_table_section(sample_records: list[dict[str, Any]], uploader_label: str) -> None:
    use_sample = st.toggle("Use sample profile data", value=True)
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

    if df.empty:
        st.warning("No matching rows found.")
        return

    visible_df = remove_team_score_columns(df)
    grevscore = resolve_grevscore(df)

    name_column = next((col for col in visible_df.columns if str(col).strip().lower() == "name"), None)
    selected_row = visible_df.iloc[0]
    if name_column is not None:
        options = visible_df[name_column].astype(str).tolist()
        selected_name = st.selectbox("Player picker", options, index=0)
        matched = visible_df[visible_df[name_column].astype(str) == selected_name]
        if not matched.empty:
            selected_row = matched.iloc[0]
    else:
        st.selectbox("Player picker", ["Entry 1"], index=0, disabled=True)

    with st.expander("Profile filters", expanded=False):
        visible_df = filter_dataframe(visible_df, "Search profiles")
        if visible_df.empty:
            st.warning("No matching rows found.")
            return
        if name_column is not None:
            matched = visible_df[visible_df[name_column].astype(str) == selected_name]
            selected_row = matched.iloc[0] if not matched.empty else visible_df.iloc[0]
        else:
            selected_row = visible_df.iloc[0]

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
            file_name="profiles_filtered.csv",
            mime="text/csv",
        )
    with chart_col:
        st.markdown("##### Quick Metrics")
        row_numeric = pd.to_numeric(selected_row, errors="coerce").dropna()
        if not row_numeric.empty:
            metric_fig = go.Figure(
                data=[go.Bar(x=row_numeric.index.astype(str), y=row_numeric.values, marker_color="#3b82f6")]
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


def normalize_tactics_df(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {
        "name": "tactic_name",
        "tactic": "tactic_name",
        "type": "category",
        "tier": "enemy_tier",
    }
    for source, target in rename_map.items():
        if source in df.columns and target not in df.columns:
            df[target] = df[source]

    for required, default in {
        "tactic_name": "Unknown Tactic",
        "category": "Unlabeled",
        "map": "Unknown Map",
        "side": "T",
        "enemy_tier": "Unknown",
    }.items():
        if required not in df.columns:
            df[required] = default

    for numeric in ["wins", "losses", "recommendation_score"]:
        if numeric in df.columns:
            df[numeric] = pd.to_numeric(df[numeric], errors="coerce")

    if "wins" not in df.columns or "losses" not in df.columns:
        if "outcome" in df.columns:
            outcome = df["outcome"].astype(str).str.lower()
            df["wins"] = outcome.isin(["win", "w", "1", "true", "t"]).astype(int)
            df["losses"] = (~outcome.isin(["win", "w", "1", "true", "t"]) & outcome.ne("nan")).astype(int)
        else:
            df["wins"] = 0
            df["losses"] = 0

    if "recommendation_score" not in df.columns:
        total = df["wins"] + df["losses"]
        win_pct = (df["wins"] / total.replace(0, pd.NA)).fillna(0) * 100
        volume_bonus = total.clip(upper=40) / 40 * 18
        df["recommendation_score"] = (win_pct * 0.82 + volume_bonus).clip(0, 100)

    if "confidence" not in df.columns:
        total = (df["wins"] + df["losses"]).fillna(0)
        df["confidence"] = pd.cut(
            total,
            bins=[-1, 5, 12, 9999],
            labels=["Low", "Medium", "High"],
        ).astype(str)

    if "reason" not in df.columns:
        df["reason"] = "Selected by score-volume balance in current map + side context."

    df["enemy_tier"] = df["enemy_tier"].astype(str).str.upper().where(
        df["enemy_tier"].astype(str).str.upper().isin(TIER_ORDER),
        "Unknown",
    )
    return df


def classify_keep_priority(score: float) -> dict[str, str]:
    if score >= 85:
        return {"label": "Core pick", "bucket": "core"}
    if score >= 75:
        return {"label": "Strong keep", "bucket": "strong"}
    if score >= 65:
        return {"label": "Useful keep", "bucket": "useful"}
    if score >= 55:
        return {"label": "Situational", "bucket": "situational"}
    return {"label": "Tentative", "bucket": "tentative"}


def keep_priority_color_token(bucket: str) -> dict[str, str]:
    tokens = {
        "core": {"bg": "#052e16", "border": "#22c55e", "chip": "#16a34a", "text": "#dcfce7"},
        "strong": {"bg": "#0f3b3a", "border": "#14b8a6", "chip": "#0d9488", "text": "#ccfbf1"},
        "useful": {"bg": "#172554", "border": "#3b82f6", "chip": "#2563eb", "text": "#dbeafe"},
        "situational": {"bg": "#451a03", "border": "#f59e0b", "chip": "#d97706", "text": "#fef3c7"},
        "tentative": {"bg": "#4c0519", "border": "#f97316", "chip": "#ea580c", "text": "#ffedd5"},
    }
    return tokens.get(bucket, tokens["useful"])


def compute_tactic_vs_tier_summary(
    context_df: pd.DataFrame,
    tactic_name: str,
    map_name: str,
    side_name: str,
    min_sample: int = MIN_TIER_SAMPLE,
) -> dict[str, dict[str, str | int | None]]:
    scoped = context_df[
        (context_df["map"].astype(str) == map_name)
        & (context_df["side"].astype(str) == side_name)
        & (context_df["tactic_name"].astype(str) == tactic_name)
    ]

    summary: dict[str, dict[str, str | int | None]] = {}
    for tier in TIER_ORDER:
        tier_rows = scoped[scoped["enemy_tier"].astype(str) == tier]
        wins = int(pd.to_numeric(tier_rows["wins"], errors="coerce").fillna(0).sum())
        losses = int(pd.to_numeric(tier_rows["losses"], errors="coerce").fillna(0).sum())
        sample = wins + losses
        if sample < min_sample:
            summary[tier] = {"sample": sample, "win_pct": None, "display": "n/a"}
        else:
            summary[tier] = {
                "sample": sample,
                "win_pct": round((wins / sample) * 100, 1),
                "display": f"{(wins / sample) * 100:.0f}%",
            }
    return summary


def render_tier_row(tier_summary: dict[str, dict[str, str | int | None]], compact: bool = False) -> str:
    parts = []
    for tier in TIER_ORDER:
        val = tier_summary.get(tier, {"display": "—"}).get("display", "—")
        if compact:
            parts.append(f"<span class='tier-pill'><b>{tier}</b> {val}</span>")
        else:
            parts.append(f"<span class='tier-pill'>vs {tier} {val}</span>")
    return "".join(parts)


def render_legend_help_strip() -> None:
    legend = [
        ("Core / high-priority keep", keep_priority_color_token("core")["chip"]),
        ("Strong keep", keep_priority_color_token("strong")["chip"]),
        ("Useful keep", keep_priority_color_token("useful")["chip"]),
        ("Situational", keep_priority_color_token("situational")["chip"]),
        ("Tentative / weak hold", keep_priority_color_token("tentative")["chip"]),
    ]
    swatches = "".join(
        f"<div class='legend-item'><span class='legend-dot' style='background:{color}'></span>{label}</div>"
        for label, color in legend
    )
    st.markdown(
        f"""
        <div class='legend-wrap'>
          <div class='legend-title'>Recommendation-strength legend</div>
          <div class='legend-grid'>{swatches}</div>
          <div class='legend-foot'>Card colours indicate keep priority. Category is displayed only via compact label chips (Pistol, Eco, Standard, Mid, Ivy).</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_tactical_recommendations() -> None:
    st.markdown(
        """
        <style>
        .legend-wrap {border:1px solid #334155; border-radius:12px; padding:12px; margin-bottom:14px; background:#0b1220;}
        .legend-title {font-weight:700; margin-bottom:8px;}
        .legend-grid {display:flex; flex-wrap:wrap; gap:8px 14px;}
        .legend-item {display:flex; align-items:center; gap:8px; font-size:0.86rem; color:#dbe7ff;}
        .legend-dot {width:12px; height:12px; border-radius:999px; display:inline-block;}
        .legend-foot {font-size:0.83rem; margin-top:10px; color:#9fb3d9;}
        .tactic-card {padding:12px; border-radius:12px; border:1px solid; margin-bottom:10px;}
        .tactic-header {display:flex; justify-content:space-between; align-items:flex-start; gap:10px;}
        .tag-row {display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;}
        .chip {padding:2px 8px; border-radius:999px; font-size:0.74rem; border:1px solid #3b4d6d; background:#0f172a; color:#dbeafe;}
        .kchip {padding:2px 8px; border-radius:999px; font-size:0.74rem; font-weight:700;}
        .stat-grid {display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; margin-top:8px;}
        .stat {font-size:0.78rem; color:#d5def3;}
        .stat b {display:block; font-size:0.92rem; color:white;}
        .tier-row {display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;}
        .tier-pill {padding:2px 8px; border-radius:999px; font-size:0.75rem; background:#0f1e38; border:1px solid #2d4f87; color:#dbeafe;}
        .reason {margin-top:8px; font-size:0.84rem; color:#e2e8f0;}
        .alt-row {padding:8px 10px; border-radius:10px; border:1px solid; margin-bottom:8px;}
        </style>
        """,
        unsafe_allow_html=True,
    )

    use_sample = st.toggle("Use sample tactics data", value=True)
    upload = st.file_uploader("Upload tactics data (.json or .csv)", type=["json", "csv"], key="tactics-upload")

    if upload is None and use_sample:
        raw = pd.DataFrame(SAMPLE_TACTICS)
    elif upload is None:
        st.info("Upload tactics data or enable sample mode to generate tactical set recommendations.")
        return
    elif upload.name.lower().endswith(".json"):
        raw = load_uploaded_json(upload)
    else:
        raw = pd.read_csv(upload)

    if raw.empty:
        st.warning("No tactics rows available.")
        return

    df = normalize_tactics_df(raw.copy())

    filter_cols = st.columns([1.1, 1.0, 0.8, 1.2], gap="small")
    with filter_cols[0]:
        map_name = st.selectbox("Map", sorted(df["map"].astype(str).unique()))
    with filter_cols[1]:
        side_name = st.selectbox("Side", sorted(df["side"].astype(str).unique()))
    with filter_cols[2]:
        max_recs = st.slider("Max recommendations", 1, 8, 4)
    with filter_cols[3]:
        min_tier_sample = st.slider("Min sample for tier %", 1, 12, MIN_TIER_SAMPLE)

    render_legend_help_strip()

    context_df = df[(df["map"].astype(str) == map_name) & (df["side"].astype(str) == side_name)]
    if context_df.empty:
        st.warning("No tactics available for this map + side context.")
        return

    grouped = (
        context_df.groupby(["tactic_name", "category"], dropna=False)
        .agg(
            wins=("wins", "sum"),
            losses=("losses", "sum"),
            recommendation_score=("recommendation_score", "mean"),
            confidence=("confidence", "first"),
            reason=("reason", "first"),
        )
        .reset_index()
    )
    grouped["sample"] = grouped["wins"] + grouped["losses"]
    grouped["win_pct"] = (grouped["wins"] / grouped["sample"].replace(0, pd.NA) * 100).fillna(0)

    overall_sample = context_df["wins"].sum() + context_df["losses"].sum()
    overall_win_pct = (context_df["wins"].sum() / overall_sample * 100) if overall_sample else 0
    category_baseline = (
        context_df.groupby("category", dropna=False)
        .apply(lambda g: (g["wins"].sum() / (g["wins"].sum() + g["losses"].sum()) * 100) if (g["wins"].sum() + g["losses"].sum()) else 0)
        .to_dict()
    )

    recs = grouped.sort_values(["recommendation_score", "sample"], ascending=[False, False]).reset_index(drop=True)
    selected = recs.head(max_recs).copy()
    alternatives = recs.iloc[max_recs:].copy()

    st.subheader("Tactical Set Recommendations")
    st.caption("Colour intensity now reflects recommendation strength / keep-priority only.")

    for _, row in selected.iterrows():
        score = float(row["recommendation_score"])
        keep_priority = classify_keep_priority(score)
        colors = keep_priority_color_token(keep_priority["bucket"])
        tier_summary = compute_tactic_vs_tier_summary(
            context_df=context_df,
            tactic_name=str(row["tactic_name"]),
            map_name=map_name,
            side_name=side_name,
            min_sample=min_tier_sample,
        )
        delta_local = row["win_pct"] - overall_win_pct
        delta_category = row["win_pct"] - category_baseline.get(row["category"], overall_win_pct)

        st.markdown(
            f"""
            <div class='tactic-card' style='background:{colors["bg"]}; border-color:{colors["border"]}; color:{colors["text"]}'>
              <div class='tactic-header'>
                <div>
                  <div style='font-size:1.03rem; font-weight:700'>{row['tactic_name']}</div>
                  <div class='tag-row'>
                    <span class='chip'>{row['category']}</span>
                    <span class='chip'>{map_name} · {side_name}</span>
                    <span class='kchip' style='background:{colors['chip']}; color:white'>{keep_priority['label']}</span>
                    <span class='chip'>{row['confidence']} confidence</span>
                  </div>
                </div>
                <div style='text-align:right;'>
                    <div style='font-size:0.73rem'>Recommendation Score</div>
                    <div style='font-size:1.2rem; font-weight:700'>{score:.1f}</div>
                </div>
              </div>
              <div class='stat-grid'>
                <div class='stat'><b>{int(row['sample'])}</b>Usage sample</div>
                <div class='stat'><b>{row['win_pct']:.1f}%</b>Win %</div>
                <div class='stat'><b>{delta_category:+.1f} pp</b>Δ vs category baseline</div>
              </div>
              <div class='stat' style='margin-top:6px'><b>{delta_local:+.1f} pp</b>Δ vs local map/side baseline</div>
              <div class='tier-row'>{render_tier_row(tier_summary)}</div>
              <div class='reason'><b>Why selected:</b> {row['reason']}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("##### Bench / Alternatives")
    if alternatives.empty:
        st.info("No additional alternatives after selected set cap.")
        return

    for _, row in alternatives.iterrows():
        score = float(row["recommendation_score"])
        keep_priority = classify_keep_priority(score)
        colors = keep_priority_color_token(keep_priority["bucket"])

        if score >= 65:
            bench_reason = "Bench but viable"
        elif score >= 55:
            bench_reason = "Coverage option"
        elif str(row["confidence"]).lower() == "low":
            bench_reason = "Low-confidence alternative"
        else:
            bench_reason = "Overlap with stronger pick"

        tier_summary = compute_tactic_vs_tier_summary(
            context_df=context_df,
            tactic_name=str(row["tactic_name"]),
            map_name=map_name,
            side_name=side_name,
            min_sample=min_tier_sample,
        )

        st.markdown(
            f"""
            <div class='alt-row' style='background:{colors["bg"]}; border-color:{colors["border"]}; color:{colors["text"]}'>
              <div style='display:flex; justify-content:space-between; gap:8px;'>
                <div>
                  <b>{row['tactic_name']}</b> <span class='chip'>{row['category']}</span>
                  <span class='kchip' style='background:{colors['chip']}; color:white'>{keep_priority['label']}</span>
                  <span class='chip'>{bench_reason}</span>
                </div>
                <div>Score {score:.1f}</div>
              </div>
              <div class='tier-row' style='margin-top:6px'>{render_tier_row(tier_summary, compact=True)}</div>
              <div class='reason' style='margin-top:6px'><b>Why not selected:</b> {row['reason']}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


st.title("Grev's CPL Dashboard")
st.write("Player analytics, form, achievements, and performance breakdowns.")

profile_tab, tactical_tab = st.tabs(["Profile Viewer", "Tactical Set Recommendations"])

with profile_tab:
    render_table_section(
        sample_records=SAMPLE_PROFILES,
        uploader_label="Upload profiles data (.json or .csv)",
    )

with tactical_tab:
    render_tactical_recommendations()
