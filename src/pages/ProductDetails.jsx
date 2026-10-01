import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";

import { addToCart } from "../redux/slices/cartSlice";
import { addWishlist } from "../redux/slices/wishlistSlice";

import {
    FaStar,
    FaHeart,
    FaShoppingCart,
    FaCheckCircle,
    FaUserCircle,
    FaPen,
    FaRegStar,
    FaTimes,
} from "react-icons/fa";

import productService from "../appwrite/productService";
import reviewService from "../appwrite/reviewService";
import authService from "../appwrite/authService";
import orderService from "../appwrite/orderService";

import "../css/ProductDetails.css";


const FALLBACK_PRODUCT_IMAGE =
    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80";


function ProductDetails() {

    const { id } = useParams();

    const navigate = useNavigate();

    const dispatch = useDispatch();


  // PRODUCT STATE

    const [loading, setLoading] =
        useState(true);

    const [product, setProduct] =
        useState({});

    const [related, setRelated] =
        useState([]);


    const [selectedImage, setSelectedImage] =
        useState("");

    const [galleryImages, setGalleryImages] =
        useState([]);

    const [quantity, setQuantity] =
        useState(1);


  // REVIEW STATE

    const [reviews, setReviews] =
        useState([]);

    const [reviewsLoading, setReviewsLoading] =
        useState(true);


    const [currentUser, setCurrentUser] =
        useState(null);


    const [reviewRating, setReviewRating] =
        useState(5);

    const [reviewText, setReviewText] =
        useState("");


    const [reviewSubmitting, setReviewSubmitting] =
        useState(false);

    const [showReviewForm, setShowReviewForm] =
        useState(false);


  // PURCHASE VERIFICATION STATE

    const [purchaseChecking, setPurchaseChecking] =
        useState(false);

    const [purchaseVerified, setPurchaseVerified] =
        useState(false);

    const [purchasedOrder, setPurchasedOrder] =
        useState(null);


  // REVIEW HELPERS

    const approvedReviews = useMemo(() => {

        return reviews.filter(
            (review) =>
                String(
                    review.status || ""
                ).toLowerCase() === "approved"
        );

    }, [reviews]);


    const averageRating = useMemo(() => {

        if (!approvedReviews.length) {

            return Number(
                product.rating || 0
            );
        }


        const total =
            approvedReviews.reduce(
                (sum, review) =>
                    sum +
                    Number(
                        review.rating || 0
                    ),
                0
            );


        return (
            total /
            approvedReviews.length
        );

    }, [
        approvedReviews,
        product.rating,
    ]);


    const averageRatingDisplay =
        averageRating > 0
            ? averageRating.toFixed(1)
            : "0.0";


    const reviewCount =
        approvedReviews.length;


  // IMAGE HELPER

    const formatImg = (img) => {
        if (!img || typeof img !== "string" || !img.trim()) {
            return FALLBACK_PRODUCT_IMAGE;
        }

        if (
            img.startsWith("http://") ||
            img.startsWith("https://") ||
            img.startsWith("data:")
        ) {
            return img;
        }

        return `https://fra.cloud.appwrite.io/v1/storage/buckets/${
            import.meta.env.VITE_APPWRITE_BUCKET_ID
        }/files/${img}/view?project=${
            import.meta.env.VITE_APPWRITE_PROJECT_ID
        }`;
    };


    const handleImgError = (e) => {

        e.currentTarget.onerror =
            null;

        e.currentTarget.src =
            FALLBACK_PRODUCT_IMAGE;
    };


  // LOAD PRODUCT + RELATED + USER + REVIEWS

    useEffect(() => {

        let isMounted = true;


        window.scrollTo(
            0,
            0
        );


        const loadProductPage =
            async () => {

                setLoading(true);

                setReviewsLoading(true);


                try {

  // PRODUCT

                    const productData =
                        await productService.getProduct(
                            id
                        );


                    if (!isMounted) {
                        return;
                    }


                    if (!productData?.$id) {

                        toast.error(
                            "Product not found."
                        );

                        navigate(
                            "/products"
                        );

                        return;
                    }


                    setProduct(
                        productData
                    );


  // IMAGES

                    const mainImg =
                        formatImg(
                            productData.thumbnail
                        ) ||
                        FALLBACK_PRODUCT_IMAGE;


                    setSelectedImage(
                        mainImg
                    );


                    let imagesArray = [];


                    if (mainImg) {

                        imagesArray.push(
                            mainImg
                        );
                    }


                    if (
                        productData.image
                    ) {

                        imagesArray.push(
                            formatImg(
                                productData.image
                            )
                        );
                    }


                    if (
                        productData.image2
                    ) {

                        imagesArray.push(
                            formatImg(
                                productData.image2
                            )
                        );
                    }


                    if (
                        imagesArray.length ===
                        1
                    ) {

                        imagesArray = [
                            mainImg,
                            mainImg,
                            mainImg,
                        ];
                    }


                    setGalleryImages(
                        imagesArray
                    );


  // CURRENT USER

                    try {

                        const user =
                            await authService.getCurrentUser();


                        if (isMounted) {

                            setCurrentUser(
                                user || null
                            );
                        }

                    } catch {

                        if (isMounted) {

                            setCurrentUser(
                                null
                            );
                        }
                    }


  // REVIEWS

                    try {

                        const reviewResponse =
                            await reviewService.getReviewsByProduct(
                                productData.$id
                            );


                        if (isMounted) {

                            const reviewDocuments =
                                Array.isArray(
                                    reviewResponse
                                )
                                    ? reviewResponse
                                    : reviewResponse?.documents ||
                                      [];


                            setReviews(
                                reviewDocuments
                            );
                        }

                    } catch (reviewError) {

                        console.error(
                            "Failed to load product reviews:",
                            reviewError
                        );


                        if (isMounted) {

                            setReviews([]);
                        }

                    } finally {

                        if (isMounted) {

                            setReviewsLoading(
                                false
                            );
                        }
                    }


  // RELATED PRODUCTS

                    try {

                        const response =
                            await productService.getProducts();


                        if (isMounted) {

                            const products =
                                response?.documents ||
                                [];


                            const relatedProducts =
                                products.filter(
                                    (item) =>
                                        item.category
                                            ?.trim()
                                            .toLowerCase() ===
                                            productData.category
                                                ?.trim()
                                                .toLowerCase() &&
                                        item.$id !==
                                            productData.$id
                                );


                            setRelated(
                                relatedProducts
                            );
                        }

                    } catch (relatedError) {

                        console.error(
                            "Failed to load related products:",
                            relatedError
                        );


                        if (isMounted) {

                            setRelated([]);
                        }
                    }

                } catch (error) {

                    console.error(
                        "Error loading product details:",
                        error
                    );


                    if (isMounted) {

                        toast.error(
                            "Unable to load product."
                        );
                    }

                } finally {

                    if (isMounted) {

                        setLoading(false);
                    }
                }
            };


        loadProductPage();


        return () => {

            isMounted = false;
        };

    }, [
        id,
        navigate,
    ]);


  // QUANTITY

    const increaseQuantity = () => {

        const stock =
            Number(
                product.stock || 0
            );


        if (
            quantity >= stock
        ) {

            toast.error(
                `Only ${stock} item(s) available.`
            );

            return;
        }


        setQuantity(
            (previous) =>
                previous + 1
        );
    };


    const decreaseQuantity = () => {

        setQuantity(
            (previous) =>
                previous > 1
                    ? previous - 1
                    : 1
        );
    };


  // CART

    function addCart() {

        if (
            Number(
                product.stock || 0
            ) <= 0
        ) {

            toast.error(
                "This product is currently out of stock."
            );

            return;
        }


        dispatch(
            addToCart({
                ...product,
                quantity,
            })
        );


        toast.success(
            "Product added to cart 🛒"
        );
    }


  // BUY NOW

    function buyNow() {

        if (
            Number(
                product.stock || 0
            ) <= 0
        ) {

            toast.error(
                "This product is currently out of stock."
            );

            return;
        }


        dispatch(
            addToCart({
                ...product,
                quantity,
            })
        );


        navigate(
            "/checkout"
        );
    }


  // CHECK DUPLICATE REVIEW

    const hasAlreadyReviewed =
        useMemo(() => {

            if (
                !currentUser?.$id
            ) {

                return false;
            }


            return reviews.some(
                (review) =>
                    String(
                        review.userId || ""
                    ) ===
                    String(
                        currentUser.$id
                    )
            );

        }, [
            reviews,
            currentUser,
        ]);


  // VERIFY PURCHASE + DELIVERY

    const verifyProductPurchase =
        async () => {

            if (
                !currentUser?.$id ||
                !product?.$id
            ) {

                return false;
            }


            try {

                setPurchaseChecking(
                    true
                );


                const verification =
                    await orderService.getDeliveredOrderForProduct(
                        currentUser.$id,
                        product.$id
                    );


                if (
                    verification?.verified &&
                    verification?.order
                ) {

                    setPurchaseVerified(
                        true
                    );


                    setPurchasedOrder(
                        verification
                    );


                    return true;
                }


                setPurchaseVerified(
                    false
                );


                setPurchasedOrder(
                    null
                );


                return false;

            } catch (error) {

                console.error(
                    "Purchase verification error:",
                    error
                );


                setPurchaseVerified(
                    false
                );


                setPurchasedOrder(
                    null
                );


                return false;

            } finally {

                setPurchaseChecking(
                    false
                );
            }
        };


  // REVIEW LOGIN + PURCHASE CHECK

    const handleOpenReviewForm =
        async () => {

            if (
                !currentUser
            ) {

                toast.error(
                    "Please login to write a review."
                );

                navigate(
                    "/login"
                );

                return;
            }


            if (
                !product?.$id
            ) {

                toast.error(
                    "Product information is unavailable."
                );

                return;
            }


  // DUPLICATE REVIEW CHECK

            if (
                hasAlreadyReviewed
            ) {

                toast.error(
                    "You have already submitted a review for this product."
                );

                return;
            }


  // PURCHASE + DELIVERY CHECK

            const verified =
                await verifyProductPurchase();


            if (!verified) {

                toast.error(
                    "You can review this product after purchasing and receiving it."
                );

                return;
            }


            setShowReviewForm(
                true
            );
        };


  // SUBMIT REVIEW

    const handleReviewSubmit =
        async (e) => {

            e.preventDefault();


  // LOGIN CHECK

            if (
                !currentUser?.$id
            ) {

                toast.error(
                    "Please login before submitting a review."
                );

                navigate(
                    "/login"
                );

                return;
            }


  // DUPLICATE CHECK

            if (
                hasAlreadyReviewed
            ) {

                toast.error(
                    "You have already submitted a review for this product."
                );

                return;
            }


  // PURCHASE CHECK

            if (
                !purchaseVerified ||
                !purchasedOrder?.order
            ) {

                const verified =
                    await verifyProductPurchase();


                if (!verified) {

                    toast.error(
                        "You can review this product only after purchasing and receiving it."
                    );

                    return;
                }
            }


  // REVIEW TEXT

            const cleanReview =
                reviewText.trim();


            if (
                !cleanReview
            ) {

                toast.error(
                    "Please write your review."
                );

                return;
            }


            if (
                cleanReview.length <
                5
            ) {

                toast.error(
                    "Review must contain at least 5 characters."
                );

                return;
            }


            if (
                cleanReview.length >
                2000
            ) {

                toast.error(
                    "Review cannot exceed 2000 characters."
                );

                return;
            }


            try {

                setReviewSubmitting(
                    true
                );


  // CUSTOMER DETAILS

                const customerName =
                    currentUser.name?.trim() ||
                    currentUser.email?.split(
                        "@"
                    )[0] ||
                    "Customer";


                const customerEmail =
                    currentUser.email ||
                    "";


  // REVIEW DATA

                const reviewData = {

                    productId:
                        String(
                            product.$id
                        ),

                    productName:
                        String(
                            product.title ||
                            product.name ||
                            "Product"
                        ),

                    userId:
                        String(
                            currentUser.$id
                        ),

                    customerName:
                        String(
                            customerName
                        ),

                    customerEmail:
                        String(
                            customerEmail
                        ),

                    rating:
                        Number(
                            reviewRating
                        ),

                    review:
                        cleanReview,

                    status:
                        "Pending",

                    orderId:
                        String(
                            purchasedOrder?.order?.orderId ||
                            purchasedOrder?.order?.$id ||
                            ""
                        ),

                    createdAt:
                        new Date().toISOString(),
                };


  // CREATE REVIEW

                const createdReview =
                    await reviewService.createReview(
                        reviewData
                    );


                if (
                    createdReview?.$id
                ) {

                    setReviews(
                        (previous) => [
                            createdReview,
                            ...previous,
                        ]
                    );
                }


  // RESET

                setReviewText("");

                setReviewRating(
                    5
                );

                setShowReviewForm(
                    false
                );

                setPurchaseVerified(
                    false
                );

                setPurchasedOrder(
                    null
                );


                toast.success(
                    "Review submitted successfully! It is waiting for admin approval. ⭐"
                );


            } catch (error) {

                console.error(
                    "Review submission error:",
                    error
                );


                toast.error(
                    error?.message ||
                    "Unable to submit review. Please try again."
                );


            } finally {

                setReviewSubmitting(
                    false
                );
            }
        };


  // STAR RENDER

    const renderStars =
        (
            rating,
            size = 14
        ) => {

            const numericRating =
                Math.round(
                    Number(
                        rating || 0
                    )
                );


            return (
                <span className="product-review-stars">

                    {[1, 2, 3, 4, 5].map(
                        (star) =>
                            star <=
                            numericRating ? (

                                <FaStar
                                    key={star}
                                    size={size}
                                    className="review-star-filled"
                                />

                            ) : (

                                <FaRegStar
                                    key={star}
                                    size={size}
                                    className="review-star-empty"
                                />

                            )
                    )}

                </span>
            );
        };


  // DATE FORMAT

    const formatReviewDate =
        (date) => {

            if (!date) {
                return "";
            }


            const parsedDate =
                new Date(date);


            if (
                Number.isNaN(
                    parsedDate.getTime()
                )
            ) {

                return "";
            }


            return parsedDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }
            );
        };


  // LOADING

    if (loading) {

        return (

            <div className="product-details-page">

                <div className="container py-5">

                    <div className="product-details-skeleton">

                        <div className="skeleton skeleton-image"></div>


                        <div className="skeleton-content">

                            <div className="skeleton skeleton-small"></div>

                            <div className="skeleton skeleton-title"></div>

                            <div className="skeleton skeleton-rating"></div>

                            <div className="skeleton skeleton-price"></div>

                            <div className="skeleton skeleton-text"></div>

                            <div className="skeleton skeleton-text short"></div>

                            <div className="skeleton skeleton-btn"></div>

                        </div>

                    </div>

                </div>

            </div>
        );
    }


  // PRODUCT CALCULATIONS

    const originalPrice =
        Number(
            product.price || 0
        );


    const oldPrice =
        originalPrice > 0
            ? Math.round(
                  originalPrice * 1.25
              )
            : 0;


    const stock =
        Number(
            product.stock || 0
        );


    const isOutOfStock =
        stock <= 0;


  // UI

    return (

        <div className="product-details-page">

            <div className="container py-5">


                {/* MAIN PRODUCT */}

                <div className="row g-5 align-items-start product-details-card p-4 p-lg-5 mb-5">


                    {/* IMAGE */}

                    <div className="col-lg-6">

                        <div className="main-image-wrapper">

                            <img
                                src={
                                    selectedImage
                                }
                                alt={
                                    product.title ||
                                    "Product"
                                }
                                className="main-product-img"
                                referrerPolicy="no-referrer"
                                onError={
                                    handleImgError
                                }
                            />

                        </div>


                        <div className="thumbs-container">

                            {galleryImages.map(
                                (
                                    imgUrl,
                                    index
                                ) => (

                                    <button
                                        type="button"
                                        key={`${imgUrl}-${index}`}
                                        className={`thumb-box ${
                                            selectedImage ===
                                            imgUrl
                                                ? "active-thumb"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            setSelectedImage(
                                                imgUrl
                                            )
                                        }
                                    >

                                        <img
                                            src={
                                                imgUrl
                                            }
                                            alt={`Product view ${
                                                index +
                                                1
                                            }`}
                                            referrerPolicy="no-referrer"
                                            onError={
                                                handleImgError
                                            }
                                        />

                                    </button>

                                )
                            )}

                        </div>

                    </div>


                    {/* PRODUCT INFO */}

                    <div className="col-lg-6 product-info-col">

                        <span className="product-brand-badge">

                            {product.brand ||
                                "TechStore Exclusive"}

                        </span>


                        <h1 className="product-main-title mt-3">

                            {product.title}

                        </h1>


                        {/* DYNAMIC RATING */}

                        <div className="rating-wrap my-3">

                            {renderStars(
                                averageRating,
                                16
                            )}

                            <span className="rating-value">

                                {averageRatingDisplay}

                            </span>


                            <span className="rating-count">

                                {reviewCount > 0
                                    ? `(${reviewCount} ${
                                          reviewCount ===
                                          1
                                              ? "Review"
                                              : "Reviews"
                                      })`
                                    : "(No reviews yet)"}

                            </span>

                        </div>


                        <div className="price-wrap my-3">

                            <h2 className="price">

                                ₹
                                {originalPrice.toLocaleString(
                                    "en-IN"
                                )}

                            </h2>


                            {oldPrice > 0 && (

                                <h5 className="old-price">

                                    ₹
                                    {oldPrice.toLocaleString(
                                        "en-IN"
                                    )}

                                </h5>

                            )}

                        </div>


                        <p className="product-description mb-4">

                            {product.description ||
                                "Experience supreme performance and sleek modern aesthetics designed for your everyday lifestyle needs."}

                        </p>


                        {/* META */}

                        <div className="meta-info mb-4">

                            <div className="meta-item">

                                <span className="label">

                                    Category:

                                </span>


                                <span className="value">

                                    {product.category ||
                                        "Uncategorized"}

                                </span>

                            </div>


                            <div className="meta-item mt-2">

                                <span className="label">

                                    Availability:

                                </span>


                                <span
                                    className={`value ${
                                        isOutOfStock
                                            ? "stock stock-out"
                                            : "stock"
                                    }`}
                                >

                                    <FaCheckCircle className="me-1" />


                                    {isOutOfStock
                                        ? "Out of Stock"
                                        : `${stock} In Stock`}

                                </span>

                            </div>

                        </div>


                        {/* QUANTITY */}

                        {!isOutOfStock && (

                            <div className="qty-section mb-4">

                                <span className="label me-3 fw-bold">

                                    Quantity:

                                </span>


                                <div className="quantity-box">

                                    <button
                                        type="button"
                                        className="quantity-btn"
                                        onClick={
                                            decreaseQuantity
                                        }
                                    >

                                        -

                                    </button>


                                    <span className="qty-value">

                                        {quantity}

                                    </span>


                                    <button
                                        type="button"
                                        className="quantity-btn"
                                        onClick={
                                            increaseQuantity
                                        }
                                    >

                                        +

                                    </button>

                                </div>

                            </div>

                        )}


                        {/* ACTIONS */}

                        <div className="buttons-group">

                            <button
                                type="button"
                                className="add-cart-btn"
                                onClick={
                                    addCart
                                }
                                disabled={
                                    isOutOfStock
                                }
                            >

                                <FaShoppingCart />


                                {isOutOfStock
                                    ? "Out of Stock"
                                    : "Add To Cart"}

                            </button>


                            <button
                                type="button"
                                className="buy-now-btn"
                                onClick={
                                    buyNow
                                }
                                disabled={
                                    isOutOfStock
                                }
                            >

                                Buy Now

                            </button>


                            <button
                                type="button"
                                className="wishlist-action-btn"
                                onClick={() =>
                                    dispatch(
                                        addWishlist(
                                            product
                                        )
                                    )
                                }
                                title="Add to Wishlist"
                            >

                                <FaHeart />

                            </button>

                        </div>

                    </div>

                </div>


                {/* SPECIFICATIONS */}

                <div className="specs-card p-4 p-lg-5 mb-5">

                    <h3 className="section-title mb-4">

                        Technical Specifications

                    </h3>


                    <div className="table-responsive">

                        <table className="table custom-specs-table m-0">

                            <tbody>

                                <tr>

                                    <th>
                                        Brand
                                    </th>

                                    <td>

                                        {product.brand ||
                                            "TechStore"}

                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Category
                                    </th>

                                    <td>

                                        {product.category ||
                                            "N/A"}

                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Price
                                    </th>

                                    <td>

                                        ₹
                                        {originalPrice.toLocaleString(
                                            "en-IN"
                                        )}

                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Stock Units
                                    </th>

                                    <td>

                                        {stock} Units Available

                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Customer Rating
                                    </th>

                                    <td>

                                        <div className="spec-rating">

                                            {renderStars(
                                                averageRating,
                                                14
                                            )}

                                            <span>

                                                {averageRatingDisplay}
                                                {" / 5"}

                                            </span>

                                        </div>

                                    </td>

                                </tr>


                                <tr>

                                    <th>
                                        Total Reviews
                                    </th>

                                    <td>

                                        {reviewCount}

                                    </td>

                                </tr>

                            </tbody>

                        </table>

                    </div>

                </div>


                {/* CUSTOMER REVIEWS */}

                <div className="reviews-card specs-card p-4 p-lg-5 mb-5">


                    {/* REVIEW HEADER */}

                    <div className="reviews-section-header">

                        <div>

                            <span className="reviews-eyebrow">

                                Customer Experience

                            </span>


                            <h3 className="section-title mb-1">

                                Customer Reviews

                            </h3>


                            <p className="reviews-summary">

                                {reviewCount > 0
                                    ? `${reviewCount} verified review${
                                          reviewCount ===
                                          1
                                              ? ""
                                              : "s"
                                      }`
                                    : "Be the first to review this product"}

                            </p>

                        </div>


                        <div className="reviews-summary-rating">

                            <div className="big-rating">

                                {averageRatingDisplay}

                            </div>


                            {renderStars(
                                averageRating,
                                16
                            )}


                            <small>

                                {reviewCount} Reviews

                            </small>

                        </div>

                    </div>


                    {/* WRITE REVIEW */}

                    <div className="write-review-wrapper">


                        {/* NOT LOGGED IN */}

                        {!currentUser ? (

                            <div className="review-login-box">

                                <div className="review-login-icon">

                                    <FaUserCircle />

                                </div>


                                <div>

                                    <h5>

                                        Want to review this
                                        product?

                                    </h5>


                                    <p>

                                        Login to share your
                                        experience with other
                                        customers.

                                    </p>

                                </div>


                                <button
                                    type="button"
                                    className="review-login-btn"
                                    onClick={() =>
                                        navigate(
                                            "/login"
                                        )
                                    }
                                >

                                    Login

                                </button>

                            </div>


                        ) : hasAlreadyReviewed ? (

                            /* ALREADY REVIEWED */

                            <div className="review-submitted-box">

                                <FaCheckCircle />


                                <div>

                                    <h5>

                                        Review already
                                        submitted

                                    </h5>


                                    <p>

                                        You have already
                                        submitted a review for
                                        this product.

                                    </p>

                                </div>

                            </div>


                        ) : !showReviewForm ? (

                            /* WRITE REVIEW BUTTON */

                            <div className="review-action-area">

                                <p className="review-purchase-note">

                                    <FaCheckCircle />

                                    Only customers who have
                                    purchased and received this
                                    product can submit a review.

                                </p>


                                <button
                                    type="button"
                                    className="open-review-btn"
                                    onClick={
                                        handleOpenReviewForm
                                    }
                                    disabled={
                                        purchaseChecking
                                    }
                                >

                                    {purchaseChecking ? (

                                        <>

                                            <span className="review-btn-spinner"></span>

                                            Checking Purchase...

                                        </>

                                    ) : (

                                        <>

                                            <FaPen />

                                            Write a Review

                                        </>

                                    )}

                                </button>

                            </div>


                        ) : (

                            /* REVIEW FORM */

                            <form
                                onSubmit={
                                    handleReviewSubmit
                                }
                                className="review-form"
                            >

                                <div className="review-form-header">

                                    <div>

                                        <h5>

                                            Write Your Review

                                        </h5>


                                        <p>

                                            Your review will be
                                            visible after admin
                                            approval.

                                        </p>

                                    </div>


                                    <button
                                        type="button"
                                        className="close-review-form"
                                        onClick={() =>
                                            setShowReviewForm(
                                                false
                                            )
                                        }
                                    >

                                        <FaTimes />

                                    </button>

                                </div>


                                {/* PURCHASE VERIFIED */}

                                <div className="review-purchase-verified">

                                    <FaCheckCircle />

                                    <div>

                                        <strong>
                                            Purchase Verified
                                        </strong>

                                        <span>
                                            You purchased and received
                                            this product.
                                        </span>

                                    </div>

                                </div>


                                {/* LOGGED USER */}

                                <div className="review-user-preview">

                                    <FaUserCircle />


                                    <div>

                                        <strong>

                                            {currentUser.name ||
                                                currentUser.email?.split(
                                                    "@"
                                                )[0] ||
                                                "Customer"}

                                        </strong>


                                        <span>

                                            {currentUser.email}

                                        </span>

                                    </div>

                                </div>


                                {/* RATING */}

                                <div className="review-rating-selector">

                                    <label>

                                        Your Rating

                                    </label>


                                    <div className="interactive-stars">

                                        {[1, 2, 3, 4, 5].map(
                                            (star) => (

                                                <button
                                                    type="button"
                                                    key={star}
                                                    className={
                                                        star <=
                                                        reviewRating
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        setReviewRating(
                                                            star
                                                        )
                                                    }
                                                    aria-label={`${star} star`}
                                                >

                                                    <FaStar />

                                                </button>

                                            )
                                        )}


                                        <span>

                                            {reviewRating}/5

                                        </span>

                                    </div>

                                </div>


                                {/* REVIEW */}

                                <div className="review-textarea-wrapper">

                                    <label htmlFor="product-review">

                                        Your Review

                                    </label>


                                    <textarea
                                        id="product-review"
                                        className="review-input"
                                        rows="5"
                                        maxLength={2000}
                                        placeholder="Tell other customers about your experience..."
                                        value={
                                            reviewText
                                        }
                                        onChange={(e) =>
                                            setReviewText(
                                                e.target.value
                                            )
                                        }
                                        required
                                    />


                                    <div className="review-character-count">

                                        {reviewText.length}/2000

                                    </div>

                                </div>


                                {/* ACTIONS */}

                                <div className="review-form-actions">

                                    <button
                                        type="button"
                                        className="cancel-review-btn"
                                        onClick={() =>
                                            setShowReviewForm(
                                                false
                                            )
                                        }
                                        disabled={
                                            reviewSubmitting
                                        }
                                    >

                                        Cancel

                                    </button>


                                    <button
                                        type="submit"
                                        className="submit-review-btn"
                                        disabled={
                                            reviewSubmitting
                                        }
                                    >

                                        {reviewSubmitting ? (

                                            <>

                                                <span className="review-btn-spinner"></span>

                                                Submitting...

                                            </>

                                        ) : (

                                            <>

                                                Submit Review

                                            </>

                                        )}

                                    </button>

                                </div>

                            </form>
                        )}

                    </div>


                    {/* REVIEW LIST */}

                    <div className="reviews-list">

                        {reviewsLoading ? (

                            <div className="reviews-loading">

                                <span className="reviews-loader"></span>


                                <p>

                                    Loading customer reviews...

                                </p>

                            </div>


                        ) : approvedReviews.length ===
                          0 ? (

                            <div className="no-reviews-box">

                                <div className="no-reviews-icon">

                                    <FaRegStar />

                                </div>


                                <h5>

                                    No approved reviews yet

                                </h5>


                                <p>

                                    Be the first customer to
                                    share your experience.

                                </p>

                            </div>


                        ) : (

                            approvedReviews.map(
                                (review) => (

                                    <div
                                        key={
                                            review.$id ||
                                            review.id
                                        }
                                        className="review-item"
                                    >

                                        <div className="review-item-top">

                                            <div className="review-author">

                                                <div className="review-author-avatar">

                                                    {review.customerName
                                                        ?.charAt(
                                                            0
                                                        )
                                                        ?.toUpperCase() ||
                                                        "C"}

                                                </div>


                                                <div>

                                                    <h6>

                                                        {
                                                            review.customerName
                                                        }

                                                    </h6>


                                                    <span>

                                                        {formatReviewDate(
                                                            review.createdAt ||
                                                                review.$createdAt
                                                        )}

                                                    </span>

                                                </div>

                                            </div>


                                            <div className="review-item-rating">

                                                {renderStars(
                                                    review.rating,
                                                    13
                                                )}

                                            </div>

                                        </div>


                                        <p className="review-item-text">

                                            {review.review}

                                        </p>

                                    </div>

                                )
                            )
                        )}

                    </div>

                </div>


                {/* RELATED PRODUCTS */}

                {related.length > 0 && (

                    <div className="related-section mt-5">

                        <div className="related-heading">

                            <div>

                                <span className="reviews-eyebrow">

                                    You May Also Like

                                </span>


                                <h2 className="section-title mb-0">

                                    Similar Products

                                </h2>

                            </div>

                        </div>


                        <div className="row g-4 mt-1">

                            {related
                                .slice(0, 4)
                                .map((item) => {

                                    const imageUrl =
                                        formatImg(
                                            item.thumbnail
                                        ) ||
                                        FALLBACK_PRODUCT_IMAGE;


                                    return (

                                        <div
                                            className="col-lg-3 col-md-6 col-6"
                                            key={
                                                item.$id
                                            }
                                        >

                                            <div
                                                className="related-card"
                                                onClick={() =>
                                                    navigate(
                                                        `/product/${item.$id}`
                                                    )
                                                }
                                            >

                                                <div className="related-img-box">

                                                    <img
                                                        src={
                                                            imageUrl
                                                        }
                                                        alt={
                                                            item.title ||
                                                            "Product"
                                                        }
                                                        referrerPolicy="no-referrer"
                                                        onError={
                                                            handleImgError
                                                        }
                                                    />

                                                </div>


                                                <div className="related-body">

                                                    <h6>

                                                        {
                                                            item.title
                                                        }

                                                    </h6>


                                                    <div className="related-rating">

                                                        {renderStars(
                                                            item.rating ||
                                                                0,
                                                            11
                                                        )}

                                                    </div>


                                                    <p className="related-price">

                                                        ₹
                                                        {Number(
                                                            item.price ||
                                                                0
                                                        ).toLocaleString(
                                                            "en-IN"
                                                        )}

                                                    </p>

                                                </div>

                                            </div>

                                        </div>

                                    );
                                })}

                        </div>

                    </div>

                )}

            </div>

        </div>
    );
}


export default ProductDetails;