from pathlib import Path

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Grevs CPL Hub", page_icon="⚽", layout="wide")

st.title("Grevs CPL Hub")
st.caption("Admin playground for CPL analytics workflows.")

st.markdown(
    "Use the tools below to open player and tactical analysis pages. "
    "The dashboard reads the committed CPL CSV sources from `cpl_playground/cpldata/`."
)

CPL_DATA_DIR = Path(__file__).resolve().parent / "cpldata"
PLAYER_STATS_FILE = CPL_DATA_DIR / "PlayerDataMatser.csv"
TACTIC_STATS_FILE = CPL_DATA_DIR / "TacticsDataMaster.csv"
ACHIEVEMENTS_FILE = CPL_DATA_DIR / "Achievements.csv"


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except Exception:
        try:
            return pd.read_csv(path, sep=None, engine="python")
        except Exception:
            return pd.DataFrame()


player_df = load_csv(PLAYER_STATS_FILE)
tactic_df = load_csv(TACTIC_STATS_FILE)
achievements_df = load_csv(ACHIEVEMENTS_FILE)

metric_a, metric_b, metric_c = st.columns(3)
metric_a.metric("Player stats rows", len(player_df))
metric_b.metric("Tactic stats rows", len(tactic_df))
metric_c.metric("Achievements rows", len(achievements_df))

st.divider()

left, right = st.columns(2)

with left:
    st.subheader("HLTV Like Player Profile")
    st.write("Open player-focused CPL performance profiles from CSV-backed data.")
    if st.button("HLTV Like Player Profile", use_container_width=True, type="primary"):
        st.switch_page("pages/1_Player_Profile_Viewer.py")

with right:
    st.subheader("CPL Tactical Analyst")
    st.write("Open tactical summaries to inspect map-side strategy outcomes.")
    if st.button("CPL Tactical Analyst", use_container_width=True, type="primary"):
        st.switch_page("pages/2_Team_Tactics_Analyst.py")

st.divider()
st.info(f"CPL CSV directory: `{CPL_DATA_DIR}`")
