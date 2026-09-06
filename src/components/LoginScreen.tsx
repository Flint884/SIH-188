import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, KeyRound, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types.ts';

interface DemoAccount {
  label: string;
  role: UserRole;
  username: string;
  badge: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin (Both Portals)', role: 'ADMIN', username: 'admin', badge: 'CP-ADM-001' },
  { label: 'Data Officer (Enrollment)', role: 'DATA OFFICER', username: 'officer_data', badge: 'CP-ENR-104' },
  { label: 'Verification Officer', role: 'VERIFICATION OFFICER', username: 'officer_verify', badge: 'CP-VRF-209' },
  { label: 'Analyst (Intelligence)', role: 'ANALYST', username: 'analyst_user', badge: 'CP-ANL-312' },
  { label: 'Viewer (Read-Only)', role: 'VIEWER', username: 'viewer_guest', badge: 'CP-VIW-405' },
];

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transition state stages: 'idle' | 'auth' | 'id_confirmed' | 'role_verified' | 'access_granted'
  const [transitionStage, setTransitionStage] = useState<string>('idle');

  const handleQuickSelect = (acc: DemoAccount) => {
    setUsername(acc.username);
    if (acc.role === 'ADMIN') setPassword('Admin@Pass123');
    else if (acc.role === 'DATA OFFICER') setPassword('Enroll@Pass123');
    else if (acc.role === 'VERIFICATION OFFICER') setPassword('Verify@Pass123');
    else if (acc.role === 'ANALYST') setPassword('Analyze@Pass123');
    else setPassword('View@Pass123');
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Invalid Officer ID or password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsSubmitting(false);
        setErrorMessage('Invalid Officer ID or password.');
        return;
      }

      // Start the animated transition sequence required by requirement #5
      setTransitionStage('auth');

      setTimeout(() => {
        setTransitionStage('id_confirmed');
      }, 500);

      setTimeout(() => {
        setTransitionStage('role_verified');
      }, 1000);

      setTimeout(() => {
        setTransitionStage('access_granted');
      }, 1500);

      setTimeout(() => {
        login(data.token, data.user);
      }, 2100);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Invalid Officer ID or password.');
    }
  };

  return (
    <div className="login-shell min-h-screen font-sans flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background ambient security dot matrix grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#666 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top hardware status bar */}
      <header className="h-12 border-b border-[#2A2D35] flex items-center justify-between px-4 sm:px-6 bg-[#111318] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#06b6d4]" />
          <span className="text-[10px] font-mono tracking-[0.2em] text-cyan-500 uppercase font-semibold">
            System Security Active
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-[10px] font-mono text-[#666]">
          <span className="hidden sm:inline">SERVER: CP-ALPHA-01</span>
          <span className="hidden md:inline">ENCRYPTION: AES-256-GCM</span>
          <span className="text-[#4ADE80] font-semibold">● SYSTEM ONLINE</span>
        </div>
      </header>

      {/* Main Center Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-4 py-8 z-10">
        {/* Headline */}
        <div className="mb-8 sm:mb-10 text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-white mb-2 leading-tight uppercase">
            AI-BASED FAKE IDENTITY
            <br />
            <span className="text-cyan-500">& DOCUMENT SCREENING SYSTEM</span>
          </h1>
          <p className="text-[#888] font-mono text-xs uppercase tracking-widest">
            Secure AI-assisted identity and document verification platform
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="w-full max-w-[440px] bg-[#15171C] border border-[#2A2D35] rounded-xl shadow-2xl p-6 sm:p-8 relative z-10 overflow-hidden">
          {/* Cyan top glowing hairline accent */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

          {/* Error Banner if authentication fails */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="p-3.5 rounded-md bg-[#1F1315] border border-[#7F1D1D] text-red-300 text-xs font-mono flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase tracking-wider text-red-400">
                      AUTHENTICATION REJECTED
                    </div>
                    <div className="text-red-300/90 mt-0.5 text-[11px]">{errorMessage}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] ml-1 flex items-center justify-between">
                <span>Username / Officer ID</span>
                <span className="text-cyan-500/60 text-[9px]">[REQ]</span>
              </label>
              <div className="relative">
                <input
                  id="officer-id-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="OFFICER_ID_772"
                  disabled={isSubmitting}
                  className="w-full bg-[#0D0F12] border border-[#333] rounded-md py-3 px-4 text-sm font-mono text-[#E0E0E0] placeholder-[#555] focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
                <div className="absolute right-3.5 top-3.5 w-4 h-4 text-[#555] pointer-events-none">
                  <Shield className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] ml-1 flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-cyan-500/80 uppercase font-mono hover:text-cyan-400 cursor-pointer"
                >
                  {showPassword ? '[ 🙈 Hide ]' : '[ 👁 Show ]'}
                </button>
              </label>
              <div className="relative">
                <input
                  id="officer-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className="w-full bg-[#0D0F12] border border-[#333] rounded-md py-3 px-4 text-sm font-mono text-[#E0E0E0] placeholder-[#555] focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              id="officer-login-button"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-md font-bold text-sm tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2 font-mono text-xs">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>VERIFYING CREDENTIALS...</span>
                </span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Login to Secure Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-[#2A2D35]">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#888] mb-2.5">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-cyan-500/80">
                <KeyRound className="h-3 w-3 text-cyan-400" />
                <span>Quick Role Presets:</span>
              </span>
              <span className="text-[9px] text-[#555]">Auto-fills test account</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleQuickSelect(acc)}
                  className={`text-left px-2.5 py-2 rounded border text-[11px] transition-all cursor-pointer ${
                    username === acc.username
                      ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                      : 'bg-[#0D0F12] border-[#2A2D35] text-[#888] hover:border-[#444] hover:text-[#E0E0E0]'
                  }`}
                >
                  <div className="font-semibold truncate text-[11px] text-[#DDD]">{acc.label}</div>
                  <div className="text-[9px] text-cyan-500/60 font-mono">ID: {acc.username}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Card footer telemetry note */}
          <div className="pt-5 border-t border-[#2A2D35] mt-5 flex justify-between items-center text-[9px] font-mono uppercase text-[#777]">
            <div>Authorized Personnel Only</div>
            <div>Secure Checkpoint System</div>
          </div>
        </div>

        {/* Global Security Metrics Grid from Hardware Tool Theme */}
        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-[800px]">
          <div className="bg-[#111318]/70 border border-[#2A2D35]/70 p-4 rounded-lg flex flex-col items-center">
            <div className="text-cyan-500/60 font-mono text-[10px] uppercase mb-1 tracking-wider">
              Global Identifiers
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-white">1,284,092</div>
          </div>
          <div className="bg-[#111318]/70 border border-[#2A2D35]/70 p-4 rounded-lg flex flex-col items-center">
            <div className="text-cyan-500/60 font-mono text-[10px] uppercase mb-1 tracking-wider">
              Daily Screenings
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-white">14,502</div>
          </div>
          <div className="bg-[#111318]/70 border border-[#2A2D35]/70 p-4 rounded-lg flex flex-col items-center">
            <div className="text-cyan-500/60 font-mono text-[10px] uppercase mb-1 tracking-wider">
              Neural Confidence
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-[#4ADE80]">99.94%</div>
          </div>
        </div>
      </main>

      {/* Hardware Telemetry Footer */}
      <footer className="h-10 bg-[#0D0F12] border-t border-[#2A2D35] flex items-center justify-between px-4 sm:px-6 font-mono text-[9px] text-[#666] relative z-10 select-none">
        <div className="flex gap-4">
          <span>LATENCY: 14ms</span>
          <span className="hidden sm:inline">GATEWAY: BORDER-CON-4</span>
          <span className="hidden md:inline">GEO: 37.7749° N, 122.4194° W</span>
        </div>
        <div className="text-[#777]">AI DOCUMENT VALIDATION CORE V4.2.0-STABLE</div>
      </footer>

      {/* Transition Modal after successful login */}
      <AnimatePresence>
        {transitionStage !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0A0B0D]/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#15171C] border border-cyan-500/50 rounded-xl p-8 max-w-sm w-full shadow-[0_0_30px_rgba(6,182,212,0.25)] text-center font-mono space-y-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

              <div className="h-16 w-16 mx-auto rounded-full bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_#06b6d4]">
                <Shield className="h-8 w-8 text-cyan-400 animate-pulse" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white tracking-widest uppercase">AUTHENTICATING...</h3>
                <p className="text-xs text-[#888] mt-1">Verifying biometric credentials and hardware clearance</p>
              </div>

              <div className="space-y-2.5 text-left text-xs bg-[#0D0F12] p-4 rounded-lg border border-[#2A2D35]">
                <div className="flex items-center gap-2">
                  {transitionStage === 'auth' ? (
                    <span className="h-3.5 w-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-[#4ADE80]" />
                  )}
                  <span className={transitionStage !== 'auth' ? 'text-[#4ADE80] font-semibold' : 'text-[#888]'}>
                    ✓ IDENTITY CONFIRMED
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {transitionStage === 'auth' || transitionStage === 'id_confirmed' ? (
                    <span className="h-3.5 w-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-[#4ADE80]" />
                  )}
                  <span
                    className={
                      transitionStage === 'role_verified' || transitionStage === 'access_granted'
                        ? 'text-[#4ADE80] font-semibold'
                        : 'text-[#666]'
                    }
                  >
                    ✓ ROLE VERIFIED
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {transitionStage !== 'access_granted' ? (
                    <span className="h-3.5 w-3.5 border-2 border-[#333] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-[#4ADE80]" />
                  )}
                  <span className={transitionStage === 'access_granted' ? 'text-[#4ADE80] font-bold' : 'text-[#666]'}>
                    ✓ ACCESS GRANTED
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-cyan-500/80 animate-pulse tracking-wider">
                Redirecting to authorized checkpoint terminal...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
