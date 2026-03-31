export interface HyperliquidLiveData {
  price: number;
  oiDirection: "rising" | "neutral" | "falling";
  fundingLevel: "strongPositive" | "neutral" | "strongNegative";
  futureCVD: "bullish" | "neutral" | "bearish";
  rawFunding: number;
  rawOI: number;
  cvdDelta: number;
}

/**
 * Assets known to NOT be available as Hyperliquid perpetuals.
 * Shown with a clear "not available" message instead of a confusing error.
 */
export const ASSETS_NOT_ON_HL_PERPS = new Set([
  "SILVER",
  "GOLD",
  "BRENT",
  "OIL",
  "COPPER",
  "XAG",
  "XAU",
  "XCU",
  "SILBER",
  "KUPFER",
  "BRENTOIL",
  "CRUDE",
  "WTI",
]);

export const ASSET_ALIASES: Record<string, string> = {
  BRENTOIL: "BRENT",
  BRENTOIL_USDC: "BRENT",
  BRENT_OIL: "BRENT",
  CRUDE: "BRENT",
  WTI: "OIL",
  GOLD: "GOLD",
  XAU: "GOLD",
  SILVER: "SILVER",
  XAG: "SILVER",
  SILBER: "SILVER",
  COPPER: "COPPER",
  XCU: "COPPER",
  KUPFER: "COPPER",
};

function extractCoinName(input: string): string {
  const raw = input.split("/")[0].split("-")[0].trim().toUpperCase();
  return ASSET_ALIASES[raw] ?? raw;
}

export async function fetchHyperliquidLiveData(
  coin: string,
): Promise<HyperliquidLiveData> {
  const coinName = extractCoinName(coin);
  const originalInput = coin.split("/")[0].split("-")[0].trim().toUpperCase();
  const BASE_URL = "https://api.hyperliquid.xyz/info";

  if (
    ASSETS_NOT_ON_HL_PERPS.has(coinName) ||
    ASSETS_NOT_ON_HL_PERPS.has(originalInput)
  ) {
    throw new Error(
      `"${originalInput}" ist als Perpetual nicht auf Hyperliquid verfügbar. Bitte Preis und Werte manuell eingeben (z.B. von TradingView).`,
    );
  }

  try {
    const [metaRes, tradesRes] = await Promise.all([
      fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      }),
      fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recentTrades", coin: coinName }),
      }),
    ]);

    if (!metaRes.ok) {
      throw new Error(`Metadaten-Fehler: ${metaRes.status}`);
    }

    const metaData = await metaRes.json();
    const [meta, assetCtxs] = metaData as [
      { universe: Array<{ name: string; szDecimals: number }> },
      Array<{ markPx: string; openInterest: string; funding: string }>,
    ];

    const coinIndex = meta.universe.findIndex(
      (u) => u.name.toLowerCase() === coinName.toLowerCase(),
    );

    if (coinIndex === -1) {
      const resolvedInfo =
        originalInput !== coinName ? ` (versucht als "${coinName}")` : "";
      throw new Error(
        `Asset "${originalInput}"${resolvedInfo} nicht auf Hyperliquid gefunden. Bitte Namen prüfen (z.B. BTC, ETH, SOL, HYPE).`,
      );
    }

    const assetCtx = assetCtxs[coinIndex];
    const price = Number.parseFloat(assetCtx.markPx);
    const rawOI = Number.parseFloat(assetCtx.openInterest);
    const rawFunding = Number.parseFloat(assetCtx.funding);

    let oiDirection: "rising" | "neutral" | "falling";
    if (rawFunding > 0.0005) {
      oiDirection = "rising";
    } else if (rawFunding < -0.0005) {
      oiDirection = "falling";
    } else {
      oiDirection = "neutral";
    }

    let fundingLevel: "strongPositive" | "neutral" | "strongNegative";
    if (rawFunding > 0.0005) {
      fundingLevel = "strongPositive";
    } else if (rawFunding < -0.0005) {
      fundingLevel = "strongNegative";
    } else {
      fundingLevel = "neutral";
    }

    let futureCVD: "bullish" | "neutral" | "bearish" = "neutral";
    let cvdDelta = 0;

    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      const trades = tradesData as Array<{
        side: "B" | "A";
        sz: string;
        px: string;
      }>;

      let buyVolume = 0;
      let sellVolume = 0;
      for (const trade of trades) {
        const volume =
          Number.parseFloat(trade.sz) * Number.parseFloat(trade.px);
        if (trade.side === "B") buyVolume += volume;
        else sellVolume += volume;
      }

      const totalVolume = buyVolume + sellVolume;
      cvdDelta = buyVolume - sellVolume;

      if (totalVolume === 0 || Math.abs(cvdDelta) < totalVolume * 0.05) {
        futureCVD = "neutral";
      } else if (cvdDelta > 0) {
        futureCVD = "bullish";
      } else {
        futureCVD = "bearish";
      }
    }

    return {
      price,
      oiDirection,
      fundingLevel,
      futureCVD,
      rawFunding,
      rawOI,
      cvdDelta,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("nicht auf Hyperliquid") ||
        error.message.includes("nicht verfügbar") ||
        error.message.includes("Metadaten-Fehler"))
    ) {
      throw error;
    }
    throw new Error(
      "Hyperliquid API nicht erreichbar. Bitte Werte manuell eingeben.",
    );
  }
}
