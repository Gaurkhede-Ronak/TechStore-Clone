import "../css/Contact.css";

function Contact() {
    return (
        <div className="contact-page-wrapper">
            {/* Hero Section */}
            <section className="contact-hero">
                <div className="container text-center">
                    <span className="contact-badge">
                        Contact TechStore
                    </span>
                    <h1>
                        We'd Love to Hear From You
                    </h1>
                    <p>
                        Have questions about our products or services?
                        Our team is always ready to help you.
                    </p>
                </div>
            </section>

            {/* Contact Section */}
            <section className="contact-section">
                <div className="container">
                    <div className="row g-5">

                        {/* Left: Contact Info */}
                        <div className="col-lg-5">
                            <div className="contact-card">
                                <h3>
                                    Get In Touch
                                </h3>
                                <p>
                                    Feel free to contact us anytime.
                                    We're available 24/7 to answer
                                    your questions.
                                </p>

                                <div className="contact-info">
                                    <div className="info-box">
                                        <div className="info-icon">📍</div>
                                        <div>
                                            <h5>Address</h5>
                                            <p>Ahmedabad, Gujarat, India</p>
                                        </div>
                                    </div>

                                    <div className="info-box">
                                        <div className="info-icon">📞</div>
                                        <div>
                                            <h5>Phone</h5>
                                            <p>+91 9876543210</p>
                                        </div>
                                    </div>

                                    <div className="info-box">
                                        <div className="info-icon">✉️</div>
                                        <div>
                                            <h5>Email</h5>
                                            <p>support@techstore.com</p>
                                        </div>
                                    </div>

                                    <div className="info-box">
                                        <div className="info-icon">🕒</div>
                                        <div>
                                            <h5>Working Hours</h5>
                                            <p>
                                                Mon - Sat <br />
                                                9:00 AM - 8:00 PM
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Contact Form */}
                        <div className="col-lg-7">
                            <div className="contact-form-card">
                                <h3 className="mb-4">
                                    Send Message
                                </h3>

                                <form>
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Your Name"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <input
                                                type="email"
                                                className="form-control"
                                                placeholder="Email Address"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Subject"
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <textarea
                                            rows="6"
                                            className="form-control"
                                            placeholder="Write your message..."
                                        ></textarea>
                                    </div>

                                    <button className="btn btn-primary btn-lg w-100">
                                        Send Message
                                    </button>
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Google Map */}
            <section className="map-section">
                <iframe
                    title="Google Map"
                    src="https://www.google.com/maps?q=Ahmedabad&output=embed"
                    loading="lazy"
                ></iframe>
            </section>
        </div>
    );
}

export default Contact;