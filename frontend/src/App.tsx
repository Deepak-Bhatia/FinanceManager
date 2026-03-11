import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, FolderUp, Tags, CreditCard, CalendarClock, Wallet, ClipboardList, Tag, Banknote } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Upload from './pages/Upload';
import Categories from './pages/Categories';
import CreditCards from './pages/CreditCards';
import DebitCards from './pages/DebitCards';
import EMIs from './pages/EMIs';
import CardDetails from './pages/CardDetails';
import Audit from './pages/Audit';
import TagsPage from './pages/Tags';

function App() {
  const [open, setOpen] = useState(() => localStorage.getItem('sidebarOpen') === 'true');

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      localStorage.setItem('sidebarOpen', String(next));
      return next;
    });
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/creditcards', icon: CreditCard, label: 'Credit Cards' },
    { to: '/debitcards', icon: Banknote, label: 'Debit Cards' },
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
        {/* Sidebar — click blank area to toggle */}
        <aside
          onClick={toggle}
          className={`${open ? 'w-48' : 'w-14'} transition-all duration-200 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col cursor-pointer select-none shrink-0`}
          title={open ? 'Click to collapse' : 'Click to expand'}
        >
          {/* Logo */}
          <div className="h-14 flex items-center border-b border-[var(--border)] shrink-0 overflow-hidden px-4 gap-3">
            <span className="text-xl shrink-0">💰</span>
            {open && <span className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">Finance Manager</span>}
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-2 flex flex-col gap-1 overflow-hidden">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={open ? undefined : label}
                onClick={e => e.stopPropagation()}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg transition-colors mx-2 ${
                    open ? 'px-3 py-2' : 'w-10 h-10 justify-center mx-auto'
                  } ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]'
                  }`
                }
                end={to === '/'}
              >
                <Icon size={18} className="shrink-0" />
                {open && <span className="text-sm whitespace-nowrap">{label}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/creditcards" element={<CreditCards />} />
            <Route path="/debitcards" element={<DebitCards />} />
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
