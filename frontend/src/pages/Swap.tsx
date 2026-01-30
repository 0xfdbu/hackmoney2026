export default function Swap() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Swap</h1>
      <p className="text-lg text-gray-600">Token swap interface goes here.</p>
      {/* Primary & secondary button examples */}
      <div className="mt-8 space-y-4 max-w-md">
        <button className="w-full bg-black text-white py-4 rounded-lg hover:bg-gray-800 transition text-lg font-medium">
          Primary Button (Black)
        </button>
        <button className="w-full bg-white text-black border-2 border-black py-4 rounded-lg shadow-md hover:shadow-xl transition text-lg font-medium">
          Secondary Button (White + Shadow)
        </button>
      </div>
    </div>
  );
}