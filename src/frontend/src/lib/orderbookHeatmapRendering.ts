// Rendering utilities for orderbook heatmap visualization

export interface NormalizedLevel {
  price: number;
  size: number;
  normalized: number;
}

export interface NormalizedOrderbook {
  bids: NormalizedLevel[];
  asks: NormalizedLevel[];
}

/**
 * Normalize orderbook levels for rendering
 */
export function normalizeOrderbook(
  bids: { price: number; size: number }[],
  asks: { price: number; size: number }[],
): NormalizedOrderbook {
  const allSizes = [...bids.map((b) => b.size), ...asks.map((a) => a.size)];
  const maxSize = Math.max(...allSizes);
  const minSize = Math.min(...allSizes);
  const range = maxSize - minSize || 1;

  const normalizeBids = bids.map((bid) => ({
    ...bid,
    normalized: (bid.size - minSize) / range,
  }));

  const normalizeAsks = asks.map((ask) => ({
    ...ask,
    normalized: (ask.size - minSize) / range,
  }));

  return { bids: normalizeBids, asks: normalizeAsks };
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Ease-out cubic easing function for smooth transitions
 */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Interpolate between two normalized orderbooks
 */
export function interpolateOrderbooks(
  from: NormalizedOrderbook,
  to: NormalizedOrderbook,
  t: number,
): NormalizedOrderbook {
  const easedT = easeOutCubic(Math.max(0, Math.min(1, t)));

  // Interpolate bids
  const maxBidLength = Math.max(from.bids.length, to.bids.length);
  const bids: NormalizedLevel[] = [];
  for (let i = 0; i < maxBidLength; i++) {
    const fromBid = from.bids[i] || { price: 0, size: 0, normalized: 0 };
    const toBid = to.bids[i] || { price: 0, size: 0, normalized: 0 };
    bids.push({
      price: lerp(fromBid.price, toBid.price, easedT),
      size: lerp(fromBid.size, toBid.size, easedT),
      normalized: lerp(fromBid.normalized, toBid.normalized, easedT),
    });
  }

  // Interpolate asks
  const maxAskLength = Math.max(from.asks.length, to.asks.length);
  const asks: NormalizedLevel[] = [];
  for (let i = 0; i < maxAskLength; i++) {
    const fromAsk = from.asks[i] || { price: 0, size: 0, normalized: 0 };
    const toAsk = to.asks[i] || { price: 0, size: 0, normalized: 0 };
    asks.push({
      price: lerp(fromAsk.price, toAsk.price, easedT),
      size: lerp(fromAsk.size, toAsk.size, easedT),
      normalized: lerp(fromAsk.normalized, toAsk.normalized, easedT),
    });
  }

  return { bids, asks };
}

/**
 * Get bid color based on normalized intensity
 */
export function getBidColor(normalized: number): string {
  // Light green to dark green gradient
  const lightness = 0.75 - normalized * 0.4; // 0.75 (light) to 0.35 (dark)
  const chroma = 0.15 + normalized * 0.05; // 0.15 to 0.20
  return `oklch(${lightness} ${chroma} 145)`;
}

/**
 * Get ask color based on normalized intensity
 */
export function getAskColor(normalized: number): string {
  // Light red to dark red gradient
  const lightness = 0.75 - normalized * 0.4; // 0.75 (light) to 0.35 (dark)
  const chroma = 0.15 + normalized * 0.05; // 0.15 to 0.20
  return `oklch(${lightness} ${chroma} 25)`;
}

/**
 * Calculate cumulative depth for cluster rendering
 */
export function calculateCumulativeDepth(levels: NormalizedLevel[]): number[] {
  const cumulative: number[] = [];
  let sum = 0;
  for (const level of levels) {
    sum += level.size;
    cumulative.push(sum);
  }
  return cumulative;
}

/**
 * Draw unified triangle region for bids or asks in cluster mode
 */
export function drawUnifiedTriangle(
  ctx: CanvasRenderingContext2D,
  levels: NormalizedLevel[],
  startY: number,
  rowHeight: number,
  priceColumnWidth: number,
  heatmapWidth: number,
  isBid: boolean,
  scaleFactor: number,
): void {
  if (levels.length === 0) return;

  const cumulative = calculateCumulativeDepth(levels);
  const maxCumulative = cumulative[cumulative.length - 1] || 1;

  // Create smooth gradient from light to dark
  const gradient = ctx.createLinearGradient(
    priceColumnWidth,
    startY,
    priceColumnWidth,
    startY + levels.length * rowHeight,
  );

  // Add color stops for smooth gradient
  const numStops = 10;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    const color = isBid ? getBidColor(t) : getAskColor(t);
    gradient.addColorStop(t, color);
  }

  ctx.fillStyle = gradient;

  // Build triangle path
  ctx.beginPath();
  ctx.moveTo(priceColumnWidth, startY);

  // Draw right edge (triangle boundary based on cumulative depth)
  for (let i = 0; i < levels.length; i++) {
    const y = startY + i * rowHeight;
    const normalizedCumulative = cumulative[i] / maxCumulative;
    const x =
      priceColumnWidth + heatmapWidth * normalizedCumulative * scaleFactor;
    ctx.lineTo(x, y);
  }

  // Draw bottom-right corner
  const lastY = startY + levels.length * rowHeight;
  const lastNormalizedCumulative =
    cumulative[cumulative.length - 1] / maxCumulative;
  const lastX =
    priceColumnWidth + heatmapWidth * lastNormalizedCumulative * scaleFactor;
  ctx.lineTo(lastX, lastY);

  // Draw back to left edge
  ctx.lineTo(priceColumnWidth, lastY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Calculate relative scale factors for bid/ask triangles based on aggregate depth
 */
export function calculateScaleFactors(
  bids: NormalizedLevel[],
  asks: NormalizedLevel[],
): { bidScale: number; askScale: number } {
  const totalBidSize = bids.reduce((sum, bid) => sum + bid.size, 0);
  const totalAskSize = asks.reduce((sum, ask) => sum + ask.size, 0);
  const totalSize = totalBidSize + totalAskSize;

  if (totalSize === 0) {
    return { bidScale: 1, askScale: 1 };
  }

  // Calculate relative proportions
  const bidProportion = totalBidSize / totalSize;
  const askProportion = totalAskSize / totalSize;

  // Scale factors: dominant side gets closer to 1.0, weaker side gets reduced
  // Use a power function to make the difference more visible
  const bidScale = (bidProportion / 0.5) ** 0.6;
  const askScale = (askProportion / 0.5) ** 0.6;

  return { bidScale, askScale };
}

/**
 * Draw cluster-style triangle region for bids or asks (legacy per-row version)
 */
export function drawClusterRegion(
  ctx: CanvasRenderingContext2D,
  levels: NormalizedLevel[],
  startY: number,
  rowHeight: number,
  priceColumnWidth: number,
  heatmapWidth: number,
  isBid: boolean,
): void {
  if (levels.length === 0) return;

  const cumulative = calculateCumulativeDepth(levels);
  const maxCumulative = cumulative[cumulative.length - 1] || 1;

  // Draw each level as part of the continuous cluster
  levels.forEach((level, index) => {
    const y = startY + index * rowHeight;
    const normalizedCumulative = cumulative[index] / maxCumulative;

    // Create gradient for smooth color transition
    const gradient = ctx.createLinearGradient(
      priceColumnWidth,
      y,
      priceColumnWidth + heatmapWidth,
      y,
    );

    const color = isBid
      ? getBidColor(level.normalized)
      : getAskColor(level.normalized);
    const fadeColor = isBid ? "oklch(0.16 0 0)" : "oklch(0.16 0 0)";

    // Width based on cumulative depth for cluster effect
    const barWidth = heatmapWidth * normalizedCumulative;

    gradient.addColorStop(0, color);
    gradient.addColorStop(Math.min(1, barWidth / heatmapWidth), color);
    gradient.addColorStop(1, fadeColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(priceColumnWidth, y, heatmapWidth, rowHeight);
  });
}
