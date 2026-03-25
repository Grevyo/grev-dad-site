from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Team Tactics Analyst", page_icon="📊", layout="wide")

st.title("Team Tactics Analyst")
st.caption("CPL manager project area")

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEFAULT_FILE = DATA_DIR / "team_tactics.csv"

st.markdown("Upload a CSV now or keep using the default local CSV from the repository.")

uploaded = st.file_uploader("Team tactics CSV", type=["csv"])

if uploaded is not None:
    df = pd.read_csv(uploaded)
elif DEFAULT_FILE.exists():
    df = pd.read_csv(DEFAULT_FILE)
else:
    df = pd.DataFrame()

if df.empty:
    st.warning(
        "No team tactics data loaded yet. Add `cpl_playground/data/team_tactics.csv` or upload a CSV file."
    )
else:
    st.success(f"Loaded {len(df)} team rows.")
    st.dataframe(df, use_container_width=True)

    if "team_name" in df.columns:
        team = st.selectbox("Select team", options=df["team_name"].dropna().astype(str).unique())
        selected = df[df["team_name"].astype(str) == team]
        st.subheader(f"Tactics snapshot: {team}")
        st.dataframe(selected, use_container_width=True)

if st.button("← Back to Grevs CPL Area"):
    st.switch_page("app.py")
