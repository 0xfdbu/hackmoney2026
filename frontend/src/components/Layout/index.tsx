import { Outlet } from 'react-router-dom';
import Header from '../Header';
import Footer from '../Footer';
import Sidebar from '../Sidebar';
import { Coins } from 'lucide-react'; // logo icon – change if you have a custom SVG

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Logo crossing the corner */}
      <div className="fixed top-0 left-0 z-30 w-16 h-16 bg-white border-b border-r border-gray-200 flex items-center justify-center">
        <Coins className="w-10 h-10 text-black" strokeWidth={2.5} />
        {/* Replace with <img src="/logo.svg" alt="Logo" className="w-10 h-10" /> if you have one */}
      </div>

      <div className="flex flex-1">
        {/* Left sidebar – vertically centered icons */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 top-16 w-16 bg-white border-r border-gray-200 z-20 items-center justify-center">
          <div className="flex flex-col space-y-8">
            <Sidebar />
          </div>
        </aside>

        {/* Main content area – proper offset */}
        <main className="flex-1 ml-0 md:ml-16 pt-16 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 md:p-10">
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}