import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    // Only connect if user is authenticated
    if (!isAuthenticated() || !token) {
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Initialize socket connection with authentication
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (error.message === 'Authentication error') {
        // Token might be invalid, trigger logout
        console.log('Authentication failed, logging out...');
      }
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      // Log more details about the error
      if (typeof error === 'object') {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
    });

    setSocket(newSocket);

    // Cleanup on unmount or token change
    return () => {
      newSocket.close();
    };
  }, [token, isAuthenticated]);

  const value = {
    socket,
    connected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
