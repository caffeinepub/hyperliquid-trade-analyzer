import { useEffect, useRef, useMemo, useState } from 'react';
import {
  normalizeOrderbook,
  interpolateOrderbooks,
  getBidColor,
  getAskColor,
  drawUnifiedTriangle,
  calculateScaleFactors,
  type NormalizedOrderbook,
} from '@/lib/orderbookHeatmapRendering';

interface OrderbookLevel {
  price: number;
  size: number;
}

interface OrderbookHeatmapCanvasProps {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midPrice: number;
  symbol: string;
  renderingMode?: 'bars' | 'cluster';
  updateInterval: number;
}

export default function OrderbookHeatmapCanvas({
  bids,
  asks,
  midPrice,
  symbol,
  renderingMode = 'bars',
  updateInterval,
}: OrderbookHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousDataRef = useRef<NormalizedOrderbook | null>(null);
  const targetDataRef = useRef<NormalizedOrderbook | null>(null);
  const transitionStartRef = useRef<number | null>(null);
  const transitionDurationRef = useRef<number>(400);
  const [currentData, setCurrentData] = useState<NormalizedOrderbook | null>(null);

  // Calculate transition duration based on update interval
  // Use 70% of the interval for smooth transitions, clamped between 1s and 12s
  const calculateTransitionDuration = (interval: number): number => {
    const duration = interval * 0.7;
    return Math.max(1000, Math.min(12000, duration));
  };

  // Update transition duration when interval changes
  useEffect(() => {
    transitionDurationRef.current = calculateTransitionDuration(updateInterval);
  }, [updateInterval]);

  // Normalize incoming data
  const normalizedData = useMemo(() => {
    return normalizeOrderbook(bids, asks);
  }, [bids, asks]);

  // Update target data when new data arrives
  useEffect(() => {
    if (!previousDataRef.current) {
      // First render - no transition
      previousDataRef.current = normalizedData;
      targetDataRef.current = normalizedData;
      setCurrentData(normalizedData);
    } else {
      // New data - start transition
      previousDataRef.current = currentData || normalizedData;
      targetDataRef.current = normalizedData;
      transitionStartRef.current = performance.now();
    }
  }, [normalizedData]);

  // Animation loop for smooth transitions
  useEffect(() => {
    const animate = () => {
      if (!transitionStartRef.current || !previousDataRef.current || !targetDataRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = performance.now() - transitionStartRef.current;
      const duration = transitionDurationRef.current;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        // Interpolate between previous and target
        const interpolated = interpolateOrderbooks(
          previousDataRef.current,
          targetDataRef.current,
          progress
        );
        setCurrentData(interpolated);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Transition complete
        setCurrentData(targetDataRef.current);
        previousDataRef.current = targetDataRef.current;
        transitionStartRef.current = null;
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !currentData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = 'oklch(0.16 0 0)';
    ctx.fillRect(0, 0, width, height);

    const totalLevels = currentData.bids.length + currentData.asks.length;
    if (totalLevels === 0) return;

    const rowHeight = height / totalLevels;
    const priceColumnWidth = 100;
    const sizeColumnWidth = 100;
    const heatmapWidth = width - priceColumnWidth - sizeColumnWidth;

    let currentY = 0;

    // Draw asks (top, reversed so highest price is at top)
    const reversedAsks = [...currentData.asks].reverse();

    // Calculate scale factors for cluster mode
    const { bidScale, askScale } = calculateScaleFactors(currentData.bids, currentData.asks);

    if (renderingMode === 'cluster') {
      // Cluster mode: draw unified triangle for asks
      drawUnifiedTriangle(
        ctx,
        reversedAsks,
        currentY,
        rowHeight,
        priceColumnWidth,
        heatmapWidth,
        false,
        askScale
      );
    }

    // Draw asks with labels
    reversedAsks.forEach((ask) => {
      if (renderingMode === 'bars') {
        // Bars mode: individual bars
        ctx.fillStyle = getAskColor(ask.normalized);
        const barWidth = heatmapWidth * ask.normalized;
        ctx.fillRect(priceColumnWidth, currentY, barWidth, rowHeight);
      }

      // Price label
      ctx.fillStyle = 'oklch(0.85 0 0)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ask.price.toFixed(2), priceColumnWidth - 5, currentY + rowHeight / 2);

      // Size label
      ctx.textAlign = 'left';
      ctx.fillText(ask.size.toFixed(4), priceColumnWidth + heatmapWidth + 5, currentY + rowHeight / 2);

      currentY += rowHeight;
    });

    // Draw mid price line
    ctx.strokeStyle = 'oklch(0.95 0 0)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(width, currentY);
    ctx.stroke();

    // Mid price label
    ctx.fillStyle = 'oklch(0.95 0 0)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Mid: ${midPrice.toFixed(2)}`, width / 2, currentY - 5);

    currentY += 2; // Small gap for the line

    const bidsStartY = currentY;

    if (renderingMode === 'cluster') {
      // Cluster mode: draw unified triangle for bids
      drawUnifiedTriangle(
        ctx,
        currentData.bids,
        bidsStartY,
        rowHeight,
        priceColumnWidth,
        heatmapWidth,
        true,
        bidScale
      );
    }

    // Draw bids with labels
    currentData.bids.forEach((bid) => {
      if (renderingMode === 'bars') {
        // Bars mode: individual bars
        ctx.fillStyle = getBidColor(bid.normalized);
        const barWidth = heatmapWidth * bid.normalized;
        ctx.fillRect(priceColumnWidth, currentY, barWidth, rowHeight);
      }

      // Price label
      ctx.fillStyle = 'oklch(0.85 0 0)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(bid.price.toFixed(2), priceColumnWidth - 5, currentY + rowHeight / 2);

      // Size label
      ctx.textAlign = 'left';
      ctx.fillText(bid.size.toFixed(4), priceColumnWidth + heatmapWidth + 5, currentY + rowHeight / 2);

      currentY += rowHeight;
    });

    // Draw symbol label
    ctx.fillStyle = 'oklch(0.7 0 0)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(symbol, 10, 20);
  }, [currentData, midPrice, symbol, renderingMode]);

  return (
    <div ref={containerRef} className="w-full h-[600px] rounded-lg overflow-hidden border border-border">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
