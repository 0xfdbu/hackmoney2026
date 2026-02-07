import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { createAppKit } from '@reown/appkit/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { defineChain } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Custom Sepolia with Infura RPC
const sepolia = defineChain({
  id: 11155111,
  caipNetworkId: 'eip155:11155111',
  chainNamespace: 'eip155',
  name: 'Sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.infura.io/v3/430841136bcb41bdb220248ee7297e6a'],
    }
  },
  blockExplorers: {
    default: {
      name: 'Sepolia Etherscan',
      url: 'https://sepolia.etherscan.io'
    }
  }
});
import './index.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import Swap from './pages/Swap';
import ManageLiquidity from './pages/ManageLiquidity';
import History from './pages/History';
import Portfolio from './pages/Portfolio';
import Documentation from './pages/Documentation';

// ──────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || '3fbb6bba6f1de962d911bb5b5c9dba88';

const metadata = {
  name: 'PrivyFlow',
  description: 'Privacy-preserving Uniswap v4 hook demo',
  url: 'https://privyflow.app',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
};

// ──────────────────────────────────────────────────────────────
// Wagmi & AppKit Setup
// ──────────────────────────────────────────────────────────────

const wagmiAdapter = new WagmiAdapter({
  networks: [sepolia],
  projectId,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [sepolia],
  projectId,
  metadata,
  features: {
    analytics: false,
  }
});

// ──────────────────────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────────────────────

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'swap', element: <Swap /> },
      { path: 'liquidity', element: <ManageLiquidity /> },
      { path: 'portfolio', element: <Portfolio /> },
      { path: 'history', element: <History /> },
      { path: 'docs', element: <Documentation /> },
    ],
  },
]);

// ──────────────────────────────────────────────────────────────
// Render
// ──────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);