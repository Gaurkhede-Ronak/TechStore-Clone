import { useEffect, useState, useMemo, useRef } from "react";
import {
  FaBoxOpen,
  FaChevronRight,
  FaSearch,
  FaSlidersH,
  FaTimes,
  FaUndoAlt,
  FaCheck,
  FaChevronDown,
  FaCheckCircle,
  FaTruck,
  FaBox,
  FaShippingFast,
  FaBan,
  FaSyncAlt,
  FaExchangeAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../css/OrderHistory.css";
import toast from "react-hot-toast";

import authService from "../appwrite/authService";
import orderService from "../appwrite/orderService";
import shipmentService from "../appwrite/shipmentService";
import returnExchangeService from "../appwrite/returnExchangeService";
import reviewService from "../appwrite/reviewService";

  // HELPERS

const normalizeStatus = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  const aliases = {
    PLACED: "PLACED",
    CONFIRMED: "PLACED",
    PACKED: "PACKED",
    DISPATCHED: "DISPATCHED",
    SHIPPED: "DISPATCHED",
    IN_TRANSIT: "IN_TRANSIT",
    TRANSIT: "IN_TRANSIT",
    REACHED_HUB: "REACHED_HUB",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    CANCELED: "CANCELLED",
  };

  return aliases[value] || "PLACED";
};

const statusLabel = (status) => {
  const map = {
    PLACED: "Placed",
    PACKED: "Packed",
    DISPATCHED: "Dispatched",
    IN_TRANSIT: "In Transit",
    REACHED_HUB: "Reached Hub",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  return map[normalizeStatus(status)] || "Placed";
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatOrderDate = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const parseItems = (order) => {
  let items =
    order?.items || order?.products || order?.cartItems || [];

  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }

  if (!Array.isArray(items)) {
    items = items ? [items] : [];
  }

  if (items.length === 0) {
    items = [
      {
        title: "TechStore Order",
        name: "TechStore Order",
        quantity: 1,
        price: Number(order?.total || order?.payableAmount || 0),
      },
    ];
  }

  return items;
};

const getPaymentSubtitle = (order) => {
  const rawMethod = String(
    order?.payment || order?.paymentMethod || ""
  ).toUpperCase();
  const walletPaid = Number(order?.walletPaid || order?.usedWalletAmount || 0);

  let primary = "UPI Payment";
  if (rawMethod.includes("COD") || rawMethod.includes("CASH")) {
    primary = "Cash on Delivery";
  } else if (rawMethod.includes("CARD") || rawMethod.includes("CREDIT") || rawMethod.includes("DEBIT")) {
    primary = "Card Payment";
  } else if (rawMethod.includes("UPI") || rawMethod.includes("GPAY") || rawMethod.includes("PHONEPE")) {
    primary = "UPI Payment";
  }

  if (walletPaid > 0) {
    return primary === "Cash on Delivery"
      ? "Cash on Delivery, TechStore Wallet"
      : `${primary}, TechStore Wallet`;
  }

  return primary;
};

function OrderHistory() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [period, setPeriod] = useState("2026");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const periodRef = useRef(null);
  const statusRef = useRef(null);

  // LOAD ORDERS & REVIEWS

  const loadOrders = async (showToast = false) => {
    try {
      setLoading(true);
      setError("");

      const currentUser = await authService.getCurrentUser();
      if (!currentUser?.$id) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch user orders, reviews, and return/exchange requests in parallel
      const [orderRes, reviewDocs, userReturnDocs] = await Promise.all([
        orderService.getOrdersByUser(currentUser.$id),
        reviewService.getReviewsByUser(currentUser.$id).catch(() => []),
        returnExchangeService.getUserRequests(currentUser.$id).catch(() => []),
      ]);
      const allUserReturns = Array.isArray(userReturnDocs)
        ? userReturnDocs
        : Array.isArray(userReturnDocs?.documents)
        ? userReturnDocs.documents
        : [];

      setUserReviews(Array.isArray(reviewDocs) ? reviewDocs : []);

      const documents = Array.isArray(orderRes?.documents)
        ? orderRes.documents
        : [];

      const normalizedOrders = await Promise.all(
        documents.map(async (order) => {
          const parsedItems = parseItems(order);
          let shipment = null;
          let returnRequests = [];

          const orderId = order?.orderId || order?.$id || "";

          // Fetch Live Shipment
          try {
            const shipmentResponse = await shipmentService.getShipmentsByOrderId(orderId);
            const shipmentDocuments = Array.isArray(shipmentResponse?.documents)
              ? shipmentResponse.documents
              : Array.isArray(shipmentResponse)
              ? shipmentResponse
              : [];

            if (shipmentDocuments.length > 0) {
              shipment = [...shipmentDocuments].sort(
                (a, b) =>
                  new Date(b?.$updatedAt || b?.$createdAt || 0).getTime() -
                  new Date(a?.$updatedAt || a?.$createdAt || 0).getTime()
              )[0];
            }
          } catch (shipmentError) {
            console.warn("Shipment load failed:", orderId, shipmentError);
          }

          // Match or Fetch Return / Exchange Requests
          try {
            const matchedFromUser = allUserReturns.filter((r) => {
              const origId = String(r?.originalOrderId || r?.orderId || "").trim();
              return (
                (orderId && origId === String(orderId).trim()) ||
                (order?.$id && origId === String(order.$id).trim())
              );
            });

            if (matchedFromUser.length > 0) {
              returnRequests = matchedFromUser;
            } else {
              const requests = await returnExchangeService.getRequestsByOrderId(orderId);
              if (Array.isArray(requests)) {
                returnRequests = requests;
              } else if (Array.isArray(requests?.documents)) {
                returnRequests = requests.documents;
              }
            }
          } catch (returnError) {
            console.warn("Return/Exchange load failed:", orderId, returnError);
          }

          const liveStatus = shipment?.status
            ? normalizeStatus(shipment.status)
            : normalizeStatus(order?.status || "PLACED");

          return {
            ...order,
            items: parsedItems,
            orderDate: order?.orderDate || order?.$createdAt || null,
            orderId,
            originalOrderStatus: order?.status || "Placed",
            liveStatus,
            shipment,
            returnRequests,
          };
        })
      );

      setOrders(normalizedOrders);

      if (showToast) {
        toast.success("Orders refreshed!");
      }
    } catch (err) {
      console.error("Order load error:", err);
      setError(err?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Dropdown click outside handlers
  useEffect(() => {
    function handleClickOutside(event) {
      if (periodRef.current && !periodRef.current.contains(event.target)) {
        setIsPeriodOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setIsStatusOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // FILTER RESET
  function resetFilters() {
    setSearch("");
    setStatus("All");
    setPeriod("2026");
    setIsPeriodOpen(false);
    setIsStatusOpen(false);
    toast.success("Filters reset!");
  }

  // ============================================================
  // EXPAND ORDERS + RETURN / EXCHANGE ENTRIES
  // Each Return (RE-ORD...) and Exchange (EX-ORD...) gets its own
  // standalone card entry with its Return ID / Exchange ID header,
  // just like Admin and Delivery Boy panels.
  // ============================================================
  const allEntries = useMemo(() => {
    const entries = [];

    orders.forEach((order) => {
      const orderId = order?.orderId || order?.$id || "N/A";
      const returnRequests = Array.isArray(order?.returnRequests)
        ? order.returnRequests
        : [];

      // 1. Original Order Card Entry
      entries.push({
        entryKey: `order-${order?.$id || orderId}`,
        entryType: "ORDER",
        idLabel: "Order ID",
        displayId: orderId,
        sortDate: order?.orderDate || order?.$createdAt || null,
        order,
        returnRequest: null,
      });

      // 2. Separate Card Entry for each Return / Exchange Request
      returnRequests.forEach((req, idx) => {
        const isEx = String(req?.type || "").toUpperCase() === "EXCHANGE";
        const refId =
          req?.referenceId ||
          `${isEx ? "EX" : "RE"}-${orderId}-${String(idx + 1).padStart(2, "0")}`;

        entries.push({
          entryKey: `re-${req?.$id || refId}-${idx}`,
          entryType: isEx ? "EXCHANGE" : "RETURN",
          idLabel: isEx ? "Exchange ID" : "Return ID",
          displayId: refId,
          sortDate:
            req?.createdAt ||
            req?.$createdAt ||
            order?.orderDate ||
            order?.$createdAt ||
            null,
          order,
          returnRequest: req,
        });
      });
    });

    return entries;
  }, [orders]);

  // FILTERED ENTRIES
  const filteredOrders = useMemo(() => {
    let data = [...allEntries];

    if (search.trim() !== "") {
      const value = search.trim().toLowerCase();
      data = data.filter(({ order, displayId, returnRequest }) =>
        String(displayId || "").toLowerCase().includes(value) ||
        String(order?.orderId || order?.$id || "")
          .toLowerCase()
          .includes(value) ||
        String(returnRequest?.referenceId || "")
          .toLowerCase()
          .includes(value) ||
        order?.items?.some((item) =>
          String(item?.title || item?.name || "").toLowerCase().includes(value)
        )
      );
    }

    if (status !== "All") {
      const target = status.replace("Confirmed", "Placed").toLowerCase();
      data = data.filter(({ entryType, order }) => {
        if (target === "returned") {
          return entryType === "RETURN";
        }
        if (target === "exchanged") {
          return entryType === "EXCHANGE";
        }
        if (entryType !== "ORDER") {
          return false;
        }
        const current = statusLabel(order?.liveStatus).toLowerCase();
        return current === target;
      });
    }

    if (period !== "All Time") {
      data = data.filter(({ sortDate }) => {
        if (!sortDate) return true;
        return new Date(sortDate).getFullYear() === Number(period);
      });
    }

    data.sort((a, b) => {
      return (
        new Date(b?.sortDate || 0).getTime() -
        new Date(a?.sortDate || 0).getTime()
      );
    });

    return data;
  }, [allEntries, search, status, period]);

  const periodOptions = [
    { label: "Year 2026", value: "2026" },
    { label: "All Time", value: "All Time" },
  ];

  const statusOptions = [
    { label: "All Statuses", value: "All" },
    { label: "Confirmed", value: "Placed" },
    { label: "Packed", value: "Packed" },
    { label: "Dispatched", value: "Dispatched" },
    { label: "Out for Delivery", value: "Out for Delivery" },
    { label: "Delivered", value: "Delivered" },
    { label: "Returned", value: "Returned" },
    { label: "Exchanged", value: "Exchanged" },
    { label: "Cancelled", value: "Cancelled" },
  ];

  // STATUS BADGE RENDERER
  const renderStatusBadge = (itemStatus) => {
    const raw = String(itemStatus || "").trim().toUpperCase();

    if (raw === "RETURNED" || raw === "RETURN") {
      return (
        <span className="order-history-badge badge-returned">
          <FaUndoAlt size={11} />
          Returned
        </span>
      );
    }

    if (raw === "RETURN_CANCELLED") {
      return (
        <span className="order-history-badge badge-cancelled">
          <FaBan size={11} />
          Return Cancelled
        </span>
      );
    }

    if (raw === "EXCHANGED" || raw === "EXCHANGE") {
      return (
        <span className="order-history-badge badge-exchanged">
          <FaExchangeAlt size={11} />
          Exchanged
        </span>
      );
    }

    if (raw === "EXCHANGE_CANCELLED") {
      return (
        <span className="order-history-badge badge-cancelled">
          <FaBan size={11} />
          Exchange Cancelled
        </span>
      );
    }

    const s = normalizeStatus(itemStatus);

    if (s === "CANCELLED") {
      return (
        <span className="order-history-badge badge-cancelled">
          <FaBan size={11} />
          Cancelled
        </span>
      );
    }

    if (s === "DELIVERED") {
      return (
        <span className="order-history-badge badge-delivered">
          <FaCheckCircle size={11} />
          Delivered
        </span>
      );
    }

    if (s === "OUT_FOR_DELIVERY") {
      return (
        <span className="order-history-badge badge-out-delivery">
          <FaTruck size={11} />
          Out for Delivery
        </span>
      );
    }

    if (s === "DISPATCHED" || s === "IN_TRANSIT" || s === "REACHED_HUB") {
      return (
        <span className="order-history-badge badge-dispatched">
          <FaShippingFast size={11} />
          Dispatched
        </span>
      );
    }

    if (s === "PACKED") {
      return (
        <span className="order-history-badge badge-packed">
          <FaBox size={11} />
          Packed
        </span>
      );
    }

    return (
      <span className="order-history-badge badge-placed">
        <FaCheck size={11} />
        Placed
      </span>
    );
  };

  // NAVIGATION TO ORDER DETAILS
  const handleViewOrder = (order, item, returnRequest = null, itemIdx = 0) => {
    const params = new URLSearchParams();
    params.set("orderId", order?.orderId || order?.$id || "");
    params.set("itemIdx", String(itemIdx));
    const prodId = item?.productId || item?.id || item?.$id || "";
    if (prodId) {
      params.set("itemId", String(prodId));
    }
    if (returnRequest?.referenceId) {
      params.set("returnId", returnRequest.referenceId);
    }

    navigate(`/order-details?${params.toString()}`, {
      state: {
        order,
        shipment: order?.shipment || null,
        singleProduct: item || null,
        itemIndex: itemIdx,
        returnRequest: returnRequest || null,
      },
    });
  };

  // LOADING STATE
  if (loading) {
    return (
      <div className="order-history-wrapper py-5">
        <div className="container py-5 text-center" style={{ maxWidth: "980px" }}>
          <div className="spinner-border text-primary mb-4" style={{ width: "3rem", height: "3rem" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h3 className="fw-bold text-dark">Loading Your Orders...</h3>
          <p className="text-muted mb-0">Fetching your latest orders from Appwrite</p>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (error && orders.length === 0) {
    return (
      <div
        className="order-history-wrapper py-5 d-flex align-items-center justify-content-center"
        style={{ minHeight: "80vh" }}
      >
        <div className="container py-5 text-center">
          <div className="empty-cart-large-box py-5 px-4 animate-float-in">
            <div
              className="empty-illustration-wrap mb-4 mx-auto"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                borderColor: "rgba(239, 68, 68, 0.25)",
              }}
            >
              <FaBoxOpen
                size={85}
                style={{
                  color: "#ef4444",
                  filter: "drop-shadow(0 10px 15px rgba(239, 68, 68, 0.4))",
                }}
              />
            </div>
            <h2 className="fw-bold mb-2 display-5">Unable to Load Orders</h2>
            <p
              className="text-muted mb-4 fs-5"
              style={{ maxWidth: "450px", margin: "0 auto" }}
            >
              {error}
            </p>
            <button
              className="btn btn-primary px-5 py-3 fw-bold rounded-pill shadow-lg start-shopping-btn"
              onClick={() => loadOrders(true)}
            >
              <FaSyncAlt className="me-2" /> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // EMPTY STATE
  if (orders.length === 0) {
    return (
      <div
        className="order-history-wrapper py-5 d-flex align-items-center justify-content-center"
        style={{ minHeight: "80vh" }}
      >
        <div className="container py-5 text-center">
          <div className="empty-cart-large-box py-5 px-4 animate-float-in">
            <div className="empty-illustration-wrap mb-4 mx-auto">
              <FaBoxOpen size={85} className="text-primary empty-box-icon" />
            </div>
            <h2 className="fw-bold mb-2 display-5">No Orders Found</h2>
            <p
              className="text-muted mb-4 fs-5"
              style={{ maxWidth: "450px", margin: "0 auto" }}
            >
              You haven't placed any orders yet. Start exploring our premium
              store!
            </p>
            <button
              className="btn btn-primary px-5 py-3 fw-bold rounded-pill shadow-lg start-shopping-btn"
              onClick={() => navigate("/products")}
            >
              Start Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN RENDER (AJIO GROUPED ORDER ITEMS LAYOUT)
  return (
    <div className="order-history-wrapper py-3 py-md-5">
      <div className="container" style={{ maxWidth: "980px" }}>

        {/* PAGE TITLE */}
        <div className="d-none d-md-block text-center mb-4">
          <h1 className="fw-bold text-dark display-6 mb-1">My Orders</h1>
          <p className="text-muted fs-6 mb-2">Track your orders & view purchase history</p>
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-pill px-3 shadow-sm"
            onClick={() => loadOrders(true)}
          >
            <FaSyncAlt size={11} className="me-2" /> Refresh
          </button>
        </div>

        {/* MOBILE HEADER */}
        <div className="d-flex d-md-none align-items-center justify-content-between mb-3 px-1">
          <div>
            <h2 className="fw-bold text-dark mb-0 fs-4">
              {period === "All Time" ? "All Orders" : "Year 2026"}
            </h2>
            <small className="text-muted">
              {allEntries.length} {allEntries.length === 1 ? "Entry" : "Entries"}
            </small>
          </div>
          <button
            className="btn bg-white border rounded-pill px-3 py-1 fw-semibold d-flex align-items-center gap-2 shadow-sm text-dark fs-6"
            onClick={() => setShowFilterModal(true)}
          >
            <FaSlidersH size={13} /> Filter
          </button>
        </div>

        {/* DESKTOP FILTERS */}
        <div className="d-none d-md-block bg-white p-3 rounded-4 shadow-sm mb-4 border">
          <div className="row g-3 align-items-center">
            {/* Time Period */}
            <div className="col-md-3 position-relative" ref={periodRef}>
              <label className="text-muted extra-small d-block mb-1 fw-bold text-uppercase">
                Time Period
              </label>
              <div
                className={`custom-lux-dropdown ${isPeriodOpen ? "open" : ""}`}
                onClick={() => {
                  setIsPeriodOpen(!isPeriodOpen);
                  setIsStatusOpen(false);
                }}
              >
                <span>{periodOptions.find((p) => p.value === period)?.label}</span>
                <FaChevronDown className="arrow-icon" size={11} />
              </div>

              {isPeriodOpen && (
                <div className="lux-dropdown-menu shadow-lg">
                  {periodOptions.map((opt) => (
                    <div
                      key={opt.value}
                      className={`lux-dropdown-item ${period === opt.value ? "active" : ""}`}
                      onClick={() => {
                        setPeriod(opt.value);
                        setIsPeriodOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      {period === opt.value && <FaCheckCircle size={12} className="text-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Status */}
            <div className="col-md-4 position-relative" ref={statusRef}>
              <label className="text-muted extra-small d-block mb-1 fw-bold text-uppercase">
                Order Status
              </label>
              <div
                className={`custom-lux-dropdown ${isStatusOpen ? "open" : ""}`}
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsPeriodOpen(false);
                }}
              >
                <span>{statusOptions.find((s) => s.value === status)?.label}</span>
                <FaChevronDown className="arrow-icon" size={11} />
              </div>

              {isStatusOpen && (
                <div className="lux-dropdown-menu shadow-lg">
                  {statusOptions.map((opt) => (
                    <div
                      key={opt.value}
                      className={`lux-dropdown-item ${status === opt.value ? "active" : ""}`}
                      onClick={() => {
                        setStatus(opt.value);
                        setIsStatusOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      {status === opt.value && <FaCheckCircle size={12} className="text-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="col-md-5">
              <label className="text-muted extra-small d-block mb-1 fw-bold text-uppercase">
                Search Order / Return / Exchange ID
              </label>
              <div className="input-group lux-pill-search">
                <span className="input-group-text border-0 ps-3 pe-2 bg-transparent">
                  <FaSearch className="text-muted search-icon" size={13} />
                </span>
                <input
                  type="text"
                  className="form-control border-0 ps-1"
                  placeholder="e.g. ORD..., RE-ORD..., EX-ORD..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS BAR */}
        <div className="d-flex align-items-center justify-content-between mb-3 px-1">
          <span className="text-muted small">
            Showing <strong className="text-dark">{filteredOrders.length}</strong> of{" "}
            <strong className="text-dark">{allEntries.length}</strong> orders
          </span>
          {search && (
            <button
              type="button"
              className="btn btn-link text-primary p-0 small text-decoration-none"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          )}
        </div>

        {/* GROUPED ORDERS LIST (Order ID, Return ID, Exchange ID) */}
        <div className="orders-list-container">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-4 border shadow-sm p-5 text-center">
              <FaSearch size={40} className="text-muted mb-3" />
              <h4 className="fw-bold">No Matching Orders</h4>
              <p className="text-muted mb-4">Try adjusting your filters or search query.</p>
              <button className="btn btn-outline-dark rounded-pill px-4" onClick={resetFilters}>
                <FaUndoAlt className="me-2" /> Reset Filters
              </button>
            </div>
          ) : (
            filteredOrders.map((entry, entryIdx) => {
              const {
                entryKey,
                entryType,
                idLabel,
                displayId,
                sortDate,
                order,
                returnRequest,
              } = entry;

              const orderItems = order?.items || [];
              const orderId = order?.orderId || order?.$id || "N/A";
              const liveStatus = normalizeStatus(order?.liveStatus);
              const isDelivered = liveStatus === "DELIVERED";
              const isCancelled = liveStatus === "CANCELLED";
              const orderDateStr = formatOrderDate(order?.orderDate);
              const entryDateStr = formatOrderDate(sortDate) || orderDateStr;
              const paymentSubtitle = getPaymentSubtitle(order);

              const isExchangeEntry = entryType === "EXCHANGE";
              const isReturnEntry = entryType === "RETURN";
              const reqStatus = String(returnRequest?.status || "REQUESTED")
                .trim()
                .toUpperCase();
              const isReqCancelled = reqStatus === "CANCELLED";

              return (
                <div
                  className="ajio-order-group mb-4"
                  key={entryKey || `entry-${entryIdx}`}
                >
                  {/* ID HEADER: Order ID / Return ID / Exchange ID */}
                  <div className="ajio-order-id-label mb-2 px-1 text-muted fs-6">
                    {idLabel} :{" "}
                    <span className="fw-bold text-dark font-monospace">
                      {displayId}
                    </span>
                  </div>

                  {/* SUB-CARDS */}
                  <div className="d-flex flex-column gap-3">
                    {(isReturnEntry || isExchangeEntry
                      ? orderItems.slice(0, 1)
                      : orderItems
                    ).map((item, itemIdx) => {
                      const isThisItemCancelled =
                        Boolean(item?.isCancelled) ||
                        normalizeStatus(item?.status) === "CANCELLED" ||
                        isCancelled;
                      const itemCancelledDateStr =
                        formatOrderDate(item?.cancelledDate) || orderDateStr;
                      const rawImg =
                        item?.thumbnail ||
                        item?.image ||
                        item?.img ||
                        (Array.isArray(item?.images) ? item.images[0] : null);

                      const productImg = rawImg
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
                        : "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";

                      const productTitle =
                        item?.title || item?.name || "TechStore Product";
                      const itemQty = Number(item?.quantity || 1);
                      const origPrice = Number(item?.price || 0);
                      const discount = Number(item?.discount || 0);
                      const sellingPrice =
                        discount > 0
                          ? origPrice - (origPrice * discount) / 100
                          : origPrice;

                      // Check for user ratings
                      const itemReview = userReviews.find((rev) => {
                        const revProdId = String(rev?.productId || "");
                        const thisProdId = String(
                          item?.productId || item?.id || ""
                        );
                        return (
                          (revProdId &&
                            thisProdId &&
                            revProdId === thisProdId) ||
                          String(rev?.orderId || "") === String(orderId)
                        );
                      });

                      const userRating =
                        itemReview?.rating ||
                        item?.rating ||
                        (isDelivered ? item?.userRating : null);

                      return (
                        <div
                          key={`${entryKey}-${item?.id || item?.productId || itemIdx}`}
                          className="ajio-order-card bg-white rounded-4 border shadow-sm p-3 p-md-3 d-flex align-items-center justify-content-between cursor-pointer hover-lift"
                          onClick={() =>
                            handleViewOrder(order, item, returnRequest, itemIdx)
                          }
                        >
                          {/* LEFT: THUMBNAIL + OPTIONAL BADGE */}
                          <div className="d-flex align-items-center gap-3 gap-md-3 flex-grow-1 min-w-0">
                            <div className="ajio-thumb-container position-relative flex-shrink-0">
                              <img
                                src={productImg}
                                alt={productTitle}
                                className="ajio-native-thumb"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src =
                                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60";
                                }}
                              />
                              {isExchangeEntry && (
                                <div className="ajio-badge-overlay exchange-tag">
                                  EXCHANGE
                                </div>
                              )}
                              {isReturnEntry && (
                                <div className="ajio-badge-overlay return-tag">
                                  RETURN
                                </div>
                              )}
                            </div>

                            {/* CENTER: TITLE & DETAILS */}
                            <div className="ajio-card-content min-w-0">
                              {isReturnEntry ? (
                                <>
                                  <h5 className="fw-bold text-dark mb-1 fs-5 ajio-card-title">
                                    {isReqCancelled
                                      ? "Return Cancelled"
                                      : "Returned"}
                                  </h5>
                                  <div className="text-muted small mb-1">
                                    {isReqCancelled
                                      ? `Return cancelled on ${entryDateStr}`
                                      : `Returned on ${entryDateStr}`}
                                  </div>
                                  <div className="text-muted small">
                                    {paymentSubtitle}
                                  </div>
                                </>
                              ) : isExchangeEntry ? (
                                <>
                                  <h5 className="fw-bold text-dark mb-1 fs-5 ajio-card-title">
                                    {isReqCancelled
                                      ? "Exchange Cancelled"
                                      : "Exchanged"}
                                  </h5>
                                  <div className="text-muted small mb-1">
                                    {isReqCancelled
                                      ? `Exchange cancelled on ${entryDateStr}`
                                      : `Exchanged on ${entryDateStr}`}
                                  </div>
                                  <div className="text-muted small">
                                    {paymentSubtitle}
                                  </div>
                                </>
                              ) : isThisItemCancelled ? (
                                <>
                                  <h5 className="fw-bold text-dark mb-1 fs-5 ajio-card-title">
                                    Cancelled
                                  </h5>
                                  <div className="text-muted small mb-1">
                                    Cancelled on {itemCancelledDateStr}
                                  </div>
                                  <div className="text-muted small">
                                    {paymentSubtitle}
                                  </div>
                                </>
                              ) : isDelivered ? (
                                <>
                                  <h5 className="fw-bold text-dark mb-1 fs-5 ajio-card-title">
                                    Delivered
                                  </h5>
                                  <div className="text-muted small mb-1">
                                    Delivered on {orderDateStr}
                                  </div>
                                  {userRating ? (
                                    <div className="ajio-rating-row small d-flex align-items-center gap-1">
                                      <span className="text-muted">You rated</span>
                                      <div className="d-inline-flex gap-1 star-container">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <span
                                            key={star}
                                            className={
                                              star <= userRating
                                                ? "star-rated"
                                                : "star-unrated"
                                            }
                                          >
                                            ★
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-muted small">
                                      {paymentSubtitle}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <h5 className="fw-bold text-dark mb-1 fs-5 ajio-card-title text-truncate">
                                    {productTitle}
                                  </h5>
                                  <div className="text-muted small mb-1">
                                    {paymentSubtitle}
                                  </div>
                                  <div className="text-muted small">
                                    Price:{" "}
                                    <strong className="text-dark">
                                      ₹{formatMoney(sellingPrice * itemQty)}
                                    </strong>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* RIGHT: STATUS PILL BADGE & CHEVRON */}
                          <div className="ajio-card-end d-flex align-items-center gap-2 gap-md-3 flex-shrink-0 ms-3">
                            {isReturnEntry
                              ? renderStatusBadge(
                                  isReqCancelled
                                    ? "RETURN_CANCELLED"
                                    : "RETURNED"
                                )
                              : isExchangeEntry
                              ? renderStatusBadge(
                                  isReqCancelled
                                    ? "EXCHANGE_CANCELLED"
                                    : "EXCHANGED"
                                )
                              : isThisItemCancelled
                              ? renderStatusBadge("CANCELLED")
                              : renderStatusBadge(order.liveStatus)}
                            <FaChevronRight className="ajio-chevron" size={13} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MOBILE FILTER MODAL DRAWER */}
        {showFilterModal && (
          <div
            className="filter-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFilterModal(false);
            }}
          >
            <div className="filter-drawer-content p-4 rounded-4 shadow-lg mx-auto max-w-lg">
              <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-4">
                <h5 className="fw-bold mb-0 text-dark">Filter Orders</h5>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowFilterModal(false)}
                >
                  <FaTimes />
                </button>
              </div>

              {/* Status Filters */}
              <div className="mb-4">
                <label className="fw-bold mb-2 d-block text-dark">Order Status</label>
                <div className="d-flex flex-wrap gap-2">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-2 ${
                        status === opt.value ? "btn-dark fw-bold" : "btn-light border text-dark"
                      }`}
                      onClick={() => setStatus(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Period */}
              <div className="mb-4">
                <label className="fw-bold mb-2 d-block text-dark">Time Period</label>
                <div className="d-flex flex-wrap gap-2">
                  {periodOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-2 ${
                        period === opt.value ? "btn-dark fw-bold" : "btn-light border text-dark"
                      }`}
                      onClick={() => setPeriod(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="lux-reset-btn flex-fill"
                  onClick={() => {
                    resetFilters();
                    setShowFilterModal(false);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="lux-apply-btn flex-fill"
                  onClick={() => setShowFilterModal(false)}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default OrderHistory;
