import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  X,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Users,
  FileText,
  ScanFace,
  Clock,
  ShieldAlert,
  ListFilter,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DatabaseStats } from '../types.ts';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    actionType: 'reset_demo' | 'reset_empty' | 'clear_table' | 'purge_all';
    targetTable?: 'sessions' | 'identities' | 'alerts' | 'audit_logs';
    badgeText?: string;
  }>({
    open: false,
    title: '',
    description: '',
    actionType: 'reset_demo',
  });

  const fetchStats = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/database/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch database stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      setMessage(null);
    }
  }, [isOpen, token]);

  const handleExecuteConfirmedAction = async () => {
    if (!token) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      let res: Response;
      if (confirmDialog.actionType === 'reset_demo') {
        res = await fetch('/api/database/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ mode: 'demo' }),
        });
      } else if (confirmDialog.actionType === 'reset_empty') {
        res = await fetch('/api/database/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ mode: 'empty' }),
        });
      } else if (confirmDialog.actionType === 'clear_table' && confirmDialog.targetTable) {
        res = await fetch('/api/database/clear-table', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ table: confirmDialog.targetTable }),
        });
      } else if (confirmDialog.actionType === 'purge_all') {
        res = await fetch('/api/admin/purge-all-data', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.message || 'Database operation executed successfully.',
        });
        await fetchStats();
        if (onDataChanged) {
          onDataChanged();
        }
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to execute database operation.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Network error communicating with database server.',
      });
    } finally {
      setIsProcessing(false);
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#111318] border border-[#2A2D35] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0D0F12] border-b border-[#2A2D35] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#15171C] border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-wider font-sans">
                  DATABASE MANAGEMENT & RESET SUITE
                </h2>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                  JSON RELATIONAL STORE
                </span>
              </div>
              <p className="text-[11px] text-[#888] tracking-normal">
                Inspect storage metrics, reset to factory demo baseline, or delete records and collections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStats}
              disabled={isLoading}
              className="p-2 rounded bg-[#15171C] hover:bg-[#1C2027] text-[#888] hover:text-cyan-400 border border-[#2A2D35] cursor-pointer transition-colors"
              title="Refresh database statistics"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded bg-[#15171C] hover:bg-[#1F1315] text-[#888] hover:text-red-400 border border-[#2A2D35] hover:border-red-500/40 cursor-pointer transition-colors"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 bg-[#111318]">
          {/* Notification Banner */}
          {message && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/50 text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="text-xs">{message.text}</span>
            </div>
          )}

          {/* SECTION 1: LIVE STORAGE METRICS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-cyan-400 tracking-wider text-[11px] uppercase flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                1. STORAGE HEALTH & RECORD METRICS
              </span>
              <span className="text-[10px] text-[#666]">
                Physical Path: data/checkpoint_db.json
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>IDENTITIES</span>
                  <Users className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {stats ? stats.identitiesCount : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Enrolled Profiles</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>DOCUMENTS</span>
                  <FileText className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {stats ? stats.documentsCount : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Scanned & Stored</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>BIOMETRICS</span>
                  <ScanFace className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {stats ? stats.faceRecordsCount : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Face Reference Sets</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>SCREENINGS</span>
                  <Clock className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {stats ? stats.sessionsCount : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Verification Sessions</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>ALERTS</span>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {stats ? stats.alertsCount : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Security Flag Records</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#888] text-[10px]">
                  <span>DB SIZE</span>
                  <Database className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="mt-2 text-lg font-bold text-cyan-300 truncate">
                  {stats ? stats.dbFileSizeFormatted : '—'}
                </div>
                <div className="text-[9px] text-[#666] mt-0.5">Disk Footprint</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DATABASE RESET OPTIONS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-amber-400 tracking-wider text-[11px] uppercase flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                2. DATABASE RESET CONTROLS
              </span>
              <span className="text-[10px] text-[#888]">
                Restores predefined configurations or wipes operational registers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Option A: Reset to Demo Baseline */}
              <div className="p-4 rounded-xl bg-[#0D0F12] border border-[#2A2D35] hover:border-cyan-500/50 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold text-[10px]">
                      RECOMMENDED FOR TESTING
                    </span>
                    <RotateCcw className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans uppercase">
                    Reset to Official Demo Baseline
                  </h4>
                  <p className="text-[#888] text-[11px] mt-1 leading-relaxed">
                    Restores the standard authentic traveler profile for{' '}
                    <strong className="text-slate-200 font-semibold">GARIMA THAPLIYAL</strong> (Passport{' '}
                    <span className="text-cyan-400 font-semibold">SP003369</span>, Republic of India, authentic pass status)
                    along with the 5 standard officer roles. Ideal for immediate verification screening without re-enrollment.
                  </p>
                </div>

                <button
                  id="reset-demo-baseline-button"
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Reset Database to Official Demo Baseline?',
                      description:
                        'This will restore the authentic traveler records (GARIMA THAPLIYAL / SP003369) and baseline verification state. Any temporary test records added will be replaced by the official baseline.',
                      actionType: 'reset_demo',
                      badgeText: 'RESTORE BASELINE',
                    })
                  }
                  className="mt-4 w-full py-2.5 px-3 rounded-lg bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>RESET TO DEMO BASELINE</span>
                </button>
              </div>

              {/* Option B: Reset to Empty State */}
              <div className="p-4 rounded-xl bg-[#0D0F12] border border-[#2A2D35] hover:border-amber-500/50 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                      PRISTINE REGISTRATION
                    </span>
                    <RefreshCw className="h-4 w-4 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans uppercase">
                    Reset to Clean / Empty State
                  </h4>
                  <p className="text-[#888] text-[11px] mt-1 leading-relaxed">
                    Clears all traveler profiles, uploaded identity documents, extracted OCR tokens, and historical screening sessions.
                    Preserves authorized officer accounts for a clean, blank slate deployment.
                  </p>
                </div>

                <button
                  id="reset-empty-slate-button"
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Reset Database to Clean Empty State?',
                      description:
                        'All registered identities, document records, and verification histories will be wiped. Officer login credentials will be preserved.',
                      actionType: 'reset_empty',
                      badgeText: 'CLEAN SLATE',
                    })
                  }
                  className="mt-4 w-full py-2.5 px-3 rounded-lg bg-amber-950/50 hover:bg-amber-900 border border-amber-500/60 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>RESET TO EMPTY SLATE</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: GRANULAR DATA DELETION OPTIONS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-red-400 tracking-wider text-[11px] uppercase flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                3. DATA DELETE OPTIONS (COLLECTION LEVEL)
              </span>
              <span className="text-[10px] text-[#888]">
                Selectively purge individual tables without modifying other records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Clear Sessions */}
              <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Screening Sessions</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-400 font-bold">
                      {stats ? stats.sessionsCount : 0} records
                    </span>
                  </div>
                  <p className="text-[10px] text-[#777] mt-1.5 leading-relaxed">
                    Wipes all verification session histories, forensic evaluations, and risk reports.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Delete All Verification Sessions?',
                      description: `This will delete ${stats?.sessionsCount || 0} screening sessions, tampering analysis records, and risk assessments. Enrolled identities will remain intact.`,
                      actionType: 'clear_table',
                      targetTable: 'sessions',
                      badgeText: 'DELETE SESSIONS',
                    })
                  }
                  className="mt-3 w-full py-2 px-2.5 rounded bg-[#1F1315] hover:bg-[#2C181C] border border-[#7F1D1D] text-red-400 font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>DELETE SESSIONS</span>
                </button>
              </div>

              {/* Clear Identities */}
              <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Identities & Documents</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-cyan-400 font-bold">
                      {stats ? stats.identitiesCount : 0} profiles
                    </span>
                  </div>
                  <p className="text-[10px] text-[#777] mt-1.5 leading-relaxed">
                    Deletes all enrolled traveler records, physical document scans, and facial templates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Delete All Enrolled Identities & Documents?',
                      description: `This will permanently delete ${stats?.identitiesCount || 0} identity profiles, ${stats?.documentsCount || 0} documents, and all facial biometrics from the database.`,
                      actionType: 'clear_table',
                      targetTable: 'identities',
                      badgeText: 'DELETE IDENTITIES',
                    })
                  }
                  className="mt-3 w-full py-2 px-2.5 rounded bg-[#1F1315] hover:bg-[#2C181C] border border-[#7F1D1D] text-red-400 font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>DELETE IDENTITIES</span>
                </button>
              </div>

              {/* Clear Alerts */}
              <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Security Alerts</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-400 font-bold">
                      {stats ? stats.alertsCount : 0} alerts
                    </span>
                  </div>
                  <p className="text-[10px] text-[#777] mt-1.5 leading-relaxed">
                    Clears all unresolved and resolved tampering alerts and security notifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Delete All Security Alerts?',
                      description: `This will clear all ${stats?.alertsCount || 0} alert notices from the active border security queue.`,
                      actionType: 'clear_table',
                      targetTable: 'alerts',
                      badgeText: 'DELETE ALERTS',
                    })
                  }
                  className="mt-3 w-full py-2 px-2.5 rounded bg-[#1F1315] hover:bg-[#2C181C] border border-[#7F1D1D] text-red-400 font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>DELETE ALERTS</span>
                </button>
              </div>

              {/* Clear Audit Logs */}
              <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Audit Trail Ledger</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 font-bold">
                      {stats ? stats.auditLogsCount : 0} entries
                    </span>
                  </div>
                  <p className="text-[10px] text-[#777] mt-1.5 leading-relaxed">
                    Purges event logs while writing an initial ledger initialization marker.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      open: true,
                      title: 'Purge Cryptographic Audit Ledger?',
                      description: `This will purge ${stats?.auditLogsCount || 0} historical officer audit events. A new cryptographic genesis entry will be recorded.`,
                      actionType: 'clear_table',
                      targetTable: 'audit_logs',
                      badgeText: 'PURGE AUDIT LOGS',
                    })
                  }
                  className="mt-3 w-full py-2 px-2.5 rounded bg-[#1F1315] hover:bg-[#2C181C] border border-[#7F1D1D] text-red-400 font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>PURGE AUDIT LOGS</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0D0F12] border-t border-[#2A2D35] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-[#666] flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Target Node: Terminal 1 Local Storage</span>
            <span>•</span>
            <span>Synced: {stats ? new Date(stats.lastSaved).toLocaleTimeString() : '—'}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#15171C] hover:bg-[#1C2027] text-slate-300 border border-[#2A2D35] font-bold text-xs cursor-pointer transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>

        {/* INNER CONFIRMATION MODAL */}
        <AnimatePresence>
          {confirmDialog.open && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#15171C] border border-red-500/50 rounded-xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-950/60 border border-red-500/60 flex items-center justify-center text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                      CONFIRMATION REQUIRED
                    </span>
                    <h3 className="text-sm font-bold text-white font-sans uppercase">
                      {confirmDialog.title}
                    </h3>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] text-[11px] text-[#AAA] leading-relaxed">
                  {confirmDialog.description}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2A2D35]">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                    className="px-3.5 py-2 rounded-lg bg-[#0D0F12] hover:bg-[#1C2027] text-slate-300 border border-[#2A2D35] font-bold text-xs cursor-pointer transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    id="confirm-database-action-button"
                    type="button"
                    disabled={isProcessing}
                    onClick={handleExecuteConfirmedAction}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>EXECUTING...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>CONFIRM & PROCEED</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
