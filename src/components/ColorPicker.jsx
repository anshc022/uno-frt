import React from 'react';

const ColorPicker = ({ onColorSelect, onCancel }) => {
  const colors = [
    { name: 'red', bg: 'bg-uno-red', label: 'Red' },
    { name: 'blue', bg: 'bg-uno-blue', label: 'Blue' },
    { name: 'green', bg: 'bg-uno-green', label: 'Green' },
    { name: 'yellow', bg: 'bg-uno-yellow', label: 'Yellow' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel-neutral p-6 shadow-2xl max-w-sm w-full mx-4">
        <h3 className="text-xl font-bold mb-4 text-center">
          Choose a Color
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          {colors.map((color) => (
            <button
              key={color.name}
              onClick={() => onColorSelect(color.name)}
              className={`
                ${color.bg} text-white font-semibold py-4 px-6 rounded-lg
                hover:scale-105 transform transition-all duration-200
                shadow-lg hover:shadow-xl
              `}
            >
              {color.label}
            </button>
          ))}
        </div>
        
        <button
          onClick={onCancel}
          className="btn-neutral w-full"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ColorPicker;