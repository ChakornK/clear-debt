import { TbSquareRoundedPlusFilled } from "react-icons/tb";

interface AddButtonProps {
  children: any;
  onClick: any;
}

const AddButton = ({ children, onClick }: AddButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit mt-6 rounded-xl px-4 py-2 flex items-center gap-2 font-bold bg-slate-800 hover:bg-slate-700 text-green-400 border border-slate-700 transition-all"
    >
      <div className="text-green-400">
        <TbSquareRoundedPlusFilled className="h-5 w-5" />
      </div>
      {children}
    </button>
  );
};

export default AddButton;
