import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Swap from './pages/Swap';
import ManageLiquidity from './pages/ManageLiquidity';
import Explore from './pages/Explore';
import Portfolio from './pages/Portfolio';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Swap /> }, // default route → Swap
      { path: 'swap', element: <Swap /> },
      { path: 'liquidity', element: <ManageLiquidity /> },
      { path: 'explore', element: <Explore /> },
      { path: 'portfolio', element: <Portfolio /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);