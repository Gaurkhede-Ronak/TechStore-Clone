import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { login } from "../redux/slices/authSlice";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import authService from "../appwrite/authService";
import userService from "../appwrite/userService";
import "../css/Auth.css";

function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },

    validationSchema: Yup.object({
      name: Yup.string().required("Name is required"),

      email: Yup.string()
        .email("Valid email required")
        .required("Email is required"),

      password: Yup.string()
        .min(6, "Password must be at least 6 characters")
        .required("Password is required"),

      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password")], "Passwords do not match")
        .required("Confirm Password is required"),
    }),

    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);

      try {
        await authService.register({
          name: values.name,
          email: values.email,
          password: values.password,
        });

        const currentUser = await authService.getCurrentUser();

        await userService.createUser({
          userId: currentUser.$id,
          name: currentUser.name,
          email: currentUser.email,
          role: "user",
          status: "active",
          createdAt: new Date().toISOString(),
        });

        dispatch(login(currentUser));

        toast.success("Registration Successful");
        navigate("/");
      } catch (error) {
        toast.error(error.message || "Registration Failed");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="auth-page-wrapper">
      <div className="container py-5 d-flex justify-content-center align-items-center min-vh-85">
        <div className="auth-card animate-float-in">
          
          <h2>Create Account</h2>
          <p className="auth-subtitle text-center mb-4">Please fill in details to register</p>

          <form onSubmit={formik.handleSubmit}>
            
            <div className="mb-3">
              <input
                type="text"
                name="name"
                className="form-control"
                placeholder="Full Name"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.name && formik.errors.name && (
                <small className="text-danger mt-1 d-block ps-2">
                  {formik.errors.name}
                </small>
              )}
            </div>

            <div className="mb-3">
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="Email Address"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.email && formik.errors.email && (
                <small className="text-danger mt-1 d-block ps-2">
                  {formik.errors.email}
                </small>
              )}
            </div>

            <div className="position-relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-control"
                placeholder="Password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <span
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {formik.touched.password && formik.errors.password && (
                <small className="text-danger mt-1 d-block ps-2">
                  {formik.errors.password}
                </small>
              )}
            </div>

            <div className="position-relative mb-4">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="form-control"
                placeholder="Confirm Password"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <span
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {formik.touched.confirmPassword &&
                formik.errors.confirmPassword && (
                  <small className="text-danger mt-1 d-block ps-2">
                    {formik.errors.confirmPassword}
                  </small>
                )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 mb-3"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>

          <p className="text-center auth-footer-text mb-0">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Login here
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default Register;