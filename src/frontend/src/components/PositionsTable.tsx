import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Coins,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { TradeDirectionEnum } from "../backend";
import type { TradePosition } from "../backend";
import {
  compareFeeAlpha,
  computeFeeAlpha,
  formatFeeAlphaScore,
  getFeeAlphaColor,
} from "../lib/feeAlpha";
import {
  formatCurrency,
  getDirectionLabel,
  getMetalIcon,
  getMetalPositions,
  getRiskLevelColor,
  getRiskLevelLabel,
  getStablecoinIcon,
  getStablecoinPositions,
  getStatusColor,
  getStatusLabel,
  isMetal,
  isStablecoin,
} from "../lib/tradeUtils";

interface PositionsTableProps {
  positions: TradePosition[];
}

type SortOrder = "newest" | "oldest" | "feeAlpha";

function extractTimestamp(tradeId: string): Date | null {
  const parts = tradeId.split("|");
  if (parts.length > 1) {
    const timestamp = new Date(parts[0]);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }
  return null;
}

function compareByTime(a: TradePosition, b: TradePosition): number {
  const timeA = extractTimestamp(a.tradeId);
  const timeB = extractTimestamp(b.tradeId);

  if (timeA && timeB) {
    return timeA.getTime() - timeB.getTime();
  }

  if (timeA) return -1;
  if (timeB) return 1;

  return a.tradeId.localeCompare(b.tradeId);
}

/**
 * Returns color class based on leverage level for visual risk indication
 */
function getLeverageColor(leverage: number | undefined): string {
  if (leverage === undefined) {
    return "text-muted-foreground";
  }

  if (leverage >= 20) {
    return "text-destructive font-bold";
  }
  if (leverage >= 10) {
    return "text-orange-500 font-semibold";
  }
  if (leverage >= 5) {
    return "text-yellow-600 dark:text-yellow-500";
  }
  return "text-foreground";
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const toggleRow = (tradeId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) {
        next.delete(tradeId);
      } else {
        next.add(tradeId);
      }
      return next;
    });
  };

  const sortedPositions = [...positions].sort((a, b) => {
    if (sortOrder === "feeAlpha") {
      return compareFeeAlpha(a, b);
    }
    const comparison = compareByTime(a, b);
    return sortOrder === "newest" ? -comparison : comparison;
  });

  const metalPositions = getMetalPositions(sortedPositions);
  const stablecoinPositions = getStablecoinPositions(sortedPositions);
  const otherPositions = sortedPositions.filter(
    (p) => !isMetal(p.symbol) && !isStablecoin(p.symbol),
  );

  const hasMetals = metalPositions.length > 0;
  const hasStablecoins = stablecoinPositions.length > 0;
  const hasOthers = otherPositions.length > 0;

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Keine Positionen in dieser Kategorie</p>
      </div>
    );
  }

  const renderPositionRow = (position: TradePosition) => {
    const displayId = position.tradeId.includes("|")
      ? position.tradeId.split("|")[1]
      : position.tradeId;

    const isMetalAsset = isMetal(position.symbol);
    const isStablecoinAsset = isStablecoin(position.symbol);
    const metalIcon = isMetalAsset ? getMetalIcon(position.symbol) : null;
    const stablecoinIcon = isStablecoinAsset ? getStablecoinIcon() : null;
    const isLong = position.direction === TradeDirectionEnum.long_;

    // Use leverage from position (calculated in CSV parser)
    const leverage = position.leverage;
    const leverageColor = getLeverageColor(leverage);

    // Compute Fee Alpha
    const feeAlpha = computeFeeAlpha(position);
    const feeAlphaColor = getFeeAlphaColor(feeAlpha.label);

    return (
      <Collapsible
        key={position.tradeId}
        open={expandedRows.has(position.tradeId)}
        onOpenChange={() => toggleRow(position.tradeId)}
        asChild
      >
        <>
          <TableRow
            className={`cursor-pointer hover:bg-muted/50 ${
              isMetalAsset
                ? "bg-gradient-to-r from-amber-500/5 via-slate-500/5 to-orange-600/5"
                : isStablecoinAsset
                  ? "bg-gradient-to-r from-blue-500/5 via-green-500/5 to-purple-500/5"
                  : ""
            }`}
          >
            <TableCell>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {expandedRows.has(position.tradeId) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </TableCell>
            <TableCell className="font-mono text-sm">{displayId}</TableCell>
            <TableCell className="font-semibold">
              <div className="flex items-center gap-2">
                {metalIcon && (
                  <img
                    src={metalIcon}
                    alt={position.symbol}
                    className="w-5 h-5"
                  />
                )}
                {stablecoinIcon && (
                  <img
                    src={stablecoinIcon}
                    alt={position.symbol}
                    className="w-5 h-5"
                  />
                )}
                {position.symbol}
                {isMetalAsset && <Coins className="w-4 h-4 text-amber-500" />}
                {isStablecoinAsset && (
                  <CircleDollarSign className="w-4 h-4 text-blue-500" />
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={isLong ? "default" : "secondary"}
                className="gap-1"
              >
                {isLong ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {getDirectionLabel(position.direction)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {position.positionSize.toFixed(4)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(position.entryPrice)}
            </TableCell>
            <TableCell
              className={`text-right font-semibold ${
                (position.realizedPnl + position.unrealizedPnl) >= 0
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              {formatCurrency(position.realizedPnl + position.unrealizedPnl)}
            </TableCell>
            <TableCell className={`text-right ${leverageColor}`}>
              {leverage !== undefined ? `${leverage.toFixed(2)}x` : "N/A"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className={feeAlphaColor}>
                  {feeAlpha.label}
                </Badge>
                <span className={`text-xs font-mono ${feeAlphaColor}`}>
                  {formatFeeAlphaScore(feeAlpha.score)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusColor(position.status)}>
                {getStatusLabel(position.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={getRiskLevelColor(position.riskLevel)}
              >
                {getRiskLevelLabel(position.riskLevel)}
              </Badge>
            </TableCell>
          </TableRow>
          <CollapsibleContent asChild>
            <TableRow>
              <TableCell colSpan={11} className="bg-muted/30">
                <div className="py-4 px-2 space-y-3">
                  <h4 className="font-semibold text-sm mb-3">
                    Positionsdetails
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Benutzer</p>
                      <p className="font-medium">{position.user}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Richtung</p>
                      <p className="font-medium flex items-center gap-1">
                        {isLong ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                        {getDirectionLabel(position.direction)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Verwendete Margin</p>
                      <p className="font-medium">
                        {formatCurrency(position.marginUsed)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hebel</p>
                      <p className={`font-medium ${leverageColor}`}>
                        {leverage !== undefined
                          ? `${leverage.toFixed(2)}x`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Positionswert</p>
                      <p className="font-medium">
                        {formatCurrency(
                          position.entryPrice * Math.abs(position.positionSize),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Realisierter PnL</p>
                      <p
                        className={`font-medium ${position.realizedPnl >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {formatCurrency(position.realizedPnl)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Unrealisierter PnL
                      </p>
                      <p
                        className={`font-medium ${position.unrealizedPnl >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {formatCurrency(position.unrealizedPnl)}
                      </p>
                    </div>
                    {position.liquidationPrice && (
                      <div>
                        <p className="text-muted-foreground">
                          Liquidationspreis
                        </p>
                        <p className="font-medium">
                          {formatCurrency(position.liquidationPrice)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Gebühr</p>
                      <p
                        className={`font-medium ${position.fee >= 0 ? "text-destructive" : "text-success"}`}
                      >
                        {formatCurrency(position.fee)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fee Alpha</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={feeAlphaColor}>
                          {feeAlpha.label}
                        </Badge>
                        <span className={`text-xs font-mono ${feeAlphaColor}`}>
                          {formatFeeAlphaScore(feeAlpha.score)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {leverage !== undefined && leverage >= 10 && (
                    <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                      <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>
                          {leverage >= 20
                            ? `Sehr hoher Hebel (${leverage.toFixed(2)}x) - Erhöhtes Liquidationsrisiko`
                            : `Hoher Hebel (${leverage.toFixed(2)}x) - Vorsicht geboten`}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        </>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sort Control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-order" className="text-sm font-medium">
            Sortierung:
          </label>
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
          >
            <SelectTrigger id="sort-order" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste zuerst</SelectItem>
              <SelectItem value="oldest">Älteste zuerst</SelectItem>
              <SelectItem value="feeAlpha">Fee Alpha Score</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {positions.length}{" "}
          {positions.length === 1 ? "Position" : "Positionen"}
        </div>
      </div>

      {/* Metals Section */}
      {hasMetals && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-amber-500/10 via-slate-500/10 to-orange-600/10 rounded-md border border-amber-500/20">
            <Coins className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-amber-600 dark:text-amber-400">
              Metalle ({metalPositions.length})
            </h3>
          </div>
          <ScrollArea className="max-h-[400px]">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]" />
                    <TableHead>Trade ID</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Richtung</TableHead>
                    <TableHead className="text-right">Größe</TableHead>
                    <TableHead className="text-right">Einstieg</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                    <TableHead className="text-right">Hebel</TableHead>
                    <TableHead className="text-right">Fee Alpha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risiko</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{metalPositions.map(renderPositionRow)}</TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Stablecoins Section */}
      {hasStablecoins && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-blue-500/10 via-green-500/10 to-purple-500/10 rounded-md border border-blue-500/20">
            <CircleDollarSign className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-blue-600 dark:text-blue-400">
              Stablecoins ({stablecoinPositions.length})
            </h3>
          </div>
          <ScrollArea className="max-h-[400px]">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]" />
                    <TableHead>Trade ID</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Richtung</TableHead>
                    <TableHead className="text-right">Größe</TableHead>
                    <TableHead className="text-right">Einstieg</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                    <TableHead className="text-right">Hebel</TableHead>
                    <TableHead className="text-right">Fee Alpha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risiko</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stablecoinPositions.map(renderPositionRow)}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Other Assets Section */}
      {hasOthers && (
        <div className="space-y-2">
          {(hasMetals || hasStablecoins) && (
            <div className="flex items-center gap-2 px-2 py-1">
              <h3 className="font-semibold text-foreground">
                Kryptowährungen ({otherPositions.length})
              </h3>
            </div>
          )}
          <ScrollArea className="max-h-[400px]">
            <div className="rounded-md border overflow-hidden">
              <Table>
                {!hasMetals && !hasStablecoins && (
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]" />
                      <TableHead>Trade ID</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Richtung</TableHead>
                      <TableHead className="text-right">Größe</TableHead>
                      <TableHead className="text-right">Einstieg</TableHead>
                      <TableHead className="text-right">PnL</TableHead>
                      <TableHead className="text-right">Hebel</TableHead>
                      <TableHead className="text-right">Fee Alpha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risiko</TableHead>
                    </TableRow>
                  </TableHeader>
                )}
                <TableBody>{otherPositions.map(renderPositionRow)}</TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
