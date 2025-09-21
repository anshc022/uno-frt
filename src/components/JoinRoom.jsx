import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.jsx';

function JoinRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!connected) {
      setStatus('connecting');
      return;
    }

    if (!roomId || !/^\d{4}$/.test(roomId)) {
      setError('Invalid room code. Room codes must be 4 digits.');
      setStatus('error');
      return;
    }

    setStatus('joining');
    
    // Set up socket listeners
    const handleRoomJoined = (roomData) => {
      console.log('Successfully joined room:', roomData);
      navigate('/', { state: { joinedRoom: roomData } });
    };

    const handleError = ({ message }) => {
      console.error('Failed to join room:', message);
      setError(message);
      setStatus('error');
    };

    socket.on('roomJoined', handleRoomJoined);
    socket.on('error', handleError);

    // Attempt to join the room with ack + timeout
    let didRespond = false;
    const timeoutId = setTimeout(() => {
      if (!didRespond) {
        setStatus('error');
        setError('Join request timed out. Please verify the code or try again.');
      }
    }, 7000);

    socket.emit('joinRoom', { roomId }, (ack) => {
      didRespond = true;
      clearTimeout(timeoutId);
      if (!ack?.ok) {
        setError(ack?.error || 'Failed to join room');
        setStatus('error');
      }
      // Success path handled by roomJoined event
    });

    // Cleanup
    return () => {
      socket.off('roomJoined', handleRoomJoined);
      socket.off('error', handleError);
    };
  }, [socket, connected, roomId, navigate]);

  const goToLobby = () => {
    navigate('/');
  };

  if (status === 'connecting') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="glass-morphism rounded-3xl p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Connecting to server...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we connect you to the game.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'joining') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="glass-morphism rounded-3xl p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Joining Room {roomId}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we add you to the room...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="glass-morphism rounded-3xl p-8 text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Failed to Join Room
          </h2>
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <button
            onClick={goToLobby}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default JoinRoom;