# Specification

## Summary
**Goal:** Add a "Trade Entry Checker" tab to the Vibe Trader app that lets users manually input trading indicators and receive a rule-based entry recommendation.

**Planned changes:**
- Add a new "Trade Entry Checker" tab to the main navigation in App.tsx
- Create a form with inputs: Asset Name (text), Current Price, EMA20, EMA50, EMA200, RSI (0–100), ATR (>0), MACD Direction (dropdown: Bullish/Neutral/Bearish), and Trade Direction (Long/Short toggle)
- Implement a purely frontend rule engine evaluating 4 conditions independently for Long and Short trades:
  - EMA trend alignment (EMA20 > EMA50 > EMA200 for Long; reversed for Short)
  - Price proximity within 1× ATR of EMA20 (not overextended)
  - RSI not overbought/oversold (< 65 for Long, > 35 for Short)
  - MACD Direction alignment (Bullish/Neutral for Long, Bearish/Neutral for Short)
- Display results as a checklist with pass (green checkmark) / fail (red cross) indicators per condition and a count (e.g., "3 / 4 conditions met")
- Show a summary verdict card above the checklist with asset name, direction badge (Long in green tones, Short in red tones), and traffic-light verdict: "Go" (green, all 4 pass), "Wait" (yellow, 3 pass), "No-Go" (red, ≤2 pass)
- Show plain-English explanations beneath the checklist for each failed condition, referencing actual input values
- Add "Check Entry" submit button and "Reset" button
- Add inline validation: required fields, RSI must be 0–100, ATR must be > 0, all numeric fields must be positive
- All UI text and labels in English

**User-visible outcome:** Users can navigate to the Trade Entry Checker tab, enter indicator values for any asset, and instantly see a color-coded Go/Wait/No-Go verdict with a per-condition checklist and explanations for any failed conditions.
