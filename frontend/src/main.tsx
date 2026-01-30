import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Home from './pages/Home';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    // errorElement: <ErrorPage />, // optional – add later if needed
    children: [
      {
        index: true,          // ← default child route (/)
        element: <Home />,
      }
      // Add more routes here, e.g.:
      // { path: 'dashboard', element: <Dashboard /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);