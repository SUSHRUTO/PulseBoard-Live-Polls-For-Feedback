import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, LogOut, Plus, RadioTower } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/dashboard" aria-label="PollPulse dashboard">
          <span className="brand-mark">
            <RadioTower size={20} />
          </span>
          <span>PollPulse</span>
        </Link>

        <nav className="topnav" aria-label="Primary">
          <NavLink to="/dashboard">
            <BarChart3 size={17} />
            Dashboard
          </NavLink>
          <NavLink to="/polls/new">
            <Plus size={17} />
            New poll
          </NavLink>
        </nav>

        <div className="account">
          <span>{user?.name}</span>
          <button className="icon-button" type="button" onClick={handleLogout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
