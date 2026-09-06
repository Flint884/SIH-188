import fs from 'fs';
import path from 'path';
import {
  User,
  UserRole,
  IdentityProfile,
  DocumentRecord,
  OcrResult,
  DocumentValidationResult,
  FaceRecord,
  VerificationSession,
  FaceVerificationResult,
  TamperingAnalysis,
  RiskAssessment,
  AlertRecord,
  AuditLog,
  AuditAction,
  DashboardStats,
  DatabaseStats,
} from '../src/types.ts';
import { hashPassword } from './auth.ts';

export interface UserDbRecord extends User {
  passwordHash: string;
  passwordSalt: string;
}

export interface DatabaseSchema {
  users: UserDbRecord[];
  identity_profiles: IdentityProfile[];
  documents: DocumentRecord[];
  ocr_results: OcrResult[];
  document_validation_results: DocumentValidationResult[];
  face_records: FaceRecord[];
  verification_sessions: VerificationSession[];
  face_verification_results: FaceVerificationResult[];
  tampering_analysis: TamperingAnalysis[];
  risk_assessments: RiskAssessment[];
  alerts: AlertRecord[];
  audit_logs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'checkpoint_db.json');

// In-memory relational database state initialized from disk
let dbState: DatabaseSchema = {
  users: [],
  identity_profiles: [],
  documents: [],
  ocr_results: [],
  document_validation_results: [],
  face_records: [],
  verification_sessions: [],
  face_verification_results: [],
  tampering_analysis: [],
  risk_assessments: [],
  alerts: [],
  audit_logs: [],
};

function seedDefaultData() {
  // Pre-seed 5 standard officers matching all specified roles
  const seedOfficers: { username: string; pass: string; name: string; role: UserRole; badge: string }[] = [
    { username: 'admin', pass: 'Admin@Pass123', name: 'Director A. Vance', role: 'ADMIN', badge: 'CP-ADM-001' },
    { username: 'officer_data', pass: 'Enroll@Pass123', name: 'Officer Sarah Chen', role: 'DATA OFFICER', badge: 'CP-ENR-104' },
    { username: 'officer_verify', pass: 'Verify@Pass123', name: 'Officer Marcus Rodriguez', role: 'VERIFICATION OFFICER', badge: 'CP-VRF-209' },
    { username: 'analyst_user', pass: 'Analyze@Pass123', name: 'Senior Analyst Maya Lin', role: 'ANALYST', badge: 'CP-ANL-312' },
    { username: 'viewer_guest', pass: 'View@Pass123', name: 'Inspector David Cole', role: 'VIEWER', badge: 'CP-VIW-405' },
  ];

  dbState.users = seedOfficers.map((o, idx) => {
    const { hash, salt } = hashPassword(o.pass);
    return {
      id: `usr_${idx + 1}`,
      username: o.username,
      fullName: o.name,
      role: o.role,
      badgeNumber: o.badge,
      checkpoint: 'Terminal 1 - Main Border Post Alpha',
      createdAt: '2026-01-10T08:00:00.000Z',
      lastLogin: new Date().toISOString(),
      passwordHash: hash,
      passwordSalt: salt,
    };
  });

  // Zero demo data - all operational collections start completely clean
  dbState.identity_profiles = [];
  dbState.documents = [];
  dbState.ocr_results = [];
  dbState.document_validation_results = [];
  dbState.face_records = [];
  dbState.verification_sessions = [];
  dbState.tampering_analysis = [];
  dbState.risk_assessments = [];
  dbState.alerts = [];
  dbState.audit_logs = [];
}

// Load database from file or initialize
export function initDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(data);
      // Ensure all 12 tables exist
      if (!dbState.users || dbState.users.length === 0) {
        seedDefaultData();
        saveDatabase();
      }
    } else {
      seedDefaultData();
      saveDatabase();
    }
    console.log(`[Database] Initialized successfully. Identities: ${dbState.identity_profiles.length}, Sessions: ${dbState.verification_sessions.length}`);
  } catch (error) {
    console.error('[Database] Failed to load DB file, initializing in-memory fallback:', error);
    seedDefaultData();
  }
}

// Atomically persist database to disk
export function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('[Database] Error persisting database to disk:', error);
  }
}

// Relational query interface
export const db = {
  // Users table
  users: {
    findMany: () => dbState.users.map(({ passwordHash, passwordSalt, ...u }) => u),
    findByUsername: (username: string) => dbState.users.find(u => u.username.toLowerCase() === username.toLowerCase()),
    findById: (id: string) => dbState.users.find(u => u.id === id),
    updateLastLogin: (id: string) => {
      const user = dbState.users.find(u => u.id === id);
      if (user) {
        user.lastLogin = new Date().toISOString();
        saveDatabase();
      }
    },
  },

  // Identity profiles table
  identityProfiles: {
    findMany: () => [...dbState.identity_profiles].reverse(),
    findById: (id: string) => dbState.identity_profiles.find(i => i.id === id || i.identityId === id),
    findByPassportOrId: (query: string) => {
      const clean = query.trim().toUpperCase();
      // Lookup by identityId
      let match = dbState.identity_profiles.find(i => i.identityId.toUpperCase() === clean);
      if (match) return match;

      // Lookup by document passport number
      const docMatch = dbState.ocr_results.find(o => o.passportNumber?.toUpperCase() === clean || o.visaNumber?.toUpperCase() === clean);
      if (docMatch) {
        const doc = dbState.documents.find(d => d.id === docMatch.documentId);
        if (doc) {
          return dbState.identity_profiles.find(i => i.identityId === doc.identityId);
        }
      }

      // Lookup by partial name match
      match = dbState.identity_profiles.find(i => i.fullName.toUpperCase().includes(clean));
      return match;
    },
    create: (data: Omit<IdentityProfile, 'id' | 'createdAt'>) => {
      const newProfile: IdentityProfile = {
        id: `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        ...data,
      };
      dbState.identity_profiles.push(newProfile);
      saveDatabase();
      return newProfile;
    },
    update: (idOrIdentityId: string, updates: Partial<IdentityProfile>) => {
      const profile = dbState.identity_profiles.find(i => i.id === idOrIdentityId || i.identityId === idOrIdentityId);
      if (!profile) return null;

      const oldIdentityId = profile.identityId;
      const newIdentityId = updates.identityId && updates.identityId !== oldIdentityId ? updates.identityId : oldIdentityId;

      if (newIdentityId !== oldIdentityId) {
        dbState.documents.forEach(d => {
          if (d.identityId === oldIdentityId) d.identityId = newIdentityId;
        });
        dbState.face_records.forEach(f => {
          if (f.identityId === oldIdentityId) f.identityId = newIdentityId;
        });
      }

      Object.assign(profile, updates);

      // If fullName changed, also cascade to OCR results for the identity
      if (updates.fullName) {
        const docs = dbState.documents.filter(d => d.identityId === profile.identityId);
        docs.forEach(doc => {
          const ocr = dbState.ocr_results.find(o => o.documentId === doc.id);
          if (ocr) {
            ocr.fullName = updates.fullName!;
            const parts = updates.fullName!.trim().split(' ');
            if (parts.length > 1) {
              ocr.surname = parts[parts.length - 1];
              ocr.givenName = parts.slice(0, -1).join(' ');
            }
          }
        });
      }

      saveDatabase();
      return profile;
    },
    count: () => dbState.identity_profiles.length,
    delete: (idOrIdentityId: string) => {
      const idx = dbState.identity_profiles.findIndex(i => i.id === idOrIdentityId || i.identityId === idOrIdentityId);
      if (idx === -1) return null;
      const [removed] = dbState.identity_profiles.splice(idx, 1);
      
      // Find and delete matching documents
      const docsToRemove = dbState.documents.filter(d => d.identityId === removed.identityId);
      const docIds = new Set(docsToRemove.map(d => d.id));
      
      dbState.documents = dbState.documents.filter(d => d.identityId !== removed.identityId);
      dbState.ocr_results = dbState.ocr_results.filter(o => !docIds.has(o.documentId));
      dbState.document_validation_results = dbState.document_validation_results.filter(v => !docIds.has(v.documentId));
      dbState.face_records = dbState.face_records.filter(f => f.identityId !== removed.identityId);
      
      saveDatabase();
      return removed;
    },
  },

  // Documents table
  documents: {
    findMany: () => dbState.documents,
    findByDocId: (id: string) => dbState.documents.find(d => d.id === id),
    findByProfileId: (identityId: string) => dbState.documents.filter(d => d.identityId === identityId),
    create: (data: Omit<DocumentRecord, 'id' | 'uploadedAt'>) => {
      const doc: DocumentRecord = {
        id: `doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        uploadedAt: new Date().toISOString(),
        ...data,
      };
      dbState.documents.push(doc);
      saveDatabase();
      return doc;
    },
    delete: (id: string) => {
      const idx = dbState.documents.findIndex(d => d.id === id);
      if (idx === -1) return false;
      dbState.documents.splice(idx, 1);
      dbState.ocr_results = dbState.ocr_results.filter(o => o.documentId !== id);
      dbState.document_validation_results = dbState.document_validation_results.filter(v => v.documentId !== id);
      saveDatabase();
      return true;
    },
  },

  // OCR results table
  ocrResults: {
    findMany: () => dbState.ocr_results,
    findByDocumentId: (docId: string) => dbState.ocr_results.find(o => o.documentId === docId),
    create: (data: Omit<OcrResult, 'id'>) => {
      const ocr: OcrResult = {
        id: `ocr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ...data,
      };
      dbState.ocr_results.push(ocr);
      saveDatabase();
      return ocr;
    },
    updateCorrection: (id: string, updates: Partial<OcrResult>, officerName: string, reason: string) => {
      const ocr = dbState.ocr_results.find(o => o.id === id);
      if (ocr) {
        Object.assign(ocr, updates, {
          isManualCorrection: true,
          correctedBy: officerName,
          correctedAt: new Date().toISOString(),
          correctionReason: reason,
        });
        saveDatabase();
        return ocr;
      }
      return null;
    },
  },

  // Document validation results table
  documentValidationResults: {
    findByDocumentId: (docId: string) => dbState.document_validation_results.find(v => v.documentId === docId),
    create: (data: Omit<DocumentValidationResult, 'id' | 'validatedAt'>) => {
      const res: DocumentValidationResult = {
        id: `val_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        validatedAt: new Date().toISOString(),
        ...data,
      };
      dbState.document_validation_results.push(res);
      saveDatabase();
      return res;
    },
  },

  // Face records table
  faceRecords: {
    findMany: () => dbState.face_records,
    findByProfileId: (identityId: string) => dbState.face_records.find(f => f.identityId === identityId),
    create: (data: Omit<FaceRecord, 'id' | 'capturedAt'>) => {
      const face: FaceRecord = {
        id: `face_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        capturedAt: new Date().toISOString(),
        ...data,
      };
      dbState.face_records.push(face);
      saveDatabase();
      return face;
    },
  },

  // Verification sessions table
  verificationSessions: {
    findMany: () => [...dbState.verification_sessions].reverse(),
    findById: (id: string) => dbState.verification_sessions.find(s => s.id === id || s.sessionNumber === id),
    create: (data: Omit<VerificationSession, 'id' | 'sessionNumber' | 'startedAt'>) => {
      const sessionCount = dbState.verification_sessions.length + 1;
      const sessionNum = `VER-2026-${sessionCount.toString().padStart(6, '0')}`;
      const session: VerificationSession = {
        id: `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sessionNumber: sessionNum,
        startedAt: new Date().toISOString(),
        ...data,
      };
      dbState.verification_sessions.push(session);
      saveDatabase();
      return session;
    },
    update: (id: string, updates: Partial<VerificationSession>) => {
      const session = dbState.verification_sessions.find(s => s.id === id);
      if (session) {
        Object.assign(session, updates);
        saveDatabase();
        return session;
      }
      return null;
    },
    delete: (idOrSessionNumber: string) => {
      const idx = dbState.verification_sessions.findIndex(s => s.id === idOrSessionNumber || s.sessionNumber === idOrSessionNumber);
      if (idx === -1) return null;
      const [removed] = dbState.verification_sessions.splice(idx, 1);
      dbState.tampering_analysis = dbState.tampering_analysis.filter(t => t.sessionId !== removed.id);
      dbState.risk_assessments = dbState.risk_assessments.filter(r => r.sessionId !== removed.id);
      saveDatabase();
      return removed;
    },
  },

  // Tampering analysis table
  tamperingAnalysis: {
    findBySessionId: (sessionId: string) => dbState.tampering_analysis.find(t => t.sessionId === sessionId),
    create: (data: Omit<TamperingAnalysis, 'id' | 'performedAt'>) => {
      const analysis: TamperingAnalysis = {
        id: `tamp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        performedAt: new Date().toISOString(),
        ...data,
      };
      dbState.tampering_analysis.push(analysis);
      saveDatabase();
      return analysis;
    },
  },

  // Risk assessments table
  riskAssessments: {
    findBySessionId: (sessionId: string) => dbState.risk_assessments.find(r => r.sessionId === sessionId),
    create: (data: Omit<RiskAssessment, 'id' | 'calculatedAt'>) => {
      const risk: RiskAssessment = {
        id: `risk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        calculatedAt: new Date().toISOString(),
        ...data,
      };
      dbState.risk_assessments.push(risk);
      saveDatabase();
      return risk;
    },
  },

  // Alerts table
  alerts: {
    findMany: () => [...dbState.alerts].reverse(),
    create: (data: Omit<AlertRecord, 'id' | 'timestamp' | 'resolved'>) => {
      const alert: AlertRecord = {
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        resolved: false,
        ...data,
      };
      dbState.alerts.push(alert);
      saveDatabase();
      return alert;
    },
    resolve: (id: string, officerName: string) => {
      const alert = dbState.alerts.find(a => a.id === id);
      if (alert) {
        alert.resolved = true;
        alert.resolvedBy = officerName;
        alert.resolvedAt = new Date().toISOString();
        saveDatabase();
        return alert;
      }
      return null;
    },
  },

  // Audit logs table
  auditLogs: {
    findMany: (limit = 200) => [...dbState.audit_logs].reverse().slice(0, limit),
    create: (officerId: string, officerName: string, role: UserRole, action: AuditAction, details: string, metadata?: any) => {
      const log: AuditLog = {
        id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        officerId,
        officerName,
        role,
        action,
        details,
        metadata,
      };
      dbState.audit_logs.push(log);
      saveDatabase();
      return log;
    },
  },

  // Dynamic Dashboard Stats directly from database
  getDashboardStats: (hasAiConfigured: boolean): DashboardStats => {
    const totalIdentities = dbState.identity_profiles.length;
    const documentsProcessed = dbState.documents.length;
    
    // Calculate today's date string YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const todaysScreenings = dbState.verification_sessions.filter(s => s.startedAt.startsWith(today)).length;
    
    const verifiedCount = dbState.verification_sessions.filter(s => s.finalDecision === 'VERIFIED').length;
    const manualReviewsCount = dbState.verification_sessions.filter(s => s.finalDecision === 'REVIEW_REQUIRED').length;
    const failedVerificationCount = dbState.verification_sessions.filter(s => s.finalDecision === 'ANOMALY_DETECTED').length;
    
    const potentialTamperingAlerts = dbState.alerts.filter(a => !a.resolved && (a.severity === 'HIGH' || a.severity === 'CRITICAL')).length;
    
    // Count face mismatches
    const faceMismatchesCount = dbState.verification_sessions.filter(s => s.faceVerification?.result === 'MISMATCH').length;

    return {
      totalIdentities,
      documentsProcessed,
      todaysScreenings,
      verifiedCount,
      manualReviewsCount,
      failedVerificationCount,
      potentialTamperingAlerts,
      faceMismatchesCount,
      systemStatus: 'ONLINE',
      checkpointName: 'Terminal 1 - Main Border Post Alpha',
      aiServiceStatus: hasAiConfigured ? 'ACTIVE' : 'NOT_CONFIGURED',
    };
  },

  // Purge all operational and demo data (keeps authorized officers)
  purgeAllData: (officerId?: string, officerName?: string) => {
    dbState.identity_profiles = [];
    dbState.documents = [];
    dbState.ocr_results = [];
    dbState.document_validation_results = [];
    dbState.face_records = [];
    dbState.verification_sessions = [];
    dbState.tampering_analysis = [];
    dbState.risk_assessments = [];
    dbState.alerts = [];
    dbState.audit_logs = [
      {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        officerId: officerId || 'usr_1',
        officerName: officerName || 'System Admin',
        role: 'ADMIN',
        action: 'SYSTEM_PURGE',
        details: 'All operational data and demo registries purged. System initialized for pristine data entry.',
      },
    ];
    saveDatabase();
    return true;
  },

  // Clear specific table collections
  clearTable: (tableName: 'sessions' | 'identities' | 'alerts' | 'audit_logs', officerId?: string, officerName?: string) => {
    if (tableName === 'sessions') {
      const count = dbState.verification_sessions.length;
      dbState.verification_sessions = [];
      dbState.tampering_analysis = [];
      dbState.risk_assessments = [];
      db.auditLogs.create(
        officerId || 'usr_1',
        officerName || 'System Admin',
        'ADMIN',
        'TABLE_CLEAR',
        `Cleared all ${count} verification sessions and forensic risk evaluations.`
      );
      saveDatabase();
      return { count };
    } else if (tableName === 'identities') {
      const count = dbState.identity_profiles.length;
      dbState.identity_profiles = [];
      dbState.documents = [];
      dbState.ocr_results = [];
      dbState.document_validation_results = [];
      dbState.face_records = [];
      db.auditLogs.create(
        officerId || 'usr_1',
        officerName || 'System Admin',
        'ADMIN',
        'TABLE_CLEAR',
        `Cleared all ${count} identity profiles, documents, and biometric records.`
      );
      saveDatabase();
      return { count };
    } else if (tableName === 'alerts') {
      const count = dbState.alerts.length;
      dbState.alerts = [];
      db.auditLogs.create(
        officerId || 'usr_1',
        officerName || 'System Admin',
        'ADMIN',
        'TABLE_CLEAR',
        `Cleared all ${count} system alerts.`
      );
      saveDatabase();
      return { count };
    } else if (tableName === 'audit_logs') {
      const count = dbState.audit_logs.length;
      dbState.audit_logs = [
        {
          id: `aud_${Date.now()}`,
          timestamp: new Date().toISOString(),
          officerId: officerId || 'usr_1',
          officerName: officerName || 'System Admin',
          role: 'ADMIN',
          action: 'TABLE_CLEAR',
          details: `Audit ledger purged of ${count} historical entries by administrator.`,
        },
      ];
      saveDatabase();
      return { count };
    }
    return { count: 0 };
  },

  // Reset to Demo Baseline (restores standard verified traveler records & clean baseline)
  resetToDemoBaseline: (officerId?: string, officerName?: string) => {
    const seedFile = path.join(DATA_DIR, 'checkpoint_db.seed.json');
    if (fs.existsSync(seedFile)) {
      try {
        const raw = fs.readFileSync(seedFile, 'utf-8');
        dbState = JSON.parse(raw);
      } catch (err) {
        console.error('[Database] Error loading seed database:', err);
        seedDefaultData();
      }
    } else {
      seedDefaultData();
    }
    db.auditLogs.create(
      officerId || 'usr_1',
      officerName || 'System Admin',
      'ADMIN',
      'DATABASE_RESET',
      'Database reset to official demo baseline with standard verified credentials (GARIMA THAPLIYAL / SP003369).'
    );
    saveDatabase();
    return true;
  },

  // Reset to Empty
  resetToEmpty: (officerId?: string, officerName?: string) => {
    return db.purgeAllData(officerId, officerName);
  },

  // Detailed database storage metrics
  getDatabaseStats: (): DatabaseStats => {
    let fileSize = 0;
    let lastSaved = new Date().toISOString();
    try {
      if (fs.existsSync(DB_FILE)) {
        const stats = fs.statSync(DB_FILE);
        fileSize = stats.size;
        lastSaved = stats.mtime.toISOString();
      }
    } catch {
      // ignore
    }

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      identitiesCount: dbState.identity_profiles.length,
      documentsCount: dbState.documents.length,
      ocrResultsCount: dbState.ocr_results.length,
      faceRecordsCount: dbState.face_records.length,
      sessionsCount: dbState.verification_sessions.length,
      tamperingCount: dbState.tampering_analysis.length,
      riskCount: dbState.risk_assessments.length,
      alertsCount: dbState.alerts.length,
      auditLogsCount: dbState.audit_logs.length,
      usersCount: dbState.users.length,
      dbFileSizeBytes: fileSize,
      dbFileSizeFormatted: formatBytes(fileSize),
      lastSaved,
    };
  },

  saveDatabase: () => saveDatabase(),
};
