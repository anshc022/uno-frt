import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Lobby from './components/Lobby';
import Game from './components/Game';
import JoinRoom from './components/JoinRoom';
import Login from './components/Login';
import Register from './components/Register';
import { SocketProvider } from './hooks/useSocket.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ThemeToggle from './components/ThemeToggle';
import CoupleThemeToggle from './components/CoupleThemeToggle';

function AppContent() {
  const [darkMode, setDarkMode] = useState(false);
  const [coupleTheme, setCoupleTheme] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const { user, loading, login, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const savedCoupleTheme = localStorage.getItem('coupleTheme');
    
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
    if (savedCoupleTheme === 'true') {
      setCoupleTheme(true);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleCoupleTheme = () => {
    setCoupleTheme(!coupleTheme);
    localStorage.setItem('coupleTheme', (!coupleTheme).toString());
  };

  const handleLogin = (userData, token) => {
    login(userData, token);
  };

  const handleRegister = (userData, token) => {
    login(userData, token);
  };

  const handleLogout = () => {
    logout();
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication screens if not logged in
  if (!isAuthenticated()) {
    return (
      <div className={`min-h-screen transition-all duration-300 ${
        coupleTheme ? 'couple-theme' : 'game-background'
      }`}>
        {/* Theme toggles */}
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex gap-1 sm:gap-2">
          <CoupleThemeToggle 
            coupleTheme={coupleTheme} 
            onToggle={toggleCoupleTheme} 
          />
          <ThemeToggle 
            darkMode={darkMode} 
            onToggle={toggleDarkMode} 
          />
        </div>

        {showLogin ? (
          <Login 
            onLogin={handleLogin}
            onSwitchToRegister={() => setShowLogin(false)}
          />
        ) : (
          <Register 
            onRegister={handleRegister}
            onSwitchToLogin={() => setShowLogin(true)}
          />
        )}
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className={`min-h-screen transition-all duration-300 ${
        coupleTheme ? 'couple-theme' : 'game-background'
      }`}>
        {/* Theme toggles and user info */}
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex gap-1 sm:gap-2 items-center">
          <div className="glass-morphism px-3 py-2 rounded-lg">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="ml-2 text-xs text-red-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
          <CoupleThemeToggle 
            coupleTheme={coupleTheme} 
            onToggle={toggleCoupleTheme} 
          />
          <ThemeToggle 
            darkMode={darkMode} 
            onToggle={toggleDarkMode} 
          />
        </div>

        {/* Header - Hidden on game page */}
        {!location.pathname.includes('/game/') && (
          <header className="text-center py-4 sm:py-6 lg:py-8 px-4">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100">
              🎴 UNO Game
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
              Multiplayer Card Game for 2-4 Players
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-1">
              Welcome back, {user.username}! Games: {user.gamesPlayed || 0} | Wins: {user.gamesWon || 0}
            </p>
          </header>
        )}

        {/* Main content */}
        <main className="container mx-auto px-2 sm:px-4 pb-4 sm:pb-8 max-w-6xl">
          <Routes>
            <Route path="/" element={<Lobby />} />
            <Route path="/join/:roomId" element={<JoinRoom />} />
            <Route path="/game/:roomId" element={<Game />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="text-center py-4 text-gray-500 dark:text-gray-500">
          <p>Made with ❤️ for couples and friends</p>
        </footer>
      </div>
    </SocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;