import { Outlet } from 'react-router-dom';
import Header from '../Header';
import Footer from '../Footer';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-6 py-10">
        <Outlet /> {/* ← Child routes render here */}
      </main>
      <Footer />
    </div>
  );
}