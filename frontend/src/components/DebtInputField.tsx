export const DebtInputField = () => {
    return(
      <div>
        <div className="flex flex-row gap-4">
          <div>
            <p className="text-sm font-semibold ml-1">Debt Name</p>
            <input
                type="text"
                placeholder="e.g. Credit Card"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <p className="text-sm font-semibold ml-1">Amount ($)</p>
            <input
                type="text"
                placeholder="5,000"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <p className="text-sm font-semibold ml-1">Interest Rate (%)</p>
            <input
                type="text"
                placeholder="18.5"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <p className="text-sm font-semibold ml-1">Minimum Monthly Payment ($)</p>
            <input
                type="text"
                placeholder="25"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
      </div>
    );
  }
