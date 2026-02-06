import { Outlet } from 'react-router-dom';
import Header from '../Header';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50">
      <Header />
      
      {/* Main content */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
}
