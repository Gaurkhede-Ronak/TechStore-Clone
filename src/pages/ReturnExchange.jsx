import { scrollToPageTop } from "../components/ScrollToTop";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaBoxOpen,
  FaCheckCircle,
  FaExchangeAlt,
  FaUndo,
  FaTimesCircle,
  FaTruck,
  FaMoneyBillWave,
  FaSyncAlt,
  FaShieldAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";
import "../css/ReturnExchange.css";

import returnExchangeService from "../appwrite/returnExchangeService";
import shipmentService from "../appwrite/shipmentService";
import orderService from "../appwrite/orderService";
import authService from "../appwrite/authService";
import {
  parseOrderItems,
  isOrderItemCancelled,
  getOrderItemSellingPrice,
  getOrderItemName,
  getOrderItemImage,
  getOrderItemId,
  formatReasonWithItem,
  extractCleanReason,
  doesRequestMatchItem,
} from "../utils/orderItemHelper";

  // REASONS

const RETURN_REASONS = [
  "Product is damaged",
  "Product is defective",
  "Wrong product received",
  "Product does not match description",
  "Product is not as expected",
  "Missing item/accessory",
  "Other",
];

const EXCHANGE_REASONS = [
  "Wrong size",
  "Wrong color",
  "Product is damaged",
  "Product is defective",
  "Wrong product received",
  "Product does not match description",
  "Other",
];

  // STATUS HELPERS

const getStatusLabel = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  const labels = {
    REQUESTED: "Request Submitted",
    CONFIRMED: "Request Confirmed",
    CANCELLED: "Request Cancelled",
    PICKUP_ASSIGNED: "Delivery Boy Assigned",
    ASSIGNED: "Delivery Boy Assigned",
    PICKED_UP: "Product Picked Up",
    REFUND_INITIATED: "Refund Initiated",
    REFUND_COMPLETED: "Refund Completed",
    REFUNDED: "Refund Completed",
    EXCHANGE_COMPLETED: "Exchange Completed",
  };

  return labels[value] || value || "Processing";
};

const getStatusClass = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  if (value === "CANCELLED") {
    return "danger";
  }

  if (
    value === "REFUND_COMPLETED" ||
    value === "REFUNDED" ||
    value === "EXCHANGE_COMPLETED"
  ) {
    return "success";
  }

  if (
    value === "CONFIRMED" ||
    value === "PICKED_UP" ||
    value === "PICKUP_ASSIGNED" ||
    value === "ASSIGNED"
  ) {
    return "primary";
  }

  return "warning";
};

const getRefundStatusLabel = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  if (value === "REFUND_INITIATED" || value === "INITIATED") {
    return "Refund Initiated";
  }

  if (
    value === "REFUND_COMPLETED" ||
    value === "COMPLETED" ||
    value === "REFUNDED"
  ) {
    return "Refund Completed";
  }

  if (value === "NOT_REQUIRED") {
    return "Not Required";
  }

  if (value === "PENDING") {
    return "Refund Pending";
  }

  return value || "Pending";
};

  // COMPONENT

function ReturnExchange() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    scrollToPageTop();
  }, []);
  const { orderId } = useParams();

  const [user, setUser] = useState(null);
  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [existingRequests, setExistingRequests] = useState([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState("RETURN");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  // LOAD DATA

  const loadData = useCallback(
    async (showFullLoader = true) => {
      try {
        if (showFullLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const currentUser = await authService.getCurrentUser();

        if (!currentUser) {
          toast.error("Please login first.");
          navigate("/login");
          return;
        }

        setUser(currentUser);

        let orderData = null;

        try {
          orderData = await orderService.getOrderSmart(orderId);
        } catch {
          orderData = await orderService.getOrder(orderId);
        }

        if (!orderData) {
          throw new Error("Order not found.");
        }

        setOrder(orderData);

        const originalOrderId = orderData.orderId || orderId;

        let shipmentData = null;

        try {
          const response =
            await shipmentService.getShipmentsByOrderId(originalOrderId);

          const docs = Array.isArray(response)
            ? response
            : Array.isArray(response?.documents)
            ? response.documents
            : [];

          shipmentData = docs.length > 0 ? docs[0] : null;
        } catch (error) {
          console.error("Shipment load error:", error);
        }

        setShipment(shipmentData);

        const requests =
          await returnExchangeService.getRequestsByOrderId(originalOrderId);

        setExistingRequests(Array.isArray(requests) ? requests : []);
      } catch (error) {
        console.error("Return exchange page error:", error);
        toast.error(error?.message || "Failed to load order.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, navigate]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================================
  // ONE-TIME ONLY ACTIVE REQUEST CHECK
  // Once a user submits a Return or Exchange for this order,
  // they cannot submit another Return or Exchange for it.
  // =====================================================

  const rawOrderItems = useMemo(() => parseOrderItems(order), [order]);

  // Deliverable (non-cancelled) items with their original index in rawOrderItems
  const deliverableEntries = useMemo(() => {
    return rawOrderItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !isOrderItemCancelled(item));
  }, [rawOrderItems]);

  // Initialize selectedItemIndex from URL query params / location.state / first non-cancelled item
  useEffect(() => {
    if (rawOrderItems.length === 0) return;

    const params = new URLSearchParams(location.search);
    const paramIdx = params.get("itemIdx");
    const paramItemId = params.get("itemId");
    const stateIdx = location.state?.itemIndex;
    const stateSingle = location.state?.singleProduct;

    if (paramIdx !== null && paramIdx !== "") {
      const parsed = Number(paramIdx);
      if (
        Number.isInteger(parsed) &&
        parsed >= 0 &&
        parsed < rawOrderItems.length &&
        !isOrderItemCancelled(rawOrderItems[parsed])
      ) {
        setSelectedItemIndex(parsed);
        return;
      }
    }

    if (
      stateIdx !== undefined &&
      stateIdx !== null &&
      Number.isInteger(Number(stateIdx)) &&
      Number(stateIdx) >= 0 &&
      Number(stateIdx) < rawOrderItems.length &&
      !isOrderItemCancelled(rawOrderItems[Number(stateIdx)])
    ) {
      setSelectedItemIndex(Number(stateIdx));
      return;
    }

    const targetId = String(
      paramItemId || getOrderItemId(stateSingle) || ""
    ).trim();
    if (targetId) {
      const foundIdx = rawOrderItems.findIndex(
        (it) =>
          !isOrderItemCancelled(it) && getOrderItemId(it) === targetId
      );
      if (foundIdx >= 0) {
        setSelectedItemIndex(foundIdx);
        return;
      }
    }

    const firstActive = rawOrderItems.findIndex(
      (it) => !isOrderItemCancelled(it)
    );
    setSelectedItemIndex(firstActive >= 0 ? firstActive : 0);
  }, [rawOrderItems, location.search, location.state]);

  const effectiveItemIndex =
    selectedItemIndex >= 0 && selectedItemIndex < rawOrderItems.length
      ? selectedItemIndex
      : deliverableEntries[0]?.idx ?? 0;

  const selectedItem = rawOrderItems[effectiveItemIndex] || null;

  const activeRequest = useMemo(() => {
    if (!selectedItem && rawOrderItems.length === 0) {
      return existingRequests.find(
        (item) => String(item?.status || "").toUpperCase() !== "CANCELLED"
      );
    }
    return existingRequests.find(
      (req) =>
        String(req?.status || "").toUpperCase() !== "CANCELLED" &&
        doesRequestMatchItem(req, selectedItem, effectiveItemIndex, order)
    );
  }, [existingRequests, selectedItem, effectiveItemIndex, order, rawOrderItems.length]);

  const cancelledRequests = useMemo(() => {
    return existingRequests.filter(
      (req) =>
        String(req?.status || "").toUpperCase() === "CANCELLED" &&
        (!selectedItem ||
          doesRequestMatchItem(req, selectedItem, effectiveItemIndex, order))
    );
  }, [existingRequests, selectedItem, effectiveItemIndex, order]);

  const reasons = type === "RETURN" ? RETURN_REASONS : EXCHANGE_REASONS;
  const finalReason = reason === "Other" ? customReason.trim() : reason;

  const fullOrderAmount = Number(
    order?.totalAmount ?? order?.total ?? order?.grandTotal ?? 0
  );

  const selectedItemAmount = useMemo(() => {
    if (!selectedItem) return fullOrderAmount;
    const unitPrice = getOrderItemSellingPrice(selectedItem);
    const qty = Number(selectedItem?.quantity ?? selectedItem?.qty ?? 1) || 1;
    const itemTotal = unitPrice * qty;
    return itemTotal > 0 ? itemTotal : fullOrderAmount;
  }, [selectedItem, fullOrderAmount]);

  const orderAmount =
    rawOrderItems.length > 1 ? selectedItemAmount : fullOrderAmount || selectedItemAmount;

  const paymentMethod = String(
    order?.paymentMethod || order?.payment || order?.paymentMode || "Online Payment"
  ).trim();

  const isCOD =
    paymentMethod.toUpperCase() === "COD" ||
    paymentMethod.toUpperCase() === "CASH_ON_DELIVERY" ||
    paymentMethod.toUpperCase().includes("CASH");

  const goToOrder = () => {
    const params = new URLSearchParams();
    params.set("orderId", order?.orderId || orderId);
    params.set("itemIdx", String(effectiveItemIndex));
    if (selectedItem && getOrderItemId(selectedItem)) {
      params.set("itemId", getOrderItemId(selectedItem));
    }
    if (activeRequest?.referenceId) {
      params.set("returnId", activeRequest.referenceId);
    }
    navigate(`/order-details?${params.toString()}`, {
      state: {
        order,
        singleProduct: selectedItem,
        itemIndex: effectiveItemIndex,
        returnRequest: activeRequest || null,
      },
    });
  };

  // SUBMIT

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please login first.");
      return;
    }

    if (!order) {
      toast.error("Order information not found.");
      return;
    }

    if (!shipment?.$id) {
      toast.error("Shipment information is not available for this order.");
      return;
    }

    if (selectedItem && isOrderItemCancelled(selectedItem)) {
      toast.error("Cancelled products cannot be returned or exchanged.");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason.");
      return;
    }

    if (reason === "Other" && !customReason.trim()) {
      toast.error("Please enter your reason.");
      return;
    }

    if (activeRequest) {
      toast.error(
        "A Return or Exchange request has already been created for this product. Only one request is allowed."
      );
      return;
    }

    try {
      setSubmitting(true);

      const originalOrderId = order.orderId || orderId;
      const reasonWithItemMeta = selectedItem
        ? formatReasonWithItem(finalReason, selectedItem, effectiveItemIndex)
        : finalReason;

      const created = await returnExchangeService.createRequest({
        originalOrderId,
        shipmentId: shipment.$id,
        userId: user.$id,
        type,
        reason: reasonWithItemMeta,
        paymentMethod,
        refundAmount: type === "RETURN" ? orderAmount : 0,
      });

      // Also persist returnReferenceId & returnRequestId on the target item inside order.items
      if (order?.$id && rawOrderItems.length > 0 && selectedItem) {
        try {
          const updatedOrderItems = rawOrderItems.map((it, idx) => {
            if (idx === effectiveItemIndex) {
              return {
                ...it,
                returnRequestId: created?.$id || "",
                returnReferenceId: created?.referenceId || "",
                returnType: type,
                returnStatus: "REQUESTED",
                returnReason: finalReason,
              };
            }
            return it;
          });
          await orderService.updateOrder(order.$id, {
            items: JSON.stringify(updatedOrderItems),
          });
          setOrder((prev) =>
            prev ? { ...prev, items: updatedOrderItems } : prev
          );
        } catch (orderItemSyncErr) {
          console.warn("Order item return sync warning:", orderItemSyncErr);
        }
      }

      setExistingRequests((prev) => [created, ...prev]);

      toast.success(
        `${type === "RETURN" ? "Return ID" : "Exchange ID"} : ${
          created?.referenceId || ""
        } created successfully!`
      );

      setReason("");
      setCustomReason("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Create return/exchange error:", error);
      toast.error(error?.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  // LOADING

  if (loading) {
    return (
      <div className="rx-page-wrapper py-5 d-flex align-items-center justify-content-center">
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <h5 className="fw-bold mb-1">Loading Return / Exchange...</h5>
          <p className="rx-subtitle">Fetching your order details from Appwrite</p>
        </div>
      </div>
    );
  }

  const isActiveExchange =
    String(activeRequest?.type || "").toUpperCase() === "EXCHANGE";

  // RENDER

  return (
    <div className="rx-page-wrapper py-4 py-md-5">
      <div className="rx-container">
        {/* TOP HEADER CARD */}
        <div className="rx-card mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="rx-back-btn"
              onClick={goToOrder}
              title="Back to Order"
            >
              <FaArrowLeft size={15} />
            </button>

            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                <h1 className="rx-title">Return / Exchange</h1>
                {activeRequest && (
                  <span
                    className={`rx-badge ${
                      isActiveExchange ? "exchange" : "return"
                    }`}
                  >
                    {isActiveExchange ? (
                      <>
                        <FaExchangeAlt size={12} /> Exchanged
                      </>
                    ) : (
                      <>
                        <FaUndo size={12} /> Returned
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="rx-subtitle">
                Order ID :{" "}
                <strong className="font-monospace">
                  {order?.orderId || orderId}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rx-refresh-btn"
            onClick={() => loadData(false)}
            disabled={refreshing}
          >
            <FaSyncAlt className={refreshing ? "fa-spin" : ""} size={13} />
            {refreshing ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>

        {/* ACTIVE REQUEST STATUS */}
        {activeRequest && (
          <div className="rx-card mb-4">
            <div className="d-flex align-items-start gap-3 flex-wrap">
              <div
                className={`rx-type-icon ${
                  isActiveExchange ? "exchange" : "return"
                }`}
              >
                {String(activeRequest.status || "").toUpperCase() ===
                "CANCELLED" ? (
                  <FaTimesCircle />
                ) : String(activeRequest.status || "").toUpperCase() ===
                  "PICKED_UP" ? (
                  <FaTruck />
                ) : (
                  <FaCheckCircle />
                )}
              </div>

              <div className="flex-grow-1">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                  <div>
                    <h4 className="rx-section-title mb-1">
                      {isActiveExchange
                        ? "Exchange Request"
                        : "Return Request"}
                    </h4>
                    <div className="rx-subtitle">
                      {isActiveExchange ? "Exchange ID" : "Return ID"} :{" "}
                      <strong className="font-monospace">
                        {activeRequest.referenceId}
                      </strong>
                    </div>
                  </div>

                  <span
                    className={`rx-badge ${getStatusClass(
                      activeRequest.status
                    )}`}
                  >
                    {getStatusLabel(activeRequest.status)}
                  </span>
                </div>

                <div className="rx-info-grid">
                  <div className="rx-info-box">
                    <span className="rx-label">
                      {isActiveExchange ? "Exchange ID" : "Return ID"}
                    </span>
                    <div className="rx-value font-monospace">
                      {activeRequest.referenceId}
                    </div>
                  </div>

                  <div className="rx-info-box">
                    <span className="rx-label">Request Status</span>
                    <div className="rx-value">
                      {getStatusLabel(activeRequest.status)}
                    </div>
                  </div>

                  <div className="rx-info-box">
                    <span className="rx-label">Request Type</span>
                    <div className="rx-value">
                      {isActiveExchange ? "Exchange" : "Return"}
                    </div>
                  </div>

                  <div className="rx-info-box">
                    <span className="rx-label">Created On</span>
                    <div className="rx-value">
                      {activeRequest.createdAt || activeRequest.$createdAt
                        ? new Date(
                            activeRequest.createdAt || activeRequest.$createdAt
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>

                {activeRequest.reason && (
                  <div className="rx-info-box mt-3">
                    <span className="rx-label">Reason</span>
                    <div className="rx-value">{extractCleanReason(activeRequest.reason)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REFUND STATUS (FOR RETURN) */}
        {activeRequest && activeRequest.type === "RETURN" && (
          <div className="rx-card mb-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="rx-type-icon return">
                <FaMoneyBillWave />
              </div>
              <div>
                <h5 className="rx-section-title">Refund Status</h5>
                <p className="rx-subtitle">Your refund breakdown & status</p>
              </div>
            </div>

            <div className="rx-info-grid">
              <div className="rx-info-box">
                <span className="rx-label">Refund Status</span>
                <div className="rx-value">
                  {getRefundStatusLabel(activeRequest.refundStatus)}
                </div>
              </div>

              <div className="rx-info-box">
                <span className="rx-label">Refund Amount</span>
                <div className="rx-value">
                  ₹{Number(activeRequest.refundAmount || orderAmount || 0).toFixed(2)}
                </div>
              </div>

              <div className="rx-info-box">
                <span className="rx-label">Payment Method</span>
                <div className="rx-value">
                  {activeRequest.paymentMethod || paymentMethod || "—"}
                </div>
              </div>

              <div className="rx-info-box">
                <span className="rx-label">Order ID</span>
                <div className="rx-value font-monospace">
                  {order?.orderId || orderId}
                </div>
              </div>
            </div>

            {isCOD && (
              <div className="rx-info-box mt-3">
                <small className="rx-subtitle">
                  This order was placed using Cash on Delivery. Refund handling is managed upon pickup verification.
                </small>
              </div>
            )}
          </div>
        )}

        {/* SELECTED PRODUCT FOR RETURN / EXCHANGE */}
        {selectedItem && (
          <div className="rx-card mb-4">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h5 className="rx-section-title mb-1">
                  Product for Return / Exchange
                </h5>
                <p className="rx-subtitle mb-0">
                  {deliverableEntries.length > 1
                    ? "Select which delivered product from your order you want to return or exchange"
                    : "Selected delivered product from your order"}
                </p>
              </div>
              <span className="rx-badge primary">
                Item {effectiveItemIndex + 1} of {rawOrderItems.length}
              </span>
            </div>

            <div className="d-flex align-items-center gap-3 p-3 rounded-3 border bg-light flex-wrap">
              {getOrderItemImage(selectedItem) && (
                <img
                  src={getOrderItemImage(selectedItem)}
                  alt={getOrderItemName(selectedItem)}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                  className="border bg-white"
                />
              )}
              <div className="flex-grow-1">
                <div className="fw-bold text-dark fs-6">
                  {getOrderItemName(selectedItem)}
                </div>
                <div className="rx-subtitle">
                  Quantity: <strong>x{Number(selectedItem?.quantity ?? selectedItem?.qty ?? 1) || 1}</strong>{" "}
                  • Item Total:{" "}
                  <strong className="text-dark">
                    ₹{selectedItemAmount.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {deliverableEntries.length > 1 && (
              <div className="mt-3">
                <span className="rx-label d-block mb-2">
                  Delivered Products in this Order ({deliverableEntries.length})
                </span>
                <div className="d-flex gap-2 flex-wrap">
                  {deliverableEntries.map(({ item: delivItem, idx }) => {
                    const isSelected = idx === effectiveItemIndex;
                    const itemHasReq = existingRequests.some(
                      (req) =>
                        String(req?.status || "").toUpperCase() !== "CANCELLED" &&
                        doesRequestMatchItem(req, delivItem, idx, order)
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedItemIndex(idx)}
                        className={`btn btn-sm rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 ${
                          isSelected
                            ? "btn-dark fw-bold"
                            : "btn-outline-secondary"
                        }`}
                      >
                        <span>{getOrderItemName(delivItem)}</span>
                        {itemHasReq && (
                          <span className="badge bg-warning text-dark">
                            Requested
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ORDER SUMMARY CARD */}
        <div className="rx-card mb-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="rx-type-icon exchange">
              <FaBoxOpen />
            </div>
            <div>
              <h5 className="rx-section-title">Order Summary</h5>
              <p className="rx-subtitle font-monospace">
                {order?.orderId || orderId}
              </p>
            </div>
          </div>

          <div className="rx-info-grid">
            <div className="rx-info-box">
              <span className="rx-label">Order Status</span>
              <div className="rx-value">{order?.status || "Delivered"}</div>
            </div>

            <div className="rx-info-box">
              <span className="rx-label">Payment Method</span>
              <div className="rx-value">{paymentMethod || "—"}</div>
            </div>

            <div className="rx-info-box">
              <span className="rx-label">Order Amount</span>
              <div className="rx-value">₹{orderAmount.toFixed(2)}</div>
            </div>

            <div className="rx-info-box">
              <span className="rx-label">Shipment</span>
              <div className="rx-value">
                {shipment ? "Verified" : "Not Available"}
              </div>
            </div>
          </div>
        </div>

        {/* CANCELLED REQUEST HISTORY */}
        {cancelledRequests.length > 0 && (
          <div className="rx-card mb-4">
            <h6 className="rx-section-title mb-3">Previous Requests</h6>
            {cancelledRequests.map((request) => (
              <div
                key={request.$id}
                className="rx-info-box mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2"
              >
                <div>
                  <div className="rx-value">
                    {request.type === "RETURN" ? "Return" : "Exchange"}
                  </div>
                  <small className="rx-subtitle font-monospace">
                    {request.referenceId}
                  </small>
                </div>
                <span className="rx-badge danger">Cancelled</span>
              </div>
            ))}
          </div>
        )}

        {/* NEW REQUEST FORM (SHOWN ONLY IF NO ACTIVE REQUEST) */}
        {!activeRequest ? (
          <form onSubmit={handleSubmit}>
            {/* TYPE SELECTION */}
            <div className="rx-card mb-4">
              <h5 className="rx-section-title mb-3">
                What would you like to do?
              </h5>

              <div className="rx-type-grid">
                <button
                  type="button"
                  className={`rx-type-option ${
                    type === "RETURN" ? "active-return" : ""
                  }`}
                  onClick={() => {
                    setType("RETURN");
                    setReason("");
                    setCustomReason("");
                  }}
                >
                  <div className="rx-type-icon return">
                    <FaUndo />
                  </div>
                  <div>
                    <div className="rx-type-title">Return Product</div>
                    <p className="rx-type-desc">
                      Return the product and get a refund (creates Return ID{" "}
                      <span className="font-monospace fw-bold">RE-...</span>)
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  className={`rx-type-option ${
                    type === "EXCHANGE" ? "active-exchange" : ""
                  }`}
                  onClick={() => {
                    setType("EXCHANGE");
                    setReason("");
                    setCustomReason("");
                  }}
                >
                  <div className="rx-type-icon exchange">
                    <FaExchangeAlt />
                  </div>
                  <div>
                    <div className="rx-type-title">Exchange Product</div>
                    <p className="rx-type-desc">
                      Exchange for a replacement item (creates Exchange ID{" "}
                      <span className="font-monospace fw-bold">EX-...</span>)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* REASON SELECTION */}
            <div className="rx-card mb-4">
              <h5 className="rx-section-title mb-3">
                Why do you want to{" "}
                {type === "RETURN" ? "return" : "exchange"} this product?
              </h5>

              <div className="mb-3">
                <label className="rx-label mb-2">Select a Reason</label>
                <select
                  className="rx-select"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value !== "Other") {
                      setCustomReason("");
                    }
                  }}
                >
                  <option value="">Choose a reason...</option>
                  {reasons.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {reason === "Other" && (
                <div className="mt-3">
                  <label className="rx-label mb-2">Additional Details</label>
                  <textarea
                    className="rx-textarea"
                    rows="4"
                    maxLength="255"
                    placeholder="Please describe the issue with your product..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                  <div className="text-end mt-1">
                    <small className="rx-subtitle">
                      {customReason.length}/255
                    </small>
                  </div>
                </div>
              )}
            </div>

            {/* REFUND PREVIEW */}
            {type === "RETURN" && (
              <div className="rx-card mb-4">
                <h5 className="rx-section-title mb-3">Refund Information</h5>
                <div className="rx-info-box">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="rx-subtitle fw-semibold">
                      Estimated Refund Amount
                    </span>
                    <strong className="rx-value fs-4">
                      ₹{orderAmount.toFixed(2)}
                    </strong>
                  </div>
                  <small className="rx-subtitle d-block">
                    {isCOD
                      ? "This order was placed via Cash on Delivery. Refund details will update once pickup is verified."
                      : "Refund will be credited to your original payment source / wallet after pickup verification."}
                  </small>
                </div>
              </div>
            )}

            {/* SUBMIT CARD */}
            <div className="rx-card">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <FaShieldAlt className="text-primary flex-shrink-0" size={18} />
                  <div>
                    <div className="rx-value">One-Time Request Policy</div>
                    <small className="rx-subtitle">
                      A product can only be returned or exchanged once.
                    </small>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`rx-submit-btn ${
                    type === "RETURN" ? "return" : "exchange"
                  }`}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {type === "RETURN" ? <FaUndo /> : <FaExchangeAlt />}
                      Submit {type === "RETURN" ? "Return" : "Exchange"} Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* REQUEST LOCKED / COMPLETED BANNER */
          <div className="rx-card text-center py-5">
            <div
              className={`rx-type-icon ${
                isActiveExchange ? "exchange" : "return"
              } mx-auto mb-3`}
              style={{ width: 68, height: 68, fontSize: 28, borderRadius: "50%" }}
            >
              <FaCheckCircle />
            </div>

            <h4 className="rx-title fs-4 mb-2">
              {isActiveExchange
                ? "Exchange Request Already Submitted"
                : "Return Request Already Submitted"}
            </h4>

            <p className="rx-subtitle mb-4" style={{ maxWidth: 480, margin: "0 auto" }}>
              Your {isActiveExchange ? "exchange" : "return"} request (
              <strong className="font-monospace">
                {activeRequest.referenceId}
              </strong>
              ) has been registered. Each order is eligible for a one-time return
              or exchange only.
            </p>

            <div className="d-flex justify-content-center gap-3 flex-wrap">
              <button
                type="button"
                className={`rx-submit-btn ${
                  isActiveExchange ? "exchange" : "return"
                }`}
                onClick={goToOrder}
              >
                <FaArrowLeft />
                View in Order Details
              </button>

              <button
                type="button"
                className="rx-refresh-btn px-4"
                onClick={() => navigate("/orders")}
              >
                Go to My Orders
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReturnExchange;
