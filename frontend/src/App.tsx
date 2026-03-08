import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, FolderUp, Tags, CreditCard, CalendarClock, Wallet, ClipboardList } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Upload from './pages/Upload';
import Categories from './pages/Categories';
import CreditCards from './pages/CreditCards';
import EMIs from './pages/EMIs';
import CardDetails from './pages/CardDetails';
import Audit from './pages/Audit';

function App() {
  const [sidebarOpen] = useState(true);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/creditcards', icon: CreditCard, label: 'Credit Cards' },
    { to: '/emis', icon: CalendarClock, label: 'EMIs' },
    { to: '/mycards', icon: Wallet, label: 'My Cards' },
    { to: '/transactions', icon: Receipt, label: 'Transactions' },
    { to: '/upload', icon: FolderUp, label: 'Import' },
    { to: '/categories', icon: Tags, label: 'Categories' },
    { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
  ];

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-56 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col">
            <div className="p-4 border-b border-[var(--border)]">
              <h1 className="text-lg font-bold text-[var(--accent)]">💰 FinanceManager</h1>
            </div>
            <nav className="flex-1 p-2">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]'
                    }`
                  }
                  end={to === '/'}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/creditcards" element={<CreditCards />} />
            <Route path="/emis" element={<EMIs />} />
            <Route path="/mycards" element={<CardDetails />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/audit" element={<Audit />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
