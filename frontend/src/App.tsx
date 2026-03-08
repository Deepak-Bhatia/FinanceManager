import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, FolderUp, Tags, CreditCard, CalendarClock, Wallet, ClipboardList, Tag } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Upload from './pages/Upload';
import Categories from './pages/Categories';
import CreditCards from './pages/CreditCards';
import EMIs from './pages/EMIs';
import CardDetails from './pages/CardDetails';
import Audit from './pages/Audit';
import TagsPage from './pages/Tags';

function App() {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/creditcards', icon: CreditCard, label: 'Credit Cards' },
    { to: '/emis', icon: CalendarClock, label: 'EMIs' },
    { to: '/mycards', icon: Wallet, label: 'My Cards' },
    { to: '/transactions', icon: Receipt, label: 'Transactions' },
    { to: '/upload', icon: FolderUp, label: 'Import' },
    { to: '/categories', icon: Tags, label: 'Categories' },
    { to: '/tags', icon: Tag, label: 'Tags' },
    { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
  ];

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        {/* Sidebar — collapsed icon-only */}
        <aside className="w-14 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col">
          <div className="h-14 flex items-center justify-center border-b border-[var(--border)]" title="FinanceManager">
            <span className="text-xl">💰</span>
          </div>
          <nav className="flex-1 py-2 flex flex-col items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]'
                  }`
                }
                end={to === '/'}
              >
                <Icon size={18} />
              </NavLink>
            ))}
          </nav>
        </aside>

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
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/audit" element={<Audit />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
