import React, { useState, useEffect, useRef } from 'react';
import FloatingMuteButton from './FloatingMuteButton';

const VoiceChat = ({ socket, roomId, currentUser, isHost }) => {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(true); // Auto-start active
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted by default like BGMI
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [audioSettings, setAudioSettings] = useState({
    audioQuality: 'medium',
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [levels, setLevels] = useState({}); // userId -> 0..1
  const [speaking, setSpeaking] = useState({}); // userId -> boolean
  const audioContextRef = useRef(null);
  const analyserNodesRef = useRef({}); // userId -> analyser
  const levelRafRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const [peerStats, setPeerStats] = useState({}); // peerId -> { rtt, quality }
  const [miniMode, setMiniMode] = useState(false);

  // Watchdog: if after 5s still disconnected (and not currently connecting), force a retry once
  useEffect(() => {
    if (!socket || !roomId) return;
    if (isJoined) return;
    const timer = setTimeout(() => {
      if (!isJoined && ['disconnected','error'].includes(connectionStatus)) {
        setRetryCount(rc => rc + 1);
        joinVoiceChat(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [socket, roomId, isJoined, connectionStatus]);
  
  const localAudioRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const sessionId = useRef(null);
  
  useEffect(() => {
    if (!socket) return;
    
    // Voice chat event listeners
    socket.on('voiceChatStarted', handleVoiceChatStarted);
    socket.on('voiceChatJoined', handleVoiceChatJoined);
    socket.on('voiceChatLeft', handleVoiceChatLeft);
    socket.on('voiceChatError', handleVoiceChatError);
    socket.on('participantJoined', handleParticipantJoined);
    socket.on('participantLeft', handleParticipantLeft);
    socket.on('participantMuteChanged', handleParticipantMuteChanged);
    socket.on('voiceSignal', handleVoiceSignal);
    socket.on('voiceSettingsUpdated', handleSettingsUpdated);
    
    // Auto-join trigger from server
    socket.on('autoJoinVoiceChat', ({ roomId: serverRoomId }) => {
      if (serverRoomId === roomId && !isJoined && !autoJoinAttempted) {
        setAutoJoinAttempted(true);
        setTimeout(() => joinVoiceChat(), 500);
      }
    });
    
    return () => {
      socket.off('voiceChatStarted', handleVoiceChatStarted);
      socket.off('voiceChatJoined', handleVoiceChatJoined);
      socket.off('voiceChatLeft', handleVoiceChatLeft);
      socket.off('voiceChatError', handleVoiceChatError);
      socket.off('participantJoined', handleParticipantJoined);
      socket.off('participantLeft', handleParticipantLeft);
      socket.off('participantMuteChanged', handleParticipantMuteChanged);
      socket.off('voiceSignal', handleVoiceSignal);
      socket.off('voiceSettingsUpdated', handleSettingsUpdated);
      socket.off('autoJoinVoiceChat');
    };
  }, [socket, roomId, isJoined, autoJoinAttempted]);

  // Auto-join voice chat when component mounts (BGMI style)
  useEffect(() => {
    if (socket && roomId && currentUser && !autoJoinAttempted) {
      setAutoJoinAttempted(true);
      
      // Small delay to ensure room is properly initialized
      setTimeout(() => {
        // Always try to join voice chat directly (like BGMI)
        joinVoiceChat();
      }, 1500);
    }
  }, [socket, roomId, currentUser, autoJoinAttempted]);
  
  const handleVoiceChatStarted = ({ sessionId: newSessionId, host, settings }) => {
    setIsVoiceChatActive(true);
    sessionId.current = newSessionId;
    setAudioSettings(prev => ({ ...prev, ...settings }));
  };
  
  const handleVoiceChatJoined = ({ sessionId: newSessionId, peerId, sessionInfo }) => {
    setIsJoined(true);
    sessionId.current = newSessionId;
    setConnectionStatus('connected');
    if (sessionInfo?.participants) {
      setParticipants(sessionInfo.participants);
    }
  };
  
  const handleVoiceChatLeft = () => {
    setIsJoined(false);
    setConnectionStatus('disconnected');
    cleanupLocalStream();
    cleanupPeers();
  };
  
  const handleVoiceChatError = ({ message }) => {
    console.error('Voice chat error:', message);
    if (message === 'No active voice chat session for this room') {
      // Fast retry after short delay without consuming main retry budget excessively
      setTimeout(() => joinVoiceChat(true), 300);
      setConnectionStatus('reconnecting');
      return;
    }
    if (retryCount < maxRetries) {
      const delay = 1000 * (retryCount + 1);
      setTimeout(() => {
        setRetryCount(rc => rc + 1);
        joinVoiceChat(true);
      }, delay);
      setConnectionStatus('reconnecting');
    } else {
      setConnectionStatus('error');
    }
  };
  
  const handleParticipantJoined = ({ userId, username, peerId }) => {
    setParticipants(prev => [
      ...prev.filter(p => p.userId !== userId),
      { userId, username, peerId, isMuted: false, isConnected: true }
    ]);
    // Prepare level placeholders
    setLevels(l => ({ ...l, [userId]: 0 }));
  };
  
  const handleParticipantLeft = ({ userId, username }) => {
    setParticipants(prev => prev.filter(p => p.userId !== userId));
    if (peersRef.current[userId]) {
      peersRef.current[userId].close();
      delete peersRef.current[userId];
    }
    delete analyserNodesRef.current[userId];
    setLevels(l => { const c = { ...l }; delete c[userId]; return c; });
    setSpeaking(s => { const c = { ...s }; delete c[userId]; return c; });
  };
  
  const handleParticipantMuteChanged = ({ userId, username, isMuted }) => {
    setParticipants(prev => prev.map(p => 
      p.userId === userId ? { ...p, isMuted } : p
    ));
  };
  
  const handleVoiceSignal = async ({ from, signal, sessionId: signalSessionId }) => {
    if (sessionId.current !== signalSessionId) return;
    
    try {
      const peer = peersRef.current[from];
      if (!peer) {
        // Create new peer connection
        const newPeer = createPeerConnection(from);
        peersRef.current[from] = newPeer;
        
        if (signal.type === 'offer') {
          await newPeer.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await newPeer.createAnswer();
          await newPeer.setLocalDescription(answer);
          
          socket.emit('voiceSignaling', {
            roomId,
            targetPeerId: from,
            signal: answer
          });
        }
      } else {
        if (signal.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(signal));
        }
      }
    } catch (error) {
      console.error('Voice signaling error:', error);
    }
  };
  
  const handleSettingsUpdated = ({ settings, updatedBy }) => {
    setAudioSettings(prev => ({ ...prev, ...settings }));
  };
  
  const createPeerConnection = (peerId) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    
    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const audioElement = document.getElementById(`audio-${peerId}`);
      if (audioElement) {
        audioElement.srcObject = remoteStream;
      }
      attachAnalyser(peerId, remoteStream);
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voiceSignaling', {
          roomId,
          targetPeerId: peerId,
          signal: event.candidate
        });
      }
    };
    
    return peerConnection;
  };
  
  const startVoiceChat = async () => {
    try {
      socket.emit('startVoiceChat', { roomId, settings: audioSettings });
    } catch (error) {
      console.error('Start voice chat error:', error);
    }
  };
  
  const joinVoiceChat = async (isRetry = false) => {
    try {
      setConnectionStatus(isRetry ? 'reconnecting' : 'connecting');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: audioSettings.echoCancellation,
          noiseSuppression: audioSettings.noiseSuppression,
          autoGainControl: audioSettings.autoGainControl
        }
      });
      
      localStreamRef.current = stream;
  // Initialize audio context & analyser for local stream
  attachAnalyser('you', stream);
      
      // Start muted like BGMI
      stream.getAudioTracks().forEach(track => {
        track.enabled = false; // Start muted
      });
      
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = true; // Prevent feedback
      }
      
      socket.emit('joinVoiceChat', { roomId });
      
    } catch (error) {
      console.error('Join voice chat error:', error);
      if (!isRetry && retryCount < maxRetries) {
        setRetryCount(rc => rc + 1);
        setTimeout(() => joinVoiceChat(true), 1000);
        setConnectionStatus('reconnecting');
      } else {
        setConnectionStatus('error');
      }
      // If microphone access denied, still allow joining but show warning
      if (error.name === 'NotAllowedError') {
        setConnectionStatus('connected');
        setIsJoined(true);
        console.log('Microphone access denied, joined in listen-only mode');
      }
    }
  };
  
  const leaveVoiceChat = () => {
    socket.emit('leaveVoiceChat', { roomId });
    cleanupLocalStream();
    cleanupPeers();
  };
  
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
    }
    
    socket.emit('toggleMute', { roomId, isMuted: newMutedState });
  };
  
  const toggleDeafen = () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    
    // Mute all remote audio elements
    participants.forEach(participant => {
      const audioElement = document.getElementById(`audio-${participant.peerId}`);
      if (audioElement) {
        audioElement.muted = newDeafenedState;
      }
    });
    
    socket.emit('toggleDeafen', { roomId, isDeafened: newDeafenedState });
  };
  
  const cleanupLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      // Don't close context to allow reuse, just leave
    }
  };
  
  const cleanupPeers = () => {
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};
    analyserNodesRef.current = {};
    cancelAnimationFrame(levelRafRef.current);
  };

  // Attach analyser to a stream (first audio track)
  const attachAnalyser = (id, stream) => {
    try {
      if (!stream) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodesRef.current[id] = analyser;
      if (!levelRafRef.current) startLevelLoop();
    } catch (e) {
      console.log('attachAnalyser error', e.message);
    }
  };

  const startLevelLoop = () => {
    const loop = () => {
      const newLevels = {};
      const newSpeaking = {};
      Object.entries(analyserNodesRef.current).forEach(([id, analyser]) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255; // 0..1
        newLevels[id] = avg;
        newSpeaking[id] = avg > 0.15; // threshold
      });
      setLevels(prev => ({ ...prev, ...newLevels }));
      setSpeaking(prev => ({ ...prev, ...newSpeaking }));
      levelRafRef.current = requestAnimationFrame(loop);
    };
    levelRafRef.current = requestAnimationFrame(loop);
  };

  // Periodic stats collection (RTT) for quality badge
  useEffect(() => {
    if (!isJoined) return;
    if (statsIntervalRef.current) return;
    statsIntervalRef.current = setInterval(async () => {
      const updates = {};
      // Iterate peers
      for (const [userId, peer] of Object.entries(peersRef.current)) {
        if (peer.getStats) {
          try {
            const stats = await peer.getStats();
            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                const rttMs = Math.round(report.currentRoundTripTime * 1000);
                let quality = 'GOOD';
                if (rttMs > 350) quality = 'POOR'; else if (rttMs > 180) quality = 'FAIR';
                updates[userId] = { rtt: rttMs, quality };
              }
            });
          } catch {}
        }
      }
      if (Object.keys(updates).length) {
        setPeerStats(prev => ({ ...prev, ...updates }));
      }
    }, 3000);
    return () => {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    };
  }, [isJoined]);
  
  return (
    <>
      {/* BGMI Style Floating Mute Button */}
      <FloatingMuteButton 
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isVoiceActive={isJoined}
      />
      
      {/* Mini Overlay Toggle Button */}
      {isJoined && (
        <button
          onClick={() => setMiniMode(m => !m)}
          className={`fixed z-40 bottom-4 right-4 md:right-6 md:bottom-6 rounded-full shadow-lg text-white text-xs font-medium transition-all duration-200 px-3 py-2 flex items-center gap-1
            ${miniMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700/80 hover:bg-gray-600'}`}
          title={miniMode ? 'Expand voice panel' : 'Collapse to mini view'}
        >
          {miniMode ? '🔊 Open' : '🔽 Mini'}
        </button>
      )}

      {/* Mini Overlay Panel */}
      {miniMode && (
        <div className="fixed z-30 bottom-20 right-4 md:right-6 w-56 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl p-3 shadow-2xl text-xs text-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              🔊 <span>Voice</span>
              {connectionStatus === 'connecting' && <span className="text-yellow-400 animate-pulse ml-1">…</span>}
              {connectionStatus === 'reconnecting' && <span className="text-yellow-400 animate-pulse ml-1">↻</span>}
              {connectionStatus === 'error' && <span className="text-red-400 ml-1">⚠</span>}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/70">
              {1 + participants.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 py-1 rounded-md text-center font-semibold transition-colors ${isMuted ? 'bg-red-600/70 hover:bg-red-600' : 'bg-green-600/70 hover:bg-green-600'}`}
            >
              {isMuted ? '🚫 Mic' : '🎤 Live'}
            </button>
            <button
              onClick={toggleDeafen}
              className={`flex-1 py-1 rounded-md text-center font-semibold transition-colors ${isDeafened ? 'bg-red-600/70 hover:bg-red-600' : 'bg-gray-600/70 hover:bg-gray-600'}`}
            >
              {isDeafened ? '🔇 Out' : '🔊 In'}
            </button>
          </div>
          {/* Top two active speakers (excluding self if muted) */}
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
            {(() => {
              const youEntry = {
                userId: 'you',
                username: currentUser?.name || 'You',
                level: levels['you'] || 0,
                speaking: speaking['you'] && !isMuted,
                isSelf: true,
                isHost,
                isMuted,
                quality: peerStats['you']?.quality,
                rtt: peerStats['you']?.rtt
              };
              const decorated = participants.map(p => ({
                ...p,
                level: levels[p.peerId] || levels[p.userId] || 0,
                speaking: (speaking[p.peerId] || speaking[p.userId]) && !p.isMuted,
                quality: peerStats[p.userId]?.quality,
                rtt: peerStats[p.userId]?.rtt
              }));
              const ordered = [youEntry, ...decorated].sort((a,b) => {
                if (a.speaking && !b.speaking) return -1;
                if (b.speaking && !a.speaking) return 1;
                if (b.level !== a.level) return b.level - a.level;
                return a.username.localeCompare(b.username);
              }).slice(0,5);
              return ordered.map(p => (
                <div key={p.userId+ '-mini'} className="flex items-center gap-2 bg-gray-800/70 rounded-md px-2 py-1 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 bg-green-500/25 transition-all duration-150" style={{ width: `${Math.min(100,(p.level||0)*100)}%`}} />
                  <span className={`relative text-[11px] ${p.isSelf ? 'text-blue-300 font-medium' : 'text-gray-200'}`}>{p.isSelf ? 'You' : p.username}</span>
                  {p.isHost && <span className="relative text-[9px] bg-purple-600/40 text-purple-200 px-1 rounded">H</span>}
                  {p.isMuted && <span className="relative text-[11px] text-red-400">🚫</span>}
                  {p.speaking && !p.isMuted && <span className="relative text-[11px] text-green-300">💬</span>}
                  {p.rtt && <span className={`relative ml-auto text-[9px] px-1 rounded ${p.quality==='POOR'?'bg-red-600/40 text-red-200':p.quality==='FAIR'?'bg-yellow-600/40 text-yellow-100':'bg-green-600/40 text-green-100'}`}>{p.rtt}ms</span>}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Full Panel (hidden when mini) */}
      {!miniMode && (
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-lg p-3 mb-4 shadow-lg">
      {/* BGMI Style Header with Auto-Join Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className={`mr-2 text-lg ${isJoined ? 'text-green-400' : 'text-blue-400'}`}>🔊</span>
          <span className="text-white font-medium text-sm">Voice Chat</span>
          {isJoined && (
            <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
              CONNECTED
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="ml-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">
              CONNECTING...
            </span>
          )}
        </div>

        {/* BGMI Style Quick Controls */}
        <div className="flex items-center space-x-2">
          {isJoined && (
            <>
              {/* Main Mute Button - BGMI Style */}
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full border-2 transition-all duration-200 ${
                  isMuted 
                    ? 'bg-red-600 border-red-500 hover:bg-red-700 text-white' 
                    : 'bg-green-600 border-green-500 hover:bg-green-700 text-white'
                }`}
                title={isMuted ? 'Unmute (You are muted)' : 'Mute'}
              >
                <span className="text-lg">{isMuted ? '🚫' : '🎤'}</span>
              </button>

              {/* Speaker Control */}
              <button
                onClick={toggleDeafen}
                className={`p-2 rounded-md ${
                  isDeafened 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
              >
                <span className="text-lg">{isDeafened ? '🔇' : '🔊'}</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Voice Chat Status Message - BGMI Style */}
      {!isJoined && !['connecting','reconnecting'].includes(connectionStatus) && (
        <div className="bg-gray-700 p-2 rounded text-center mb-3">
          <span className="text-gray-300 text-sm">
            {connectionStatus === 'error' ? 
              '⚠️ Microphone access required for voice chat' : 
              (connectionStatus === 'reconnecting' ? '🔁 Reconnecting to voice chat...' : '🎤 Voice chat connecting automatically...')}
          </span>
        </div>
      )}

      {/* Mute Status Reminder - BGMI Style */}
      {isJoined && isMuted && (
        <div className="bg-yellow-600/20 border border-yellow-600/40 p-2 rounded text-center mb-3">
          <span className="text-yellow-200 text-sm flex items-center justify-center">
            <span className="mr-1">🚫</span>
            You are muted - Click mic button to unmute
          </span>
        </div>
      )}

      {/* Participants List (dynamic ordering: speaking first) */}
      {isJoined && !miniMode && (
        <div className="bg-gray-700/50 p-2 rounded">
          <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
            <span>In Voice Chat ({1 + participants.length})</span>
          </div>
          {(() => {
            // Build unified list including current user (synthetic entry)
            const youEntry = {
              userId: 'you',
              username: currentUser?.name || 'You',
              isMuted,
              isConnected: true,
              isSelf: true,
              isHost: isHost,
              level: levels['you'] || 0,
              speaking: speaking['you'] || false,
              rtt: peerStats['you']?.rtt,
              quality: peerStats['you']?.quality
            };
            // Filter out any participant entries matching current user username to avoid duplication
            const filtered = participants.filter(p => p.username !== youEntry.username);
            // Attempt to detect host among participants by name match (best-effort)
            const decorated = filtered.map(p => ({
              ...p,
              isHost: p.username === (currentUser?.name) && isHost ? true : false,
              level: levels[p.peerId] || levels[p.userId] || 0,
              speaking: speaking[p.peerId] || speaking[p.userId] || false,
              rtt: peerStats[p.userId]?.rtt,
              quality: peerStats[p.userId]?.quality
            }));
            // Sorting rules: active speakers (not muted) first by level desc, then host, then self fallback, then alphabetical
            const ordered = [youEntry, ...decorated].sort((a,b) => {
              // Speaking priority (exclude muted)
              if (a.speaking && !a.isMuted && !(b.speaking && !b.isMuted)) return -1;
              if (b.speaking && !b.isMuted && !(a.speaking && !a.isMuted)) return 1;
              // Host priority (after speaking)
              if (a.isHost && !b.isHost) return -1;
              if (b.isHost && !a.isHost) return 1;
              // Self priority (keep you near top if neutral)
              if (a.isSelf && !b.isSelf) return -1;
              if (b.isSelf && !a.isSelf) return 1;
              // Level secondary
              if (b.level !== a.level) return b.level - a.level;
              return a.username.localeCompare(b.username);
            });
            return (
              <div className="flex flex-wrap gap-2">
                {ordered.map(p => (
                  <div key={p.userId} className={`flex items-center bg-gray-600 px-2 py-1 rounded text-xs relative overflow-hidden ${p.isSelf ? 'ring-1 ring-blue-400/40' : ''}`}>
                    {/* Level bar background */}
                    <div className="absolute left-0 top-0 bottom-0 bg-green-500/20 transition-all duration-150" style={{ width: `${Math.min(100, (p.level||0)*100)}%` }} />
                    <span className={`relative ${p.isSelf ? 'text-blue-300 font-medium' : 'text-white'}`}>
                      {p.isSelf ? 'You' : p.username}
                    </span>
                    {p.isHost && (
                      <span className="relative ml-1 px-1 rounded bg-purple-600/40 text-purple-200 text-[10px] tracking-wide">HOST</span>
                    )}
                    {p.speaking && !p.isMuted && (
                      <span className="relative ml-1 text-green-300">💬</span>
                    )}
                    {p.isMuted && <span className="relative ml-1 text-red-400">🚫</span>}
                    {p.rtt && (
                      <span className={`relative ml-1 px-1 rounded text-[10px] ${p.quality==='POOR' ? 'bg-red-600/40 text-red-300' : p.quality==='FAIR' ? 'bg-yellow-600/40 text-yellow-200' : 'bg-green-600/30 text-green-200'}`}>{p.rtt}ms</span>
                    )}
                    <span className={`relative ml-1 w-2 h-2 rounded-full ${p.isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Local Audio Element (hidden) */}
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      
      {/* Remote Audio Elements (hidden) */}
      {participants.map(participant => (
        <audio 
          key={participant.peerId}
          id={`audio-${participant.peerId}`}
          autoPlay 
          playsInline
          style={{ display: 'none' }}
        />
      ))}
    </div>) }
    </>
  );
};

export default VoiceChat;