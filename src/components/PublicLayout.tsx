import { Outlet } from "react-router-dom";
import { PublicNav } from "./PublicNav";

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
