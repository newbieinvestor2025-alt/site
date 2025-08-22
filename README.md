# Newbie Investor — bilingual static site (UA/EN) with YouTube auto‑feed

This site is ready for Netlify. It auto‑loads latest videos from the YouTube channel and shows channel stats if a YouTube Data API key is provided.

## Features
- Clean, modern styling
- UA/EN toggle (stored in localStorage)
- Latest videos section with thumbnails + client‑side pagination
- Mini block for the latest video in hero
- Channel stats (total videos, subscribers, views) when `YT_API_KEY` is set
- No API key required for basic feed (RSS fallback ~15 latest videos)
- Netlify Function: `/.netlify/functions/videos`

## Environment variables (Netlify → Site settings → Environment variables)
- `CHANNEL_ID` — required, your channel ID (not @handle). Find in YouTube Studio → Settings → Advanced → Channel ID.
- `YT_API_KEY` — optional. When present, the function will use YouTube Data API v3 to get full stats and up to `max` uploads.

## Local dev
```bash
npm i -g netlify-cli
netlify dev
# http://localhost:8888
# function at http://localhost:8888/.netlify/functions/videos
```

## Deploy
Push to Netlify or connect the repo. Make sure env vars are set and redeploy.
