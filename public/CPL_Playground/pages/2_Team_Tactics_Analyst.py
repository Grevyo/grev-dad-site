from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="CPL Tactical Analyst", page_icon="📊", layout="wide")

st.title("CPL Tactical Analyst")
st.caption("CPL manager project area")

DATA_DIR = Path(__file__).resolve().parents[1] / "cpldata"
DEFAULT_FILE = DATA_DIR / "TacticsDataMaster.csv"

st.markdown("Upload a CSV now or keep using the default local CSV from the repository.")

uploaded = st.file_uploader("Team tactics CSV", type=["csv"])

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
        "No team tactics data loaded yet. Add `public/CPL_Playground/cpldata/TacticsDataMaster.csv` or upload a CSV file."
    )
else:
    st.success(f"Loaded {len(df)} team rows.")
    st.dataframe(df, use_container_width=True)

    team_column = "my_team" if "my_team" in df.columns else ("team_name" if "team_name" in df.columns else None)
    if team_column:
        team = st.selectbox("Select team", options=df[team_column].dropna().astype(str).unique())
        selected = df[df[team_column].astype(str) == team]
        st.subheader(f"Tactics snapshot: {team}")
        st.dataframe(selected, use_container_width=True)

if st.button("← Back to Grevs CPL Area"):
    st.switch_page("app.py")
