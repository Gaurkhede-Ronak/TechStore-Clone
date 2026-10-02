import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight,
  FaFire,
  FaShieldAlt,
  FaTruck,
  FaStar,
} from "react-icons/fa";

import "../css/Hero.css";

const slides = [
  {
    image:
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=1200&q=80",
    badge: "BIG BILLION TECH SALE",
    title: "Build Your Dream Gaming Setup",
    description:
      "Get up to 40% Instant Discount on high-performance gaming laptops, Intel Core i9 processors, and RTX GPUs.",
    tag: "FLAT 40% OFF",
    categoryLink: "/products?category=Laptop",
  },
  {
    image:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80",
    badge: "FLAGSHIP LAUNCH 2026",
    title: "Next-Gen Tablets & Workstations",
    description:
      "Ultra-slim designs, M-series processing power, and all-day battery life for creators & professionals.",
    tag: "NO COST EMI",
    categoryLink: "/products?category=Tablet",
  },
  {
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
    badge: "MOBILE BONANZA",
    title: "Pro Cameras & 120Hz Displays",
    description:
      "Upgrade to top-tier smartphones with best-in-class exchange offers and instant bank discounts.",
    tag: "BEST EXCHANGE VALUE",
    categoryLink: "/products?category=Mobile",
  },
  {
    image:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=80",
    badge: "AUDIO EXTRAVAGANZA",
    title: "Immersive Studio Noise Cancelling",
    description:
      "Experience spatial audio, deep bass, and crystal-clear wireless calls with top brand earwear.",
    tag: "UP TO 60% OFF",
    categoryLink: "/products?category=Headphones",
  },
];

function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Preload slide images for smooth zero-lag transitions
  useEffect(() => {
    slides.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 4500);

    return () => clearInterval(timer);
  }, [currentSlide]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (diff > minSwipeDistance) {
      // Swiped Left -> Next Slide
      nextSlide();
    } else if (diff < -minSwipeDistance) {
      // Swiped Right -> Prev Slide
      prevSlide();
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section
      className="hero-full-carousel"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image Container */}
      <div
        className="carousel-bg"
        style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
      >
        <div className="carousel-mask">
          <div className="container h-100">
            <div className="row h-100 align-items-center">
              <div className="col-xl-7 col-lg-8 col-md-10">
                <div className="carousel-caption-box" key={currentSlide}>
                  {/* Badge & Discount Tag */}
                  <div className="badge-row">
                    <span className="hero-sale-badge">
                      <FaFire className="icon-fire" />
                      {slides[currentSlide].badge}
                    </span>
                    <span className="hero-offer-tag">
                      {slides[currentSlide].tag}
                    </span>
                  </div>

                  {/* Headline */}
                  <h1 className="hero-main-title">
                    {slides[currentSlide].title}
                  </h1>

                  {/* Description */}
                  <p className="hero-main-desc">
                    {slides[currentSlide].description}
                  </p>

                  {/* Buttons */}
                  <div className="hero-btn-group">
                    <Link
                      to={slides[currentSlide].categoryLink || "/products"}
                      className="btn-primary-ecom"
                    >
                      <span>Shop Now</span>
                      <FaArrowRight />
                    </Link>

                    <Link
                      to={slides[currentSlide].categoryLink || "/products"}
                      className="btn-secondary-ecom"
                    >
                      View Deals
                    </Link>
                  </div>

                  {/* Quick Features Row */}
                  <div className="hero-features-bar">
                    <div className="feature-pill">
                      <FaTruck className="f-icon" />
                      <span>Free Express Delivery</span>
                    </div>
                    <div className="feature-pill">
                      <FaShieldAlt className="f-icon" />
                      <span>100% Original Tech</span>
                    </div>
                    <div className="feature-pill">
                      <FaStar className="f-icon gold" />
                      <span>4.9★ Rated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <button
        className="carousel-nav-btn left-nav"
        onClick={prevSlide}
        aria-label="Previous"
      >
        <FaChevronLeft />
      </button>

      <button
        className="carousel-nav-btn right-nav"
        onClick={nextSlide}
        aria-label="Next"
      >
        <FaChevronRight />
      </button>

      {/* Dots Indicator */}
      <div className="carousel-dots-bar">
        {slides.map((_, index) => (
          <span
            key={index}
            className={`carousel-dot ${
              currentSlide === index ? "active" : ""
            }`}
            onClick={() => setCurrentSlide(index)}
          ></span>
        ))}
      </div>
    </section>
  );
}

export default Hero;