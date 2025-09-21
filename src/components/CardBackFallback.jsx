// Simple card back fallback component
import React from 'react';

const CardBackFallback = ({ className = '' }) => (
  <div className={`w-full h-full bg-red-800 border-2 border-yellow-400 rounded-lg flex flex-col items-center justify-center text-white ${className}`}>
    <div className="text-2xl mb-1">🎴</div>
    <div className="text-xs font-bold">UNO</div>
    <div className="text-xs mt-1 opacity-75">GAME</div>
  </div>
);

export default CardBackFallback;