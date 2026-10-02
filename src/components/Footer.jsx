import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { scrollToPageTop } from "./ScrollToTop";
import "../css/Footer.css"; // Ensure this path matches your project structure

function Footer() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success("Thank you for subscribing to TechStore!");
    setEmail("");
  };

  const handleCategoryClick = (category) => {
    scrollToPageTop();
    navigate(`/products?category=${encodeURIComponent(category)}`);
  };

  return (
    <footer className="footer-wrapper">
      <div className="container">
        
        {/* Modern Floating Newsletter Box */}
        <div className="newsletter-card-wrapper">
          <div className="row align-items-center gy-4">
            <div className="col-lg-6 col-md-12 text-center text-lg-start">
              <h4 className="newsletter-title">Subscribe to Our Newsletter</h4>
              <p className="newsletter-subtitle">
                Get the latest updates on new tech products, exclusive deals & discounts.
              </p>
            </div>
            <div className="col-lg-6 col-md-12">
              <form className="newsletter-form-box" onSubmit={handleSubscribe}>
                <div className="input-with-icon">
                  <i className="bi bi-envelope mail-icon"></i>
                  <input
                    type="email"
                    placeholder="Enter your email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="subscribe-action-btn">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="row gy-4 main-footer-grid">
          {/* Logo & Description */}
          <div className="col-lg-4 col-md-12 col-12 footer-brand-col">
            <h2 className="footer-brand-logo">
              <span className="logo-blue">Tech</span>
              <span className="logo-text">Store</span>
            </h2>
            <p className="footer-description">
              TechStore is your trusted destination for premium electronics,
              laptops, smartphones, gaming accessories, and smart gadgets.
            </p>

            <div className="social-icons-wrapper">
              <a href="#" aria-label="Facebook"><i className="bi bi-facebook"></i></a>
              <a href="#" aria-label="Instagram"><i className="bi bi-instagram"></i></a>
              <a href="#" aria-label="Twitter"><i className="bi bi-twitter-x"></i></a>
              <a href="#" aria-label="LinkedIn"><i className="bi bi-linkedin"></i></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-lg-2 col-md-4 col-6">
            <h5 className="column-title">Quick Links</h5>
            <ul className="footer-links-list">
              <li><Link to="/" onClick={scrollToPageTop}>Home</Link></li>
              <li><Link to="/products" onClick={scrollToPageTop}>Products</Link></li>
              <li><Link to="/about" onClick={scrollToPageTop}>About Us</Link></li>
              <li><Link to="/contact" onClick={scrollToPageTop}>Contact</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="col-lg-3 col-md-4 col-6">
            <h5 className="column-title">Categories</h5>
            <ul className="footer-links-list">
              <li onClick={() => handleCategoryClick("Laptop")}>Laptops</li>
              <li onClick={() => handleCategoryClick("Mobile")}>Smartphones</li>
              <li onClick={() => handleCategoryClick("Smart Watches")}>Smart Watches</li>
              <li onClick={() => handleCategoryClick("Headphones")}>Headphones & Audio</li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="col-lg-3 col-md-4 col-12">
            <h5 className="column-title">Contact Info</h5>
            <div className="contact-info-list">
              <p><i className="bi bi-geo-alt-fill"></i> Ahmedabad, Gujarat</p>
              <p><i className="bi bi-telephone-fill"></i> +91 9876543210</p>
              <p><i className="bi bi-envelope-fill"></i> support@techstore.com</p>
              <p><i className="bi bi-clock-fill"></i> Mon - Sat : 9 AM - 8 PM</p>
            </div>
          </div>
        </div>

        {/* Bottom Divider */}
        <div className="bottom-divider-line"></div>

        {/* Copyright Section */}
        <div className="copyright-text">
          © {new Date().getFullYear()} TechStore. Designed & Developed by{" "}
          <span className="author-credit">Ronak Gaurkhede</span>. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}

export default Footer;