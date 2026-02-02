export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 h-16 bg-white border-b border-gray-200 z-10">
      <div className="h-full flex items-center justify-between px-6">
        {/* Spacer for logo */}
        <div className="w-16" />

        <div className="text-2xl font-bold">
          Hackmoney 2026
        </div>

        {/* Future wallet connect / actions */}
        <div className="w-16" />
      </div>
    </header>
  );
}