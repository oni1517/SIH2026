import React, { useState } from 'react';
import { EventLogItem } from '../types';
import { ScrollText, Search, Filter, Download, Trash2, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface EventLogPanelProps {
  events: EventLogItem[];
  onClearLogs: () => void;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({
  events,
  onClearLogs
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const filteredEvents = events.filter(e => {
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.message.toLowerCase().includes(q) || e.source.toLowerCase().includes(q) || e.timestamp.includes(q);
    }
    return true;
  });

  const handleExportCSV = () => {
    sound.playSuccess();
    const rows = [
      ['Timestamp', 'Source', 'Severity', 'Message'],
      ...filteredEvents.map(e => [e.timestamp, e.source, e.type, `"${e.message.replace(/"/g, '""')}"`])
    ];
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MINE_COMMAND_LOGS_${Date.now()}.csv`;
    a.click();
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'ROBOT':
        return 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
      case 'SENSOR_MESH':
        return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
      case 'LIDAR':
        return 'text-purple-400 border-purple-500/30 bg-purple-950/40';
      case 'OPERATOR':
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
      case 'MASTER':
      default:
        return 'text-blue-400 border-blue-500/30 bg-blue-950/40';
    }
  };

  return (
    <div className="bg-[#090f17] rounded-lg border border-[#1a2533] p-4 space-y-4 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#182330]">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100">
            SYSTEM TELEMETRY AUDIT TRAIL ({filteredEvents.length} RECORDS)
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none w-32 sm:w-44"
            />
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Sources</option>
            <option value="ROBOT">Robot BOT-01</option>
            <option value="SENSOR_MESH">Sensor Mesh</option>
            <option value="LIDAR">3D LiDAR</option>
            <option value="MASTER">Master Gateway</option>
            <option value="OPERATOR">Operator Actions</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => { sound.playClick(); onClearLogs(); }}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Clear Log View"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Event Records Feed */}
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1 text-xs font-mono">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No events match current filter.
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="px-3 py-2 bg-[#0c1420] border border-[#16212e] rounded hover:border-slate-700 transition-colors flex items-start gap-3"
            >
              <span className="text-slate-400 tabular-nums shrink-0 pt-0.5">
                {ev.timestamp}
              </span>

              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getSourceBadge(ev.source)}`}>
                {ev.source}
              </span>

              <p className="text-slate-300 font-sans text-xs leading-relaxed flex-1">
                {ev.message}
              </p>

              <span className="shrink-0 pt-0.5">
                {ev.type === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                {ev.type === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                {ev.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                {ev.type === 'info' && <Info className="w-3.5 h-3.5 text-cyan-500" />}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
