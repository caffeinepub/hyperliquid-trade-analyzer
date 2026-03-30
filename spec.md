# Hyperliquid Trade Analyzer

## Current State

Der Entry Checker (`TradeEntryChecker.tsx` + `tradeEntryRules.ts`) hat derzeit viele manuelle Eingabefelder:
- EMA9/21 oder EMA20/50/200 als separate numerische Felder (3–5 Zahlenwerte)
- Orderbook Block: Bid/Ask Spread, Imbalance, Volumen (alle manuell)
- Orderflow Block: OI, Futures CVD, Spot CVD, Funding, Liquidationen (alle manuell)
- Links zu HyperDash, Kiyotaka, Hyperliquid

Problem: Der User muss 3 Plattformen (HyperDash, Kiyotaka, Hyperliquid) abfragen, was zu viel Zeit kostet und die Daten bis zur Eingabe bereits veraltet sind.

## Requested Changes (Diff)

### Add
- `src/frontend/src/lib/hyperliquidApi.ts`: Neue Utility-Datei mit `fetchHyperliquidLiveData(coin: string)` Funktion
  - POST https://api.hyperliquid.xyz/info mit `{"type": "metaAndAssetCtxs"}` → Mark-Preis, OI, Funding Rate
  - POST https://api.hyperliquid.xyz/info mit `{"type": "recentTrades", "coin": coin}` → CVD-Berechnung (Buy-Volumen minus Sell-Volumen)
  - Klassifiziert OI-Richtung (rising/neutral/falling), Funding Level (strongPositive/neutral/strongNegative), CVD Signal
- Loading-State und Fehlermeldung für den API-Fetch im Entry Checker
- "Lade Live-Daten" Button der alle HL-Felder automatisch befüllt

### Modify
- `src/frontend/src/lib/tradeEntryRules.ts`:
  - Neue vereinfachte Params-Typen: `emaAlignment: "bullish" | "bearish" | "mixed"` ersetzt alle numerischen EMA-Felder
  - Entfernt: `ema9`, `ema21`, `ema20`, `ema50`, `ema200` aus den Interfaces
  - Ergänzt: `emaAlignment` als primäres EMA-Signal
  - Spot CVD entfernen (nicht über HL-API verfügbar, kein HyperDash mehr)
  - Evaluierungslogik anpassen: EMA-Bedingung prüft `emaAlignment` statt numerische Werte
- `src/frontend/src/components/TradeEntryChecker.tsx`:
  - EMA-Block: statt 3–5 numerischer Felder → 1 Dropdown ("Bullish", "Gemischt", "Bearish") mit kurzem Hinweistext was das bedeutet
  - Auto-Fetch-Block: Asset-Name eingeben → "Lade Live-Daten" Button → füllt Preis, OI, Funding, CVD automatisch
  - Auto-befüllte Felder zeigen Wert an (read-only, mit grünem Haken), können manuell überschrieben werden
  - Orderbook-Block: entfernen (zu zeitintensiv für zu wenig Mehrwert)
  - Orderflow-Block: nur noch OI, Funding, CVD (auto-gefetcht) + Liquidationen (1 Dropdown von Kiyotaka)
  - HyperDash-Link entfernen, nur noch Kiyotaka-Link
  - Spot CVD entfernen
  - Formular-Felder insgesamt auf max. 6–7 manuelle Eingaben reduzieren
- `src/frontend/src/components/EntryChecklistResults.tsx`: Anpassen für neue Param-Struktur (emaAlignment statt numerische EMAs)

### Remove
- HyperDash-Link aus dem Entry Checker
- Spot CVD Eingabefeld
- Bid/Ask Spread Eingabefeld
- Orderbook Imbalance Dropdown
- Volumen Level Dropdown
- Alle numerischen EMA-Eingabefelder (ema9, ema21, ema20, ema50, ema200)

## Implementation Plan

1. Neue Datei `hyperliquidApi.ts` erstellen mit:
   - `fetchHyperliquidLiveData(coin)` → ruft beide HL-API-Endpoints auf
   - OI klassifizieren via 24h-Delta (falls verfügbar) oder openInterest-Wert
   - Funding Rate: > 0.005% = strongPositive, < -0.005% = strongNegative, sonst neutral
   - CVD: letzte 100 Trades summieren (buys - sells in Volumen)
   - Return-Typ: `{ price, oiDirection, fundingLevel, futureCVD, rawFunding, rawOI }`

2. `tradeEntryRules.ts` vereinfachen:
   - `TradeEntryParams1m` und `TradeEntryParams15m1h` beide auf `emaAlignment` umstellen
   - EMA-Bedingung: `emaAlignment === "bullish"` für Long, `emaAlignment === "bearish"` für Short
   - Spot CVD aus `detectOrderflowPattern` entfernen (wird optional/ignored)
   - Alle anderen Bedingungen bleiben identisch

3. `TradeEntryChecker.tsx` neu strukturieren:
   - Schritt 1: Asset + Richtung + Zeitrahmen (immer sichtbar)
   - Schritt 2: Auto-Fetch-Button → befüllt Preis, OI, Funding, CVD
   - Schritt 3: Chart-Felder (EMA-Dropdown, RSI, ATR, ggf. MACD) — vom HL-Chart ablesen
   - Schritt 4: Kiyotaka (1 Dropdown: Liquidationscluster) + Link zu kiyotaka.ai
   - Analyse-Button → Ergebnis anzeigen

4. `EntryChecklistResults.tsx` anpassen für emaAlignment-Ausgabe