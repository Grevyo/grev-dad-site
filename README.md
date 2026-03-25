# grev-dad-site

## Grevs CPL Area (Streamlit)

A new Streamlit admin playground is available at `cpl_playground/` with two CPL manager tool areas:

- Player Profile Viewer
- Team Tactics Analyst

### Run locally

```bash
cd cpl_playground
streamlit run app.py
```

### Data source

CSV files can be committed directly into `cpl_playground/data/` and are loaded by default:

- `player_profiles.csv`
- `team_tactics.csv`

Each page also supports ad-hoc CSV upload from the Streamlit UI.
