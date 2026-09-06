import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, ShieldAlert, History, Lock, FileText, CheckCircle, Database, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { IdentityProfile, VerificationSession, AuditLog } from '../types.ts';
import { DatabaseModal } from './DatabaseModal.tsx';

export const AuditPortal: React.FC = () => {
  const { token, user } = useAuth();
  const [identities, setIdentities] = useState<IdentityProfile[]>([]);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'IDENTITIES' | 'SESSIONS' | 'AUDIT'>('AUDIT');
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const idRes = await fetch('/api/identities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (idRes.ok) setIdentities(await idRes.json());

      const sessRes = await fetch('/api/verification/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sessRes.ok) setSessions(await sessRes.json());

      const auditRes = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (auditRes.ok) {
        const contentType = auditRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          setAuditLogs(await auditRes.json());
        }
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleDbChange = () => {
      fetchData();
    };
    window.addEventListener('database-changed', handleDbChange);
    return () => window.removeEventListener('database-changed', handleDbChange);
  }, [fetchData]);

  const handleDeleteIdentity = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to permanently delete traveler record: ${name} (${id}) from the database?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/database/identities/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionNotice(`Successfully deleted identity ${id} (${name}).`);
        setTimeout(() => setActionNotice(null), 4000);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete identity.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionNumber: string) => {
    if (!token) return;
    if (!confirm(`Delete verification session record ${sessionNumber}?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/database/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionNotice(`Successfully deleted session ${sessionNumber}.`);
        setTimeout(() => setActionNotice(null), 4000);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete session.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-slate-950 text-slate-100 max-w-7xl mx-auto w-full space-y-6">
      {/* Header with Strict View-Only Access Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            <span>PORTAL: AUDIT & INSPECTION — ADMINISTRATIVE ACCESS</span>
          </div>
          <h2 className="text-2xl font-bold text-white uppercase font-sans">
            Compliance & System Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Repository of immutable officer actions, screening transactions, and identity ledger history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Database Reset & Management Suite Trigger */}
          <button
            id="audit-database-controls-button"
            type="button"
            onClick={() => setIsDbModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-600/80 hover:bg-cyan-900/80 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-colors"
            title="Open Database Reset and Data Delete Options"
          >
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span>DATABASE & RESET</span>
          </button>

          {user?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setIsDbModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-700/80 hover:bg-red-900 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>DATA PURGE</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            <span>AUDIT PROTECTED</span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`px-3 py-2 rounded-lg font-bold cursor-pointer transition-colors ${
            activeTab === 'AUDIT'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          System Audit Logs ({auditLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SESSIONS')}
          className={`px-3 py-2 rounded-lg font-bold cursor-pointer transition-colors ${
            activeTab === 'SESSIONS'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Verification Histories ({sessions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IDENTITIES')}
          className={`px-3 py-2 rounded-lg font-bold cursor-pointer transition-colors ${
            activeTab === 'IDENTITIES'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Identity Master Index ({identities.length})
        </button>
      </div>

      {/* AUDIT LOGS VIEW */}
      {activeTab === 'AUDIT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono text-xs">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-slate-300">CRYPTOGRAPHIC AUDIT CHAIN (SHA-256 HASHED)</span>
            <span className="text-slate-500 text-[11px]">Strict Sequential Ordering</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">TIMESTAMP (UTC)</th>
                  <th className="p-3">OFFICER / USER</th>
                  <th className="p-3">ROLE</th>
                  <th className="p-3">ACTION EVENT</th>
                  <th className="p-3">ENTITY</th>
                  <th className="p-3">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                      Audit chain initialized. No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{new Date(log.timestamp).toUTCString()}</td>
                      <td className="p-3 text-white font-bold">{log.officerName || (log as any).username || 'System'}</td>
                      <td className="p-3 text-blue-400">{log.role}</td>
                      <td className="p-3 font-semibold text-emerald-400">{log.action}</td>
                      <td className="p-3 text-slate-300">{log.targetId || (log as any).entityType || 'SYSTEM'}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SESSIONS VIEW */}
      {activeTab === 'SESSIONS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">SESSION ID</th>
                <th className="p-3">DATE / TIME</th>
                <th className="p-3">OFFICER</th>
                <th className="p-3">TRAVELER</th>
                <th className="p-3">RISK SCORE</th>
                <th className="p-3">VERDICT</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                    No checkpoint verification sessions recorded yet.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-blue-400 font-bold">{s.sessionNumber}</td>
                    <td className="p-3 text-slate-400">{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="p-3 text-slate-300">{s.officerName}</td>
                    <td className="p-3 text-white">{s.matchedIdentity?.fullName || s.scannedOcr?.fullName}</td>
                    <td className="p-3 text-slate-300">{s.riskAssessment?.score ?? 0}/100</td>
                    <td className="p-3 font-bold text-emerald-400">{s.finalDecision}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id, s.sessionNumber)}
                        className="p-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[10px] font-mono border border-red-800/60 cursor-pointer transition-colors inline-flex items-center gap-1"
                        title={`Delete session ${s.sessionNumber} from database`}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* IDENTITIES VIEW */}
      {activeTab === 'IDENTITIES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">IDENTITY ID</th>
                <th className="p-3">FULL NAME</th>
                <th className="p-3">DATE OF BIRTH</th>
                <th className="p-3">NATIONALITY</th>
                <th className="p-3">ENROLLED BY</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {identities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                    Master identity index is empty. Enroll identities in the Enrollment Portal.
                  </td>
                </tr>
              ) : (
                identities.map((id) => (
                  <tr key={id.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-blue-400 font-bold">{id.identityId}</td>
                    <td className="p-3 text-white font-bold">{id.fullName}</td>
                    <td className="p-3 text-slate-300">{id.dateOfBirth}</td>
                    <td className="p-3 text-slate-300">{id.nationality}</td>
                    <td className="p-3 text-slate-400">{id.createdBy}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteIdentity(id.id || id.identityId, id.fullName)}
                        className="p-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[10px] font-mono border border-red-800/60 cursor-pointer transition-colors inline-flex items-center gap-1"
                        title={`Delete traveler ${id.identityId} from database`}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Database Management & Reset Suite Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onDataChanged={() => {
          fetchData();
          window.dispatchEvent(new CustomEvent('database-changed'));
        }}
      />
    </div>
  );
};
