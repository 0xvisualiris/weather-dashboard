# Wetterstation Gründau — v6

Self-hosted weather dashboard combining a local Ecowitt station with DWD open data via the Bright Sky API.

## Changes in v6

- **Fix 1**: Corrected Ecowitt/radar marker to Gründau-Gettenbach (50.237°N, 9.158°E). Was incorrectly pointing to Bieber.
- **Fix 2**: DWD data now fetched via `lat/lon` instead of hardcoded `dwd_station_id`. Bright Sky auto-selects the nearest station and returns its name, distance, and coordinates dynamically. More reliable and future-proof.
- **Fix 3**: Alert banner always visible. When no warnings are active, a subtle green ✅ pill shows the last check time. When warnings exist, the expandable warning banner replaces it.

## Stack

- **Node.js + Express** — receives Ecowitt HTTP push, serves API and dashboard
- **Leaflet + DWD WMS** — rain radar
- **Bright Sky API** — DWD open data (no key, CORS-enabled)
- **Chart.js** — history charts
- **Docker** — single-container deploy via GitHub Actions → ghcr.io → Watchtower

## Ecowitt config (WS View Plus)

| Field     | Value               |
|-----------|---------------------|
| Protocol  | Ecowitt             |
| Server IP | TrueNAS IP          |
| Path      | `/data/report/`     |
| Port      | `3000`              |
| Interval  | `60s`               |

## Deploy

```bash
# Push to GitHub → Actions builds → Watchtower auto-updates
git add . && git commit -m "v6: fixes coord/dwd/alerts" && git push
```

Or manually on TrueNAS:
```bash
docker compose pull && docker compose up -d
```
