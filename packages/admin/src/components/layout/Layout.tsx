import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const Layout = () => (
  <div className="flex min-h-screen bg-bg">
    <Sidebar />
    <main className="flex-1 overflow-auto px-8 py-10 md:px-12 md:py-12">
      <Outlet />
    </main>
  </div>
);
