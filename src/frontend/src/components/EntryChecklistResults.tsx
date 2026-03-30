import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EntryEvaluationResult } from "@/lib/tradeEntryRules";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Minus,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface EntryChecklistResultsProps {
  result: EntryEvaluationResult;
  timeframe: string;
}

export default function EntryChecklistResults({
  result,
  timeframe,
}: EntryChecklistResultsProps) {
  const {
    conditionResults,
    passedCount,
    totalConditions,
    verdict,
    summaryMessage,
    params,
    twapRecommended,
    twapReason,
  } = result;

  const verdictConfig = {
    go: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      text: "text-emerald-400",
      badge: "bg-emerald-500 text-white hover:bg-emerald-500",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      label: "GO",
    },
    wait: {
      bg: "bg-amber-500/10 border-amber-500/30",
      text: "text-amber-400",
      badge: "bg-amber-500 text-white hover:bg-amber-500",
      icon: <AlertCircle className="h-5 w-5 text-amber-400" />,
      label: "WAIT",
    },
    "no-go": {
      bg: "bg-red-500/10 border-red-500/30",
      text: "text-red-400",
      badge: "bg-red-500 text-white hover:bg-red-500",
      icon: <XCircle className="h-5 w-5 text-red-400" />,
      label: "NO-GO",
    },
  };

  const vc = verdictConfig[verdict];

  const directionConfig =
    params.tradeDirection === "Long"
      ? {
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          label: "▲ LONG",
        }
      : {
          bg: "bg-red-500/15 text-red-400 border-red-500/30",
          label: "▼ SHORT",
        };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className={`border ${vc.bg}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {vc.icon}
              <CardTitle className={`text-xl font-bold ${vc.text}`}>
                {params.assetName}
              </CardTitle>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${directionConfig.bg}`}
              >
                {directionConfig.label}
              </span>
              {/* Timeframe badge */}
              <Badge
                variant="secondary"
                className="text-xs font-mono font-semibold px-2 py-0.5"
              >
                {timeframe}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {passedCount} / {totalConditions} Bedingungen erfüllt
              </span>
              <Badge className={`text-sm px-3 py-1 font-bold ${vc.badge}`}>
                {vc.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className={`text-base font-medium ${vc.text}`}>{summaryMessage}</p>
        </CardContent>
      </Card>

      {/* Condition Checklist */}
      <Card className="border border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Bedingungen im Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conditionResults.map((condition, index) => (
            <div key={condition.label} className="space-y-1">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {condition.pass ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${
                        condition.pass
                          ? "text-foreground"
                          : "text-foreground/80"
                      }`}
                    >
                      {condition.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {condition.details}
                    </span>
                  </div>
                  {condition.pass ? (
                    <p className="text-xs text-emerald-500/80 mt-0.5">
                      ✓ Bestätigt
                    </p>
                  ) : (
                    condition.failureExplanation && (
                      <p className="text-xs text-muted-foreground mt-1 pl-0 leading-relaxed">
                        ⚠ {condition.failureExplanation}
                      </p>
                    )
                  )}
                </div>
              </div>
              {index < conditionResults.length - 1 && (
                <div className="ml-8 border-b border-border/30" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Orderflow Pattern Card */}
      {result.orderflowPattern && (
        <Card
          className={`border ${
            result.orderflowPattern.signal === "bullish"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : result.orderflowPattern.signal === "bearish"
                ? "bg-red-500/10 border-red-500/30"
                : result.orderflowPattern.signal === "warning"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-muted/30 border-border/50"
          }`}
          data-ocid="checker.orderflow.card"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {result.orderflowPattern.signal === "bullish" ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : result.orderflowPattern.signal === "bearish" ? (
                <TrendingDown className="h-5 w-5 text-red-400" />
              ) : result.orderflowPattern.signal === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              ) : (
                <Minus className="h-5 w-5 text-muted-foreground" />
              )}
              <CardTitle
                className={`text-base font-bold ${
                  result.orderflowPattern.signal === "bullish"
                    ? "text-emerald-400"
                    : result.orderflowPattern.signal === "bearish"
                      ? "text-red-400"
                      : result.orderflowPattern.signal === "warning"
                        ? "text-amber-400"
                        : "text-muted-foreground"
                }`}
              >
                {result.orderflowPattern.patternName}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <p
              className={`text-sm font-medium ${
                result.orderflowPattern.signal === "bullish"
                  ? "text-emerald-300"
                  : result.orderflowPattern.signal === "bearish"
                    ? "text-red-300"
                    : result.orderflowPattern.signal === "warning"
                      ? "text-amber-300"
                      : "text-muted-foreground"
              }`}
            >
              {result.orderflowPattern.explanation}
            </p>
            <p className="text-xs text-muted-foreground">
              Quelle: OI + CVD + Funding Analyse
            </p>
          </CardContent>
        </Card>
      )}

      {/* TWAP Recommendation Card */}
      <Card
        className={`border ${
          twapRecommended
            ? "bg-cyan-500/10 border-cyan-500/30"
            : "bg-emerald-500/10 border-emerald-500/30"
        }`}
        data-ocid="checker.twap.card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {twapRecommended ? (
              <Layers className="h-5 w-5 text-cyan-400" />
            ) : (
              <Zap className="h-5 w-5 text-emerald-400" />
            )}
            <CardTitle
              className={`text-base font-bold ${
                twapRecommended ? "text-cyan-400" : "text-emerald-400"
              }`}
            >
              {twapRecommended
                ? "TWAP Entry empfohlen"
                : "Single Entry möglich"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <p
            className={`text-sm font-medium ${
              twapRecommended ? "text-cyan-300" : "text-emerald-300"
            }`}
          >
            {twapReason}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {twapRecommended
              ? "TWAP (Time-Weighted Average Price) teilt den Entry in mehrere kleine Orders über Zeit auf und senkt so Slippage und Market-Impact."
              : "Ein einzelner Limit-Entry mit Maker-Order reicht aus — Spread und Liquidität sind günstig."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
