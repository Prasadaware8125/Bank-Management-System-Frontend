import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Pie, PieChart, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "./api";
import type { Account, Role, Transaction, User } from "./types";

type AuthResponse = { token: string; user: User };
type Loan = { _id: string; amount: number; purpose: string; status: string; user?: { name: string } };

const palette = ["#2563eb", "#16a34a", "#dc2626"];

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState<User | null>(() => {
    const value = localStorage.getItem("user");
    return value ? (JSON.parse(value) as User) : null;
  });
  const [message, setMessage] = useState("");

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reports, setReports] = useState<any>(null);

  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", role: "customer" as Role });
  const [isLogin, setIsLogin] = useState(true);

  const setAuth = (data: AuthResponse) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const logout = () => {
    localStorage.clear();
    setToken("");
    setUser(null);
    setAccount(null);
    setTransactions([]);
    setLoans([]);
    setReports(null);
  };

  const loadCustomerData = async () => {
    if (!token) return;
    const [acct, txns, loanData] = await Promise.all([
      api.getAccount(token),
      api.getTransactions(token),
      api.getLoans(token),
    ]);
    setAccount(acct);
    setTransactions(txns);
    setLoans(loanData);
  };

  const loadStaffData = async () => {
    if (!token) return;
    const loanData = await api.getLoans(token);
    setLoans(loanData);
  };

  const loadAdminData = async () => {
    if (!token) return;
    const reportData = await api.getReports(token);
    setReports(reportData);
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        if (user.role === "customer") await loadCustomerData();
        if (user.role === "staff") await loadStaffData();
        if (user.role === "admin") await loadAdminData();
      } catch (error) {
        setMessage((error as Error).message);
      }
    };
    load();
  }, [token, user]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setMessage("");
      const response = isLogin
        ? await api.login({ email: authForm.email, password: authForm.password })
        : await api.register(authForm);
      setAuth(response);
      setMessage(`${isLogin ? "Login" : "Registration"} successful`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const customerTxSummary = useMemo(() => {
    const map = { deposit: 0, withdrawal: 0, transfer: 0 };
    for (const txn of transactions) map[txn.type] += txn.amount;
    return [
      { name: "Deposits", value: map.deposit },
      { name: "Withdrawals", value: map.withdrawal },
      { name: "Transfers", value: map.transfer },
    ];
  }, [transactions]);

  const getTxnSignedAmount = (txn: Transaction) => {
    if (!account) return txn.amount;
    if (txn.type === "deposit") return txn.amount;
    if (txn.type === "withdrawal") return -txn.amount;
    const isDebit = txn.fromAccount?.accountNumber === account.accountNumber;
    return isDebit ? -txn.amount : txn.amount;
  };

  const submitSimpleAction = async (path: "deposit" | "withdraw", amount: number, note: string) => {
    if (!token) return;
    try {
      setMessage("");
      await api[path](token, { amount, note });
      await loadCustomerData();
      setMessage(`${path === "deposit" ? "Deposit" : "Withdrawal"} successful`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>SecureBank Pro</h1>
          <p className="sub">Bank Management System - MERN</p>
          <form onSubmit={handleAuth} className="grid">
            {!isLogin && (
              <>
                <input
                  placeholder="Full Name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  required
                />
                <select
                  value={authForm.role}
                  onChange={(e) => setAuthForm({ ...authForm, role: e.target.value as Role })}
                >
                  <option value="customer">Customer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              minLength={6}
              required
            />
            <button type="submit">{isLogin ? "Login" : "Register"}</button>
          </form>
          <button className="link" onClick={() => setIsLogin((v) => !v)}>
            {isLogin ? "Create account" : "Already have an account?"}
          </button>
          {message && <p className="message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h2>Welcome, {user.name}</h2>
          <p>{user.role.toUpperCase()} Dashboard</p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>
      {message && <p className="message">{message}</p>}

      {user.role === "customer" && (
        <>
          <section className="card">
            <h3>Account Summary</h3>
            <p>Account Number: {account?.accountNumber}</p>
            <p>Branch: {account?.branch}</p>
            <p className="balance">Balance: Rs. {account?.balance?.toFixed(2)}</p>
          </section>

          <section className="grid-3">
            <MoneyForm title="Deposit" onSubmit={(a, n) => submitSimpleAction("deposit", a, n)} />
            <MoneyForm title="Withdraw" onSubmit={(a, n) => submitSimpleAction("withdraw", a, n)} />
            <TransferForm
              onSubmit={async (toAccountNumber, amount, note) => {
                if (!token) return;
                try {
                  setMessage("");
                  const normalized = toAccountNumber.trim().toUpperCase();
                  if (!normalized) {
                    setMessage("Please enter destination account number");
                    return;
                  }
                  if (!Number.isFinite(amount) || amount <= 0) {
                    setMessage("Please enter a valid transfer amount");
                    return;
                  }
                  await api.transfer(token, { toAccountNumber: normalized, amount, note });
                  await loadCustomerData();
                  setMessage("Transfer successful");
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          </section>

          <section className="card">
            <h3>Request Loan</h3>
            <LoanRequestForm
              onSubmit={async (amount, purpose) => {
                if (!token) return;
                try {
                  setMessage("");
                  await api.createLoan(token, { amount, purpose });
                  await loadCustomerData();
                  setMessage("Loan request submitted");
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          </section>

          <section className="card">
            <h3>Transaction Analytics</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={customerTxSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {customerTxSummary.map((_, index) => (
                      <Cell key={index} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3>Recent Transactions</h3>
            {transactions.map((txn) => (
              <div className="list-item" key={txn._id}>
                <strong>
                  {txn.type.toUpperCase()}
                  {txn.type === "transfer" &&
                    (txn.fromAccount?.accountNumber === account?.accountNumber ? " (DEBIT)" : " (CREDIT)")}
                </strong>
                <span>{getTxnSignedAmount(txn) >= 0 ? "+ " : "- "}Rs. {Math.abs(getTxnSignedAmount(txn)).toFixed(2)}</span>
                <span>{new Date(txn.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {user.role === "staff" && (
        <>
          <section className="card">
            <h3>Create Customer Account</h3>
            <CreateCustomerForm
              onSubmit={async (payload) => {
                if (!token) return;
                try {
                  setMessage("");
                  await api.createCustomer(token, payload);
                  setMessage("Customer account created");
                  await loadStaffData();
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          </section>
          <section className="card">
            <h3>Loan Approval Panel</h3>
            {loans.map((loan) => (
              <div key={loan._id} className="list-item">
                <span>
                  {loan.user?.name || "Customer"} - Rs. {loan.amount} ({loan.purpose})
                </span>
                <span>{loan.status}</span>
                {loan.status === "pending" && (
                  <div className="inline-actions">
                    <button
                      onClick={async () => {
                        if (!token) return;
                        try {
                          setMessage("");
                          await api.updateLoanStatus(token, loan._id, "approved");
                          await loadStaffData();
                          setMessage("Loan approved");
                        } catch (error) {
                          setMessage((error as Error).message);
                        }
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!token) return;
                        try {
                          setMessage("");
                          await api.updateLoanStatus(token, loan._id, "rejected");
                          await loadStaffData();
                          setMessage("Loan rejected");
                        } catch (error) {
                          setMessage((error as Error).message);
                        }
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {user.role === "admin" && (
        <section className="card">
          <h3>System Reports</h3>
          <p>Total Customers: {reports?.users?.totalCustomers ?? 0}</p>
          <p>Total Staff: {reports?.users?.totalStaff ?? 0}</p>
          <p>Total Admins: {reports?.users?.totalAdmins ?? 0}</p>
          <p>Total Accounts: {reports?.totalAccounts ?? 0}</p>
          <p>Total Transactions: {reports?.totalTransactions ?? 0}</p>
          <p>Total Bank Balance: Rs. {(reports?.totalBalance ?? 0).toFixed(2)}</p>
        </section>
      )}
    </div>
  );
}

function MoneyForm({ title, onSubmit }: { title: string; onSubmit: (amount: number, note: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className="card grid"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(Number(amount), note);
        setAmount("");
        setNote("");
      }}
    >
      <h3>{title}</h3>
      <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <button type="submit">{title}</button>
    </form>
  );
}

function TransferForm({
  onSubmit,
}: {
  onSubmit: (toAccountNumber: string, amount: number, note: string) => Promise<void>;
}) {
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      className="card grid"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(toAccountNumber, Number(amount), note);
        setToAccountNumber("");
        setAmount("");
        setNote("");
      }}
    >
      <h3>Transfer</h3>
      <input value={toAccountNumber} onChange={(e) => setToAccountNumber(e.target.value)} placeholder="To account" required />
      <input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <button type="submit">Transfer Funds</button>
    </form>
  );
}

function LoanRequestForm({ onSubmit }: { onSubmit: (amount: number, purpose: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  return (
    <form
      className="grid"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(Number(amount), purpose);
        setAmount("");
        setPurpose("");
      }}
    >
      <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose" required />
      <button type="submit">Submit Loan Request</button>
    </form>
  );
}

function CreateCustomerForm({
  onSubmit,
}: {
  onSubmit: (payload: { name: string; email: string; password: string; branch: string; accountType: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    branch: "Main Branch",
    accountType: "savings",
  });
  return (
    <form
      className="grid"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(form);
      }}
    >
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
      <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email" required />
      <input
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        type="password"
        placeholder="Password"
        minLength={6}
        required
      />
      <input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="Branch" required />
      <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
        <option value="savings">Savings</option>
        <option value="current">Current</option>
      </select>
      <button type="submit">Create Customer</button>
    </form>
  );
}
