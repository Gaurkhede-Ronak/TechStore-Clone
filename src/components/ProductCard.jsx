import { memo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux"; // Added useSelector
import { useNavigate } from "react-router-dom";

import {
  FaHeart,
  FaShoppingCart,
  FaStar,
} from "react-icons/fa";

import { addToCart } from "../redux/slices/cartSlice";
import {
  addWishlist,
  removeWishlist,
} from "../redux/slices/wishlistSlice";

import "../css/ProductCard.css";

function ProductCard({ product, isWishlistPage = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state se wishlist items la rahe hain
  // Note: Agar aapke slice me array ka naam kuch aur hai (jaise state.wishlist.items), toh use adjust kar lena.
  const wishlistItems = useSelector((state) => state.wishlist.wishlistItems || state.wishlist.items || state.wishlist);
  
  // Check kar rahe hain ki kya yeh product already wishlist me hai
  const isInWishlist = Array.isArray(wishlistItems) 
    ? wishlistItems.some((item) => item.$id === product.$id) 
    : false;

  const addCart = useCallback((e) => {
    e.stopPropagation(); // Card click event ko roko
    dispatch(addToCart(product));
  }, [dispatch, product]);

  // Wishlist Toggle Logic (Add/Remove)
  const handleWishlistToggle = useCallback((e) => {
    e.stopPropagation(); // Card click event ko roko
    if (isInWishlist) {
      dispatch(removeWishlist(product.$id));
    } else {
      dispatch(addWishlist(product));
    }
  }, [dispatch, product, isInWishlist]);

  const FALLBACK_PRODUCT_IMAGE =
    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = FALLBACK_PRODUCT_IMAGE;
  };

  const rawImage =
    product?.thumbnail ||
    product?.image ||
    (Array.isArray(product?.images) ? product.images[0] : null);

  const imageUrl = rawImage
    ? typeof rawImage === "string" &&
      (rawImage.startsWith("http://") ||
        rawImage.startsWith("https://") ||
        rawImage.startsWith("data:"))
      ? rawImage
      : `https://fra.cloud.appwrite.io/v1/storage/buckets/${
          import.meta.env.VITE_APPWRITE_BUCKET_ID
        }/files/${rawImage}/view?project=${
          import.meta.env.VITE_APPWRITE_PROJECT_ID
        }`
    : FALLBACK_PRODUCT_IMAGE;

  const originalPrice = Number(product.price);
  const discount = Number(product.discount || 0);
  const finalPrice = originalPrice - (originalPrice * discount) / 100;

  return (
    <div className="product-card">
      
      {discount > 0 && (
        <div className="discount">
          -{discount}%
        </div>
      )}

      {/* WISHLIST BUTTON (Top Right) */}
      {!isWishlistPage && (
        <button
          className={`wishlist-btn ${isInWishlist ? "active" : ""}`} // Added Active Class
          onClick={handleWishlistToggle}
        >
          <FaHeart />
        </button>
      )}

      <div
        className="image-box"
        onClick={() => navigate(`/product/${product.$id}`)}
      >
        <img
          src={imageUrl}
          alt={product.title || "Product"}
          className="product-image"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
      </div>

      <div className="product-body">
        <h5 className="product-title" title={product?.title || product?.name || "Product"}>
          {(product?.title || product?.name || "Product").length > 40
            ? (product?.title || product?.name || "Product").slice(0, 40) + "..."
            : product?.title || product?.name || "Product"}
        </h5>

        <div className="rating">
          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />
          <span>({product.rating || 0})</span>
        </div>

        <div className="price">
          <span className="new-price">
            ₹{finalPrice.toLocaleString("en-IN")}
          </span>
          {discount > 0 && (
            <span className="old-price">
              ₹{originalPrice.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        <button className="cart-btn" onClick={addCart}>
          <FaShoppingCart />
          Add To Cart
        </button>

        {isWishlistPage && (
          <button className="remove-wishlist-btn" onClick={handleWishlistToggle}>
            <FaHeart />
            Remove Wishlist
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ProductCard);