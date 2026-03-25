# grev-dad-site

## CPL Playground

`/CPL_Playground/` now acts as a lightweight shell that loads the external Streamlit app directly:

- https://grev-dad-cpl-eoyv29wef8yyzq8ugnhkba.streamlit.app/

The previous in-repo CPL Streamlit source/data files were removed from `public/CPL_Playground/`.

## Streamlit HLTV viewer troubleshooting

If the HLTV viewer shows no players/data, this repository is **not** the source of truth for the Streamlit parser anymore; it only embeds the hosted app URL above.

For the Streamlit traceback below, the failure is usually caused by calling `.fillna()` on a scalar fallback value when a CSV column is missing:

```py
kills = pd.to_numeric(player_df.get("kills", 0), errors="coerce").fillna(0).sum()
```

Use a Series fallback instead:

```py
kills = pd.to_numeric(
    player_df.get("kills", pd.Series(0, index=player_df.index)),
    errors="coerce",
).fillna(0).sum()
```

And apply the same pattern to other numeric fields (`deaths`, `assists`, etc.) so missing columns do not crash metric calculation.

Also verify all three CSV loads succeed before rendering the player selector, and log row counts after each read to ensure the merge pipeline has input data.
