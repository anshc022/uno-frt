import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.jsx';
import { useAuth } from '../contexts/AuthContext';

const Lobby = () => {
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState('');
  const [canStartGame, setCanStartGame] = useState(false);
  const [userRooms, setUserRooms] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if we were redirected here after joining a room via URL
    if (location.state?.joinedRoom) {
      setRoomInfo(location.state.joinedRoom);
      // Clear the state to prevent issues on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    // Load user's rooms when component mounts
    loadUserRooms();
    loadAvailableRooms();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Helper to normalize room shapes coming from different events
    const normalizeRoom = (room) => {
      if (!room) return room;
      const unifiedId = room.roomId || room.id;
      return {
        ...room,
        id: unifiedId,
        roomId: unifiedId,
        players: (room.players || []).map(p => ({
          ...p,
          userId: p.userId || p.user // ensure userId exists for UI comparisons
        }))
      };
    };

    // Socket event listeners
    socket.on('roomCreated', ({ roomId: newRoomId, gameRoomId, player, room }) => {
      console.log('Room created:', newRoomId);
      setRoomId(newRoomId);
      setRoomInfo({ ...normalizeRoom(room), gameRoomId });
      setIsCreating(false);
      setError('');
    });

    socket.on('roomJoined', ({ roomId: joinedRoomId, gameRoomId, player, room }) => {
      console.log('Room joined:', joinedRoomId);
      setRoomId(joinedRoomId);
      setRoomInfo({ ...normalizeRoom(room), gameRoomId });
      setIsJoining(false);
      setError('');
    });

    socket.on('roomUpdate', (roomData) => {
      console.log('Room update:', roomData);
      const normalized = normalizeRoom(roomData);
      setRoomInfo(prev => ({ ...prev, ...normalized }));
      const onlinePlayerCount = roomData.players?.filter(p => p.isOnline).length || 0;
      setCanStartGame(onlinePlayerCount >= 2);
    });

    socket.on('gameStarted', (gameState) => {
      console.log('Game started, navigating to game');
      navigate(`/game/${roomId}`);
    });

    socket.on('gameStartedFull', ({ roomId: startedRoomId, gameState }) => {
      console.log('GameStartedFull received for', startedRoomId);
      if (startedRoomId) {
        navigate(`/game/${startedRoomId}`);
      } else if (roomId) {
        navigate(`/game/${roomId}`);
      }
    });

    socket.on('newGameCreated', ({ gameRoomId, room }) => {
      console.log('New game created:', gameRoomId);
      setRoomInfo(prev => ({ ...prev, ...normalizeRoom(room), gameRoomId }));
      setCanStartGame(room.players?.filter(p => p.isOnline).length >= 2);
    });

    socket.on('canStartGame', (canStart) => {
      setCanStartGame(canStart);
    });

    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      setError(message);
      setIsCreating(false);
      setIsJoining(false);
    });

    socket.on('playerDisconnected', ({ playerId, username, room }) => {
      console.log('Player disconnected:', username);
      setRoomInfo(prev => ({ ...prev, ...normalizeRoom(room) }));
      const onlinePlayerCount = room.players?.filter(p => p.isOnline).length || 0;
      setCanStartGame(onlinePlayerCount >= 2);
    });

    socket.on('roomDeleted', ({ message, roomId }) => {
      console.log('Room deleted:', roomId);
      setError(message);
      setRoomInfo(null);
      setRoomId('');
      setCanStartGame(false);
      loadUserRooms();
      loadAvailableRooms();
    });

    socket.on('roomDeleteConfirmed', ({ roomId }) => {
      console.log('Room deletion confirmed:', roomId);
      setRoomInfo(null);
      setRoomId('');
      setCanStartGame(false);
      loadUserRooms();
      loadAvailableRooms();
    });

    // Cleanup
    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('roomUpdate');
      socket.off('gameStarted');
  socket.off('gameStartedFull');
      socket.off('newGameCreated');
      socket.off('canStartGame');
      socket.off('error');
      socket.off('playerDisconnected');
      socket.off('roomDeleted');
      socket.off('roomDeleteConfirmed');
    };
  }, [socket, roomId, navigate]);

  const loadUserRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user-rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const rooms = await response.json();
        setUserRooms(rooms);
      }
    } catch (error) {
      console.error('Error loading user rooms:', error);
    }
  };

  const loadAvailableRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const rooms = await response.json();
        setAvailableRooms(rooms);
      }
    } catch (error) {
      console.error('Error loading available rooms:', error);
    }
  };

  const createRoom = () => {
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }
    if (!connected) {
      setError('Not connected to server');
      return;
    }
    
    setIsCreating(true);
    setError('');
    socket.emit('createRoom', roomName.trim());
  };

  const joinRoom = (targetRoomId = null) => {
    const roomToJoin = targetRoomId || roomId.trim();
    if (!roomToJoin) {
      setError('Please enter room code or select a room');
      return;
    }
    if (!connected) {
      setError('Not connected to server');
      return;
    }
    
    setIsJoining(true);
    setError('');
    socket.emit('joinRoom', { roomId: roomToJoin }, (ack) => {
      if (!ack?.ok) {
        setIsJoining(false);
        setError(ack?.error || 'Failed to join room');
      }
      // Success handled by roomJoined event
    });
  };

  const startGame = () => {
    if (!roomInfo || !canStartGame) return;
    
    socket.emit('startGame', { 
      roomId: roomInfo.id
    });
  };

  const startNewGame = () => {
    if (!roomInfo) return;
    
    socket.emit('newGame', { 
      roomId: roomInfo.id
    });
  };

  const deleteRoom = () => {
    if (!roomInfo) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete room "${roomInfo.name}"? This action cannot be undone and will kick out all players.`
    );
    
    if (confirmDelete) {
      socket.emit('deleteRoom', { 
        roomId: roomInfo.id
      });
    }
  };

  const leaveRoom = () => {
    setRoomInfo(null);
    setRoomId('');
    setCanStartGame(false);
    setError('');
    loadUserRooms();
    loadAvailableRooms();
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="panel-primary panel-glow p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!roomInfo ? (
        // Initial lobby state
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create/Join Room Panel */}
          <div className="glass-morphism rounded-3xl p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                � Game Lobby
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Create a new room or join an existing one
              </p>
            </div>
            
            {error && (
              <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                           bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           text-gray-900 dark:text-white placeholder-gray-500"
                  maxLength={30}
                />
              </div>
              
              <button
                onClick={createRoom}
                disabled={isCreating || !roomName.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 
                         disabled:from-gray-500 disabled:to-gray-600 text-white font-medium py-3 px-6 rounded-lg 
                         transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 
                         disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              >
                {isCreating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </div>
                ) : (
                  '🎮 Create New Room'
                )}
              </button>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">or</span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room Code (4 digits)
                  </label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => {
                      // Only allow numeric input and limit to 4 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setRoomId(value);
                    }}
                    placeholder="e.g. 1234"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                             bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
                             focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             text-gray-900 dark:text-white placeholder-gray-500 text-center text-xl font-mono"
                    maxLength="4"
                  />
                </div>
                <button
                  onClick={() => joinRoom()}
                  disabled={isJoining || !roomId.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 
                           disabled:from-gray-500 disabled:to-gray-600 text-white font-medium py-3 px-6 rounded-lg 
                           transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 
                           disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
                >
                  {isJoining ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Joining...
                    </div>
                  ) : (
                    '🚪 Join Room'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Your Rooms Panel */}
          <div className="glass-morphism rounded-3xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              🏠 Your Rooms
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {userRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No rooms yet.</p>
                  <p className="text-sm">Create a room to get started!</p>
                </div>
              ) : (
                userRooms.map((room) => (
                  <div
                    key={room._id}
                    className="bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 
                             rounded-lg p-4 hover:bg-white/40 dark:hover:bg-gray-800/40 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => joinRoom(room.roomId)}
                      >
                        <h4 className="font-medium text-gray-900 dark:text-white">{room.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Room ID: {room.roomId} • {room.players.filter(p => p.isOnline).length}/{room.players.length} online
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Show delete button if user is the host */}
                        {user && room.host === user._id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const confirmDelete = window.confirm(`Delete room "${room.name}"?`);
                              if (confirmDelete) {
                                socket.emit('deleteRoom', { roomId: room.roomId });
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Delete room"
                          >
                            🗑️
                          </button>
                        )}
                        <div className={`w-3 h-3 rounded-full ${room.isActive ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available Rooms Panel */}
          <div className="glass-morphism rounded-3xl p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                🌍 Available Rooms
              </h3>
              <button
                onClick={loadAvailableRooms}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availableRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 md:col-span-2 lg:col-span-3">
                  <p>No public rooms available.</p>
                  <p className="text-sm">Be the first to create one!</p>
                </div>
              ) : (
                availableRooms.map((room) => (
                  <div
                    key={room._id}
                    className="bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 
                             rounded-lg p-4 hover:bg-white/40 dark:hover:bg-gray-800/40 transition-all duration-200 cursor-pointer"
                    onClick={() => joinRoom(room.roomId)}
                  >
                    <div className="text-center">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">{room.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Room ID: {room.roomId} • {room.players.length}/4 players
                      </p>
                      <button className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg transition-colors">
                        Join Room
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        // Room waiting state
        <div className="glass-morphism rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
              {roomInfo.name}
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-4">
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Share this room code with friends:
              </p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 
                               bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  {roomInfo.id}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomInfo.id);
                    // You could add a toast notification here
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  title="Copy room code"
                >
                  📋 Copy
                </button>
              </div>
              
              <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                  Or share this direct link:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/join/${roomInfo.id}`}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 
                             rounded-lg text-gray-700 dark:text-gray-300 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join/${roomInfo.id}`);
                      // You could add a toast notification here
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    title="Copy join link"
                  >
                    🔗 Copy Link
                  </button>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {roomInfo.players?.filter(p => p.isOnline).length || 0}/{roomInfo.players?.length || 0} players online
            </p>
          </div>
          
          <div className="space-y-4 mb-6">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg flex items-center gap-2">
              <span className="text-blue-400">👥</span>
              Players:
            </h3>
            {roomInfo.players?.map((player, index) => (
              <div
                key={player.userId || index}
                className={`border rounded-lg p-4 flex items-center justify-between transition-all duration-200 ${
                  player.isOnline 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                  <span className={`w-2 h-2 rounded-full ${
                    player.isOnline ? 'bg-green-400' : 'bg-gray-400'
                  }`}></span>
                  {player.username}
                  {user._id === player.userId && ' (You)'}
                </span>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  player.isOnline 
                    ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                    : 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
                }`}>
                  {player.isOnline ? '✓ Online' : '⚫ Offline'}
                </span>
              </div>
            )) || []}
            
            {/* Show empty slots */}
            {Array.from({ length: 4 - (roomInfo.players?.length || 0) }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex items-center justify-center"
              >
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full opacity-50"></span>
                  Waiting for player...
                </span>
              </div>
            ))}
          </div>
          
          <div className="space-y-4">
            {canStartGame && (
              <button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 
                         text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              >
                🚀 Start Game ({roomInfo.players?.filter(p => p.isOnline).length || 0} players)
              </button>
            )}

            {roomInfo.isActive && !canStartGame && (
              <button
                onClick={startNewGame}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 
                         text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              >
                🎮 Start New Game
              </button>
            )}
            
            {!canStartGame && (roomInfo.players?.filter(p => p.isOnline).length || 0) < 2 && (
              <div className="bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm text-center font-medium">
                  ⏳ Need at least 2 online players to start
                </p>
              </div>
            )}
            
            {/* Delete room button - only show to host */}
            {user && roomInfo.host === user._id && (
              <button
                onClick={deleteRoom}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg 
                         transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg
                         border-2 border-red-600 hover:border-red-700"
              >
                🗑️ Delete Room
              </button>
            )}
            
            <button
              onClick={leaveRoom}
              className="w-full bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 
                       border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 
                       font-medium py-3 px-6 rounded-lg transition-all duration-200"
            >
              🚪 Leave Room
            </button>
          </div>
          
          <div className="mt-6 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm text-center">
              📋 Share room ID <span className="font-mono font-bold bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded">{roomInfo.id}</span> with friends!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;