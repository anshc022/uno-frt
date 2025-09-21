// Utility function to get the correct image path for UNO cards
export const getCardImagePath = (card) => {
  if (!card) return '/images/cards/card-back.jpg'; // Default back image

  // Handle card back
  if (card.isBack) {
    return '/images/cards/card-back.jpg';
  }

  // Handle Wild cards
  if (card.color === 'wild') {
    switch (card.value) {
      case 'wild':
        return '/images/cards/Wild.jpg';
      case 'draw4':
        return '/images/cards/Wild_Draw_4.jpg';
      default:
        return '/images/cards/Wild.jpg';
    }
  }

  // Handle colored cards
  const color = capitalizeFirst(card.color);
  
  if (card.type === 'number') {
    const imagePath = `/images/cards/${color}_${card.value}.jpg`;
    return imagePath;
  }
  
  if (card.type === 'special') {
    switch (card.value) {
      case 'skip':
        return `/images/cards/${color}_Skip.jpg`;
      case 'reverse':
        // Handle the inconsistent naming in the image files
        if (color === 'Red') {
          return `/images/cards/RED_Reverse.jpg`;
        }
        return `/images/cards/${color}_Reverse.jpg`;
      case 'draw2':
        return `/images/cards/${color}_Draw_2.jpg`;
      default:
        return `/images/cards/${color}_${card.value}.jpg`;
    }
  }

  // Fallback to a default image
  return '/images/cards/card-back.jpg';
};

// Helper function to capitalize first letter
const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Function to create placeholder images for new wild cards
export const createPlaceholderImage = (type) => {
  // This would create a canvas-based placeholder for cards we don't have images for
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // Draw text
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  
  if (type === 'shufflehands') {
    ctx.fillText('WILD', canvas.width / 2, 40);
    ctx.fillText('SHUFFLE', canvas.width / 2, 60);
    ctx.fillText('HANDS', canvas.width / 2, 80);
    ctx.fillText('🔄', canvas.width / 2, 100);
  } else if (type === 'customizable') {
    ctx.fillText('WILD', canvas.width / 2, 40);
    ctx.fillText('CUSTOM', canvas.width / 2, 60);
    ctx.fillText('RULE', canvas.width / 2, 80);
    ctx.fillText('✎', canvas.width / 2, 100);
  }
  
  return canvas.toDataURL();
};