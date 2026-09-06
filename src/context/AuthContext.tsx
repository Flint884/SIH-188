import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  currentPortal: string | null;
  setCurrentPortal: (portal: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('chkpt_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPortal, setCurrentPortal] = useState<string | null>(null);

  useEffect(() => {
    async function verifyToken() {
      const storedToken = localStorage.getItem('chkpt_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
          // Set initial portal based on role
          setDefaultPortalForRole(data.user.role);
        } else {
          localStorage.removeItem('chkpt_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to verify existing session:', err);
        localStorage.removeItem('chkpt_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, []);

  const setDefaultPortalForRole = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        setCurrentPortal('PORTAL_SELECT');
        break;
      case 'DATA OFFICER':
        setCurrentPortal('ENROLLMENT');
        break;
      case 'VERIFICATION OFFICER':
        setCurrentPortal('VERIFICATION');
        break;
      case 'ANALYST':
        setCurrentPortal('ANALYTICS');
        break;
      case 'VIEWER':
        setCurrentPortal('READONLY');
        break;
      default:
        setCurrentPortal(null);
    }
  };

  const login = (newToken: string, loggedInUser: User) => {
    localStorage.setItem('chkpt_token', newToken);
    setToken(newToken);
    setUser(loggedInUser);
    setDefaultPortalForRole(loggedInUser.role);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('chkpt_token');
      setToken(null);
      setUser(null);
      setCurrentPortal(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        currentPortal,
        setCurrentPortal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
