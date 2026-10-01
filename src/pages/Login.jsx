import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { login as loginUser } from "../redux/slices/authSlice";
import authService from "../appwrite/authService";
import userService from "../appwrite/userService";
import toast from "react-hot-toast";
import "../css/Auth.css";

function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const [showPassword, setShowPassword] = useState(false);
  const { isLoggedIn, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);

  /* ROLE BASED REDIRECT */

  const redirectUser = (userData) => {
    if (userData?.role === "admin") {
      navigate("/admin/dashboard", {
        replace: true,
      });
      return;
    }

    if (
      userData?.role === "deliveryBoy" ||
      userData?.role === "delivery_boy" ||
      userData?.role === "delivery-boy"
    ) {
      navigate("/delivery/dashboard", {
        replace: true,
      });
      return;
    }

    navigate(from, {
      replace: true,
    });
  };

  /* ALREADY LOGGED IN */

  useEffect(() => {
    if (isLoggedIn && user) {
      redirectUser(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user]);

  /* FORM */

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },

    validationSchema: Yup.object({
      email: Yup.string()
        .email("Enter a valid email")
        .required("Email is required"),

      password: Yup.string()
        .min(
          6,
          "Password must be at least 6 characters"
        )
        .required("Password is required"),
    }),

    onSubmit: async (values) => {
      if (loading) return;

      setLoading(true);

      try {
        /* CHECK EXISTING SESSION */

        const alreadyLoggedIn =
          await authService.getCurrentUser();

        if (alreadyLoggedIn) {
          const existingUser =
            await userService.getUserByEmail(
              alreadyLoggedIn.email
            );

          if (!existingUser) {
            throw new Error(
              "User profile not found."
            );
          }

          const loggedInUser = {
            ...alreadyLoggedIn,
            role: existingUser.role,
            status: existingUser.status,
          };

          dispatch(
            loginUser(loggedInUser)
          );

          redirectUser(loggedInUser);

          return;
        }

        /* APPWRITE LOGIN */

        await authService.login({
          email: values.email,
          password: values.password,
        });

        /* GET CURRENT APPWRITE USER */

        const currentUser =
          await authService.getCurrentUser();

        if (!currentUser) {
          throw new Error(
            "Unable to get logged-in user."
          );
        }

        /* GET USER DATABASE PROFILE */

        const userData =
          await userService.getUserByEmail(
            currentUser.email
          );

        if (!userData) {
          throw new Error(
            "User profile not found."
          );
        }

        /* CHECK ACCOUNT STATUS */

        if (
          userData.status &&
          userData.status !== "active"
        ) {
          toast.error(
            "Your account is not active."
          );

          await authService.logout();

          return;
        }

        /* SAVE AUTH USER IN REDUX */

        const loggedInUser = {
          ...currentUser,
          role: userData.role,
          status: userData.status,
        };

        dispatch(
          loginUser(loggedInUser)
        );

        /* ROLE BASED REDIRECT — ADMIN — DELIVERY BOY — NORMAL USER */

        if (userData.role === "admin") {
          navigate("/admin/dashboard", {
            replace: true,
          });

          return;
        }

        if (
          userData.role === "deliveryBoy" ||
          userData.role === "delivery_boy" ||
          userData.role === "delivery-boy"
        ) {
          navigate("/delivery/dashboard", {
            replace: true,
          });

          return;
        }

        navigate(from, {
          replace: true,
        });
      } catch (error) {
        console.error(
          "Login Error:",
          error
        );

        toast.error(
          error?.message ||
            "Login failed. Please try again."
        );
      } finally {
        setLoading(false);
      }
    },
  });

  /* UI */

  return (
    <div className="auth-page-wrapper">
      <div className="container py-5 d-flex justify-content-center align-items-center min-vh-85">
        <div className="auth-card animate-float-in">

          <h2>Welcome Back</h2>

          <p className="auth-subtitle text-center mb-4">
            Please enter your credentials to login
          </p>

          <form onSubmit={formik.handleSubmit}>

            {/* EMAIL */}

            <div className="mb-3">
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                className="form-control"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={loading}
              />

              {formik.touched.email &&
                formik.errors.email && (
                  <small className="text-danger mt-1 d-block ps-2">
                    {formik.errors.email}
                  </small>
                )}
            </div>

            {/* PASSWORD */}

            <div className="position-relative mb-2">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                placeholder="Password"
                className="form-control"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={loading}
              />

              <span
                className="password-toggle"
                onClick={() =>
                  !loading &&
                  setShowPassword(
                    !showPassword
                  )
                }
              >
                {showPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </span>
            </div>

            {formik.touched.password &&
              formik.errors.password && (
                <small className="text-danger mt-1 d-block ps-2 mb-2">
                  {formik.errors.password}
                </small>
              )}

            {/* FORGOT PASSWORD */}

            <div className="d-flex justify-content-end mb-4">
              <Link
                to="/forgot-password"
                className="forgot-password-link"
              >
                Forgot Password?
              </Link>
            </div>

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>
          </form>

          {/* REGISTER */}

          <p className="mt-4 text-center auth-footer-text">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="auth-link"
            >
              Register
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Login;