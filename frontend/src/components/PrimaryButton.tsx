import React from 'react';

interface PrimaryButtonProps {
    children: any;
    onClick: any;
}

const PrimaryButton = ({ children, onClick }: PrimaryButtonProps) => {
    // for dark mode:
    // dark:bg-slate-800
  return (
    <button type="button" onClick={onClick} className="font-bold px-4 py-3 items-center justify-center gap-3 rounded-xl h-14 bg-white bg-white border-2 border-green-500 transition-all">
      {children}
    </button>
  );
};

export default PrimaryButton;
