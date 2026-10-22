import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaArrowLeft,
    FaArrowRight,
    FaSyncAlt,
    FaTruck,
    FaUndo,
    FaExchangeAlt,
    FaMapMarkerAlt,
    FaCheckCircle,
    FaSearch,
    FaSun,
    FaMoon,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { toggleTheme } from "../../redux/slices/themeSlice";

import shipmentService from "../../appwrite/shipmentService";
import orderService from "../../appwrite/orderService";
import returnExchangeService from "../../appwrite/returnExchangeService";

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

function DeliveryOrders() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const themeMode = useSelector((state) => state.theme?.mode || "light");

    useEffect(() => {
        document.body.className = themeMode;
        document.documentElement.setAttribute("data-theme", themeMode);
    }, [themeMode]);

    const [orders, setOrders] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("ALL");

    /* LOAD */
    const loadOrders = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            /* NORMAL DELIVERIES */
            const shipments = await shipmentService.getShipmentsByStatus(
                "OUT_FOR_DELIVERY"
            );

            const shipmentList = Array.isArray(shipments)
                ? shipments
                : shipments?.documents || [];

            const result = await Promise.all(
                shipmentList.map(async (shipment) => {
                    let order = null;

                    try {
                        if (shipment?.orderId) {
                            order = await orderService.getOrderSmart(
                                String(shipment.orderId)
                            );
                        }
                    } catch (error) {
                        console.error("Order load error:", error);
                    }

                    return {
                        shipment,
                        order,
                    };
                })
            );

            setOrders(result);

            /* RETURN / EXCHANGE */
            const requestList =
                await returnExchangeService.getDeliveryRequests();

            setRequests(
                Array.isArray(requestList)
                    ? requestList
                    : requestList?.documents || []
            );
        } catch (error) {
            console.error("Delivery Orders Error:", error);

            toast.error(
                error?.message || "Unable to load delivery orders"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    /* HELPERS */
    const getOrderId = (item) =>
        item?.order?.orderId || item?.shipment?.orderId || "N/A";

    const getCustomerName = (item) =>
        item?.order?.customerName ||
        item?.order?.name ||
        item?.order?.fullName ||
        item?.shipment?.customerName ||
        "Customer";

    const getAddress = (item) =>
        formatAddressValue(
            item?.order?.shippingAddress ||
                item?.order?.destinationAddress ||
                item?.order?.address ||
                item?.shipment?.destinationAddress
        );

    const getRequestBadge = (request) => {
        if (String(request?.type || "").toUpperCase() === "RETURN") {
            return (
                <span className="badge bg-danger">
                    <FaUndo className="me-1" />
                    RETURN
                </span>
            );
        }

        return (
            <span className="badge bg-primary">
                <FaExchangeAlt className="me-1" />
                EXCHANGE
            </span>
        );
    };

    /* FILTERING */
    const query = searchQuery.trim().toLowerCase();

    const filteredOrders = orders.filter((item) => {
        if (!query) return true;
        const idText = String(getOrderId(item)).toLowerCase();
        const nameText = String(getCustomerName(item)).toLowerCase();
        const addrText = String(getAddress(item)).toLowerCase();
        return (
            idText.includes(query) ||
            nameText.includes(query) ||
            addrText.includes(query)
        );
    });

    const filteredRequests = requests.filter((request) => {
        if (!query) return true;
        const refText = String(request?.referenceId || "").toLowerCase();
        const origText = String(request?.originalOrderId || "").toLowerCase();
        const reasonText = String(request?.reason || "").toLowerCase();
        return (
            refText.includes(query) ||
            origText.includes(query) ||
            reasonText.includes(query)
        );
    });

    const showDeliveriesSection =
        activeFilter === "ALL" || activeFilter === "DELIVERY";
    const showRequestsSection =
        activeFilter === "ALL" || activeFilter === "REQUESTS";

    /* LOADING */
    if (loading) {
        return (
            <div className={`delivery-orders-page delivery-loading-page theme-${themeMode}`} data-theme={themeMode}>
                <div className="delivery-shell">
                    <div className="delivery-loading-card">
                        <div className="delivery-loading-logo">
                            <FaTruck />
                        </div>
                        <div className="delivery-spinner" />
                        <h3>Loading your delivery queue</h3>
                        <p>
                            Syncing deliveries, returns and exchange requests.
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
        <div className={`delivery-orders-page theme-${themeMode}`} data-theme={themeMode}>
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
                            onClick={() => navigate("/delivery/dashboard")}
                        >
                            <FaArrowLeft />
                            Dashboard
                        </button>

                        <button
                            type="button"
                            className="delivery-icon-btn"
                            onClick={() => loadOrders(true)}
                            disabled={refreshing}
                            title="Refresh"
                        >
                            <FaSyncAlt className={refreshing ? "fa-spin" : ""} />
                        </button>
                    </div>
                </header>

                {/* PAGE HERO */}
                <section className="delivery-page-hero">
                    <div>
                        <div className="delivery-eyebrow">
                            <span className="delivery-live-dot" />
                            DELIVERY QUEUE
                        </div>
                        <h1>Delivery Orders</h1>
                        <p>
                            Manage active deliveries, returns and exchange
                            requests in one place.
                        </p>
                    </div>

                    <div className="delivery-hero-summary">
                        <div>
                            <strong>{orders.length}</strong>
                            <span>Active deliveries</span>
                        </div>
                        <div>
                            <strong>{requests.length}</strong>
                            <span>Service requests</span>
                        </div>
                    </div>
                </section>

                {/* SEARCH & FILTER TOOLBAR */}
                <div className="delivery-toolbar">
                    <div className="delivery-search-box">
                        <FaSearch />
                        <input
                            type="text"
                            className="delivery-search-input"
                            placeholder="Search by Order ID, Customer Name, Address or Request ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="delivery-filter-pills">
                        <button
                            type="button"
                            className={`delivery-filter-pill ${
                                activeFilter === "ALL" ? "active" : ""
                            }`}
                            onClick={() => setActiveFilter("ALL")}
                        >
                            All Queue ({orders.length + requests.length})
                        </button>
                        <button
                            type="button"
                            className={`delivery-filter-pill ${
                                activeFilter === "DELIVERY" ? "active" : ""
                            }`}
                            onClick={() => setActiveFilter("DELIVERY")}
                        >
                            <FaTruck />
                            Out for Delivery ({orders.length})
                        </button>
                        <button
                            type="button"
                            className={`delivery-filter-pill ${
                                activeFilter === "REQUESTS" ? "active" : ""
                            }`}
                            onClick={() => setActiveFilter("REQUESTS")}
                        >
                            <FaUndo />
                            Return &amp; Exchange ({requests.length})
                        </button>
                    </div>
                </div>

                {/* NORMAL DELIVERY */}
                {showDeliveriesSection && (
                    <section className="delivery-section">
                        <div className="delivery-section-heading">
                            <div>
                                <div className="delivery-section-kicker">
                                    ACTIVE ROUTE
                                </div>
                                <h2>
                                    <FaTruck /> Out for Delivery
                                </h2>
                                <p>
                                    Open a delivery to verify the customer and
                                    complete the handover.
                                </p>
                            </div>
                            <div className="delivery-section-count delivery-count-blue">
                                {filteredOrders.length} Active
                            </div>
                        </div>

                        {filteredOrders.length === 0 ? (
                            <div className="delivery-empty-card">
                                <div className="delivery-empty-icon delivery-empty-icon-blue">
                                    <FaTruck />
                                </div>
                                <h3>No active deliveries</h3>
                                <p>
                                    {query
                                        ? "No delivery matched your search query."
                                        : "No order is currently marked as out for delivery."}
                                </p>
                            </div>
                        ) : (
                            <div className="delivery-card-grid">
                                {filteredOrders.map((item) => (
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
                    </section>
                )}

                {/* RETURNS / EXCHANGES */}
                {showRequestsSection && (
                    <section className="delivery-section delivery-section-last">
                        <div className="delivery-section-heading">
                            <div>
                                <div className="delivery-section-kicker">
                                    SERVICE REQUESTS
                                </div>
                                <h2>
                                    <FaUndo /> Return &amp; Exchange
                                </h2>
                                <p>
                                    Customer service requests that need your
                                    pickup action.
                                </p>
                            </div>
                            <div className="delivery-section-count delivery-count-red">
                                {filteredRequests.length} Requests
                            </div>
                        </div>

                        {filteredRequests.length === 0 ? (
                            <div className="delivery-empty-card">
                                <div className="delivery-empty-icon delivery-empty-icon-success">
                                    <FaCheckCircle />
                                </div>
                                <h3>No service requests</h3>
                                <p>
                                    {query
                                        ? "No service request matched your search query."
                                        : "No return or exchange requests are currently assigned to you."}
                                </p>
                            </div>
                        ) : (
                            <div className="delivery-card-grid">
                                {filteredRequests.map((request) => (
                                    <article
                                        className="delivery-operation-card"
                                        key={request.$id}
                                    >
                                        <div className="delivery-operation-top">
                                            <div
                                                className={`delivery-request-icon ${
                                                    request.type === "RETURN"
                                                        ? "request-red"
                                                        : "request-blue"
                                                }`}
                                            >
                                                {request.type === "RETURN" ? (
                                                    <FaUndo />
                                                ) : (
                                                    <FaExchangeAlt />
                                                )}
                                            </div>

                                            <div className="delivery-operation-title">
                                                <span>Request ID</span>
                                                <h3>
                                                    {request.referenceId ||
                                                        "Request"}
                                                </h3>
                                            </div>

                                            {getRequestBadge(request)}
                                        </div>

                                        <div className="delivery-info-list">
                                            <div className="delivery-info-row">
                                                <span>Original order</span>
                                                <strong>
                                                    {request.originalOrderId ||
                                                        "N/A"}
                                                </strong>
                                            </div>
                                            <div className="delivery-info-row">
                                                <span>Status</span>
                                                <strong>
                                                    {request.status || "N/A"}
                                                </strong>
                                            </div>
                                            {request.reason && (
                                                <div className="delivery-reason-box">
                                                    <span>Reason</span>
                                                    <p>{request.reason}</p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            className="delivery-secondary-action"
                                            onClick={() =>
                                                navigate(
                                                    `/delivery/shipment/${request.$id}`
                                                )
                                            }
                                        >
                                            Open Request
                                            <FaArrowRight />
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                <footer className="delivery-footer">
                    <span>TECHSTORE Delivery Operations</span>
                    <span>Secure • Fast • Customer First</span>
                </footer>
            </div>
        </div>
    );
}

export default DeliveryOrders;
