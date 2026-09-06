import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Calendar,
  Download,
  Filter,
  Activity,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DashboardStats, VerificationSession } from '../types.ts';

export const AnalyticsPortal: React.FC = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [dateRange, setDateRange] = useState<string>('30_DAYS');

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const statsRes = await fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }

        const sessRes = await fetch('/api/verification/sessions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (sessRes.ok) {
          const data = await sessRes.json();
          setSessions(data);
        }
      } catch (err) {
        console.error('Analytics fetch error:', err);
      }
    };
    fetchData();
  }, [token]);

  // Export CSV summary report
  const handleExportCsv = () => {
    if (!sessions.length) return;
    const headers = 'SessionNumber,StartedAt,Officer,DocumentType,RiskScore,FinalDecision\n';
    const rows = sessions
      .map(
        (s) =>
          `"${s.sessionNumber}","${s.startedAt}","${s.officerName}","${s.scannedDocType}",${s.riskAssessment?.score ?? 0},"${s.finalDecision}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screening_analytics_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasSessions = sessions.length > 0;
  const total = sessions.length;
  const verifiedCount = sessions.filter((s) => s.finalDecision === 'VERIFIED').length;
  const anomalyCount = sessions.filter((s) => s.finalDecision === 'ANOMALY_DETECTED').length;
  const reviewCount = sessions.filter((s) => s.finalDecision === 'REVIEW_REQUIRED').length;
  const faceMatchesCount = sessions.filter((s) => s.faceVerification?.result === 'MATCH').length;
  const faceVerifiedTotal = sessions.filter((s) => !!s.faceVerification).length;
  const biometricMatchRate = faceVerifiedTotal > 0 ? ((faceMatchesCount / faceVerifiedTotal) * 100).toFixed(1) : '0.0';

  // Real officer activity aggregation
  const officerStatsMap = new Map<string, { officer: string; total: number; verified: number; anomalies: number; totalRisk: number }>();
  sessions.forEach((s) => {
    const key = s.officerName || 'Unknown Officer';
    const curr = officerStatsMap.get(key) || { officer: key, total: 0, verified: 0, anomalies: 0, totalRisk: 0 };
    curr.total += 1;
    if (s.finalDecision === 'VERIFIED') curr.verified += 1;
    if (s.finalDecision === 'ANOMALY_DETECTED') curr.anomalies += 1;
    curr.totalRisk += s.riskAssessment?.score ?? 0;
    officerStatsMap.set(key, curr);
  });
  const officerStats = Array.from(officerStatsMap.values());

  // Real document type distribution
  const docTypeLabels: Record<string, string> = {
    PASSPORT: 'PASSPORTS',
    VISA: 'VISAS',
    NATIONAL_ID: 'NATIONAL IDENTIFICATION',
    RESIDENCE_PERMIT: 'RESIDENCE PERMITS',
  };
  const docTypes = ['PASSPORT', 'VISA', 'NATIONAL_ID', 'RESIDENCE_PERMIT'].map((type) => {
    const count = sessions.filter((s) => s.scannedDocType === type && s.finalDecision === 'ANOMALY_DETECTED').length;
    const percent = anomalyCount > 0 ? Math.round((count / anomalyCount) * 100) : 0;
    return {
      type: docTypeLabels[type] || type,
      count,
      percent,
    };
  });

  return (
    <div className="flex-1 p-6 lg:p-8 bg-slate-950 text-slate-100 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono font-bold tracking-wider text-purple-400 uppercase">
            PORTAL: INTELLIGENCE & ANALYTICS
          </div>
          <h2 className="text-2xl font-bold text-white uppercase">
            Fraud Trends & Operational Throughput
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated intelligence on identity tampering, biometric verification reliability, and checkpoint traffic.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200"
          >
            <option value="7_DAYS">Past 7 Days</option>
            <option value="30_DAYS">Past 30 Days</option>
            <option value="90_DAYS">Past Quarter</option>
          </select>

          <button
            id="export-analytics-csv"
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase">Screening Volume</div>
          <div className="text-3xl font-black text-white mt-1">{sessions.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Activity className="h-3 w-3 text-cyan-400" />
            <span>{hasSessions ? 'Active operational sessions' : 'Awaiting checkpoint activity'}</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase">Verification Rate</div>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            {hasSessions ? `${((verifiedCount / total) * 100).toFixed(1)}%` : '0.0%'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Cleared without secondary delay</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase">Fraud & Anomaly Rate</div>
          <div className="text-3xl font-black text-red-400 mt-1">
            {hasSessions ? `${((anomalyCount / total) * 100).toFixed(1)}%` : '0.0%'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Confirmed suspicious artifacts</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase">Biometric Match Rate</div>
          <div className="text-3xl font-black text-blue-400 mt-1">{biometricMatchRate}%</div>
          <div className="text-[11px] text-slate-500 mt-1">ISO-19794 facial compliance</div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Breakdown */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              Screening Decision Distribution
            </h3>
            <span className="text-xs font-mono text-slate-400">{sessions.length} Cases</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="text-emerald-400 font-bold">🟢 Cleared / Verified</span>
                <span>{verifiedCount} ({hasSessions ? ((verifiedCount / total) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${hasSessions ? (verifiedCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="text-amber-400 font-bold">🟠 Review Required / Secondary</span>
                <span>{reviewCount} ({hasSessions ? ((reviewCount / total) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${hasSessions ? (reviewCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span className="text-red-400 font-bold">🔴 Anomaly / High Risk Flagged</span>
                <span>{anomalyCount} ({hasSessions ? ((anomalyCount / total) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${hasSessions ? (anomalyCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tampering by Document Type */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              Tampering by Document Type
            </h3>
            <span className="text-xs font-mono text-purple-400">Forensic Index</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {docTypes.map((d) => (
              <div key={d.type}>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{d.type}</span>
                  <span className="text-slate-400">{d.percent}% ({d.count} flags)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Officer Activity Ledger */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 font-mono text-xs">
        <h3 className="text-sm font-bold text-white uppercase">Officer Checkpoint Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">OFFICER</th>
                <th className="p-3">TOTAL SCREENINGS</th>
                <th className="p-3">VERIFIED</th>
                <th className="p-3">FLAGGED ANOMALIES</th>
                <th className="p-3">AVG RISK SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {officerStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No officer screening activities logged yet. New verifications conducted at the checkpoint will appear here.
                  </td>
                </tr>
              ) : (
                officerStats.map((stat) => (
                  <tr key={stat.officer} className="hover:bg-slate-800/40">
                    <td className="p-3 text-white font-bold">{stat.officer}</td>
                    <td className="p-3">{stat.total}</td>
                    <td className="p-3 text-emerald-400">{stat.verified}</td>
                    <td className="p-3 text-red-400">{stat.anomalies}</td>
                    <td className="p-3 text-blue-400">
                      {stat.total > 0 ? (stat.totalRisk / stat.total).toFixed(1) : '0.0'} / 100
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
