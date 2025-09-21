// Card display helpers
export const getCardColor = (card) => {
  if (card.color === 'wild') return 'wild';
  return card.color;
};

export const getCardDisplay = (card) => {
  if (card.type === 'number') {
    return card.value;
  }
  
  switch (card.value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'W';
    case 'draw4':
      return '+4';
    default:
      return card.value;
  }
};

export const canPlayCard = (card, topCard, currentColor) => {
  // Wild cards can always be played
  if (card.color === 'wild') {
    return true;
  }
  
  // Same color
  if (card.color === currentColor) {
    return true;
  }
  
  // Same number or special type
  if (card.type === topCard.type && card.value === topCard.value) {
    return true;
  }
  
  return false;
};

export const getCardColorClass = (color) => {
  switch (color) {
    case 'red':
      return 'card-red';
    case 'blue':
      return 'card-blue';
    case 'green':
      return 'card-green';
    case 'yellow':
      return 'card-yellow';
    case 'wild':
      return 'card-wild';
    default:
      return 'card-back';
  }
};