import { useState } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Activity,
  HardDrive,
  Box,
  Wifi,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'System Services', href: '/services', icon: Server },
  { name: 'Processes', href: '/processes', icon: Activity },
  { name: 'Device Drivers', href: '/drivers', icon: HardDrive },
  { name: 'Docker', href: '/docker', icon: Box },
  { name: 'Network Ports', href: '/network', icon: Wifi },
  { name: 'Logs & Audit', href: '/logs', icon: ClipboardList },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 h-screen bg-dark-900 border-r border-dark-700 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        <div className={clsx('flex h-16 items-center justify-between px-4 border-b border-dark-700', collapsed && 'justify-center')}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 font-semibold text-dark-100">
              <Server className="w-8 h-8 text-accent-500" />
              <span>Local System Control Center</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'sidebar-link',
                  isActive && 'sidebar-link-active',
                  collapsed && 'justify-center px-2'
                )
              }
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={clsx('p-3 border-t border-dark-700', collapsed && 'hidden')}>
          <div className="text-xs text-dark-500 text-center">
            Local System Control Center v0.1.0
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const currentPage = navigation.find((item) => location.pathname === item.href) || navigation[0];

  return (
    <header className="sticky top-0 z-30 h-16 bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
      <div className="flex h-full items-center justify-between px-4 lg:pl-0">
        <div className="flex items-center gap-4 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-dark-400 hover:text-dark-100 rounded-lg hover:bg-dark-800"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className={clsx('flex items-center gap-4 lg:pl-6', mobileMenuOpen && 'lg:hidden')}>
          <h1 className="text-lg font-semibold text-dark-100 truncate max-w-xs">
            {currentPage.name}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg text-sm text-dark-400">
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-dark-700 p-3">
          <nav className="flex flex-col gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx('sidebar-link', location.pathname === item.href && 'sidebar-link-active')}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar />
      <div className={clsx('transition-all duration-300', 'lg:pl-64')}>
        <Header />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}