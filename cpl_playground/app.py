from pathlib import Path

import streamlit as st

st.set_page_config(page_title="Grevs CPL Area", page_icon="⚽", layout="wide")

st.title("Grevs CPL Area")
st.caption(
    "Admin playground for CPL manager tools powered by Streamlit and local CSV data imports."
)

st.markdown(
    "Use the buttons below to open each project area. CSV files can be committed "
    "to this repository under `cpl_playground/data/` and loaded inside each tool."
)

left, right = st.columns(2)

with left:
    st.subheader("Player Profile Viewer")
    st.write("Browse player datasets and inspect individual profile details.")
    if st.button("Open Player Profile Viewer", use_container_width=True, type="primary"):
        st.switch_page("pages/1_Player_Profile_Viewer.py")

with right:
    st.subheader("Team Tactics Analyst")
    st.write("Review team-level metrics and tactical summaries from CSV inputs.")
    if st.button("Open Team Tactics Analyst", use_container_width=True, type="primary"):
        st.switch_page("pages/2_Team_Tactics_Analyst.py")

st.divider()

base_data_dir = Path(__file__).resolve().parent / "data"
st.info(f"Local CSV directory: `{base_data_dir}`")
