# Wetterstation Gründau – Self-hosted Dashboard

## Änderungen in dieser Version
- Indoor-Karte entfernt
- Kompass im Wind-Widget wiederhergestellt
- UV-Farbbalken wiederhergestellt
- Verlaufs-Graphen pro Karte (Klick auf das Icon oben rechts)
- Datepicker mit Schnellauswahl (7 Tage / 30 Tage / 3 Monate / Alles)
- Tägliche Zusammenfassungen werden automatisch gespeichert (`/data/daily.json`)
- Neuer API-Endpunkt: `GET /api/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Stack starten

```bash
docker compose pull
docker compose up -d
```

## Wetterstation konfigurieren (WS View Plus App)

| Feld              | Wert                     |
|-------------------|--------------------------|
| Protocol Type     | **Ecowitt**              |
| Server IP / Host  | `<deine Server-IP>`      |
| Path              | `/data/report/`          |
| Port              | `3000`                   |
| Upload interval   | `60` (Sekunden)          |

## API-Endpunkte

| Endpunkt                         | Beschreibung                            |
|----------------------------------|-----------------------------------------|
| `GET /`                          | Dashboard (HTML)                        |
| `GET /api/weather`               | Aktuellster Datensatz (JSON)            |
| `GET /api/history`               | Letzte ~4 Stunden (JSON-Array)          |
| `GET /api/daily`                 | Alle Tageszusammenfassungen             |
| `GET /api/daily?from=&to=`       | Tagesdaten gefiltert nach Datum         |
| `POST /data/report/`             | Ecowitt Push-Empfänger                  |

## Datenspeicherung

- `/data/weather.json` – aktueller Messwert + letzte 24h (Docker-Volume)
- `/data/daily.json`   – Tagesdurchschnitte seit erstem Empfang (Docker-Volume)
