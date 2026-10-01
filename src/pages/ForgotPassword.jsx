import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link } from "react-router-dom";
import authService from "../appwrite/authService";
import userService from "../appwrite/userService";
import toast from "react-hot-toast";
import "../css/Auth.css";

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: "",
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email("Enter a valid email address")
        .required("Email is required"),
    }),
    onSubmit: async (values) => {
      if (loading) return;
      setLoading(true);

      try {
        const userExists = await userService.getUserByEmail(values.email);

        if (!userExists) {
          toast.error("No account found with this email address.");
          setLoading(false);
          return;
        }

        await authService.forgotPassword(values.email);
        setSubmitted(true);
        toast.success("Recovery instructions sent to your email!");
      } catch (error) {
        toast.error(error.message || "Failed to send reset link. Try again.");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="auth-page-wrapper">
      <div className="container py-5 d-flex justify-content-center align-items-center min-vh-85">
        <div className="auth-card animate-float-in">
          
          {/* Dynamic Header */}
          <h2>{submitted ? "Check Your Inbox" : "Forgot Password"}</h2>
          <p className="auth-subtitle text-center mb-4">
            {submitted
              ? "We've sent a secure password recovery link to your email."
              : "Enter your email and we'll send you a secure link to reset your password"}
          </p>

          {submitted ? (
            <div className="text-center py-3">
              <div className="success-icon-box mb-4 mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              
              <p className="auth-subtitle mb-4">
                Please follow the instructions inside the email to create your new password.
              </p>

              <Link to="/login" className="btn btn-primary w-100 shadow-sm d-flex align-items-center justify-content-center text-decoration-none">
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={formik.handleSubmit}>
              <div className="mb-4">
                <input
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  className="form-control"
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

              <button
                type="submit"
                className="btn btn-primary w-100 mb-3"
                disabled={loading}
              >
                {loading ? "Sending Secure Link..." : "Send Reset Link"}
              </button>

              <p className="text-center auth-footer-text mb-0">
                Remember your password?{" "}
                <Link to="/login" className="auth-link">
                  Login here
                </Link>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;