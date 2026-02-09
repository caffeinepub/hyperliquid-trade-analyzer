import type { AnalysisData } from '../App';
import { TradeDirectionEnum } from '../backend';
import { computeFeeAlpha, getFeeAlphaLabel, formatFeeAlphaScore } from './feeAlpha';

/**
 * Escape CSV cell value (handle commas, quotes, newlines)
 */
function escapeCSVCell(value: string | number | boolean): string {
  const str = String(value);
  
  // If cell contains comma, quote, or newline, wrap in quotes and double internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

export function exportToCSV(data: AnalysisData): void {
  const headers = [
    'Trade ID',
    'Symbol',
    'Benutzer',
    'Richtung',
    'Positionsgröße',
    'Einstiegspreis',
    'Liquidationspreis',
    'Realisierter PnL',
    'Unrealisierter PnL',
    'Gesamt PnL',
    'Verwendete Margin',
    'Hebel',
    'Gebühr',
    'Fee Alpha Label',
    'Fee Alpha Score',
    'Status',
    'Risikostufe',
    'Asset-Kategorie',
    'Liquidiert'
  ];

  const rows = data.positions.map(p => {
    // Use leverage from position (calculated in CSV parser)
    const leverage = p.leverage !== undefined ? p.leverage.toFixed(2) : 'N/A';
    
    // Get direction label using enum comparison
    const direction = p.direction === TradeDirectionEnum.long_ ? 'Long' : 'Short';
    
    // Get asset category label
    let assetCategory = 'Andere';
    switch (p.assetCategory) {
      case 'crypto':
        assetCategory = 'Krypto';
        break;
      case 'metal':
        assetCategory = 'Metall';
        break;
      case 'stablecoin':
        assetCategory = 'Stablecoin';
        break;
      case 'commodity':
        assetCategory = 'Rohstoff';
        break;
    }
    
    // Compute Fee Alpha
    const feeAlpha = computeFeeAlpha(p);
    const feeAlphaLabel = getFeeAlphaLabel(p.fee);
    const feeAlphaScore = formatFeeAlphaScore(feeAlpha.score);
    
    return [
      p.tradeId,
      p.symbol,
      p.user,
      direction,
      p.positionSize.toFixed(4),
      p.entryPrice.toFixed(2),
      p.liquidationPrice?.toFixed(2) || 'N/A',
      p.realizedPnl.toFixed(2),
      p.unrealizedPnl.toFixed(2),
      (p.realizedPnl + p.unrealizedPnl).toFixed(2),
      p.marginUsed.toFixed(2),
      leverage,
      p.fee.toFixed(2),
      feeAlphaLabel,
      feeAlphaScore,
      p.status,
      p.riskLevel,
      assetCategory,
      p.isLiquidated ? 'Ja' : 'Nein'
    ];
  });

  // Escape all cells
  const csvContent = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map(row => row.map(escapeCSVCell).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `hyperliquid-analysis-${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
