import React from 'react';

const FloatingMuteButton = ({ isMuted, onToggleMute, isVoiceActive }) => {
  if (!isVoiceActive) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onToggleMute}
        className={`p-4 rounded-full shadow-2xl border-2 transition-all duration-200 hover:scale-110 active:scale-95 ${
          isMuted 
            ? 'bg-red-600 border-red-500 hover:bg-red-700 text-white' 
            : 'bg-green-600 border-green-500 hover:bg-green-700 text-white'
        }`}
        title={isMuted ? 'Unmute (You are muted)' : 'Mute microphone'}
      >
        <span className="text-2xl">{isMuted ? '🚫' : '🎤'}</span>
      </button>
      
      {/* Mute status indicator */}
      {isMuted && (
        <div className="absolute -top-2 -left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          MUTED
        </div>
      )}
    </div>
  );
};

export default FloatingMuteButton;