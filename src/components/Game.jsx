import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.jsx';
import Card from './Card';
import ColorPicker from './ColorPicker';
import WinnerModal from './WinnerModal';
import VoiceChat from './VoiceChat';
import { canPlayCard } from '../utils/cardUtils';

const Game = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  
  const [gameState, setGameState] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCustomRuleDialog, setShowCustomRuleDialog] = useState(false);
  const [customRule, setCustomRule] = useState('');
  const [pendingCustomCard, setPendingCustomCard] = useState(null);
  
  // New state for handling drawn card option
  const [showPlayDrawnCardOption, setShowPlayDrawnCardOption] = useState(false);
  const [drawnCardIndex, setDrawnCardIndex] = useState(-1);
  const [drawnCardMessage, setDrawnCardMessage] = useState('');
  
  // State for Wild Draw Four challenge
  const [showWildDrawFourChallenge, setShowWildDrawFourChallenge] = useState(false);
  const [lastWildDrawFourPlay, setLastWildDrawFourPlay] = useState(null);
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(0);
  
  // State for expandable card views
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // Reconnection states
  const [showNewGamePrompt, setShowNewGamePrompt] = useState(false);
  const [reconnectionMessage, setReconnectionMessage] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState(new Set());
  const [pausedAt, setPausedAt] = useState(null);
  const [allPlayersReconnectedAt, setAllPlayersReconnectedAt] = useState(null);

  const requestedRef = useRef(false);
  useEffect(() => {
    if (!socket) return;
    if (!connected) return;
    if (!roomId) return;

    // Request latest state only once on mount / when dependencies become ready
    if (!requestedRef.current) {
      socket.emit('requestGameState', roomId);
      requestedRef.current = true;
    }

    const handleGameUpdate = (newGameState) => {
      setGameState(newGameState);
      
      // Check for UNO violation
      if (newGameState.lastUnoViolation && newGameState.lastUnoViolation.violation) {
        setNotification(newGameState.lastUnoViolation.message);
        setTimeout(() => setNotification(''), 5000);
      }
      
      let player = newGameState.players.find(p => p.id === socket.id);
      if (!player && socket.auth?.username) {
        // Fallback by username (in case socket id changed after reconnection)
        player = newGameState.players.find(p => p.name === socket.auth.username);
      }
      if (!player) {
        // Schedule a state re-request to hydrate after potential late join propagation
        setTimeout(() => socket.emit('requestGameState', roomId), 600);
      }
      setCurrentPlayer(player || null);
      if (notification) {
        setTimeout(() => setNotification(''), 3000);
      }
    };

    const handleGameStarted = (newGameState) => {
      setGameState(newGameState);
      let player = newGameState.players.find(p => p.id === socket.id);
      if (!player && socket.auth?.username) {
        player = newGameState.players.find(p => p.name === socket.auth.username);
      }
      if (!player) {
        setTimeout(() => socket.emit('requestGameState', roomId), 600);
      }
      setCurrentPlayer(player || null);
    };

    const handleGameStartedFull = ({ gameState: fullState }) => {
      if (!fullState) return;
      setGameState(fullState);
      let player = fullState.players.find(p => p.id === socket.id);
      if (!player && socket.auth?.username) {
        player = fullState.players.find(p => p.name === socket.auth.username);
      }
      if (!player) {
        setTimeout(() => socket.emit('requestGameState', roomId), 600);
      }
      setCurrentPlayer(player || null);
    };

    const handleGameEnded = ({ winner: gameWinner, gameState: finalState }) => {
      // Extract winner name if winner is an object
      const winnerName = typeof gameWinner === 'object' ? gameWinner.name : gameWinner;
      setWinner(winnerName);
      setGameState(finalState);
    };

    const handleSpecial = (effect) => {
      setNotification(effect.message);
      setTimeout(() => setNotification(''), 3000);
    };

    const handleError = ({ message }) => {
      setError(message);
      setIsDrawing(false);
      setTimeout(() => setError(''), 5000);
    };

    const handlePlayerDisconnect = () => {
      setNotification('A player has disconnected');
      setTimeout(() => setNotification(''), 3000);
    };

    const handleUnoCall = ({ message }) => {
      setNotification(message);
      setTimeout(() => setNotification(''), 3000);
    };

    const handleUnoChallenge = ({ message }) => {
      setNotification(message);
      setTimeout(() => setNotification(''), 5000);
    };

    const handleCustomRuleSet = ({ rule }) => {
      setNotification(`Custom rule set: ${rule}`);
      setTimeout(() => setNotification(''), 5000);
    };

    const handleDrawResult = (result) => {
      setIsDrawing(false);
      if (result.canPlayDrawnCard) {
        setShowPlayDrawnCardOption(true);
        setDrawnCardIndex(result.drawnCardIndex);
        setDrawnCardMessage(result.message);
      } else {
        setNotification(result.message);
        setTimeout(() => setNotification(''), 3000);
      }
    };

    const handleWildDrawFourPlayed = ({ player, card }) => {
      // Show challenge option for 10 seconds
      if (player.id !== socket.id) {
        setLastWildDrawFourPlay({ player, card, timestamp: Date.now() });
        setShowWildDrawFourChallenge(true);
        setChallengeTimeLeft(10);
        
        // Start countdown
        const countdown = setInterval(() => {
          setChallengeTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              setShowWildDrawFourChallenge(false);
              setLastWildDrawFourPlay(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    const handleWildDrawFourChallenge = ({ challengeSuccessful, message, penaltyCards, targetPlayer, challenger }) => {
      setNotification(message);
      setShowWildDrawFourChallenge(false);
      setLastWildDrawFourPlay(null);
      setTimeout(() => setNotification(''), 5000);
    };

    const handlePlayerReconnected = ({ player, gameState: newGameState, message }) => {
      setIsReconnecting(false);
      setReconnectionMessage(message);
      if (newGameState) {
        setGameState(newGameState);
        const playerData = newGameState.players.find(p => p.id === socket.id);
        setCurrentPlayer(playerData);
      }
      setTimeout(() => setReconnectionMessage(''), 5000);
    };

    const handleAllPlayersReconnected = ({ message, pausedAt }) => {
      setNotification(message);
      setAllPlayersReconnectedAt(pausedAt);
      setShowNewGamePrompt(true);
      setTimeout(() => setNotification(''), 3000);
    };

    const handleNewGameStarted = ({ message }) => {
      setNotification(message);
      setShowNewGamePrompt(false);
      setGameState(null);
      setCurrentPlayer(null);
      setTimeout(() => setNotification(''), 3000);
      // Request new game state
      setTimeout(() => socket.emit('requestGameState', roomId), 500);
    };

    const handleGameResumed = ({ message, gameState: resumedState }) => {
      setNotification(message);
      setShowNewGamePrompt(false);
      if (resumedState) {
        setGameState(resumedState);
        const player = resumedState.players.find(p => p.id === socket.id);
        setCurrentPlayer(player);
      }
      setTimeout(() => setNotification(''), 3000);
    };

    socket.on('gameUpdate', handleGameUpdate);
    socket.on('gameStarted', handleGameStarted);
  socket.on('gameStartedFull', handleGameStartedFull);
    socket.on('gameEnded', handleGameEnded);
    socket.on('specialEffect', handleSpecial);
    socket.on('error', handleError);
    socket.on('playerDisconnected', handlePlayerDisconnect);
    socket.on('unoCall', handleUnoCall);
    socket.on('unoChallenge', handleUnoChallenge);
    socket.on('wildDrawFourPlayed', handleWildDrawFourPlayed);
    socket.on('wildDrawFourChallenge', handleWildDrawFourChallenge);
    socket.on('customRuleSet', handleCustomRuleSet);
    socket.on('drawResult', handleDrawResult);
    socket.on('playerReconnected', handlePlayerReconnected);
    socket.on('allPlayersReconnected', handleAllPlayersReconnected);
    socket.on('newGameStarted', handleNewGameStarted);
    socket.on('gameResumed', handleGameResumed);

    return () => {
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('gameStarted', handleGameStarted);
  socket.off('gameStartedFull', handleGameStartedFull);
      socket.off('gameEnded', handleGameEnded);
      socket.off('specialEffect', handleSpecial);
      socket.off('error', handleError);
      socket.off('playerDisconnected', handlePlayerDisconnect);
      socket.off('unoCall', handleUnoCall);
      socket.off('unoChallenge', handleUnoChallenge);
      socket.off('wildDrawFourPlayed', handleWildDrawFourPlayed);
      socket.off('wildDrawFourChallenge', handleWildDrawFourChallenge);
      socket.off('customRuleSet', handleCustomRuleSet);
      socket.off('drawResult', handleDrawResult);
      socket.off('playerReconnected', handlePlayerReconnected);
      socket.off('allPlayersReconnected', handleAllPlayersReconnected);
      socket.off('newGameStarted', handleNewGameStarted);
      socket.off('gameResumed', handleGameResumed);
    };
  }, [socket, connected, roomId, notification]);

  useEffect(() => {
    // If we somehow reached game page without connection, send back
    if (socket && !connected) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [socket, connected, navigate]);

  // Periodically check disconnection status
  useEffect(() => {
    if (!socket || !connected || !gameState?.gameStarted) return;

    const checkDisconnections = () => {
      socket.emit('getDisconnectionInfo', { roomId });
    };

    // Check immediately
    checkDisconnections();

    // Check every 30 seconds
    const interval = setInterval(checkDisconnections, 30000);

    const handleDisconnectionInfo = (info) => {
      if (info.disconnectedCount > 0) {
        setDisconnectedPlayers(new Set(info.disconnectedPlayers.map(p => p.name)));
        
        // Show notification about disconnected players
        const disconnectedNames = info.disconnectedPlayers.map(p => p.name).join(', ');
        if (info.disconnectedCount === 1) {
          setNotification(`${disconnectedNames} is disconnected. Waiting for reconnection...`);
        } else {
          setNotification(`${info.disconnectedCount} players disconnected: ${disconnectedNames}`);
        }
      } else {
        setDisconnectedPlayers(new Set());
      }

      if (info.allPlayersDisconnected && info.pausedAt) {
        setPausedAt(info.pausedAt);
      }
    };

    socket.on('disconnectionInfo', handleDisconnectionInfo);

    return () => {
      clearInterval(interval);
      socket.off('disconnectionInfo', handleDisconnectionInfo);
    };
  }, [socket, connected, gameState?.gameStarted, roomId]);

  const playCard = (cardIndex) => {
    if (!gameState || !currentPlayer) return;
    
    const card = currentPlayer.cards[cardIndex];
    if (!card) return;

    // Check if it's a wild card that needs color selection (official UNO rules only)
    if (card.color === 'wild' && (card.value === 'wild' || card.value === 'draw4')) {
      setPendingWildCard({ card, cardIndex });
      setShowColorPicker(true);
      return;
    }

    // Play regular card
    socket.emit('playCard', { roomId, cardIndex });
  };

  const handleColorSelect = (color) => {
    if (!pendingWildCard) return;
    
    setShowColorPicker(false);
    
    // First play the wild card
    socket.emit('playCard', { roomId, cardIndex: pendingWildCard.cardIndex });
    
    // Then choose the color
    setTimeout(() => {
      socket.emit('chooseColor', { roomId, color });
    }, 100);
    
    setPendingWildCard(null);
  };

  const handleColorCancel = () => {
    setShowColorPicker(false);
    setPendingWildCard(null);
  };

  const drawCard = () => {
    if (!gameState || isDrawing) return;
    
    setIsDrawing(true);
    socket.emit('drawCard', roomId);
    
    // Reset drawing state after a delay
    setTimeout(() => setIsDrawing(false), 1000);
  };

  const leaveGame = () => {
    navigate('/');
  };

  // Handle new game decision
  const handleNewGameDecision = (startNew) => {
    socket.emit('newGameDecision', { roomId, startNew });
    setShowNewGamePrompt(false);
  };

  // Handle playing the drawn card immediately (official UNO rule)
  const playDrawnCard = () => {
    if (drawnCardIndex >= 0 && currentPlayer && currentPlayer.cards[drawnCardIndex]) {
      playCard(drawnCardIndex);
      setShowPlayDrawnCardOption(false);
      setDrawnCardIndex(-1);
      setDrawnCardMessage('');
    }
  };

  // Handle passing on the drawn card (turn ends)
  const passDrawnCard = () => {
    socket.emit('passDrawnCard', roomId);
    setShowPlayDrawnCardOption(false);
    setDrawnCardIndex(-1);
    setDrawnCardMessage('');
  };

  const isMyTurn = () => {
    return gameState && currentPlayer && gameState.currentPlayer && 
           gameState.currentPlayer.id === currentPlayer.id;
  };

  const canPlayAnyCard = () => {
    if (!gameState || !currentPlayer || !isMyTurn()) return false;
    
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    return currentPlayer.cards.some(card => 
      canPlayCard(card, topCard, gameState.currentColor)
    );
  };

  const handleCustomRuleSubmit = () => {
    if (!customRule.trim() || !pendingCustomCard) return;
    
    // Set the custom rule for the card
    socket.emit('setCustomRule', { roomId, rule: customRule.trim() });
    
    // Play the card
    socket.emit('playCard', { roomId, cardIndex: pendingCustomCard.cardIndex });
    
    // Reset state
    setShowCustomRuleDialog(false);
    setCustomRule('');
    setPendingCustomCard(null);
  };

  const handleCustomRuleCancel = () => {
    setShowCustomRuleDialog(false);
    setCustomRule('');
    setPendingCustomCard(null);
  };

  const callUno = () => {
    if (!gameState || !currentPlayer) return;
    socket.emit('callUno', { roomId });
  };

  const challengeUno = (targetPlayerId) => {
    if (!gameState || !currentPlayer) return;
    socket.emit('challengeUno', { roomId, targetPlayerId });
  };

  const challengeWildDrawFour = () => {
    if (!gameState || !currentPlayer || !lastWildDrawFourPlay) return;
    
    // For now, we'll send a simplified challenge without game state storage
    // In a full implementation, we'd need to store the game state before the play
    socket.emit('challengeWildDrawFour', { 
      roomId, 
      targetPlayerId: lastWildDrawFourPlay.player.id,
      lastPlayedCard: lastWildDrawFourPlay.card,
      gameStateBeforePlay: {} // This would need proper implementation
    });
    
    setShowWildDrawFourChallenge(false);
    setLastWildDrawFourPlay(null);
  };

  const canCallUno = () => {
    return currentPlayer && currentPlayer.cardCount === 1 && !currentPlayer.hasCalledUno;
  };

  const canChallengeUno = (player) => {
    return player.cardCount === 1 && !player.hasCalledUno && player.id !== currentPlayer?.id;
  };

  const togglePlayerCards = (playerId) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
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

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <div className="panel-primary panel-glow p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold mb-2">Loading game state...</p>
          <p className="text-white/70 text-sm">If this takes long, the game may not have started yet.</p>
          <button
            onClick={() => socket.emit('requestGameState', roomId)}
            className="btn-primary mt-4 text-sm"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-neutral mt-2 text-xs py-1 px-3"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const otherPlayers = gameState.players.filter(p => p.id !== currentPlayer?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 relative overflow-hidden text-gray-100">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 2px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}></div>
      </div>
      
    {/* Content Container */}
    <div className={`relative z-10 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto border-2 rounded-3xl ${
      gameState.currentColor === 'red' ? 'border-red-500/60' :
      gameState.currentColor === 'blue' ? 'border-blue-500/60' :
      gameState.currentColor === 'green' ? 'border-green-500/60' :
      gameState.currentColor === 'yellow' ? 'border-yellow-500/60' : 'border-gray-500/60'
    } shadow-2xl`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-600/40 rounded-xl p-3 sm:p-4 shadow-lg w-full sm:w-auto">
            <h2 className="text-white font-bold text-lg sm:text-xl flex items-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
              <span className="hidden md:inline">Room: {roomId}</span>
              <span className="md:hidden">🎮</span>
            </h2>
            <p className="text-white/80 text-sm flex items-center gap-2 mt-1">
              Current Color: 
              <span className={`w-6 h-6 rounded-full border-3 ${
                gameState.currentColor === 'red' ? 'border-red-500 bg-red-500/20' :
                gameState.currentColor === 'blue' ? 'border-blue-500 bg-blue-500/20' :
                gameState.currentColor === 'green' ? 'border-green-500 bg-green-500/20' :
                gameState.currentColor === 'yellow' ? 'border-yellow-500 bg-yellow-500/20' : 'border-gray-500 bg-gray-500/20'
              } shadow-lg`}></span>
              <span className="capitalize font-medium">{gameState.currentColor}</span>
            </p>
          </div>
          
          <button
            onClick={leaveGame}
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 w-full sm:w-auto"
          >
            Leave Game
          </button>
        </div>

        {/* Error/Notification */}
        <div className="space-y-3 mb-4">
          {error && (
            <div className="bg-red-900/40 backdrop-blur-sm border border-red-600/40 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-xl">⚠️</span>
                <p className="text-red-100 font-medium">{error}</p>
              </div>
            </div>
          )}

          {reconnectionMessage && (
            <div className="bg-green-900/40 backdrop-blur-sm border border-green-600/40 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-xl">🔄</span>
                <p className="text-green-100 font-medium text-center">{reconnectionMessage}</p>
              </div>
            </div>
          )}
    
          {notification && (
            <div className="bg-blue-900/40 backdrop-blur-sm border border-blue-600/40 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <span className="text-blue-400 text-xl">ℹ️</span>
                <p className="text-blue-100 font-medium text-center">{notification}</p>
              </div>
            </div>
          )}
        </div>

        {/* Voice Chat */}
        <VoiceChat 
          socket={socket}
          roomId={roomId}
          currentUser={currentPlayer}
          isHost={gameState?.host === currentPlayer?.id}
        />

        {/* Other Players */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {otherPlayers.map((player) => (
            <div
              key={player.id}
              className={`bg-slate-800/50 backdrop-blur-md border rounded-xl p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:bg-slate-700/40 ${
                player.isCurrentPlayer 
                  ? 'border-amber-400/60 ring-2 ring-amber-400/30 bg-amber-500/10' 
                  : 'border-slate-600/40'
              } ${
                player.isConnected === false 
                  ? 'opacity-60 grayscale border-red-500/30' 
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  {player.isCurrentPlayer && (
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                  )}
                  {player.name}
                </h3>
                <div className="flex items-center gap-2">
                  {player.isCurrentPlayer && (
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full font-medium">
                      🎯 Turn
                    </span>
                  )}
                  {player.isConnected === false && player.id !== currentPlayer?.id && (
                    <span className="bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded-full font-medium">
                      🔌 Disconnected
                    </span>
                  )}
                  {player.hasCalledUno && (
                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full font-bold">
                      UNO!
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="flex gap-1 flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => togglePlayerCards(player.id)}
                    title="Click to expand/collapse cards"
                  >
                    {expandedPlayers.has(player.id) ? (
                      // Show actual cards when expanded
                      <>
                        {Array.from({ length: Math.min(player.cardCount, 8) }).map((_, i) => (
                          <Card key={i} card={{}} isBack={true} size="small" />
                        ))}
                        {player.cardCount > 8 && (
                          <span className="text-white/60 text-xs ml-1 self-center">
                            +{player.cardCount - 8}
                          </span>
                        )}
                      </>
                    ) : (
                      // Show only card count when collapsed
                      <div className="bg-slate-700/60 border border-slate-600/40 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-white/90 font-medium">{player.cardCount}</span>
                        <span className="text-white/60 text-xs">cards</span>
                        <span className="text-white/40 text-xs">👆</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {canChallengeUno(player) && (
                  <button
                    onClick={() => challengeUno(player.id)}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-3 rounded-lg transition-all duration-200 hover:scale-105"
                    title="Challenge UNO!"
                  >
                    Challenge
                  </button>
                )}
              </div>
              
              <div className="flex justify-end items-center text-sm">
                <span className="text-white/60">
                  Score: {player.score || 0}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Game Board */}
  <div className={`flex flex-col items-center mb-8 p-4 sm:p-6 rounded-2xl border-2 ${
    gameState.currentColor === 'red' ? 'border-red-500/40 bg-red-500/5' :
    gameState.currentColor === 'blue' ? 'border-blue-500/40 bg-blue-500/5' :
    gameState.currentColor === 'green' ? 'border-green-500/40 bg-green-500/5' :
    gameState.currentColor === 'yellow' ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-gray-500/40 bg-gray-500/5'
  } backdrop-blur-sm`}>
          {/* Deck and Discard Pile */}
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12 mb-6 w-full">
            {/* Draw Pile */}
            <div className="text-center group">
              <p className="text-white/80 text-sm mb-3 font-medium">Draw Pile</p>
              <div className="relative">
                <Card 
                  card={{}} 
                  isBack={true} 
                  size="xlarge" 
                  onClick={drawCard} 
                  disabled={!isMyTurn() || (canPlayAnyCard() && gameState.drawCount === 0) || isDrawing}
                  className="group-hover:scale-105 transition-transform duration-200"
                />
                {gameState.deckCount > 0 && (
                  <span className="absolute -top-3 -right-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg">
                    {gameState.deckCount}
                  </span>
                )}
                {isDrawing && (
                  <div className="absolute inset-0 bg-white/20 rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              {isMyTurn() && (!canPlayAnyCard() || gameState.drawCount > 0) && (
                <p className="text-yellow-300 text-sm mt-2 animate-pulse font-medium">
                  👆 Click to draw
                </p>
              )}
            </div>

            {/* VS Indicator */}
            <div className="hidden sm:flex items-center justify-center">
              <span className="text-white/60 text-lg font-bold">VS</span>
            </div>

            {/* Discard Pile */}
            <div className="text-center">
              <p className="text-white/80 text-sm mb-3 font-medium">Discard Pile</p>
              <div className="relative">
                <Card card={topCard} size="xlarge" disabled={true} className="shadow-xl" />
                {gameState.waitingForColorChoice && isMyTurn() && (
                  <div className="absolute inset-0 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                    <p className="text-yellow-200 text-sm font-bold animate-pulse">Choose Color</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Turn Indicator & Game Status */}
          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-600/40 rounded-xl p-4 shadow-lg max-w-md w-full text-center">
            {disconnectedPlayers.size > 0 ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></span>
                <p className="text-red-300 font-bold text-lg">⏸️ Game Paused</p>
              </div>
            ) : isMyTurn() ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                <p className="text-green-300 font-bold text-lg">🎯 Your Turn!</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></span>
                <p className="text-white font-medium">
                  Waiting for <span className="text-blue-300 font-bold">{gameState.currentPlayer?.name}</span>...
                </p>
              </div>
            )}
            {disconnectedPlayers.size > 0 && (
              <div className="mt-2 bg-orange-500/20 border border-orange-500/30 rounded-lg p-2">
                <p className="text-orange-300 text-sm font-medium">
                  🔌 Waiting for {disconnectedPlayers.size} player{disconnectedPlayers.size > 1 ? 's' : ''} to reconnect
                </p>
              </div>
            )}
            {gameState.drawCount > 0 && (
              <div className="mt-2 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                <p className="text-red-300 text-sm font-medium">
                  ⚠️ Next player must draw {gameState.drawCount} cards
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Player's Hand */}
        {!currentPlayer && (
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-600/40 rounded-xl p-4 sm:p-6 shadow-lg mb-6 text-center animate-pulse">
            <p className="text-slate-300 text-sm">Syncing your cards...</p>
          </div>
        )}
        {currentPlayer && (
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-600/40 rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="text-blue-400">🎴</span>
                Your Cards 
                <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-sm">
                  {currentPlayer.cards.length}
                </span>
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full">
                  Score: {currentPlayer.score || 0}
                </span>
                {canCallUno() && (
                  <button
                    onClick={callUno}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-sm py-2 px-4 rounded-lg font-bold animate-pulse transition-all duration-200 hover:scale-105 shadow-lg"
                    title="Call UNO!"
                  >
                    🚨 UNO!
                  </button>
                )}
                {currentPlayer.hasCalledUno && (
                  <span className="bg-blue-500/20 text-blue-300 text-sm font-bold px-3 py-1 rounded-full">
                    UNO Called! ✓
                  </span>
                )}
              </div>
            </div>
            
            <div className="w-full">
              {/* Mobile: 3x3 grid, Tablet and up: responsive grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 gap-2 sm:gap-3 justify-items-center">
              {currentPlayer.cards.map((card, index) => {
                const myTurn = isMyTurn();
                const waitingForColor = gameState.waitingForColorChoice;
                const drawPenalty = gameState.drawCount > 0;
                const canPlay = myTurn && !waitingForColor && !drawPenalty && 
                              canPlayCard(card, topCard, gameState.currentColor);
                
                return (
                  <Card
                    key={index}
                    card={card}
                    onClick={() => playCard(index)}
                    disabled={!canPlay}
                    className={`transition-all duration-200 ${
                      canPlay 
                        ? 'ring-2 ring-green-400 hover:ring-green-300 hover:scale-110 hover:shadow-xl cursor-pointer' 
                        : 'opacity-60 hover:opacity-80'
                    }`}
                  />
                );
              })}
              </div>
            </div>
            
            {/* UNO Warnings */}
            {currentPlayer.cards.length === 1 && !currentPlayer.hasCalledUno && (
              <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center animate-pulse">
                <p className="text-red-300 font-bold text-lg">
                  ⚠️ Don't forget to call UNO! ⚠️
                </p>
              </div>
            )}
            
            {currentPlayer.cards.length === 1 && currentPlayer.hasCalledUno && (
              <div className="mt-4 bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                <p className="text-blue-300 font-bold text-lg">
                  🎯 UNO! One card left! 🎯
                </p>
              </div>
            )}
          </div>
        )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPicker
          onColorSelect={handleColorSelect}
          onCancel={handleColorCancel}
        />
      )}

      {showCustomRuleDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/70 shadow-2xl rounded-xl max-w-md w-full mx-auto p-6 animate-in fade-in duration-200">
            <h3 className="text-2xl font-bold mb-3 text-slate-100 tracking-tight">Set Custom Rule</h3>
            <p className="text-slate-300 mb-4 text-sm leading-relaxed">
              Define a custom rule for this Wild Customizable card:
            </p>
            <textarea
              value={customRule}
              onChange={(e) => setCustomRule(e.target.value)}
              placeholder="Enter your custom rule (e.g., Next player must draw 2 cards and sing a song)"
              className="w-full p-3 border border-slate-600 bg-slate-800/70 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 outline-none rounded-lg mb-5 h-28 resize-none text-slate-100 placeholder-slate-500 text-sm"
              maxLength={200}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCustomRuleSubmit}
                disabled={!customRule.trim()}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed font-medium shadow-lg shadow-indigo-900/30 text-sm"
              >
                Set Rule & Play Card
              </button>
              <button
                onClick={handleCustomRuleCancel}
                className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 text-sm"
              >
                Cancel
              </button>
            </div>
        </div>
        </div>
      )}

      {/* Play Drawn Card Modal (Official UNO Rule) */}
      {showPlayDrawnCardOption && currentPlayer && drawnCardIndex >= 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-6 max-w-md mx-auto w-full shadow-2xl animate-in fade-in duration-200">
            <h2 className="text-2xl font-bold mb-4 text-slate-100 tracking-tight">Card Drawn!</h2>
            <p className="mb-5 text-slate-300 text-sm leading-relaxed">{drawnCardMessage}</p>
            
            {/* Show the drawn card */}
            <div className="flex justify-center mb-6">
              <Card 
                card={currentPlayer.cards[drawnCardIndex]} 
                size="large"
                className="mx-2 shadow-xl"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={playDrawnCard}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-emerald-900/30 text-sm"
              >
                Play Card
              </button>
              <button
                onClick={passDrawnCard}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                Keep Card & End Turn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Game Prompt Modal (All Players Reconnected) */}
      {showNewGamePrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/70 rounded-xl p-6 max-w-md mx-auto w-full shadow-2xl animate-in fade-in duration-200">
            <h2 className="text-2xl font-bold mb-4 text-slate-100 tracking-tight text-center">🎉 All Players Back!</h2>
            <p className="text-slate-300 mb-6 text-sm leading-relaxed text-center">
              All players have reconnected! Would you like to continue your previous game or start a fresh new game?
            </p>
            
            {allPlayersReconnectedAt && (
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-6">
                <p className="text-blue-300 text-xs text-center">
                  ⏰ Game was paused at: {new Date(allPlayersReconnectedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleNewGameDecision(false)}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-3 px-4 rounded-lg transition-all shadow-lg shadow-green-900/30 text-sm"
              >
                Continue Previous Game
              </button>
              <button
                onClick={() => handleNewGameDecision(true)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 px-4 rounded-lg transition-all shadow-lg shadow-blue-900/30 text-sm"
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wild Draw Four Challenge Modal */}
      {showWildDrawFourChallenge && lastWildDrawFourPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-500/50 rounded-xl p-6 max-w-md mx-auto w-full shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-2xl font-bold mb-3 text-red-400 tracking-tight flex items-center gap-2">
              ⚠️ Wild Draw Four Challenge
            </h3>
            <p className="text-slate-300 mb-4 text-sm leading-relaxed">
              <span className="font-medium text-white">{lastWildDrawFourPlay.player.name}</span> played a Wild Draw Four card.
              <br />
              <br />
              Do you think they had other playable cards? Challenge them now!
            </p>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-xs">
                <strong>Challenge Rules:</strong>
                <br />• If successful: They draw 4 cards instead of you
                <br />• If failed: You draw 6 cards (4 + 2 penalty)
                <br />• Time left: <span className="font-bold">{challengeTimeLeft}s</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={challengeWildDrawFour}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg hover:from-red-500 hover:to-red-600 font-medium shadow-lg shadow-red-900/30 text-sm transition-all"
              >
                🚫 Challenge!
              </button>
              <button
                onClick={() => {
                  setShowWildDrawFourChallenge(false);
                  setLastWildDrawFourPlay(null);
                }}
                className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg hover:bg-slate-600 text-sm transition-all"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {winner && (
        <WinnerModal
          isOpen={true}
          winner={winner}
          onClose={() => setWinner(null)}
        />
      )}
      </div>{/* end content container */}
    </div>
  );
};

export default Game;