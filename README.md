# Wetterstation Gründau – v3

## Neu in dieser Version
- **Hero-Banner** mit Wetterbedingung, großer Temp, Gefühlter Temp, Min/Max, Taupunkt, Sonnenauf-/-untergang
- **Mini-Sparklines** (24h Trendlinie) am unteren Rand jeder Karte
- **Beaufort-Skala** auf der Wind-Karte
- **Regenintensitäts-Badge** (Kein Regen / Leichter / Mäßig / Starkregen)
- **Stale-Data-Banner** erscheint automatisch wenn Station > 5 Min. keine Daten sendet
- **Solar-Tagesmax** auf der UV-Karte
- Neuer API-Endpunkt: `GET /api/sparklines` (lightweight, letzte 24h)
- `today.tempMin`, `today.tempMax`, `today.solarMax` in `GET /api/weather`

## Deployment

```bash
# Auf TrueNAS (nach Git Push → GitHub Actions baut Image automatisch)
cd /mnt/tank/docker/weather-dashboard
docker compose pull && docker compose up -d
```

## Alle API-Endpunkte

| Endpunkt                       | Beschreibung                             |
|--------------------------------|------------------------------------------|
| `GET /`                        | Dashboard                                |
| `GET /api/weather`             | Aktuell + today Min/Max/SolarMax         |
| `GET /api/sparklines`          | Letzte 24h, minimale Payload             |
| `GET /api/history`             | Letzte ~4h (detailliert)                 |
| `GET /api/daily?from=&to=`     | Tagesdurchschnitte gefiltert nach Datum  |
| `POST /data/report/`           | Ecowitt Push-Empfänger                   |
