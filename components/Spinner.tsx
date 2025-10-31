import React from 'react';

interface SpinnerProps {
  message: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-400"></div>
      <p className="mt-4 text-lg font-semibold text-gray-300 tracking-wider">{message}</p>
      <p className="text-sm text-gray-500 mt-1">Please wait, this may take a moment...</p>
    </div>
  );
};

export default Spinner;
