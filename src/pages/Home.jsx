import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Hero from "../components/Hero";
import ProductCard from "../components/ProductCard";
import EmptyState from "../components/EmptyState";
import productService from "../appwrite/productService";

import {
  FaLaptop,
  FaMobileAlt,
  FaHeadphones,
  FaClock,
  FaTruck,
  FaShieldAlt,
  FaUndo,
  FaHeadset,
  FaArrowRight,
} from "react-icons/fa";

import SkeletonCard from "../components/SkeletonCard";
import "../css/Home.css";

// Dynamic Category URLs aligned with product filters
const categories = [
  {
    id: 1,
    title: "Laptops",
    icon: <FaLaptop size={42} />,
    path: "/products?category=Laptop",
  },
  {
    id: 2,
    title: "Mobiles",
    icon: <FaMobileAlt size={42} />,
    path: "/products?category=Mobile",
  },
  {
    id: 3,
    title: "Smart Watches",
    icon: <FaClock size={42} />,
    path: "/products?category=Smart Watches",
  },
  {
    id: 4,
    title: "Headphones",
    icon: <FaHeadphones size={42} />,
    path: "/products?category=Headphones",
  },
];

const features = [
  {
    id: 1,
    title: "Fast Delivery",
    icon: <FaTruck size={42} />,
    text: "Free shipping on all eligible orders.",
  },
  {
    id: 2,
    title: "Secure Payment",
    icon: <FaShieldAlt size={42} />,
    text: "100% encrypted payment protection.",
  },
  {
    id: 3,
    title: "Easy Returns",
    icon: <FaUndo size={42} />,
    text: "7-Day hassle-free return policy.",
  },
  {
    id: 4,
    title: "24×7 Support",
    icon: <FaHeadset size={42} />,
    text: "Dedicated customer support anytime.",
  },
];

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchProducts() {
      try {
        const response = await productService.getProducts();
        if (isMounted) {
          setProducts(response.documents || []);
        }
      } catch (error) {
        console.log("Error fetching home products:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const homeProducts = products.slice(0, 8);

  return (
    <div className="home-page-wrapper">
      <Hero />

      {/* Home Products */}
      <section className="home-products">
        <div className="container">
          <div className="section-heading">
            <h2>Featured Products</h2>
            <Link to="/products" className="view-all">
              View All <FaArrowRight />
            </Link>
          </div>

          {loading ? (
            <div className="row g-3 g-md-4">
              {[...Array(4)].map((_, i) => (
                <div
                  className="col-xl-3 col-lg-3 col-md-4 col-sm-6 col-6"
                  key={i}
                >
                  <SkeletonCard />
                </div>
              ))}
            </div>
          ) : homeProducts.length > 0 ? (
            <div className="row g-3 g-md-4">
              {homeProducts.map((product) => (
                <div
                  className="col-xl-3 col-lg-3 col-md-4 col-sm-6 col-6"
                  key={product.$id}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Products Available"
              message="Products will appear here once added to the store."
              buttonText="Browse All Products"
              buttonLink="/products"
            />
          )}
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <div className="container">
          <div className="section-heading">
            <h2>Shop by Category</h2>
            <Link to="/products" className="view-all">
              View All <FaArrowRight />
            </Link>
          </div>

          <div className="row g-4">
            {categories.map((category) => (
              <div
                className="col-lg-3 col-md-6 col-6"
                key={category.id}
              >
                <Link to={category.path} className="category-card">
                  <div className="category-icon">{category.icon}</div>
                  <h5>{category.title}</h5>
                  <span>
                    Explore <FaArrowRight />
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-heading text-center flex-column">
            <h2>Why Choose TechStore?</h2>
            <p>
              Experience fast delivery, secure payments, hassle-free returns,
              and trusted customer support.
            </p>
          </div>

          <div className="row g-4">
            {features.map((feature) => (
              <div
                className="col-lg-3 col-md-6 col-6"
                key={feature.id}
              >
                <div className="feature-card">
                  <div className="feature-icon">{feature.icon}</div>
                  <h5>{feature.title}</h5>
                  <p>{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;