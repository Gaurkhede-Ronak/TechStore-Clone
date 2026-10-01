import { Link } from "react-router-dom";
import "../css/About.css";

function About() {
    return (
        <div className="about-page-wrapper">
            {/* Hero Section */}
            <section className="about-hero">
                <div className="container">
                    <div className="row align-items-center">

                        <div className="col-lg-6">
                            <span className="about-badge">
                                Welcome to TechStore
                            </span>

                            <h1 className="about-title">
                                Your Trusted Destination
                                <span> For Smart Technology</span>
                            </h1>

                            <p className="about-desc">
                                TechStore brings together the latest laptops,
                                smartphones, gaming accessories, smart gadgets,
                                and premium electronics. We are committed to
                                delivering quality products, competitive prices,
                                and an outstanding shopping experience.
                            </p>

                            <div className="mt-4">
                                <Link
                                    to="/products"
                                    className="btn btn-primary btn-lg me-3"
                                >
                                    Shop Now
                                </Link>

                                <Link
                                    to="/contact"
                                    className="btn btn-outline-primary btn-lg"
                                >
                                    Contact Us
                                </Link>
                            </div>
                        </div>

                        <div className="col-lg-6 text-center">
                            <img
                                src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200"
                                alt="TechStore"
                                className="img-fluid about-image"
                            />
                        </div>

                    </div>
                </div>
            </section>

            {/* Mission */}
            <section className="py-5 about-features-section">
                <div className="container">

                    <div className="text-center mb-5">
                        <h2 className="fw-bold section-main-title">
                            Why Choose TechStore?
                        </h2>

                        <p className="section-sub-title">
                            Everything you need for the best technology
                            shopping experience.
                        </p>
                    </div>

                    <div className="row g-4">

                        <div className="col-lg-4">
                            <div className="about-card">
                                <div className="icon-box">
                                    🚚
                                </div>
                                <h4>Fast Delivery</h4>
                                <p>
                                    We ensure quick and secure delivery across
                                    India with reliable logistics partners.
                                </p>
                            </div>
                        </div>

                        <div className="col-lg-4">
                            <div className="about-card">
                                <div className="icon-box">
                                    💳
                                </div>
                                <h4>Secure Payments</h4>
                                <p>
                                    Multiple payment methods with complete
                                    transaction security and privacy.
                                </p>
                            </div>
                        </div>

                        <div className="col-lg-4">
                            <div className="about-card">
                                <div className="icon-box">
                                    ⭐
                                </div>
                                <h4>Premium Products</h4>
                                <p>
                                    Carefully selected gadgets from trusted
                                    brands to ensure top quality.
                                </p>
                            </div>
                        </div>

                    </div>

                </div>
            </section>

            {/* Stats */}
            <section className="stats-section">
                <div className="container">
                    <div className="row text-center">
                        <div className="col-md-3 col-6">
                            <div className="stat-box">
                                <h2>500+</h2>
                                <p>Products</p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="stat-box">
                                <h2>5K+</h2>
                                <p>Happy Customers</p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="stat-box">
                                <h2>100+</h2>
                                <p>Brands</p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="stat-box">
                                <h2>24/7</h2>
                                <p>Support</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Story */}
            <section className="py-5 about-story-section">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-6">
                            <img
                                src="https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?w=1200"
                                className="img-fluid rounded shadow story-img"
                                alt="Our Story"
                            />
                        </div>
                        <div className="col-lg-6 mt-4 mt-lg-0 story-content">
                            <h2 className="fw-bold mb-4">
                                Our Story
                            </h2>
                            <p>
                                TechStore was founded with a vision to make
                                technology accessible for everyone. From
                                everyday electronics to premium gadgets, our
                                mission is to provide quality products backed
                                by excellent customer service.
                            </p>
                            <p>
                                We believe technology should simplify life,
                                improve productivity, and inspire creativity.
                                That's why we continuously bring the newest
                                innovations to our customers.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default About;