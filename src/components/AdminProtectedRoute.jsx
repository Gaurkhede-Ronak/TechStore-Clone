import { useSelector } from "react-redux";
import {
  Navigate,
  useLocation,
} from "react-router-dom";

function AdminProtectedRoute({ children }) {

  const {
    isLoggedIn,
    user,
    authLoading,
  } = useSelector(
    (state) => state.auth
  );

  const location = useLocation();

  if (authLoading) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (user?.role !== "admin") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

export default AdminProtectedRoute;