# 🌤 Wetterstation Gründau

> **Hobby-Projekt · 100% vibecoded · keine aktive Wartung**
>
> Dieses Projekt ist in meiner Freizeit entstanden und wird nicht regelmäßig gepflegt. Es läuft bei mir zuverlässig — aber Issues und Pull Requests beantworte ich nur wenn ich Zeit habe.

![Dashboard Screenshot](./screenshot.png)

---

## Was dieses Dashboard zeigt

Ein self-hosted Wetter-Dashboard für Ecowitt-Wetterstationen mit lokalem HTTP-Push. Keine Cloud, keine externen Dienste — die Daten bleiben im eigenen Netzwerk.

**Live-Ansicht (alle 30 Sekunden aktualisiert):**

- **Hero-Banner** — aktuelle Wetterlage (Heiter / Bewölkt / Regen / Gewitter), Temperatur, gefühlte Temperatur, Tages-Min/Max, Taupunkt, Sonnenauf- und -untergang
- **Außentemperatur** — mit Luftfeuchtigkeit, gefühlter Temperatur und Taupunkt
- **Wind** — Kompassnadel, Geschwindigkeit, Böen, Beaufort-Skala mit Klartext
- **Niederschlag** — aktuelle Rate, Ereignis, Tages-/Wochen-/Monatswerte, Intensitäts-Badge
- **Blitzentladungen** — Tagesanzahl, Distanz und Zeitpunkt des letzten Einschlags
- **UV & Solarstrahlung** — UV-Index mit Farbskala, Solarstrahlung in W/m², Tagesmaximum
- **Mini-Sparklines** — 24h-Trendlinie am unteren Rand jeder Karte

**Historische Ansicht (Klick auf das Chart-Icon einer Karte):**

- Datepicker mit frei wählbarem Start- und Enddatum
- Schnellauswahl: 7 Tage · 30 Tage · 3 Monate · Alles
- Dual-Achsen-Graphen (z. B. Temperatur °C + Luftfeuchtigkeit % gleichzeitig)
- Tagesdurchschnitte werden automatisch gespeichert und überleben Neustarts

---

## Voraussetzungen

- Docker & Docker Compose
- Ecowitt-Wetterstation mit Gateway (GW1000, GW2000, HP2553 o. ä.) im selben Netzwerk

---

## Installation

```bash
git clone https://github.com/0xvisualiris/weather-dashboard.git
cd weather-dashboard
docker compose up -d
```

Das Dashboard ist danach erreichbar unter:

```
http://<SERVER-IP>:3000
```

Für externen Zugriff (z. B. für Nachbarn) einfach einen Reverse-Proxy-Eintrag in Nginx Proxy Manager anlegen:

- **Forward Hostname/IP:** `<SERVER-IP>`
- **Port:** `3000`
- SSL-Zertifikat aktivieren

---

## Ecowitt Gateway konfigurieren

Öffne die **WS View Plus** App (iOS / Android):

1. Gerät auswählen → **Mehr** → **Upload to Customized Server**
2. Folgende Einstellungen setzen:

| Feld              | Wert                     |
|-------------------|--------------------------|
| Protocol Type     | **Ecowitt**              |
| Server IP / Host  | `<IP deines Servers>`    |
| Path              | `/data/report/`          |
| Port              | `3000`                   |
| Upload interval   | `60` (Sekunden)          |

3. Speichern — nach spätestens 60 Sekunden erscheinen die ersten Daten.

---

## Unterstützte Sensoren

| Sensor                  | Einheit | Ecowitt-Feld      |
|-------------------------|---------|-------------------|
| Außentemperatur         | °C      | `tempf`           |
| Außenluftfeuchtigkeit   | %       | `humidity`        |
| Windgeschwindigkeit     | km/h    | `windspeedmph`    |
| Windböe                 | km/h    | `windgustmph`     |
| Windrichtung            | °       | `winddir`         |
| Niederschlagsrate       | mm/h    | `rainratein`      |
| Tagesniederschlag       | mm      | `dailyrainin`     |
| UV-Index                | —       | `uv`              |
| Solarstrahlung          | W/m²    | `solarradiation`  |
| Blitze heute            | Anzahl  | `lightning_num`   |
| Blitzdistanz            | km      | `lightning`       |
| Letzter Blitz           | Unix-ts | `lightning_time`  |

---

## Datenspeicherung

Alle Daten bleiben lokal in einem Docker-Volume:

| Datei                | Inhalt                                 |
|----------------------|----------------------------------------|
| `/data/weather.json` | Letzter Messwert + letzte 24h          |
| `/data/daily.json`   | Tagesdurchschnitte seit erstem Empfang |

---

## API

| Endpunkt                   | Beschreibung                               |
|----------------------------|--------------------------------------------|
| `GET /api/weather`         | Aktuellster Datensatz inkl. Tages-Min/Max  |
| `GET /api/sparklines`      | Letzte 24h (minimale Payload)              |
| `GET /api/history`         | Letzte ~4 Stunden (Rohdaten)               |
| `GET /api/daily?from=&to=` | Tagesdurchschnitte nach Datum gefiltert    |
| `POST /data/report/`       | Ecowitt Push-Empfänger                     |
