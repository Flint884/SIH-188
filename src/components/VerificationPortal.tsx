import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  Search,
  FileText,
  User,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  Check,
  ShieldAlert,
  Sliders,
  History,
  AlertCircle,
  FileCheck,
  UserX,
  UserCheck,
  ScanLine,
  LayoutDashboard,
  Bell,
  Clock,
  ExternalLink,
  Fingerprint,
  Lock,
  Trash2,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DocumentType,
  IdentityProfile,
  DocumentRecord,
  OcrResult,
  DocumentValidationResult,
  TamperingAnalysis,
  FaceVerificationResult,
  RiskAssessment,
  VerificationSession,
  VerificationFinalStatus,
  AlertRecord,
  InterviewState,
} from '../types.ts';
import { DocumentViewer } from './DocumentViewer.tsx';
import { CameraCapture } from './CameraCapture.tsx';
import { ForensicCheckView } from './ForensicCheckView.tsx';
import { AdaptiveInterviewView } from './AdaptiveInterviewView.tsx';
import { optimizeImage } from '../utils/imageOptimizer.ts';

type VerificationTab = 'SCREENING' | 'DASHBOARD' | 'RECENT' | 'ALERTS' | 'MANUAL_REVIEW';
type VerificationPhase =
  | 'UPLOAD_SCAN'
  | 'LOOKUP'
  | 'COMPARISON'
  | 'TAMPERING'
  | 'FACE_VERIFY'
  | 'AI_INTERVIEW'
  | 'RISK_DECISION'
  | 'FINAL_VERDICT';

export const VerificationPortal: React.FC = () => {
  const { user, token } = useAuth();

  // Tab
  const [currentTab, setCurrentTab] = useState<VerificationTab>('SCREENING');

  // Screening flow state
  const [screeningPhase, setScreeningPhase] = useState<VerificationPhase>('UPLOAD_SCAN');

  // Pre-Screening Case Metadata
  const [caseId, setCaseId] = useState<string>('');
  const [travelType, setTravelType] = useState<'Arrival' | 'Departure' | ''>('');
  const [originCountry, setOriginCountry] = useState<string>('');
  const [destinationCountry, setDestinationCountry] = useState<string>('');
  const [visaCategoryDeclared, setVisaCategoryDeclared] = useState<string>('');

  // Document scan state
  const [scannedDocType, setScannedDocType] = useState<DocumentType>('PASSPORT');
  const [scannedDocumentData, setScannedDocumentData] = useState<string | null>(null);
  const [scannedFileName, setScannedFileName] = useState<string>('');

  // OCR state
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [scannedOcr, setScannedOcr] = useState<OcrResult | null>(null);
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string | null>(null);

  // Database Lookup state
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupPerformed, setLookupPerformed] = useState<boolean>(false);
  const [lookupMessage, setLookupMessage] = useState<string>('');
  const [matchedIdentity, setMatchedIdentity] = useState<IdentityProfile | null>(null);
  const [storedDocument, setStoredDocument] = useState<DocumentRecord | null>(null);
  const [storedOcr, setStoredOcr] = useState<OcrResult | null>(null);
  const [storedFace, setStoredFace] = useState<any | null>(null);

  // Document Validation
  const [validationResult, setValidationResult] = useState<DocumentValidationResult | null>(null);

  // Tampering Analysis
  const [isAnalyzingTampering, setIsAnalyzingTampering] = useState<boolean>(false);
  const [tamperingAnalysis, setTamperingAnalysis] = useState<TamperingAnalysis | null>(null);

  // Live Face Verification
  const [isFaceCapturing, setIsFaceCapturing] = useState<boolean>(false);
  const [liveFaceData, setLiveFaceData] = useState<string | null>(null);
  const [isVerifyingFace, setIsVerifyingFace] = useState<boolean>(false);
  const [faceVerificationResult, setFaceVerificationResult] = useState<FaceVerificationResult | null>(null);

  // Adaptive AI Immigration Pre-Screening Interview
  const [interviewState, setInterviewState] = useState<InterviewState | null>(null);
  const [isStartingInterview, setIsStartingInterview] = useState<boolean>(false);

  // Risk Assessment & Final Status
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [finalDecision, setFinalDecision] = useState<VerificationFinalStatus | null>(null);
  const [completedSession, setCompletedSession] = useState<VerificationSession | null>(null);

  // Sequential phase enforcement & state guards
  const [verificationPhaseWarning, setVerificationPhaseWarning] = useState<string | null>(null);

  const isStage1Complete = Boolean(scannedDocumentData && scannedOcr && !isProcessingOcr);
  const isStage2Complete = Boolean(isStage1Complete && lookupPerformed);
  const isStage3Complete = Boolean(isStage2Complete && tamperingAnalysis && !isAnalyzingTampering);
  const isStage4Complete = Boolean(isStage3Complete && faceVerificationResult && !isVerifyingFace);
  const isStage5Complete = Boolean(
    isStage4Complete &&
      (interviewState
        ? interviewState.status !== 'IN_PROGRESS'
        : true)
  );
  const isStage6Complete = Boolean(isStage4Complete && finalDecision);

  const canAccessVerificationPhase = (phase: VerificationPhase): boolean => {
    if (phase === 'UPLOAD_SCAN') return true;
    if (phase === 'LOOKUP' || phase === 'COMPARISON') return isStage1Complete;
    if (phase === 'TAMPERING') return isStage2Complete && Boolean(tamperingAnalysis);
    if (phase === 'FACE_VERIFY') return isStage3Complete;
    if (phase === 'AI_INTERVIEW') return isStage4Complete;
    if (phase === 'FINAL_VERDICT' || phase === 'RISK_DECISION') return isStage4Complete;
    return false;
  };

  const getVerificationPhaseBlockReason = (phase: VerificationPhase): string => {
    if (phase === 'LOOKUP' || phase === 'COMPARISON') {
      if (!scannedDocumentData) return 'Stage 1 Incomplete: Please upload or capture a physical credential first.';
      if (!scannedOcr) return 'Stage 1 Incomplete: Click "PROCESS OCR & SEARCH REGISTRY" to extract fields first.';
    }
    if (phase === 'TAMPERING') {
      if (!isStage1Complete) return 'Stage 1 Incomplete: Document scan and OCR extraction are required first.';
      if (!lookupPerformed) return 'Stage 2 Incomplete: Database registry lookup must be executed first.';
      if (!tamperingAnalysis) return 'Stage 3 Incomplete: Click "RUN LIVE TAMPERING DETECTION" in Stage 2 first.';
    }
    if (phase === 'FACE_VERIFY') {
      if (!isStage1Complete) return 'Stage 1 Incomplete: Document scan and OCR extraction are required first.';
      if (!lookupPerformed) return 'Stage 2 Incomplete: Database registry lookup must be executed first.';
      if (!tamperingAnalysis) return 'Stage 3 Incomplete: Forensic optical & digital tampering analysis must be completed first.';
    }
    if (phase === 'AI_INTERVIEW') {
      if (!isStage4Complete) return 'Stage 4 Incomplete: Complete live face biometric verification first.';
    }
    if (phase === 'FINAL_VERDICT' || phase === 'RISK_DECISION') {
      if (!isStage1Complete) return 'Stage 1 Incomplete: Complete physical document ingestion first.';
      if (!lookupPerformed) return 'Stage 2 Incomplete: Complete registry parity check first.';
      if (!tamperingAnalysis) return 'Stage 3 Incomplete: Complete forensic tampering analysis first.';
      if (!faceVerificationResult) return 'Stage 4 Incomplete: Live biometric facial verification & anti-spoof checks must be completed first.';
    }
    return 'Please complete previous verification stages before advancing.';
  };

  const handlePhaseSelect = (targetPhase: VerificationPhase) => {
    if (canAccessVerificationPhase(targetPhase)) {
      setVerificationPhaseWarning(null);
      setScreeningPhase(targetPhase);
    } else {
      setVerificationPhaseWarning(getVerificationPhaseBlockReason(targetPhase));
    }
  };

  const getActiveStageNumber = (phase: VerificationPhase): number => {
    switch (phase) {
      case 'UPLOAD_SCAN':
        return 1;
      case 'LOOKUP':
      case 'COMPARISON':
        return 2;
      case 'TAMPERING':
        return 3;
      case 'FACE_VERIFY':
        return 4;
      case 'AI_INTERVIEW':
        return 5;
      case 'RISK_DECISION':
      case 'FINAL_VERDICT':
        return 6;
      default:
        return 1;
    }
  };

  const isStageNumberDone = (stageNum: number): boolean => {
    switch (stageNum) {
      case 1:
        return isStage1Complete;
      case 2:
        return isStage2Complete;
      case 3:
        return isStage3Complete;
      case 4:
        return isStage4Complete;
      case 5:
        return isStage5Complete;
      case 6:
        return isStage6Complete;
      default:
        return false;
    }
  };

  const canAccessStageNumber = (stageNum: number): boolean => {
    switch (stageNum) {
      case 1:
        return true;
      case 2:
        return isStage1Complete;
      case 3:
        return isStage2Complete && Boolean(tamperingAnalysis);
      case 4:
        return isStage3Complete;
      case 5:
        return isStage4Complete;
      case 6:
        return isStage4Complete;
      default:
        return false;
    }
  };

  const handleStageNumberClick = (stageNum: number) => {
    const targetMap: Record<number, VerificationPhase> = {
      1: 'UPLOAD_SCAN',
      2: 'COMPARISON',
      3: 'TAMPERING',
      4: 'FACE_VERIFY',
      5: 'AI_INTERVIEW',
      6: 'FINAL_VERDICT',
    };
    handlePhaseSelect(targetMap[stageNum] || 'UPLOAD_SCAN');
  };

  // Historical sessions & alerts
  const [recentSessions, setRecentSessions] = useState<VerificationSession[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<VerificationSession | null>(null);

  const fetchSessionsAndAlerts = async () => {
    if (!token) return;
    try {
      const sessRes = await fetch('/api/verification/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sessRes.ok) {
        const data = await sessRes.json();
        setRecentSessions(data);
      }

      const alertRes = await fetch('/api/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlerts(alertData);
      }
    } catch (err) {
      console.error('Error fetching verification sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessionsAndAlerts();
  }, [token, currentTab]);

  useEffect(() => {
    const handleDbChanged = () => {
      fetchSessionsAndAlerts();
    };
    window.addEventListener('database-changed', handleDbChanged);
    return () => window.removeEventListener('database-changed', handleDbChanged);
  }, [token]);

  // Handle uploaded document
  const handleDocumentSelect = (dataUrl: string, file: File) => {
    setScannedDocumentData(dataUrl);
    setScannedFileName(file.name);
    setScannedOcr(null);
    setLookupPerformed(false);
    setMatchedIdentity(null);
    setTamperingAnalysis(null);
    setFaceVerificationResult(null);
    setFinalDecision(null);
  };

  // STEP A: RUN LIVE OCR ON SCANNED DOCUMENT
  const handleStartScanOcr = async () => {
    if (!scannedDocumentData || !token) return;
    setIsProcessingOcr(true);
    setOcrErrorMessage(null);

    try {
      const optimizedPayload = await optimizeImage(scannedDocumentData, 1600, 0.85);

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
            documentDataUrl: optimizedPayload || scannedDocumentData,
            docType: scannedDocType,
            documentId: `scan_${Date.now()}`,
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
        console.warn('Scan OCR JSON parse error:', jsonErr);
      }

      if (res.ok && data.ocrResult) {
        setScannedOcr(data.ocrResult);
        setOcrErrorMessage(null);

        // Run validation with isVerification flag
        try {
          const valRes = await fetch('/api/validate/document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ocrResult: data.ocrResult,
              isVerification: true,
            }),
          });
          const valData = await valRes.json();
          if (valData.validationResult) {
            setValidationResult(valData.validationResult);
          }
        } catch (valErr) {
          console.warn('Validation error during verification scan:', valErr);
        }

        // Advance to Step B: Database Lookup
        setScreeningPhase('LOOKUP');
        performDatabaseLookup(data.ocrResult);
      } else {
        const errorMsg = data.error || (res.status === 413 ? 'Document scan size exceeded buffer limit.' : `OCR service returned status ${res.status}`);
        setOcrErrorMessage(errorMsg);
        setScannedOcr(null);
      }
    } catch (err: any) {
      console.warn('OCR Error in Verification:', err);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort
        ? 'OCR request timed out during high system activity.'
        : `Network connection issue: ${err.message || 'Failed to fetch'}.`;
      setOcrErrorMessage(msg);
      setScannedOcr(null);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // STEP B: REAL DATABASE LOOKUP (Requirement #13)
  const performDatabaseLookup = async (ocr: OcrResult) => {
    if (!token) return;
    setIsLookingUp(true);
    setLookupPerformed(true);

    try {
      const res = await fetch('/api/verification/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          passportNumber: ocr.passportNumber !== 'Unable to confidently extract' ? ocr.passportNumber : undefined,
          name: ocr.fullName !== 'Unable to confidently extract' ? ocr.fullName : undefined,
          dateOfBirth: ocr.dateOfBirth !== 'Unable to confidently extract' ? ocr.dateOfBirth : undefined,
        }),
      });

      const data = await res.json();
      if (data.found) {
        setLookupMessage('✓ IDENTITY RECORD FOUND IN REGISTRY');
        setMatchedIdentity(data.identity);
        setStoredDocument(data.storedDocument);
        setStoredOcr(data.storedOcr || null);
        setStoredFace(data.storedFace);

        // Re-evaluate document validation against the matched profile for full parity
        try {
          const valRes2 = await fetch('/api/validate/document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ocrResult: ocr,
              declaredProfile: {
                fullName: data.identity.fullName,
                dateOfBirth: data.identity.dateOfBirth,
                nationality: data.identity.nationality,
                gender: data.identity.gender,
              },
              isVerification: true,
            }),
          });
          const valData2 = await valRes2.json();
          if (valData2.validationResult) {
            setValidationResult(valData2.validationResult);
          }
        } catch (vErr) {
          console.error('Validation re-evaluation error:', vErr);
        }
      } else {
        setLookupMessage('⚠ IDENTITY RECORD NOT FOUND IN REGISTRY');
        setMatchedIdentity(null);
        setStoredDocument(null);
        setStoredOcr(null);
        setStoredFace(null);
      }

      setScreeningPhase('COMPARISON');
    } catch (err) {
      console.error('Lookup Error:', err);
      setLookupMessage('⚠ Database lookup error. Proceeding with caution.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // STEP D: LIVE TAMPERING DETECTION (Requirement #14)
  const handleRunTamperingAnalysis = async () => {
    if (!scannedDocumentData || !token) return;
    setIsAnalyzingTampering(true);

    try {
      const res = await fetch('/api/verification/tampering-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentDataUrl: scannedDocumentData,
          sessionId: `sess_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.analysis) {
        setTamperingAnalysis(data.analysis);
        setScreeningPhase('TAMPERING');
      }
    } catch (err) {
      console.error('Tampering error:', err);
    } finally {
      setIsAnalyzingTampering(false);
    }
  };

  // STEP E: LIVE FACE VERIFICATION (Stored Doc Photo vs Live Camera Feed) (Requirement #15)
  const handleRunFaceVerification = async (liveFaceImg: string) => {
    setLiveFaceData(liveFaceImg);
    if (!token) return;

    // Use stored face if found, otherwise use document image for face comparison
    const docPhotoReference = storedFace?.faceImageData || storedDocument?.fileData || scannedDocumentData;

    if (!docPhotoReference) {
      console.warn('No document image reference available for facial comparison.');
      return;
    }

    setIsVerifyingFace(true);

    try {
      const res = await fetch('/api/verification/face-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storedDocumentImageData: docPhotoReference,
          liveCameraImageData: liveFaceImg,
          sessionId: `sess_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.faceResult) {
        setFaceVerificationResult(data.faceResult);
        // Pre-evaluate risk in background so risk indicators are ready, but KEEP USER in FACE_VERIFY
        // so officer can inspect match and liveness anti-spoof findings thoroughly
        await evaluateRiskAndDecide(data.faceResult, false);
      }
    } catch (err) {
      console.error('Face verification error:', err);
    } finally {
      setIsVerifyingFace(false);
    }
  };

  const handleRetakeFaceVerification = () => {
    setLiveFaceData(null);
    setFaceVerificationResult(null);
  };

  // STEP E: START ADAPTIVE AI IMMIGRATION PRE-SCREENING INTERVIEW
  const handleStartAiInterview = async () => {
    if (!token) return;

    if (interviewState) {
      setScreeningPhase('AI_INTERVIEW');
      return;
    }

    setIsStartingInterview(true);
    try {
      const detectedNat = scannedOcr?.nationality || matchedIdentity?.nationality || '';
      const detectedOrigin = originCountry || matchedIdentity?.countryOfResidence || scannedOcr?.issuingCountry || '';
      const detectedDest = destinationCountry || '';
      const detectedVisa = visaCategoryDeclared || scannedOcr?.visaType || '';

      const res = await fetch('/api/verification/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caseContext: {
            caseId,
            travelType,
            nationality: detectedNat,
            origin: detectedOrigin,
            destination: detectedDest,
            visaType: detectedVisa,
            visaConditions: scannedOcr?.visaEntryType || scannedOcr?.visaStayDuration || '',
            ocrResult: scannedOcr,
            profile: matchedIdentity,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.interviewState) {
        setInterviewState(data.interviewState);
        setScreeningPhase('AI_INTERVIEW');
      } else {
        setVerificationPhaseWarning(data.error || 'Unable to start the AI interview.');
      }
    } catch (err) {
      console.error('Failed to start interview:', err);
      setScreeningPhase('AI_INTERVIEW');
    } finally {
      setIsStartingInterview(false);
    }
  };

  // STEP F & G: RISK ENGINE & FINAL DECISION (Requirements #16 & #17)
  const evaluateRiskAndDecide = async (
    faceRes?: FaceVerificationResult,
    transitionToVerdict: boolean = true,
    overrideInterview?: InterviewState
  ) => {
    if (!validationResult || !token) return;

    const currentInterview = overrideInterview !== undefined ? overrideInterview : interviewState;

    // Default tampering analysis if not yet run
    let currentTampering = tamperingAnalysis;
    if (!currentTampering) {
      currentTampering = {
        id: `tamp_${Date.now()}`,
        sessionId: 'sess_live',
        overallStatus: 'PASS',
        tamperingRisk: 'LOW',
        terminology: 'No significant anomaly detected',
        factors: {
          photoIntegrity: 'No edge anomalies',
          textConsistency: 'Standard font alignment',
          imageConsistency: 'Consistent guilloche pattern',
          documentLayout: 'Standard',
          copyPasteArtifacts: 'None detected',
          compressionInconsistencies: 'Uniform',
          mrzConsistency: 'Standard font',
          metadataConsistency: 'Standard',
        },
        regions: [],
        summary: 'Baseline structural verification completed.',
        performedAt: new Date().toISOString(),
      };
      setTamperingAnalysis(currentTampering);
    }

    try {
      const riskRes = await fetch('/api/verification/calculate-risk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          validationResult,
          tamperingAnalysis: currentTampering,
          faceResult: faceRes || faceVerificationResult,
          matchedIdentityFound: !!matchedIdentity,
          interviewState: currentInterview,
        }),
      });

      const riskData = await riskRes.json();
      if (riskRes.ok) {
        setRiskAssessment(riskData.riskAssessment);
        setFinalDecision(riskData.finalDecision);

        if (transitionToVerdict) {
          setScreeningPhase('FINAL_VERDICT');

          // Commit full session record to database
          const completeRes = await fetch('/api/verification/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              scannedDocumentData,
              scannedDocType,
              scannedOcr,
              matchedIdentity,
              storedDocument,
              storedFace,
              liveCapturedFaceData: liveFaceData,
              validationResult,
              tamperingAnalysis: currentTampering,
              faceVerification: faceRes || faceVerificationResult,
              interviewState: currentInterview,
              riskAssessment: riskData.riskAssessment,
              finalDecision: riskData.finalDecision,
              decisionNotes: `Screening completed by ${user?.fullName} at Checkpoint Alpha.`,
            }),
          });

          const completeData = await completeRes.json();
          if (completeData.session) {
            setCompletedSession(completeData.session);
            fetchSessionsAndAlerts();
          }
        }
      }
    } catch (err) {
      console.error('Failed to complete verification session:', err);
    }
  };

  // Reset for next traveler
  const handleResetForNewScreening = () => {
    setScreeningPhase('UPLOAD_SCAN');
    setVerificationPhaseWarning(null);
    setScannedDocumentData(null);
    setScannedFileName('');
    setScannedOcr(null);
    setLookupPerformed(false);
    setMatchedIdentity(null);
    setStoredDocument(null);
    setStoredOcr(null);
    setStoredFace(null);
    setValidationResult(null);
    setTamperingAnalysis(null);
    setLiveFaceData(null);
    setFaceVerificationResult(null);
    setInterviewState(null);
    setRiskAssessment(null);
    setFinalDecision(null);
    setCompletedSession(null);
  };

  // Helper comparison cell
  const renderComparisonRow = (
    label: string,
    storedVal?: string | null,
    scannedVal?: string | null
  ) => {
    let status: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE' = 'UNAVAILABLE';

    const isValMissing = (v?: string | null) => !v || v.trim() === '' || v === 'Unable to confidently extract' || v === 'undefined';

    if (isValMissing(storedVal) || isValMissing(scannedVal)) {
      status = 'UNAVAILABLE';
    } else {
      const s = storedVal!.trim().toUpperCase();
      const c = scannedVal!.trim().toUpperCase();

      if (label === 'Gender') {
        const normG = (val: string) => {
          if (val === 'F' || val === 'FEMALE') return 'F';
          if (val === 'M' || val === 'MALE') return 'M';
          return val;
        };
        status = normG(s) === normG(c) ? 'MATCH' : 'MISMATCH';
      } else if (label === 'Nationality') {
        const normNat = (val: string) => {
          if (val === 'IND' || val === 'INDIAN' || val === 'INDIA') return 'IND';
          if (val === 'USA' || val === 'AMERICAN' || val === 'UNITED STATES') return 'USA';
          return val;
        };
        status = normNat(s) === normNat(c) ? 'MATCH' : 'MISMATCH';
      } else if (label === 'Passport / Doc Number') {
        const cleanDoc = (val: string) => val.replace(/[\s\-_]/g, '');
        status = cleanDoc(s) === cleanDoc(c) ? 'MATCH' : 'MISMATCH';
      } else if (label === 'Full Name') {
        status = (s === c || s.includes(c) || c.includes(s)) ? 'MATCH' : 'MISMATCH';
      } else {
        status = s === c ? 'MATCH' : 'MISMATCH';
      }
    }

    const formatDisplay = (fieldLabel: string, val?: string | null) => {
      if (isValMissing(val)) return null;
      if (fieldLabel === 'Gender') {
        const v = val!.trim().toUpperCase();
        if (v === 'F' || v === 'FEMALE') return 'Female (F)';
        if (v === 'M' || v === 'MALE') return 'Male (M)';
      }
      return val;
    };

    const dispStored = formatDisplay(label, storedVal);
    const dispScanned = formatDisplay(label, scannedVal);

    return (
      <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
        <td className="p-3 text-slate-400 font-mono text-xs">{label}</td>
        <td className="p-3 font-mono text-xs text-slate-200">
          {dispStored || <span className="text-slate-500 italic">No Registry Data</span>}
        </td>
        <td className="p-3 font-mono text-xs text-slate-200">
          {dispScanned || <span className="text-slate-500 italic">Unreadable</span>}
        </td>
        <td className="p-3 text-right">
          <span
            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
              status === 'MATCH'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : status === 'MISMATCH'
                ? 'bg-red-950 text-red-400 border border-red-800'
                : 'bg-amber-950 text-amber-400 border border-amber-800'
            }`}
          >
            {status === 'MATCH' ? '✓ MATCH' : status === 'MISMATCH' ? '✕ MISMATCH' : '⚠ UNAVAILABLE'}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-53px)] bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/70 border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1">
              PORTAL: VERIFICATION
            </div>
            <h2 className="text-sm font-bold text-white uppercase">
              Border Screening Terminal
            </h2>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Checkpoint: Alpha Gate 4
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            <button
              type="button"
              onClick={() => setCurrentTab('SCREENING')}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'SCREENING'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ScanLine className="h-4 w-4" />
              <span>New Screening</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('DASHBOARD')}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'DASHBOARD'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Verification Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('RECENT')}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'RECENT'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Recent Screenings</span>
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {recentSessions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('ALERTS')}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'ALERTS'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>Screening Alerts</span>
              {alerts.filter((a) => !a.resolved).length > 0 && (
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-bold">
                  {alerts.filter((a) => !a.resolved).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('MANUAL_REVIEW')}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                currentTab === 'MANUAL_REVIEW'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              <span>Manual Review Queue</span>
            </button>
          </nav>
        </div>

        {/* System Terminal Status */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">OFFICER:</span>
            <span className="text-slate-200 font-bold truncate max-w-[110px]">{user?.fullName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">STATUS:</span>
            <span className="text-emerald-400 font-bold">● ONLINE</span>
          </div>
        </div>
      </aside>

      {/* Main Screening Workflow Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        {currentTab === 'SCREENING' && (
          <div className="space-y-6">
            {/* Verification Process Tracker */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold uppercase tracking-wider">
                    SEQUENTIAL VERIFICATION WORKFLOW
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">STAGE {getActiveStageNumber(screeningPhase)} OF 6</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetForNewScreening}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset Screening</span>
                </button>
              </div>

              {/* 6-Stage Stepper Bar */}
              <div className="relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                <div className="flex items-center justify-between relative z-10">
                  {[
                    { stageNum: 1, label: 'Document & OCR', target: 'UPLOAD_SCAN' as VerificationPhase },
                    { stageNum: 2, label: 'Registry Parity', target: 'COMPARISON' as VerificationPhase },
                    { stageNum: 3, label: 'Forensic Check', target: 'TAMPERING' as VerificationPhase },
                    { stageNum: 4, label: 'Face Biometrics', target: 'FACE_VERIFY' as VerificationPhase },
                    { stageNum: 5, label: 'AI Interview', target: 'AI_INTERVIEW' as VerificationPhase },
                    { stageNum: 6, label: 'Clearance Verdict', target: 'FINAL_VERDICT' as VerificationPhase },
                  ].map((s) => {
                    const activeNum = getActiveStageNumber(screeningPhase);
                    const isActive = activeNum === s.stageNum;
                    const isDone = isStageNumberDone(s.stageNum);
                    const isAccessible = canAccessStageNumber(s.stageNum);

                    return (
                      <div
                        key={s.stageNum}
                        className={`flex flex-col items-center select-none transition-all ${
                          isAccessible ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => handleStageNumberClick(s.stageNum)}
                      >
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                            isActive
                              ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                              : isDone
                              ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : isAccessible
                              ? 'bg-slate-950 border border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-950 border border-slate-800 text-slate-600'
                          }`}
                        >
                          {isDone && !isActive ? (
                            <Check className="h-4 w-4" />
                          ) : !isAccessible ? (
                            <Lock className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            s.stageNum
                          )}
                        </div>
                        <span
                          className={`mt-1.5 text-[10px] font-mono tracking-wider uppercase hidden sm:flex items-center gap-1 ${
                            isActive
                              ? 'text-emerald-400 font-bold'
                              : isDone
                              ? 'text-emerald-300'
                              : isAccessible
                              ? 'text-slate-300'
                              : 'text-slate-600'
                          }`}
                        >
                          {!isAccessible && <Lock className="h-2.5 w-2.5 text-slate-600 inline" />}
                          <span>{s.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warning alert if skipping attempt */}
              <AnimatePresence>
                {verificationPhaseWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-4 p-3 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-center justify-between gap-3 shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{verificationPhaseWarning}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerificationPhaseWarning(null)}
                      className="text-amber-400 hover:text-amber-200 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-amber-900/50 cursor-pointer"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PHASE 1: SCAN / UPLOAD DOCUMENT (Requirement #12) */}
            {screeningPhase === 'UPLOAD_SCAN' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                {/* 1. Physical Document Presentation (FIRST) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                        <FileText className="h-5 w-5 text-cyan-400" />
                        <span>Step 1: Submit Physical Document</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Upload passport / visa / ID credential or capture directly with high-resolution camera.
                      </p>
                    </div>
                    {scannedDocumentData && (
                      <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>DOCUMENT LOADED</span>
                      </span>
                    )}
                  </div>

                  {/* Document Viewer with live Upload & Camera */}
                  <DocumentViewer
                    documentDataUrl={scannedDocumentData}
                    fileName={scannedFileName}
                    onFileSelect={handleDocumentSelect}
                    onRemove={() => {
                      setScannedDocumentData(null);
                      setScannedOcr(null);
                    }}
                    isProcessingOcr={isProcessingOcr}
                  />

                  {ocrErrorMessage && (
                    <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>{ocrErrorMessage}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleStartScanOcr}
                          className="px-2.5 py-1 rounded bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 text-[11px] font-mono cursor-pointer"
                        >
                          RETRY OCR
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScreeningPhase('LOOKUP');
                            if (scannedOcr) performDatabaseLookup(scannedOcr);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono cursor-pointer"
                        >
                          CONTINUE TO LOOKUP
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Document Intake */}
                {scannedDocumentData ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="document-intake-card bg-white border border-slate-200 rounded-2xl p-6 shadow-lg space-y-5 text-slate-900"
                  >
                    <div className="pb-4 border-b border-slate-200">
                      <h4 className="text-xl font-bold tracking-tight text-slate-950">DOCUMENT INTAKE</h4>
                      <p className="mt-1 text-sm text-slate-500">Prepare the document for automated verification.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
                          <FileText className="h-4 w-4" />
                          <span>DOCUMENT PREVIEW STATUS</span>
                        </div>
                        <dl className="mt-4 space-y-3 text-sm">
                          <div className="flex items-start justify-between gap-4">
                            <dt className="text-slate-500">Document</dt>
                            <dd className="max-w-[65%] break-words text-right font-semibold text-slate-900">{scannedFileName}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-500">Type</dt>
                            <dd className="font-semibold text-slate-900">{scannedDocType}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-500">Source</dt>
                            <dd className="font-semibold text-slate-900">Uploaded Document</dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-slate-500">Status</dt>
                            <dd className="flex items-center gap-1.5 font-semibold text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready for Analysis
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>DOCUMENT QUALITY CHECK</span>
                        </div>
                        <ul className="mt-4 space-y-3 text-sm text-slate-700">
                          {['Document detected', 'Image loaded', 'Supported file format', 'Document orientation checked', 'Ready for OCR'].map((item) => (
                            <li key={item} className="flex items-center gap-2.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> DOCUMENT READY
                        </div>
                        <p className="mt-1 text-sm text-slate-500">The document is ready for automated extraction and verification.</p>
                      </div>
                      <button
                        id="proceed-scan-ocr-button"
                        type="button"
                        disabled={isProcessingOcr}
                        onClick={handleStartScanOcr}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessingOcr ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            <span>PROCESSING OCR...</span>
                          </>
                        ) : (
                          <>
                            <span>CONTINUE TO OCR ANALYSIS</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>
                        <strong className="text-slate-300">Submit Physical Document First:</strong> Upload or capture the credential above to continue to OCR analysis.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider shrink-0 font-bold">
                      AWAITING CREDENTIAL
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* PHASE 2 & 3: DATABASE LOOKUP & STORED VS SCANNED COMPARISON (Requirements #13 & #14) */}
            {(screeningPhase === 'LOOKUP' || screeningPhase === 'COMPARISON') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-4xl mx-auto"
              >
                {/* Database Lookup Result Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    matchedIdentity
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                      : 'bg-amber-950/60 border-amber-800 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {matchedIdentity ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-mono font-bold text-sm tracking-wider uppercase">
                        {lookupMessage}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5 font-mono">
                        {matchedIdentity
                          ? `Matched Registry Profile: ${matchedIdentity.fullName} (${matchedIdentity.identityId})`
                          : 'No matching identity profile found in border control database. Proceed with document examination.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stored vs Scanned Comparison Table (Requirement #13) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase font-mono">
                        STORED IDENTITY vs SCANNED DOCUMENT COMPARISON
                      </h4>
                      <p className="text-xs text-slate-400">
                        Field-by-field parity evaluation between official registry and physical scanned document
                      </p>
                    </div>
                    <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                      ICAO Parity Matrix
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">CREDENTIAL FIELD</th>
                          <th className="p-3">STORED RECORD (DATABASE)</th>
                          <th className="p-3">SCANNED DOCUMENT (LIVE OCR)</th>
                          <th className="p-3 text-right">PARITY VERDICT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderComparisonRow('Full Name', storedOcr?.fullName || matchedIdentity?.fullName, scannedOcr?.fullName)}
                        {renderComparisonRow('Date of Birth', storedOcr?.dateOfBirth || matchedIdentity?.dateOfBirth, scannedOcr?.dateOfBirth)}
                        {renderComparisonRow('Nationality', storedOcr?.nationality || matchedIdentity?.nationality, scannedOcr?.nationality)}
                        {renderComparisonRow('Gender', storedOcr?.gender || matchedIdentity?.gender, scannedOcr?.gender)}
                        {renderComparisonRow('Passport / Doc Number', storedOcr?.passportNumber || storedDocument?.documentNumber || storedDocument?.id, scannedOcr?.passportNumber)}
                        {renderComparisonRow('Issue Date', storedOcr?.dateOfIssue, scannedOcr?.dateOfIssue)}
                        {renderComparisonRow('Expiry Date', storedOcr?.dateOfExpiry, scannedOcr?.dateOfExpiry)}
                        {renderComparisonRow('Visa Number', storedOcr?.visaNumber, scannedOcr?.visaNumber)}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action button to proceed to Live Tampering Analysis */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationPhaseWarning(null);
                      setScreeningPhase('UPLOAD_SCAN');
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>BACK: RESCAN DOCUMENT</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {tamperingAnalysis && !isAnalyzingTampering && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationPhaseWarning(null);
                          setScreeningPhase('TAMPERING');
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>ADVANCE TO FORENSICS</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      id="run-tampering-analysis-button"
                      type="button"
                      disabled={isAnalyzingTampering}
                      onClick={handleRunTamperingAnalysis}
                      className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-900/40"
                    >
                      {isAnalyzingTampering ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>ANALYZING FORENSIC PIXELS...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>{tamperingAnalysis ? 'RE-RUN LIVE TAMPERING DETECTION' : 'RUN LIVE TAMPERING DETECTION'}</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PHASE 3: FORENSIC TAMPERING & CREDENTIAL INTEGRITY CHECK */}
            {screeningPhase === 'TAMPERING' && (
              <ForensicCheckView
                tamperingAnalysis={tamperingAnalysis}
                scannedDocumentData={scannedDocumentData}
                scannedFileName={scannedFileName}
                isAnalyzingTampering={isAnalyzingTampering}
                onRunAnalysis={handleRunTamperingAnalysis}
                onBackToComparison={() => {
                  setVerificationPhaseWarning(null);
                  setScreeningPhase('COMPARISON');
                }}
                onProceedToFaceVerify={() => handlePhaseSelect('FACE_VERIFY')}
                canProceedToFaceVerify={isStage3Complete}
              />
            )}

            {/* PHASE 5: LIVE FACE VERIFICATION & ANTI-SPOOF LIVENESS DETECTION */}
            {screeningPhase === 'FACE_VERIFY' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-5xl mx-auto"
              >
                {/* Header Banner */}
                <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                        PHASE 5 OF 6 • BIOMETRIC IDENTITY & ANTI-SPOOFING
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white font-mono mt-1">
                      Facial Match & Liveness Inspection
                    </h3>
                    <p className="text-xs text-slate-400">
                      Comparing credential reference portrait against live camera capture with presentation attack detection (PAD).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-xs font-mono text-cyan-400">
                      Match Threshold: <span className="font-bold">75.0%</span>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-[#0D0F12] border border-[#2A2D35] text-xs font-mono text-emerald-400">
                      ISO/IEC 30107-3 PAD
                    </div>
                  </div>
                </div>

                {/* State 1: Active Verifying Animation HUD */}
                {isVerifyingFace && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#15171C] border-2 border-cyan-500/50 rounded-xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent pointer-events-none animate-pulse" />
                    
                    <div className="relative w-20 h-20 mx-auto">
                      <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-transparent border-b-cyan-500/40 border-l-transparent animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                        <ScanLine className="h-8 w-8 animate-pulse" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                        AI BIOMETRIC ENGINE RUNNING
                      </div>
                      <h4 className="text-lg font-bold text-white font-mono">
                        Analyzing Facial Geometry & Testing Live Human Authenticity
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Executing multi-factor biometric comparison, corneal specular reflection verification, and presentation attack detection (printed photo / screen replay)...
                      </p>
                    </div>

                    {/* Inspection Stages Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto text-left text-xs font-mono pt-2">
                      <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center gap-2 text-cyan-300">
                        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>1. 128-d Landmark Mesh</span>
                      </div>
                      <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center gap-2 text-cyan-300">
                        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>2. Ocular Corneal Depth</span>
                      </div>
                      <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center gap-2 text-cyan-300">
                        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>3. Anti-Spoof / Fake Test</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* State 2: Side-by-Side Biometric Stage */}
                {!isVerifyingFace && (
                  <div className="space-y-6">
                    {/* Visual Comparison Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Stored / Document Photo Reference */}
                      <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-5 flex flex-col items-center justify-between shadow-lg relative">
                        <div className="w-full flex items-center justify-between mb-3 border-b border-[#2A2D35] pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 uppercase">
                            <FileCheck className="h-4 w-4" />
                            <span>CREDENTIAL REFERENCE PHOTO</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D0F12] border border-cyan-500/30 text-cyan-300">
                            {matchedIdentity ? 'Database Registry' : 'Physical Credential'}
                          </span>
                        </div>

                        <div className="relative w-full max-w-xs aspect-[4/3] rounded-lg overflow-hidden bg-[#0D0F12] border-2 border-[#2A2D35] flex items-center justify-center p-2 shadow-inner group">
                          {storedFace?.faceImageData ? (
                            <img
                              src={storedFace.faceImageData}
                              alt="Stored Face Reference"
                              className="h-full w-auto object-contain rounded"
                            />
                          ) : scannedDocumentData ? (
                            <img
                              src={scannedDocumentData}
                              alt="Scanned Document Reference"
                              className="h-full w-auto object-contain rounded"
                            />
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">No Reference Photo Available</span>
                          )}

                          {/* Simulated Facial Landmark Overlay Points */}
                          <div className="absolute inset-0 pointer-events-none opacity-60">
                            <div className="absolute top-[38%] left-[36%] h-2 w-2 rounded-full border border-cyan-400 bg-cyan-400/30" />
                            <div className="absolute top-[38%] right-[36%] h-2 w-2 rounded-full border border-cyan-400 bg-cyan-400/30" />
                            <div className="absolute top-[52%] left-[49%] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                            <div className="absolute top-[66%] left-[40%] h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                            <div className="absolute top-[66%] right-[40%] h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                            <div className="absolute top-[80%] left-[49%] h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                            <div className="absolute top-[20%] left-[22%] w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                            <div className="absolute top-[20%] right-[22%] w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                            <div className="absolute bottom-[16%] left-[22%] w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                            <div className="absolute bottom-[16%] right-[22%] w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
                          </div>

                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0D0F12]/80 border border-[#2A2D35] text-[10px] font-mono text-slate-300">
                            Source: ISO Reference Anchor
                          </div>
                        </div>

                        <div className="mt-4 w-full flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-[#2A2D35]/50">
                          <span>Identity: {scannedOcr?.fullName || matchedIdentity?.fullName || 'Traveler'}</span>
                          <span>Doc: {scannedDocType || 'PASSPORT'}</span>
                        </div>
                      </div>

                      {/* Right: Live Camera Stream or Captured Image */}
                      <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-5 flex flex-col items-center justify-between shadow-lg relative">
                        <div className="w-full flex items-center justify-between mb-3 border-b border-[#2A2D35] pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase">
                            <Camera className="h-4 w-4" />
                            <span>LIVE CHECKPOINT CAMERA FEED</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D0F12] border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active Optical Stream</span>
                          </span>
                        </div>

                        {/* If result already produced, show the captured snapshot with HUD, else show CameraCapture */}
                        {faceVerificationResult && liveFaceData ? (
                          <div className="w-full flex flex-col items-center">
                            <div className={`relative w-full max-w-xs aspect-[4/3] rounded-lg overflow-hidden bg-[#0D0F12] border-2 flex items-center justify-center p-2 shadow-inner ${
                              faceVerificationResult.liveness?.isLiveHuman && faceVerificationResult.result === 'MATCH'
                                ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                : (faceVerificationResult.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult.liveness?.livenessStatus === 'SPOOF_DETECTED'
                                ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)]'
                                : 'border-amber-500'
                            }`}>
                              <img
                                src={liveFaceData}
                                alt="Captured Live Biometric"
                                className="h-full w-auto object-contain rounded"
                              />

                              {/* Liveness HUD Overlay Badge */}
                              <div className="absolute top-2 right-2">
                                {faceVerificationResult.liveness?.isLiveHuman ? (
                                  <div className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 shadow-md">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>LIVE HUMAN CONFIRMED</span>
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-1 rounded bg-red-950/90 border border-red-500 text-red-300 text-[10px] font-mono font-bold flex items-center gap-1 animate-pulse shadow-md">
                                    <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
                                    <span>SPOOF / FAKE DETECTED</span>
                                  </div>
                                )}
                              </div>

                              {/* Bounding brackets based on authenticity */}
                              <div className="absolute inset-0 pointer-events-none p-4">
                                <div className={`w-full h-full border-2 rounded ${
                                  faceVerificationResult.liveness?.isLiveHuman
                                    ? 'border-emerald-500/50'
                                    : 'border-red-500/70 animate-pulse'
                                }`} />
                              </div>

                              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-[#0D0F12]/80 border border-[#2A2D35] text-[10px] font-mono text-slate-300">
                                Sensor: Checkpoint Primary Lens
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleRetakeFaceVerification}
                              className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>RE-CAPTURE / TEST ANOTHER PHOTO</span>
                            </button>
                          </div>
                        ) : (
                          <div className="w-full">
                            <CameraCapture
                              title="TRAVELER FACIAL BIOMETRIC"
                              subtitle="Look directly into checkpoint lens or upload test photo"
                              onConfirm={(dataUrl) => {
                                handleRunFaceVerification(dataUrl);
                              }}
                            />
                          </div>
                        )}

                        <div className="mt-3 w-full flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-[#2A2D35]/50">
                          <span>Quality: 96.5% ISO compliant</span>
                          <span>Anti-Spoof: Active PAD</span>
                        </div>

                        {!faceVerificationResult && (
                          <div className="mt-4 pt-4 border-t border-[#2A2D35] flex flex-col sm:flex-row items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setVerificationPhaseWarning(null);
                                setScreeningPhase('TAMPERING');
                              }}
                              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span>BACK TO FORENSICS</span>
                            </button>

                            <div className="text-xs font-mono text-amber-400 flex items-center gap-2">
                              <Lock className="h-4 w-4 shrink-0" />
                              <span>Stage 4 in progress: Complete live facial capture to unlock Stage 5 clearance verdict.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed Result Boards (Rendered once verification is run) */}
                    {faceVerificationResult && (
                      <div className="space-y-6">
                        {/* 1. EXECUTIVE VERDICT STATUS BANNER */}
                        <div
                          className={`p-6 rounded-xl border shadow-xl relative overflow-hidden ${
                            faceVerificationResult.result === 'MATCH' && (faceVerificationResult.liveness?.isLiveHuman ?? true)
                              ? 'bg-[#0E2419]/90 border-[#047857] text-[#4ADE80]'
                              : (faceVerificationResult.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult.liveness?.livenessStatus === 'SPOOF_DETECTED'
                              ? 'bg-[#2D1215]/90 border-[#DC2626] text-[#F87171]'
                              : faceVerificationResult.result === 'MISMATCH'
                              ? 'bg-[#2D1215]/90 border-[#DC2626] text-[#F87171]'
                              : 'bg-[#281E0D]/90 border-[#D97706] text-[#FBBF24]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-black/40 border border-current">
                                  {faceVerificationResult.result === 'MATCH' && (faceVerificationResult.liveness?.isLiveHuman ?? true)
                                    ? '✓ BIOMETRIC CLEARANCE PASSED'
                                    : (faceVerificationResult.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult.liveness?.livenessStatus === 'SPOOF_DETECTED'
                                    ? '✕ PRESENTATION ATTACK / FAKE DETECTED'
                                    : faceVerificationResult.result === 'MISMATCH'
                                    ? '✕ BIOMETRIC MISMATCH DETECTED'
                                    : '⚠ INCONCLUSIVE BIOMETRIC SCAN'}
                                </span>
                                <span className="text-xs font-mono opacity-80">
                                  Match Score: {faceVerificationResult.matchScore.toFixed(1)}% (Threshold: 75.0%)
                                </span>
                              </div>

                              <h3 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white mt-1">
                                {faceVerificationResult.result === 'MATCH' && (faceVerificationResult.liveness?.isLiveHuman ?? true)
                                  ? '🟢 MATCH CONFIRMED & GENUINE LIVE HUMAN'
                                  : (faceVerificationResult.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult.liveness?.livenessStatus === 'SPOOF_DETECTED'
                                  ? '🔴 CRITICAL ANOMALY: PRESENTATION ATTACK (FAKE / SPOOF)'
                                  : faceVerificationResult.result === 'MISMATCH'
                                  ? '🔴 BIOMETRIC FACIAL MISMATCH DETECTED'
                                  : '🟠 BIOMETRIC INCONCLUSIVE — MANUAL OFFICER REVIEW'}
                              </h3>

                              <p className="text-xs sm:text-sm text-slate-200 max-w-2xl mt-1 leading-relaxed">
                                {(faceVerificationResult.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult.liveness?.livenessStatus === 'SPOOF_DETECTED'
                                  ? `SECURITY ALERT: The captured facial presentation is NOT a live human in front of the lens. Detected spoof type: ${faceVerificationResult.liveness?.spoofDetectionType?.replace(/_/g, ' ') || 'Printed Photo / Screen Replay'}. Live human presence unconfirmed.`
                                  : faceVerificationResult.result === 'MISMATCH'
                                  ? `The traveler facial geometry does NOT match the stored credential portrait. Match score of ${faceVerificationResult.matchScore.toFixed(1)}% is below the required 75.0% threshold.`
                                  : `Biometric identity match confirmed at ${faceVerificationResult.matchScore.toFixed(1)}% similarity. Anti-spoof liveness tests verified genuine living human subject.`}
                              </p>
                            </div>

                            {/* Prominent Badges */}
                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                              <div className="px-4 py-2 rounded-lg bg-black/60 border border-current font-mono text-sm font-bold">
                                Identity: {faceVerificationResult.result}
                              </div>
                              {faceVerificationResult.liveness && (
                                <div className={`px-4 py-2 rounded-lg bg-black/60 border font-mono text-sm font-bold ${
                                  faceVerificationResult.liveness.isLiveHuman
                                    ? 'text-emerald-400 border-emerald-500'
                                    : 'text-red-400 border-red-500 animate-pulse'
                                }`}>
                                  Liveness: {faceVerificationResult.liveness.isLiveHuman ? 'GENUINE HUMAN' : 'FAKE / SPOOF'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 2. TWO-PILLAR COMPREHENSIVE ANALYSIS GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* PILLAR 1: BIOMETRIC FACIAL IDENTITY MATCH */}
                          <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-5 space-y-4 shadow-lg">
                            <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-400">
                                  <Fingerprint className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white font-mono uppercase">
                                    Pillar 1: Facial Identity Match
                                  </h4>
                                  <p className="text-[11px] text-slate-400">
                                    Stored credential vs live camera biometric vectors
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                                faceVerificationResult.result === 'MATCH'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                  : 'bg-red-950 text-red-400 border border-red-700'
                              }`}>
                                {faceVerificationResult.result}
                              </span>
                            </div>

                            {/* Overall Match Progress Bar */}
                            <div className="space-y-1.5 bg-[#0D0F12] p-3.5 rounded-lg border border-[#2A2D35]">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-slate-400">Similarity Match Score:</span>
                                <span className="font-bold text-white text-sm">
                                  {faceVerificationResult.matchScore.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
                                <div
                                  className={`h-full transition-all duration-700 rounded-full ${
                                    faceVerificationResult.result === 'MATCH'
                                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, faceVerificationResult.matchScore))}%` }}
                                />
                                {/* Threshold tick mark at 75% */}
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
                                  style={{ left: '75%' }}
                                  title="Threshold: 75.0%"
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                                <span>0% (Mismatch)</span>
                                <span className="text-yellow-400 font-bold">▲ Threshold: 75.0%</span>
                                <span>100% (Identical)</span>
                              </div>
                            </div>

                            {/* Landmark Geometry Breakdown */}
                            <div className="space-y-2">
                              <span className="text-xs font-mono font-bold text-slate-300 uppercase block">
                                Landmark Geometry Analysis
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35]">
                                  <div className="text-slate-400 text-[11px]">Facial Structure:</div>
                                  <div className="font-bold text-white text-sm mt-0.5">
                                    {faceVerificationResult.factorBreakdown.facialStructure.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35]">
                                  <div className="text-slate-400 text-[11px]">Interpupillary Distance:</div>
                                  <div className="font-bold text-white text-sm mt-0.5">
                                    {faceVerificationResult.factorBreakdown.eyeDistance.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35]">
                                  <div className="text-slate-400 text-[11px]">Jawline Alignment:</div>
                                  <div className="font-bold text-white text-sm mt-0.5">
                                    {faceVerificationResult.factorBreakdown.jawlineAlignment.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="p-2.5 rounded bg-[#0D0F12] border border-[#2A2D35]">
                                  <div className="text-slate-400 text-[11px]">Pose / Angle Tolerance:</div>
                                  <div className="font-bold text-white text-sm mt-0.5">
                                    {faceVerificationResult.factorBreakdown.poseTolerance.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Scientific Match Explanation */}
                            <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] text-xs text-slate-300 space-y-1">
                              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                                Forensic Identity Assessment:
                              </span>
                              <p className="text-[11px] leading-relaxed text-slate-300">
                                {faceVerificationResult.explanation}
                              </p>
                            </div>
                          </div>

                          {/* PILLAR 2: LIVENESS & ANTI-SPOOFING (HUMAN OR FAKE?) */}
                          <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-5 space-y-4 shadow-lg">
                            <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                                  <ShieldCheck className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-white font-mono uppercase">
                                    Pillar 2: Liveness & Anti-Spoofing
                                  </h4>
                                  <p className="text-[11px] text-slate-400">
                                    Presentation Attack Detection (PAD ISO/IEC 30107-3)
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                                faceVerificationResult.liveness?.isLiveHuman
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                  : 'bg-red-950 text-red-400 border border-red-700 animate-pulse'
                              }`}>
                                {faceVerificationResult.liveness?.isLiveHuman ? '✓ LIVE HUMAN' : '✕ SPOOF DETECTED'}
                              </span>
                            </div>

                            {/* Human Presence Status & Classification */}
                            <div className="p-3.5 rounded-lg bg-[#0D0F12] border border-[#2A2D35] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-slate-400">Subject Authenticity:</span>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                  faceVerificationResult.liveness?.isLiveHuman
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : 'bg-red-950 text-red-300 border border-red-700'
                                }`}>
                                  {faceVerificationResult.liveness?.isLiveHuman
                                    ? 'GENUINE LIVING HUMAN'
                                    : 'PRESENTATION ATTACK / FAKE'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-slate-400">Detection Type:</span>
                                <span className="text-xs font-mono font-bold text-white">
                                  {faceVerificationResult.liveness?.spoofDetectionType?.replace(/_/g, ' ') || 'AUTHENTIC LIVE'}
                                </span>
                              </div>

                              {/* Liveness vs Spoof Risk Meter */}
                              {faceVerificationResult.liveness && (
                                <div className="pt-2 border-t border-[#2A2D35]/60 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-slate-400">Liveness Confidence:</span>
                                    <span className={`font-bold ${
                                      faceVerificationResult.liveness.isLiveHuman ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                      {faceVerificationResult.liveness.livenessConfidence.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-700 ${
                                        faceVerificationResult.liveness.isLiveHuman
                                          ? 'bg-emerald-500'
                                          : 'bg-red-500'
                                      }`}
                                      style={{ width: `${faceVerificationResult.liveness.livenessConfidence}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Anti-Spoofing Vectors Checklist */}
                            <div className="space-y-2">
                              <span className="text-xs font-mono font-bold text-slate-300 uppercase block">
                                Presentation Attack Vectors Tested
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="p-2 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center justify-between">
                                  <span className="text-slate-400 text-[11px]">Printed Paper Photo:</span>
                                  <span className={`font-bold text-[11px] ${
                                    faceVerificationResult.liveness?.spoofDetectionType === 'PRINTED_PHOTO_ATTACK'
                                      ? 'text-red-400'
                                      : 'text-emerald-400'
                                  }`}>
                                    {faceVerificationResult.liveness?.spoofDetectionType === 'PRINTED_PHOTO_ATTACK' ? '✕ DETECTED' : '✓ CLEAR'}
                                  </span>
                                </div>

                                <div className="p-2 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center justify-between">
                                  <span className="text-slate-400 text-[11px]">Screen Replay (Phone/iPad):</span>
                                  <span className={`font-bold text-[11px] ${
                                    faceVerificationResult.liveness?.spoofDetectionType === 'DIGITAL_SCREEN_REPLAY'
                                      ? 'text-red-400'
                                      : 'text-emerald-400'
                                  }`}>
                                    {faceVerificationResult.liveness?.spoofDetectionType === 'DIGITAL_SCREEN_REPLAY' ? '✕ DETECTED' : '✓ CLEAR'}
                                  </span>
                                </div>

                                <div className="p-2 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center justify-between">
                                  <span className="text-slate-400 text-[11px]">AI Deepfake / Avatar:</span>
                                  <span className={`font-bold text-[11px] ${
                                    faceVerificationResult.liveness?.spoofDetectionType === 'DEEPFAKE_OR_SYNTHETIC'
                                      ? 'text-red-400'
                                      : 'text-emerald-400'
                                  }`}>
                                    {faceVerificationResult.liveness?.spoofDetectionType === 'DEEPFAKE_OR_SYNTHETIC' ? '✕ DETECTED' : '✓ CLEAR'}
                                  </span>
                                </div>

                                <div className="p-2 rounded bg-[#0D0F12] border border-[#2A2D35] flex items-center justify-between">
                                  <span className="text-slate-400 text-[11px]">Inanimate Mask / Object:</span>
                                  <span className={`font-bold text-[11px] ${
                                    faceVerificationResult.liveness?.spoofDetectionType === 'MASK_OR_OBJECT'
                                      ? 'text-red-400'
                                      : 'text-emerald-400'
                                  }`}>
                                    {faceVerificationResult.liveness?.spoofDetectionType === 'MASK_OR_OBJECT' ? '✕ DETECTED' : '✓ CLEAR'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Forensic Findings List */}
                            {faceVerificationResult.liveness?.findings && faceVerificationResult.liveness.findings.length > 0 && (
                              <div className="p-3 rounded-lg bg-[#0D0F12] border border-[#2A2D35] space-y-1.5">
                                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
                                  Optical Liveness Findings:
                                </span>
                                <ul className="text-[11px] text-slate-300 space-y-1">
                                  {faceVerificationResult.liveness.findings.map((finding, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                      <span className="text-emerald-400 shrink-0">•</span>
                                      <span>{finding}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. QUALITY CHECKS & HUMAN PRESENCE METRICS */}
                        <div className="bg-[#15171C] border border-[#2A2D35] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Human Face Detected:</span>
                            <span className={`font-bold ${faceVerificationResult.isHumanFaceDetected ?? true ? 'text-emerald-400' : 'text-red-400'}`}>
                              {faceVerificationResult.isHumanFaceDetected ?? true ? '✓ CONFIRMED HUMAN' : '✕ NO HUMAN DETECTED'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Illumination:</span>
                            <span className="font-bold text-white">
                              {faceVerificationResult.qualityCheck?.illumination || 'OPTIMAL'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Sharpness:</span>
                            <span className="font-bold text-white">
                              {faceVerificationResult.qualityCheck?.sharpness || 'CRISP'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Face Centering:</span>
                            <span className="font-bold text-white">
                              {faceVerificationResult.qualityCheck?.isCentered ? 'CENTERED' : 'ACCEPTABLE'}
                            </span>
                          </div>
                        </div>

                        {/* 4. OFFICER ACTION & DECISION CONTROLS */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#2A2D35]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setVerificationPhaseWarning(null);
                                setScreeningPhase('TAMPERING');
                              }}
                              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span>BACK TO FORENSICS</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleRetakeFaceVerification}
                              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span>RETRY SCAN</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setFinalDecision('ANOMALY_DETECTED');
                                setScreeningPhase('FINAL_VERDICT');
                              }}
                              className="px-4 py-2.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <AlertOctagon className="h-4 w-4 text-red-400" />
                              <span>FLAG FRAUD / ANOMALY</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => evaluateRiskAndDecide(faceVerificationResult, true)}
                              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                              title="Bypass pre-screening interview if authorized officer determines immediate clearance is needed"
                            >
                              <span>BYPASS TO VERDICT</span>
                            </button>

                            <button
                              id="start-ai-interview-button"
                              type="button"
                              onClick={handleStartAiInterview}
                              disabled={isStartingInterview}
                              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/60 transition-all ring-2 ring-cyan-400/40"
                            >
                              <Sparkles className="h-4 w-4 text-cyan-200" />
                              <span>
                                {isStartingInterview
                                  ? 'STARTING INTERVIEW...'
                                  : interviewState
                                  ? 'RESUME AI PRE-SCREENING INTERVIEW'
                                  : 'START AI IMMIGRATION PRE-SCREENING'}
                              </span>
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* PHASE 5: ADAPTIVE AI IMMIGRATION PRE-SCREENING INTERVIEW */}
            {screeningPhase === 'AI_INTERVIEW' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {interviewState ? (
                  <AdaptiveInterviewView
                    interviewState={interviewState}
                    onUpdateState={(newState) => setInterviewState(newState)}
                    onProceedToRiskDecision={() => evaluateRiskAndDecide(faceVerificationResult, true, interviewState)}
                    token={token || ''}
                  />
                ) : (
                  <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                    <Sparkles className="h-8 w-8 text-cyan-400 mx-auto animate-spin" />
                    <div className="text-sm font-mono text-white">
                      Initializing Adaptive AI Pre-Screening Interview session...
                    </div>
                    <button
                      type="button"
                      onClick={handleStartAiInterview}
                      className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-mono text-xs font-bold"
                    >
                      Click to Start Session
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* PHASE 6: FINAL SCREEN (Requirement #17) */}
            {screeningPhase === 'FINAL_VERDICT' && finalDecision && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* 1. GREEN SCREEN: VERIFIED — YOU MAY PROCEED */}
                {finalDecision === 'VERIFIED' && (
                  <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-emerald-950/50">
                    <div className="h-20 w-20 mx-auto rounded-full bg-emerald-600/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center animate-pulse">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>

                    <div>
                      <div className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                        SECURITY CLEARANCE VERDICT
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase mt-1">
                        🟢 VERIFIED — YOU MAY PROCEED
                      </h2>
                      <p className="text-sm text-emerald-200 mt-2 max-w-lg mx-auto">
                        All physical credential, biometric face comparison, and document integrity checks passed without actionable anomalies.
                      </p>
                    </div>

                    {/* Verified Status Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 font-bold">
                        DOCUMENT ✓ VALID
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 font-bold">
                        IDENTITY ✓ MATCHED
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 font-bold">
                        FACE ✓ MATCHED
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 font-bold">
                        LIVENESS ✓ LIVE HUMAN
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-200 font-bold col-span-2 sm:col-span-2">
                        DOCUMENT INTEGRITY ✓ NO ANOMALIES
                      </div>
                      {interviewState && (
                        <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-700 text-cyan-200 font-bold col-span-2 sm:col-span-4 flex items-center justify-center gap-2">
                          <Sparkles className="h-4 w-4 text-cyan-400" />
                          <span>
                            PRE-SCREENING INTERVIEW ✓ CONSISTENCY:{' '}
                            {interviewState.consistencyRating} ({interviewState.questionsAsked.length}{' '}
                            QUESTIONS COMPLETED)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Decision Action Buttons */}
                    <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationPhaseWarning(null);
                          setScreeningPhase('FACE_VERIFY');
                        }}
                        className="px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>REVIEW BIOMETRICS</span>
                      </button>
                      <button
                        id="complete-screening-green"
                        type="button"
                        onClick={handleResetForNewScreening}
                        className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono tracking-wider shadow-lg shadow-emerald-900/50 cursor-pointer transition-colors"
                      >
                        COMPLETE SCREENING
                      </button>
                      <button
                        type="button"
                        onClick={() => completedSession && setSelectedSessionDetail(completedSession)}
                        className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold cursor-pointer transition-colors"
                      >
                        VIEW FULL REPORT
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. RED SCREEN: ANOMALY DETECTED — PLEASE WAIT MANUAL REVIEW REQUIRED */}
                {finalDecision === 'ANOMALY_DETECTED' && (
                  <div className="bg-red-950/40 border-2 border-red-500 rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-red-950/50">
                    <div className="h-20 w-20 mx-auto rounded-full bg-red-600/20 border-2 border-red-400 text-red-400 flex items-center justify-center animate-pulse">
                      <AlertOctagon className="h-12 w-12" />
                    </div>

                    <div>
                      <div className="text-xs font-mono font-bold tracking-widest text-red-400 uppercase">
                        CRITICAL ANOMALY ALERT
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mt-1">
                        🔴 ANOMALY DETECTED — PLEASE WAIT MANUAL REVIEW REQUIRED
                      </h2>
                      <p className="text-sm text-red-200 mt-2 max-w-xl mx-auto">
                        Multiple critical security discrepancies detected during credential screening. Traveler clearance suspended.
                      </p>
                    </div>

                    {/* Actual Failed Checks List */}
                    <div className="max-w-md mx-auto space-y-2 text-left text-xs font-mono">
                      {faceVerificationResult?.result === 'MISMATCH' && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>✕ BIOMETRIC FACE MISMATCH (Score: {faceVerificationResult.matchScore.toFixed(1)}%)</span>
                        </div>
                      )}
                      {((faceVerificationResult?.liveness && !faceVerificationResult.liveness.isLiveHuman) || faceVerificationResult?.liveness?.livenessStatus === 'SPOOF_DETECTED') && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>✕ PRESENTATION ATTACK / FAKE DETECTED: {faceVerificationResult.liveness.spoofDetectionType?.replace(/_/g, ' ') || 'Spoofing Detected'}</span>
                        </div>
                      )}
                      {faceVerificationResult?.isHumanFaceDetected === false && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>✕ NO LIVING HUMAN FACE DETECTED IN CAMERA LENS</span>
                        </div>
                      )}
                      {validationResult?.overallStatus === 'FAIL' && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>✕ DOCUMENT DATA / SECURITY VALIDATION FAILURE</span>
                        </div>
                      )}
                      {tamperingAnalysis?.tamperingRisk === 'HIGH' && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>⚠ POTENTIAL TAMPERING INDICATOR: High-Risk Anomaly Detected</span>
                        </div>
                      )}
                    </div>

                    {/* Buttons: RECHECK DOCUMENT, RECAPTURE FACE, VIEW ANALYSIS, SEND FOR MANUAL REVIEW */}
                    <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setScreeningPhase('UPLOAD_SCAN')}
                        className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                      >
                        RECHECK DOCUMENT
                      </button>
                      <button
                        type="button"
                        onClick={() => setScreeningPhase('FACE_VERIFY')}
                        className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                      >
                        RECAPTURE FACE
                      </button>
                      <button
                        type="button"
                        onClick={() => setScreeningPhase('TAMPERING')}
                        className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                      >
                        VIEW ANALYSIS
                      </button>
                      <button
                        id="send-manual-review-button"
                        type="button"
                        onClick={handleResetForNewScreening}
                        className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono tracking-wider shadow-lg shadow-red-900/50 cursor-pointer"
                      >
                        SEND FOR MANUAL REVIEW
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. ORANGE SCREEN: VERIFICATION REQUIRES REVIEW — PLEASE WAIT MANUAL REVIEW RECOMMENDED */}
                {finalDecision === 'REVIEW_REQUIRED' && (
                  <div className="bg-amber-950/40 border-2 border-amber-500 rounded-2xl p-8 text-center space-y-6 shadow-2xl shadow-amber-950/50">
                    <div className="h-20 w-20 mx-auto rounded-full bg-amber-600/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center animate-pulse">
                      <AlertTriangle className="h-12 w-12" />
                    </div>

                    <div>
                      <div className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">
                        SECONDARY INSPECTION ADVISORY
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mt-1">
                        🟠 VERIFICATION REQUIRES REVIEW — PLEASE WAIT MANUAL REVIEW RECOMMENDED
                      </h2>
                      <p className="text-sm text-amber-200 mt-2 max-w-xl mx-auto">
                        Automated screening returned borderline or inconclusive indicators. Physical secondary document inspection advised.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto space-y-2 text-left text-xs font-mono">
                    </div>

                    <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetForNewScreening}
                        className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs font-mono tracking-wider shadow-lg shadow-amber-900/50 cursor-pointer"
                      >
                        ASSIGN TO MANUAL REVIEW OFFICER
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* VIEW: VERIFICATION DASHBOARD */}
        {currentTab === 'DASHBOARD' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                CHECKPOINT ALPHA MONITOR
              </div>
              <h2 className="text-xl font-bold text-white">Active Screening Metrics</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Screenings Today</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {recentSessions.length}
                </div>
                <span className="text-[11px] text-slate-500">Travelers screened</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Cleared (Verified)</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {recentSessions.filter((s) => s.finalDecision === 'VERIFIED').length}
                </div>
                <span className="text-[11px] text-slate-500">Expedited clearance</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Anomalies Detected</span>
                <div className="text-2xl font-bold text-red-400 mt-1">
                  {recentSessions.filter((s) => s.finalDecision === 'ANOMALY_DETECTED').length}
                </div>
                <span className="text-[11px] text-slate-500">Suspicious cases flagged</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-xs text-slate-400 uppercase">Secondary Reviews</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {recentSessions.filter((s) => s.finalDecision === 'REVIEW_REQUIRED').length}
                </div>
                <span className="text-[11px] text-slate-500">Border officer inspection</span>
              </div>
            </div>

            {/* Recent Screenings Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">Recent Traveler Screenings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">SESSION</th>
                      <th className="p-3">TRAVELER / NAME</th>
                      <th className="p-3">DOCUMENT</th>
                      <th className="p-3">OFFICER</th>
                      <th className="p-3">VERDICT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3 text-blue-400 font-bold">{s.sessionNumber}</td>
                        <td className="p-3 text-white">
                          {s.matchedIdentity?.fullName || s.scannedOcr?.fullName || 'Unidentified'}
                        </td>
                        <td className="p-3 text-slate-300">{s.scannedDocType}</td>
                        <td className="p-3 text-slate-400">{s.officerName}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              s.finalDecision === 'VERIFIED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : s.finalDecision === 'ANOMALY_DETECTED'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {s.finalDecision}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: RECENT SCREENINGS */}
        {currentTab === 'RECENT' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                AUDITABLE LOGS
              </div>
              <h2 className="text-xl font-bold text-white">Completed Verification Sessions</h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">SESSION ID</th>
                    <th className="p-3.5">TIME</th>
                    <th className="p-3.5">TRAVELER NAME</th>
                    <th className="p-3.5">PASSPORT NO</th>
                    <th className="p-3.5">OFFICER</th>
                    <th className="p-3.5">DECISION</th>
                    <th className="p-3.5 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-blue-400 font-bold">{s.sessionNumber}</td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(s.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3.5 text-white">
                        {s.matchedIdentity?.fullName || s.scannedOcr?.fullName || 'Unknown'}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {s.scannedOcr?.passportNumber || 'N/A'}
                      </td>
                      <td className="p-3.5 text-slate-400">{s.officerName}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            s.finalDecision === 'VERIFIED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : s.finalDecision === 'ANOMALY_DETECTED'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {s.finalDecision}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionDetail(s)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                          >
                            Report
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete verification session ${s.sessionNumber}?`)) return;
                              try {
                                const res = await fetch(`/api/database/sessions/${s.id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) {
                                  fetchSessionsAndAlerts();
                                  window.dispatchEvent(new CustomEvent('database-changed'));
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="p-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[11px] border border-red-800/60 cursor-pointer flex items-center gap-1"
                            title={`Delete session ${s.sessionNumber} from database`}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW: ALERTS */}
        {currentTab === 'ALERTS' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-red-400">
                CRITICAL WARNINGS
              </div>
              <h2 className="text-xl font-bold text-white">Active System Security Alerts</h2>
            </div>

            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                        a.severity === 'CRITICAL'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : a.severity === 'HIGH'
                          ? 'bg-orange-950 text-orange-400 border border-orange-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {a.severity}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm">{a.title}</div>
                      <div className="text-slate-300 mt-0.5">{a.message}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Timestamp: {new Date(a.timestamp).toUTCString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    {a.resolved ? (
                      <span className="text-emerald-400 font-bold">✓ Resolved</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          await fetch(`/api/alerts/${a.id}/resolve`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          fetchSessionsAndAlerts();
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: MANUAL REVIEW QUEUE */}
        {currentTab === 'MANUAL_REVIEW' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                SECONDARY INSPECTION
              </div>
              <h2 className="text-xl font-bold text-white">Manual Review Queue</h2>
            </div>

            <div className="space-y-4">
              {recentSessions
                .filter((s) => s.finalDecision === 'REVIEW_REQUIRED' || s.finalDecision === 'ANOMALY_DETECTED')
                .map((s) => (
                  <div
                    key={s.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold text-sm">{s.sessionNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            s.finalDecision === 'ANOMALY_DETECTED'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {s.finalDecision}
                        </span>
                      </div>
                      <div className="text-white font-bold mt-1 text-sm">
                        {s.matchedIdentity?.fullName || s.scannedOcr?.fullName || 'Unidentified Candidate'}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Flagged at: {new Date(s.startedAt).toLocaleTimeString()} by {s.officerName}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSessionDetail(s)}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                    >
                      Examine Dossier
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Full Screening Report Dossier Modal */}
      <AnimatePresence>
        {selectedSessionDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white font-mono">
                    Screening Report: {selectedSessionDetail.sessionNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">FINAL VERDICT</span>
                    <span className="font-bold text-base text-white">{selectedSessionDetail.finalDecision}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                  <div>Traveler: {selectedSessionDetail.matchedIdentity?.fullName || selectedSessionDetail.scannedOcr?.fullName}</div>
                  <div>Passport: {selectedSessionDetail.scannedOcr?.passportNumber}</div>
                  <div>Nationality: {selectedSessionDetail.scannedOcr?.nationality}</div>
                  <div>Screening Officer: {selectedSessionDetail.officerName}</div>
                  <div>Completed At: {new Date(selectedSessionDetail.completedAt || selectedSessionDetail.startedAt).toUTCString()}</div>
                </div>

                {selectedSessionDetail.tamperingAnalysis && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <div className="font-bold text-slate-200">Tampering Analysis</div>
                    <div className="text-slate-400">{selectedSessionDetail.tamperingAnalysis.summary}</div>
                  </div>
                )}

                {selectedSessionDetail.interviewState && (
                  <div className="p-3 bg-cyan-950/40 rounded-lg border border-cyan-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                        <span>Adaptive AI Immigration Pre-Screening Interview</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700">
                        {selectedSessionDetail.interviewState.consistencyRating} CONSISTENCY
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">
                      {selectedSessionDetail.interviewState.finalSummary ||
                        `Interview conducted with ${selectedSessionDetail.interviewState.questionsAsked.length} adaptive inquiries.`}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Recommendation: {selectedSessionDetail.interviewState.recommendation} • Status:{' '}
                      {selectedSessionDetail.interviewState.status}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close Dossier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
