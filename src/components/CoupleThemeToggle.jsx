import React from 'react';

const CoupleThemeToggle = ({ coupleTheme, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`rounded-full p-3 text-white transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        coupleTheme 
          ? 'bg-pink-600 hover:bg-pink-500 focus:ring-pink-300' 
          : 'bg-rose-500 hover:bg-rose-400 focus:ring-rose-300'
      }`}
      title={coupleTheme ? 'Disable couple theme' : 'Enable couple theme'}
    >
      <span className="text-lg">
        {coupleTheme ? '💖' : '❤️'}
      </span>
    </button>
  );
};

export default CoupleThemeToggle;