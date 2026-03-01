export enum DebtType {
    "Credit card",
    "Mortgage",
    "Student loan",
    "Payday loan",
    "Car loan",
    "Other"
}

export interface Debt {
    id: string;
    name: string;
    type: DebtType;
    balance: number;
    apr: number;
    minimum: number;
    due: number;
    source?: string | null;
}
