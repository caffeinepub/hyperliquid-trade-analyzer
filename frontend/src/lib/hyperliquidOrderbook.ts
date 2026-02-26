export interface RawOrderbookLevel {
  px: string;
  sz: string;
  n: number;
}

export interface RawOrderbookData {
  coin: string;
  time: number;
  levels: [RawOrderbookLevel[], RawOrderbookLevel[]];
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface ParsedOrderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midPrice: number;
  timestamp: number;
}

export function parseOrderbookData(raw: RawOrderbookData | string): ParsedOrderbook {
  try {
    const data: RawOrderbookData = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!data || !data.levels || !Array.isArray(data.levels) || data.levels.length !== 2) {
      throw new Error('Invalid orderbook structure');
    }

    const bids: OrderbookLevel[] = data.levels[0].map((level) => ({
      price: parseFloat(level.px),
      size: parseFloat(level.sz),
    }));

    const asks: OrderbookLevel[] = data.levels[1].map((level) => ({
      price: parseFloat(level.px),
      size: parseFloat(level.sz),
    }));

    // Validate parsed data
    if (bids.some(b => isNaN(b.price) || isNaN(b.size))) {
      throw new Error('Invalid bid data');
    }
    if (asks.some(a => isNaN(a.price) || isNaN(a.size))) {
      throw new Error('Invalid ask data');
    }

    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 0;
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk || 0;

    return {
      bids,
      asks,
      midPrice,
      timestamp: data.time || Date.now(),
    };
  } catch (error) {
    console.error('[parseOrderbookData] Parse error:', error);
    throw new Error(`Failed to parse orderbook data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function validateOrderbook(orderbook: ParsedOrderbook): boolean {
  if (!orderbook) return false;
  if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) return false;
  if (orderbook.bids.length === 0 && orderbook.asks.length === 0) return false;
  if (typeof orderbook.midPrice !== 'number' || isNaN(orderbook.midPrice)) return false;
  return true;
}
