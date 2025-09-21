import React from 'react';
import { useNavigate } from 'react-router-dom';

function WinnerModal({ isOpen, winner, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handlePlayAgain = () => {
    onClose();
    // Reset game state here if needed
  };

  const handleBackToLobby = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel-accent panel-glow p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-accent-primary mb-2">
            🎉 Game Over! 🎉
          </h2>
          <p className="text-xl text-accent-secondary">
            {winner} wins!
          </p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={handlePlayAgain}
            className="btn-accent w-full"
          >
            Play Again
          </button>
          <button 
            onClick={handleBackToLobby}
            className="btn-secondary w-full"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinnerModal;