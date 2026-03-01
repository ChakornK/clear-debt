import { TbCalendarEvent } from "react-icons/tb";

interface CalendarButtonProps {
    children: any;
    onClick: any;
}

const CalendarButton = ({ children, onClick }: CalendarButtonProps) => {
  return (
    <button type="button" onClick={onClick} className="font-bold px-4 py-3 items-center justify-center gap-3 rounded-xl h-14 bg-white hover:bg-gray-50 border-2 border-green-200 hover:border-green-300 transition">
      <div className="flex flex-row gap-2 items-center">
        <div className="text-green-400">
          <TbCalendarEvent />
        </div>
        {children}
      </div>
    </button>
  );
};

export default CalendarButton;
