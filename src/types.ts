export type UserRole = 'ADMIN' | 'DATA OFFICER' | 'VERIFICATION OFFICER' | 'ANALYST' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  badgeNumber: string;
  checkpoint: string;
  createdAt: string;
  lastLogin?: string;
}

export interface IdentityProfile {
  id: string;
  identityId: string; // e.g. ID-2026-000101
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  nationality: string;
  countryOfResidence: string;
  createdAt: string;
  createdBy: string;
}

export type DocumentType = 'PASSPORT' | 'VISA' | 'NATIONAL ID' | 'DRIVING LICENSE' | 'PERMIT';

export interface DocumentRecord {
  id: string;
  identityId: string;
  docType: DocumentType;
  fileName: string;
  fileType: string;
  fileData: string; // Base64 data URL
  uploadedAt: string;
  uploadedBy: string;
}

export interface OcrResult {
  id: string;
  documentId: string;
  docType: DocumentType;
  surname: string;
  givenName: string;
  fullName: string;
  passportNumber: string;
  documentNumber?: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  placeOfBirth: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  issuingCountry: string;
  mrzLine1: string;
  mrzLine2: string;
  mrzRaw: string;
  // Visa specific
  visaNumber?: string;
  visaType?: string;
  visaIssueDate?: string;
  visaExpiryDate?: string;
  visaEntryType?: string;
  visaStayDuration?: string;
  confidence: number;
  extractedFields: Record<string, { value: string; confidence: number; isConfident: boolean }>;
  rawText?: string;
  isManualCorrection: boolean;
  correctedBy?: string;
  correctedAt?: string;
  correctionReason?: string;
}

export type ValidationStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface ValidationCheckItem {
  id: string;
  name: string;
  status: ValidationStatus;
  details: string;
}

export interface DocumentValidationResult {
  id: string;
  documentId: string;
  overallStatus: ValidationStatus;
  checks: {
    requiredFields: ValidationStatus;
    dateFormat: ValidationStatus;
    expiryDate: ValidationStatus;
    documentNumberFormat: ValidationStatus;
    nameConsistency: ValidationStatus;
    dobConsistency: ValidationStatus;
    nationalityConsistency: ValidationStatus;
    mrzConsistency: ValidationStatus;
    machineReadableConsistency: ValidationStatus;
    imageQuality: ValidationStatus;
    duplicateIdentity: ValidationStatus;
  };
  details: ValidationCheckItem[];
  validatedAt: string;
  validatedBy: string;
}

export interface FaceRecord {
  id: string;
  identityId: string;
  faceImageData: string; // Base64 data URL
  captureQuality: number; // 0-100
  detectedFacesCount: number;
  isCentered: boolean;
  capturedAt: string;
  capturedBy: string;
}

export type VerificationFinalStatus = 'VERIFIED' | 'REVIEW_REQUIRED' | 'ANOMALY_DETECTED';

export interface TamperingRegion {
  id: string;
  regionName: string;
  severity: 'GREEN' | 'ORANGE' | 'RED';
  description: string;
  confidence: number;
  coordinates?: { x: number; y: number; width: number; height: number }; // percentages
}

export interface TamperingAnalysis {
  id: string;
  sessionId: string;
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
  tamperingRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  terminology: 'No significant anomaly detected' | 'Potential tampering indicator' | 'AI-assisted anomaly detected' | 'Analysis inconclusive';
  factors: {
    photoIntegrity: string;
    textConsistency: string;
    imageConsistency: string;
    documentLayout: string;
    copyPasteArtifacts: string;
    compressionInconsistencies: string;
    mrzConsistency: string;
    metadataConsistency: string;
  };
  regions: TamperingRegion[];
  summary: string;
  performedAt: string;
}

export interface FaceLivenessResult {
  isLiveHuman: boolean;
  livenessConfidence: number; // 0-100
  livenessStatus: 'LIVE_HUMAN' | 'SPOOF_DETECTED' | 'INCONCLUSIVE';
  spoofDetectionType: 'NONE' | 'PRINTED_PHOTO_ATTACK' | 'DIGITAL_SCREEN_REPLAY' | 'DEEPFAKE_OR_SYNTHETIC' | 'MASK_OR_OBJECT';
  spoofProbability: number; // 0-100
  humanPresenceConfirmed: boolean;
  imageAuthenticity: 'AUTHENTIC_LIVE' | 'SUSPECT_FAKE' | 'INCONCLUSIVE';
  findings: string[];
}

export interface FaceVerificationResult {
  id: string;
  sessionId: string;
  result: 'MATCH' | 'MISMATCH' | 'INCONCLUSIVE';
  matchScore: number; // 0-100
  threshold: number; // e.g. 75
  factorBreakdown: {
    facialStructure: number;
    eyeDistance: number;
    jawlineAlignment: number;
    lightingVariance: number;
    poseTolerance: number;
  };
  explanation: string;
  verifiedAt: string;
  liveness?: FaceLivenessResult;
  isHumanFaceDetected?: boolean;
  qualityCheck?: {
    illumination: 'OPTIMAL' | 'POOR' | 'ACCEPTABLE';
    sharpness: 'CRISP' | 'BLURRED' | 'ACCEPTABLE';
    faceCentered: boolean;
    glassesOrOcclusion: boolean;
  };
}

export interface RiskFactor {
  factor: string;
  impactScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface RiskAssessment {
  id: string;
  sessionId: string;
  score: number; // 0-100 (0-29 LOW, 30-69 REVIEW, 70-100 HIGH)
  tier: 'LOW' | 'REVIEW' | 'HIGH';
  factors: RiskFactor[];
  calculatedAt: string;
  summary: string;
}

export interface InterviewQuestionAnswer {
  questionNumber: number;
  question: string;
  answer: string;
  timestamp: string;
  extractedInfo?: Record<string, any>;
  clarificationRequested?: boolean;
  inconsistencyDetected?: boolean;
  inconsistencyDetail?: string;
}

export interface InterviewInconsistency {
  field: string;
  issue: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  resolved: boolean;
  details: string;
}

export interface InterviewIntelligenceState {
  purpose?: string;
  relationship?: string;
  event?: string;
  destinationCity?: string;
  duration?: string;
  durationDays?: number;
  accommodation?: string;
  hostOrContact?: string;
  travelCompanions?: string;
  returnOrOnwardTravel?: string;
  organizationOrCompany?: string;
  universityOrInstitution?: string;
  employmentNature?: string;
  fundsOrFinancialSupport?: string;
}

export interface InterviewState {
  sessionId: string;
  caseId?: string;
  travelType: string;
  nationality: string;
  origin: string;
  destination: string;
  visaType: string;
  visaConditions?: string;
  declaredPurpose?: string;
  detectedPurpose?: string;
  expectedStay?: string;
  accommodation?: string;
  travelCompanions?: string;
  hostOrContact?: string;
  destinationCities: string[];
  returnOrOnwardTravel?: string;
  employmentInfo?: string;
  educationInfo?: string;
  businessInfo?: string;
  eventInfo?: string;
  questionsAsked: InterviewQuestionAnswer[];
  missingInformation: string[];
  potentialInconsistencies: InterviewInconsistency[];
  clarificationsRequested: string[];
  currentQuestion: string;
  questionCount: number;
  maxQuestions: number; // 5
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED_SUFFICIENT_INFO' | 'COMPLETED_MAX_REACHED' | 'REVIEW_REQUIRED';
  consistencyRating: 'HIGH' | 'MEDIUM' | 'POTENTIAL_MISMATCH';
  finalSummary?: string;
  recommendation: 'NO_SIGNIFICANT_INCONSISTENCIES' | 'ADDITIONAL_OFFICER_REVIEW_REQUIRED';
}

export interface VerificationSession {
  id: string;
  sessionNumber: string; // e.g. VER-2026-000452
  officerId: string;
  officerName: string;
  checkpoint: string;
  scannedDocumentData: string;
  scannedDocType: DocumentType;
  scannedOcr: OcrResult;
  matchedIdentity?: IdentityProfile;
  storedDocument?: DocumentRecord;
  storedFace?: FaceRecord;
  liveCapturedFaceData?: string;
  validationResult: DocumentValidationResult;
  tamperingAnalysis: TamperingAnalysis;
  faceVerification?: FaceVerificationResult;
  interviewState?: InterviewState;
  riskAssessment: RiskAssessment;
  finalDecision: VerificationFinalStatus;
  decisionNotes?: string;
  manualReviewAssigned?: string;
  startedAt: string;
  completedAt?: string;
}

export interface AlertRecord {
  id: string;
  sessionId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'IDENTITY_CREATION'
  | 'IDENTITY_DELETION'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DELETION'
  | 'OCR_COMPLETION'
  | 'MANUAL_OCR_CORRECTION'
  | 'RECORD_AMENDMENT'
  | 'FACE_CAPTURE'
  | 'VERIFICATION_START'
  | 'DOCUMENT_ANALYSIS'
  | 'FACE_VERIFICATION'
  | 'AI_INTERVIEW_START'
  | 'AI_INTERVIEW_ANSWER'
  | 'AI_INTERVIEW_CLARIFICATION'
  | 'AI_INTERVIEW_COMPLETE'
  | 'RISK_CALCULATION'
  | 'MANUAL_REVIEW'
  | 'VERIFICATION_COMPLETION'
  | 'SESSION_DELETION'
  | 'DATABASE_RESET'
  | 'TABLE_CLEAR'
  | 'SYSTEM_PURGE';

export interface AuditLog {
  id: string;
  timestamp: string;
  officerId: string;
  officerName: string;
  role: UserRole;
  action: AuditAction;
  details: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

export interface DatabaseStats {
  identitiesCount: number;
  documentsCount: number;
  ocrResultsCount: number;
  faceRecordsCount: number;
  sessionsCount: number;
  tamperingCount: number;
  riskCount: number;
  alertsCount: number;
  auditLogsCount: number;
  usersCount: number;
  dbFileSizeBytes: number;
  dbFileSizeFormatted: string;
  lastSaved: string;
}

export interface DashboardStats {
  totalIdentities: number;
  documentsProcessed: number;
  todaysScreenings: number;
  verifiedCount: number;
  manualReviewsCount: number;
  failedVerificationCount: number;
  potentialTamperingAlerts: number;
  faceMismatchesCount: number;
  systemStatus: 'ONLINE' | 'OFFLINE';
  checkpointName: string;
  aiServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED';
}
