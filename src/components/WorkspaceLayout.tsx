import { Outlet } from "react-router-dom";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspaceLayout() {
  return (
    <div className="min-h-screen flex w-full">
      <WorkspaceSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
