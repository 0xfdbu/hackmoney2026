import { NavLink } from 'react-router-dom';
import { ArrowLeftRight, Droplets, Compass, Wallet } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { to: '/swap', Icon: ArrowLeftRight, label: 'Swap' },
    { to: '/liquidity', Icon: Droplets, label: 'Manage Liquidity' },
    { to: '/explore', Icon: Compass, label: 'Explore' },
    { to: '/portfolio', Icon: Wallet, label: 'Portfolio' },
  ];

  return (
    <nav className="w-full flex flex-col items-center space-y-4">
      {navItems.map(({ to, Icon, label }) => (
        <div key={to} className="relative group">
          <NavLink
            to={to}
            className={({ isActive }) =>
              `flex items-center justify-center w-12 h-12 rounded-lg transition-all ${
                isActive
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon className="w-6 h-6" />
          </NavLink>

          {/* Tooltip text on hover */}
          <span className="absolute left-full ml-4 px-3 py-2 bg-black text-white text-sm font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            {label}
          </span>
        </div>
      ))}
    </nav>
  );
}