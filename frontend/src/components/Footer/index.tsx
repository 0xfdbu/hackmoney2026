export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8 mt-auto">
      <div className="container mx-auto px-6 text-center">
        <p>© {new Date().getFullYear()} Hackmoney 2026 • Built with Vite + React + Tailwind</p>
        <p className="mt-2 text-sm">
          <a href="https://twitter.com/0xSyv" className="hover:text-indigo-400">
            @0xSyv
          </a>
        </p>
      </div>
    </footer>
  );
}