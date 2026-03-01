import React from 'react';

interface PrimaryButtonProps {
    children: any;
    onClick: any;
}

const PrimaryButton = ({ children, onClick }: PrimaryButtonProps) => {
  return (
    <button type="button" onClick={onClick} className="font-bold px-4 py-3 items-center justify-center gap-3 rounded-xl h-14 bg-white bg-white border-2 border-green-200 transition-all">
      <div className="flex flex-row gap-2 items-center">
        <span className="material-symbols-outlined green400" >calendar_today</span>
        {children}
      </div>
    </button>
  );
};

export default PrimaryButton;
