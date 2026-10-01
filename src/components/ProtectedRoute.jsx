import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { useSelector } from "react-redux";

function ProtectedRoute({ children }) {

  const {
    isLoggedIn,
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

  return children;
}

export default ProtectedRoute;