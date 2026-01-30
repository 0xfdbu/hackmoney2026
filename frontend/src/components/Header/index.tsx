import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-indigo-900 text-white shadow-lg">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold">
          <NavLink to="/">Hackmoney 2026</NavLink>
        </div>
        <ul className="flex space-x-8">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? 'text-indigo-300 font-semibold'
                  : 'hover:text-indigo-300 transition-colors'
              }
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                isActive
                  ? 'text-indigo-300 font-semibold'
                  : 'hover:text-indigo-300 transition-colors'
              }
            >
              About
            </NavLink>
          </li>
          {/* Add more links as needed */}
        </ul>
      </nav>
    </header>
  );
}