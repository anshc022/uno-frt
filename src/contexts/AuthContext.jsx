import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const savedToken = localStorage.getItem('uno-auth-token');
    const savedUser = localStorage.getItem('uno-auth-user');
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        
        // Verify token is still valid
        apiFetch('api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setUser(data.user);
            // Update stored user data
            localStorage.setItem('uno-auth-user', JSON.stringify(data.user));
          } else {
            // Token is invalid, clear stored data
            logout();
          }
        })
        .catch(() => {
          // Error verifying token, clear stored data
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('uno-auth-token');
        localStorage.removeItem('uno-auth-user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('uno-auth-token', authToken);
    localStorage.setItem('uno-auth-user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      // Call logout endpoint to update server-side status
      await apiFetch('api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    setUser(null);
    setToken(null);
    localStorage.removeItem('uno-auth-token');
    localStorage.removeItem('uno-auth-user');
  };

  const isAuthenticated = () => {
    return !!(user && token);
  };

  const updateUserStats = (stats) => {
    const updatedUser = { ...user, ...stats };
    setUser(updatedUser);
    localStorage.setItem('uno-auth-user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    updateUserStats
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;