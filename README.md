# grev-dad-site

## Grevs CPL Area (Streamlit)

A new Streamlit admin playground is available at `public/CPL_Playground/` with two CPL manager tool areas:

- Player Profile Viewer
- Team Tactics Analyst

### Run locally

```bash
cd public/CPL_Playground
streamlit run app.py
```

### Host via Cloudflare

`/CPL_Playground/` now defaults to your site origin with `/cpl-playground-app/` appended when opened on a non-localhost domain.  
Example: `https://your-site.example/CPL_Playground/` loads `https://your-site.example/cpl-playground-app/`.

You can always override this by adding `?appUrl=https://your-streamlit-host.example.com` to the URL.

### Data source

CSV files can be committed directly into `public/CPL_Playground/data/` and are loaded by default:

- `player_profiles.csv`
- `team_tactics.csv`

Each page also supports ad-hoc CSV upload from the Streamlit UI.
