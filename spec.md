# Hyperliquid Trade Analyzer

## Current State
Der Entry Checker fragt bereits nach Timeframe, EMA, RSI, MACD, ATR, Orderbook-Imbalance und Volumen. Die Ergebnisse zeigen eine Checkliste plus TWAP-Empfehlung. Die Logik liegt in `src/frontend/src/lib/tradeEntryRules.ts`.

## Requested Changes (Diff)

### Add
- **Orderflow-Block** im Entry Checker Formular mit 5 neuen Eingabefeldern (alle optional):
  - OI-Richtung: steigt / neutral / fällt
  - Futures CVD: bullish / neutral / bearish
  - Spot CVD: bullish / neutral / bearish
  - Funding Rate: stark positiv / neutral / stark negativ
  - Liquidationen in der Nähe: Ja (Longs) / Nein / Ja (Shorts)
- **Orderflow-Pattern-Erkennung** in der Bewertungslogik – erkennt automatisch folgende Muster:
  - Leverage Pump Trap: Preis ↑ + OI ↑ + Futures CVD bullish + Spot CVD neutral/bearish → Warnung, kein Long
  - Short Squeeze Setup: OI ↑ + Funding negativ + Spot CVD bullish → bullisches Signal
  - Versteckte Akkumulation: Preis fällt + OI ↑ + Spot CVD bullish → bullisches Signal
  - Starker Trend: OI ↑ + Futures CVD + Spot CVD beide bullish → bestätigt Long
  - Starker Downtrend: OI ↑ + Futures CVD + Spot CVD beide bearish → bestätigt Short
  - Short Covering (fragil): OI ↓ + Futures CVD bullish + Spot CVD neutral → schwacher Bounce
  - Long Liquidation Dump (Reversal-Zone): OI ↓ + Spot CVD neutral → mögliches Reversal
- **Orderflow Result Card** in `EntryChecklistResults.tsx` – zeigt erkanntes Muster mit Farbe/Icon und kurzer Erklärung, was es bedeutet
- Neue Typen: `OIDirection`, `CVDSignal`, `FundingLevel`, `LiquidationsNear` in tradeEntryRules.ts
- Orderflow-Felder in `EntryEvaluationResult` (optionales `orderflowPattern`-Objekt mit `patternName`, `signal: 'bullish'|'bearish'|'neutral'|'warning'`, `explanation`)

### Modify
- `tradeEntryRules.ts`: Neue optionale Orderflow-Felder in beiden Params-Interfaces; `evaluateEntryConditions` gibt zusätzlich `orderflowPattern` zurück
- `TradeEntryChecker.tsx`: Neuen Orderflow-Section-Block ins Formular einfügen (unterhalb Orderbook & Volumen, optional, mit Info-Icon)
- `EntryChecklistResults.tsx`: Neue Orderflow-Karte zwischen Checkliste und TWAP-Karte anzeigen (nur wenn Orderflow-Daten eingegeben wurden)

### Remove
- Nichts entfernen

## Implementation Plan
1. `tradeEntryRules.ts`: Neue Typen und Felder hinzufügen, `detectOrderflowPattern()`-Funktion schreiben, in `evaluate1m()` und `evaluate15m1h()` aufrufen
2. `TradeEntryChecker.tsx`: FormValues und Interfaces erweitern, Orderflow-Section-UI hinzufügen, Submit-Handler anpassen
3. `EntryChecklistResults.tsx`: Orderflow-Pattern-Karte hinzufügen mit passendem Farbschema je Signal
