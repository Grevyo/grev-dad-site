from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="HLTV Like Player Profile", page_icon="👤", layout="wide")

st.title("HLTV Like Player Profile")
st.caption("CPL manager project area")

DATA_DIR = Path(__file__).resolve().parents[1] / "cpldata"
DEFAULT_FILE = DATA_DIR / "PlayerDataMatser.csv"

st.markdown("Upload a CSV now or keep using the default local CSV from the repository.")

uploaded = st.file_uploader("Player profiles CSV", type=["csv"])

if uploaded is not None:
    df = pd.read_csv(uploaded)
elif DEFAULT_FILE.exists():
    try:
        df = pd.read_csv(DEFAULT_FILE)
    except Exception:
        df = pd.read_csv(DEFAULT_FILE, sep=None, engine="python")
else:
    df = pd.DataFrame()

if df.empty:
    st.warning(
        "No player data loaded yet. Add `public/CPL_Playground/cpldata/PlayerDataMatser.csv` or upload a CSV file."
    )
else:
    st.success(f"Loaded {len(df)} player rows.")
    st.dataframe(df, use_container_width=True)

    player_column = "player" if "player" in df.columns else ("player_name" if "player_name" in df.columns else None)
    if player_column:
        player = st.selectbox("Select player", options=df[player_column].dropna().astype(str).unique())
        selected = df[df[player_column].astype(str) == player]
        st.subheader(f"Profile: {player}")
        st.dataframe(selected, use_container_width=True)

if st.button("← Back to Grevs CPL Area"):
    st.switch_page("app.py")
