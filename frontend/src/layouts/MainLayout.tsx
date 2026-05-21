import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-hidden bg-surface-muted">
      <TopNav />
      <main className="box-border w-full min-w-0 flex-1 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 xl:px-10">
        <div className="min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
