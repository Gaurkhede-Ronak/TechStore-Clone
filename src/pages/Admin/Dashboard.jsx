import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBox,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaPlus,
  FaReceipt,
  FaRedo,
  FaShoppingCart,
  FaTruck,
  FaUsers,
  FaBell,
  FaArrowRight,
  FaWarehouse,
} from "react-icons/fa";
import { Query } from "appwrite";
import { toast } from "react-hot-toast";

import { databases } from "../../appwrite/config";

import "../../css/Dashboard.css";

/* APPWRITE CONFIG */

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

const PRODUCTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID;

const ORDERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;

const USERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID;

const SHIPMENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID;

const NOTIFICATIONS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_NOTIFICATIONS_COLLECTION_ID;

/* HELPERS */

const safeString = (value, fallback = "N/A") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
};

const getOrderId = (order) => {
  return (
    order?.orderId ||
    order?.orderNumber ||
    order?.orderID ||
    order?.$id ||
    "N/A"
  );
};

const getCustomerName = (order) => {
  return (
    order?.customerName ||
    order?.name ||
    order?.fullName ||
    order?.userName ||
    order?.customer?.name ||
    order?.email ||
    "Customer"
  );
};

const getCustomerEmail = (order) => {
  return (
    order?.customerEmail ||
    order?.email ||
    order?.customer?.email ||
    ""
  );
};

const getPayment = (order) => {
  return (
    order?.paymentStatus ||
    order?.payment_status ||
    order?.payment?.status ||
    "Pending"
  );
};

const getStatus = (order) => {
  return (
    order?.status ||
    order?.orderStatus ||
    order?.order_status ||
    "Pending"
  );
};

const getShipmentStatus = (shipment) => {
  return (
    shipment?.shippingStatus ||
    shipment?.shipmentStatus ||
    shipment?.status ||
    "Placed"
  );
};

const getOrderTotal = (order) => {
  const value =
    order?.totalAmount ??
    order?.total ??
    order?.grandTotal ??
    order?.amount ??
    order?.price ??
    0;

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const getOrderDate = (order) => {
  return order?.$createdAt || order?.createdAt || order?.orderDate || null;
};

const formatDate = (date) => {
  if (!date) return "N/A";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "N/A";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "N/A";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "N/A";
  }

  return parsedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
};

const normalizeStatus = (status) => {
  return safeString(status, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();
};

/* STATUS BADGE */

const StatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);

  let type = "neutral";

  if (
    normalized.includes("delivered") ||
    normalized.includes("completed") ||
    normalized.includes("paid") ||
    normalized.includes("success")
  ) {
    type = "success";
  } else if (
    normalized.includes("pending") ||
    normalized.includes("processing") ||
    normalized.includes("packed") ||
    normalized.includes("placed")
  ) {
    type = "warning";
  } else if (
    normalized.includes("cancel") ||
    normalized.includes("failed") ||
    normalized.includes("exception") ||
    normalized.includes("return")
  ) {
    type = "danger";
  } else if (
    normalized.includes("dispatch") ||
    normalized.includes("transit") ||
    normalized.includes("out for delivery") ||
    normalized.includes("shipping")
  ) {
    type = "primary";
  } else if (
    normalized.includes("hub") ||
    normalized.includes("reached")
  ) {
    type = "purple";
  }

  return (
    <span className={`dashboard-status-badge ${type}`}>
      {safeString(status)}
    </span>
  );
};

/* KPI CARD */

const KpiCard = ({
  icon,
  label,
  value,
  variant = "",
}) => {
  return (
    <div className={`dashboard-kpi-card ${variant}`}>
      <div className="dashboard-kpi-top">
        <div className="dashboard-kpi-icon">
          {icon}
        </div>
      </div>

      <div className="dashboard-kpi-label">
        {label}
      </div>

      <div className="dashboard-kpi-value">
        {value}
      </div>
    </div>
  );
};

/* MAIN DASHBOARD */

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [currentTime, setCurrentTime] = useState(new Date());

  /* CURRENT TIME */

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /* LOAD COLLECTION */

  const loadCollection = useCallback(
    async (collectionId) => {
      if (!DATABASE_ID || !collectionId) {
        return [];
      }

      const response = await databases.listDocuments(
        DATABASE_ID,
        collectionId,
        [
          Query.limit(100),
          Query.orderDesc("$createdAt"),
        ]
      );

      return response?.documents || [];
    },
    []
  );

  /* LOAD DASHBOARD */

  const loadDashboard = useCallback(
    async (showToast = false) => {
      try {
        setError("");

        if (showToast) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          productsData,
          ordersData,
          usersData,
          shipmentsData,
          notificationsData,
        ] = await Promise.all([
          loadCollection(PRODUCTS_COLLECTION_ID),
          loadCollection(ORDERS_COLLECTION_ID),
          loadCollection(USERS_COLLECTION_ID),
          loadCollection(SHIPMENTS_COLLECTION_ID),
          loadCollection(NOTIFICATIONS_COLLECTION_ID),
        ]);

        setProducts(productsData);
        setOrders(ordersData);
        setUsers(usersData);
        setShipments(shipmentsData);
        setNotifications(notificationsData);

        if (showToast) {
          toast.success("Dashboard refreshed successfully");
        }
      } catch (err) {
        console.error("Dashboard loading error:", err);

        setError(
          err?.message ||
            "Unable to load dashboard data. Please try again."
        );

        if (showToast) {
          toast.error("Failed to refresh dashboard");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCollection]
  );

  /* INITIAL LOAD */

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  /* NORMALIZED ORDERS */

  const normalizedOrders = useMemo(() => {
    return orders.map((order) => ({
      ...order,
      displayOrderId: getOrderId(order),
      displayCustomer: getCustomerName(order),
      displayEmail: getCustomerEmail(order),
      displayPayment: getPayment(order),
      displayStatus: getStatus(order),
      displayTotal: getOrderTotal(order),
      displayDate: getOrderDate(order),
    }));
  }, [orders]);

  /* REVENUE */

  const totalRevenue = useMemo(() => {
    return normalizedOrders.reduce(
      (total, order) => total + order.displayTotal,
      0
    );
  }, [normalizedOrders]);

  /* ORDER STATS */

  const orderStats = useMemo(() => {
    const stats = {
      total: normalizedOrders.length,
      pending: 0,
      processing: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };

    normalizedOrders.forEach((order) => {
      const status = normalizeStatus(order.displayStatus);

      if (status.includes("pending")) {
        stats.pending++;
      } else if (
        status.includes("processing") ||
        status.includes("process")
      ) {
        stats.processing++;
      } else if (
        status.includes("confirm") ||
        status.includes("placed")
      ) {
        stats.confirmed++;
      } else if (
        status.includes("ship") ||
        status.includes("dispatch") ||
        status.includes("transit")
      ) {
        stats.shipped++;
      } else if (status.includes("deliver")) {
        stats.delivered++;
      } else if (status.includes("cancel")) {
        stats.cancelled++;
      } else if (
        status.includes("return") ||
        status.includes("refund")
      ) {
        stats.returned++;
      }
    });

    return stats;
  }, [normalizedOrders]);

  /* RECENT ORDERS */

  const recentOrders = useMemo(() => {
    return [...normalizedOrders]
      .sort((a, b) => {
        const dateA = new Date(a.displayDate || 0).getTime();
        const dateB = new Date(b.displayDate || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 6);
  }, [normalizedOrders]);

  /* RECENT CUSTOMERS */

  const recentCustomers = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const dateA = new Date(a.$createdAt || 0).getTime();
        const dateB = new Date(b.$createdAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [users]);

  /* UNREAD NOTIFICATIONS */

  const unreadNotifications = useMemo(() => {
    return notifications
      .filter((notification) => {
        return (
          notification?.isRead === false ||
          notification?.read === false ||
          notification?.status === "unread"
        );
      })
      .slice(0, 5);
  }, [notifications]);

  /* SHIPMENT STATS */

  const shipmentStats = useMemo(() => {
    const stats = {
      total: shipments.length,
      placed: 0,
      packed: 0,
      dispatched: 0,
      inTransit: 0,
      reachedHub: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      exception: 0,
    };

    shipments.forEach((shipment) => {
      const status = normalizeStatus(
        getShipmentStatus(shipment)
      );

      if (status.includes("deliver")) {
        stats.delivered++;
      } else if (
        status.includes("exception") ||
        status.includes("failed")
      ) {
        stats.exception++;
      } else if (status.includes("cancel")) {
        stats.cancelled++;
      } else if (
        status.includes("out for delivery") ||
        status.includes("outfordelivery")
      ) {
        stats.outForDelivery++;
      } else if (
        status.includes("hub") ||
        status.includes("reached")
      ) {
        stats.reachedHub++;
      } else if (
        status.includes("transit") ||
        status.includes("shipping")
      ) {
        stats.inTransit++;
      } else if (status.includes("dispatch")) {
        stats.dispatched++;
      } else if (status.includes("pack")) {
        stats.packed++;
      } else {
        stats.placed++;
      }
    });

    return stats;
  }, [shipments]);

  /* DELIVERY PERCENTAGE */

  const deliveryPercentage = useMemo(() => {
    if (!shipmentStats.total) {
      return 0;
    }

    return Math.round(
      (shipmentStats.delivered / shipmentStats.total) * 100
    );
  }, [shipmentStats]);

  /* GREETING */

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();

    if (hour < 12) {
      return "Good Morning";
    }

    if (hour < 17) {
      return "Good Afternoon";
    }

    return "Good Evening";
  }, [currentTime]);

  /* INITIAL LOADING */

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">
          Loading dashboard...
        </div>
      </main>
    );
  }

  /* UI */

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">

        {/* HEADER */}

        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <h1 className="dashboard-title">
              Admin Dashboard
            </h1>

            <p className="dashboard-subtitle">
              Manage your TechStore business from one place.
            </p>
          </div>

          <div className="dashboard-header-right">
            <div className="dashboard-date">
              <strong>
                {formatDate(currentTime)}
              </strong>

              <span>
                {formatTime(currentTime)}
              </span>
            </div>

            <button
              type="button"
              className="dashboard-refresh-btn"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              <FaRedo
                className={refreshing ? "dashboard-spin" : ""}
              />

              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className="dashboard-error">
            <FaExclamationTriangle />

            <span>{error}</span>
          </div>
        )}

        {/* WELCOME */}

        <section className="dashboard-welcome">
          <div className="dashboard-welcome-content">
            <h2>
              {greeting} 👋
            </h2>

            <p>
              Here's what's happening with your TechStore
              today. Monitor orders, customers, revenue and
              shipment activity from your admin dashboard.
            </p>
          </div>
        </section>

        {/* KPI CARDS */}

        <section className="dashboard-kpi-grid">

          <KpiCard
            icon={<FaBox />}
            label="Total Products"
            value={products.length}
            variant="primary"
          />

          <KpiCard
            icon={<FaShoppingCart />}
            label="Total Orders"
            value={orderStats.total}
            variant="success"
          />

          <KpiCard
            icon={<FaUsers />}
            label="Total Customers"
            value={users.length}
            variant="purple"
          />

          <KpiCard
            icon={<FaMoneyBillWave />}
            label="Total Revenue"
            value={formatMoney(totalRevenue)}
            variant="warning"
          />

        </section>

        {/* TWO COLUMN */}

        <div className="dashboard-two-column">

          {/* ORDER STATUS */}

          <section className="dashboard-section">
            <div className="dashboard-section-card">

              <div className="dashboard-section-header">
                <div>
                  <h3 className="dashboard-section-title">
                    Order Status Overview
                  </h3>

                  <p className="dashboard-section-description">
                    Current order distribution
                  </p>
                </div>

                <Link
                  to="/admin/orders"
                  className="dashboard-section-action"
                >
                  View Orders
                  <FaArrowRight />
                </Link>
              </div>

              <div className="dashboard-status-grid">

                <div className="dashboard-status-item warning">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot warning" />
                    <span className="dashboard-status-name">
                      Pending
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.pending}
                  </span>
                </div>

                <div className="dashboard-status-item primary">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot primary" />
                    <span className="dashboard-status-name">
                      Processing
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.processing}
                  </span>
                </div>

                <div className="dashboard-status-item purple">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot purple" />
                    <span className="dashboard-status-name">
                      Confirmed
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.confirmed}
                  </span>
                </div>

                <div className="dashboard-status-item info">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot info" />
                    <span className="dashboard-status-name">
                      Shipped
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.shipped}
                  </span>
                </div>

                <div className="dashboard-status-item success">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot success" />
                    <span className="dashboard-status-name">
                      Delivered
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.delivered}
                  </span>
                </div>

                <div className="dashboard-status-item danger">
                  <div className="dashboard-status-left">
                    <span className="dashboard-status-dot danger" />
                    <span className="dashboard-status-name">
                      Cancelled
                    </span>
                  </div>

                  <span className="dashboard-status-count">
                    {orderStats.cancelled}
                  </span>
                </div>

              </div>
            </div>
          </section>

          {/* SHIPMENT OVERVIEW */}

          <section className="dashboard-section">
            <div className="dashboard-section-card">

              <div className="dashboard-section-header">
                <div>
                  <h3 className="dashboard-section-title">
                    Shipment Overview
                  </h3>

                  <p className="dashboard-section-description">
                    Live shipment data from Appwrite
                  </p>
                </div>

                <Link
                  to="/admin/shipments"
                  className="dashboard-section-action"
                >
                  Shipments
                  <FaArrowRight />
                </Link>
              </div>

              <div className="dashboard-shipment-grid">

                <div className="dashboard-shipment-card primary">
                  <div className="dashboard-shipment-label">
                    Total Shipments
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.total}
                  </div>
                </div>

                <div className="dashboard-shipment-card purple">
                  <div className="dashboard-shipment-label">
                    Dispatched
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.dispatched}
                  </div>
                </div>

                <div className="dashboard-shipment-card info">
                  <div className="dashboard-shipment-label">
                    In Transit
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.inTransit}
                  </div>
                </div>

                <div className="dashboard-shipment-card warning">
                  <div className="dashboard-shipment-label">
                    Out for Delivery
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.outForDelivery}
                  </div>
                </div>

                <div className="dashboard-shipment-card success">
                  <div className="dashboard-shipment-label">
                    Delivered
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.delivered}
                  </div>
                </div>

                <div className="dashboard-shipment-card danger">
                  <div className="dashboard-shipment-label">
                    Exceptions
                  </div>

                  <div className="dashboard-shipment-value">
                    {shipmentStats.exception}
                  </div>
                </div>

              </div>

              <div className="dashboard-shipment-progress">

                <div className="dashboard-progress-header">
                  <span>
                    Delivery Progress
                  </span>

                  <span>
                    {deliveryPercentage}%
                  </span>
                </div>

                <div className="dashboard-progress">
                  <div
                    className="dashboard-progress-bar"
                    style={{
                      width: `${deliveryPercentage}%`,
                    }}
                  />
                </div>

              </div>

            </div>
          </section>

        </div>

        {/* RECENT ORDERS */}

        <section className="dashboard-section">
          <div className="dashboard-section-card">

            <div className="dashboard-section-header">
              <div>
                <h3 className="dashboard-section-title">
                  Recent Orders
                </h3>

                <p className="dashboard-section-description">
                  Latest orders from your customers
                </p>
              </div>

              <Link
                to="/admin/orders"
                className="dashboard-section-action"
              >
                View All
                <FaArrowRight />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">
                  <FaShoppingCart />
                </div>

                <h4 className="dashboard-empty-title">
                  No orders found
                </h4>

                <p className="dashboard-empty-text">
                  Orders will appear here once customers
                  place them.
                </p>
              </div>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.$id}>

                        <td>
                          <span className="dashboard-order-id">
                            #{safeString(order.displayOrderId)}
                          </span>
                        </td>

                        <td>
                          <div className="dashboard-customer">

                            <div className="dashboard-customer-avatar">
                              {safeString(
                                order.displayCustomer,
                                "C"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="dashboard-customer-info">
                              <div className="dashboard-customer-name">
                                {safeString(
                                  order.displayCustomer,
                                  "Customer"
                                )}
                              </div>

                              <div className="dashboard-customer-email">
                                {safeString(
                                  order.displayEmail,
                                  "No email"
                                )}
                              </div>
                            </div>

                          </div>
                        </td>

                        <td>
                          <strong>
                            {formatMoney(order.displayTotal)}
                          </strong>
                        </td>

                        <td>
                          <StatusBadge
                            status={order.displayPayment}
                          />
                        </td>

                        <td>
                          <StatusBadge
                            status={order.displayStatus}
                          />
                        </td>

                        <td>
                          {formatDate(order.displayDate)}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </section>

        {/* NOTIFICATIONS + CUSTOMERS */}

        <div className="dashboard-two-column">

          {/* NOTIFICATIONS */}

          <section className="dashboard-section">
            <div className="dashboard-section-card">

              <div className="dashboard-section-header">
                <div>
                  <h3 className="dashboard-section-title">
                    Notifications
                  </h3>

                  <p className="dashboard-section-description">
                    Recent admin notifications
                  </p>
                </div>

                <Link
                  to="/admin/notifications"
                  className="dashboard-section-action"
                >
                  View All
                  <FaArrowRight />
                </Link>
              </div>

              {unreadNotifications.length === 0 ? (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-icon">
                    <FaBell />
                  </div>

                  <h4 className="dashboard-empty-title">
                    No unread notifications
                  </h4>

                  <p className="dashboard-empty-text">
                    You're all caught up.
                  </p>
                </div>
              ) : (
                <div className="dashboard-notification-list">
                  {unreadNotifications.map(
                    (notification) => (
                      <div
                        className="dashboard-notification"
                        key={notification.$id}
                      >

                        <div className="dashboard-notification-icon">
                          <FaBell />
                        </div>

                        <div className="dashboard-notification-content">

                          <h4 className="dashboard-notification-title">
                            {safeString(
                              notification.title,
                              "Notification"
                            )}
                          </h4>

                          <p className="dashboard-notification-message">
                            {safeString(
                              notification.message,
                              "You have a new notification."
                            )}
                          </p>

                        </div>

                      </div>
                    )
                  )}
                </div>
              )}

            </div>
          </section>

          {/* LATEST CUSTOMERS */}

          <section className="dashboard-section">
            <div className="dashboard-section-card">

              <div className="dashboard-section-header">
                <div>
                  <h3 className="dashboard-section-title">
                    Latest Customers
                  </h3>

                  <p className="dashboard-section-description">
                    Recently registered users
                  </p>
                </div>

                <Link
                  to="/admin/users"
                  className="dashboard-section-action"
                >
                  View Users
                  <FaArrowRight />
                </Link>
              </div>

              {recentCustomers.length === 0 ? (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-icon">
                    <FaUsers />
                  </div>

                  <h4 className="dashboard-empty-title">
                    No customers found
                  </h4>

                  <p className="dashboard-empty-text">
                    New customers will appear here.
                  </p>
                </div>
              ) : (
                <div className="dashboard-customer-list">
                  {recentCustomers.map((customer) => {

                    const customerName =
                      customer?.name ||
                      customer?.fullName ||
                      customer?.username ||
                      "Customer";

                    const customerEmail =
                      customer?.email ||
                      "No email";

                    return (
                      <div
                        className="dashboard-customer-row"
                        key={customer.$id}
                      >

                        <div className="dashboard-customer-avatar">
                          {customerName
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="dashboard-customer-row-info">

                          <div className="dashboard-customer-row-name">
                            {customerName}
                          </div>

                          <div className="dashboard-customer-row-email">
                            {customerEmail}
                          </div>

                        </div>

                        <FaArrowRight
                          size={12}
                          color="currentColor"
                        />

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </section>

        </div>

        {/* QUICK ACTIONS */}

        <section className="dashboard-section">

          <div className="dashboard-section-header">
            <div>
              <h3 className="dashboard-section-title">
                Quick Actions
              </h3>

              <p className="dashboard-section-description">
                Quickly access important admin tools
              </p>
            </div>
          </div>

          <div className="dashboard-quick-actions">

            <Link
              to="/admin/add-product"
              className="dashboard-quick-action"
            >
              <div className="dashboard-quick-action-icon">
                <FaPlus />
              </div>

              <div className="dashboard-quick-action-content">
                <div className="dashboard-quick-action-title">
                  Add Product
                </div>

                <div className="dashboard-quick-action-description">
                  Create a new product
                </div>
              </div>

              <FaArrowRight size={12} />
            </Link>

            <Link
              to="/admin/orders"
              className="dashboard-quick-action"
            >
              <div className="dashboard-quick-action-icon">
                <FaReceipt />
              </div>

              <div className="dashboard-quick-action-content">
                <div className="dashboard-quick-action-title">
                  Manage Orders
                </div>

                <div className="dashboard-quick-action-description">
                  View and manage orders
                </div>
              </div>

              <FaArrowRight size={12} />
            </Link>

            <Link
              to="/admin/shipments"
              className="dashboard-quick-action"
            >
              <div className="dashboard-quick-action-icon">
                <FaTruck />
              </div>

              <div className="dashboard-quick-action-content">
                <div className="dashboard-quick-action-title">
                  Track Shipments
                </div>

                <div className="dashboard-quick-action-description">
                  Manage delivery tracking
                </div>
              </div>

              <FaArrowRight size={12} />
            </Link>

            <Link
              to="/admin/inventory"
              className="dashboard-quick-action"
            >
              <div className="dashboard-quick-action-icon">
                <FaWarehouse />
              </div>

              <div className="dashboard-quick-action-content">
                <div className="dashboard-quick-action-title">
                  Inventory
                </div>

                <div className="dashboard-quick-action-description">
                  Manage product stock
                </div>
              </div>

              <FaArrowRight size={12} />
            </Link>

          </div>

        </section>

        {/* SUMMARY */}

        <section className="dashboard-summary-grid">

          <div className="dashboard-summary-card success">
            <div className="dashboard-summary-label">
              Delivered Orders
            </div>

            <div className="dashboard-summary-value">
              {orderStats.delivered}
            </div>
          </div>

          <div className="dashboard-summary-card primary">
            <div className="dashboard-summary-label">
              Shipment Delivery Rate
            </div>

            <div className="dashboard-summary-value">
              {deliveryPercentage}%
            </div>
          </div>

          <div className="dashboard-summary-card danger">
            <div className="dashboard-summary-label">
              Cancelled Orders
            </div>

            <div className="dashboard-summary-value">
              {orderStats.cancelled}
            </div>
          </div>

        </section>

      </div>
    </main>
  );
};

export default Dashboard;