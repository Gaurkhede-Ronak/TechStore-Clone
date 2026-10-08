import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    FaArrowLeft,
    FaCheckCircle,
    FaMapMarkerAlt,
    FaPhone,
    FaBox,
    FaShieldAlt,
    FaUndo,
    FaExchangeAlt,
    FaRupeeSign,
    FaTruck,
    FaCopy,
    FaSun,
    FaMoon,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { toggleTheme } from "../../redux/slices/themeSlice";

import shipmentService from "../../appwrite/shipmentService";
import orderService from "../../appwrite/orderService";
import deliveryOtpService from "../../appwrite/deliveryOtpService";
import returnExchangeService from "../../appwrite/returnExchangeService";
import {
    getActiveDeliveryItems,
    getReturnExchangeItemsForDelivery,
    resolveReturnRequestItem,
    extractCleanReason,
} from "../../utils/orderItemHelper";
import "../../css/DeliveryPremiumUI.css";

function formatAddressValue(rawAddress) {
    if (!rawAddress) return "Address not available";
    if (typeof rawAddress === "string") {
        const trimmed = rawAddress.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                const parsed = JSON.parse(trimmed);
                return formatAddressValue(parsed);
            } catch {
                return trimmed || "Address not available";
            }
        }
        return trimmed || "Address not available";
    }
    if (typeof rawAddress === "object") {
        const parts = [
            rawAddress.houseNo || rawAddress.flatNo,
            rawAddress.street || rawAddress.addressLine1 || rawAddress.address,
            rawAddress.landmark || rawAddress.area,
            rawAddress.city || rawAddress.town,
            rawAddress.state,
            rawAddress.postalCode || rawAddress.pincode || rawAddress.zipCode,
        ]
            .map((p) => (p ? String(p).trim() : ""))
            .filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : "Address not available";
    }
    return String(rawAddress);
}

function DeliveryShipmentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const themeMode = useSelector((state) => state.theme?.mode || "light");

    useEffect(() => {
        document.body.className = themeMode;
        document.documentElement.setAttribute("data-theme", themeMode);
    }, [themeMode]);

    const [shipment, setShipment] = useState(null);
    const [order, setOrder] = useState(null);
    const [request, setRequest] = useState(null);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);

    /* LOAD */
    const loadDetails = async () => {
        try {
            setLoading(true);

            /* First try shipment. */
            try {
                let shipmentData = await shipmentService.getShipment(id);

                if (shipmentData) {
                    let orderData = null;

                    if (shipmentData.orderId) {
                        try {
                            orderData = await orderService.getOrderSmart(
                                String(shipmentData.orderId)
                            );
                        } catch (error) {
                            console.error("Order details error:", error);
                        }
                    }

                    if (String(shipmentData.status || "").toUpperCase() === "OUT_FOR_DELIVERY") {
                        try {
                            const otpRes = await deliveryOtpService.generateOtp(shipmentData.$id, {
                                userId: shipmentData.userId || orderData?.userId,
                                orderId: shipmentData.orderId || orderData?.$id,
                                trackingId: shipmentData.trackingId,
                            });

                            if (otpRes?.autoCancelled) {
                                shipmentData = {
                                    ...shipmentData,
                                    status: "CANCELLED",
                                    otpRequired: false,
                                };
                                if (orderData) {
                                    orderData = {
                                        ...orderData,
                                        status: "Cancelled",
                                    };
                                }
                            }
                        } catch (otpErr) {
                            console.error("OTP sync error:", otpErr);
                        }
                    }

                    setShipment(shipmentData);
                    if (orderData) {
                        setOrder(orderData);
                    }

                    return;
                }
            } catch {
                console.log(
                    "Not a shipment, checking return/exchange request..."
                );
            }

            /* If shipment doesn't exist, check Return / Exchange request. */
            const requestData = await returnExchangeService.getRequest(id);

            if (!requestData) {
                throw new Error("Delivery request not found.");
            }

            setRequest(requestData);

            if (requestData.originalOrderId) {
                try {
                    const orderData = await orderService.getOrderSmart(
                        String(requestData.originalOrderId)
                    );
                    setOrder(orderData);
                } catch (error) {
                    console.error("Request order error:", error);
                }
            }
        } catch (error) {
            console.error("Delivery details error:", error);

            toast.error(
                error?.message || "Unable to load delivery details"
            );

            navigate("/delivery/orders", {
                replace: true,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /* OTP */
    const handleOtpChange = (event) => {
        const value = event.target.value.replace(/\D/g, "").slice(0, 6);
        setOtp(value);
    };

    const handleCopyText = (text, label = "ID") => {
        if (!text || text === "N/A") return;
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(String(text));
            toast.success(`${label} copied!`);
        }
    };

    /* NORMAL DELIVERY */
    const handleVerifyDelivery = async () => {
        if (!shipment?.$id) {
            toast.error("Shipment not found.");
            return;
        }

        if (shipment.status !== "OUT_FOR_DELIVERY") {
            toast.error("This shipment is not out for delivery.");
            return;
        }

        if (otp.length !== 6) {
            toast.error("Please enter the 6-digit OTP.");
            return;
        }

        try {
            setVerifying(true);

            const result = await deliveryOtpService.verifyOtp(
                shipment.$id,
                otp
            );

            if (!result?.success) {
                toast.error(result?.message || "Invalid OTP.");
                if (result?.autoCancelled) {
                    await loadDetails();
                }
                return;
            }

            toast.success("Order delivered successfully!");

            const updatedShipment = await shipmentService.getShipment(
                shipment.$id
            );

            setShipment(updatedShipment);
            setOtp("");
        } catch (error) {
            console.error("Delivery OTP error:", error);

            toast.error(error?.message || "OTP verification failed.");
        } finally {
            setVerifying(false);
        }
    };

    /* RETURN / EXCHANGE PICKUP */
    const handlePickupOtp = async () => {
        if (!request?.$id) {
            toast.error("Request not found.");
            return;
        }

        const currentReqStatus = String(request.status || "").toUpperCase();
        if (
            currentReqStatus !== "ASSIGNED" &&
            currentReqStatus !== "PICKUP_ASSIGNED" &&
            currentReqStatus !== "CONFIRMED"
        ) {
            toast.error("This request is not ready for pickup.");
            return;
        }

        try {
            setVerifying(true);

            const updatedDoc = await returnExchangeService.markItemPickedUp(
                request.$id
            );

            toast.success("Item marked as picked up successfully!");

            setRequest(updatedDoc);
            setOtp("");
        } catch (error) {
            console.error("Pickup confirmation error:", error);

            toast.error(error?.message || "Pickup confirmation failed.");
        } finally {
            setVerifying(false);
        }
    };

    /* INITIATE REFUND */
    const handleInitiateRefund = async () => {
        if (!request?.$id) {
            return;
        }

        try {
            setVerifying(true);

            const resolvedItem = resolveReturnRequestItem(request, order);
            const amount = Number(
                request?.refundAmount ||
                    (resolvedItem?.itemPrice
                        ? resolvedItem.itemPrice * (resolvedItem.itemQty || 1)
                        : 0) ||
                    order?.totalAmount ||
                    order?.total ||
                    order?.grandTotal ||
                    0
            );

            const updated = await returnExchangeService.initiateRefund(
                request.$id,
                amount
            );

            setRequest(updated);

            toast.success("Refund initiated successfully.");
        } catch (error) {
            console.error("Refund error:", error);

            toast.error(error?.message || "Unable to initiate refund.");
        } finally {
            setVerifying(false);
        }
    };

    /* COMPLETE REFUND */
    const handleCompleteRefund = async () => {
        if (!request?.$id) {
            return;
        }

        try {
            setVerifying(true);

            const updated = await returnExchangeService.completeRefund(
                request.$id
            );

            setRequest(updated);

            toast.success("Refund completed successfully.");
        } catch (error) {
            console.error("Refund completion error:", error);

            toast.error(error?.message || "Unable to complete refund.");
        } finally {
            setVerifying(false);
        }
    };

    /* HELPERS */
    const orderId =
        order?.orderId ||
        shipment?.orderId ||
        request?.originalOrderId ||
        "N/A";

    const customerName =
        order?.customerName ||
        order?.name ||
        order?.fullName ||
        shipment?.customerName ||
        "Customer";

    const phone =
        order?.customerPhone ||
        order?.phone ||
        (typeof order?.shippingAddress === "object"
            ? order.shippingAddress?.phone
            : "") ||
        shipment?.customerPhone ||
        "";

    const address = formatAddressValue(
        order?.shippingAddress ||
            order?.destinationAddress ||
            order?.address ||
            shipment?.destinationAddress
    );

    const isDelivered = shipment?.status === "DELIVERED";
    const isOutForDelivery = shipment?.status === "OUT_FOR_DELIVERY";
    const isReturnExchange = !!request;

    // For Return/Exchange: show ONLY the specific product requested for return/exchange.
    // For Normal Delivery: show ONLY active (non-cancelled) products to deliver.
    const products = isReturnExchange
        ? getReturnExchangeItemsForDelivery(request, order)
        : getActiveDeliveryItems(order);

    const resolvedReturnItem = isReturnExchange
        ? resolveReturnRequestItem(request, order)
        : null;

    const normalizedRequestStatus = String(request?.status || "").toUpperCase();
    const isAssigned =
        normalizedRequestStatus === "ASSIGNED" ||
        normalizedRequestStatus === "PICKUP_ASSIGNED" ||
        normalizedRequestStatus === "CONFIRMED";

    const isPickedUp =
        normalizedRequestStatus === "PICKED_UP" ||
        normalizedRequestStatus === "REFUND_INITIATED" ||
        normalizedRequestStatus === "REFUND_COMPLETED" ||
        normalizedRequestStatus === "EXCHANGE_COMPLETED";

    /* LOADING */
    if (loading) {
        return (
            <div className={`delivery-details-page delivery-loading-page theme-${themeMode}`} data-theme={themeMode}>
                <div className="delivery-shell">
                    <div className="delivery-loading-card">
                        <div className="delivery-loading-logo">
                            <FaBox />
                        </div>
                        <div className="delivery-spinner" />
                        <h3>Opening delivery details</h3>
                        <p>
                            Loading customer, order and verification
                            information.
                        </p>
                        <div className="delivery-skeleton-row">
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* PREMIUM UI */
    return (
        <div className={`delivery-details-page theme-${themeMode}`} data-theme={themeMode}>
            <div className="delivery-shell">
                {/* TOP BAR */}
                <header className="delivery-topbar">
                    <div
                        className="delivery-brand"
                        onClick={() => navigate("/delivery/dashboard")}
                    >
                        <div className="delivery-brand-mark">
                            <FaTruck />
                        </div>
                        <div>
                            <div className="delivery-brand-name">TECHSTORE</div>
                            <div className="delivery-brand-subtitle">
                                Delivery Operations
                            </div>
                        </div>
                    </div>

                    <div className="delivery-topbar-actions">
                        <button
                            type="button"
                            className="delivery-theme-toggle"
                            onClick={() => dispatch(toggleTheme())}
                            title={themeMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            aria-label="Toggle color theme"
                        >
                            <span className="delivery-theme-toggle-icon">
                                {themeMode === "dark" ? <FaSun /> : <FaMoon />}
                            </span>
                            <span className="delivery-theme-toggle-label">
                                {themeMode === "dark" ? "Light" : "Dark"}
                            </span>
                        </button>

                        <button
                            type="button"
                            className="delivery-back-btn"
                            onClick={() => navigate("/delivery/orders")}
                        >
                            <FaArrowLeft />
                            Back to Orders
                        </button>
                    </div>
                </header>

                {/* ORDER HERO */}
                <section className="delivery-detail-hero">
                    <div className="delivery-detail-hero-main">
                        <div className="delivery-eyebrow">
                            <span className="delivery-live-dot" />
                            {isReturnExchange
                                ? "SERVICE REQUEST"
                                : "DELIVERY DETAILS"}
                        </div>

                        <div className="delivery-detail-title-row">
                            <div>
                                <span className="delivery-label">
                                    {isReturnExchange
                                        ? "REQUEST ID"
                                        : "ORDER ID"}
                                </span>
                                <h1>
                                    {isReturnExchange
                                        ? request.referenceId
                                        : orderId}
                                </h1>
                            </div>

                            {isReturnExchange ? (
                                <span
                                    className={`delivery-detail-status ${
                                        request.type === "RETURN"
                                            ? "status-red"
                                            : "status-blue"
                                    }`}
                                >
                                    {request.type === "RETURN" ? (
                                        <FaUndo />
                                    ) : (
                                        <FaExchangeAlt />
                                    )}
                                    {request.type}
                                </span>
                            ) : (
                                <span
                                    className={`delivery-detail-status ${
                                        isDelivered
                                            ? "status-green"
                                            : "status-orange"
                                    }`}
                                >
                                    {isDelivered ? (
                                        <FaCheckCircle />
                                    ) : (
                                        <FaTruck />
                                    )}
                                    {shipment?.status || "PENDING"}
                                </span>
                            )}
                        </div>

                        <p>
                            {isReturnExchange
                                ? "Complete the assigned return or exchange pickup using the customer verification process."
                                : "Verify the customer handover securely and complete this delivery with the 6-digit OTP."}
                        </p>
                    </div>

                    <div className="delivery-detail-hero-icon">
                        {isReturnExchange ? (
                            request.type === "RETURN" ? (
                                <FaUndo />
                            ) : (
                                <FaExchangeAlt />
                            )
                        ) : (
                            <FaTruck />
                        )}
                    </div>
                </section>

                {/* REQUEST NOTICE */}
                {isReturnExchange && (
                    <div
                        className={`delivery-request-banner ${
                            request.type === "RETURN"
                                ? "banner-red"
                                : "banner-blue"
                        }`}
                    >
                        <div className="delivery-request-banner-left">
                            <div className="delivery-request-banner-icon">
                                {request.type === "RETURN" ? (
                                    <FaUndo />
                                ) : (
                                    <FaExchangeAlt />
                                )}
                            </div>
                            <div>
                                <strong>
                                    {request.type === "RETURN"
                                        ? "Return Request"
                                        : "Exchange Request"}
                                </strong>
                                <span>
                                    Original Order:{" "}
                                    <b>{request.originalOrderId}</b>
                                    {resolvedReturnItem?.itemName ? (
                                        <>
                                            {" "}• Product:{" "}
                                            <b>{resolvedReturnItem.itemName}</b>
                                        </>
                                    ) : null}
                                    {resolvedReturnItem?.cleanReason ? (
                                        <>
                                            {" "}• Reason:{" "}
                                            <b>{resolvedReturnItem.cleanReason}</b>
                                        </>
                                    ) : null}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="delivery-detail-grid">
                    {/* LEFT */}
                    <main className="delivery-detail-main">
                        {/* CUSTOMER */}
                        <section className="delivery-detail-card">
                            <div className="delivery-card-heading">
                                <div className="delivery-card-heading-icon">
                                    <FaMapMarkerAlt />
                                </div>
                                <div>
                                    <span>RECIPIENT</span>
                                    <h2>Customer Details</h2>
                                </div>
                            </div>

                            <div className="delivery-customer-detail">
                                <div className="delivery-customer-detail-left">
                                    <div className="delivery-large-avatar">
                                        {(customerName || "C")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                    <div>
                                        <span>Customer name</span>
                                        <strong>{customerName}</strong>
                                    </div>
                                </div>

                                {phone && (
                                    <a
                                        href={`tel:${phone}`}
                                        className="delivery-call-btn"
                                    >
                                        <FaPhone />
                                        Call Customer
                                    </a>
                                )}
                            </div>

                            <div className="delivery-detail-info-grid">
                                {phone && (
                                    <div className="delivery-detail-info-box">
                                        <div className="delivery-detail-info-icon">
                                            <FaPhone />
                                        </div>
                                        <div>
                                            <span>Phone</span>
                                            <strong>{phone}</strong>
                                        </div>
                                    </div>
                                )}

                                <div className="delivery-detail-info-box delivery-detail-address-wide">
                                    <div className="delivery-detail-info-icon">
                                        <FaMapMarkerAlt />
                                    </div>
                                    <div>
                                        <span>Delivery address</span>
                                        <strong>{address}</strong>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ORDER */}
                        <section className="delivery-detail-card">
                            <div className="delivery-card-heading">
                                <div className="delivery-card-heading-icon delivery-card-heading-blue">
                                    <FaBox />
                                </div>
                                <div>
                                    <span>ORDER INFORMATION</span>
                                    <h2>Order Details</h2>
                                </div>
                            </div>

                            <div className="delivery-order-reference">
                                <div>
                                    <span>Customer Order ID</span>
                                    <strong>{orderId}</strong>
                                </div>

                                {orderId && orderId !== "N/A" && (
                                    <button
                                        type="button"
                                        className="delivery-copy-chip"
                                        onClick={() =>
                                            handleCopyText(orderId, "Order ID")
                                        }
                                    >
                                        <FaCopy />
                                        Copy ID
                                    </button>
                                )}
                            </div>

                            {products.length > 0 ? (
                                <div className="delivery-products">
                                    <div className="delivery-products-title">
                                        <FaBox />
                                        <span>
                                            {isReturnExchange
                                                ? request?.type === "EXCHANGE"
                                                    ? "Product to Exchange"
                                                    : "Product to Pick Up (Return)"
                                                : "Products to Deliver"}
                                        </span>
                                        <b>{products.length}</b>
                                    </div>

                                    {products.map((product, index) => (
                                        <div
                                            className="delivery-product-row"
                                            key={
                                                product?.id ||
                                                product?.productId ||
                                                index
                                            }
                                        >
                                            <div className="delivery-product-number">
                                                {index + 1}
                                            </div>
                                            <div className="delivery-product-copy">
                                                <strong>
                                                    {product?.name ||
                                                        product?.title ||
                                                        "Product"}
                                                </strong>
                                                <span>
                                                    Quantity:{" "}
                                                    {product?.quantity || 1}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="delivery-no-products">
                                    <FaBox />
                                    <span>No product details available.</span>
                                </div>
                            )}
                        </section>
                    </main>

                    {/* RIGHT ACTION */}
                    <aside className="delivery-action-column">
                        {/* NORMAL DELIVERY */}
                        {!isReturnExchange && (
                            <section className="delivery-action-card">
                                <div className="delivery-action-icon delivery-action-blue">
                                    <FaShieldAlt />
                                </div>
                                <div className="delivery-action-title">
                                    <span>SECURE HANDOVER</span>
                                    <h2>Verify Delivery</h2>
                                    <p>
                                        Enter the customer&apos;s 6-digit OTP to
                                        complete the delivery.
                                    </p>
                                </div>

                                {isOutForDelivery ? (
                                    <>
                                        <label className="delivery-otp-label">
                                            Customer OTP
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={otp}
                                            onChange={handleOtpChange}
                                            className="delivery-otp-input"
                                            placeholder="000000"
                                            aria-label="Customer OTP"
                                        />
                                        <div className="delivery-otp-hint">
                                            <FaShieldAlt />
                                            OTP is required for secure delivery
                                            verification.
                                        </div>
                                        <button
                                            type="button"
                                            className="delivery-verify-btn"
                                            onClick={handleVerifyDelivery}
                                            disabled={
                                                verifying || otp.length !== 6
                                            }
                                        >
                                            {verifying ? (
                                                <>
                                                    <span className="delivery-mini-loader" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    <FaCheckCircle />
                                                    Verify &amp; Deliver
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : isDelivered ? (
                                    <div className="delivery-success-state">
                                        <div className="delivery-success-icon">
                                            <FaCheckCircle />
                                        </div>
                                        <h3>Delivery Verified</h3>
                                        <p>
                                            This order has already been
                                            delivered successfully.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="delivery-neutral-state">
                                        <FaTruck />
                                        <span>
                                            This shipment is not currently out
                                            for delivery.
                                        </span>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* RETURN / EXCHANGE */}
                        {isReturnExchange && (
                            <section className="delivery-action-card">
                                <div
                                    className={`delivery-action-icon ${
                                        request.type === "RETURN"
                                            ? "delivery-action-red"
                                            : "delivery-action-blue"
                                    }`}
                                >
                                    {request.type === "RETURN" ? (
                                        <FaUndo />
                                    ) : (
                                        <FaExchangeAlt />
                                    )}
                                </div>

                                <div className="delivery-action-title">
                                    <span>
                                        {request.type === "RETURN"
                                            ? "RETURN PICKUP"
                                            : "EXCHANGE PICKUP"}
                                    </span>
                                    <h2>
                                        {request.type === "RETURN"
                                            ? "Return Pickup"
                                            : "Exchange Pickup"}
                                    </h2>
                                    <p>
                                        Confirm that you have inspected and picked up
                                        the customer&apos;s item at the doorstep.
                                    </p>
                                </div>

                                <div className="delivery-request-status">
                                    <span>Current status</span>
                                    <strong>{request.status}</strong>
                                </div>

                                {extractCleanReason(request.reason) && (
                                    <div className="delivery-reason-box">
                                        <span>Customer reason</span>
                                        <p>{extractCleanReason(request.reason)}</p>
                                    </div>
                                )}

                                {isAssigned && (
                                    <button
                                        type="button"
                                        className="delivery-verify-btn"
                                        onClick={handlePickupOtp}
                                        disabled={verifying}
                                    >
                                        {verifying ? (
                                            <>
                                                <span className="delivery-mini-loader" />
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <FaCheckCircle />
                                                Confirm Item Picked Up
                                            </>
                                        )}
                                    </button>
                                )}

                                {isPickedUp && (
                                    <div className="delivery-success-state compact">
                                        <div className="delivery-success-icon">
                                            <FaCheckCircle />
                                        </div>
                                        <h3>Pickup Verified</h3>
                                        <p>Product picked up successfully.</p>
                                    </div>
                                )}

                                {request.type === "RETURN" && isPickedUp && (
                                    <div className="delivery-refund-panel">
                                        <div className="delivery-refund-header">
                                            <div>
                                                <span>REFUND</span>
                                                <strong>
                                                    {request.refundStatus ||
                                                        "PENDING"}
                                                </strong>
                                            </div>
                                            <FaRupeeSign />
                                        </div>

                                        <div className="delivery-refund-meta">
                                            <div>
                                                <span>Refund status</span>
                                                <strong>
                                                    {request.refundStatus ||
                                                        "PENDING"}
                                                </strong>
                                            </div>
                                            {request.paymentMethod && (
                                                <div>
                                                    <span>Payment method</span>
                                                    <strong>
                                                        {request.paymentMethod}
                                                    </strong>
                                                </div>
                                            )}
                                        </div>

                                        {!request.refundStatus ||
                                        request.refundStatus === "PENDING" ? (
                                            <button
                                                type="button"
                                                className="delivery-refund-btn refund-warning"
                                                onClick={handleInitiateRefund}
                                                disabled={verifying}
                                            >
                                                <FaRupeeSign />
                                                Initiate Refund
                                            </button>
                                        ) : null}

                                        {request.refundStatus ===
                                            "INITIATED" && (
                                            <button
                                                type="button"
                                                className="delivery-refund-btn refund-success"
                                                onClick={handleCompleteRefund}
                                                disabled={verifying}
                                            >
                                                <FaCheckCircle />
                                                Complete Refund
                                            </button>
                                        )}

                                        {request.refundStatus ===
                                            "COMPLETED" && (
                                            <div className="delivery-refund-complete">
                                                <FaCheckCircle />
                                                Refund Completed
                                            </div>
                                        )}
                                    </div>
                                )}

                                {request.type === "EXCHANGE" && isPickedUp && (
                                    <div className="delivery-exchange-complete">
                                        <FaExchangeAlt />
                                        <div>
                                            <strong>
                                                Exchange pickup completed
                                            </strong>
                                            <span>
                                                Exchange processing can now
                                                continue.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </aside>
                </div>

                <footer className="delivery-footer">
                    <span>TECHSTORE Delivery Operations</span>
                    <span>Secure • Fast • Customer First</span>
                </footer>
            </div>
        </div>
    );
}

export default DeliveryShipmentDetails;
