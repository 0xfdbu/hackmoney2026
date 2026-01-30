export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 h-16 bg-white border-b border-gray-200 z-20">
      <div className="h-full container mx-auto px-6 flex items-center justify-between">
        <div className="pl-20 text-2xl font-bold">
          Hackmoney 2026
        </div>
        {/* Future: wallet connect button on the right */}
        <div className="pr-8">
          {/* Placeholder for wallet button */}
        </div>
      </div>
    </header>
  );
}