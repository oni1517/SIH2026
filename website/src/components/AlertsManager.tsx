import React, { useState, useMemo } from 'react';
import { AlertItem, AlertSeverity } from '../types';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Check, 
  Flame, 
  Radio, 
  ExternalLink,
  Volume2,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ArrowDownWideNarrow,
  Clock,
  SlidersHorizontal
} from 'lucide-react';
import { sound } from '../utils/audio';

interface AlertsManagerProps {
  alerts: AlertItem[];
  onAcknowledgeAlert: (id: string) => void;
  onResolveAlert: (id: string) => void;
  onExecuteProtocol: (alert: AlertItem) => void;
  maxDisplay?: number;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  onAcknowledgeAlert,
  onResolveAlert,
  onExecuteProtocol,
  maxDisplay
}) => {
  const [filter, setFilter] = useState<'all' | 'unacked' | 'critical' | 'warning' | 'resolved'>('all');
  const [autoSortSeverity, setAutoSortSeverity] = useState<boolean>(true);

  // Sorting and filtering memoized pipeline
  const processedAlerts = useMemo(() => {
    // 1. Filter
    const filtered = alerts.filter(a => {
      if (filter === 'unacked') return !a.acknowledged;
      if (filter === 'critical') return a.severity === 'critical';
      if (filter === 'warning') return a.severity === 'warning';
      if (filter === 'resolved') return a.resolved;
      return true;
    });

    // 2. Sort
    const sorted = [...filtered].sort((a, b) => {
      if (autoSortSeverity) {
        // Priority weight score
        const getScore = (item: AlertItem) => {
          let score = 0;
          if (item.severity === 'critical') score += 100;
          else if (item.severity === 'warning') score += 50;
          else score += 10;

          // Unresolved incidents get higher priority over resolved
          if (!item.resolved) score += 200;
          // Unacknowledged gets slight boost
          if (!item.acknowledged) score += 20;

          // Trending up hazards get elevated priority
          if (item.trend === 'rising' || item.trend === 'spike') score += 15;

          return score;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Higher score first
        }
      }

      // Secondary or strictly chronological sort: newest timestamp first
      return b.timestamp.localeCompare(a.timestamp);
    });

    return maxDisplay ? sorted.slice(0, maxDisplay) : sorted;
  }, [alerts, filter, autoSortSeverity, maxDisplay]);

  const unackedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.resolved).length;
  const risingHazardsCount = alerts.filter(a => (a.trend === 'rising' || a.trend === 'spike') && !a.resolved).length;

  const handleToggleAutoSort = () => {
    sound.playClick();
    setAutoSortSeverity(prev => !prev);
  };

  const handleAck = (id: string) => {
    sound.playClick();
    onAcknowledgeAlert(id);
  };

  const handleResolve = (id: string) => {
    sound.playSuccess();
    onResolveAlert(id);
  };

  const handleProtocol = (alert: AlertItem) => {
    sound.playWarning();
    onExecuteProtocol(alert);
  };

  const renderTrendBadge = (alert: AlertItem) => {
    if (!alert.trend && !alert.trendRate) return null;

    if (alert.trend === 'rising') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-950/70 border border-rose-500/40 px-1.5 py-0.5 rounded">
          <TrendingUp className="w-3 h-3 text-rose-400 animate-pulse" />
          <span>{alert.trendRate || 'Rising Velocity'}</span>
        </span>
      );
    }

    if (alert.trend === 'spike') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.5 rounded">
          <Zap className="w-3 h-3 text-amber-400 animate-bounce" style={{ animationDuration: '2s' }} />
          <span>{alert.trendRate || 'Sudden Spike'}</span>
        </span>
      );
    }

    if (alert.trend === 'falling') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded">
          <TrendingDown className="w-3 h-3 text-emerald-400" />
          <span>{alert.trendRate || 'Receding'}</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
        <Activity className="w-3 h-3 text-slate-400" />
        <span>{alert.trendRate || 'Stable Plateau'}</span>
      </span>
    );
  };

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4 space-y-4 shadow-xl">
      {/* Header & Main Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${unackedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100 flex items-center gap-2">
            CRITICAL INCIDENT &amp; HAZARD DISPATCH
            {unackedCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                {unackedCount} PENDING ACK
              </span>
            )}
            {risingHazardsCount > 0 && (
              <span className="text-[10px] font-mono text-amber-300 px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/30">
                {risingHazardsCount} ACCELERATING
              </span>
            )}
          </h2>
        </div>

        {/* Action Controls: Severity Auto-Sort Toggle & Category Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {/* AUTO-SORT TOGGLE SWITCH (Requested Feature) */}
          <button
            onClick={handleToggleAutoSort}
            className={`px-3 py-1 rounded border flex items-center gap-2 transition-all font-semibold ${
              autoSortSeverity
                ? 'bg-rose-950/80 text-rose-200 border-rose-500/60 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Auto-sort incident queue: Prioritizes unresolved Critical life-safety hazards at the top, then Warnings, sub-sorted by latest timestamp."
          >
            {autoSortSeverity ? (
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>
              {autoSortSeverity ? 'Auto-Sort: Critical First' : 'Sort: Chronological'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                autoSortSeverity ? 'bg-rose-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Filter Segmented Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded border transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('unacked')}
              className={`px-2 py-1 rounded border transition-colors ${
                filter === 'unacked'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Unacked ({unackedCount})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-2 py-1 rounded border transition-colors ${
                filter === 'critical'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Critical ({criticalCount})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-2 py-1 rounded border transition-colors ${
                filter === 'warning'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Warning ({warningCount})
            </button>
          </div>
        </div>
      </div>

      {/* Prioritization Feedback Banner */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span>Current Queue Ordering:</span>
          {autoSortSeverity ? (
            <span className="text-cyan-300 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Life-Safety Priority (Critical &rarr; Warning &rarr; Time)
            </span>
          ) : (
            <span className="text-slate-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Strictly Time-Descending (Latest First)
            </span>
          )}
        </div>

        <div className="text-slate-400">
          Showing <b className="text-slate-200">{processedAlerts.length}</b> of {alerts.length} incidents
        </div>
      </div>

      {/* Alert Feed List */}
      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
        {processedAlerts.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No active incidents matching the selected filter. Atmospheric parameters are within limits.
          </div>
        ) : (
          processedAlerts.map((alt) => {
            const isCritical = alt.severity === 'critical';
            const isWarning = alt.severity === 'warning';

            return (
              <div
                key={alt.id}
                className={`p-3.5 rounded-lg border transition-all duration-200 text-xs font-mono ${
                  alt.resolved
                    ? 'bg-[#080d14]/60 border-slate-800/60 opacity-60'
                    : isCritical
                    ? 'bg-[#160a10] border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.12)] ring-1 ring-rose-500/20'
                    : isWarning
                    ? 'bg-[#151009] border-amber-500/50'
                    : 'bg-[#0b121c] border-cyan-500/40'
                }`}
              >
                {/* Alert Top Row: Severity Badge, Title, Trend Indicator, Timestamp */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      isCritical
                        ? 'bg-rose-950/90 text-rose-300 border-rose-500/50'
                        : isWarning
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                        : 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50'
                    }`}>
                      {alt.severity}
                    </span>

                    <span className="font-bold text-slate-100 text-sm">
                      {alt.title}
                    </span>

                    {/* Trend Indicator Pill */}
                    {renderTrendBadge(alt)}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-[11px] ml-auto">
                    <span className="text-slate-300 font-medium">{alt.zone}</span>
                    <span>·</span>
                    <span className="tabular-nums font-semibold text-slate-300">{alt.timestamp}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-300 text-xs font-sans mb-2.5 leading-relaxed">
                  {alt.description}
                </p>

                {/* Actionable Protocol Box */}
                {alt.protocolAction && (
                  <div className="bg-[#060a10] rounded p-2.5 border border-slate-800 mb-2.5 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-300 flex items-center gap-2">
                      <span className="text-amber-400 font-bold shrink-0">RECOMMENDED PROTOCOL:</span>
                      <span className="font-sans text-slate-300">{alt.protocolAction}</span>
                    </div>

                    {!alt.resolved && (
                      <button
                        onClick={() => handleProtocol(alt)}
                        className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 text-[11px] font-bold shrink-0 transition-colors"
                      >
                        EXECUTE PROTOCOL
                      </button>
                    )}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-2">
                    {alt.acknowledged ? (
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ACKNOWLEDGED BY OPERATOR
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAck(alt.id)}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 transition-colors font-bold flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3 h-3 text-cyan-400" />
                        <span>ACKNOWLEDGE ALERT</span>
                      </button>
                    )}
                  </div>

                  {!alt.resolved ? (
                    <button
                      onClick={() => handleResolve(alt.id)}
                      className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 transition-colors font-semibold"
                    >
                      MARK RESOLVED
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      RESOLVED
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
