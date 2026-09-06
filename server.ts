import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db, initDatabase } from './server/db.ts';
import { verifyPassword, createSession, getSession, destroySession } from './server/auth.ts';
import {
  isAiConfigured,
  performDocumentOcr,
  validateDocumentData,
  performTamperingAnalysis,
  performFaceVerification,
  calculateScreeningRisk,
  determineFinalDecision,
} from './server/ai.ts';
import { initInterviewState, processPassengerAnswerAndGenerateNext } from './server/interview.ts';
import { UserRole, OcrResult } from './src/types.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize persistent database
initDatabase();

const app = express();
const PORT = 3000;

// High payload limit for uploaded document images and live face captures
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Middleware
export interface AuthenticatedRequest extends Request {
  userSession?: {
    userId: string;
    username: string;
    fullName: string;
    role: UserRole;
  };
}

function requireAuth(allowedRoles?: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No session token provided.' });
    }
    const token = authHeader.split('Bearer ')[1];
    const session = getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      return res.status(403).json({ error: `Access denied. Role ${session.role} is not authorized for this portal.` });
    }
    req.userSession = session;
    next();
  };
}

// -------------------------------------------------------------
// 1. AUTHENTICATION ROUTES
// -------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username / Officer ID and password are required.' });
  }

  const user = db.users.findByUsername(username.trim());
  if (!user) {
    // Audit failed attempt
    db.auditLogs.create('UNKNOWN', username, 'VIEWER', 'LOGIN', `Failed login attempt for nonexistent user "${username}"`);
    // Generic security message (do not reveal which was wrong)
    return res.status(401).json({ error: 'Invalid Officer ID or password.' });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    db.auditLogs.create(user.id, user.fullName, user.role, 'LOGIN', `Failed login attempt for Officer ID "${username}"`);
    return res.status(401).json({ error: 'Invalid Officer ID or password.' });
  }

  // Update last login
  db.users.updateLastLogin(user.id);

  // Generate session token
  const token = createSession(user);

  // Log successful login
  db.auditLogs.create(user.id, user.fullName, user.role, 'LOGIN', `Officer "${user.fullName}" logged in successfully (${user.role})`);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      badgeNumber: user.badgeNumber,
      checkpoint: user.checkpoint,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization!;
  const token = authHeader.split('Bearer ')[1];
  const user = req.userSession!;

  destroySession(token);
  db.auditLogs.create(user.userId, user.fullName, user.role, 'LOGOUT', `Officer "${user.fullName}" logged out`);

  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.findById(req.userSession!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const { passwordHash, passwordSalt, ...safeUser } = user;
  res.json({ user: safeUser });
});

// -------------------------------------------------------------
// 2. DASHBOARD & ANALYTICS ROUTES
// -------------------------------------------------------------

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const hasAi = isAiConfigured();
  const stats = db.getDashboardStats(hasAi);
  res.json(stats);
});

// GET /api/analytics
app.get('/api/analytics', requireAuth(['ADMIN', 'ANALYST', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const sessions = db.verificationSessions.findMany();
  const total = sessions.length;
  const verified = sessions.filter(s => s.finalDecision === 'VERIFIED').length;
  const reviews = sessions.filter(s => s.finalDecision === 'REVIEW_REQUIRED').length;
  const anomalies = sessions.filter(s => s.finalDecision === 'ANOMALY_DETECTED').length;

  const tamperingRiskCounts = {
    LOW: sessions.filter(s => s.tamperingAnalysis?.tamperingRisk === 'LOW').length,
    MEDIUM: sessions.filter(s => s.tamperingAnalysis?.tamperingRisk === 'MEDIUM').length,
    HIGH: sessions.filter(s => s.tamperingAnalysis?.tamperingRisk === 'HIGH').length,
  };

  const docTypeCounts: Record<string, number> = {};
  sessions.forEach(s => {
    const t = s.scannedDocType || 'PASSPORT';
    docTypeCounts[t] = (docTypeCounts[t] || 0) + 1;
  });

  res.json({
    totalScreenings: total,
    verifiedRate: total > 0 ? ((verified / total) * 100).toFixed(1) : '100',
    reviewRate: total > 0 ? ((reviews / total) * 100).toFixed(1) : '0',
    anomalyRate: total > 0 ? ((anomalies / total) * 100).toFixed(1) : '0',
    tamperingRiskCounts,
    docTypeCounts,
    recentSessions: sessions.slice(0, 15),
  });
});

// -------------------------------------------------------------
// 3. ENROLLMENT & OCR ROUTES
// -------------------------------------------------------------

// POST /api/ocr/process
app.post('/api/ocr/process', requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentDataUrl, docType = 'PASSPORT', documentId = `temp_${Date.now()}` } = req.body;
    if (!documentDataUrl) {
      return res.status(400).json({ error: 'Document data URL is required for OCR.' });
    }

    const ocrResult = await performDocumentOcr(documentDataUrl, docType, documentId);

    const confidenceVal = typeof ocrResult?.confidence === 'number' ? ocrResult.confidence : 0;

    db.auditLogs.create(
      req.userSession!.userId,
      req.userSession!.fullName,
      req.userSession!.role,
      'OCR_COMPLETION',
      `Completed live OCR on ${docType} (Confidence: ${confidenceVal.toFixed(1)}%)`,
      { passportNumber: ocrResult.passportNumber, confidence: confidenceVal }
    );

    res.json({ success: true, ocrResult, aiConfigured: isAiConfigured() });
  } catch (error: any) {
    console.error('[Server OCR Fatal Error]:', error);
    res.status(500).json({ error: error.message || 'OCR processing failed.' });
  }
});

// POST /api/ocr/correct
app.post('/api/ocr/correct', requireAuth(['ADMIN', 'DATA OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const { ocrId, updates, reason } = req.body;
  if (!ocrId || !updates || !reason) {
    return res.status(400).json({ error: 'OCR ID, update fields, and correction reason are required.' });
  }

  const updated = db.ocrResults.updateCorrection(ocrId, updates, req.userSession!.fullName, reason);
  if (!updated) {
    return res.status(404).json({ error: 'OCR record not found.' });
  }

  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'MANUAL_OCR_CORRECTION',
    `Manual correction on OCR record ${ocrId}. Reason: "${reason}"`,
    { updates, reason }
  );

  res.json({ success: true, ocrResult: updated });
});

// POST /api/validate/document
app.post('/api/validate/document', requireAuth(['ADMIN', 'DATA OFFICER', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const { ocrResult, declaredProfile, existingDocId, isVerification } = req.body;
  if (!ocrResult) {
    return res.status(400).json({ error: 'OCR Result is required for document validation.' });
  }

  const validationResult = validateDocumentData(ocrResult, declaredProfile, existingDocId, isVerification);

  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'DOCUMENT_ANALYSIS',
    `Document validation evaluated. Status: ${validationResult.overallStatus}`,
    { overallStatus: validationResult.overallStatus }
  );

  res.json({ success: true, validationResult });
});

// POST /api/identities
app.post('/api/identities', requireAuth(['ADMIN', 'DATA OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const { profile, document, ocr, validation, face } = req.body;

  if (!profile || !profile.fullName || !profile.nationality) {
    return res.status(400).json({ error: 'Personal profile information is required.' });
  }

  // 1. Create Identity Profile
  const savedProfile = db.identityProfiles.create({
    identityId: profile.identityId || `ID-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender || 'OTHER',
    nationality: profile.nationality,
    countryOfResidence: profile.countryOfResidence,
    createdBy: req.userSession!.fullName,
  });

  // 2. Create Document Record if present
  let savedDoc = null;
  if (document && document.fileData) {
    savedDoc = db.documents.create({
      identityId: savedProfile.identityId,
      docType: document.docType || 'PASSPORT',
      fileName: document.fileName || 'uploaded_document.jpg',
      fileType: document.fileType || 'image/jpeg',
      fileData: document.fileData,
      uploadedBy: req.userSession!.fullName,
    });
  }

  // 3. Save OCR record if present
  let savedOcr = null;
  if (ocr && savedDoc) {
    savedOcr = db.ocrResults.create({
      ...ocr,
      documentId: savedDoc.id,
    });
  }

  // 4. Save Validation result if present
  let savedVal = null;
  if (validation && savedDoc) {
    savedVal = db.documentValidationResults.create({
      ...validation,
      documentId: savedDoc.id,
      validatedBy: req.userSession!.fullName,
    });
  }

  // 5. Save Face record if present
  let savedFace = null;
  if (face && face.faceImageData) {
    savedFace = db.faceRecords.create({
      identityId: savedProfile.identityId,
      faceImageData: face.faceImageData,
      captureQuality: face.captureQuality || 95,
      detectedFacesCount: face.detectedFacesCount || 1,
      isCentered: face.isCentered ?? true,
      capturedBy: req.userSession!.fullName,
    });

    db.auditLogs.create(
      req.userSession!.userId,
      req.userSession!.fullName,
      req.userSession!.role,
      'FACE_CAPTURE',
      `Live face reference captured for identity ${savedProfile.identityId}`,
      { identityId: savedProfile.identityId }
    );
  }

  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'IDENTITY_CREATION',
    `Enrolled identity profile ${savedProfile.identityId} (${savedProfile.fullName})`,
    { identityId: savedProfile.identityId }
  );

  res.json({
    success: true,
    message: '✓ IDENTITY PROFILE CREATED',
    profile: savedProfile,
    document: savedDoc,
    ocr: savedOcr,
    validation: savedVal,
    face: savedFace,
  });
});

// GET /api/identities
app.get('/api/identities', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const profiles = db.identityProfiles.findMany();
  res.json(profiles);
});

// GET /api/identities/:id
app.get('/api/identities/:id', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const profile = db.identityProfiles.findById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Identity profile not found.' });
  }
  const rawDocs = db.documents.findByProfileId(profile.identityId);
  const documents = rawDocs.map(doc => ({
    ...doc,
    ocr: db.ocrResults.findByDocumentId(doc.id) || null,
  }));
  const face = db.faceRecords.findByProfileId(profile.identityId);
  res.json({ profile, documents, face });
});

// PUT /api/identities/:id
app.put('/api/identities/:id', requireAuth(['ADMIN', 'DATA OFFICER', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const profile = db.identityProfiles.findById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Identity profile not found.' });
  }

  const {
    fullName,
    dateOfBirth,
    gender,
    nationality,
    countryOfResidence,
    identityId,
    docType,
    documentNumber,
    dateOfExpiry,
    issuingCountry,
    reason = 'Officer record update',
  } = req.body;

  if (!fullName || !nationality) {
    return res.status(400).json({ error: 'Full legal name and nationality are mandatory fields.' });
  }

  const updatedProfile = db.identityProfiles.update(profile.id, {
    fullName: fullName.trim(),
    dateOfBirth: dateOfBirth ? dateOfBirth.trim() : profile.dateOfBirth,
    gender: gender || profile.gender,
    nationality: nationality.trim(),
    countryOfResidence: countryOfResidence ? countryOfResidence.trim() : profile.countryOfResidence,
    identityId: identityId ? identityId.trim() : profile.identityId,
  });

  if (!updatedProfile) {
    return res.status(500).json({ error: 'Failed to update identity record.' });
  }

  // Update associated document and OCR results if provided
  const docs = db.documents.findByProfileId(updatedProfile.identityId);
  if (docs.length > 0) {
    const primaryDoc = docs[0];
    if (docType) {
      primaryDoc.docType = docType;
    }
    const ocr = db.ocrResults.findByDocumentId(primaryDoc.id);
    if (ocr) {
      if (documentNumber !== undefined && documentNumber !== '') {
        ocr.passportNumber = documentNumber.trim().toUpperCase();
        ocr.documentNumber = documentNumber.trim().toUpperCase();
      }
      if (dateOfExpiry !== undefined && dateOfExpiry !== '') ocr.dateOfExpiry = dateOfExpiry.trim();
      if (issuingCountry !== undefined && issuingCountry !== '') ocr.issuingCountry = issuingCountry.trim();
      if (docType) ocr.docType = docType;
      ocr.isManualCorrection = true;
      ocr.correctedBy = req.userSession!.fullName;
      ocr.correctedAt = new Date().toISOString();
      ocr.correctionReason = reason;
      db.saveDatabase();
    } else if (documentNumber) {
      db.ocrResults.create({
        documentId: primaryDoc.id,
        docType: docType || primaryDoc.docType,
        surname: updatedProfile.fullName.split(' ').pop() || '',
        givenName: updatedProfile.fullName.split(' ').slice(0, -1).join(' ') || updatedProfile.fullName,
        fullName: updatedProfile.fullName,
        passportNumber: documentNumber.trim().toUpperCase(),
        documentNumber: documentNumber.trim().toUpperCase(),
        dateOfBirth: updatedProfile.dateOfBirth,
        nationality: updatedProfile.nationality,
        gender: updatedProfile.gender,
        placeOfBirth: updatedProfile.nationality,
        dateOfIssue: '2022-01-01',
        dateOfExpiry: dateOfExpiry ? dateOfExpiry.trim() : '2032-01-01',
        issuingCountry: issuingCountry ? issuingCountry.trim() : updatedProfile.nationality,
        mrzLine1: '',
        mrzLine2: '',
        mrzRaw: '',
        confidence: 98,
        extractedFields: {},
        isManualCorrection: true,
        correctedBy: req.userSession!.fullName,
        correctedAt: new Date().toISOString(),
        correctionReason: reason,
      });
    }
  } else if (documentNumber) {
    const newDoc = db.documents.create({
      identityId: updatedProfile.identityId,
      docType: docType || 'PASSPORT',
      fileName: `${(docType || 'PASSPORT').toLowerCase()}_record.pdf`,
      fileType: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0xLjQK...',
      uploadedBy: req.userSession!.fullName,
    });
    db.ocrResults.create({
      documentId: newDoc.id,
      docType: docType || 'PASSPORT',
      surname: updatedProfile.fullName.split(' ').pop() || '',
      givenName: updatedProfile.fullName.split(' ').slice(0, -1).join(' ') || updatedProfile.fullName,
      fullName: updatedProfile.fullName,
      passportNumber: documentNumber.trim().toUpperCase(),
      documentNumber: documentNumber.trim().toUpperCase(),
      dateOfBirth: updatedProfile.dateOfBirth,
      nationality: updatedProfile.nationality,
      gender: updatedProfile.gender,
      placeOfBirth: updatedProfile.nationality,
      dateOfIssue: '2022-01-01',
      dateOfExpiry: dateOfExpiry ? dateOfExpiry.trim() : '2032-01-01',
      issuingCountry: issuingCountry ? issuingCountry.trim() : updatedProfile.nationality,
      mrzLine1: '',
      mrzLine2: '',
      mrzRaw: '',
      confidence: 98,
      extractedFields: {},
      isManualCorrection: true,
      correctedBy: req.userSession!.fullName,
      correctedAt: new Date().toISOString(),
      correctionReason: reason,
    });
  }

  // Cryptographic audit log
  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'RECORD_AMENDMENT',
    `Updated traveler identity record ${updatedProfile.identityId} (${updatedProfile.fullName}). Reason: ${reason}`,
    { identityId: updatedProfile.identityId, changes: req.body }
  );

  res.json({
    success: true,
    message: `Record ${updatedProfile.identityId} updated successfully.`,
    profile: updatedProfile,
  });
});

// -------------------------------------------------------------
// 4. VERIFICATION PORTAL ROUTES
// -------------------------------------------------------------

// POST /api/verification/lookup
app.post('/api/verification/lookup', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const { passportNumber, identityId, visaNumber, name, dateOfBirth } = req.body;

  let match = null;
  if (passportNumber) {
    match = db.identityProfiles.findByPassportOrId(passportNumber);
  }
  if (!match && identityId) {
    match = db.identityProfiles.findByPassportOrId(identityId);
  }
  if (!match && visaNumber) {
    match = db.identityProfiles.findByPassportOrId(visaNumber);
  }
  if (!match && name) {
    match = db.identityProfiles.findByPassportOrId(name);
  }

  if (match) {
    const docs = db.documents.findByProfileId(match.identityId);
    const face = db.faceRecords.findByProfileId(match.identityId);
    const normalizedLookupValues = [passportNumber, visaNumber, name]
      .filter((value): value is string => Boolean(value))
      .map(value => value.trim().toUpperCase().replace(/[\s\-_]/g, ''));
    const matchedStoredDocument = docs
      .map(document => ({ document, ocr: db.ocrResults.findByDocumentId(document.id) }))
      .find(({ ocr }) => {
        if (!ocr) return false;
        const ocrValues = [ocr.passportNumber, ocr.visaNumber, ocr.fullName]
          .filter((value): value is string => Boolean(value))
          .map(value => value.trim().toUpperCase().replace(/[\s\-_]/g, ''));
        return normalizedLookupValues.some(value => ocrValues.includes(value));
      });
    const selectedDocument = matchedStoredDocument?.document || docs[0] || null;
    const docOcr = matchedStoredDocument?.ocr || (selectedDocument ? db.ocrResults.findByDocumentId(selectedDocument.id) : null);

    return res.json({
      found: true,
      statusMessage: '✓ IDENTITY RECORD FOUND',
      identity: match,
      storedDocument: selectedDocument,
      storedFace: face || null,
      storedOcr: docOcr || null,
    });
  }

  res.json({
    found: false,
    statusMessage: '⚠ IDENTITY RECORD NOT FOUND',
    identity: null,
  });
});

// POST /api/verification/tampering-analysis
app.post('/api/verification/tampering-analysis', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentDataUrl, sessionId = `sess_${Date.now()}` } = req.body;
    if (!documentDataUrl) {
      return res.status(400).json({ error: 'Document data is required for tampering analysis.' });
    }

    const analysis = await performTamperingAnalysis(documentDataUrl, sessionId);

    // If high-risk tampering anomaly detected, auto-create alert in alerts table
    if (analysis.tamperingRisk === 'HIGH') {
      db.alerts.create({
        sessionId,
        severity: 'HIGH',
        title: 'Potential Document Tampering Anomaly',
        message: `${analysis.terminology}: ${analysis.summary}`,
      });
    }

    res.json({ success: true, analysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Tampering analysis failed.' });
  }
});

// POST /api/verification/face-verify
app.post('/api/verification/face-verify', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { storedDocumentImageData, liveCameraImageData, sessionId = `sess_${Date.now()}` } = req.body;
    if (!storedDocumentImageData || !liveCameraImageData) {
      return res.status(400).json({ error: 'Both stored document photo and live camera capture are required.' });
    }

    const faceResult = await performFaceVerification(storedDocumentImageData, liveCameraImageData, sessionId);

    if (faceResult.result === 'MISMATCH') {
      db.alerts.create({
        sessionId,
        severity: 'CRITICAL',
        title: 'Biometric Face Mismatch Detected',
        message: `Face comparison returned MISMATCH (Confidence: ${faceResult.matchScore.toFixed(1)}%).`,
      });
    }

    if (faceResult.liveness?.livenessStatus === 'SPOOF_DETECTED' || (faceResult.liveness && !faceResult.liveness.isLiveHuman)) {
      db.alerts.create({
        sessionId,
        severity: 'CRITICAL',
        title: 'Biometric Presentation Attack / Spoof Detected',
        message: `Presentation attack detected: ${faceResult.liveness.spoofDetectionType?.replace(/_/g, ' ') || 'Fake biometric presentation'}. Live human presence not verified.`,
      });
    }

    res.json({ success: true, faceResult });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Face comparison failed.' });
  }
});

// -------------------------------------------------------------
// ADAPTIVE AI IMMIGRATION PRE-SCREENING INTERVIEW ROUTES
// -------------------------------------------------------------

// POST /api/verification/interview/start
app.post('/api/verification/interview/start', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseContext } = req.body;
    const interviewState = initInterviewState(caseContext);

    db.auditLogs.create(
      req.userSession!.userId,
      req.userSession!.fullName,
      req.userSession!.role,
      'AI_INTERVIEW_START',
      `Initiated Adaptive AI Immigration Pre-Screening Interview for Case ${interviewState.caseId || 'N/A'} (${interviewState.nationality}, Visa: ${interviewState.visaType})`,
      {
        caseId: interviewState.caseId,
        nationality: interviewState.nationality,
        visaType: interviewState.visaType,
        destination: interviewState.destination,
      }
    );

    res.json({ success: true, interviewState });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize interview' });
  }
});

// POST /api/verification/interview/answer
app.post('/api/verification/interview/answer', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentState, answerText, caseContext } = req.body;
    if (!currentState || typeof answerText !== 'string' || answerText.trim() === '') {
      return res.status(400).json({ error: 'Valid currentState and answerText are required.' });
    }

    const updatedState = await processPassengerAnswerAndGenerateNext(currentState, answerText.trim(), caseContext);

    const isClarification =
      updatedState.potentialInconsistencies.some((i) => !i.resolved) ||
      updatedState.currentQuestion.toLowerCase().includes('clarif');

    db.auditLogs.create(
      req.userSession!.userId,
      req.userSession!.fullName,
      req.userSession!.role,
      isClarification ? 'AI_INTERVIEW_CLARIFICATION' : 'AI_INTERVIEW_ANSWER',
      `Recorded Q${currentState.questionCount} response for Case ${updatedState.caseId || 'N/A'}${isClarification ? ' (Clarification Flagged)' : ''}`,
      {
        questionNumber: currentState.questionCount,
        question: currentState.currentQuestion,
        answer: answerText,
        consistencyRating: updatedState.consistencyRating,
        status: updatedState.status,
      }
    );

    if (updatedState.status !== 'IN_PROGRESS') {
      db.auditLogs.create(
        req.userSession!.userId,
        req.userSession!.fullName,
        req.userSession!.role,
        'AI_INTERVIEW_COMPLETE',
        `Concluded AI Pre-Screening Interview for Case ${updatedState.caseId || 'N/A'} with rating: ${updatedState.consistencyRating} (${updatedState.status})`,
        {
          totalQuestions: updatedState.questionsAsked.length,
          recommendation: updatedState.recommendation,
          consistencyRating: updatedState.consistencyRating,
        }
      );
    }

    res.json({ success: true, interviewState: updatedState });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process interview response' });
  }
});

// POST /api/verification/calculate-risk
app.post('/api/verification/calculate-risk', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const { validationResult, tamperingAnalysis, faceResult, matchedIdentityFound, interviewState } = req.body;
  if (!validationResult || !tamperingAnalysis) {
    return res.status(400).json({ error: 'Validation result and tampering analysis are required.' });
  }

  const riskAssessment = calculateScreeningRisk(
    validationResult,
    tamperingAnalysis,
    faceResult,
    matchedIdentityFound ?? true,
    interviewState
  );
  const finalDecision = determineFinalDecision(
    validationResult,
    tamperingAnalysis,
    faceResult,
    riskAssessment,
    interviewState
  );

  res.json({ success: true, riskAssessment, finalDecision });
});

// POST /api/verification/complete
app.post('/api/verification/complete', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const {
    scannedDocumentData,
    scannedDocType,
    scannedOcr,
    matchedIdentity,
    storedDocument,
    storedFace,
    liveCapturedFaceData,
    validationResult,
    tamperingAnalysis,
    faceVerification,
    interviewState,
    riskAssessment,
    finalDecision,
    decisionNotes,
  } = req.body;

  const session = db.verificationSessions.create({
    officerId: req.userSession!.userId,
    officerName: req.userSession!.fullName,
    checkpoint: 'Checkpoint Alpha - Terminal 1',
    scannedDocumentData: scannedDocumentData || '',
    scannedDocType: scannedDocType || 'PASSPORT',
    scannedOcr,
    matchedIdentity,
    storedDocument,
    storedFace,
    liveCapturedFaceData,
    validationResult,
    tamperingAnalysis,
    faceVerification,
    interviewState,
    riskAssessment,
    finalDecision,
    decisionNotes,
    completedAt: new Date().toISOString(),
  });

  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'VERIFICATION_COMPLETION',
    `Concluded screening session ${session.sessionNumber} with verdict: ${finalDecision} (Risk: ${riskAssessment?.score || 0}/100)`,
    { sessionNumber: session.sessionNumber, finalDecision, riskScore: riskAssessment?.score, interviewRating: interviewState?.consistencyRating }
  );

  res.json({ success: true, session });
});

// GET /api/verification/sessions
app.get('/api/verification/sessions', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const sessions = db.verificationSessions.findMany();
  res.json(sessions);
});

// GET /api/verification/sessions/:id
app.get('/api/verification/sessions/:id', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const session = db.verificationSessions.findById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Verification session not found.' });
  }
  res.json(session);
});

// -------------------------------------------------------------
// 5. ALERTS & AUDIT TRAIL ROUTES
// -------------------------------------------------------------

// GET /api/alerts
app.get('/api/alerts', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const alerts = db.alerts.findMany();
  res.json(alerts);
});

// POST /api/alerts/:id/resolve
app.post('/api/alerts/:id/resolve', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const alert = db.alerts.resolve(req.params.id, req.userSession!.fullName);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found.' });
  }
  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'MANUAL_REVIEW',
    `Resolved alert: "${alert.title}"`,
    { alertId: alert.id }
  );
  res.json({ success: true, alert });
});

// GET /api/audit-logs and /api/audit/logs
app.get(['/api/audit-logs', '/api/audit/logs'], requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 200;
  const logs = db.auditLogs.findMany(limit);
  res.json(logs);
});

// GET /api/database/stats (Returns record metrics and database file size)
app.get('/api/database/stats', requireAuth(), (req: AuthenticatedRequest, res: Response) => {
  const stats = db.getDatabaseStats();
  res.json(stats);
});

// DELETE /api/database/identities/:id (Deletes single identity profile & related biometrics/documents)
app.delete('/api/database/identities/:id', requireAuth(['ADMIN', 'DATA OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const removed = db.identityProfiles.delete(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Identity record not found.' });
  }
  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'IDENTITY_DELETION',
    `Permanently deleted identity record ${removed.identityId} (${removed.fullName}) and associated biometrics/documents.`,
    { deletedIdentityId: removed.identityId, deletedProfileId: removed.id }
  );
  res.json({
    success: true,
    message: `Identity profile ${removed.identityId} (${removed.fullName}) deleted successfully.`,
    deletedProfile: removed,
  });
});

// DELETE /api/database/documents/:id (Deletes single document and OCR results)
app.delete('/api/database/documents/:id', requireAuth(['ADMIN', 'DATA OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const ok = db.documents.delete(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: 'Document not found.' });
  }
  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'DOCUMENT_DELETION',
    `Deleted document record ${req.params.id} from database repository.`,
    { documentId: req.params.id }
  );
  res.json({ success: true, message: 'Document deleted successfully.' });
});

// DELETE /api/database/sessions/:id (Deletes verification session)
app.delete('/api/database/sessions/:id', requireAuth(['ADMIN', 'VERIFICATION OFFICER']), (req: AuthenticatedRequest, res: Response) => {
  const removed = db.verificationSessions.delete(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Verification session record not found.' });
  }
  db.auditLogs.create(
    req.userSession!.userId,
    req.userSession!.fullName,
    req.userSession!.role,
    'SESSION_DELETION',
    `Deleted verification session ${removed.sessionNumber}.`,
    { sessionId: removed.id, sessionNumber: removed.sessionNumber }
  );
  res.json({
    success: true,
    message: `Verification session ${removed.sessionNumber} deleted successfully.`,
    deletedSession: removed,
  });
});

// POST /api/database/reset (Resets database to demo baseline or blank slate)
app.post('/api/database/reset', requireAuth(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { mode = 'demo' } = req.body;
  if (mode === 'empty') {
    db.resetToEmpty(req.userSession?.userId, req.userSession?.fullName);
    return res.json({
      success: true,
      mode: 'empty',
      message: 'Database reset to empty state. All operational and identity records cleared.',
    });
  }

  db.resetToDemoBaseline(req.userSession?.userId, req.userSession?.fullName);
  res.json({
    success: true,
    mode: 'demo',
    message: 'Database reset to official demo baseline with verified traveler records (GARIMA THAPLIYAL / SP003369).',
  });
});

// POST /api/database/clear-table (Clears a specific table collection)
app.post('/api/database/clear-table', requireAuth(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { table } = req.body;
  if (!['sessions', 'identities', 'alerts', 'audit_logs'].includes(table)) {
    return res.status(400).json({ error: 'Invalid table target specified.' });
  }
  const result = db.clearTable(table as any, req.userSession?.userId, req.userSession?.fullName);
  res.json({
    success: true,
    message: `Successfully cleared ${table} collection (${result.count} records removed).`,
    ...result,
  });
});

// POST /api/admin/purge-all-data (Wipes all operational & demo data)
app.post('/api/admin/purge-all-data', requireAuth(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  db.purgeAllData(req.userSession?.userId, req.userSession?.fullName);
  res.json({
    success: true,
    message: 'All operational records, identities, and session data successfully purged.',
  });
});

// -------------------------------------------------------------
// 6. VITE MIDDLEWARE & STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Checkpoint System] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
