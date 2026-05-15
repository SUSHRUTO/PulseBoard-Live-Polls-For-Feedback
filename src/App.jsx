import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Shell from "./components/Shell";
import { useAuth } from "./context/AuthContext";
import Analytics from "./pages/Analytics";
import CreatePoll from "./pages/CreatePoll";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PublicPoll from "./pages/PublicPoll";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/p/:slug" element={<PublicPoll />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/polls/new" element={<CreatePoll />} />
          <Route path="/polls/:pollId" element={<Analytics />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
