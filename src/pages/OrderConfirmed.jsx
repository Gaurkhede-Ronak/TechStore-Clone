import { useEffect, useMemo } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { useSelector } from "react-redux";

import { motion } from "framer-motion";

import confetti from "canvas-confetti";

import {
    FaCheckCircle,
    FaCreditCard,
    FaCalendarAlt,
    FaEnvelope,
    FaShieldAlt,
    FaShoppingBag,
    FaWallet,
    FaTag,
} from "react-icons/fa";

import "../css/OrderConfirmed.css";

function OrderConfirmed() {
    const navigate = useNavigate();
    const location = useLocation();

  // REDUX USER

    const { user } = useSelector(
        (state) => state.auth
    );

  // ORDER DATA

    const order = useMemo(() => {
        const stateOrder =
            location.state &&
            Object.keys(location.state).length > 0
                ? location.state
                : {};

        return stateOrder;
    }, [location.state]);

  // CUSTOMER DETAILS

    const displayName =
        user?.name ||
        order?.fullName ||
        "Valued Customer";

    const displayEmail =
        user?.email ||
        order?.email ||
        "customer@example.com";

  // PAYMENT DETAILS

    /*
     * IMPORTANT:
     *
     * Checkout stores:
     *
     * orderGrandTotal = actual order total BEFORE wallet
     * total           = remaining payable amount
     * walletPaid      = amount paid from wallet
     * onlinePaid      = UPI/Card amount
     *
     * Example:
     *
     * Order Total  = ₹1000
     * Wallet       = ₹300
     * UPI          = ₹700
     * Total Paid   = ₹1000
     *
     * So Order Total must NOT directly use order.total
     * because order.total can represent only the remaining
     * payable amount after wallet deduction.
     */

    const walletPaid = Math.max(
        0,
        Number(order?.walletPaid ?? 0)
    );

    const payableAmount = Math.max(
        0,
        Number(
            order?.payableAmount ??
            order?.total ??
            0
        )
    );

    const totalAmount = Math.max(
        0,
        Number(
            order?.orderGrandTotal ??
            order?.totalOrderAmount ??
            order?.grandTotal ??
            order?.totalBeforeWallet ??
            order?.finalTotal ??
            (payableAmount + walletPaid)
        )
    );

    /*
     * Prefer explicit onlinePaid.
     *
     * Otherwise calculate:
     * UPI + Card
     *
     * This avoids the old problem where:
     *
     * cardPaid = 0
     *
     * caused UPI payment to incorrectly show ₹0.
     */

    const explicitOnlinePaid =
        order?.onlinePaid !== undefined &&
        order?.onlinePaid !== null
            ? Number(order.onlinePaid)
            : Number(order?.upiPaid || 0) +
              Number(order?.cardPaid || 0);

    const onlinePaid = Math.max(
        0,
        Number.isFinite(explicitOnlinePaid) &&
            explicitOnlinePaid > 0
            ? explicitOnlinePaid
            : Math.max(
                  0,
                  totalAmount - walletPaid
              )
    );

    const totalPaid = Math.max(
        0,
        Number(
            order?.totalPaid ??
            (walletPaid + onlinePaid)
        )
    );

    const paymentMethod =
        order?.payment || "UPI";

    const paymentStatus =
        order?.paymentStatus || "PAID";

    const transactionId =
        order?.transactionId ||
        "N/A";

    const orderId =
        order?.orderId ||
        order?.$id ||
        "N/A";

    const invoiceNo =
        order?.invoiceNo ||
        "N/A";

  // PRICE BREAKDOWN

    const subtotal = Number(
        order?.subTotal || 0
    );

    const shipping = Number(
        order?.shipping || 0
    );

    const gst = Number(
        order?.gst || 0
    );

    const discount = Number(
        order?.discount || 0
    );

    const couponCode =
        order?.couponCode || "";

  // DELIVERY DATE

    const estimatedDeliveryDate =
        order?.estimatedDeliveryDate;

    const deliveryDate = useMemo(() => {
        if (estimatedDeliveryDate) {
            const parsed =
                new Date(
                    estimatedDeliveryDate
                );

            if (
                !Number.isNaN(
                    parsed.getTime()
                )
            ) {
                return parsed;
            }
        }

        const fallback =
            new Date();

        fallback.setDate(
            fallback.getDate() + 5
        );

        return fallback;
    }, [estimatedDeliveryDate]);

    const formattedDeliveryDate =
        deliveryDate.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );

  // PAYMENT LABEL

    const paymentLabel =
        walletPaid > 0 && onlinePaid > 0
            ? `${paymentMethod} + Wallet`
            : walletPaid > 0 &&
                onlinePaid <= 0
                ? "Wallet"
                : paymentMethod;

  // CONFETTI

    useEffect(() => {
        const end =
            Date.now() + 1800;

        const timer =
            setInterval(() => {
                if (Date.now() > end) {
                    clearInterval(timer);
                    return;
                }

                confetti({
                    particleCount: 5,
                    spread: 360,
                    startVelocity: 25,
                    ticks: 90,
                    origin: {
                        x: Math.random(),
                        y:
                            Math.random() *
                            0.4,
                    },
                });
            }, 120);

        return () =>
            clearInterval(timer);
    }, []);

  // MONEY FORMAT

    const money = (value) =>
        Number(value || 0).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        );

  // UI

    return (
        <div className="order-page">

            {/* BACKGROUND */}

            <div className="bg-circle bg1"></div>
            <div className="bg-circle bg2"></div>
            <div className="bg-circle bg3"></div>

            {/* ORDER CARD */}

            <motion.div
                className="order-card"

                initial={{
                    opacity: 0,
                    rotateX: 30,
                    rotateY: -10,
                    y: 100,
                    scale: 0.9,
                }}

                animate={{
                    opacity: 1,
                    rotateX: 0,
                    rotateY: 0,
                    y: 0,
                    scale: 1,
                }}

                transition={{
                    duration: 0.9,
                    type: "spring",
                    stiffness: 85,
                }}
            >

                {/* HERO */}

                <motion.div
                    className="hero-section"

                    initial={{
                        opacity: 0,
                        y: 40,
                    }}

                    animate={{
                        opacity: 1,
                        y: 0,
                    }}

                    transition={{
                        delay: 0.2,
                        duration: 0.6,
                    }}
                >

                    <motion.div
                        className="success-ring"

                        initial={{
                            scale: 0,
                            rotate: 180,
                        }}

                        animate={{
                            scale: 1,
                            rotate: 0,
                        }}

                        transition={{
                            delay: 0.4,
                            type: "spring",
                            stiffness: 140,
                        }}
                    >
                        <FaCheckCircle
                            className="success-icon"
                        />
                    </motion.div>

                    <motion.span
                        className="confirmed-badge"

                        initial={{
                            opacity: 0,
                        }}

                        animate={{
                            opacity: 1,
                        }}

                        transition={{
                            delay: 0.7,
                        }}
                    >
                        ✔ ORDER CONFIRMED
                    </motion.span>

                    <motion.h1
                        initial={{
                            opacity: 0,
                            y: 15,
                        }}

                        animate={{
                            opacity: 1,
                            y: 0,
                        }}

                        transition={{
                            delay: 0.9,
                        }}
                    >
                        Thank You,{" "}
                        <span className="highlight-name">
                            {displayName}
                        </span>
                    </motion.h1>

                    <motion.p
                        className="hero-subtext"

                        initial={{
                            opacity: 0,
                        }}

                        animate={{
                            opacity: 1,
                        }}

                        transition={{
                            delay: 1.1,
                        }}
                    >
                        Your order has been
                        placed successfully.
                        <br />
                        Your order details are
                        ready below.
                    </motion.p>

                    <motion.div
                        className="email-chip"

                        initial={{
                            opacity: 0,
                            scale: 0.8,
                        }}

                        animate={{
                            opacity: 1,
                            scale: 1,
                        }}

                        transition={{
                            delay: 1.3,
                        }}
                    >
                        <FaEnvelope
                            className="chip-icon"
                        />

                        <span>
                            {displayEmail}
                        </span>
                    </motion.div>

                </motion.div>

                {/* SUMMARY CARDS */}

                <motion.div
                    className="summary-grid"

                    initial="hidden"

                    animate="show"

                    variants={{
                        hidden: {},

                        show: {
                            transition: {
                                staggerChildren: 0.12,
                            },
                        },
                    }}
                >

                    {/* PAYMENT */}

                    <motion.div
                        className="summary-card"

                        variants={{
                            hidden: {
                                opacity: 0,
                                y: 30,
                            },

                            show: {
                                opacity: 1,
                                y: 0,
                            },
                        }}
                    >
                        <FaCreditCard
                            className="summary-icon icon-success"
                        />

                        <small>
                            Payment Status
                        </small>

                        <h5>
                            {paymentLabel}
                        </h5>

                        <span className="status-badge success-text">
                            {paymentStatus === "PAID"
                                ? "Paid Successfully"
                                : paymentStatus}
                        </span>
                    </motion.div>

                    {/* DELIVERY */}

                    <motion.div
                        className="summary-card"

                        variants={{
                            hidden: {
                                opacity: 0,
                                y: 30,
                            },

                            show: {
                                opacity: 1,
                                y: 0,
                            },
                        }}
                    >
                        <FaCalendarAlt
                            className="summary-icon icon-primary"
                        />

                        <small>
                            Estimated Delivery
                        </small>

                        <h5>
                            {formattedDeliveryDate}
                        </h5>

                        <span className="status-badge">
                            3 - 5 Business Days
                        </span>
                    </motion.div>

                    {/* ORDER */}

                    <motion.div
                        className="summary-card"

                        variants={{
                            hidden: {
                                opacity: 0,
                                y: 30,
                            },

                            show: {
                                opacity: 1,
                                y: 0,
                            },
                        }}
                    >
                        <FaShieldAlt
                            className="summary-icon icon-purple"
                        />

                        <small>
                            Order Status
                        </small>

                        <h5>
                            Confirmed
                        </h5>

                        <span className="badge-verified">
                            ✔ Verified Order
                        </span>
                    </motion.div>

                </motion.div>

                {/* ORDER TIMELINE */}

                <motion.div
                    className="timeline"

                    initial="hidden"

                    whileInView="show"

                    viewport={{
                        once: true,
                    }}

                    variants={{
                        hidden: {},

                        show: {
                            transition: {
                                staggerChildren: 0.15,
                            },
                        },
                    }}
                >

                    {[
                        {
                            title:
                                "Payment Received",

                            desc:
                                "Your payment has been verified successfully.",

                            status:
                                "active",
                        },

                        {
                            title:
                                "Order Confirmed",

                            desc:
                                "Your order has been confirmed.",

                            status:
                                "active",
                        },

                        {
                            title:
                                "Preparing Package",

                            desc:
                                "Our warehouse team is packing your items.",

                            status:
                                "current pulsing",
                        },

                        {
                            title:
                                "Shipped",

                            desc:
                                "Tracking details will appear after courier pickup.",

                            status:
                                "",
                        },

                        {
                            title:
                                "Delivered",

                            desc:
                                "Package will be delivered to your address.",

                            status:
                                "",
                        },
                    ].map(
                        (step, index) => (
                            <motion.div
                                key={index}

                                className={`timeline-item ${step.status}`}

                                variants={{
                                    hidden: {
                                        opacity: 0,
                                        x: -30,
                                    },

                                    show: {
                                        opacity: 1,
                                        x: 0,
                                    },
                                }}
                            >
                                <div className="timeline-dot"></div>

                                <div>
                                    <h6>
                                        {step.title}
                                    </h6>

                                    <small>
                                        {step.desc}
                                    </small>
                                </div>
                            </motion.div>
                        )
                    )}

                </motion.div>

                {/* ADDRESS + ORDER INFO */}

                <div className="details-grid">

                    {/* SHIPPING ADDRESS */}

                    <motion.div
                        className="address-card"

                        initial={{
                            opacity: 0,
                            x: -30,
                        }}

                        whileInView={{
                            opacity: 1,
                            x: 0,
                        }}

                        viewport={{
                            once: true,
                        }}

                        transition={{
                            duration: 0.5,
                        }}
                    >

                        <div className="section-title">
                            📍 Shipping Address
                        </div>

                        <h5>
                            {order.fullName ||
                                displayName}
                        </h5>

                        <p className="address-text">
                            {order.address ||
                                "Address details not available"}
                        </p>

                        <p className="address-text">
                            {order.city
                                ? `${order.city}, ${order.state || ""}`
                                : "City, State"}
                        </p>

                        {order.pincode && (
                            <p className="address-text">
                                Pincode:{" "}
                                {order.pincode}
                            </p>
                        )}

                        {order.phone && (
                            <p className="address-text">
                                Phone:{" "}
                                {order.phone}
                            </p>
                        )}

                    </motion.div>

                    {/* ORDER INFO */}

                    <motion.div
                        className="order-info-card"

                        initial={{
                            opacity: 0,
                            x: 30,
                        }}

                        whileInView={{
                            opacity: 1,
                            x: 0,
                        }}

                        viewport={{
                            once: true,
                        }}

                        transition={{
                            duration: 0.5,
                        }}
                    >

                        <div className="section-title">
                            📦 Order Summary
                        </div>

                        <div className="info-row">
                            <span>
                                Order ID
                            </span>

                            <strong>
                                {orderId}
                            </strong>
                        </div>

                        <div className="info-row">
                            <span>
                                Transaction ID
                            </span>

                            <strong>
                                {transactionId}
                            </strong>
                        </div>

                        <div className="info-row">
                            <span>
                                Invoice No.
                            </span>

                            <strong>
                                {invoiceNo}
                            </strong>
                        </div>

                        <div className="info-row">
                            <span>
                                Payment Method
                            </span>

                            <strong>
                                {paymentLabel}
                            </strong>
                        </div>

                        {/* SUBTOTAL */}

                        {subtotal > 0 && (
                            <div className="info-row">
                                <span>
                                    Subtotal
                                </span>

                                <strong>
                                    ₹{money(subtotal)}
                                </strong>
                            </div>
                        )}

                        {/* SHIPPING */}

                        {shipping > 0 && (
                            <div className="info-row">
                                <span>
                                    Shipping
                                </span>

                                <strong>
                                    ₹{money(shipping)}
                                </strong>
                            </div>
                        )}

                        {/* GST */}

                        {gst > 0 && (
                            <div className="info-row">
                                <span>
                                    GST
                                </span>

                                <strong>
                                    ₹{money(gst)}
                                </strong>
                            </div>
                        )}

                        {/* COUPON */}

                        {couponCode && (
                            <div className="info-row">
                                <span>
                                    <FaTag className="me-1" />
                                    Coupon
                                </span>

                                <strong>
                                    {couponCode}
                                </strong>
                            </div>
                        )}

                        {/* DISCOUNT */}

                        {discount > 0 && (
                            <div className="info-row">
                                <span className="text-success">
                                    Discount
                                </span>

                                <strong className="text-success">
                                    - ₹{money(discount)}
                                </strong>
                            </div>
                        )}

                        {/* ORDER TOTAL */}

                        <div className="info-row">
                            <span>
                                Order Total
                            </span>

                            <strong>
                                ₹{money(totalAmount)}
                            </strong>
                        </div>

                        {/* WALLET */}

                        {walletPaid > 0 && (
                            <div className="info-row">
                                <span>
                                    <FaWallet className="me-1" />
                                    Wallet Used
                                </span>

                                <strong className="text-success">
                                    - ₹{money(walletPaid)}
                                </strong>
                            </div>
                        )}

                        {/* UPI / CARD */}

                        {onlinePaid > 0 && (
                            <div className="info-row">
                                <span>
                                    <FaCreditCard className="me-1" />
                                    {paymentMethod} Paid
                                </span>

                                <strong>
                                    ₹{money(onlinePaid)}
                                </strong>
                            </div>
                        )}

                        {/* TOTAL PAID */}

                        <div className="info-row total-row">
                            <span>
                                Total Paid
                            </span>

                            <strong className="price">
                                ₹{money(totalPaid)}
                            </strong>
                        </div>

                    </motion.div>

                </div>

                {/* PACKAGE MESSAGE */}

                <motion.div
                    className="shipping-message"

                    initial={{
                        opacity: 0,
                        y: 30,
                    }}

                    whileInView={{
                        opacity: 1,
                        y: 0,
                    }}

                    viewport={{
                        once: true,
                    }}
                >

                    <h4>
                        📦 Preparing Your Package
                    </h4>

                    <p>
                        Our warehouse team is
                        packing your items with care.
                        Live tracking details will
                        automatically be updated in
                        your Order Details page once
                        courier pickup is completed.
                    </p>

                </motion.div>

                {/* ACTION BUTTON */}

                <motion.div
                    className="action-buttons text-center"

                    initial={{
                        opacity: 0,
                        y: 20,
                    }}

                    animate={{
                        opacity: 1,
                        y: 0,
                    }}

                    transition={{
                        delay: 1.5,
                    }}
                >

                    <button
                        className="btn btn-continue-shopping"
                        onClick={() =>
                            navigate("/products")
                        }
                    >
                        <FaShoppingBag className="me-2" />

                        Continue Shopping
                    </button>

                </motion.div>

            </motion.div>

        </div>
    );
}

export default OrderConfirmed;