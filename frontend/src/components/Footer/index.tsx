export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-6">
      <div className="container mx-auto px-6 text-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} Hackmoney 2026 • All rights reserved</p>
      </div>
    </footer>
  );
}