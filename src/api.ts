const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:5000/api";

const request = async (path: string, method = "GET", body?: unknown, token?: string) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend server. Start backend at http://127.0.0.1:5000.");
    }
    throw error;
  }
};

export const api = {
  login: (payload: { email: string; password: string }) => request("/auth/login", "POST", payload),
  register: (payload: { name: string; email: string; password: string; role: string }) =>
    request("/auth/register", "POST", payload),
  getAccount: (token: string) => request("/bank/account", "GET", undefined, token),
  deposit: (token: string, payload: { amount: number; note?: string }) =>
    request("/bank/deposit", "POST", payload, token),
  withdraw: (token: string, payload: { amount: number; note?: string }) =>
    request("/bank/withdraw", "POST", payload, token),
  transfer: (token: string, payload: { toAccountNumber: string; amount: number; note?: string }) =>
    request("/bank/transfer", "POST", payload, token),
  getTransactions: (token: string) => request("/bank/transactions", "GET", undefined, token),
  createLoan: (token: string, payload: { amount: number; purpose: string }) =>
    request("/bank/loans", "POST", payload, token),
  getLoans: (token: string) => request("/bank/loans", "GET", undefined, token),
  updateLoanStatus: (token: string, loanId: string, status: "approved" | "rejected") =>
    request(`/bank/loans/${loanId}`, "PATCH", { status }, token),
  createCustomer: (
    token: string,
    payload: { name: string; email: string; password: string; branch: string; accountType: string }
  ) => request("/bank/customers", "POST", payload, token),
  getReports: (token: string) => request("/bank/reports", "GET", undefined, token),
};
