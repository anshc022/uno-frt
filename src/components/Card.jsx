import React, { useState } from 'react';
import { getCardDisplay, getCardColorClass } from '../utils/cardUtils';
import { getCardImagePath, createPlaceholderImage } from '../utils/cardImageUtils';
import CardBackFallback from './CardBackFallback';

const Card = ({ 
  card, 
  onClick, 
  disabled = false, 
  isBack = false, 
  size = 'normal',
  className = '' 
}) => {
  const [imageError, setImageError] = useState(false);
  const [placeholderDataUrl, setPlaceholderDataUrl] = useState('');

  const sizeClasses = {
    small: 'w-10 h-14 text-xs',
    normal: 'w-16 h-24 sm:w-20 sm:h-28 text-sm sm:text-base',
    large: 'w-20 h-28 sm:w-24 sm:h-32 text-base sm:text-lg',
    xlarge: 'w-24 h-32 sm:w-28 sm:h-36 text-lg sm:text-xl'
  };

  // Add null check for card data
  if (!card && !isBack) {
    console.warn('Card component rendered without card data');
    return (
      <div className={`
        card-image ${sizeClasses[size]} 
        ${disabled ? 'card-disabled' : ''} 
        ${className}
        bg-gray-300 border-2 border-dashed border-gray-500 flex items-center justify-center
      `}>
        <span className="text-gray-600 text-xs">No Card</span>
      </div>
    );
  }

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(card);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Render card back
  if (isBack) {
    return (
      <div 
        className={`
          card-image ${sizeClasses[size]} 
          ${disabled ? 'card-disabled' : ''} 
          ${className}
        `}
        onClick={handleClick}
      >
        <img 
          src="/images/cards/card-back.jpg" 
          alt="UNO Card Back"
          className="w-full h-full object-cover rounded-lg cursor-pointer"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div style={{ display: 'none' }} className="w-full h-full">
          <CardBackFallback />
        </div>
      </div>
    );
  }

  // Get image path for the card
  const imagePath = getCardImagePath(card);

  // Render card with image
  return (
    <div
      className={`
        card-image ${sizeClasses[size]}
        ${disabled ? 'card-disabled' : ''}
        ${className}
      `}
      onClick={handleClick}
    >
      {!imageError ? (
        <img 
          src={placeholderDataUrl || imagePath}
          alt={`${card?.color || 'unknown'} ${card?.value || 'unknown'} UNO card`}
          className="w-full h-full object-cover rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
          onError={handleImageError}
        />
      ) : (
        // Fallback to original design if image fails to load
        <div className={`
          card ${getCardColorClass(card?.color || 'wild')} w-full h-full
          flex flex-col items-center justify-center rounded-lg
        `}>
          <div className="text-center select-none">
            <div className="font-bold">
              {getCardDisplay(card)}
            </div>
            {card?.type === 'special' && (
              <div className="text-xs mt-1 opacity-80">
                {card.value.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;