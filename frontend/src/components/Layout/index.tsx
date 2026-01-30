import { Outlet } from 'react-router-dom';
import Header from '../Header';
import Footer from '../Footer';
import Sidebar from '../Sidebar';

export default function Layout() {
  return (
    <>
      <Header />
      <div className="flex">
        {/* Fixed left sidebar – icons only, text appears in tooltip on hover */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 top-16 w-20 bg-white border-r border-gray-200 z-10 flex-col items-center py-8 space-y-6">
          <Sidebar />
        </aside>

        {/* Main content – offset for sidebar width */}
        <main className="flex-grow min-h-screen bg-white pt-16 pl-20">
          <div className="max-w-5xl mx-auto p-6 md:p-10">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}