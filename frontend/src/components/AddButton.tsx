import { TbSquareRoundedPlusFilled } from "react-icons/tb";

interface AddButtonProps {
    children: any;
    onClick: any;
}

const AddButton = ({ children, onClick }: AddButtonProps) => {
  return (
    <button type="button" onClick={onClick} className="w-fit mt-6 rounded-xl px-3 py-2 flex items-center gap-2 font-bold bg-white hover:bg-gray-50 text-green-400">
        <div className="text-green-400">
            <TbSquareRoundedPlusFilled />
        </div>
        {children}
    </button>
  );
};

export default AddButton;
