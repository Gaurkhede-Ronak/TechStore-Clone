import { useEffect, useRef, useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import {
  FaTrash,
  FaPlus,
  FaMinus,
  FaTag,
  FaShieldAlt,
  FaArrowRight,
  FaShoppingBag,
  FaCheckCircle,
  FaShoppingCart,
  FaHeart,
  FaTimes,
} from "react-icons/fa";

import couponService from "../appwrite/couponService";

import {
  increaseQty,
  decreaseQty,
  removeFromCart,
} from "../redux/slices/cartSlice";
import { addWishlist } from "../redux/slices/wishlistSlice";

import "../css/Cart.css";
import { scrollToPageTop } from "../components/ScrollToTop";

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";

function Cart() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    scrollToPageTop();
  }, []);

  const cartItems = useSelector(
    (state) => state.cart.items
  );

  const [coupons, setCoupons] = useState([]);
  const [coupon, setCoupon] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const couponDropdownRef = useRef(null);
  const [appliedCoupon, setAppliedCoupon] =
    useState(null);
  const [discount, setDiscount] = useState(0);

  const [gstNumber, setGstNumber] = useState("");
  const [gstApplied, setGstApplied] =
    useState(false);
  const [deleteModalItem, setDeleteModalItem] =
    useState(null);

  /* LOAD COUPONS FROM APPWRITE */

  useEffect(() => {
    let isMounted = true;

    const loadCoupons = async () => {
      try {
        const response =
          await couponService.getCoupons();

        if (!isMounted) {
          return;
        }

        /*
          Appwrite ke Active coupons me se sirf
          non-expired coupons dropdown me show honge.

          Dropdown ka actual value hamesha
          couponCode hoga, jaise TECH20.
        */

        const today = new Date();

        const todayDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        const activeCoupons = (
          response?.documents || []
        )
          .filter((item) => {
            const status = String(
              item.status || ""
            )
              .trim()
              .toLowerCase();

            if (status !== "active") {
              return false;
            }

            if (!item.couponCode) {
              return false;
            }

            if (!item.expiryDate) {
              return true;
            }

            const expiry = new Date(
              item.expiryDate
            );

            if (
              Number.isNaN(
                expiry.getTime()
              )
            ) {
              return true;
            }

            const expiryDate = new Date(
              expiry.getFullYear(),
              expiry.getMonth(),
              expiry.getDate()
            );

            return expiryDate >= todayDate;
          })
          .sort((a, b) =>
            String(
              a.couponCode || ""
            ).localeCompare(
              String(
                b.couponCode || ""
              )
            )
          );

        setCoupons(activeCoupons);
      } catch (error) {
        console.error(
          "Load Coupons Error:",
          error
        );

        toast.error(
          "Failed to load available coupons"
        );
      }
    };

    loadCoupons();

    return () => {
      isMounted = false;
    };
  }, []);

  /* CLOSE COUPON DROPDOWN ON OUTSIDE CLICK */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        couponDropdownRef.current &&
        !couponDropdownRef.current.contains(event.target)
      ) {
        setCouponOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  /* TOTAL CALCULATIONS */

  const grandTotal = cartItems.reduce(
    (total, item) => {
      const finalPrice =
        item.price -
        (item.price *
          (item.discount || 0)) /
          100;

      return (
        total +
        finalPrice * item.quantity
      );
    },
    0
  );

  const shipping = 0;

  const platformFee = 9;

  const subTotal =
    grandTotal / 1.18;

  const gst =
    grandTotal - subTotal;

  const total = gstApplied
    ? subTotal +
      platformFee -
      discount
    : grandTotal +
      platformFee -
      discount;

  /* GST */

  function applyGST() {
    if (
      gstNumber.trim().length !== 15
    ) {
      toast.error(
        "Please enter a valid 15-digit GSTIN number"
      );

      return;
    }

    setGstApplied(true);

    toast.success(
      "Corporate GST Input Credit Applied"
    );
  }

  /* APPLY COUPON */

  function applyCoupon() {
    if (appliedCoupon) {
      toast.error(
        "A promo code is already applied"
      );

      return;
    }

    /*
      Dropdown se sirf actual couponCode aata hai.

      Example:

      Display:
      TECH20 — ₹1000 OFF

      Actual value:
      TECH20
    */

    const enteredCode =
      String(coupon || "")
        .trim()
        .toUpperCase();

    if (!enteredCode) {
      toast.error(
        "Please select a coupon code"
      );

      return;
    }

    const foundCoupon =
      coupons.find(
        (item) =>
          String(
            item.couponCode || ""
          )
            .trim()
            .toUpperCase() ===
          enteredCode
      );

    if (!foundCoupon) {
      toast.error(
        "Invalid coupon code"
      );

      return;
    }

    /* STATUS VALIDATION */

    const couponStatus =
      String(
        foundCoupon.status || ""
      )
        .trim()
        .toLowerCase();

    if (couponStatus !== "active") {
      toast.error(
        "This coupon is not active"
      );

      return;
    }

    /* MINIMUM ORDER VALIDATION */

    const minimumOrder = Number(
      foundCoupon.minOrder ?? 0
    );

    if (subTotal < minimumOrder) {
      toast.error(
        `Minimum order amount should be ₹${minimumOrder.toLocaleString(
          "en-IN"
        )}`
      );

      return;
    }

    /* EXPIRY VALIDATION */

    if (foundCoupon.expiryDate) {
      const today = new Date();

      const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      const expiry = new Date(
        foundCoupon.expiryDate
      );

      if (
        !Number.isNaN(
          expiry.getTime()
        )
      ) {
        const expiryDate =
          new Date(
            expiry.getFullYear(),
            expiry.getMonth(),
            expiry.getDate()
          );

        if (
          expiryDate < todayDate
        ) {
          toast.error(
            "This coupon has expired"
          );

          return;
        }
      }
    }

    /* USAGE LIMIT VALIDATION */

    const maxUsage = Number(
      foundCoupon.maxUsage ?? 0
    );

    const usedCount = Number(
      foundCoupon.usedCount ?? 0
    );

    /*
      maxUsage = 0
      means unlimited usage.
    */

    if (
      maxUsage > 0 &&
      usedCount >= maxUsage
    ) {
      toast.error(
        "Coupon usage limit exceeded"
      );

      return;
    }

    /* DISCOUNT CALCULATION */

    let discountAmount;

    const couponType =
      String(
        foundCoupon.type || ""
      )
        .trim()
        .toLowerCase();

    if (
      couponType === "percentage" ||
      couponType === "%"
    ) {
      discountAmount =
        (subTotal *
          Number(
            foundCoupon.discount || 0
          )) /
        100;
    } else {
      discountAmount =
        Number(
          foundCoupon.discount || 0
        );
    }

    /*
      Discount kabhi subtotal se
      zyada nahi hoga.
    */

    discountAmount = Math.min(
      Math.max(
        discountAmount,
        0
      ),
      subTotal
    );

    setDiscount(
      discountAmount
    );

    /*
      Original Appwrite coupon object
      save kar rahe hain.

      Checkout ko:

      appliedCoupon.couponCode
      = TECH20
    */

    setAppliedCoupon(
      foundCoupon
    );

    toast.success(
      `Coupon "${foundCoupon.couponCode}" successfully applied!`
    );
  }

  /* REMOVE COUPON */

  function removeCoupon() {
    setCoupon("");
    setAppliedCoupon(null);
    setDiscount(0);

    toast.success(
      "Coupon removed"
    );
  }

  /* EMPTY CART */

  if (cartItems.length === 0) {
    return (
      <div
        className="cart-page-wrapper py-5 d-flex align-items-center justify-content-center"
        style={{
          minHeight: "80vh",
        }}
      >
        <div className="container py-5 text-center">
          <div className="empty-cart-large-box py-5 px-4 animate-float-in">
            <div className="empty-illustration-wrap mb-4 mx-auto">
              <FaShoppingCart
                size={85}
                className="text-primary empty-box-icon"
              />
            </div>

            <h2 className="fw-bold mb-2 display-5">
              Your Cart is Empty
            </h2>

            <p
              className="text-muted mb-4 fs-5"
              style={{
                maxWidth: "450px",
                margin: "0 auto",
              }}
            >
              Explore our collection and add
              your favorite tech products to
              the cart.
            </p>

            <button
              className="btn btn-primary px-5 py-3 fw-bold rounded-pill shadow-lg start-shopping-btn"
              onClick={() =>
                navigate("/products")
              }
            >
              Start Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* MAIN */

  return (
    <div className="cart-page-wrapper py-5">
      <div className="container">

        {/* HEADER */}

        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
          <div>
            <h2 className="fw-bold cart-main-title mb-1">
              Shopping Cart
            </h2>

            <p className="text-muted small mb-0">
              Verify your items and secure your deal
            </p>
          </div>

          <div className="cart-badge-pill">
            <FaShoppingBag className="me-2 text-primary" />

            <span>
              {cartItems.reduce(
                (total, item) =>
                  total + item.quantity,
                0
              )}{" "}
              Items in Cart
            </span>
          </div>
        </div>

        <div className="row g-4">

          {/* PRODUCT LIST */}

          <div className="col-lg-8">

            {cartItems.map((item) => {
              const finalPrice =
                item.price -
                (item.price *
                  (item.discount || 0)) /
                  100;

              return (
                <div
                  className="cart-card mb-3"
                  key={item.$id}
                >
                  <div className="row align-items-center g-3">

                    {/* IMAGE */}

                    <div className="col-xl-2 col-md-3 col-4 text-center">
                      <div className="cart-image-wrapper">
                        {(() => {
                          const rawImg =
                            item.thumbnail ||
                            item.image ||
                            (Array.isArray(item.images) ? item.images[0] : null);
                          const cartImgSrc = rawImg
                            ? typeof rawImg === "string" &&
                              (rawImg.startsWith("http://") ||
                                rawImg.startsWith("https://") ||
                                rawImg.startsWith("data:"))
                              ? rawImg
                              : `https://fra.cloud.appwrite.io/v1/storage/buckets/${
                                  import.meta.env.VITE_APPWRITE_BUCKET_ID
                                }/files/${rawImg}/view?project=${
                                  import.meta.env.VITE_APPWRITE_PROJECT_ID
                                }`
                            : FALLBACK_PRODUCT_IMAGE;

                          return (
                            <img
                              src={cartImgSrc}
                              alt={item.title || "Product"}
                              className="cart-image img-fluid"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = FALLBACK_PRODUCT_IMAGE;
                              }}
                            />
                          );
                        })()}
                      </div>
                    </div>

                    {/* DETAILS */}

                    <div className="col-xl-5 col-md-5 col-8">
                      <h5 className="cart-title fw-bold mb-1">
                        {item.title || item.name || 'Product'}
                      </h5>

                      <p className="cart-brand text-muted small mb-2">
                        Brand:{" "}
                        <span className="fw-semibold text-secondary">
                          {item.brand ||
                            "TechStore"}
                        </span>
                      </p>

                      {item.discount > 0 && (
                        <div className="mb-2">
                          <span className="cart-discount-badge">
                            {item.discount}% OFF
                          </span>
                        </div>
                      )}

                      <div className="d-flex align-items-baseline gap-2">
                        <h4 className="cart-price mb-0 fw-bold">
                          ₹
                          {finalPrice.toLocaleString(
                            "en-IN"
                          )}
                        </h4>

                        {item.discount > 0 && (
                          <small className="cart-old-price text-decoration-line-through text-muted">
                            ₹
                            {Number(
                              item.price
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </small>
                        )}
                      </div>
                    </div>

                    {/* QUANTITY */}

                    <div className="col-xl-3 col-md-2 col-6 text-md-center text-start">
                      <div className="quantity-box">

                        <button
                          className="quantity-btn"
                          onClick={() =>
                            dispatch(
                              decreaseQty(
                                item.$id
                              )
                            )
                          }
                          aria-label="Decrease"
                        >
                          <FaMinus size={10} />
                        </button>

                        <span className="quantity-input">
                          {item.quantity}
                        </span>

                        <button
                          className="quantity-btn"
                          onClick={() =>
                            dispatch(
                              increaseQty(
                                item.$id
                              )
                            )
                          }
                          aria-label="Increase"
                        >
                          <FaPlus size={10} />
                        </button>

                      </div>
                    </div>

                    {/* DELETE */}

                    <div className="col-xl-2 col-md-2 col-6 text-end text-md-center">
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() =>
                          setDeleteModalItem(item)
                        }
                        title="Remove item"
                      >
                        <FaTrash size={13} />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}

          </div>

          {/* ORDER SUMMARY */}

          <div className="col-lg-4">
            <div className="summary-card">

              <h4 className="summary-title fw-bold mb-4">
                Order Summary
              </h4>

              {/* COUPON DROPDOWN */}

              <div className="summary-section-box mb-4">

                <label className="form-label text-muted small fw-bold mb-2">
                  <FaTag className="me-1 text-primary" />

                  PROMO CODE / COUPON
                </label>

                <div className="coupon-input-group">

                  <div
                    className="coupon-select-wrapper"
                    ref={couponDropdownRef}
                  >
                    <button
                      type="button"
                      className={`coupon-select-trigger ${
                        couponOpen ? "is-open" : ""
                      } ${
                        appliedCoupon ? "is-disabled" : ""
                      }`}
                      onClick={() => {
                        if (!appliedCoupon) {
                          setCouponOpen((prev) => !prev);
                        }
                      }}
                      disabled={!!appliedCoupon}
                      aria-haspopup="listbox"
                      aria-expanded={couponOpen}
                    >
                      <span className={coupon ? "coupon-selected-value" : "coupon-placeholder"}>
                        {coupon
                          ? (() => {
                              const selectedCoupon = coupons.find(
                                (item) =>
                                  String(item.couponCode || "")
                                    .trim()
                                    .toUpperCase() ===
                                  String(coupon || "")
                                    .trim()
                                    .toUpperCase()
                              );

                              if (!selectedCoupon) {
                                return coupon;
                              }

                              const type = String(
                                selectedCoupon.type || ""
                              )
                                .trim()
                                .toLowerCase();

                              return (
                                <>
                                  <span>{selectedCoupon.couponCode}</span>
                                  <span className="coupon-selected-offer">
                                    {type === "percentage" || type === "%"
                                      ? `${selectedCoupon.discount}% OFF`
                                      : `₹${selectedCoupon.discount} OFF`}
                                  </span>
                                </>
                              );
                            })()
                          : coupons.length > 0
                            ? "Select Coupon Code"
                            : "No Active Coupons"}
                      </span>

                      <span
                        className={`coupon-chevron ${
                          couponOpen ? "rotate" : ""
                        }`}
                        aria-hidden="true"
                      >
                        <span className="coupon-chevron-icon" aria-hidden="true"></span>
                      </span>
                    </button>

                    {couponOpen && !appliedCoupon && (
                      <div
                        className="coupon-dropdown-menu"
                        role="listbox"
                      >
                        {coupons.length > 0 ? (
                          <>
                            <button
                              type="button"
                              className={`coupon-dropdown-option coupon-placeholder-option ${
                                !coupon ? "active" : ""
                              }`}
                              onClick={() => {
                                setCoupon("");
                                setCouponOpen(false);
                              }}
                            >
                              <span>Select Coupon Code</span>
                            </button>

                            {coupons.map((item) => {
                              const type = String(
                                item.type || ""
                              )
                                .trim()
                                .toLowerCase();

                              const code = String(
                                item.couponCode || ""
                              );

                              const isSelected =
                                String(coupon || "")
                                  .trim()
                                  .toUpperCase() ===
                                code.trim().toUpperCase();

                              return (
                                <button
                                  type="button"
                                  key={item.$id}
                                  className={`coupon-dropdown-option ${
                                    isSelected ? "active" : ""
                                  }`}
                                  onClick={() => {
                                    setCoupon(code);
                                    setCouponOpen(false);
                                  }}
                                >
                                  <span className="coupon-option-main">
                                    <strong>{code}</strong>
                                    <small>
                                      {type === "percentage" || type === "%"
                                        ? `${item.discount}% OFF`
                                        : `₹${item.discount} OFF`}
                                    </small>
                                  </span>

                                  {isSelected && (
                                    <FaCheckCircle className="coupon-option-check" />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        ) : (
                          <div className="coupon-empty-option">
                            No Active Coupons
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-apply px-4"
                    onClick={applyCoupon}
                    disabled={
                      !!appliedCoupon ||
                      !coupon
                    }
                  >
                    {appliedCoupon ? "Applied" : "Apply"}
                  </button>

                </div>

                {/* SELECTED COUPON */}

                {coupon &&
                  !appliedCoupon && (
                    <div className="small text-muted mt-2">
                      Selected:{" "}
                      <strong>
                        {coupon}
                      </strong>
                    </div>
                  )}

                {/* APPLIED */}

                {appliedCoupon && (
                  <div className="coupon-applied-alert mt-2 d-flex justify-content-between align-items-center">

                    <div>
                      <span className="fw-bold">
                        ✓{" "}
                        {
                          appliedCoupon.couponCode
                        }{" "}
                        applied
                      </span>

                      <div className="small text-light opacity-75">
                        You saved ₹
                        {discount.toLocaleString(
                          "en-IN"
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-close btn-close-white small"
                      onClick={
                        removeCoupon
                      }
                    />
                  </div>
                )}

              </div>

              {/* GST */}

              <div className="summary-section-box mb-4">

                <label className="form-label text-muted small fw-bold mb-2">
                  <FaShieldAlt className="me-1 text-success" />

                  CORPORATE GST (OPTIONAL)
                </label>

                <div className="input-group shadow-sm">

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter 15-digit GSTIN"
                    value={
                      gstNumber
                    }
                    onChange={(e) =>
                      setGstNumber(
                        e.target.value.toUpperCase()
                      )
                    }
                    disabled={
                      gstApplied
                    }
                    maxLength={15}
                  />

                  <button
                    type="button"
                    className="btn btn-gst-verify px-4"
                    onClick={
                      applyGST
                    }
                    disabled={
                      gstApplied
                    }
                  >
                    {gstApplied
                      ? "Verified"
                      : "Verify"}
                  </button>

                </div>

                {gstApplied && (
                  <div className="text-success mt-1 small fw-semibold d-flex align-items-center gap-1">
                    <FaCheckCircle size={12} />

                    Tax Input Credit Enabled
                  </div>
                )}

              </div>

              {/* DIVIDER */}

              <div className="summary-divider"></div>

              {/* SUBTOTAL */}

              <div className="summary-row">

                <span className="summary-label">
                  Items Subtotal
                </span>

                <span className="summary-value">
                  ₹
                  {subTotal.toLocaleString(
                    "en-IN",
                    {
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>

              </div>

              {/* SHIPPING */}

              <div className="summary-row">

                <span className="summary-label">
                  Shipping Charges
                </span>

                <span className="summary-value text-success fw-bold">
                  FREE
                </span>

              </div>

              {/* GST */}

              <div className="summary-row">

                <span className="summary-label">
                  Estimated GST (18%)
                </span>

                <span
                  className={`summary-value ${
                    gstApplied
                      ? "summary-discount-red"
                      : ""
                  }`}
                >
                  {gstApplied
                    ? `- ₹${gst.toLocaleString(
                        "en-IN",
                        {
                          maximumFractionDigits: 2,
                        }
                      )}`
                    : `₹${gst.toLocaleString(
                        "en-IN",
                        {
                          maximumFractionDigits: 2,
                        }
                      )}`}
                </span>

              </div>

              {/* PLATFORM */}

              <div className="summary-row">

                <span className="summary-label">
                  Platform Fee
                </span>

                <span className="summary-value">
                  ₹9
                </span>

              </div>

              {/* COUPON DISCOUNT */}

              {discount > 0 && (
                <div className="summary-row">

                  <span className="summary-label text-danger fw-bold">
                    Coupon Savings
                  </span>

                  <span className="summary-value summary-discount-red fw-bold">
                    - ₹
                    {discount.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                </div>
              )}

              {/* DIVIDER */}

              <div className="summary-divider"></div>

              {/* GRAND TOTAL */}

              <div className="summary-row summary-total-row mb-4">

                <span className="fw-bold">
                  Grand Total
                </span>

                <span className="summary-price-highlight">
                  ₹
                  {total.toLocaleString(
                    "en-IN",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>

              </div>

              {/* CHECKOUT */}

              <button
                type="button"
                className="btn btn-primary checkout-btn w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                onClick={() =>
                  navigate(
                    "/checkout",
                    {
                      state: {
                        subTotal,
                        shipping,
                        gst,
                        platformFee,
                        gstApplied,
                        discount,
                        total,
                        appliedCoupon,
                      },
                    }
                  )
                }
              >
                Proceed To Checkout

                <FaArrowRight
                  size={14}
                />
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* DELETE / ADD TO WISHLIST MODAL */}
      {deleteModalItem && (
        <div
          className="cart-delete-modal-backdrop"
          onClick={() => setDeleteModalItem(null)}
        >
          <div
            className="cart-delete-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="cart-delete-modal-close"
              onClick={() => setDeleteModalItem(null)}
              aria-label="Close"
            >
              <FaTimes size={14} />
            </button>

            <div className="cart-delete-modal-header">
              <div className="cart-delete-modal-icon">
                <FaTrash size={20} />
              </div>
              <div>
                <h5 className="fw-bold mb-1">Remove Item from Cart?</h5>
                <p className="text-muted small mb-0">
                  Choose whether to delete this item or save it to your wishlist.
                </p>
              </div>
            </div>

            <div className="cart-delete-modal-product">
              {(() => {
                const rawImg =
                  deleteModalItem.thumbnail ||
                  deleteModalItem.image ||
                  (Array.isArray(deleteModalItem.images)
                    ? deleteModalItem.images[0]
                    : null);
                const modalImgSrc = rawImg
                  ? typeof rawImg === "string" &&
                    (rawImg.startsWith("http://") ||
                      rawImg.startsWith("https://") ||
                      rawImg.startsWith("data:"))
                    ? rawImg
                    : `https://fra.cloud.appwrite.io/v1/storage/buckets/${
                        import.meta.env.VITE_APPWRITE_BUCKET_ID
                      }/files/${rawImg}/view?project=${
                        import.meta.env.VITE_APPWRITE_PROJECT_ID
                      }`
                  : FALLBACK_PRODUCT_IMAGE;

                const itemFinalPrice =
                  deleteModalItem.price -
                  (deleteModalItem.price * (deleteModalItem.discount || 0)) /
                    100;

                return (
                  <>
                    <div className="cart-delete-modal-img-box">
                      <img
                        src={modalImgSrc}
                        alt={deleteModalItem.title || "Product"}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = FALLBACK_PRODUCT_IMAGE;
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-grow-1">
                      <h6 className="fw-bold mb-1 text-truncate">
                        {deleteModalItem.title ||
                          deleteModalItem.name ||
                          "Product"}
                      </h6>
                      <div className="fw-bold text-primary">
                        ₹{itemFinalPrice.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="cart-delete-modal-actions">
              <button
                type="button"
                className="cart-modal-btn cart-modal-btn-wishlist"
                onClick={() => {
                  const { quantity, ...wishlistProduct } = deleteModalItem;
                  dispatch(addWishlist(wishlistProduct));
                  dispatch(removeFromCart(deleteModalItem.$id));
                  setDeleteModalItem(null);
                  toast.success("Added to Wishlist & removed from Cart");
                }}
              >
                <FaHeart size={14} />
                <span>Add to Wishlist</span>
              </button>

              <button
                type="button"
                className="cart-modal-btn cart-modal-btn-delete"
                onClick={() => {
                  dispatch(removeFromCart(deleteModalItem.$id));
                  setDeleteModalItem(null);
                  toast.success("Item deleted from Cart");
                }}
              >
                <FaTrash size={13} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;