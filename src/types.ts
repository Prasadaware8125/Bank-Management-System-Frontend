export type Role = "customer" | "staff" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Account {
  _id: string;
  accountNumber: string;
  branch: string;
  accountType: "savings" | "current";
  balance: number;
  status: "active" | "frozen";
}

export interface Transaction {
  _id: string;
  type: "deposit" | "withdrawal" | "transfer";
  amount: number;
  fromAccount?: { accountNumber: string };
  toAccount?: { accountNumber: string };
  note?: string;
  createdAt: string;
}
