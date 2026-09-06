import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  FileText,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Save,
  Eye,
  Check,
  Edit3,
  ShieldCheck,
  Search,
  Database,
  History,
  Settings,
  Sparkles,
  Layers,
  LayoutDashboard,
  Users,
  Image as ImageIcon,
  Lock,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DocumentType,
  IdentityProfile,
  OcrResult,
  DocumentValidationResult,
  FaceRecord,
  DashboardStats,
} from '../types.ts';
import { DocumentViewer } from './DocumentViewer.tsx';
import { CameraCapture } from './CameraCapture.tsx';
import { DatabaseModal } from './DatabaseModal.tsx';
import { EditRecordModal } from './EditRecordModal.tsx';
import { optimizeImage } from '../utils/imageOptimizer.ts';

type EnrollmentStep = 1 | 2 | 3 | 4 | 5;
type EnrollmentTab = 'DASHBOARD' | 'NEW_ENROLLMENT' | 'RECORDS' | 'DOCUMENTS' | 'FACES' | 'AUDIT' | 'SETTINGS';

export const EnrollmentPortal: React.FC = () => {
  const { user, token, setCurrentPortal } = useAuth();

  // Active view tab
  const [currentTab, setCurrentTab] = useState<EnrollmentTab>('NEW_ENROLLMENT');

  // Step state
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>(1);

  // Step 1: Personal Info
  const [identityId, setIdentityId] = useState<string>(() => `ID-2026-${Math.floor(100000 + Math.random() * 900000)}`);
  const [fullName, setFullName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [nationality, setNationality] = useState<string>('');
  const [countryOfResidence, setCountryOfResidence] = useState<string>('');

  // Step 2: Document Upload
  const [docType, setDocType] = useState<DocumentType>('PASSPORT');
  const [documentDataUrl, setDocumentDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Step 3: OCR & Validation
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [validationResult, setValidationResult] = useState<DocumentValidationResult | null>(null);
  const [isEditingOcr, setIsEditingOcr] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string | null>(null);

  // Step 4: Face Capture
  const [capturedFaceData, setCapturedFaceData] = useState<string | null>(null);
  const [faceQualityScore, setFaceQualityScore] = useState<number>(96.5);

  // Step 5: Save & Confirmation
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [savedIdentityRecord, setSavedIdentityRecord] = useState<IdentityProfile | null>(null);

  // Records and Stats state for sidebar tabs
  const [registeredIdentities, setRegisteredIdentities] = useState<IdentityProfile[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<IdentityProfile | null>(null);
  const [recordToEdit, setRecordToEdit] = useState<IdentityProfile | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [identityToDelete, setIdentityToDelete] = useState<IdentityProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Step validation state & progression enforcement
  const [stepWarning, setStepWarning] = useState<string | null>(null);

  const isStep1Complete = fullName.trim().length > 0 && dateOfBirth.trim().length > 0 && nationality.trim().length > 0;
  const isStep2Complete = isStep1Complete && !!documentDataUrl;
  const isStep3Complete = isStep2Complete && !!ocrResult && !isProcessingOcr;
  const isStep4Complete = isStep3Complete && !!capturedFaceData;

  const canAccessStep = (step: EnrollmentStep): boolean => {
    if (step === 1) return true;
    if (step === 2) return isStep1Complete;
    if (step === 3) return isStep2Complete && !!ocrResult;
    if (step === 4) return isStep3Complete;
    if (step === 5) return isStep4Complete;
    return false;
  };

  const getStepBlockReason = (step: EnrollmentStep): string => {
    if (step === 2 && !isStep1Complete) {
      return 'Step 1 Incomplete: Full Legal Name, Date of Birth, and Nationality are required before proceeding to Document Upload.';
    }
    if (step === 3) {
      if (!isStep1Complete) return 'Step 1 Incomplete: Please complete Personal Info first.';
      if (!documentDataUrl) return 'Step 2 Incomplete: Please upload or scan a physical document first.';
      if (!ocrResult) return 'Step 2 Incomplete: Click "START OCR & VALIDATION" to extract document fields first.';
    }
    if (step === 4) {
      if (!isStep1Complete) return 'Step 1 Incomplete: Please complete Personal Info first.';
      if (!documentDataUrl) return 'Step 2 Incomplete: Please upload a physical document first.';
      if (!ocrResult) return 'Step 3 Incomplete: Complete OCR & Document Validation first.';
    }
    if (step === 5) {
      if (!isStep1Complete) return 'Step 1 Incomplete: Please complete Personal Info first.';
      if (!documentDataUrl) return 'Step 2 Incomplete: Please upload a physical document first.';
      if (!ocrResult) return 'Step 3 Incomplete: Complete OCR & Validation first.';
      if (!capturedFaceData) return 'Step 4 Incomplete: Live biometric face capture is required before final review & save.';
    }
    return 'Please complete previous steps first.';
  };

  const handleStepSelect = (targetStep: EnrollmentStep) => {
    if (canAccessStep(targetStep)) {
      setStepWarning(null);
      setCurrentStep(targetStep);
    } else {
      setStepWarning(getStepBlockReason(targetStep));
    }
  };

  // Fetch registered identities & stats
  const refreshRecords = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/identities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRegisteredIdentities(data);
      }

      const statsRes = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const s = await statsRes.json();
        setDashboardStats(s);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    }
  };

  useEffect(() => {
    refreshRecords();
  }, [token, currentTab]);

  useEffect(() => {
    const handleDbChange = () => {
      refreshRecords();
    };
    window.addEventListener('database-changed', handleDbChange);
    return () => window.removeEventListener('database-changed', handleDbChange);
  }, [token]);

  const handleDeleteIdentity = async (profile: IdentityProfile) => {
    if (!token) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/database/identities/${profile.id || profile.identityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteToast(`Deleted traveler record: ${profile.fullName} (${profile.identityId})`);
        setTimeout(() => setDeleteToast(null), 4000);
        await refreshRecords();
        if (selectedRecord?.id === profile.id || selectedRecord?.identityId === profile.identityId) {
          setSelectedRecord(null);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete identity profile.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting identity profile.');
    } finally {
      setIsDeleting(false);
      setIdentityToDelete(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!token) return;
    if (!confirm('Permanently delete this physical document scan from the database archive?')) return;
    try {
      const res = await fetch(`/api/database/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshRecords();
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  // Handle live document selection
  const handleFileSelect = (dataUrl: string, file: File) => {
    setDocumentDataUrl(dataUrl);
    setFileName(file.name);
    setOcrResult(null);
    setValidationResult(null);
  };

  // Run live OCR with client-side optimization and error resilience
  const handleStartOcr = async () => {
    if (!documentDataUrl || !token) return;
    setIsProcessingOcr(true);
    setOcrErrorMessage(null);

    try {
      // Optimize image payload before transmission
      const optimizedPayload = await optimizeImage(documentDataUrl, 1600, 0.85);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      let res: Response;
      try {
        res = await fetch('/api/ocr/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documentDataUrl: optimizedPayload || documentDataUrl,
            docType,
            documentId: `doc_${Date.now()}`,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn('OCR response parse error:', jsonErr);
      }

      if (res.ok && data.ocrResult) {
        setOcrResult(data.ocrResult);
        setOcrErrorMessage(null);

        // Auto-fill candidate profile from extracted credential if not yet entered
        const resolvedName = (fullName && fullName.trim() !== '') ? fullName : (data.ocrResult.fullName !== 'Unable to confidently extract' ? data.ocrResult.fullName : '');
        const resolvedDob = (dateOfBirth && dateOfBirth.trim() !== '') ? dateOfBirth : (data.ocrResult.dateOfBirth !== 'Unable to confidently extract' ? data.ocrResult.dateOfBirth : '');
        const resolvedNat = (nationality && nationality.trim() !== '') ? nationality : (data.ocrResult.nationality !== 'Unable to confidently extract' ? data.ocrResult.nationality : '');

        if (!fullName && resolvedName) setFullName(resolvedName);
        if (!dateOfBirth && resolvedDob) setDateOfBirth(resolvedDob);
        if (!nationality && resolvedNat) setNationality(resolvedNat);
        const resolvedGender = (data.ocrResult.gender && (data.ocrResult.gender === 'F' || data.ocrResult.gender === 'FEMALE'))
          ? 'FEMALE'
          : (data.ocrResult.gender && (data.ocrResult.gender === 'M' || data.ocrResult.gender === 'MALE'))
          ? 'MALE'
          : gender;

        if (data.ocrResult.gender && (data.ocrResult.gender === 'M' || data.ocrResult.gender === 'MALE')) {
          setGender('MALE');
        } else if (data.ocrResult.gender && (data.ocrResult.gender === 'F' || data.ocrResult.gender === 'FEMALE')) {
          setGender('FEMALE');
        }

        // Immediately trigger Document Validation
        try {
          const valRes = await fetch('/api/validate/document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ocrResult: data.ocrResult,
              declaredProfile: {
                fullName: resolvedName,
                dateOfBirth: resolvedDob,
                nationality: resolvedNat,
                gender: resolvedGender,
              },
            }),
          });
          const valData = await valRes.json();
          if (valRes.ok && valData.validationResult) {
            setValidationResult(valData.validationResult);
          }
        } catch (valErr) {
          console.warn('Document validation error:', valErr);
        }

        // Auto move to Step 3
        setCurrentStep(3);
      } else {
        const errorMsg = data.error || (res.status === 413 ? 'Document image size too large for proxy buffer.' : `OCR service returned status ${res.status}`);
        setOcrErrorMessage(errorMsg);
        populateFallbackOcr(errorMsg);
      }
    } catch (err: any) {
      console.warn('OCR processing notice:', err);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort
        ? 'OCR request took longer than expected due to network latency.'
        : `Network connection notice: ${err.message || 'Failed to fetch'}.`;
      setOcrErrorMessage(msg);
      populateFallbackOcr(msg);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const populateFallbackOcr = (reason: string) => {
    const fallback: OcrResult = {
      id: `ocr_manual_${Date.now()}`,
      documentId: `doc_${Date.now()}`,
      docType,
      surname: fullName ? fullName.split(' ').pop() || '' : 'Unable to confidently extract',
      givenName: fullName ? fullName.split(' ').slice(0, -1).join(' ') || '' : 'Unable to confidently extract',
      fullName: fullName || 'Unable to confidently extract',
      passportNumber: 'Unable to confidently extract',
      nationality: nationality || 'Unable to confidently extract',
      dateOfBirth: dateOfBirth || 'Unable to confidently extract',
      gender: gender || 'Unable to confidently extract',
      placeOfBirth: 'Unable to confidently extract',
      dateOfIssue: 'Unable to confidently extract',
      dateOfExpiry: 'Unable to confidently extract',
      issuingCountry: nationality || 'Unable to confidently extract',
      mrzLine1: '',
      mrzLine2: '',
      mrzRaw: '',
      confidence: 50,
      extractedFields: {},
      rawText: `Service notice: ${reason}. You can verify or edit fields manually.`,
      isManualCorrection: false,
    };
    setOcrResult(fallback);
  };

  // Submit manual OCR correction
  const handleSaveCorrection = async () => {
    if (!ocrResult || !token) return;
    try {
      const res = await fetch('/api/ocr/correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ocrId: ocrResult.id,
          updates: ocrResult,
          reason: correctionReason || 'Officer visual inspection adjustment',
        }),
      });
      if (res.ok) {
        setIsEditingOcr(false);
        // Re-run validation
        const valRes = await fetch('/api/validate/document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ocrResult,
            declaredProfile: { fullName, dateOfBirth, nationality },
          }),
        });
        const valData = await valRes.json();
        if (valData.validationResult) setValidationResult(valData.validationResult);
      }
    } catch (err) {
      console.error('Correction Error:', err);
    }
  };

  // Save full identity enrollment to database (Requirement #10)
  const handleSaveIdentityProfile = async () => {
    if (!token) return;
    setIsSaving(true);

    try {
      const payload = {
        profile: {
          identityId,
          fullName,
          dateOfBirth,
          gender,
          nationality,
          countryOfResidence,
        },
        document: documentDataUrl
          ? {
              docType,
              fileName,
              fileType: 'image/jpeg',
              fileData: documentDataUrl,
            }
          : null,
        ocr: ocrResult,
        validation: validationResult,
        face: capturedFaceData
          ? {
              faceImageData: capturedFaceData,
              captureQuality: faceQualityScore,
              detectedFacesCount: 1,
              isCentered: true,
            }
          : null,
      };

      const res = await fetch('/api/identities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.profile) {
        setSaveSuccess(true);
        setSavedIdentityRecord(data.profile);
        refreshRecords();
      }
    } catch (err) {
      console.error('Failed to save identity profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset wizard for new enrollment
  const handleNewEnrollmentReset = () => {
    setCurrentStep(1);
    setStepWarning(null);
    setIdentityId(`ID-2026-${Math.floor(100000 + Math.random() * 900000)}`);
    setFullName('');
    setDateOfBirth('');
    setGender('MALE');
    setNationality('');
    setCountryOfResidence('');
    setDocumentDataUrl(null);
    setFileName('');
    setOcrResult(null);
    setValidationResult(null);
    setCapturedFaceData(null);
    setSaveSuccess(false);
    setSavedIdentityRecord(null);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-53px)] bg-[#0A0B0D] text-[#E0E0E0] select-none">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#111318] border-r border-[#2A2D35] p-4 shrink-0 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-500 font-bold mb-1">
              PORTAL: ENROLLMENT
            </div>
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Identity Onboarding
            </h2>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setCurrentTab('NEW_ENROLLMENT')}
              className={`w-full text-left px-3 py-2.5 rounded font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'NEW_ENROLLMENT'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#15171C] border border-transparent'
              }`}
            >
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>New Enrollment</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('DASHBOARD')}
              className={`w-full text-left px-3 py-2.5 rounded font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'DASHBOARD'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#15171C] border border-transparent'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-400" />
              <span>Enrollment Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('RECORDS')}
              className={`w-full text-left px-3 py-2.5 rounded font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'RECORDS'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#15171C] border border-transparent'
              }`}
            >
              <Users className="h-4 w-4 text-cyan-400" />
              <span>Identity Records</span>
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0D0F12] text-cyan-400 border border-cyan-500/30">
                {registeredIdentities.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('DOCUMENTS')}
              className={`w-full text-left px-3 py-2.5 rounded font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'DOCUMENTS'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#15171C] border border-transparent'
              }`}
            >
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Documents Archive</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('FACES')}
              className={`w-full text-left px-3 py-2.5 rounded font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'FACES'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-[#888] hover:text-[#E0E0E0] hover:bg-[#15171C] border border-transparent'
              }`}
            >
              <ImageIcon className="h-4 w-4 text-cyan-400" />
              <span>Face Records</span>
            </button>
          </nav>
        </div>

        {/* Bottom Quick Switch to Verification Portal */}
        <div className="pt-4 border-t border-[#2A2D35]">
          <div className="text-[10px] font-mono text-[#888] mb-2 uppercase tracking-wider">Screening Operations</div>
          <button
            type="button"
            onClick={() => setCurrentPortal('VERIFICATION')}
            className="w-full py-2.5 px-3 rounded bg-[#0E2419] hover:bg-[#143224] border border-[#047857] text-[#4ADE80] text-[10px] font-mono font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[0_0_10px_rgba(74,222,128,0.15)]"
          >
            <span>GO TO VERIFICATION PORTAL</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        {/* VIEW 1: NEW ENROLLMENT (5-STEP WIZARD) */}
        {currentTab === 'NEW_ENROLLMENT' && (
          <div>
            {/* Step Progress Tracker Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between max-w-3xl mx-auto relative">
                {/* Connecting bar */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#2A2D35] -translate-y-1/2 z-0" />
                
                {[
                  { step: 1, label: 'Personal Info' },
                  { step: 2, label: 'Document Upload' },
                  { step: 3, label: 'OCR & Validation' },
                  { step: 4, label: 'Face Capture' },
                  { step: 5, label: 'Review & Save' },
                ].map((s) => {
                  const isActive = currentStep === s.step;
                  const isAccessible = canAccessStep(s.step as EnrollmentStep);
                  const isStepDone = (
                    (s.step === 1 && isStep1Complete) ||
                    (s.step === 2 && isStep2Complete && !!ocrResult) ||
                    (s.step === 3 && isStep3Complete) ||
                    (s.step === 4 && isStep4Complete)
                  );

                  return (
                    <div
                      key={s.step}
                      className={`relative z-10 flex flex-col items-center select-none ${
                        isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                      }`}
                      onClick={() => handleStepSelect(s.step as EnrollmentStep)}
                    >
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                          isActive
                            ? 'bg-cyan-500 text-[#0A0B0D] ring-4 ring-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                            : isStepDone
                            ? 'bg-[#0E2419] border border-[#047857] text-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.2)]'
                            : isAccessible
                            ? 'bg-[#15171C] border border-cyan-500/40 text-cyan-300'
                            : 'bg-[#0D0F12] border border-[#2A2D35] text-[#555]'
                        }`}
                      >
                        {isStepDone && !isActive ? (
                          <Check className="h-4 w-4" />
                        ) : !isAccessible ? (
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          s.step
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-mono tracking-wider uppercase hidden sm:flex items-center gap-1 ${
                          isActive
                            ? 'text-cyan-400 font-bold'
                            : isStepDone
                            ? 'text-emerald-400'
                            : isAccessible
                            ? 'text-slate-300'
                            : 'text-[#666]'
                        }`}
                      >
                        {!isAccessible && <Lock className="h-2.5 w-2.5 text-slate-600 inline" />}
                        <span>{s.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Warning Banner if user attempts to skip ahead */}
              <AnimatePresence>
                {stepWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-4 max-w-xl mx-auto p-3 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-center justify-between gap-3 shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{stepWarning}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStepWarning(null)}
                      className="text-amber-400 hover:text-amber-200 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-amber-900/50 cursor-pointer"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* STEP 1: PERSONAL INFORMATION */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-6 shadow-2xl max-w-2xl mx-auto relative overflow-hidden"
              >
                {/* Cyan top hairline */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

                <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#2A2D35]">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-cyan-500">
                      STEP 1 OF 5
                    </div>
                    <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide mt-0.5">
                      Personal Information Registration
                    </h3>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-[#0D0F12] border border-cyan-500/30 font-mono text-[10px] text-cyan-400">
                    ID: {identityId}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#AAA] mb-1.5 font-mono">
                      Full Legal Name
                    </label>
                    <input
                      id="input-full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter full legal name"
                      className="w-full px-3.5 py-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-[#E0E0E0] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#AAA] mb-1.5 font-mono">
                        Date of Birth (YYYY-MM-DD)
                      </label>
                      <input
                        id="input-dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-[#E0E0E0] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#AAA] mb-1.5 font-mono">
                        Gender
                      </label>
                      <select
                        id="select-gender"
                        value={gender}
                        onChange={(e: any) => setGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-[#E0E0E0] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                      >
                        <option value="FEMALE">Female (F)</option>
                        <option value="MALE">Male (M)</option>
                        <option value="OTHER">Other (X)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#AAA] mb-1.5 font-mono">
                        Nationality (3-letter ISO code / Country)
                      </label>
                      <input
                        id="input-nationality"
                        type="text"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value.toUpperCase())}
                        placeholder="USA, DEU, GBR, JPN"
                        className="w-full px-3.5 py-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-[#E0E0E0] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#AAA] mb-1.5 font-mono">
                        Country of Residence
                      </label>
                      <input
                        id="input-residence"
                        type="text"
                        value={countryOfResidence}
                        onChange={(e) => setCountryOfResidence(e.target.value)}
                        placeholder="Enter country of residence"
                        className="w-full px-3.5 py-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-[#E0E0E0] text-xs font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#2A2D35]">
                  {!isStep1Complete ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400/90">
                      <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Required: Full Legal Name, Date of Birth, and Nationality to unlock Step 2.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Personal details validated. Ready for document upload.</span>
                    </div>
                  )}

                  <button
                    id="step-1-next-button"
                    type="button"
                    disabled={!isStep1Complete}
                    onClick={() => {
                      if (isStep1Complete) {
                        setStepWarning(null);
                        setCurrentStep(2);
                      }
                    }}
                    className={`px-5 py-2.5 rounded font-bold text-xs font-mono tracking-[0.15em] uppercase flex items-center gap-2 transition-all ${
                      isStep1Complete
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-[0_0_15px_rgba(8,145,178,0.3)] active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-60'
                    }`}
                  >
                    <span>NEXT: DOCUMENT UPLOAD</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: LIVE DOCUMENT UPLOAD */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-3xl mx-auto"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-800 gap-3">
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                      STEP 2 OF 5
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Live Physical Document Upload
                    </h3>
                  </div>

                  {/* Document Type Selector (Passport, Visa, etc.) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">TYPE:</span>
                    <select
                      id="doc-type-selector"
                      value={docType}
                      onChange={(e: any) => setDocType(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                    >
                      <option value="PASSPORT">PASSPORT (PRIMARY)</option>
                      <option value="VISA">VISA</option>
                      <option value="NATIONAL ID">NATIONAL ID</option>
                      <option value="DRIVING LICENSE">DRIVING LICENSE</option>
                      <option value="PERMIT">RESIDENCE PERMIT</option>
                    </select>
                  </div>
                </div>

                {/* Document Viewer with Zoom, Rotate, Replace, OCR */}
                <DocumentViewer
                  documentDataUrl={documentDataUrl}
                  fileName={fileName}
                  onFileSelect={handleFileSelect}
                  onRemove={() => setDocumentDataUrl(null)}
                  onStartOcr={handleStartOcr}
                  isProcessingOcr={isProcessingOcr}
                />

                {ocrErrorMessage && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{ocrErrorMessage}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleStartOcr}
                        className="px-2.5 py-1 rounded bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 text-[11px] font-mono cursor-pointer"
                      >
                        RETRY OCR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingOcr(true);
                          setCurrentStep(3);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono cursor-pointer"
                      >
                        MANUAL ENTRY
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStepWarning(null);
                      setCurrentStep(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>BACK: PERSONAL INFO</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {!documentDataUrl ? (
                      <div className="text-xs font-mono text-amber-400/90 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Upload or select a credential to enable OCR & validation.</span>
                      </div>
                    ) : ocrResult && !isProcessingOcr ? (
                      <button
                        type="button"
                        onClick={() => {
                          setStepWarning(null);
                          setCurrentStep(3);
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>SKIP TO STEP 3</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    <button
                      id="step-2-next-ocr-button"
                      type="button"
                      disabled={!documentDataUrl || isProcessingOcr}
                      onClick={handleStartOcr}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30"
                    >
                      {isProcessingOcr ? (
                        <>
                          <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>PROCESSING OCR...</span>
                        </>
                      ) : (
                        <>
                          <span>{ocrResult ? 'RE-RUN OCR & VALIDATION' : 'START OCR & VALIDATION'}</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: LIVE OCR & VALIDATION */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-4xl mx-auto"
              >
                {/* Top Banner */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                      STEP 3 OF 5
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Live OCR Extraction & Security Checks
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Extracted fields from {docType}. Authorized officers can edit fields below to log manual corrections.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingOcr(!isEditingOcr)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isEditingOcr
                          ? 'bg-amber-950 border-amber-700 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditingOcr ? 'Cancel Edit' : 'Edit / Correct OCR'}</span>
                    </button>

                    {validationResult && (
                      <div
                        className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs flex items-center gap-1.5 ${
                          validationResult.overallStatus === 'PASS'
                            ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                            : validationResult.overallStatus === 'WARNING'
                            ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                            : 'bg-red-950/80 border-red-700 text-red-300'
                        }`}
                      >
                        <span>VALIDATION: {validationResult.overallStatus}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Mode Notice & Reason Input */}
                {isEditingOcr && (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span>MANUAL CORRECTION AUDIT TRAIL</span>
                    </div>
                    <p className="text-slate-300">
                      All modifications to optical character recognition data are permanently tracked under your Officer Badge. Please state the justification for adjusting extracted records.
                    </p>
                    <input
                      type="text"
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Reason for manual correction (e.g. Scanned font glare on line 2)"
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-amber-700 text-slate-100 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCorrection}
                      className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs font-mono cursor-pointer"
                    >
                      SAVE MANUAL CORRECTIONS
                    </button>
                  </div>
                )}

                {/* Extracted Fields Grid */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                  <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Extracted Travel & Identification Data
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 uppercase block">Surname / Nom</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.surname || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, surname: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                        />
                      ) : (
                        <span className="text-slate-200 font-bold text-sm">
                          {ocrResult?.surname || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase block">Given Names / Prénoms</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.givenName || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, givenName: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                        />
                      ) : (
                        <span className="text-slate-200 font-bold text-sm">
                          {ocrResult?.givenName || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase block">Document / Passport No.</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.passportNumber || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, passportNumber: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-blue-300 font-bold"
                        />
                      ) : (
                        <span className="text-blue-400 font-bold text-sm">
                          {ocrResult?.passportNumber || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase block">Nationality</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.nationality || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, nationality: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                        />
                      ) : (
                        <span className="text-slate-200 font-bold text-sm">
                          {ocrResult?.nationality || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase block">Date of Birth</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.dateOfBirth || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, dateOfBirth: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                        />
                      ) : (
                        <span className="text-slate-200 font-bold text-sm">
                          {ocrResult?.dateOfBirth || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase block">Date of Expiry</span>
                      {isEditingOcr ? (
                        <input
                          type="text"
                          value={ocrResult?.dateOfExpiry || ''}
                          onChange={(e) => ocrResult && setOcrResult({ ...ocrResult, dateOfExpiry: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                        />
                      ) : (
                        <span className="text-slate-200 font-bold text-sm">
                          {ocrResult?.dateOfExpiry || 'Unable to confidently extract'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* MRZ RAW READOUT */}
                  <div className="mt-5 p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-mono block mb-1">
                      MACHINE READABLE ZONE (MRZ LINES 1 & 2):
                    </span>
                    <pre className="text-xs font-mono text-emerald-400 tracking-wider overflow-x-auto select-all">
                      {ocrResult?.mrzRaw || (
                        <span className="text-slate-500 italic">No Machine Readable Zone (MRZ) detected or extracted for this document format</span>
                      )}
                    </pre>
                  </div>
                </div>

                {/* 11 Document Validation Security Checks Badges (Requirement #8) */}
                {validationResult && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                    <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">
                      Security & Consistency Checks (ICAO Doc 9303 Engine)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {validationResult.details.map((check) => (
                        <div
                          key={check.id}
                          className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-xs"
                        >
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 mt-0.5 ${
                              check.status === 'PASS'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : check.status === 'WARNING'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
                            }`}
                          >
                            {check.status === 'PASS' ? '✓ PASS' : check.status === 'WARNING' ? '⚠ WARN' : '✕ FAIL'}
                          </span>
                          <div>
                            <div className="font-bold text-slate-200">{check.name}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{check.details}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStepWarning(null);
                      setCurrentStep(2);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>BACK: DOCUMENT</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {!isStep3Complete && (
                      <div className="text-xs font-mono text-amber-400/90 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Extract document fields and security checks before proceeding.</span>
                      </div>
                    )}

                    <button
                      id="step-3-next-face-button"
                      type="button"
                      disabled={!isStep3Complete}
                      onClick={() => {
                        if (isStep3Complete) {
                          setStepWarning(null);
                          setCurrentStep(4);
                        } else {
                          setStepWarning(getStepBlockReason(4));
                        }
                      }}
                      className={`px-5 py-2.5 rounded-lg font-semibold text-xs font-mono tracking-wider flex items-center gap-2 transition-all ${
                        isStep3Complete
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg shadow-blue-900/30'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-60'
                      }`}
                    >
                      <span>NEXT: LIVE FACE CAPTURE</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: LIVE FACE CAPTURE */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <CameraCapture
                  initialCapturedDataUrl={capturedFaceData || undefined}
                  onConfirm={(dataUrl, quality) => {
                    setCapturedFaceData(dataUrl);
                    setFaceQualityScore(quality);
                    setStepWarning(null);
                    setCurrentStep(5);
                  }}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStepWarning(null);
                      setCurrentStep(3);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>BACK: OCR & VALIDATION</span>
                  </button>

                  {capturedFaceData ? (
                    <button
                      id="step-4-next-review-button"
                      type="button"
                      onClick={() => {
                        setStepWarning(null);
                        setCurrentStep(5);
                      }}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30 transition-all"
                    >
                      <span>NEXT: REVIEW & SAVE</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-amber-400 text-xs font-mono flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Live biometric capture required before unlocking Step 5</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 5: REVIEW & SAVE (Requirement #10) */}
            {currentStep === 5 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                        STEP 5 OF 5
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        Identity Summary & Enrollment Finalization
                      </h3>
                    </div>
                    <div className="px-3 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 font-bold">
                      READY TO COMMIT
                    </div>
                  </div>

                  {saveSuccess ? (
                    // Success Screen after saving
                    <div className="py-8 text-center space-y-5 font-mono">
                      <div className="h-16 w-16 mx-auto rounded-full bg-emerald-600/20 border border-emerald-500 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white">
                          ✓ IDENTITY PROFILE CREATED
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Enrolled identity registered in secure checkpoint registry with full biometric and document credentials.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs max-w-md mx-auto space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">ASSIGNED IDENTITY ID:</span>
                          <span className="font-bold text-blue-400">{savedIdentityRecord?.identityId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">TRAVELER NAME:</span>
                          <span className="font-bold text-slate-200">{savedIdentityRecord?.fullName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">NATIONALITY:</span>
                          <span className="font-bold text-slate-200">{savedIdentityRecord?.nationality}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">REGISTERED BY:</span>
                          <span className="text-slate-400">{savedIdentityRecord?.createdBy}</span>
                        </div>
                      </div>

                      <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={handleNewEnrollmentReset}
                          className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          ENROLL ANOTHER IDENTITY
                        </button>
                        <button
                          id="goto-verification-after-save"
                          type="button"
                          onClick={() => setCurrentPortal('VERIFICATION')}
                          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/40"
                        >
                          <span>GO TO VERIFICATION PORTAL</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Summary View before saving
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Profile Info Card */}
                        <div className="sm:col-span-2 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                          <div className="text-[11px] font-bold text-blue-400 uppercase">
                            1. Personal Identity Profile
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-300">
                            <div>
                              <span className="text-slate-500 block">IDENTITY ID</span>
                              <span className="font-bold text-white">{identityId}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">FULL NAME</span>
                              <span className="font-bold text-white">{fullName}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">DOB / GENDER</span>
                              <span>{dateOfBirth} ({gender})</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">NATIONALITY</span>
                              <span>{nationality} ({countryOfResidence})</span>
                            </div>
                          </div>
                        </div>

                        {/* Face preview thumbnail */}
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
                          <div className="text-[11px] font-mono font-bold text-blue-400 uppercase mb-2">
                            Enrolled Face
                          </div>
                          {capturedFaceData ? (
                            <img
                              src={capturedFaceData}
                              alt="Captured"
                              className="h-24 w-20 object-cover rounded border border-slate-700 shadow"
                            />
                          ) : (
                            <div className="h-24 w-20 rounded bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-[10px]">
                              No Face
                            </div>
                          )}
                          <span className="mt-1 text-[10px] font-mono text-emerald-400">
                            Quality: {faceQualityScore}%
                          </span>
                        </div>
                      </div>

                      {/* Document & Validation Summary */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                        <div className="text-[11px] font-bold text-blue-400 uppercase">
                          2. Document & Security Evaluation
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                          <div>
                            <span className="text-slate-500">TYPE:</span> {docType} • {fileName || 'Document scan'}
                          </div>
                          <div>
                            <span className="text-slate-500">PASSPORT NO:</span>{' '}
                            <span className="text-blue-400 font-bold">{ocrResult?.passportNumber || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">VALIDATION STATUS:</span>{' '}
                            <span className="text-emerald-400 font-bold">{validationResult?.overallStatus || 'PENDING'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(4)}
                          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>BACK</span>
                        </button>

                        <button
                          id="save-identity-profile-button"
                          type="button"
                          disabled={isSaving}
                          onClick={handleSaveIdentityProfile}
                          className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/40"
                        >
                          {isSaving ? (
                            <>
                              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>SAVING IDENTITY RECORD...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>SAVE IDENTITY PROFILE</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* VIEW 2: ENROLLMENT DASHBOARD */}
        {currentTab === 'DASHBOARD' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                OVERVIEW METRICS
              </div>
              <h2 className="text-xl font-bold text-white">Enrollment Database Health</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Total Registered Identities</span>
                <div className="text-2xl font-bold text-blue-400 mt-1">
                  {dashboardStats?.totalIdentities || registeredIdentities.length}
                </div>
                <span className="text-[11px] text-slate-500">Active records in database</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Documents Processed</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {dashboardStats?.documentsProcessed || registeredIdentities.length}
                </div>
                <span className="text-[11px] text-slate-500">ICAO-9303 scanned files</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Biometric Face References</span>
                <div className="text-2xl font-bold text-purple-400 mt-1">
                  {dashboardStats?.totalIdentities || registeredIdentities.length}
                </div>
                <span className="text-[11px] text-slate-500">ISO-19794 facial vectors</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Checkpoint Status</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">● ONLINE</div>
                <span className="text-[11px] text-slate-500">Port 3000 Active</span>
              </div>
            </div>

            {/* Recent Identities Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Recently Enrolled Travelers</h3>
                <button
                  type="button"
                  onClick={() => setCurrentTab('NEW_ENROLLMENT')}
                  className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                >
                  + Enroll Traveler
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">IDENTITY ID</th>
                      <th className="p-3">FULL NAME</th>
                      <th className="p-3">DOB</th>
                      <th className="p-3">NAT</th>
                      <th className="p-3">CREATED BY</th>
                      <th className="p-3">ENROLLED DATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {registeredIdentities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                          No identity records registered yet. Use the "Enroll New Identity" tab above to register your first record.
                        </td>
                      </tr>
                    ) : (
                      registeredIdentities.slice(0, 5).map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-800/50">
                          <td className="p-3 text-blue-400 font-bold">{rec.identityId}</td>
                          <td className="p-3 text-white">{rec.fullName}</td>
                          <td className="p-3 text-slate-300">{rec.dateOfBirth}</td>
                          <td className="p-3 text-slate-300">{rec.nationality}</td>
                          <td className="p-3 text-slate-400">{rec.createdBy}</td>
                          <td className="p-3 text-slate-500">{new Date(rec.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: IDENTITY RECORDS LIST */}
        {currentTab === 'RECORDS' && (
          <div className="space-y-6">
            {/* Delete Toast Notification */}
            {deleteToast && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center gap-2 shadow-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{deleteToast}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                  DATABASE REPOSITORY
                </div>
                <h2 className="text-xl font-bold text-white">Identity Records Registry</h2>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, Name or Nationality..."
                    className="pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsDbModalOpen(true)}
                  className="px-3 py-2 rounded-lg bg-[#101924] hover:bg-[#162538] text-cyan-300 border border-cyan-500/50 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-[0_0_8px_rgba(6,182,212,0.15)] transition-colors"
                  title="Database Management, Reset, and Data Delete Options"
                >
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">DB CONTROLS</span>
                  <span className="sm:hidden">DB</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">IDENTITY ID</th>
                      <th className="p-3.5">FULL NAME</th>
                      <th className="p-3.5">DOB / GENDER</th>
                      <th className="p-3.5">NATIONALITY</th>
                      <th className="p-3.5">COUNTRY</th>
                      <th className="p-3.5">ENROLLED BY</th>
                      <th className="p-3.5 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {registeredIdentities.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                          No identity records match current criteria. Enroll a record to view it in this registry.
                        </td>
                      </tr>
                    ) : (
                      registeredIdentities
                        .filter(
                          (i) =>
                            i.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.identityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            i.nationality.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-800/40">
                            <td className="p-3.5 text-blue-400 font-bold">{rec.identityId}</td>
                            <td className="p-3.5 text-white font-semibold">{rec.fullName}</td>
                            <td className="p-3.5 text-slate-300">
                              {rec.dateOfBirth} ({rec.gender})
                            </td>
                            <td className="p-3.5 text-slate-200">{rec.nationality}</td>
                            <td className="p-3.5 text-slate-400">{rec.countryOfResidence}</td>
                            <td className="p-3.5 text-slate-400">{rec.createdBy}</td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setRecordToEdit(rec)}
                                  className="px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-cyan-200 text-[11px] font-mono border border-cyan-600/60 cursor-pointer transition-colors flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                                  title={`Edit record ${rec.identityId}`}
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(rec)}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono border border-slate-700 cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Inspect</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIdentityToDelete(rec)}
                                  className="p-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[11px] font-mono border border-red-800/60 cursor-pointer transition-colors flex items-center gap-1"
                                  title={`Delete identity ${rec.identityId} from database`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: DOCUMENTS ARCHIVE */}
        {currentTab === 'DOCUMENTS' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                  OFFICIAL REPOSITORY
                </div>
                <h2 className="text-xl font-bold text-white">Stored Document Records</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDbModalOpen(true)}
                className="px-3 py-2 rounded-lg bg-[#101924] hover:bg-[#162538] text-cyan-300 border border-cyan-500/50 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer w-fit shadow-[0_0_8px_rgba(6,182,212,0.15)] transition-colors"
              >
                <Database className="h-3.5 w-3.5 text-cyan-400" />
                <span>DATABASE CONTROLS</span>
              </button>
            </div>

            {registeredIdentities.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center font-mono text-slate-500">
                No identity documents enrolled in the archive yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {registeredIdentities.map((rec) => (
                  <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-blue-400 font-bold">{rec.identityId}</span>
                        <span className="text-slate-500">PASSPORT</span>
                      </div>
                      <div className="text-sm font-bold text-white mt-1">{rec.fullName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Issuer: {rec.nationality} • Verified
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 text-[11px]">✓ ICAO-9303</span>
                      <button
                        type="button"
                        onClick={() => setIdentityToDelete(rec)}
                        className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[10px] font-mono border border-red-800/50 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Delete this record and associated document"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: FACE RECORDS */}
        {currentTab === 'FACES' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                BIOMETRICS REPOSITORY
              </div>
              <h2 className="text-xl font-bold text-white">Enrolled Face References</h2>
            </div>

            {registeredIdentities.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center font-mono text-slate-500">
                No biometric facial templates enrolled in the archive yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {registeredIdentities.map((rec) => (
                  <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center space-y-2">
                    <div className="aspect-[3/4] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      <div className="text-center p-2">
                        <div className="h-14 w-14 mx-auto rounded-full bg-blue-900/40 border border-blue-600/40 flex items-center justify-center text-blue-400 font-bold text-lg mb-1">
                          {rec.fullName.charAt(0)}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">ISO-19794</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{rec.fullName}</div>
                    <div className="text-[10px] font-mono text-blue-400">{rec.identityId}</div>
                    <div className="text-[10px] font-mono text-emerald-400">● Enrolled Active</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Record Inspection Modal Drawer */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">
                    Identity Record: {selectedRecord.identityId}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordToEdit(selectedRecord)}
                    className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/60 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-colors"
                    title="Edit record details"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>EDIT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500">FULL LEGAL NAME:</span>
                    <div className="font-bold text-white">{selectedRecord.fullName}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">DATE OF BIRTH:</span>
                    <div className="text-slate-200">{selectedRecord.dateOfBirth}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">NATIONALITY:</span>
                    <div className="text-slate-200">{selectedRecord.nationality}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">GENDER:</span>
                    <div className="text-slate-200">{selectedRecord.gender}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">COUNTRY OF RESIDENCE:</span>
                    <div className="text-slate-200">{selectedRecord.countryOfResidence}</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Created by: {selectedRecord.createdBy}</div>
                  <div>Timestamp: {new Date(selectedRecord.createdAt).toUTCString()}</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRecordToEdit(selectedRecord)}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-mono font-bold border border-cyan-600/60 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual Identity Record Deletion Confirmation Modal */}
      <AnimatePresence>
        {identityToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#15171C] border border-red-500/50 rounded-xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-950/60 border border-red-500/60 flex items-center justify-center text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                    PERMANENT DELETION
                  </span>
                  <h3 className="text-sm font-bold text-white font-sans uppercase">
                    Delete Traveler Identity?
                  </h3>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#888]">FULL NAME:</span>
                  <span className="font-bold text-white">{identityToDelete.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">IDENTITY ID:</span>
                  <span className="font-bold text-cyan-400">{identityToDelete.identityId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">NATIONALITY:</span>
                  <span className="text-slate-300">{identityToDelete.nationality}</span>
                </div>
              </div>

              <p className="text-[11px] text-[#888] leading-relaxed">
                This will permanently delete this identity record along with its enrolled physical documents, extracted OCR tokens, and facial biometric vectors from the database.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2A2D35]">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIdentityToDelete(null)}
                  className="px-3.5 py-2 rounded-lg bg-[#0D0F12] hover:bg-[#1C2027] text-slate-300 border border-[#2A2D35] font-bold text-xs cursor-pointer transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteIdentity(identityToDelete)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isDeleting ? 'DELETING...' : 'DELETE RECORD'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Database Management & Reset Suite Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onDataChanged={() => {
          refreshRecords();
          window.dispatchEvent(new CustomEvent('database-changed'));
        }}
      />

      {/* Edit Record Modal */}
      <EditRecordModal
        isOpen={!!recordToEdit}
        record={recordToEdit}
        onClose={() => setRecordToEdit(null)}
        onRecordUpdated={(updated) => {
          refreshRecords();
          if (selectedRecord && (selectedRecord.id === updated.id || selectedRecord.identityId === updated.identityId)) {
            setSelectedRecord(updated);
          }
        }}
      />
    </div>
  );
};
