from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Player Profile Viewer", page_icon="👤", layout="wide")

st.title("Player Profile Viewer")
st.caption("CPL manager project area")

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEFAULT_FILE = DATA_DIR / "player_profiles.csv"

st.markdown("Upload a CSV now or keep using the default local CSV from the repository.")

uploaded = st.file_uploader("Player profiles CSV", type=["csv"])

if uploaded is not None:
    df = pd.read_csv(uploaded)
elif DEFAULT_FILE.exists():
    df = pd.read_csv(DEFAULT_FILE)
else:
    df = pd.DataFrame()

if df.empty:
    st.warning(
        "No player data loaded yet. Add `cpl_playground/data/player_profiles.csv` or upload a CSV file."
    )
else:
    st.success(f"Loaded {len(df)} player rows.")
    st.dataframe(df, use_container_width=True)

    if "player_name" in df.columns:
        player = st.selectbox("Select player", options=df["player_name"].dropna().astype(str).unique())
        selected = df[df["player_name"].astype(str) == player]
        st.subheader(f"Profile: {player}")
        st.dataframe(selected, use_container_width=True)

if st.button("← Back to Grevs CPL Area"):
    st.switch_page("app.py")
