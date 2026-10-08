import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaTruck,
    FaBoxOpen,
    FaCheckCircle,
    FaClock,
    FaArrowRight,
    FaSyncAlt,
    FaSignOutAlt,
    FaUndoAlt,
    FaExchangeAlt,
    FaMapMarkerAlt,
    FaSpinner,
    FaSun,
    FaMoon,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../../redux/slices/themeSlice";
import toast from "react-hot-toast";

import shipmentService from "../../appwrite/shipmentService";
import orderService from "../../appwrite/orderService";
import authService from "../../appwrite/authService";
import deliveryOtpService from "../../appwrite/deliveryOtpService";
import returnExchangeService from "../../appwrite/returnExchangeService";
import {
    getActiveDeliveryItems,
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

function DeliveryBoyDashboard() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const user = useSelector((state) => state.auth.user);
    const themeMode = useSelector((state) => state.theme?.mode || "light");

    useEffect(() => {
        document.body.className = themeMode;
        document.documentElement.setAttribute("data-theme", themeMode);
    }, [themeMode]);

  // SHIPMENTS
    const [shipments, setShipments] = useState([]);
    const [orders, setOrders] = useState([]);

  // RETURN / EXCHANGE
    const [returnRequests, setReturnRequests] = useState([]);
    const [returnOrders, setReturnOrders] = useState([]);
    const [pickupLoading, setPickupLoading] = useState({});

  // GENERAL
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

  // GET DELIVERY BOY ID
    const getDeliveryBoyId = () => {
        return user?.$id || user?.id || user?.userId || "";
    };

  // LOAD OUT FOR DELIVERY
    const loadDeliveries = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await shipmentService.getShipmentsByStatus(
                "OUT_FOR_DELIVERY"
            );

            const rawShipmentList = Array.isArray(response)
                ? response
                : response?.documents || [];

            const shipmentList =
                await deliveryOtpService.processOutForDeliveryShipments(
                    rawShipmentList
                );

            setShipments(shipmentList);

            // GET REAL CUSTOMER ORDERS
            const orderResults = await Promise.all(
                shipmentList.map(async (shipment) => {
                    try {
                        if (!shipment?.orderId) {
                            return null;
                        }

                        const order = await orderService.getOrderSmart(
                            String(shipment.orderId)
                        );

                        return {
                            shipment,
                            order,
                        };
                    } catch (error) {
                        console.error("Order load error:", error);

                        return {
                            shipment,
                            order: null,
                        };
                    }
                })
            );

            setOrders(orderResults.filter(Boolean));
        } catch (error) {
            console.error("Delivery Dashboard Error:", error);

            toast.error(error?.message || "Unable to load deliveries");

            setShipments([]);
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

  // LOAD RETURN / EXCHANGE PICKUPS
    const loadReturnRequests = async () => {
        try {
            const deliveryBoyId = getDeliveryBoyId();

            if (!deliveryBoyId) {
                setReturnRequests([]);
                setReturnOrders([]);
                return;
            }

            const response = await returnExchangeService.getAllRequests();

            const allRequests = Array.isArray(response)
                ? response
                : response?.documents || [];

            // ONLY CURRENT DELIVERY BOY
            const assignedRequests = allRequests.filter((request) => {
                const assignedId = String(request?.deliveryBoyId || "");
                const currentId = String(deliveryBoyId);
                const status = String(request?.status || "").toUpperCase();

                return (
                    assignedId === currentId &&
                    (status === "PICKUP_ASSIGNED" ||
                        status === "CONFIRMED" ||
                        status === "PICKED_UP" ||
                        status === "REFUND_INITIATED" ||
                        status === "REFUND_COMPLETED" ||
                        status === "EXCHANGE_COMPLETED")
                );
            });

            setReturnRequests(assignedRequests);

            // GET REAL ORDER DATA
            const requestOrders = await Promise.all(
                assignedRequests.map(async (request) => {
                    try {
                        if (!request?.originalOrderId) {
                            return {
                                request,
                                order: null,
                            };
                        }

                        const order = await orderService.getOrderSmart(
                            String(request.originalOrderId)
                        );

                        return {
                            request,
                            order,
                        };
                    } catch (error) {
                        console.error("Return order load error:", error);

                        return {
                            request,
                            order: null,
                        };
                    }
                })
            );

            setReturnOrders(requestOrders);
        } catch (error) {
            console.error("Return/Exchange load error:", error);

            setReturnRequests([]);
            setReturnOrders([]);
        }
    };

  // LOAD EVERYTHING
    const loadDashboard = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            await Promise.all([loadDeliveries(false), loadReturnRequests()]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

  // INITIAL LOAD
    useEffect(() => {
        loadDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.$id, user?.id]);

  // AUTO REFRESH RETURN REQUESTS
    useEffect(() => {
        const interval = setInterval(() => {
            loadReturnRequests();
        }, 10000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.$id, user?.id]);

  // LOGOUT
    const handleLogout = async () => {
        if (loggingOut) {
            return;
        }

        try {
            setLoggingOut(true);

            try {
                await authService.logout();
            } catch (error) {
                console.log("Appwrite logout:", error);
            }

            toast.success("Logged out successfully");

            setTimeout(() => {
                window.location.replace("/login");
            }, 300);
        } catch (error) {
            console.error("Logout Error:", error);
            window.location.replace("/login");
        }
    };

  // ITEM PICKED UP
    const handleItemPickedUp = async (request) => {
        if (!request?.$id) {
            toast.error("Return request ID is missing.");
            return;
        }

        const requestId = request.$id;

        if (pickupLoading[requestId]) {
            return;
        }

        try {
            setPickupLoading((previous) => ({
                ...previous,
                [requestId]: true,
            }));

            const confirmed = window.confirm(
                `Confirm that the ${
                    String(request?.type || "").toUpperCase() === "EXCHANGE"
                        ? "exchange"
                        : "return"
                } item has been picked up?`
            );

            if (!confirmed) {
                return;
            }

            // PICKUP_ASSIGNED -> PICKED_UP
            await returnExchangeService.markItemPickedUp(requestId);

            toast.success("Item marked as picked up.");
            await loadReturnRequests();

            const requestType = String(request?.type || "RETURN").toUpperCase();

            // EXCHANGE: PICKED_UP -> 15 sec -> EXCHANGE_COMPLETED
            if (requestType === "EXCHANGE") {
                setTimeout(async () => {
                    try {
                        await returnExchangeService.updateRequest(requestId, {
                            status: "EXCHANGE_COMPLETED",
                        });

                        await loadReturnRequests();

                        toast.success("Exchange completed successfully.");
                    } catch (error) {
                        console.error("Exchange completion error:", error);
                        toast.error(
                            error?.message || "Unable to complete exchange."
                        );
                    }
                }, 15000);

                return;
            }

            // RETURN: PICKED_UP -> 15 sec -> REFUND_INITIATED -> 15 sec -> REFUND_COMPLETED
            setTimeout(async () => {
                try {
                    await returnExchangeService.updateRequest(requestId, {
                        status: "REFUND_INITIATED",
                    });

                    await returnExchangeService.initiateRefund(
                        requestId,
                        Number(request?.refundAmount || 0) || 0
                    );

                    await loadReturnRequests();
                    toast.success("Refund initiated.");

                    setTimeout(async () => {
                        try {
                            await returnExchangeService.completeRefund(
                                requestId
                            );

                            await returnExchangeService.updateRequest(
                                requestId,
                                {
                                    status: "REFUND_COMPLETED",
                                }
                            );

                            await loadReturnRequests();

                            toast.success("Refund completed successfully.");
                        } catch (error) {
                            console.error("Refund completion error:", error);
                            toast.error(
                                error?.message || "Unable to complete refund."
                            );
                        }
                    }, 15000);
                } catch (error) {
                    console.error("Refund initiation error:", error);
                    toast.error(
                        error?.message || "Unable to initiate refund."
                    );
                }
            }, 15000);
        } catch (error) {
            console.error("Item pickup error:", error);
            toast.error(
                error?.message || "Unable to mark item as picked up."
            );
        } finally {
            setPickupLoading((previous) => ({
                ...previous,
                [requestId]: false,
            }));
        }
    };

  // STATS
    const totalDeliveries = shipments.length;
    const uniqueCustomers = orders.length;
    const pickupCount = returnRequests.length;
    const today = new Date();

    const todayDeliveries = orders.filter((item) => {
        const createdAt =
            item?.shipment?.$createdAt || item?.shipment?.createdAt;

        if (!createdAt) {
            return false;
        }

        const date = new Date(createdAt);

        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    }).length;

  // HELPERS
    const getOrderId = (item) => {
        return (
            item?.order?.orderId ||
            item?.shipment?.orderId ||
            item?.request?.originalOrderId ||
            "N/A"
        );
    };

    const getCustomerName = (item) => {
        return (
            item?.order?.customerName ||
            item?.order?.name ||
            item?.order?.fullName ||
            item?.shipment?.customerName ||
            "Customer"
        );
    };

    const getAddress = (item) => {
        const order = item?.order;
        if (!order) {
            return formatAddressValue(item?.shipment?.destinationAddress);
        }

        return formatAddressValue(
            order.shippingAddress ||
                order.destinationAddress ||
                order.address ||
                item?.shipment?.destinationAddress
        );
    };

    const getRequestType = (request) => {
        const type = String(request?.type || "").toUpperCase();
        return type === "EXCHANGE" ? "Exchange" : "Return";
    };

    const getRequestStatus = (request) => {
        return String(request?.status || "").toUpperCase();
    };

  // LOADING
    if (loading) {
        return (
            <div className={`delivery-dashboard-page delivery-loading-page theme-${themeMode}`} data-theme={themeMode}>
                <div className="delivery-shell">
                    <div className="delivery-loading-card">
                        <div className="delivery-loading-logo">
                            <FaTruck />
                        </div>
                        <div className="delivery-spinner" />
                        <h3>Preparing your delivery workspace</h3>
                        <p>Please wait while we sync your latest deliveries.</p>
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

  // PREMIUM UI
    return (
        <div className={`delivery-dashboard-page theme-${themeMode}`} data-theme={themeMode}>
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
                            className="delivery-icon-btn"
                            onClick={() => loadDashboard(true)}
                            disabled={refreshing || loggingOut}
                            title="Refresh dashboard"
                        >
                            <FaSyncAlt className={refreshing ? "fa-spin" : ""} />
                        </button>

                        <div className="delivery-profile">
                            <div className="delivery-avatar">
                                {(user?.name || "D").charAt(0).toUpperCase()}
                            </div>
                            <div className="delivery-profile-copy">
                                <strong>{user?.name || "Delivery Boy"}</strong>
                                <span>Delivery Partner</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="delivery-logout-btn"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? (
                                <span className="delivery-mini-loader" />
                            ) : (
                                <FaSignOutAlt />
                            )}
                            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
                        </button>
                    </div>
                </header>

                {/* HERO */}
                <section className="delivery-hero">
                    <div className="delivery-hero-glow delivery-hero-glow-one" />
                    <div className="delivery-hero-glow delivery-hero-glow-two" />

                    <div className="delivery-hero-content">
                        <div className="delivery-eyebrow">
                            <span className="delivery-live-dot" />
                            LIVE DELIVERY PANEL
                        </div>

                        <h1>
                            Welcome back,{" "}
                            <span>{user?.name || "Delivery Partner"}</span> 👋
                        </h1>

                        <p>
                            Stay on top of deliveries, customer pickups and
                            return operations from one professional workspace.
                        </p>

                        <div className="delivery-hero-meta">
                            <span>
                                <FaTruck />
                                {totalDeliveries} active deliveries
                            </span>
                            <span>
                                <FaUndoAlt />
                                {pickupCount} pickup{" "}
                                {pickupCount === 1 ? "request" : "requests"}
                            </span>
                        </div>
                    </div>

                    <div className="delivery-hero-visual">
                        <div className="delivery-orbit delivery-orbit-one" />
                        <div className="delivery-orbit delivery-orbit-two" />
                        <div className="delivery-hero-truck">
                            <FaTruck />
                        </div>
                        <div className="delivery-floating-card delivery-floating-card-top">
                            <FaCheckCircle />
                            <div>
                                <strong>Live Status</strong>
                                <span>All systems active</span>
                            </div>
                        </div>
                        <div className="delivery-floating-card delivery-floating-card-bottom">
                            <FaMapMarkerAlt />
                            <div>
                                <strong>On Route</strong>
                                <span>Ready for delivery</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* STATS */}
                <section className="delivery-stats-grid">
                    <div
                        className="delivery-stat-card delivery-stat-blue"
                        onClick={() => navigate("/delivery/orders")}
                    >
                        <div className="delivery-stat-icon">
                            <FaTruck />
                        </div>
                        <div className="delivery-stat-content">
                            <span>Out For Delivery</span>
                            <strong>{totalDeliveries}</strong>
                            <small>Active shipments</small>
                        </div>
                        <div className="delivery-stat-arrow">
                            <FaArrowRight />
                        </div>
                    </div>

                    <div
                        className="delivery-stat-card delivery-stat-orange"
                        onClick={() => navigate("/delivery/orders")}
                    >
                        <div className="delivery-stat-icon">
                            <FaBoxOpen />
                        </div>
                        <div className="delivery-stat-content">
                            <span>Active Orders</span>
                            <strong>{uniqueCustomers}</strong>
                            <small>Customer orders</small>
                        </div>
                        <div className="delivery-stat-arrow">
                            <FaArrowRight />
                        </div>
                    </div>

                    <div
                        className="delivery-stat-card delivery-stat-green"
                        onClick={() => navigate("/delivery/orders")}
                    >
                        <div className="delivery-stat-icon">
                            <FaClock />
                        </div>
                        <div className="delivery-stat-content">
                            <span>Today&apos;s Deliveries</span>
                            <strong>{todayDeliveries}</strong>
                            <small>Created today</small>
                        </div>
                        <div className="delivery-stat-arrow">
                            <FaArrowRight />
                        </div>
                    </div>

                    <div
                        className="delivery-stat-card delivery-stat-red"
                        onClick={() => navigate("/delivery/orders")}
                    >
                        <div className="delivery-stat-icon">
                            <FaUndoAlt />
                        </div>
                        <div className="delivery-stat-content">
                            <span>Return Pickups</span>
                            <strong>{pickupCount}</strong>
                            <small>Assigned to you</small>
                        </div>
                        <div className="delivery-stat-arrow">
                            <FaArrowRight />
                        </div>
                    </div>
                </section>

                {/* RETURN / EXCHANGE */}
                <section className="delivery-section">
                    <div className="delivery-section-heading">
                        <div>
                            <div className="delivery-section-kicker">
                                ACTION CENTER
                            </div>
                            <h2>
                                <FaUndoAlt /> Return &amp; Exchange Pickups
                            </h2>
                            <p>
                                Confirmed customer requests assigned to your
                                route.
                            </p>
                        </div>
                        {pickupCount > 0 && (
                            <div className="delivery-section-count">
                                <FaUndoAlt />
                                {pickupCount} Active
                            </div>
                        )}
                    </div>

                    {returnOrders.length === 0 ? (
                        <div className="delivery-empty-card">
                            <div className="delivery-empty-icon delivery-empty-icon-success">
                                <FaCheckCircle />
                            </div>
                            <h3>You&apos;re all clear</h3>
                            <p>
                                No return or exchange pickup is currently
                                assigned to you.
                            </p>
                        </div>
                    ) : (
                        <div className="delivery-card-grid">
                            {returnOrders.map((item) => {
                                const request = item?.request;
                                const requestStatus = getRequestStatus(request);
                                const isExchange =
                                    String(
                                        request?.type || ""
                                    ).toUpperCase() === "EXCHANGE";
                                const isPicking = Boolean(
                                    pickupLoading[request?.$id]
                                );

                                return (
                                    <article
                                        className="delivery-operation-card"
                                        key={request?.$id}
                                    >
                                        <div className="delivery-operation-top">
                                            <div
                                                className={`delivery-request-icon ${
                                                    isExchange
                                                        ? "request-blue"
                                                        : ""
                                                }`}
                                            >
                                                {isExchange ? (
                                                    <FaExchangeAlt />
                                                ) : (
                                                    <FaUndoAlt />
                                                )}
                                            </div>
                                            <div className="delivery-operation-title">
                                                <span>
                                                    {getRequestType(request)}{" "}
                                                    Request
                                                </span>
                                                <h3>
                                                    {request?.referenceId ||
                                                        "Request"}
                                                </h3>
                                            </div>
                                            <span
                                                className={`delivery-type-badge ${
                                                    isExchange
                                                        ? "exchange"
                                                        : "return"
                                                }`}
                                            >
                                                {isExchange
                                                    ? "EXCHANGE"
                                                    : "RETURN"}
                                            </span>
                                        </div>

                                        <div className="delivery-info-list">
                                            <div className="delivery-info-row">
                                                <span>Order ID</span>
                                                <strong>
                                                    {getOrderId(item)}
                                                </strong>
                                            </div>
                                            <div className="delivery-info-row">
                                                <span>Customer</span>
                                                <strong>
                                                    {getCustomerName(item)}
                                                </strong>
                                            </div>
                                            <div className="delivery-info-row delivery-info-address">
                                                <span>
                                                    <FaMapMarkerAlt /> Pickup
                                                    address
                                                </span>
                                                <strong>
                                                    {getAddress(item)}
                                                </strong>
                                            </div>
                                            {(() => {
                                                const rxItem = resolveReturnRequestItem(
                                                    request,
                                                    item?.order
                                                );
                                                return (
                                                    <>
                                                        {rxItem?.itemName && (
                                                            <div className="delivery-info-row">
                                                                <span>
                                                                    {isExchange
                                                                        ? "Exchange Item"
                                                                        : "Return Item"}
                                                                </span>
                                                                <strong>
                                                                    {rxItem.itemName} (x
                                                                    {rxItem.itemQty || 1})
                                                                </strong>
                                                            </div>
                                                        )}
                                                        {rxItem?.cleanReason && (
                                                            <div className="delivery-reason-box">
                                                                <span>Reason</span>
                                                                <p>{rxItem.cleanReason}</p>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        <div className="delivery-operation-footer">
                                            <div>
                                                <span>Pickup status</span>
                                                <strong>
                                                    {requestStatus ===
                                                    "PICKUP_ASSIGNED"
                                                        ? "Pickup Assigned"
                                                        : requestStatus}
                                                </strong>
                                            </div>

                                            {requestStatus ===
                                                "PICKUP_ASSIGNED" ||
                                            requestStatus === "CONFIRMED" ? (
                                                <button
                                                    type="button"
                                                    className={`delivery-primary-action ${
                                                        isExchange
                                                            ? "action-blue"
                                                            : "action-red"
                                                    }`}
                                                    onClick={() =>
                                                        handleItemPickedUp(
                                                            request
                                                        )
                                                    }
                                                    disabled={isPicking}
                                                >
                                                    {isPicking ? (
                                                        <>
                                                            <FaSpinner className="fa-spin" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaCheckCircle />
                                                            Item Picked Up
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="delivery-completed-pill">
                                                    <FaCheckCircle />
                                                    Item Picked Up
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* NORMAL DELIVERIES */}
                <section className="delivery-section delivery-section-last">
                    <div className="delivery-section-heading">
                        <div>
                            <div className="delivery-section-kicker">
                                YOUR ROUTE
                            </div>
                            <h2>
                                <FaTruck /> Out For Delivery
                            </h2>
                            <p>Orders currently ready for customer delivery.</p>
                        </div>

                        <button
                            type="button"
                            className="delivery-view-all-btn"
                            onClick={() => navigate("/delivery/orders")}
                            disabled={loggingOut}
                        >
                            View All Deliveries
                            <FaArrowRight />
                        </button>
                    </div>

                    {orders.length === 0 ? (
                        <div className="delivery-empty-card">
                            <div className="delivery-empty-icon delivery-empty-icon-success">
                                <FaCheckCircle />
                            </div>
                            <h3>No active deliveries</h3>
                            <p>
                                There are currently no shipments with
                                OUT_FOR_DELIVERY status.
                            </p>
                            <button
                                type="button"
                                className="delivery-empty-action"
                                onClick={() => loadDashboard(true)}
                                disabled={refreshing}
                            >
                                <FaSyncAlt
                                    className={refreshing ? "fa-spin" : ""}
                                />
                                Check Again
                            </button>
                        </div>
                    ) : (
                        <div className="delivery-card-grid">
                            {orders.slice(0, 6).map((item) => (
                                <article
                                    className="delivery-order-card"
                                    key={item?.shipment?.$id}
                                >
                                    <div className="delivery-order-card-top">
                                        <div>
                                            <span className="delivery-label">
                                                ORDER ID
                                            </span>
                                            <h3>{getOrderId(item)}</h3>
                                        </div>
                                        <span className="delivery-status-badge">
                                            <span />
                                            OUT FOR DELIVERY
                                        </span>
                                    </div>

                                    <div className="delivery-order-divider" />

                                    <div className="delivery-customer-block">
                                        <div className="delivery-customer-avatar">
                                            {(getCustomerName(item) || "C")
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                        <div>
                                            <span>Customer</span>
                                            <strong>
                                                {getCustomerName(item)}
                                            </strong>
                                        </div>
                                    </div>

                                    {(() => {
                                        const activeItems = getActiveDeliveryItems(
                                            item?.order
                                        );
                                        if (activeItems.length === 0) return null;
                                        return (
                                            <div className="delivery-info-row mb-2">
                                                <span>
                                                    Items to Deliver ({activeItems.length})
                                                </span>
                                                <strong>
                                                    {activeItems
                                                        .map(
                                                            (it) =>
                                                                `${it?.title || it?.name || "Product"} (x${it?.quantity || it?.qty || 1})`
                                                        )
                                                        .join(", ")}
                                                </strong>
                                            </div>
                                        );
                                    })()}

                                    <div className="delivery-address-box">
                                        <div className="delivery-address-icon">
                                            <FaMapMarkerAlt />
                                        </div>
                                        <div>
                                            <span>Delivery address</span>
                                            <p>{getAddress(item)}</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="delivery-open-btn"
                                        onClick={() =>
                                            navigate(
                                                `/delivery/shipment/${item.shipment.$id}`
                                            )
                                        }
                                    >
                                        Open Delivery
                                        <FaArrowRight />
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}

                    {orders.length > 6 && (
                        <div className="delivery-more-note">
                            Showing 6 of {orders.length} active deliveries.
                            <button
                                type="button"
                                onClick={() => navigate("/delivery/orders")}
                            >
                                View all
                            </button>
                        </div>
                    )}
                </section>

                <footer className="delivery-footer">
                    <span>TECHSTORE Delivery Operations</span>
                    <span>Secure • Fast • Customer First</span>
                </footer>
            </div>
        </div>
    );
}

export default DeliveryBoyDashboard;
