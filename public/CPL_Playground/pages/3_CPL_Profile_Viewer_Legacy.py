from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="CPL Profile Viewer (Legacy)", page_icon="🗂️", layout="wide")

st.title("CPL Profile Viewer (Legacy)")
st.caption("Legacy CPL manager profile table view")

DATA_DIR = Path(__file__).resolve().parents[1]
LEGACY_DEFAULT_FILE = DATA_DIR / "data" / "player_profiles.csv"

st.markdown("This is the legacy profile viewer. Upload a CSV or use the original repository dataset.")

uploaded = st.file_uploader("Legacy player profiles CSV", type=["csv"])

if uploaded is not None:
    df = pd.read_csv(uploaded)
elif LEGACY_DEFAULT_FILE.exists():
    try:
        df = pd.read_csv(LEGACY_DEFAULT_FILE)
    except Exception:
        df = pd.read_csv(LEGACY_DEFAULT_FILE, sep=None, engine="python")
else:
    df = pd.DataFrame()

if df.empty:
    st.warning(
        "No legacy data loaded yet. Add `public/CPL_Playground/data/player_profiles.csv` or upload a CSV file."
    )
else:
    st.success(f"Loaded {len(df)} legacy player rows.")
    st.dataframe(df, use_container_width=True)

    player_column = "player" if "player" in df.columns else ("player_name" if "player_name" in df.columns else None)
    if player_column:
        player = st.selectbox("Select player", options=df[player_column].dropna().astype(str).unique())
        selected = df[df[player_column].astype(str) == player]
        st.subheader(f"Legacy profile: {player}")
        st.dataframe(selected, use_container_width=True)

if st.button("← Back to Grevs CPL Hub"):
    st.switch_page("app.py")
