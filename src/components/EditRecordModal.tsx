import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Edit3,
  Save,
  AlertTriangle,
  CheckCircle,
  FileText,
  UserCheck,
  ShieldAlert,
  Calendar,
  Globe,
  Hash,
  Clock,
} from 'lucide-react';
import { IdentityProfile, DocumentType } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface EditRecordModalProps {
  isOpen: boolean;
  record: IdentityProfile | null;
  onClose: () => void;
  onRecordUpdated: (updated: IdentityProfile) => void;
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  record,
  onClose,
  onRecordUpdated,
}) => {
  const { token, user } = useAuth();

  // Personal information fields
  const [fullName, setFullName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [nationality, setNationality] = useState<string>('');
  const [countryOfResidence, setCountryOfResidence] = useState<string>('');
  const [identityId, setIdentityId] = useState<string>('');

  // Associated document fields
  const [docType, setDocType] = useState<DocumentType>('PASSPORT');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [dateOfExpiry, setDateOfExpiry] = useState<string>('');
  const [issuingCountry, setIssuingCountry] = useState<string>('');

  // Audit note & state
  const [reason, setReason] = useState<string>('Officer record rectification');
  const [customReason, setCustomReason] = useState<string>('');
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize and load detailed document/OCR info when record changes
  useEffect(() => {
    if (!isOpen || !record) return;

    setFullName(record.fullName || '');
    setDateOfBirth(record.dateOfBirth || '');
    setGender(record.gender || 'MALE');
    setNationality(record.nationality || '');
    setCountryOfResidence(record.countryOfResidence || '');
    setIdentityId(record.identityId || '');
    setReason('Officer record rectification');
    setCustomReason('');
    setError(null);
    setSuccessNotice(null);

    // Fetch full details including document OCR
    const fetchFullDetails = async () => {
      if (!token) return;
      setIsLoadingDetails(true);
      try {
        const res = await fetch(`/api/identities/${record.id || record.identityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.documents && data.documents.length > 0) {
            const firstDoc = data.documents[0];
            setDocType(firstDoc.docType || 'PASSPORT');
            if (firstDoc.ocr) {
              setDocumentNumber(firstDoc.ocr.documentNumber || '');
              setDateOfExpiry(firstDoc.ocr.dateOfExpiry || '');
              setIssuingCountry(firstDoc.ocr.issuingCountry || firstDoc.ocr.nationality || record.nationality || '');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load record details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchFullDetails();
  }, [isOpen, record, token]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!fullName.trim()) {
      setError('Full legal name is mandatory.');
      return;
    }
    if (!nationality.trim()) {
      setError('Nationality is mandatory.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const finalReason = reason === 'Other' && customReason.trim()
      ? customReason.trim()
      : reason;

    try {
      const res = await fetch(`/api/identities/${record.id || record.identityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          dateOfBirth: dateOfBirth.trim(),
          gender,
          nationality: nationality.trim(),
          countryOfResidence: countryOfResidence.trim(),
          identityId: identityId.trim(),
          docType,
          documentNumber: documentNumber.trim(),
          dateOfExpiry: dateOfExpiry.trim(),
          issuingCountry: issuingCountry.trim() || nationality.trim(),
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update record.');
      }

      setSuccessNotice(`✓ Record ${data.profile.identityId} updated successfully.`);
      onRecordUpdated(data.profile);
      window.dispatchEvent(new CustomEvent('database-changed'));

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#12141A] border border-cyan-500/50 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-6 text-slate-200 font-mono text-xs"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#242833] pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-500/60 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    RECORD AMENDMENT
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-[10px] text-cyan-300 font-bold">
                    {record.identityId}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-sans uppercase">
                  Edit Traveler Identity Record
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1A1D24] hover:bg-[#252A34] text-slate-400 hover:text-white border border-[#2E3340] cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-500/60 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {isLoadingDetails && (
            <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-[11px] flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 animate-spin" />
              <span>Fetching synchronized document metadata...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Personal Demographic Details */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-[#242833] space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-bold uppercase tracking-wider border-b border-[#1F232D] pb-2">
                <UserCheck className="h-3.5 w-3.5" />
                <span>Traveler Personal Profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white font-sans text-xs font-semibold"
                    placeholder="e.g. JOHN DOE"
                  />
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Date of Birth (YYYY-MM-DD) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    placeholder="1985-05-15"
                  />
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Gender *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono cursor-pointer"
                  >
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Nationality (ISO 3-Letter / Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    placeholder="IND, USA, GBR, FRA, DEU..."
                  />
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Country of Residence
                  </label>
                  <input
                    type="text"
                    value={countryOfResidence}
                    onChange={(e) => setCountryOfResidence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    placeholder="e.g. INDIA, UNITED STATES"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Associated Document & Credential Identifiers */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-[#242833] space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-bold uppercase tracking-wider border-b border-[#1F232D] pb-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Enrolled Document & OCR Metadata</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono cursor-pointer"
                  >
                    <option value="PASSPORT">PASSPORT</option>
                    <option value="NATIONAL ID">NATIONAL ID</option>
                    <option value="VISA">VISA</option>
                    <option value="DRIVING LICENSE">DRIVING LICENSE</option>
                    <option value="PERMIT">PERMIT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Document / Passport Number
                  </label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-cyan-300 text-xs font-mono font-bold"
                    placeholder="e.g. SP003369 / P9823481"
                  />
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Document Expiry Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    value={dateOfExpiry}
                    onChange={(e) => setDateOfExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    placeholder="2032-12-31"
                  />
                </div>

                <div>
                  <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                    Issuing Country / Authority
                  </label>
                  <input
                    type="text"
                    value={issuingCountry}
                    onChange={(e) => setIssuingCountry(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                    placeholder="e.g. IND, USA, CAN"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Modification Justification & Audit Trail */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-[#242833] space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-[11px] font-bold uppercase tracking-wider border-b border-[#1F232D] pb-2">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Amendment Audit Justification</span>
              </div>

              <div>
                <label className="block text-[#888] text-[10px] uppercase font-bold mb-1">
                  Reason for Amendment
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-[#2A2F3D] focus:border-amber-500 focus:outline-none text-white text-xs font-mono cursor-pointer"
                >
                  <option value="Officer record rectification">Officer record rectification / spelling correction</option>
                  <option value="Traveler updated passport / document number">Traveler updated passport / renewal</option>
                  <option value="Clerical birth date correction">Clerical birth date correction</option>
                  <option value="Nationality / citizenship status change">Nationality / citizenship status change</option>
                  <option value="Biometric re-link verified">Biometric re-link verified</option>
                  <option value="Other">Other (specify below)</option>
                </select>
              </div>

              {reason === 'Other' && (
                <div>
                  <input
                    type="text"
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#151820] border border-amber-500/50 focus:outline-none text-white text-xs font-mono"
                    placeholder="Enter detailed modification reason for compliance log..."
                  />
                </div>
              )}

              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                <span>Acting Officer: <strong className="text-slate-300">{user?.fullName || 'Active Officer'}</strong></span>
                <span>Role: <strong className="text-cyan-400">{user?.role || 'DATA OFFICER'}</strong></span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242833]">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#151820] hover:bg-[#1E222D] text-slate-300 border border-[#2A2F3D] text-xs font-bold font-mono cursor-pointer transition-colors"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs font-mono flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'SAVING AMENDMENTS...' : 'SAVE CHANGES'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
