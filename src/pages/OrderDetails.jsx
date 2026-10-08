import { scrollToPageTop } from "../components/ScrollToTop";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import client from "../appwrite/config";
import orderService from "../appwrite/orderService";
import shipmentHelper from "../appwrite/shipmentHelper";
import reviewService from "../appwrite/reviewService";
import authService from "../appwrite/authService";
import shipmentService from "../appwrite/shipmentService";
import shipmentEventService from "../appwrite/shipmentEventService";
import warehouseService from "../appwrite/warehouseService";
import deliveryOtpService from "../appwrite/deliveryOtpService";
import returnExchangeService from "../appwrite/returnExchangeService";
import walletService from "../appwrite/walletService";
import {
  doesRequestMatchItem,
  extractCleanReason,
} from "../utils/orderItemHelper";

import {
  FaArrowLeft,
  FaFileInvoice,
  FaShareAlt,
  FaStar,
  FaExchangeAlt,
  FaSpinner,
  FaMapMarkerAlt,
  FaTimes,
  FaCheckCircle,
  FaRoute,
  FaCheck,
  FaCreditCard,
  FaUndoAlt,
  FaWallet,
  FaMoneyBillWave,
  FaMobileAlt,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCopy,
  FaLock,
} from "react-icons/fa";

import toast from "react-hot-toast";
import "../css/OrderDetails.css";

/* STATUS */

const STATUS_MAP = {
  PLACED: "Confirmed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  REACHED_HUB: "Reached Hub",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  EXCEPTION: "Delivery Unsuccessful",
  DELIVERY_UNSUCCESSFUL: "Delivery Unsuccessful",
  UNDELIVERED: "Delivery Unsuccessful",
  FAILED: "Delivery Unsuccessful",
};

const COURIER_BRANDS = [
  {
    name: "FastNexTech",
    prefix: "FNT",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    darkBg: "rgba(234, 88, 12, 0.16)",
    darkColor: "#fb923c",
    darkBorder: "rgba(251, 146, 60, 0.35)",
  },
  {
    name: "DeTechLiv",
    prefix: "DTL",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    darkBg: "rgba(220, 38, 38, 0.16)",
    darkColor: "#f87171",
    darkBorder: "rgba(248, 113, 113, 0.35)",
  },
  {
    name: "TechFonish",
    prefix: "TFN",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    darkBg: "rgba(37, 99, 235, 0.16)",
    darkColor: "#60a5fa",
    darkBorder: "rgba(96, 165, 250, 0.35)",
  },
  {
    name: "Technoe",
    prefix: "TNE",
    color: "#0d9488",
    bg: "#f0fdfa",
    border: "#99f6e4",
    darkBg: "rgba(13, 148, 136, 0.16)",
    darkColor: "#2dd4bf",
    darkBorder: "rgba(45, 212, 191, 0.35)",
  },
];

const resolveOrderCourierBrand = (shipment, order) => {
  const rawName = String(
    shipment?.courierName || order?.courierName || ""
  ).trim();
  if (rawName) {
    const matchedByName = COURIER_BRANDS.find(
      (b) => b.name.toLowerCase() === rawName.toLowerCase()
    );
    if (matchedByName) return matchedByName;
  }

  const trackingId = String(
    shipment?.trackingId || order?.trackingId || ""
  )
    .trim()
    .toUpperCase();
  if (trackingId) {
    const matchedByPrefix = COURIER_BRANDS.find((b) =>
      trackingId.startsWith(b.prefix)
    );
    if (matchedByPrefix) return matchedByPrefix;
  }

  const seedStr =
    trackingId ||
    String(order?.orderId || order?.$id || "TECHSTORE");
  let hash = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return COURIER_BRANDS[hash % COURIER_BRANDS.length];
};

const normalizeStatus = (value) => {
  if (!value) return "";

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
};

const safeString = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).trim();

const getOrderReference = (order) =>
  safeString(order?.orderId) ||
  safeString(order?.$id) ||
  safeString(order?.id);

const getShipmentOrderReference = (shipment) =>
  safeString(shipment?.orderId) ||
  safeString(shipment?.orderID);


// eslint-disable-next-line no-unused-vars
const eventStepMapFallback = (status) => {
  const map = {
    PLACED: 0,
    PACKED: 1,
    DISPATCHED: 2,
    IN_TRANSIT: 3,
    REACHED_HUB: 4,
    OUT_FOR_DELIVERY: 5,
    DELIVERED: 6,
  };

  return map[normalizeStatus(status)] ?? 0;
};

const getDate = (value) => {
  if (!value) return new Date();

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? new Date()
    : date;
};

const formatDate = (value) =>
  getDate(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatFullDayDate = (value) => {
  const d = getDate(value);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
  const day = d.toLocaleDateString("en-IN", { day: "2-digit" });
  const month = d.toLocaleDateString("en-IN", { month: "long" });
  return `${weekday}, ${day} ${month}`;
};

const addDaysToDate = (value, days) => {
  const d = new Date(getDate(value).getTime());
  d.setDate(d.getDate() + days);
  return d;
};

const formatTime = (value) =>
  getDate(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* COMPONENT */

function OrderDetails() {
  const navigate = useNavigate();
  useEffect(() => {
    scrollToPageTop();
  }, []);
  const location = useLocation();

  /* ORDER */

  const [order, setOrder] = useState(
    location.state?.order || null
  );

  const [orderLoading, setOrderLoading] = useState(
    !location.state?.order
  );

  const [orderError, setOrderError] = useState("");

  /* USER */

  const [currentUser, setCurrentUser] = useState(null);

  /* SHIPMENT */

  const [shipment, setShipment] = useState(null);
   
  const [shipmentEvents, setShipmentEvents] = useState([]);
   
  // eslint-disable-next-line no-unused-vars
  const [originWarehouse, setOriginWarehouse] =
    useState(null);

  const [shipmentLoading, setShipmentLoading] =
    useState(true);

  // eslint-disable-next-line no-unused-vars
  const [trackingLoading, setTrackingLoading] =
    useState(false);

   
  // eslint-disable-next-line no-unused-vars
  const [trackingError, setTrackingError] =
    useState("");

  /* RETURN / EXCHANGE */

  const [returnRequests, setReturnRequests] =
    useState([]);

  // eslint-disable-next-line no-unused-vars
  const [returnRequestLoading, setReturnRequestLoading] =
    useState(false);

  /* CANCEL & TIMELINE ANIMATION STATES */

  const [cancelPhase, setCancelPhase] =
    useState("none");
  const [cancelStepAnim, setCancelStepAnim] =
    useState(0);
  const [cancelReturnPhase, setCancelReturnPhase] =
    useState("none");
  const [rxCancelStepAnim, setRxCancelStepAnim] =
    useState(0);
  const [orderAnimIndex, setOrderAnimIndex] =
    useState(0);
  const [rxAnimIndex, setRxAnimIndex] =
    useState(0);

  /* DELIVERY OTP */

  const [deliveryOtp, setDeliveryOtp] =
    useState("");

  // eslint-disable-next-line no-unused-vars
  const [showOtp, setShowOtp] =
    useState(false);

  // eslint-disable-next-line no-unused-vars
  const [otpLoading, setOtpLoading] =
    useState(false);

  const [otpExpiresAt, setOtpExpiresAt] =
    useState(null);

  // eslint-disable-next-line no-unused-vars
  const [otpTimeLeft, setOtpTimeLeft] =
    useState(0);

  /* REVIEW */

  const [reviewModalOpen, setReviewModalOpen] =
    useState(false);

  const [reviewProduct, setReviewProduct] =
    useState(null);

  const [reviewRating, setReviewRating] =
    useState(5);

  const [reviewText, setReviewText] =
    useState("");

  const [reviewSubmitting, setReviewSubmitting] =
    useState(false);

  const [reviewSubmitted, setReviewSubmitted] =
    useState(false);

  const [existingProductReview, setExistingProductReview] =
    useState(null);

  const [isEditingReview, setIsEditingReview] =
    useState(false);

  const [cancelReturnLoading, setCancelReturnLoading] =
    useState(false);

  /* LOAD ORDER */

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      try {
        const stateOrder =
          location.state?.order;

        const stateOrderReference =
          stateOrder?.orderId ||
          stateOrder?.$id ||
          stateOrder?.id;

        if (
          stateOrder &&
          Object.keys(stateOrder).length > 0
        ) {
          setOrder(stateOrder);
          setOrderLoading(false);

          /*
            IMPORTANT:
            Always refresh from Appwrite.
            getOrderSmart handles ORD... custom IDs.
          */
          if (stateOrderReference) {
            try {
              const freshOrder =
                await orderService.getOrderSmart(
                  String(stateOrderReference)
                );

              if (
                !cancelled &&
                freshOrder
              ) {
                setOrder(freshOrder);
              }
            } catch (error) {
              console.warn(
                "Fresh order fetch failed:",
                error
              );
            }
          }

          return;
        }

        const params =
          new URLSearchParams(
            location.search
          );

        const orderId =
          params.get("orderId");

        if (!orderId) {
          setOrderError(
            "Order ID is missing."
          );
          setOrderLoading(false);
          return;
        }

        setOrderLoading(true);
        setOrderError("");

        const orderData =
          await orderService.getOrderSmart(
            String(orderId)
          );

        if (cancelled) return;

        if (!orderData) {
          setOrderError(
            "Order not found."
          );
          return;
        }

        setOrder(orderData);
      } catch (error) {
        console.error(
          "Order Load Error:",
          error
        );

        if (!cancelled) {
          setOrderError(
            error?.message ||
              "Unable to load order details."
          );
        }
      } finally {
        if (!cancelled) {
          setOrderLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [
    location.state?.order,
    location.search,
  ]);

  /* CURRENT USER */

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const user =
          await authService.getCurrentUser();

        if (!cancelled) {
          setCurrentUser(
            user || null
          );
        }
      } catch (error) {
        console.warn(
          "Current user load failed:",
          error
        );

        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ORDER ITEMS */

  const rawOrderItems = useMemo(() => {
    const allOrderItems =
      order?.items ||
      order?.products ||
      order?.cartItems ||
      [];

    if (Array.isArray(allOrderItems)) {
      return allOrderItems;
    }

    if (
      typeof allOrderItems ===
      "string"
    ) {
      try {
        const parsed =
          JSON.parse(
            allOrderItems
          );

        return Array.isArray(parsed)
          ? parsed
          : parsed
          ? [parsed]
          : [];
      } catch {
        return [];
      }
    }

    if (
      allOrderItems &&
      typeof allOrderItems ===
        "object"
    ) {
      return [allOrderItems];
    }

    return [];
  }, [order]);

  const [selectedProductOverride, setSelectedProductOverride] = useState(null);

  useEffect(() => {
    setSelectedProductOverride(null);
  }, [location.search]);

  const { activeProduct, activeProductIndex } = useMemo(() => {
    if (selectedProductOverride && rawOrderItems.length > 0) {
      const overrideId = String(
        selectedProductOverride?.productId ||
          selectedProductOverride?.id ||
          selectedProductOverride?.$id ||
          ""
      ).trim();
      const overrideTitle = String(
        selectedProductOverride?.title || selectedProductOverride?.name || ""
      ).trim();
      const overrideIdx = rawOrderItems.findIndex(
        (it) =>
          it === selectedProductOverride ||
          (overrideId &&
            String(it?.productId || it?.id || it?.$id || "").trim() ===
              overrideId) ||
          (overrideTitle &&
            String(it?.title || it?.name || "").trim() === overrideTitle)
      );
      return {
        activeProduct:
          overrideIdx >= 0 ? rawOrderItems[overrideIdx] : selectedProductOverride,
        activeProductIndex: overrideIdx >= 0 ? overrideIdx : 0,
      };
    }
    const params = new URLSearchParams(location.search);
    const paramIdx = params.get("itemIdx");
    const paramItemId = params.get("itemId");
    const stateIdx = location.state?.itemIndex;
    const stateSingle = location.state?.singleProduct || order?.singleProduct;

    if (rawOrderItems.length > 0) {
      // 1. Try explicit index from URL or location.state
      const parsedIdx =
        paramIdx !== null && paramIdx !== ""
          ? Number(paramIdx)
          : stateIdx !== undefined && stateIdx !== null
          ? Number(stateIdx)
          : -1;

      if (
        Number.isInteger(parsedIdx) &&
        parsedIdx >= 0 &&
        parsedIdx < rawOrderItems.length
      ) {
        return {
          activeProduct: rawOrderItems[parsedIdx],
          activeProductIndex: parsedIdx,
        };
      }

      // 2. Try matching by product ID / title from stateSingle or paramItemId
      const targetId = String(
        paramItemId ||
          stateSingle?.productId ||
          stateSingle?.id ||
          stateSingle?.$id ||
          ""
      ).trim();
      const targetTitle = String(
        stateSingle?.title || stateSingle?.name || ""
      ).trim();

      if (targetId || targetTitle) {
        const foundIdx = rawOrderItems.findIndex((it) => {
          const itId = String(it?.productId || it?.id || it?.$id || "").trim();
          const itTitle = String(it?.title || it?.name || "").trim();
          if (targetId && itId && targetId === itId) return true;
          if (targetTitle && itTitle && targetTitle === itTitle) return true;
          return false;
        });

        if (foundIdx >= 0) {
          return {
            activeProduct: rawOrderItems[foundIdx],
            activeProductIndex: foundIdx,
          };
        }
      }

      return {
        activeProduct: stateSingle || rawOrderItems[0] || {},
        activeProductIndex: 0,
      };
    }

    return {
      activeProduct: stateSingle || {},
      activeProductIndex: 0,
    };
  }, [selectedProductOverride, location.search, location.state, order?.singleProduct, rawOrderItems]);

  const otherProducts =
    rawOrderItems.filter(
      (item) =>
        item !== activeProduct &&
        JSON.stringify(item) !==
          JSON.stringify(
            activeProduct
          )
    );

  /* LOAD SHIPMENT */

  const loadShipmentFromAppwrite =
    useCallback(
      async (showLoader = true) => {
        const orderReference =
          getOrderReference(order);

        if (!orderReference) {
          setShipment(null);
          setShipmentEvents([]);
          setOriginWarehouse(null);
          setShipmentLoading(false);

          setTrackingError(
            "Order ID is not available for shipment tracking."
          );

          return null;
        }

        try {
          if (showLoader) {
            setShipmentLoading(true);
          }

          setTrackingError("");

          const shipments =
            await shipmentService.getShipmentsByOrderId(
              String(orderReference)
            );

          const list = Array.isArray(
            shipments
          )
            ? shipments
            : shipments?.documents ||
              [];

          const validShipments =
            list.filter(Boolean);

          const exactShipments =
            validShipments.filter(
              (item) =>
                getShipmentOrderReference(
                  item
                ) ===
                String(
                  orderReference
                )
            );

          const sortedShipments = [
            ...(exactShipments.length
              ? exactShipments
              : validShipments),
          ].sort((a, b) => {
            const aTime =
              new Date(
                a?.$createdAt ||
                  a?.createdAt ||
                  0
              ).getTime();

            const bTime =
              new Date(
                b?.$createdAt ||
                  b?.createdAt ||
                  0
              ).getTime();

            return bTime - aTime;
          });

          const foundShipment =
            sortedShipments[0] ||
            null;

          if (!foundShipment) {
            setShipment(null);
            setShipmentEvents([]);
            setOriginWarehouse(null);

            setTrackingError(
              "Shipment tracking is not available for this order yet."
            );

            return null;
          }

          const normalizedShipment = {
            ...foundShipment,
            status:
              normalizeStatus(
                foundShipment.status
              ),
          };

          setShipment(
            normalizedShipment
          );

          const [
            events,
            warehouse,
          ] = await Promise.all([
            normalizedShipment.$id
              ? shipmentEventService
                  .getShipmentEvents(
                    normalizedShipment.$id
                  )
                  .catch((error) => {
                    console.warn(
                      "Shipment events failed:",
                      error
                    );
                    return [];
                  })
              : Promise.resolve([]),

            normalizedShipment.originWarehouseId
              ? warehouseService
                  .getWarehouse(
                    normalizedShipment.originWarehouseId
                  )
                  .catch((error) => {
                    console.warn(
                      "Warehouse load failed:",
                      error
                    );
                    return null;
                  })
              : Promise.resolve(null),
          ]);

          const sortedEvents =
            Array.isArray(events)
              ? [...events].sort(
                  (a, b) => {
                    const aTime =
                      new Date(
                        a?.timestamp ||
                          a?.createdAt ||
                          a?.$createdAt ||
                          0
                      ).getTime();

                    const bTime =
                      new Date(
                        b?.timestamp ||
                          b?.createdAt ||
                          b?.$createdAt ||
                          0
                      ).getTime();

                    return (
                      bTime - aTime
                    );
                  }
                )
              : [];

          setShipmentEvents(
            sortedEvents
          );

          setOriginWarehouse(
            warehouse || null
          );

          return normalizedShipment;
        } catch (error) {
          console.error(
            "Appwrite Shipment Load Error:",
            error
          );

          setShipment(null);
          setShipmentEvents([]);
          setOriginWarehouse(null);

          setTrackingError(
            error?.message ||
              "Unable to load live shipment tracking."
          );

          return null;
        } finally {
          if (showLoader) {
            setShipmentLoading(false);
          }
        }
      },
      [order]
    );

  /* AUTO LOAD SHIPMENT */

  useEffect(() => {
    if (!order) return;

    loadShipmentFromAppwrite(
      true
    );
  }, [
    order,
    loadShipmentFromAppwrite,
  ]);

  /* RETURN / EXCHANGE */

  const loadReturnExchangeRequests =
    useCallback(async (showLoader = false) => {
      const orderReference =
        getOrderReference(order);

      if (!orderReference) {
        setReturnRequests([]);
        return;
      }

      try {
        if (showLoader) {
          setReturnRequestLoading(true);
        }

        const response =
          await returnExchangeService.getRequestsByOrderId(
            String(orderReference)
          );

        const list = Array.isArray(
          response
        )
          ? response
          : response?.documents ||
            [];

        setReturnRequests(
          [...list].sort(
            (a, b) => {
              const aTime =
                new Date(
                  a?.createdAt ||
                    a?.$createdAt ||
                    0
                ).getTime();

              const bTime =
                new Date(
                  b?.createdAt ||
                    b?.$createdAt ||
                    0
                ).getTime();

              return (
                bTime - aTime
              );
            }
          )
        );
      } catch (error) {
        console.warn(
          "Return/Exchange request load failed:",
          error
        );

        setReturnRequests([]);
      } finally {
        if (showLoader) {
          setReturnRequestLoading(false);
        }
      }
    }, [order]);

  useEffect(() => {
    const orderReference = getOrderReference(order);
    if (!orderReference) return;

    loadReturnExchangeRequests(true);

    const silentRefreshAll = async () => {
      try {
        await Promise.allSettled([
          loadShipmentFromAppwrite(false),
          loadReturnExchangeRequests(false),
          orderService
            .getOrderSmart(String(orderReference))
            .then((freshOrder) => {
              if (freshOrder) {
                setOrder((prev) => {
                  if (!prev) return freshOrder;
                  const prevSig = JSON.stringify({
                    s: prev.status,
                    ps: prev.paymentStatus,
                    u: prev.$updatedAt,
                    it: prev.items,
                  });
                  const nextSig = JSON.stringify({
                    s: freshOrder.status,
                    ps: freshOrder.paymentStatus,
                    u: freshOrder.$updatedAt,
                    it: freshOrder.items,
                  });
                  return prevSig === nextSig ? prev : freshOrder;
                });
              }
            })
            .catch(() => {}),
        ]);
      } catch {
        // Ignore background refresh errors
      }
    };

    const pollTimer = setInterval(silentRefreshAll, 3000);

    let unsubscribe = null;
    try {
      unsubscribe = client.subscribe(["documents"], (event) => {
        const payload = event?.payload;
        if (!payload) return;
        const payloadOrderRef = String(
          payload.orderId || payload.orderID || payload.$id || ""
        ).trim();
        if (
          !payloadOrderRef ||
          payloadOrderRef === String(orderReference) ||
          payload.shipmentId
        ) {
          silentRefreshAll();
        }
      });
    } catch {
      // Realtime optional fallback
    }

    return () => {
      clearInterval(pollTimer);
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [
    order,
    loadShipmentFromAppwrite,
    loadReturnExchangeRequests,
  ]);

  const selectedReturnIdParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const paramReturnId = params.get("returnId");
    if (paramReturnId) {
      return String(paramReturnId).trim();
    }
    if (location.state?.viewMode === "ORDER") {
      return "";
    }
    return String(
      location.state?.returnRequest?.referenceId ||
        location.state?.returnRequest?.$id ||
        ""
    ).trim();
  }, [location.search, location.state]);

  const focusedReturnRequest = useMemo(() => {
    // STRICT VIEW SEPARATION:
    // If the user clicked on the Delivered / Order card (no returnId), always return null
    // so only the Delivered Order Details page opens.
    // Only open Return / Exchange details when a specific returnId was clicked.
    if (!selectedReturnIdParam) {
      return null;
    }

    const matched = returnRequests.find(
      (r) =>
        String(r?.referenceId || "") === String(selectedReturnIdParam) ||
        String(r?.$id || "") === String(selectedReturnIdParam)
    );
    if (matched) {
      return matched;
    }

    if (
      location.state?.returnRequest &&
      (String(location.state.returnRequest?.referenceId || "") ===
        String(selectedReturnIdParam) ||
        String(location.state.returnRequest?.$id || "") ===
          String(selectedReturnIdParam))
    ) {
      return location.state.returnRequest;
    }

    return null;
  }, [selectedReturnIdParam, returnRequests, location.state]);

  const isFocusedExchange =
    String(focusedReturnRequest?.type || "").toUpperCase() === "EXCHANGE";
  const isFocusedReturn =
    String(focusedReturnRequest?.type || "").toUpperCase() === "RETURN";
  const isCancellingReturnNow =
    cancelReturnPhase === "submitting" ||
    cancelReturnPhase === "cancelling";
  const isFocusedReqCancelled =
    String(focusedReturnRequest?.status || "").toUpperCase() === "CANCELLED" ||
    cancelReturnPhase === "cancelled";



  /* STATUS */

  const shipmentStatus =
    normalizeStatus(
      shipment?.status
    );

  const orderDatabaseStatus =
    normalizeStatus(
      order?.status
    );

  const isItemCancelled =
    Boolean(activeProduct?.isCancelled) ||
    normalizeStatus(activeProduct?.status) === "CANCELLED";

  const isCancellingNow =
    cancelPhase === "submitting" ||
    cancelPhase === "cancelling";

  const isCancelled =
    isItemCancelled ||
    orderDatabaseStatus === "CANCELLED" ||
    shipmentStatus === "CANCELLED" ||
    cancelPhase === "cancelled";

  /*
    IMPORTANT:
    If the order or selected item is cancelled, CANCELLED status takes priority.
    Otherwise Shipment status wins over database status.
  */
  const currentStatus = isCancelled
    ? "CANCELLED"
    : shipmentStatus ||
      orderDatabaseStatus ||
      "PLACED";

  const [showFeeInfo, setShowFeeInfo] = useState(false);

  const orderStatus =
    STATUS_MAP[
      currentStatus
    ] ||
    currentStatus ||
    "Confirmed";

  const isDelivered =
    !isCancelled &&
    !isCancellingNow &&
    currentStatus === "DELIVERED";

  const isDeliveryUnsuccessful =
    !isCancelled &&
    !isCancellingNow &&
    [
      "EXCEPTION",
      "DELIVERY_UNSUCCESSFUL",
      "UNDELIVERED",
      "FAILED",
      "RTO",
    ].includes(currentStatus);

  const isOutForDelivery =
    !isCancelled &&
    !isCancellingNow &&
    currentStatus === "OUT_FOR_DELIVERY";

  const isDispatchedStage =
    !isCancelled &&
    !isCancellingNow &&
    [
      "DISPATCHED",
      "IN_TRANSIT",
      "REACHED_HUB",
      "OUT_FOR_DELIVERY",
    ].includes(currentStatus);

  /* Animated step-by-step progression (Confirmed -> Cancellation requested -> Cancelled) */
  useEffect(() => {
    if (isCancellingNow) return;
    if (!isCancelled) {
      setCancelStepAnim(0);
      return;
    }
    if (cancelPhase === "cancelled") {
      setCancelStepAnim(3);
      return;
    }
    setCancelStepAnim(1);
    const t1 = setTimeout(() => {
      setCancelStepAnim(2);
    }, 480);
    const t2 = setTimeout(() => {
      setCancelStepAnim(3);
    }, 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isCancelled, isCancellingNow, cancelPhase, activeProductIndex]);

  /* Animated step-by-step progression for Return / Exchange cancellation */
  useEffect(() => {
    if (isCancellingReturnNow) return;
    if (!isFocusedReqCancelled) {
      setRxCancelStepAnim(0);
      setCancelReturnPhase("none");
      return;
    }
    if (cancelReturnPhase === "cancelled") {
      setRxCancelStepAnim(3);
      return;
    }
    setRxCancelStepAnim(1);
    const t1 = setTimeout(() => {
      setRxCancelStepAnim(2);
    }, 480);
    const t2 = setTimeout(() => {
      setRxCancelStepAnim(3);
    }, 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    isFocusedReqCancelled,
    isCancellingReturnNow,
    cancelReturnPhase,
    focusedReturnRequest?.$id,
    activeProductIndex,
  ]);

  const existingActiveRequest = useMemo(() => {
    return (
      returnRequests.find(
        (r) =>
          String(r?.status || "").trim().toUpperCase() !== "CANCELLED" &&
          doesRequestMatchItem(r, activeProduct, activeProductIndex, order)
      ) || null
    );
  }, [returnRequests, activeProduct, activeProductIndex, order]);

  const hasExistingReturnOrExchange = Boolean(existingActiveRequest);

  /* Cancel is available until the order is Packed */
  const canCancel =
    !isDelivered &&
    !isCancelled &&
    !isCancellingNow &&
    !isDeliveryUnsuccessful &&
    (currentStatus === "PLACED" ||
      currentStatus === "ORDER_PLACED" ||
      currentStatus === "CONFIRMED");

  /* PRODUCT HELPERS */

  const getProductId = (
    product
  ) => {
    const rawId =
      product?.productId ||
      product?.$id ||
      product?.id ||
      product?.productID ||
      "";
    if (String(rawId).trim()) {
      return String(rawId).trim();
    }
    const fallbackTitle = String(
      product?.title || product?.name || product?.productName || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return fallbackTitle || String(order?.orderId || order?.$id || "product");
  };

  const getProductName = (
    product
  ) =>
    String(
      product?.title ||
        product?.name ||
        product?.productName ||
        "Product"
    );

  const getCustomerName =
    () =>
      String(
        currentUser?.name ||
          order?.fullName ||
          order?.customerName ||
          "Customer"
      );

  const getCustomerEmail =
    () =>
      String(
        currentUser?.email ||
          order?.email ||
          order?.customerEmail ||
          ""
      );

  const originalPlacedRawDate =
    order?.orderDate ||
    order?.$createdAt;

  const originalPlacedDate =
    formatDate(originalPlacedRawDate);

  const originalPlacedTime =
    formatTime(originalPlacedRawDate);

  const cancellationTrackingEvent = useMemo(() => {
    const events = Array.isArray(shipmentEvents)
      ? [...shipmentEvents]
      : [];

    return (
      events
        .filter(
          (event) =>
            normalizeStatus(event?.status) === "CANCELLED"
        )
        .sort((a, b) => {
          const aTime = new Date(
            a?.timestamp || a?.createdAt || a?.$createdAt || 0
          ).getTime();
          const bTime = new Date(
            b?.timestamp || b?.createdAt || b?.$createdAt || 0
          ).getTime();
          return bTime - aTime;
        })[0] || null
    );
  }, [shipmentEvents]);

  const cancelledRawDate =
    activeProduct?.cancelledDate ||
    order?.cancelledDate ||
    cancellationTrackingEvent?.timestamp ||
    cancellationTrackingEvent?.createdAt ||
    cancellationTrackingEvent?.$createdAt ||
    order?.$updatedAt ||
    order?.orderDate ||
    order?.$createdAt;

  const cancelledFormattedDate =
    formatDate(cancelledRawDate);

  const cancelledFormattedTime =
    formatTime(cancelledRawDate);

  const deliveredTrackingEvent = useMemo(() => {
    const events = Array.isArray(shipmentEvents)
      ? [...shipmentEvents]
      : [];

    return (
      events
        .filter((event) =>
          ["DELIVERED", "DELIVERY_COMPLETED"].includes(
            normalizeStatus(event?.status)
          )
        )
        .sort((a, b) => {
          const aTime = new Date(
            a?.timestamp || a?.createdAt || a?.$createdAt || 0
          ).getTime();
          const bTime = new Date(
            b?.timestamp || b?.createdAt || b?.$createdAt || 0
          ).getTime();
          return bTime - aTime;
        })[0] || null
    );
  }, [shipmentEvents]);

  const deliveredRawDate =
    deliveredTrackingEvent?.timestamp ||
    deliveredTrackingEvent?.createdAt ||
    deliveredTrackingEvent?.$createdAt ||
    shipment?.deliveredAt ||
    order?.deliveredAt ||
    shipment?.$updatedAt ||
    order?.$updatedAt ||
    order?.orderDate ||
    order?.$createdAt;

  const [nowTimestampMs, setNowTimestampMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isDelivered) return;
    const timer = setInterval(() => {
      setNowTimestampMs(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, [isDelivered]);

  /* Return / Exchange button is only available for 7 days after delivery */
  const isWithinReturnWindow = useMemo(() => {
    if (!isDelivered) return false;
    if (!deliveredRawDate) return true;
    const deliveredTime = new Date(deliveredRawDate).getTime();
    if (Number.isNaN(deliveredTime) || deliveredTime <= 0) return true;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    return nowTimestampMs - deliveredTime <= SEVEN_DAYS_MS;
  }, [isDelivered, deliveredRawDate, nowTimestampMs]);

  /* PAYMENT CALCULATION */

  const subTotalVal =
    Number(
      order?.subTotal ??
        order?.subtotal ??
        order?.subTotalAmount ??
        0
    );

  const shippingVal =
    Number(order?.shipping ?? 0);

  const gstVal =
    Number(order?.gst ?? 0);

  const gstApplied =
    Boolean(order?.gstApplied);

  const platformFeeVal =
    Number(order?.platformFee ?? 9);

  const couponDiscount =
    Number(
      order?.discount ??
        order?.couponDiscount ??
        0
    );

  const itemsOriginalMrpTotal = useMemo(() => {
    if (!Array.isArray(rawOrderItems) || rawOrderItems.length === 0) {
      const p = Number(activeProduct?.price || 0);
      const q = Number(activeProduct?.quantity || 1);
      return p * q;
    }
    return rawOrderItems.reduce((acc, item) => {
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 1);
      return acc + price * qty;
    }, 0);
  }, [rawOrderItems, activeProduct]);

  const itemsSellingTotal = useMemo(() => {
    if (!Array.isArray(rawOrderItems) || rawOrderItems.length === 0) {
      const p = Number(activeProduct?.price || 0);
      const d = Number(activeProduct?.discount || 0);
      const q = Number(activeProduct?.quantity || 1);
      const selling = d > 0 ? p - (p * d) / 100 : p;
      return selling * q;
    }
    return rawOrderItems.reduce((acc, item) => {
      const price = Number(item?.price || 0);
      const disc = Number(item?.discount || 0);
      const qty = Number(item?.quantity || 1);
      const selling = disc > 0 ? price - (price * disc) / 100 : price;
      return acc + selling * qty;
    }, 0);
  }, [rawOrderItems, activeProduct]);

  const productLevelSavings = Math.max(
    0,
    itemsOriginalMrpTotal - itemsSellingTotal
  );

  const orderOriginalAmount =
    itemsOriginalMrpTotal > 0
      ? itemsOriginalMrpTotal
      : itemsSellingTotal > 0
      ? itemsSellingTotal
      : subTotalVal + (gstApplied ? 0 : gstVal);

  const totalOrderSavings =
    productLevelSavings + couponDiscount + (gstApplied ? gstVal : 0);

  const calculatedGrandTotal =
    Math.max(
      0,
      subTotalVal +
        shippingVal +
        (gstApplied ? 0 : gstVal) +
        platformFeeVal -
        couponDiscount
    );

  const storedGrandTotal =
    Number(
      order?.orderGrandTotal ??
        order?.grandTotal ??
        order?.totalAmount ??
        0
    );

  const orderGrandTotal =
    storedGrandTotal > 0
      ? storedGrandTotal
      : calculatedGrandTotal;

  const walletPaidVal =
    Math.max(
      0,
      Number(
        order?.walletPaid ??
          order?.usedWalletAmount ??
          0
      )
    );

  const rawPaymentMethod =
    String(
      order?.payment ||
        order?.paymentMethod ||
        ""
    ).toUpperCase();

  const isCOD =
    rawPaymentMethod.includes("COD") ||
    rawPaymentMethod.includes("CASH");

  const isUPI =
    rawPaymentMethod.includes("UPI") ||
    rawPaymentMethod.includes("GPAY") ||
    rawPaymentMethod.includes("PHONEPE") ||
    rawPaymentMethod.includes("PAYTM");

  const isCard =
    rawPaymentMethod.includes("CARD") ||
    rawPaymentMethod.includes("CREDIT") ||
    rawPaymentMethod.includes("DEBIT");

  const isPureCOD =
    isCOD && walletPaidVal <= 0;

  const isCodWithWallet =
    isCOD && walletPaidVal > 0;

  const storedOnlinePaid =
    Number(
      order?.onlinePaid ??
        0
    );

  const storedUpiPaid =
    Number(
      order?.upiPaid ??
        0
    );

  const storedCardPaid =
    Number(
      order?.cardPaid ??
        0
    );

  const externalPaymentAmount =
    isUPI
      ? Math.max(
          0,
          storedUpiPaid ||
            storedOnlinePaid ||
            Math.max(
              0,
              orderGrandTotal -
                walletPaidVal
            )
        )
      : isCard
      ? Math.max(
          0,
          storedCardPaid ||
            storedOnlinePaid ||
            Math.max(
              0,
              orderGrandTotal -
                walletPaidVal
            )
        )
      : 0;

  const codDueAmount =
    isCOD
      ? Math.max(
          0,
          Number(
            order?.codAmount ??
              orderGrandTotal -
                walletPaidVal
          )
        )
      : 0;

  const paymentStatus =
    String(
      order?.paymentStatus ||
        ""
    )
      .trim()
      .toUpperCase();

  const hasExplicitPaymentStatus =
    Boolean(paymentStatus);

  const paymentConfirmed =
    paymentStatus === "PAID" ||
    paymentStatus === "SUCCESS" ||
    paymentStatus === "COMPLETED" ||
    paymentStatus === "COD_PAID" ||
    paymentStatus === "CASH_PAID";

  const totalPaidVal =
    paymentConfirmed
      ? Math.min(
          orderGrandTotal,
          walletPaidVal +
            (isCOD
              ? codDueAmount
              : externalPaymentAmount)
        )
      : hasExplicitPaymentStatus
      ? walletPaidVal
      : Math.max(
          walletPaidVal,
          Number(
            order?.totalPaid ??
              (
                isCOD
                  ? walletPaidVal
                  : walletPaidVal +
                    externalPaymentAmount
              )
          )
        );

  // eslint-disable-next-line no-unused-vars
  const balanceDue =
    Math.max(
      0,
      orderGrandTotal -
        totalPaidVal
    );

  const totalPaid = totalPaidVal;

  const paymentDisplayName =
    isCOD
      ? "Cash on Delivery"
      : isUPI
      ? "BHIM UPI"
      : isCard
      ? "Debit / Credit Card"
      : rawPaymentMethod ||
        "Online Payment";

  // eslint-disable-next-line no-unused-vars
  const paymentMethodLabel =
    walletPaidVal > 0
      ? `${paymentDisplayName} + Wallet`
      : paymentDisplayName;

  // eslint-disable-next-line no-unused-vars
  const paymentStatusLabel =
    paymentConfirmed
      ? "Payment Completed"
      : isCOD
      ? "Cash due on delivery"
      : "Payment Pending";

  /* REFUND CALCULATION */

  const activeItemOriginalPrice =
    Number(
      activeProduct?.price || 0
    );

  const activeItemDiscountPercent =
    Number(
      activeProduct?.discount ||
        0
    );

  const activeItemSellingPrice =
    activeItemDiscountPercent > 0
      ? activeItemOriginalPrice -
        (
          activeItemOriginalPrice *
          activeItemDiscountPercent
        ) /
          100
      : activeItemOriginalPrice;

  const itemQty =
    Number(
      activeProduct?.quantity ||
        1
    );

  const itemTotalPrice =
    activeItemSellingPrice *
    itemQty;

  const isEntireOrderCancelled =
    normalizeStatus(order?.status) === "CANCELLED" ||
    normalizeStatus(shipment?.status) === "CANCELLED" ||
    (rawOrderItems.length > 0 &&
      rawOrderItems.every(
        (it) =>
          Boolean(it?.isCancelled) ||
          normalizeStatus(it?.status) === "CANCELLED"
      ));

  let refundToWallet = 0;
  let refundToOnline = 0;
  let actualRefundAmount = 0;

  if (!isPureCOD) {
    if (rawOrderItems.length <= 1 || isEntireOrderCancelled) {
      refundToWallet = walletPaidVal > 0 ? walletPaidVal : 0;
      refundToOnline = isCOD
        ? 0
        : Math.max(
            0,
            totalPaid - walletPaidVal - platformFeeVal
          );
    } else {
      refundToWallet =
        walletPaidVal > 0
          ? Math.min(walletPaidVal, itemTotalPrice)
          : 0;
      refundToOnline = isCOD
        ? 0
        : Math.max(0, itemTotalPrice - refundToWallet);
    }

    actualRefundAmount = refundToWallet + refundToOnline;
  }

  /* APPWRITE TRACKING MILESTONES — Built in the exact Shipment Progress UI style (Image 2) */

  const courierBrand = useMemo(
    () => resolveOrderCourierBrand(shipment, order),
    [shipment, order]
  );

  const showCourierInHeader = [
    "DISPATCHED",
    "IN_TRANSIT",
    "REACHED_HUB",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "EXCEPTION",
    "DELIVERY_UNSUCCESSFUL",
    "UNDELIVERED",
    "FAILED",
    "RTO",
  ].includes(currentStatus);

  const trackingMilestones = useMemo(() => {
    const isUnsuccessful = [
      "EXCEPTION",
      "DELIVERY_UNSUCCESSFUL",
      "UNDELIVERED",
      "FAILED",
      "RTO",
    ].includes(normalizeStatus(currentStatus));

    const current = normalizeStatus(currentStatus);

    const milestones = [
      {
        key: "PLACED",
        label: "Confirmed",
        aliases: ["PLACED", "ORDER_PLACED", "CONFIRMED"],
        description:
          "Your order has been placed successfully and shipment processing has started.",
      },
      {
        key: "PACKED",
        label: "Packed",
        aliases: ["PACKED", "ORDER_PACKED"],
        description: "Your order has been packed and is ready for dispatch.",
      },
      {
        key: "DISPATCHED",
        label:
          current === "REACHED_HUB"
            ? "Dispatched • Reached Hub"
            : current === "IN_TRANSIT"
            ? "Dispatched • In Transit"
            : "Dispatched",
        aliases: ["DISPATCHED", "IN_TRANSIT", "REACHED_HUB"],
        description: "Your shipment has been dispatched and is in transit.",
      },
      {
        key: "OUT_FOR_DELIVERY",
        label: "Out for Delivery",
        aliases: ["OUT_FOR_DELIVERY"],
        description: "Your shipment is out for doorstep delivery.",
      },
      isUnsuccessful
        ? {
            key: "DELIVERY_UNSUCCESSFUL",
            label: "Delivery Unsuccessful",
            aliases: [
              "EXCEPTION",
              "DELIVERY_UNSUCCESSFUL",
              "UNDELIVERED",
              "FAILED",
              "RTO",
            ],
            description:
              "We tried to deliver this product to you multiple times, but were unsuccessful.",
            isUnsuccessful: true,
          }
        : {
            key: "DELIVERED",
            label: "Delivered",
            aliases: ["DELIVERED", "DELIVERY_COMPLETED"],
            description: "",
          },
    ];

    const events = Array.isArray(shipmentEvents)
      ? shipmentEvents.filter(
          (ev) =>
            !String(ev?.description || "").startsWith("DELIVERY_BOY_ASSIGNED:") &&
            !String(ev?.title || "").toLowerCase().startsWith("assigned to ")
        )
      : [];

    const getEventDate = (event) =>
      event?.timestamp ||
      event?.createdAt ||
      event?.$createdAt ||
      "";

    const getEventTime = (event) => {
      const value = getEventDate(event);
      const time = value ? new Date(value).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    };

    const currentStageIndex =
      current === "DELIVERED" || isUnsuccessful
        ? 4
        : current === "OUT_FOR_DELIVERY"
        ? 3
        : ["DISPATCHED", "IN_TRANSIT", "REACHED_HUB"].includes(current)
        ? 2
        : current === "PACKED"
        ? 1
        : current === "PLACED" || current === "CONFIRMED"
        ? 0
        : 0;

    return milestones.map((milestone, index) => {
      const matchingEvents = events
        .filter((event) =>
          milestone.aliases.includes(
            normalizeStatus(event?.status)
          )
        )
        .sort((a, b) => getEventTime(b) - getEventTime(a));

      const latestEvent = matchingEvents[0] || null;

      const eventDate = getEventDate(latestEvent);

      const fallbackDate =
        milestone.key === "PLACED"
          ? order?.orderDate || order?.$createdAt || ""
          : milestone.isUnsuccessful
          ? shipment?.$updatedAt || order?.$updatedAt || order?.orderDate || ""
          : "";

      const isCompleted =
        currentStageIndex >= index && current !== "CANCELLED";

      const date = isCompleted ? eventDate || fallbackDate : "";

      const isCurrent =
        currentStageIndex === index &&
        current !== "CANCELLED" &&
        current !== "DELIVERED" &&
        !isUnsuccessful;

      let description = "";

      if (milestone.key === "DELIVERED") {
        // Never show extra text below Delivered
        description = "";
      } else if (isCompleted) {
        description = latestEvent?.description || milestone.description;

        if (milestone.key === "DISPATCHED") {
          if (current === "REACHED_HUB") {
            description =
              latestEvent?.description ||
              "Your shipment has reached the destination sorting hub.";
          } else if (current === "IN_TRANSIT") {
            description =
              latestEvent?.description ||
              "Your shipment is currently in transit.";
          } else if (latestEvent?.description) {
            description = latestEvent.description;
          }
        }

        if (milestone.key === "OUT_FOR_DELIVERY") {
          description = "Your shipment is out for doorstep delivery.";
        }
      }

      return {
        ...milestone,
        event: latestEvent,
        date,
        description,
        isCompleted,
        isCurrent,
      };
    });
  }, [
    shipmentEvents,
    currentStatus,
    order?.orderDate,
    order?.$createdAt,
    order?.$updatedAt,
    shipment?.$updatedAt,
  ]);

  /* Build Return / Exchange steps in the EXACT Shipment Progress UI style */
  const buildReturnExchangeSteps = useCallback(
    (req) => {
      if (!req) return [];

      const requestStatus = String(req?.status || "REQUESTED")
        .trim()
        .toUpperCase();
      const paymentRefund = req?.paymentRefund || {};
      const refundStatus = String(
        req?.refundStatus || paymentRefund?.refundStatus || ""
      ).toUpperCase();
      const refundAmount = Number(
        req?.refundAmount ??
          paymentRefund?.refundAmount ??
          actualRefundAmount ??
          0
      );
      const isReturn = String(req?.type || "").toUpperCase() === "RETURN";
      const cleanReason = extractCleanReason(req?.reason || "");

      const reqRawDate =
        req?.createdAt ||
        req?.$createdAt ||
        order?.orderDate ||
        order?.$createdAt;
      const reqUpdatedRawDate =
        req?.updatedAt || req?.$updatedAt || reqRawDate;
      const expectedCompleteDate =
        requestStatus === "REFUNDED" ||
        requestStatus === "REFUND_COMPLETED" ||
        requestStatus === "EXCHANGE_COMPLETED" ||
        requestStatus === "EXCHANGED" ||
        requestStatus === "COMPLETED" ||
        refundStatus === "COMPLETED"
          ? reqUpdatedRawDate
          : addDaysToDate(reqRawDate, 7);

      if (requestStatus === "CANCELLED") {
        return [
          {
            key: "REQ_CREATED",
            label: isReturn ? "Return Created" : "Exchange Created",
            description: `Your ${
              isReturn ? "return" : "exchange"
            } request (${req?.referenceId || "Request"}) was registered.${
              cleanReason ? ` Reason: ${cleanReason}` : ""
            }`,
            date: reqRawDate,
            isCompleted: true,
            isCurrent: false,
          },
          {
            key: "REQ_CANCELLED",
            label: isReturn ? "Return Cancelled" : "Exchange Cancelled",
            description: isReturn
              ? `Your return request (${
                  req?.referenceId || "Request"
                }) was cancelled. Since the product remains delivered to you, no refund is applicable.`
              : `Your exchange request (${
                  req?.referenceId || "Request"
                }) was cancelled. No replacement pickup or delivery will occur.`,
            date: reqUpdatedRawDate,
            isCompleted: false,
            isCurrent: false,
            isCancelledStep: true,
          },
        ];
      }

      /* EXCHANGE TIMELINE: 1. Exchange Created -> 2. Exchange Accepted -> 3. Replacement Confirmed -> 4. Replacement Packed -> 5. Replacement Dispatched -> 6. Out for Exchange -> 7. Exchange Complete */
      if (!isReturn) {
        const exchangeStageMap = {
          REQUESTED: 0,
          ACCEPTED: 1,
          CONFIRMED: 2,
          APPROVED: 2,
          PACKED: 3,
          DISPATCHED: 4,
          IN_TRANSIT: 4,
          OUT_FOR_EXCHANGE: 5,
          PICKUP_ASSIGNED: 5,
          PICKED_UP: 5,
          EXCHANGE_COMPLETED: 6,
          EXCHANGED: 6,
          COMPLETED: 6,
        };

        const stageIdx = exchangeStageMap[requestStatus] ?? 0;
        const isAllExchangeDone = stageIdx >= 6;

        const exDefinitions = [
          {
            key: "EX_CREATED",
            label: "Exchange Created",
            description: `Your exchange request (${
              req?.referenceId || "Request"
            }) has been placed successfully.${
              cleanReason ? ` Reason: ${cleanReason}` : ""
            }`,
          },
          {
            key: "EX_ACCEPTED",
            label: "Exchange Accepted",
            description:
              stageIdx >= 1
                ? "Your exchange request has been approved by TechStore."
                : "Awaiting approval from TechStore.",
          },
          {
            key: "EX_CONFIRMED",
            label: "Replacement Confirmed",
            description:
              stageIdx >= 2
                ? "Your replacement product order has been confirmed at ₹0 extra cost."
                : "Replacement order will be confirmed after approval.",
          },
          {
            key: "EX_PACKED",
            label: "Replacement Packed",
            description:
              stageIdx >= 3
                ? "Your replacement unit has been packed and quality-checked at the warehouse."
                : "Replacement product is being prepared for packing.",
          },
          {
            key: "EX_DISPATCHED",
            label: "Replacement Dispatched",
            description:
              stageIdx >= 4
                ? "Your replacement product has been dispatched from the warehouse."
                : "Replacement product will be dispatched from the warehouse.",
          },
          {
            key: "EX_OUT_FOR_EXCHANGE",
            label: "Out for Exchange",
            description:
              stageIdx >= 5
                ? "Delivery executive is out for doorstep exchange (old unit pickup + new replacement handover)."
                : "Delivery partner will be assigned for doorstep exchange.",
          },
          {
            key: "EX_COMPLETE",
            label: "Exchange Complete",
            description: isAllExchangeDone
              ? "Your old item was picked up and your new replacement product has been delivered."
              : `Expected completion by ${formatDate(expectedCompleteDate)}.`,
          },
        ];

        return exDefinitions.map((def, idx) => {
          const isCompleted = stageIdx >= idx;
          const isCurrent = stageIdx === idx && !isAllExchangeDone;
          const stepDate =
            idx === 0
              ? reqRawDate
              : isCompleted
              ? idx === 6
                ? expectedCompleteDate
                : reqUpdatedRawDate
              : "";

          return {
            ...def,
            date: stepDate,
            isCompleted,
            isCurrent,
          };
        });
      }

      /* RETURN TIMELINE: 1. Return Created -> 2. Return Accepted -> 3. Out for Pickup -> 4. Picked Up & Refund Initiated -> 5. Return Complete */
      const returnStageMap = {
        REQUESTED: 0,
        ACCEPTED: 1,
        CONFIRMED: 1,
        APPROVED: 1,
        PICKUP_ASSIGNED: 2,
        PICKED_UP: 3,
        REFUND_INITIATED: 3,
        REFUND_COMPLETED: 4,
        REFUNDED: 4,
        COMPLETED: 4,
      };

      let returnStageIdx = returnStageMap[requestStatus] ?? 0;
      if (refundStatus === "COMPLETED" || refundStatus === "REFUNDED") {
        returnStageIdx = 4;
      } else if (
        (refundStatus === "INITIATED" || refundStatus === "REFUND_INITIATED") &&
        returnStageIdx < 3
      ) {
        returnStageIdx = 3;
      }

      const isAllReturnDone = returnStageIdx >= 4;

      const retDefinitions = [
        {
          key: "REQ_CREATED",
          label: "Return Created",
          description: `Your return request (${
            req?.referenceId || "Request"
          }) has been placed successfully.${
            cleanReason ? ` Reason: ${cleanReason}` : ""
          }`,
        },
        {
          key: "REQ_ACCEPTED",
          label: "Return Accepted",
          description:
            returnStageIdx >= 1
              ? "Your return request has been approved by TechStore. Doorstep pickup will be scheduled."
              : "Awaiting approval and pickup confirmation from TechStore.",
        },
        {
          key: "REQ_PICKUP",
          label: "Out for Pickup",
          description:
            returnStageIdx >= 2
              ? "Our courier partner has been assigned and is out to pick up your return item."
              : "Courier partner will be assigned for doorstep pickup.",
        },
        {
          key: "REQ_REFUND_INIT",
          label: "Picked Up & Refund Initiated",
          description:
            returnStageIdx >= 3
              ? refundAmount > 0
                ? `Return item picked up & verified. Refund of ₹${formatMoney(
                    refundAmount
                  )} has been initiated to your payment mode.`
                : "Return item picked up & verified. Refund has been initiated."
              : "Refund will be initiated once the item is picked up and verified.",
        },
        {
          key: "REQ_COMPLETE",
          label: "Return Complete",
          description: isAllReturnDone
            ? `Your return and refund${
                refundAmount > 0 ? ` of ₹${formatMoney(refundAmount)}` : ""
              } has been completed successfully.`
            : `Expected completion by ${formatDate(expectedCompleteDate)}.`,
        },
      ];

      return retDefinitions.map((def, idx) => {
        const isCompleted = returnStageIdx >= idx;
        const isCurrent = returnStageIdx === idx && !isAllReturnDone;
        const stepDate =
          idx === 0
            ? reqRawDate
            : isCompleted
            ? idx === 4
              ? expectedCompleteDate
              : reqUpdatedRawDate
            : "";

        return {
          ...def,
          date: stepDate,
          isCompleted,
          isCurrent,
        };
      });
    },
    [
      actualRefundAmount,
      order?.orderDate,
      order?.$createdAt,
    ]
  );

  /* SEQUENTIAL STEP-BY-STEP ANIMATION FOR ORDER PLACED -> DELIVERED */
  const targetOrderStageIndex = useMemo(() => {
    let lastCompleted = 0;
    trackingMilestones.forEach((step, idx) => {
      if (step.isCompleted || step.isUnsuccessful) {
        lastCompleted = idx;
      }
    });
    return lastCompleted;
  }, [trackingMilestones]);

  useEffect(() => {
    setOrderAnimIndex(0);
  }, [order?.$id, order?.orderId, activeProductIndex]);

  useEffect(() => {
    if (shipmentLoading && !shipment) return;
    if (orderAnimIndex < targetOrderStageIndex) {
      const timer = setTimeout(() => {
        setOrderAnimIndex((prev) =>
          Math.min(prev + 1, targetOrderStageIndex)
        );
      }, 420);
      return () => clearTimeout(timer);
    }
    if (orderAnimIndex > targetOrderStageIndex) {
      setOrderAnimIndex(targetOrderStageIndex);
    }
  }, [orderAnimIndex, targetOrderStageIndex, shipmentLoading, shipment]);

  /* SEQUENTIAL STEP-BY-STEP ANIMATION FOR RETURN & EXCHANGE */
  const allFocusedRxSteps = useMemo(
    () => buildReturnExchangeSteps(focusedReturnRequest),
    [buildReturnExchangeSteps, focusedReturnRequest]
  );

  const targetRxStageIndex = useMemo(() => {
    let lastIdx = 0;
    allFocusedRxSteps.forEach((s, idx) => {
      if (s.isCompleted || s.isCancelledStep) {
        lastIdx = idx;
      }
    });
    return lastIdx;
  }, [allFocusedRxSteps]);

  useEffect(() => {
    setRxAnimIndex(0);
  }, [
    focusedReturnRequest?.$id,
    focusedReturnRequest?.referenceId,
    activeProductIndex,
  ]);

  useEffect(() => {
    if (
      !focusedReturnRequest ||
      isFocusedReqCancelled ||
      isCancellingReturnNow
    ) {
      return;
    }
    if (rxAnimIndex < targetRxStageIndex) {
      const timer = setTimeout(() => {
        setRxAnimIndex((prev) => Math.min(prev + 1, targetRxStageIndex));
      }, 420);
      return () => clearTimeout(timer);
    }
    if (rxAnimIndex > targetRxStageIndex) {
      setRxAnimIndex(targetRxStageIndex);
    }
  }, [
    rxAnimIndex,
    targetRxStageIndex,
    focusedReturnRequest,
    isFocusedReqCancelled,
    isCancellingReturnNow,
  ]);

  const scrollToPaymentBreakup = () => {
    const el = document.getElementById("order-payment-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* REFRESH TRACKING */

   
  // eslint-disable-next-line no-unused-vars
  const refreshTracking =
    async () => {
      setTrackingLoading(true);

      try {
        await loadShipmentFromAppwrite(
          false
        );

        toast.success(
          "Tracking updated successfully"
        );
      } catch {
        toast.error(
          "Unable to refresh tracking"
        );
      } finally {
        setTrackingLoading(false);
      }
    };

  /* DELIVERY OTP */

  // eslint-disable-next-line no-unused-vars
  const handleGenerateOtp =
    async () => {
      if (!shipment?.$id) {
        toast.error(
          "Shipment information is not available."
        );
        return;
      }

      if (!currentUser?.$id) {
        toast.error(
          "Please login again."
        );
        return;
      }

      if (
        normalizeStatus(
          shipment.status
        ) !==
        "OUT_FOR_DELIVERY"
      ) {
        toast.error(
          "Delivery OTP is available only when your parcel is Out for Delivery."
        );
        return;
      }

      try {
        setOtpLoading(true);

        const result =
          await deliveryOtpService.generateOtp(
            {
              shipmentId:
                shipment.$id,

              orderId:
                shipment.orderId ||
                order?.orderId ||
                order?.$id ||
                "",

              userId:
                currentUser.$id,

              trackingId:
                shipment.trackingId,
            }
          );

        if (!result?.success) {
          throw new Error(
            result?.message ||
              "Unable to generate OTP."
          );
        }

        setDeliveryOtp(
          String(
            result.otp || ""
          )
        );

        setOtpExpiresAt(
          result.expiresAt ||
            null
        );

        setShowOtp(true);

        toast.success(
          "Delivery OTP generated"
        );
      } catch (error) {
        console.error(
          "Generate Delivery OTP Error:",
          error
        );

        toast.error(
          error?.message ||
            "Unable to generate delivery OTP."
        );
      } finally {
        setOtpLoading(false);
      }
    };

  /* OTP — NEVER EXPIRES UNTIL DELIVERED */

  useEffect(() => {
    let cancelled = false;

    const syncActiveOtp = async () => {
      if (
        !shipment?.$id ||
        currentStatus !== "OUT_FOR_DELIVERY" ||
        isDelivered ||
        isCancelled
      ) {
        setDeliveryOtp("");
        setShowOtp(false);
        setOtpExpiresAt(null);
        setOtpTimeLeft(0);
        return;
      }

      try {
        const genResult = await deliveryOtpService.generateOtp({
          shipmentId: String(shipment.$id),
          orderId: String(
            shipment.orderId || order?.orderId || order?.$id || ""
          ),
          userId: String(
            shipment.userId || order?.userId || currentUser?.$id || ""
          ),
          trackingId: String(shipment.trackingId || ""),
          shipmentDoc: shipment,
          orderDoc: order,
        });

        if (genResult?.autoCancelled) {
          if (!cancelled) {
            setDeliveryOtp("");
            setShowOtp(false);
            loadShipmentFromAppwrite(false);
          }
          return;
        }

        const code = String(
          genResult?.otp || genResult?.otpCode || ""
        ).trim();

        if (!cancelled && code) {
          setDeliveryOtp(code);
          setOtpExpiresAt(genResult?.expiresAt || null);
          setShowOtp(true);
          setOtpTimeLeft(999999);
        }
      } catch (err) {
        console.warn("Active OTP load warning:", err);
      }
    };

    syncActiveOtp();

    return () => {
      cancelled = true;
    };
  }, [
    shipment?.$id,
    shipment?.orderId,
    shipment?.userId,
    shipment?.trackingId,
    order?.orderId,
    order?.$id,
    order?.userId,
    currentUser?.$id,
    currentStatus,
    isDelivered,
    isCancelled,
    otpExpiresAt,
  ]);

  /* LOAD EXISTING USER REVIEW FOR ACTIVE PRODUCT */
  useEffect(() => {
    let cancelled = false;

    const checkUserReview = async () => {
      const uid = String(currentUser?.$id || "").trim();
      const pid = getProductId(activeProduct);
      if (!uid || !pid || !isDelivered) {
        if (!cancelled) setExistingProductReview(null);
        return;
      }
      try {
        const found = await reviewService.getUserReviewForProduct(uid, pid);
        if (!cancelled) {
          setExistingProductReview(found || null);
        }
      } catch {
        if (!cancelled) setExistingProductReview(null);
      }
    };

    checkUserReview();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.$id, activeProduct, isDelivered]);

  const handleCopyOtp =
    async () => {
      if (!deliveryOtp) return;

      try {
        await navigator.clipboard.writeText(
          deliveryOtp
        );

        toast.success(
          "OTP copied"
        );
      } catch {
        toast.error(
          "Unable to copy OTP"
        );
      }
    };

  /* REVIEW */

  const handleReviewProducts =
    () => {
      if (!isDelivered) {
        toast.error(
          "You can review the product after delivery."
        );
        return;
      }

      if (!currentUser) {
        toast.error(
          "Please login to write a review."
        );
        return;
      }

      if (
        !activeProduct ||
        !getProductId(
          activeProduct
        )
      ) {
        toast.error(
          "Product information is not available."
        );
        return;
      }

      setReviewProduct(
        activeProduct
      );

      if (existingProductReview) {
        setReviewRating(Number(existingProductReview.rating || 5));
        setReviewText(String(existingProductReview.review || ""));
        setIsEditingReview(false);
      } else {
        setReviewRating(5);
        setReviewText("");
        setIsEditingReview(true);
      }

      setReviewSubmitted(false);
      setReviewModalOpen(true);
    };

  useEffect(() => {
    if (!reviewModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [reviewModalOpen]);

  const closeReviewModal =
    () => {
      if (reviewSubmitting) {
        return;
      }

      setReviewModalOpen(false);
      setReviewProduct(null);
      setIsEditingReview(false);
      setReviewSubmitted(false);
    };

  const handleSubmitReview =
    async (event) => {
      event.preventDefault();

      if (!currentUser) {
        toast.error(
          "Please login to submit a review."
        );
        return;
      }

      if (!reviewProduct) {
        toast.error(
          "Product information is missing."
        );
        return;
      }

      const cleanReview =
        String(
          reviewText || ""
        ).trim();

      if (!cleanReview) {
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

      try {
        setReviewSubmitting(
          true
        );

        let savedReview = null;

        if (existingProductReview?.$id) {
          toast.error("Approved reviews are locked and cannot be edited.");
          setIsEditingReview(false);
          setReviewSubmitting(false);
          return;
        } else {
          savedReview = await reviewService.createReview(
            {
              productId:
                getProductId(
                  reviewProduct
                ),

              productName:
                getProductName(
                  reviewProduct
                ),

              userId:
                String(
                  currentUser.$id
                ),

              customerName:
                getCustomerName(),

              customerEmail:
                getCustomerEmail(),

              rating:
                Number(
                  reviewRating
                ),

              review:
                cleanReview,

              status:
                "Approved",

              orderId:
                String(
                  order?.orderId ||
                    order?.$id ||
                    ""
                ),

              createdAt:
                new Date().toISOString(),
            }
          );
        }

        if (savedReview) {
          setExistingProductReview(savedReview);
        }

        setIsEditingReview(false);
        setReviewSubmitted(true);

        toast.success(
          existingProductReview?.$id
            ? "Review updated successfully ⭐"
            : "Review submitted successfully ⭐"
        );
      } catch (error) {
        console.error(
          "Review Submit Error:",
          error
        );

        toast.error(
          error?.message ||
            "Unable to submit review."
        );
      } finally {
        setReviewSubmitting(
          false
        );
      }
    };

  /* SHARE */

  const handleShare =
    async () => {
      const text =
        `TechStore Order Details\n` +
        `Order ID: ${
          order?.orderId ||
          order?.$id ||
          ""
        }\n` +
        `Status: ${orderStatus}\n` +
        `Total Amount: ₹${formatMoney(
          totalPaid
        )}`;

      try {
        if (
          navigator.share
        ) {
          await navigator.share(
            {
              title:
                "Order Details",
              text,
            }
          );
        } else {
          await navigator.clipboard.writeText(
            text
          );

          toast.success(
            "Order details copied to clipboard!"
          );
        }
      } catch {
        // user cancelled share
      }
    };

  /* INVOICE */

  const handleInvoiceClick =
    () => {
      if (!isDelivered) {
        toast.error(
          "Invoice can only be downloaded once the order is Delivered!"
        );
        return;
      }

      const ref = getOrderReference(order);
      navigate(
        ref ? `/invoice?orderId=${encodeURIComponent(ref)}` : "/invoice",
        {
          state: {
            ...order,
            shipment,
            autoDownload: true,
          },
        }
      );
    };

  /* RETURN / EXCHANGE */

  const handleReturnExchange =
    () => {
      if (!isWithinReturnWindow) {
        toast.error(
          "7-day return & exchange window has expired for this product."
        );
        return;
      }

      if (hasExistingReturnOrExchange) {
        toast.error(
          "You can only submit a Return or Exchange request once for this product."
        );
        return;
      }

      const orderReference =
        getOrderReference(order);

      if (!orderReference) {
        toast.error(
          "Order ID is not available."
        );
        return;
      }

      const rxParams = new URLSearchParams();
      rxParams.set("itemIdx", String(activeProductIndex));
      const prodId = getProductId(activeProduct);
      if (prodId) {
        rxParams.set("itemId", String(prodId));
      }

      navigate(
        `/return-exchange/${encodeURIComponent(
          orderReference
        )}?${rxParams.toString()}`,
        {
          state: {
            order,
            singleProduct: activeProduct,
            itemIndex: activeProductIndex,
          },
        }
      );
    };

  /* RETURN TRACKING */

  const handleTrackReturn =
    (request) => {
      const orderReference =
        getOrderReference(order);

      if (!orderReference) {
        return;
      }

      const params =
        new URLSearchParams();

      params.set(
        "orderId",
        orderReference
      );

      if (shipment?.trackingId) {
        params.set(
          "trackingId",
          shipment.trackingId
        );
      }

      if (request?.referenceId) {
        params.set(
          "returnId",
          request.referenceId
        );
      }

      navigate(
        `/track-order?${params.toString()}`,
        {
          state: {
            order,
            shipment,
          },
        }
      );
    };

  /* CANCEL */

  const handleCancel =
    async () => {
      if (!canCancel) {
        toast.error(
          "Cancellation is not available once the order is packed!"
        );
        return;
      }

      const orderDocumentId =
        order?.$id;

      if (!orderDocumentId) {
        toast.error(
          "Order document ID is not available."
        );
        return;
      }

      try {
        setCancelPhase("submitting");
        setCancelStepAnim(1);

        // Smoothly scroll to Shipment Progress card so the user sees the step-by-step animation
        setTimeout(() => {
          const progressEl = document.getElementById("shipment-progress-section");
          if (progressEl) {
            progressEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 80);

        toast.loading(
          "Submitting cancellation request...",
          {
            id: "cancelToast",
          }
        );

        const stageOneStart = Date.now();
        const cancelTimeISO =
          new Date().toISOString();

        // Update ONLY the currently selected item (e.g. 1 item out of 8)
        let matchedOne = false;
        const updatedItems =
          rawOrderItems.map(
            (item, idx) => {
              const isTargetByIndex =
                idx === activeProductIndex;
              const isTargetById =
                !matchedOne &&
                activeProductIndex < 0 &&
                ((item?.id &&
                  item.id === activeProduct?.id) ||
                  (item?.productId &&
                    item.productId === activeProduct?.productId) ||
                  (item?.title &&
                    item.title === activeProduct?.title));

              if (isTargetByIndex || isTargetById) {
                matchedOne = true;
                return {
                  ...item,
                  status: "Cancelled",
                  isCancelled: true,
                  cancelledDate: cancelTimeISO,
                };
              }

              return item;
            }
          );

        const updatedSingleProduct = {
          ...activeProduct,
          status: "Cancelled",
          isCancelled: true,
          cancelledDate: cancelTimeISO,
        };

        // Check if ALL items in the order are now cancelled
        const allItemsCancelled =
          updatedItems.length > 0 &&
          updatedItems.every(
            (it) =>
              Boolean(it?.isCancelled) ||
              normalizeStatus(it?.status) === "CANCELLED"
          );

        const updatePayload = {
          items: JSON.stringify(updatedItems),
        };

        if (allItemsCancelled) {
          updatePayload.status = "Cancelled";
        }

        const updatedOrder =
          await orderService.updateOrder(
            orderDocumentId,
            updatePayload
          );

        const mergedCancelledOrder = {
          ...order,
          ...updatedOrder,
          items: updatedItems,
          singleProduct: updatedSingleProduct,
          status: allItemsCancelled
            ? "Cancelled"
            : order?.status || "Placed",
          cancelledDate: allItemsCancelled
            ? cancelTimeISO
            : order?.cancelledDate,
        };

        // Refund wallet amount for the cancelled order / item
        let walletRefundResult = null;
        if (walletPaidVal > 0) {
          try {
            walletRefundResult =
              await walletService.refundOrderWallet(
                mergedCancelledOrder,
                {
                  userId:
                    order?.userId ||
                    currentUser?.$id ||
                    "",
                  fullOrder: allItemsCancelled,
                  shipmentId:
                    shipment?.$id || "",
                  trackingId:
                    shipment?.trackingId || "",
                }
              );
          } catch (walletRefundErr) {
            console.error(
              "Wallet refund on cancel error:",
              walletRefundErr
            );
          }
        }

        // Cancel the shipment if all items in the order are cancelled
        if (allItemsCancelled) {
          try {
            let targetShipment = shipment;
            if (!targetShipment?.$id) {
              const fetchedShipments = await shipmentService.getShipmentsByOrderId(
                String(getOrderReference(order))
              );
              const sList = Array.isArray(fetchedShipments)
                ? fetchedShipments
                : fetchedShipments?.documents || [];
              targetShipment = sList[0] || null;
            }

            if (targetShipment?.$id) {
              await shipmentHelper.updateShipmentStatus(
                targetShipment.$id,
                "CANCELLED",
                {
                  orderId:
                    targetShipment.orderId ||
                    order?.orderId ||
                    orderDocumentId,
                  trackingId:
                    targetShipment.trackingId,
                  title:
                    "Shipment Cancelled",
                  description:
                    "This shipment was cancelled by the customer.",
                  city:
                    targetShipment.destinationCity ||
                    order?.city ||
                    "",
                  state:
                    targetShipment.destinationState ||
                    order?.state ||
                    "",
                }
              );

              await loadShipmentFromAppwrite(false);
            }
          } catch (shipmentError) {
            console.error(
              "Shipment cancellation error:",
              shipmentError
            );
          }
        }

        // Ensure Stage 1 ("Cancellation requested" active pulse) is visible for at least 1100ms
        const elapsedStageOne = Date.now() - stageOneStart;
        if (elapsedStageOne < 1100) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1100 - elapsedStageOne)
          );
        }

        // Stage 2: Complete "Cancellation requested" and animate connector line to "Cancelled"
        setCancelPhase("cancelling");
        setCancelStepAnim(2);

        await new Promise((resolve) => setTimeout(resolve, 650));

        // Stage 3: Final "Cancelled" state
        setOrder(mergedCancelledOrder);
        setCancelStepAnim(3);
        setCancelPhase("cancelled");

        const creditedWalletAmt = Number(
          walletRefundResult?.amount ||
            walletRefundResult?.totalRefunded ||
            (walletPaidVal > 0 ? refundToWallet : 0)
        );

        toast.success(
          creditedWalletAmt > 0
            ? `Order Cancelled! ₹${formatMoney(creditedWalletAmt)} credited back to your TechStore Wallet.`
            : rawOrderItems.length > 1 && !allItemsCancelled
            ? "Selected item cancelled successfully!"
            : "Order Cancelled Successfully",
          {
            id: "cancelToast",
          }
        );
      } catch (error) {
        console.error(
          "Cancellation Error:",
          error
        );

        setCancelStepAnim(0);
        setCancelPhase(
          "none"
        );

        toast.error(
          error?.message ||
            "Unable to cancel product.",
          {
            id: "cancelToast",
          }
        );
      }
    };

  const handleCancelReturnRequest = async () => {
    if (!focusedReturnRequest?.$id) return;
    const st = String(focusedReturnRequest?.status || "REQUESTED").toUpperCase();
    if (st !== "REQUESTED") {
      toast.error("Cancellation is no longer available once the request is accepted.");
      return;
    }
    try {
      setCancelReturnLoading(true);
      const progressSection = document.getElementById("shipment-progress-section");
      if (progressSection) {
        progressSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Stage 1: Requesting cancellation
      setCancelReturnPhase("submitting");
      setRxCancelStepAnim(1);

      await Promise.all([
        returnExchangeService.cancelRequest(focusedReturnRequest.$id),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);

      // Stage 2: Request verified, connector line animates down to Cancelled
      setRxCancelStepAnim(2);
      setCancelReturnPhase("cancelling");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Stage 3: Final Cancelled state
      setRxCancelStepAnim(3);
      setCancelReturnPhase("cancelled");
      await loadReturnExchangeRequests();
      toast.success(
        `${isFocusedExchange ? "Exchange" : "Return"} request cancelled successfully.`
      );
    } catch (err) {
      setRxCancelStepAnim(0);
      setCancelReturnPhase("none");
      toast.error(err?.message || "Unable to cancel request.");
    } finally {
      setCancelReturnLoading(false);
    }
  };

  /* AUTO-SYNC WALLET REFUND FOR CANCELLED ORDERS */
  useEffect(() => {
    if (!order || !isCancelled || walletPaidVal <= 0) return;
    walletService
      .refundOrderWallet(order, {
        userId: order?.userId || currentUser?.$id || "",
        fullOrder: isEntireOrderCancelled,
        shipmentId: shipment?.$id || "",
        trackingId: shipment?.trackingId || "",
      })
      .catch((err) => {
        console.warn("OrderDetails wallet refund sync warning:", err);
      });
  }, [
    order,
    isCancelled,
    walletPaidVal,
    isEntireOrderCancelled,
    currentUser?.$id,
    shipment?.$id,
    shipment?.trackingId,
  ]);

  /* LOADING */

  if (orderLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{
          minHeight: "70vh",
        }}
      >
        <div className="text-center">
          <FaSpinner
            className="fa-spin mb-3"
            size={30}
          />

          <h5 className="fw-bold text-dark mb-1">
            Loading Order Details...
          </h5>

          <p className="text-muted mb-0">
            Please wait while we
            fetch your order.
          </p>
        </div>
      </div>
    );
  }

  /* ERROR */

  if (orderError) {
    return (
      <div
        className="container py-5"
        style={{
          minHeight: "70vh",
        }}
      >
        <div className="pro-card p-5 text-center glass-card">
          <h4 className="fw-bold text-danger mb-2">
            Unable to Load Order
          </h4>

          <p className="text-muted mb-4">
            {orderError}
          </p>

          <button
            type="button"
            className="btn btn-dark px-4"
            onClick={() =>
              navigate("/orders")
            }
          >
            <FaArrowLeft className="me-2" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div
        className="container py-5"
        style={{
          minHeight: "70vh",
        }}
      >
        <div className="pro-card p-5 text-center glass-card">
          <h4 className="fw-bold text-dark mb-2">
            Order Not Found
          </h4>

          <p className="text-muted mb-4">
            We couldn't find the
            requested order.
          </p>

          <button
            type="button"
            className="btn btn-dark px-4"
            onClick={() =>
              navigate("/orders")
            }
          >
            <FaArrowLeft className="me-2" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  /* PRODUCT */

  const itemImage =
    activeProduct?.thumbnail ||
    activeProduct?.image ||
    activeProduct?.img ||
    "https://images.unsplash.com/photo-1523275335684-37898b30?w=500&auto=format&fit=crop&q=60";

  const itemName =
    activeProduct?.title ||
    activeProduct?.name ||
    "Product Item";

  /* RENDER */

  return (
    <div className="order-details-wrapper py-5 animate-fade-in">
      <div className="container custom-page-container">

        {/* HEADER */}

        <div className="pro-card p-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3 glass-card hover-lift order-top-header-card">

          <div className="d-flex align-items-center gap-3">

            <button
              className="pro-back-btn"
              onClick={() =>
                navigate("/orders")
              }
              title="Back to Orders"
            >
              <FaArrowLeft size={16} />
            </button>

            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">

                <h2 className="fw-bold mb-0 text-gradient fs-3">
                  {focusedReturnRequest
                    ? isFocusedExchange
                      ? "Exchange Details"
                      : "Return Details"
                    : "Order Details"}
                </h2>

                <span
                  className={`badge rounded-pill px-3 py-1 fw-bold fs-6 shadow-sm ${
                    focusedReturnRequest
                      ? isFocusedReqCancelled
                        ? "bg-danger text-white"
                        : isFocusedExchange
                        ? "bg-primary text-white"
                        : "bg-warning text-dark"
                      : isCancellingNow || (isCancelled && cancelStepAnim > 0 && cancelStepAnim < 3)
                      ? "bg-warning text-dark"
                      : isCancelled
                      ? "bg-danger text-white"
                      : isDelivered
                      ? "bg-success text-white"
                      : isOutForDelivery
                      ? "bg-warning text-dark"
                      : "bg-primary text-white"
                  }`}
                >
                  {focusedReturnRequest
                    ? isFocusedReqCancelled
                      ? isFocusedExchange
                        ? "Exchange Cancelled"
                        : "Return Cancelled"
                      : isFocusedExchange
                      ? "Exchanged"
                      : "Returned"
                    : isCancellingNow || (isCancelled && cancelStepAnim > 0 && cancelStepAnim < 3)
                    ? "Cancellation Requested"
                    : isCancelled
                    ? "Cancelled"
                    : orderStatus}
                </span>

              </div>

              <small className="text-muted fw-medium">
                {focusedReturnRequest
                  ? isFocusedExchange
                    ? "Your complete exchange request & replacement summary"
                    : "Your complete return request & status summary"
                  : "Your complete order summary"}
              </small>
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap">

            <button
              className="pro-action-btn"
              onClick={
                handleShare
              }
            >
              <FaShareAlt size={14} />
              Share
            </button>

            <button
              className={`pro-action-btn ${
                isDelivered
                  ? "btn-outline-dark"
                  : "opacity-50 cursor-not-allowed"
              }`}
              onClick={
                handleInvoiceClick
              }
              disabled={!isDelivered}
            >
              <FaFileInvoice size={14} />
              Invoice
            </button>

          </div>
        </div>

        {/* ORDER / RETURN / EXCHANGE ID INFO */}

        <div className="pro-card p-4 mb-4 glass-card hover-lift order-meta-info-card">
          {focusedReturnRequest ? (
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-6">
                <small className="text-muted d-block mb-1">
                  {isFocusedExchange ? "Exchange ID" : "Return ID"}
                </small>

                <strong className="text-dark font-monospace fs-5 d-block">
                  {focusedReturnRequest.referenceId ||
                    `${isFocusedExchange ? "EX" : "RE"}-${getOrderReference(order)}-01`}
                </strong>

                <small className="text-muted d-block mt-1">
                  Order ID :{" "}
                  <span className="fw-bold text-dark font-monospace">
                    {getOrderReference(order) || "Order ID unavailable"}
                  </span>
                </small>
              </div>

              <div className="col-12 col-md-6 text-md-end">
                <small className="text-muted d-block mb-1">
                  {isFocusedExchange ? "Exchanged On" : "Returned On"}
                </small>

                <strong className="text-dark d-block">
                  {formatDate(
                    focusedReturnRequest.createdAt ||
                      focusedReturnRequest.$createdAt ||
                      order?.orderDate ||
                      order?.$createdAt
                  )}{" "}
                  at{" "}
                  {formatTime(
                    focusedReturnRequest.createdAt ||
                      focusedReturnRequest.$createdAt ||
                      order?.orderDate ||
                      order?.$createdAt
                  )}
                </strong>

                <small className="text-muted d-block mt-1">
                  Placed On : {originalPlacedDate}
                </small>
              </div>
            </div>
          ) : (
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-6">
                <small className="text-muted d-block mb-1">
                  Order ID
                </small>

                <strong className="text-dark font-monospace">
                  {getOrderReference(
                    order
                  ) ||
                    "Order ID unavailable"}
                </strong>
              </div>

              <div className="col-12 col-md-6 text-md-end">
                <small className="text-muted d-block mb-1">
                  Placed On
                </small>

                <strong className="text-dark">
                  {originalPlacedDate}{" "}
                  at{" "}
                  {originalPlacedTime}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* PRODUCT */}

        <div className="pro-card p-4 mb-4 glass-card hover-lift order-product-summary-card">

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 order-product-card-head">

            <div>
              <small className="text-muted d-block order-product-card-label">
                Ordered Item{rawOrderItems.length > 1 ? ` (${activeProductIndex + 1} of ${rawOrderItems.length})` : ""}
              </small>
            </div>

            <div>
              {focusedReturnRequest ? (
                <span
                  className="badge rounded-pill px-3 py-2 d-inline-flex align-items-center gap-1"
                  style={{
                    background: isFocusedReqCancelled
                      ? "#fff1f2"
                      : isFocusedExchange
                      ? "#eff6ff"
                      : "#fff7ed",
                    color: isFocusedReqCancelled
                      ? "#e11d48"
                      : isFocusedExchange
                      ? "#2563eb"
                      : "#ea580c",
                    border: isFocusedReqCancelled
                      ? "1px solid #fecdd3"
                      : isFocusedExchange
                      ? "1px solid #bfdbfe"
                      : "1px solid #fed7aa",
                  }}
                >
                  {isFocusedExchange ? (
                    <FaExchangeAlt size={11} />
                  ) : (
                    <FaUndoAlt size={11} />
                  )}
                  {isFocusedReqCancelled
                    ? isFocusedExchange
                      ? "Exchange Cancelled"
                      : "Return Cancelled"
                    : isFocusedExchange
                    ? "Exchanged"
                    : "Returned"}
                </span>
              ) : isCancellingNow || (isCancelled && cancelStepAnim > 0 && cancelStepAnim < 3) ? (
                <span className="badge bg-warning text-dark rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2">
                  <FaSpinner className="fa-spin" size={11} />
                  Cancellation Requested
                </span>
              ) : isCancelled ? (
                <span className="badge bg-danger rounded-pill px-3 py-2">
                  Cancelled
                </span>
              ) : isDeliveryUnsuccessful ? (
                <span className="badge bg-warning text-dark rounded-pill px-3 py-2">
                  Delivery Unsuccessful
                </span>
              ) : isDelivered ? (
                <span className="badge bg-success rounded-pill px-3 py-2">
                  <FaCheckCircle className="me-1" />
                  Delivered
                </span>
              ) : isOutForDelivery ? (
                <span className="badge bg-warning text-dark rounded-pill px-3 py-2">
                  Arriving Today
                </span>
              ) : shipment?.estimatedDeliveryDate ? (
                <span className="badge bg-light text-dark border rounded-pill px-3 py-2">
                  Arriving{" "}
                  {formatDate(
                    shipment.estimatedDeliveryDate
                  )}
                </span>
              ) : (
                <span className="badge bg-light text-dark border rounded-pill px-3 py-2">
                  {shipmentLoading
                    ? "Checking shipment..."
                    : "Shipment in progress"}
                </span>
              )}
            </div>
          </div>

          <div className="order-product-summary-row">

            <div className="order-product-img-wrap">
              <img
                src={itemImage}
                alt={itemName}
                referrerPolicy="no-referrer"
                className="order-product-summary-image shadow-sm border"
                onError={(e) => {
                  e.currentTarget.onerror =
                    null;

                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";
                }}
              />

              {focusedReturnRequest ? (
                <span
                  className={`order-product-img-tag ${
                    isFocusedExchange ? "is-exchange" : "is-return"
                  }`}
                >
                  {isFocusedExchange ? "EXCHANGE" : "RETURN"}
                </span>
              ) : isCancelled ? (
                <span className="order-product-img-tag is-cancelled">
                  CANCELLED
                </span>
              ) : null}
            </div>

            <div className="flex-grow-1 order-product-info-col">

              <span
                className="badge bg-light text-primary border mb-2 order-brand-badge"
                style={{
                  fontSize: "10px",
                }}
              >
                {activeProduct?.brand ||
                  "TechStore"}
              </span>

              <h5 className="order-product-summary-name mb-1">
                {itemName}
              </h5>

              <small className="order-product-summary-qty">
                {activeProduct?.size ? (
                  <>
                    Size:{" "}
                    <strong className="text-dark me-3">
                      {activeProduct.size}
                    </strong>
                  </>
                ) : null}
                Quantity:{" "}
                <strong className="text-dark">
                  x{itemQty}
                </strong>
              </small>

            </div>

            <div className="text-end order-product-price-col">

              <h4 className="order-product-summary-price mb-0">
                ₹
                {formatMoney(
                  activeItemSellingPrice *
                    itemQty
                )}
              </h4>

              {activeItemDiscountPercent >
                0 && (
                <div className="mt-1">
                  <span className="text-muted text-decoration-line-through me-2">
                    ₹
                    {(
                      activeItemOriginalPrice *
                      itemQty
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  <span className="badge bg-danger-subtle text-danger order-discount-badge">
                    {
                      activeItemDiscountPercent
                    }
                    % OFF
                  </span>
                </div>
              )}

            </div>
          </div>

          <div className="order-product-breakup-bar">
            <div className="order-product-breakup-left">
              <strong className="order-product-breakup-amount">
                ₹
                {formatMoney(
                  rawOrderItems.length === 1
                    ? orderGrandTotal
                    : activeItemSellingPrice * itemQty + platformFeeVal
                )}
              </strong>
              <span className="order-product-breakup-sub">
                (Includes Convenience Fee)
              </span>
            </div>

            <button
              type="button"
              className="order-view-breakup-btn"
              onClick={scrollToPaymentBreakup}
            >
              View Breakup
            </button>
          </div>
        </div>

        {/* SHIPMENT / RETURN / EXCHANGE / CANCELLATION PROGRESS — All rendered in the EXACT Shipment Progress UI (Image 2) */}

        <section
          id="shipment-progress-section"
          className="shipment-progress-section mb-4"
        >
          <div className="shipment-progress-card glass-card hover-lift">
            {focusedReturnRequest ? (
              (() => {
                const rxSteps = buildReturnExchangeSteps(focusedReturnRequest);
                const rxRefId =
                  focusedReturnRequest.referenceId ||
                  `${isFocusedExchange ? "EX" : "RE"}-${getOrderReference(order)}-01`;
                const rawRxStatus = String(
                  focusedReturnRequest?.status || "REQUESTED"
                ).toUpperCase();
                const rxStatus =
                  isFocusedReqCancelled || isCancellingReturnNow
                    ? "CANCELLED"
                    : rawRxStatus;
                const effectiveRxCancelStage =
                  rxCancelStepAnim > 0 ? rxCancelStepAnim : 3;
                const isFinalRxCancelled = effectiveRxCancelStage >= 3;
                const rxCreatedDate =
                  focusedReturnRequest?.createdAt ||
                  focusedReturnRequest?.$createdAt ||
                  order?.orderDate ||
                  order?.$createdAt;
                const rxUpdatedDate =
                  focusedReturnRequest?.updatedAt ||
                  focusedReturnRequest?.$updatedAt ||
                  rxCreatedDate;

                const showRxCourier = [
                  "DISPATCHED",
                  "IN_TRANSIT",
                  "PICKUP_ASSIGNED",
                  "OUT_FOR_EXCHANGE",
                  "PICKED_UP",
                  "REFUNDED",
                  "REFUND_COMPLETED",
                  "EXCHANGE_COMPLETED",
                  "EXCHANGED",
                  "COMPLETED",
                ].includes(rxStatus);

                return (
                  <>
                    <div
                      className={`shipment-progress-head ${
                        showRxCourier && courierBrand ? "has-center-courier" : ""
                      }`}
                    >
                      <div className="shipment-progress-head-left">
                        <h4 className="shipment-progress-title mb-1">
                          {isFocusedExchange
                            ? "Exchange Progress"
                            : "Return Progress"}
                        </h4>

                        <p className="shipment-progress-subtitle mb-0">
                          {rxStatus === "CANCELLED"
                            ? !isFinalRxCancelled
                              ? `Processing your ${
                                  isFocusedExchange ? "exchange" : "return"
                                } cancellation...`
                              : `Cancelled by you on ${formatDate(rxUpdatedDate)}`
                            : `Live tracking • ${rxRefId}`}
                        </p>
                      </div>

                      {showRxCourier && courierBrand && (
                        <div className="shipment-progress-courier-center">
                          <span
                            className="shipment-progress-courier-badge"
                            style={{
                              "--courier-color": courierBrand.color,
                              "--courier-bg": courierBrand.bg,
                              "--courier-border": courierBrand.border,
                              "--courier-dark-bg": courierBrand.darkBg,
                              "--courier-dark-color": courierBrand.darkColor,
                              "--courier-dark-border": courierBrand.darkBorder,
                            }}
                          >
                            <FaRoute className="shipment-progress-courier-icon" />
                            <span>{courierBrand.name}</span>
                          </span>
                        </div>
                      )}

                      <div className="shipment-progress-head-actions">
                        <span
                          className={`shipment-progress-status-pill ${
                            rxStatus === "CANCELLED"
                              ? isFinalRxCancelled
                                ? "danger"
                                : "warning"
                              : [
                                  "ACCEPTED",
                                  "CONFIRMED",
                                  "REFUNDED",
                                  "REFUND_COMPLETED",
                                  "EXCHANGE_COMPLETED",
                                  "EXCHANGED",
                                  "COMPLETED",
                                ].includes(rxStatus)
                              ? "success"
                              : ["PACKED", "DISPATCHED"].includes(rxStatus)
                              ? "primary"
                              : "warning"
                          }`}
                        >
                          <span className="shipment-progress-status-dot" />
                          {rxStatus === "CANCELLED"
                            ? !isFinalRxCancelled
                              ? "Cancellation Requested"
                              : isFocusedExchange
                              ? "Exchange Cancelled"
                              : "Return Cancelled"
                            : rxStatus === "ACCEPTED"
                            ? isFocusedExchange
                              ? "Exchange Accepted"
                              : "Return Accepted"
                            : rxStatus === "CONFIRMED"
                            ? isFocusedExchange
                              ? "Confirmed"
                              : "Return Accepted"
                            : rxStatus === "PACKED"
                            ? "Packed"
                            : rxStatus === "DISPATCHED"
                            ? "Dispatched"
                            : rxStatus === "PICKUP_ASSIGNED" ||
                              rxStatus === "OUT_FOR_EXCHANGE" ||
                              rxStatus === "PICKED_UP"
                            ? isFocusedExchange
                              ? "Out for Exchange"
                              : "Out for Pickup"
                            : [
                                "REFUNDED",
                                "REFUND_COMPLETED",
                                "EXCHANGE_COMPLETED",
                                "EXCHANGED",
                                "COMPLETED",
                              ].includes(rxStatus)
                            ? isFocusedExchange
                              ? "Exchange Complete"
                              : "Return Complete"
                            : isFocusedExchange
                            ? "Exchange Requested"
                            : "Return Requested"}
                        </span>

                        {rxStatus !== "CANCELLED" && (
                          <button
                            type="button"
                            className="shipment-progress-track-btn"
                            onClick={() => handleTrackReturn(focusedReturnRequest)}
                          >
                            <FaRoute className="me-1" />
                            Track
                          </button>
                        )}
                      </div>
                    </div>

                    {rxStatus === "CANCELLED" ? (
                      <div className="shipment-progress-timeline">
                        {/* Step 1: Return / Exchange Created */}
                        <div className="shipment-progress-step completed">
                          <div className="shipment-progress-marker-column">
                            <span className="shipment-progress-marker step-marker-pop">
                              <FaCheck />
                            </span>
                            <span className="shipment-progress-line completed cancel-line-anim-1" />
                          </div>

                          <div className="shipment-progress-step-content step-content-reveal">
                            <div className="shipment-progress-step-top">
                              <div>
                                <h5 className="shipment-progress-step-title mb-1">
                                  {isFocusedExchange
                                    ? "Exchange Created"
                                    : "Return Created"}
                                </h5>
                                <p className="shipment-progress-step-description mb-0">
                                  {`Your ${
                                    isFocusedExchange ? "exchange" : "return"
                                  } request (${rxRefId}) was registered.${
                                    extractCleanReason(focusedReturnRequest?.reason || "")
                                      ? ` Reason: ${extractCleanReason(
                                          focusedReturnRequest.reason
                                        )}`
                                      : ""
                                  }`}
                                </p>
                              </div>

                              <div className="shipment-progress-date">
                                <strong>{formatDate(rxCreatedDate)}</strong>
                                <span>{formatTime(rxCreatedDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Cancellation requested */}
                        <div
                          className={`shipment-progress-step ${
                            effectiveRxCancelStage >= 2
                              ? "completed"
                              : "requesting-step current"
                          }`}
                        >
                          <div className="shipment-progress-marker-column">
                            <span
                              className={`shipment-progress-marker ${
                                effectiveRxCancelStage < 2
                                  ? "requesting"
                                  : "step-marker-pop"
                              }`}
                            >
                              {effectiveRxCancelStage >= 2 ? (
                                <FaCheck />
                              ) : (
                                <FaSpinner className="fa-spin" size={8} />
                              )}
                            </span>
                            <span
                              className={`shipment-progress-line ${
                                effectiveRxCancelStage >= 2
                                  ? "cancelled-line cancel-line-anim-2"
                                  : ""
                              }`}
                            />
                          </div>

                          <div className="shipment-progress-step-content step-content-reveal">
                            <div className="shipment-progress-step-top">
                              <div>
                                <h5 className="shipment-progress-step-title mb-1">
                                  Cancellation requested
                                </h5>
                                <p className="shipment-progress-step-description mb-0">
                                  {effectiveRxCancelStage < 2 &&
                                  isCancellingReturnNow
                                    ? `Submitting and verifying your ${
                                        isFocusedExchange ? "exchange" : "return"
                                      } cancellation...`
                                    : `You requested to cancel this ${
                                        isFocusedExchange ? "exchange" : "return"
                                      } request.`}
                                </p>
                              </div>

                              <div className="shipment-progress-date">
                                <strong>{formatDate(rxUpdatedDate)}</strong>
                                <span>{formatTime(rxUpdatedDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 3: Return Cancelled / Exchange Cancelled */}
                        <div
                          className={`shipment-progress-step ${
                            isFinalRxCancelled
                              ? "cancelled-step current cancel-step-pop"
                              : "pending"
                          }`}
                        >
                          <div className="shipment-progress-marker-column">
                            <span
                              className={`shipment-progress-marker ${
                                isFinalRxCancelled ? "cancelled" : ""
                              }`}
                            >
                              {isFinalRxCancelled ? <FaTimes /> : null}
                            </span>
                          </div>

                          <div className="shipment-progress-step-content">
                            <div className="shipment-progress-step-top">
                              <div>
                                <h5 className="shipment-progress-step-title mb-1">
                                  {isFocusedExchange
                                    ? "Exchange Cancelled"
                                    : "Return Cancelled"}
                                </h5>
                                <p className="shipment-progress-step-description mb-0">
                                  {isFinalRxCancelled
                                    ? isFocusedExchange
                                      ? `Your exchange request (${rxRefId}) has been cancelled by you. You will keep your delivered product and no replacement will be sent.`
                                      : `Your return request (${rxRefId}) has been cancelled by you. Since the product remains delivered to you, no refund is applicable.`
                                    : "Waiting for cancellation confirmation..."}
                                </p>
                              </div>

                              {isFinalRxCancelled && (
                                <div className="shipment-progress-date">
                                  <strong>{formatDate(rxUpdatedDate)}</strong>
                                  <span>{formatTime(rxUpdatedDate)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="shipment-progress-timeline">
                        {rxSteps.map((step, index) => {
                          const nextStep = rxSteps[index + 1];
                          const isLastStep = index === rxSteps.length - 1;
                          const isStepReached =
                            step.isCompleted && index <= rxAnimIndex;
                          const isNextReached =
                            Boolean(nextStep?.isCompleted) &&
                            index + 1 <= rxAnimIndex;
                          const isAnimCurrent =
                            isStepReached &&
                            index === rxAnimIndex &&
                            (rxAnimIndex < targetRxStageIndex || step.isCurrent);
                          const isOutgoingFlowing =
                            isStepReached &&
                            !isNextReached &&
                            index === rxAnimIndex &&
                            step.isCurrent &&
                            !isLastStep;

                          return (
                            <div
                              className={`shipment-progress-step ${
                                isStepReached ? "completed" : "pending"
                              } ${isAnimCurrent ? "current" : ""}`}
                              key={step.key}
                            >
                              <div className="shipment-progress-marker-column">
                                <span
                                  className={`shipment-progress-marker ${
                                    isStepReached ? "step-marker-pop" : ""
                                  } ${isAnimCurrent ? "live-active-marker" : ""}`}
                                >
                                  {isStepReached ? <FaCheck /> : null}
                                </span>

                                {!isLastStep && (
                                  <span
                                    className={`shipment-progress-line ${
                                      isNextReached
                                        ? "completed step-line-grow"
                                        : isOutgoingFlowing
                                        ? "line-progress-flow"
                                        : ""
                                    }`}
                                  />
                                )}
                              </div>

                              <div
                                className={`shipment-progress-step-content ${
                                  isStepReached ? "step-content-reveal" : ""
                                }`}
                              >
                                <div className="shipment-progress-step-top">
                                  <div>
                                    <h5 className="shipment-progress-step-title mb-1">
                                      {step.label}
                                    </h5>

                                    {(isStepReached ||
                                      index <= rxAnimIndex + 1) &&
                                    step.description ? (
                                      <p className="shipment-progress-step-description mb-0">
                                        {step.description}
                                      </p>
                                    ) : null}
                                  </div>

                                  {isStepReached && step.date ? (
                                    <div className="shipment-progress-date">
                                      <strong>{formatDate(step.date)}</strong>
                                      <span>{formatTime(step.date)}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()
            ) : isCancelled || isCancellingNow ? (
              (() => {
                const effectiveCancelStage =
                  cancelStepAnim > 0 ? cancelStepAnim : 3;
                const isFinalCancelled = effectiveCancelStage >= 3;

                return (
                  <>
                    <div className="shipment-progress-head">
                      <div className="shipment-progress-head-left">
                        <h4 className="shipment-progress-title mb-1">
                          Shipment Progress
                        </h4>

                        <p className="shipment-progress-subtitle mb-0">
                          {!isFinalCancelled
                            ? "Processing your cancellation request..."
                            : `Cancelled by you on ${cancelledFormattedDate}`}
                        </p>
                      </div>

                      <div className="shipment-progress-head-actions">
                        <span
                          className={`shipment-progress-status-pill ${
                            isFinalCancelled ? "danger" : "warning"
                          }`}
                        >
                          <span className="shipment-progress-status-dot" />
                          {isFinalCancelled
                            ? "Cancelled"
                            : "Cancellation Requested"}
                        </span>
                      </div>
                    </div>

                    <div className="shipment-progress-timeline">
                      {/* Step 1: Confirmed */}
                      <div className="shipment-progress-step completed">
                        <div className="shipment-progress-marker-column">
                          <span className="shipment-progress-marker">
                            <FaCheck />
                          </span>
                          <span className="shipment-progress-line completed cancel-line-anim-1" />
                        </div>

                        <div className="shipment-progress-step-content">
                          <div className="shipment-progress-step-top">
                            <div>
                              <h5 className="shipment-progress-step-title mb-1">
                                Confirmed
                              </h5>
                              <p className="shipment-progress-step-description mb-0">
                                Your order has been placed successfully and shipment processing has started.
                              </p>
                            </div>

                            <div className="shipment-progress-date">
                              <strong>{originalPlacedDate}</strong>
                              <span>{originalPlacedTime}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Cancellation requested */}
                      <div
                        className={`shipment-progress-step ${
                          effectiveCancelStage >= 2
                            ? "completed"
                            : "requesting-step current"
                        }`}
                      >
                        <div className="shipment-progress-marker-column">
                          <span
                            className={`shipment-progress-marker ${
                              effectiveCancelStage < 2 ? "requesting" : ""
                            }`}
                          >
                            {effectiveCancelStage >= 2 ? (
                              <FaCheck />
                            ) : (
                              <FaSpinner className="fa-spin" size={8} />
                            )}
                          </span>
                          <span
                            className={`shipment-progress-line ${
                              effectiveCancelStage >= 2
                                ? "cancelled-line cancel-line-anim-2"
                                : ""
                            }`}
                          />
                        </div>

                        <div className="shipment-progress-step-content">
                          <div className="shipment-progress-step-top">
                            <div>
                              <h5 className="shipment-progress-step-title mb-1">
                                Cancellation requested
                              </h5>
                              <p className="shipment-progress-step-description mb-0">
                                {effectiveCancelStage < 2 && isCancellingNow
                                  ? "Submitting and verifying your cancellation request..."
                                  : "You requested to cancel this order."}
                              </p>
                            </div>

                            <div className="shipment-progress-date">
                              <strong>{cancelledFormattedDate}</strong>
                              <span>{cancelledFormattedTime}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Cancelled */}
                      <div
                        className={`shipment-progress-step ${
                          isFinalCancelled
                            ? "cancelled-step current cancel-step-pop"
                            : "pending"
                        }`}
                      >
                        <div className="shipment-progress-marker-column">
                          <span
                            className={`shipment-progress-marker ${
                              isFinalCancelled ? "cancelled" : ""
                            }`}
                          >
                            {isFinalCancelled ? <FaTimes /> : null}
                          </span>
                        </div>

                        <div className="shipment-progress-step-content">
                          <div className="shipment-progress-step-top">
                            <div>
                              <h5 className="shipment-progress-step-title mb-1">
                                Cancelled
                              </h5>
                              <p className="shipment-progress-step-description mb-0">
                                {isFinalCancelled
                                  ? cancellationTrackingEvent?.description ||
                                    `This shipment was cancelled by the customer.`
                                  : "Waiting for cancellation confirmation..."}
                              </p>
                            </div>

                            {isFinalCancelled && (
                              <div className="shipment-progress-date">
                                <strong>{cancelledFormattedDate}</strong>
                                <span>{cancelledFormattedTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <div
                  className={`shipment-progress-head ${
                    showCourierInHeader && courierBrand ? "has-center-courier" : ""
                  }`}
                >
                  <div className="shipment-progress-head-left">
                    <h4 className="shipment-progress-title mb-1">
                      Shipment Progress
                    </h4>

                    <p className="shipment-progress-subtitle mb-0">
                      {shipment?.trackingId
                        ? `Live tracking • ${shipment.trackingId}`
                        : shipmentLoading
                        ? "Loading live shipment details..."
                        : `Live tracking • ${getOrderReference(order)}`}
                    </p>
                  </div>

                  {showCourierInHeader && courierBrand && (
                    <div className="shipment-progress-courier-center">
                      <span
                        className="shipment-progress-courier-badge"
                        style={{
                          "--courier-color": courierBrand.color,
                          "--courier-bg": courierBrand.bg,
                          "--courier-border": courierBrand.border,
                          "--courier-dark-bg": courierBrand.darkBg,
                          "--courier-dark-color": courierBrand.darkColor,
                          "--courier-dark-border": courierBrand.darkBorder,
                        }}
                      >
                        <FaRoute className="shipment-progress-courier-icon" />
                        <span>{courierBrand.name}</span>
                      </span>
                    </div>
                  )}

                  <div className="shipment-progress-head-actions">
                    <span
                      className={`shipment-progress-status-pill ${
                        currentStatus === "DELIVERED"
                          ? "success"
                          : isDeliveryUnsuccessful
                          ? "warning"
                          : currentStatus === "OUT_FOR_DELIVERY"
                          ? "warning"
                          : "primary"
                      }`}
                    >
                      <span className="shipment-progress-status-dot" />
                      {STATUS_MAP[currentStatus] || currentStatus || "Confirmed"}
                    </span>
                  </div>
                </div>

                {shipmentLoading && !shipment ? (
                  <div className="shipment-progress-loading">
                    <FaSpinner className="fa-spin" />
                    <div>
                      <strong>Loading Shipment Progress...</strong>
                      <small>
                        Fetching live shipment and tracking updates.
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="shipment-progress-timeline">
                    {currentStatus === "OUT_FOR_DELIVERY" &&
                      !isDelivered &&
                      !isCancelled &&
                      deliveryOtp && (
                        <div
                          className="mb-3 p-3 rounded-4 d-flex flex-wrap align-items-center justify-content-between gap-3"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(124, 58, 237, 0.08))",
                            border: "1.5px dashed rgba(37, 99, 235, 0.45)",
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                              style={{
                                width: "42px",
                                height: "42px",
                                background: "rgba(37, 99, 235, 0.15)",
                                color: "#2563eb",
                                fontSize: "18px",
                              }}
                            >
                              <FaLock />
                            </div>
                            <div>
                              <div className="d-flex align-items-center flex-wrap gap-2">
                                <span
                                  className="fw-bold text-uppercase"
                                  style={{
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.06em",
                                    color: "#2563eb",
                                  }}
                                >
                                  Delivery Verification OTP
                                </span>
                                <span
                                  className="badge rounded-pill"
                                  style={{
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "#059669",
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  Active until delivered
                                </span>
                              </div>
                              <div
                                className="fw-bolder mt-1"
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "1.35rem",
                                  letterSpacing: "4px",
                                }}
                              >
                                {deliveryOtp}
                              </div>
                              <small className="text-muted d-block">
                                Share this 6-digit OTP with the delivery executive when your parcel arrives.
                              </small>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2 fw-semibold"
                            onClick={handleCopyOtp}
                          >
                            <FaCopy size={13} />
                            <span>Copy OTP</span>
                          </button>
                        </div>
                      )}

                    {isDeliveryUnsuccessful && (
                      <div className="shipment-unsuccessful-banner">
                        <FaExclamationTriangle className="shipment-unsuccessful-icon" />
                        <div>
                          We tried to deliver this product to you multiple times,
                          but were unsuccessful. We have returned this product to
                          warehouse.
                        </div>
                      </div>
                    )}

                    {trackingMilestones.map((step, index) => {
                      const nextStep = trackingMilestones[index + 1];
                      const isLastStep = index === trackingMilestones.length - 1;
                      const isWarningReached =
                        Boolean(step.isUnsuccessful) &&
                        index <= orderAnimIndex;
                      const isNextWarningReached =
                        Boolean(nextStep?.isUnsuccessful) &&
                        Boolean(nextStep?.isCompleted) &&
                        index + 1 <= orderAnimIndex;
                      const isStepReached =
                        step.isCompleted && index <= orderAnimIndex;
                      const isNextReached =
                        Boolean(nextStep?.isCompleted) &&
                        index + 1 <= orderAnimIndex;
                      const isAnimCurrent =
                        isStepReached &&
                        index === orderAnimIndex &&
                        (orderAnimIndex < targetOrderStageIndex ||
                          step.isCurrent);
                      const isOutgoingFlowing =
                        isStepReached &&
                        !isNextReached &&
                        !isNextWarningReached &&
                        index === orderAnimIndex &&
                        !isDelivered &&
                        !isDeliveryUnsuccessful &&
                        !isLastStep;

                      return (
                        <div
                          className={`shipment-progress-step ${
                            isWarningReached
                              ? "cancelled-step current cancel-step-pop"
                              : isStepReached
                              ? "completed"
                              : "pending"
                          } ${isAnimCurrent ? "current" : ""}`}
                          key={step.key}
                        >
                          <div className="shipment-progress-marker-column">
                            <span
                              className={`shipment-progress-marker ${
                                isWarningReached
                                  ? "cancelled"
                                  : isStepReached
                                  ? "step-marker-pop"
                                  : ""
                              } ${
                                isAnimCurrent && !isWarningReached
                                  ? "live-active-marker"
                                  : ""
                              }`}
                            >
                              {isWarningReached ? (
                                <FaExclamationTriangle size={8} />
                              ) : isStepReached ? (
                                <FaCheck />
                              ) : null}
                            </span>

                            {!isLastStep && (
                              <span
                                className={`shipment-progress-line ${
                                  isNextWarningReached
                                    ? "cancelled-line step-line-grow"
                                    : isNextReached
                                    ? "completed step-line-grow"
                                    : isOutgoingFlowing
                                    ? "line-progress-flow"
                                    : ""
                                }`}
                              />
                            )}
                          </div>

                          <div
                            className={`shipment-progress-step-content ${
                              isStepReached || isWarningReached
                                ? "step-content-reveal"
                                : ""
                            }`}
                          >
                            <div className="shipment-progress-step-top">
                              <div>
                                <h5 className="shipment-progress-step-title mb-1">
                                  {step.label}
                                </h5>

                                {isStepReached || isWarningReached ? (
                                  step.description ? (
                                    <p className="shipment-progress-step-description mb-0">
                                      {step.description}
                                    </p>
                                  ) : null
                                ) : null}
                              </div>

                              {(isStepReached || isWarningReached) &&
                              step.date ? (
                                <div className="shipment-progress-date">
                                  <strong>{formatDate(step.date)}</strong>
                                  <span>{formatTime(step.date)}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ACTIONS */}

        {focusedReturnRequest && !isFocusedReqCancelled ? (
          <div className="pro-card p-4 mb-4 glass-card hover-lift order-actions-card">
            <div className="order-actions-grid">
              <button
                type="button"
                className="btn order-action-btn order-action-btn-track"
                onClick={() => handleTrackReturn(focusedReturnRequest)}
              >
                <FaRoute />
                <span>
                  {isFocusedExchange ? "Track Exchange" : "Track Return"}
                </span>
              </button>

              {String(focusedReturnRequest?.status || "REQUESTED").toUpperCase() ===
              "REQUESTED" ? (
                <button
                  type="button"
                  className="btn order-action-btn order-action-btn-cancel"
                  onClick={handleCancelReturnRequest}
                  disabled={cancelReturnLoading}
                >
                  {cancelReturnLoading ? (
                    <>
                      <FaSpinner className="fa-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <FaTimes />
                      <span>
                        {isFocusedExchange ? "Cancel Exchange" : "Cancel Return"}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn order-action-btn order-action-btn-disabled"
                  disabled
                >
                  <span>Cancellation Not Available</span>
                </button>
              )}
            </div>
          </div>
        ) : !isCancelled && !focusedReturnRequest ? (
          <div className="pro-card p-4 mb-4 glass-card hover-lift order-actions-card">

            {isDelivered ? (
              isWithinReturnWindow ? (
                <div className="order-actions-grid">

                  <button
                    type="button"
                    className="btn order-action-btn order-action-btn-review"
                    onClick={handleReviewProducts}
                  >
                    <FaStar className="text-warning flex-shrink-0" />
                    <span>
                      {existingProductReview ? "Your Review" : "Review Product"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn order-action-btn order-action-btn-return"
                    onClick={() => {
                      if (hasExistingReturnOrExchange && existingActiveRequest) {
                        const params = new URLSearchParams();
                        params.set("orderId", getOrderReference(order));
                        params.set("itemIdx", String(activeProductIndex));
                        const prodId = getProductId(activeProduct);
                        if (prodId) {
                          params.set("itemId", String(prodId));
                        }
                        if (
                          existingActiveRequest.referenceId ||
                          existingActiveRequest.$id
                        ) {
                          params.set(
                            "returnId",
                            String(
                              existingActiveRequest.referenceId ||
                                existingActiveRequest.$id
                            )
                          );
                        }
                        navigate(`/order-details?${params.toString()}`, {
                          state: {
                            order,
                            shipment,
                            singleProduct: activeProduct,
                            itemIndex: activeProductIndex,
                            returnRequest: existingActiveRequest,
                            viewMode:
                              String(
                                existingActiveRequest?.type || ""
                              ).toUpperCase() === "EXCHANGE"
                                ? "EXCHANGE"
                                : "RETURN",
                          },
                        });
                      } else {
                        handleReturnExchange();
                      }
                    }}
                  >
                    <FaExchangeAlt className="flex-shrink-0" />
                    <span>
                      {hasExistingReturnOrExchange
                        ? String(existingActiveRequest?.type || "").toUpperCase() ===
                          "EXCHANGE"
                          ? "View Exchange Status"
                          : "View Return Status"
                        : "Return / Exchange"}
                    </span>
                  </button>

                </div>
              ) : (
                <div className="order-actions-single">
                  <button
                    type="button"
                    className="btn order-action-btn order-action-btn-review w-100"
                    onClick={handleReviewProducts}
                  >
                    <FaStar className="text-warning flex-shrink-0" />
                    <span>
                      {existingProductReview ? "Your Review" : "Review Product"}
                    </span>
                  </button>
                </div>
              )
            ) : isDispatchedStage ? (
              <div className="order-actions-grid">

                <button
                  type="button"
                  className="btn order-action-btn order-action-btn-track"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("orderId", getOrderReference(order));
                    if (shipment?.trackingId) {
                      params.set("trackingId", shipment.trackingId);
                    }
                    navigate(`/track-order?${params.toString()}`, {
                      state: {
                        order,
                        shipment,
                      },
                    });
                  }}
                >
                  <FaRoute className="flex-shrink-0" />
                  <span>Track Order</span>
                </button>

                <button
                  type="button"
                  className="btn order-action-btn order-action-btn-disabled"
                  disabled
                >
                  <span>Cancellation Not Available</span>
                </button>

              </div>
            ) : (
              <div className="order-actions-single">
                <button
                  type="button"
                  className={`btn order-action-btn w-100 ${
                    canCancel || isCancellingNow
                      ? "order-action-btn-cancel"
                      : "order-action-btn-disabled"
                  }`}
                  onClick={handleCancel}
                  disabled={
                    !canCancel ||
                    cancelPhase !== "none"
                  }
                >
                  {isCancellingNow ? (
                    <>
                      <FaSpinner className="fa-spin flex-shrink-0" />
                      <span>
                        {cancelPhase === "submitting"
                          ? "Cancellation Requested..."
                          : "Finalizing Cancellation..."}
                      </span>
                    </>
                  ) : canCancel ? (
                    <span>Cancel Product</span>
                  ) : (
                    <span>Cancellation Not Available</span>
                  )}
                </button>
              </div>
            )}

          </div>
        ) : null}

        {/* EXCHANGE REPLACEMENT PROCESS CARD (Shown only for Active Exchange requests) */}
        {focusedReturnRequest && isFocusedExchange && !isFocusedReqCancelled && (
          <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift order-refund-card animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <FaExchangeAlt className="text-primary" />
                Exchange Replacement Process
              </h4>
              <span className="badge bg-primary text-white px-3 py-2 rounded-pill">
                Free Doorstep Replacement • ₹0.00
              </span>
            </div>

            <p className="text-muted mb-4">
              No refund or extra payment is involved in an exchange. Your
              existing item will be picked up and replaced with a brand-new unit
              at your doorstep.
            </p>

            <div className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="text-muted">1. Original Item Pickup</span>
                <strong>Doorstep Verification & Handover</strong>
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="text-muted">2. Replacement Product</span>
                <strong>
                  {itemName} (x{itemQty})
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="text-muted">3. Exchange Fee / Extra Charge</span>
                <strong className="text-success">₹0.00 (Free)</strong>
              </div>
            </div>
          </div>
        )}

        {/* REFUND (Shown ONLY for Pre-Delivery Cancelled Orders OR Active Non-Cancelled Returns — NEVER for Return Cancelled!) */}

        {((!focusedReturnRequest &&
          isCancelled &&
          (cancelStepAnim === 0 || cancelStepAnim >= 3)) ||
          (isFocusedReturn && !isFocusedReqCancelled)) &&
          (() => {
            const rawRxSt = String(
              focusedReturnRequest?.status || ""
            ).toUpperCase();
            const rawRefSt = String(
              focusedReturnRequest?.refundStatus ||
                focusedReturnRequest?.paymentRefund?.refundStatus ||
                ""
            ).toUpperCase();
            const isReturnRefundInitiated =
              !isFocusedReturn ||
              [
                "PICKED_UP",
                "REFUND_INITIATED",
                "REFUNDED",
                "REFUND_COMPLETED",
                "COMPLETED",
              ].includes(rawRxSt) ||
              [
                "INITIATED",
                "REFUND_INITIATED",
                "COMPLETED",
                "REFUNDED",
              ].includes(rawRefSt);
            const isReturnRefundCompleted =
              isFocusedReturn &&
              (["REFUNDED", "REFUND_COMPLETED", "COMPLETED"].includes(rawRxSt) ||
                ["COMPLETED", "REFUNDED"].includes(rawRefSt));
            const refundRefDate = isFocusedReturn
              ? focusedReturnRequest?.updatedAt ||
                focusedReturnRequest?.$updatedAt ||
                focusedReturnRequest?.createdAt ||
                focusedReturnRequest?.$createdAt ||
                cancelledRawDate
              : cancelledRawDate;

            return (
              <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift order-refund-card animate-fade-in">
                {isPureCOD ? (
                  <div>
                    <h4 className="fw-bold mb-3">
                      {isFocusedReturn ? "Return Refund Details" : "Refund Details"}
                    </h4>

                    <p className="text-muted mb-0">
                      {isFocusedReturn
                        ? isReturnRefundInitiated
                          ? `Refund of ₹${formatMoney(
                              itemTotalPrice
                            )} for your Cash on Delivery return has been initiated following pickup verification.`
                          : `Estimated Refund: ₹${formatMoney(
                              itemTotalPrice
                            )}. Since this was a Cash on Delivery order, your refund will be processed once the return item is picked up and verified at your doorstep.`
                        : "No refund is involved as the order was a Cash on Delivery order."}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                      <h4 className="fw-bold mb-0">
                        {isFocusedReturn && !isReturnRefundInitiated
                          ? `Estimated Refund ₹${formatMoney(actualRefundAmount)}`
                          : `Total Refund ₹${formatMoney(actualRefundAmount)}`}
                      </h4>

                      {isFocusedReturn ? (
                        <span
                          className={`badge px-3 py-2 rounded-pill d-inline-flex align-items-center gap-2 ${
                            isReturnRefundCompleted
                              ? "bg-success text-white"
                              : isReturnRefundInitiated
                              ? "bg-primary text-white"
                              : "bg-warning text-dark"
                          }`}
                        >
                          <FaCheckCircle />
                          {isReturnRefundCompleted
                            ? "Refund Completed"
                            : isReturnRefundInitiated
                            ? "Refund Initiated"
                            : "Refund After Pickup Verification"}
                        </span>
                      ) : (
                        refundToWallet > 0 && (
                          <span className="badge bg-success text-white px-3 py-2 rounded-pill d-inline-flex align-items-center gap-2">
                            <FaCheckCircle />
                            ₹{formatMoney(refundToWallet)} Credited to Wallet
                          </span>
                        )
                      )}
                    </div>

                    {isFocusedReturn && !isReturnRefundInitiated ? (
                      <p className="text-muted mb-4">
                        Your refund of{" "}
                        <strong>₹{formatMoney(actualRefundAmount)}</strong> will
                        be initiated automatically once our courier partner picks
                        up the product from your address and completes quality
                        verification.
                      </p>
                    ) : refundToWallet > 0 && refundToOnline <= 0 ? (
                      <p className="text-success fw-semibold mb-4">
                        ₹{formatMoney(refundToWallet)} has been refunded and
                        credited back to your TechStore Wallet on{" "}
                        {formatFullDayDate(refundRefDate)}.
                      </p>
                    ) : (
                      <p className="text-muted mb-4">
                        {isReturnRefundCompleted
                          ? `Refund has been completed on ${formatFullDayDate(
                              refundRefDate
                            )}.`
                          : `Refund has been initiated on ${formatFullDayDate(
                              refundRefDate
                            )}.`}
                        {refundToWallet > 0
                          ? ` ₹${formatMoney(
                              refundToWallet
                            )} has been credited directly to your TechStore Wallet.`
                          : ""}{" "}
                        {refundToOnline > 0 && !isReturnRefundCompleted
                          ? "Online payment refund will be credited in 7-10 business days."
                          : ""}
                      </p>
                    )}

                    {refundToWallet > 0 && isReturnRefundInitiated && (
                      <div
                        className="p-3 rounded-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3"
                        style={{
                          background: "rgba(16, 185, 129, 0.1)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                        }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 40, height: 40 }}
                          >
                            <FaWallet size={18} />
                          </div>
                          <div>
                            <div className="fw-bold text-success">
                              +₹{formatMoney(refundToWallet)} Credited to TechStore Wallet
                            </div>
                            <small className="text-muted">
                              Your wallet balance has been restored for{" "}
                              {isFocusedReturn
                                ? `Return #${focusedReturnRequest?.referenceId || getOrderReference(order)}`
                                : `Cancelled Order #${getOrderReference(order)}`}
                            </small>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-success rounded-pill px-3 fw-semibold"
                          onClick={() => navigate("/profile?tab=wallet")}
                        >
                          Check Wallet Balance
                        </button>
                      </div>
                    )}

                    <h6 className="fw-bold mb-3">
                      Refund Credit Mode
                    </h6>

                    {refundToWallet > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted d-inline-flex align-items-center gap-2">
                          <FaWallet className="text-primary" />
                          TechStore Wallet{" "}
                          {isReturnRefundInitiated ? "(Credited)" : "(After Pickup)"}
                        </span>

                        <strong className="text-success">
                          +₹{formatMoney(refundToWallet)}
                        </strong>
                      </div>
                    )}

                    {refundToOnline > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted d-inline-flex align-items-center gap-2">
                          {isUPI ? (
                            <FaMobileAlt className="text-success" />
                          ) : (
                            <FaCreditCard className="text-primary" />
                          )}
                          {isUPI
                            ? "BHIM UPI"
                            : isCard
                            ? "Debit / Credit Card"
                            : "Original Payment Method"}
                        </span>

                        <strong>₹{formatMoney(refundToOnline)}</strong>
                      </div>
                    )}

                    <hr />

                    <div className="d-flex justify-content-between fw-bold fs-5">
                      <span>Total</span>

                      <span>₹{formatMoney(actualRefundAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* DELIVERY ADDRESS */}

        <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift">

          <div className="d-flex align-items-center gap-2 mb-4">

            <FaMapMarkerAlt className="text-primary" />

            <h5 className="fw-bold mb-0">
              Delivery Address
            </h5>

          </div>

          <h6 className="fw-bold fs-5 mb-2">
            {order?.fullName ||
              order?.customerName ||
              "Customer"}
          </h6>

          <p className="text-muted mb-2">

            {order?.address ||
              order?.destinationAddress ||
              "Address unavailable"}

            {order?.city
              ? `, ${order.city}`
              : ""}

            {order?.state
              ? `, ${order.state}`
              : ""}

            {order?.pincode
              ? ` - ${order.pincode}`
              : ""}

          </p>

          <p className="mb-0">

            <strong>Phone:</strong>{" "}

            {order?.phone ||
              order?.mobile ||
              "Unavailable"}

          </p>

        </div>

        {/* OTHER PRODUCTS */}

        {otherProducts.length >
          0 && (
          <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift">

            <h5 className="fw-bold mb-4">
              Other Products in
              this Order
            </h5>

            <div className="d-flex gap-3 overflow-auto pb-2">

              {otherProducts.map(
                (
                  item,
                  index
                ) => {
                  const image =
                    item?.thumbnail ||
                    item?.image ||
                    item?.img ||
                    "https://images.unsplash.com/photo-1523275335684-37898b30?w=500&auto=format&fit=crop&q=60";

                  return (
                    <div
                      key={index}
                      className="flex-shrink-0 text-center cursor-pointer"
                      style={{
                        width: "100px",
                      }}
                      onClick={() => {
                        const clickedIdx = rawOrderItems.findIndex(
                          (it) =>
                            it === item ||
                            JSON.stringify(it) === JSON.stringify(item)
                        );
                        const itemProdId = String(
                          item?.productId || item?.id || item?.$id || ""
                        ).trim();

                        setSelectedProductOverride(item);
                        setOrder((previous) =>
                          previous
                            ? {
                                ...previous,
                                singleProduct: item,
                              }
                            : previous
                        );

                        const params = new URLSearchParams(location.search);
                        const ordRef =
                          params.get("orderId") ||
                          order?.orderId ||
                          order?.$id ||
                          "";
                        if (ordRef) {
                          params.set("orderId", String(ordRef));
                        }
                        if (clickedIdx >= 0) {
                          params.set("itemIdx", String(clickedIdx));
                        }
                        if (itemProdId) {
                          params.set("itemId", itemProdId);
                        } else {
                          params.delete("itemId");
                        }
                        params.delete("returnId");

                        navigate(`/order-details?${params.toString()}`, {
                          replace: false,
                          state: {
                            ...(location.state || {}),
                            order: order
                              ? { ...order, singleProduct: item }
                              : order,
                            singleProduct: item,
                            itemIndex: clickedIdx >= 0 ? clickedIdx : 0,
                            returnRequest: null,
                            viewMode: "ORDER",
                          },
                        });

                        scrollToPageTop();
                      }}
                    >

                      <img
                        src={image}
                        alt={
                          item?.title ||
                          item?.name ||
                          "Product"
                        }
                        referrerPolicy="no-referrer"
                        className="img-fluid rounded-4 border shadow-sm"
                        style={{
                          width:
                            "90px",
                          height:
                            "90px",
                          objectFit:
                            "cover",
                        }}
                        onError={(
                          e
                        ) => {
                          e.currentTarget.onerror =
                            null;

                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";
                        }}
                      />

                      <small
                        className="text-muted text-truncate d-block mt-2"
                        style={{
                          fontSize:
                            "11px",
                        }}
                      >
                        {item?.title ||
                          item?.name ||
                          "Product"}
                      </small>

                    </div>
                  );
                }
              )}

            </div>
          </div>
        )}

        {/* PAYMENT */}

        <div
          id="order-payment-section"
          className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift order-payment-card"
        >

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">

            <h4 className="fw-bold mb-0 order-payment-heading">
              Order Payment Details
            </h4>

            <button
              type="button"
              className={`order-download-invoice-link ${
                !isDelivered ? "is-disabled" : ""
              }`}
              onClick={handleInvoiceClick}
            >
              Download Invoice
            </button>

          </div>

          <div className="order-payment-breakdown">

            <div className="order-payment-row">
              <span>Order Amount (MRP)</span>
              <strong>₹{formatMoney(orderOriginalAmount)}</strong>
            </div>

            {productLevelSavings > 0 && (
              <div className="order-payment-row is-savings">
                <span>Product Discount</span>
                <strong className="order-savings-amount">
                  -₹{formatMoney(productLevelSavings)}
                </strong>
              </div>
            )}

            <div className="order-payment-row">
              <span>Base Subtotal (Excl. GST)</span>
              <strong>
                ₹
                {formatMoney(
                  subTotalVal > 0 && gstVal > 0
                    ? subTotalVal
                    : (itemsSellingTotal > 0 ? itemsSellingTotal : orderOriginalAmount) / 1.18
                )}
              </strong>
            </div>

            <div className="order-payment-row">
              <span>
                GST (18%)
                {gstApplied && (
                  <small className="d-block text-success fw-semibold">
                    Corporate GSTIN Credit Applied
                  </small>
                )}
              </span>
              {(() => {
                const effectiveSelling =
                  itemsSellingTotal > 0 ? itemsSellingTotal : orderOriginalAmount;
                const effectiveGst =
                  gstVal > 0
                    ? gstVal
                    : effectiveSelling - effectiveSelling / 1.18;
                return gstApplied ? (
                  <strong className="order-savings-amount">
                    -₹{formatMoney(effectiveGst)}
                  </strong>
                ) : (
                  <strong>+₹{formatMoney(effectiveGst)}</strong>
                );
              })()}
            </div>

            <div className="order-payment-row is-savings">
              <span>
                Coupon Discount
                {order?.couponCode ? (
                  <small className="d-block text-success fw-semibold">
                    Coupon applied: {order.couponCode}
                  </small>
                ) : (
                  <small className="d-block text-muted">
                    {couponDiscount > 0
                      ? "Promo discount applied"
                      : "No coupon applied"}
                  </small>
                )}
              </span>
              <strong
                className={
                  couponDiscount > 0 ? "order-savings-amount" : "text-muted"
                }
              >
                {couponDiscount > 0
                  ? `-₹${formatMoney(couponDiscount)}`
                  : "₹0.00"}
              </strong>
            </div>

            <div className="order-payment-row">
              <span>Shipping / Delivery Fee</span>
              <strong className={shippingVal === 0 ? "text-success" : ""}>
                {shippingVal > 0 ? `₹${formatMoney(shippingVal)}` : "FREE"}
              </strong>
            </div>

            <div className="order-payment-row">
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span>Convenience Fee</span>
                  <button
                    type="button"
                    className="order-whats-this-btn"
                    onClick={() => setShowFeeInfo((prev) => !prev)}
                  >
                    What&apos;s this?
                  </button>
                </div>
                <small className="order-non-refundable-label">
                  (Non-refundable)
                </small>
                {showFeeInfo && (
                  <div className="order-fee-info-popover mt-2">
                    <FaInfoCircle className="me-1 text-primary" />
                    Convenience Fee covers platform handling, secure packaging,
                    and priority customer support. This fee is non-refundable.
                  </div>
                )}
              </div>
              <strong>₹{formatMoney(platformFeeVal)}</strong>
            </div>

            <div className="order-payment-row is-savings">
              <span>
                Total Order Savings
                {order?.couponCode && (
                  <small className="d-block text-success">
                    Includes coupon ({order.couponCode})
                  </small>
                )}
              </span>
              <strong className="order-savings-amount">
                -₹{formatMoney(totalOrderSavings)}
              </strong>
            </div>

            <div className="order-payment-total-row">
              <span>Order Total</span>
              <strong>₹{formatMoney(orderGrandTotal)}</strong>
            </div>

          </div>

          <hr className="order-payment-section-divider" />

          <div className="order-payment-mode-section">
            <h6 className="order-payment-mode-heading">
              Payment Mode
            </h6>

            <div className="order-payment-mode-list">
              {isUPI && externalPaymentAmount > 0 && (
                <div className="order-payment-mode-item">
                  <div className="order-payment-mode-left">
                    <span className="order-payment-mode-icon upi">
                      <FaMobileAlt />
                    </span>
                    <strong>BHIM UPI</strong>
                  </div>
                  <strong className="order-payment-mode-amount">
                    ₹{formatMoney(externalPaymentAmount)}
                  </strong>
                </div>
              )}

              {isCard && externalPaymentAmount > 0 && (
                <div className="order-payment-mode-item">
                  <div className="order-payment-mode-left">
                    <span className="order-payment-mode-icon card-mode">
                      <FaCreditCard />
                    </span>
                    <strong>Debit / Credit Card</strong>
                  </div>
                  <strong className="order-payment-mode-amount">
                    ₹{formatMoney(externalPaymentAmount)}
                  </strong>
                </div>
              )}

              {isCOD && codDueAmount > 0 && (
                <div className="order-payment-mode-item">
                  <div className="order-payment-mode-left">
                    <span className="order-payment-mode-icon cod">
                      <FaMoneyBillWave />
                    </span>
                    <strong>Cash on Delivery</strong>
                  </div>
                  <strong className="order-payment-mode-amount">
                    ₹{formatMoney(codDueAmount)}
                  </strong>
                </div>
              )}

              {!isUPI && !isCard && !isCOD && externalPaymentAmount > 0 && (
                <div className="order-payment-mode-item">
                  <div className="order-payment-mode-left">
                    <span className="order-payment-mode-icon card-mode">
                      <FaCreditCard />
                    </span>
                    <strong>Online Payment</strong>
                  </div>
                  <strong className="order-payment-mode-amount">
                    ₹{formatMoney(externalPaymentAmount)}
                  </strong>
                </div>
              )}

              {walletPaidVal > 0 && (
                <div className="order-payment-mode-item">
                  <div className="order-payment-mode-left">
                    <span className="order-payment-mode-icon wallet">
                      <FaWallet />
                    </span>
                    <strong>TechStore Wallet</strong>
                  </div>
                  <strong className="order-payment-mode-amount">
                    ₹{formatMoney(walletPaidVal)}
                  </strong>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* REVIEW MODAL — FULL LIGHT & DARK MODE */}

        {reviewModalOpen && (
          <div
            className="od-review-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeReviewModal();
              }
            }}
          >
            <div
              className="od-review-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="od-review-modal-header">
                <div>
                  <span className="od-review-eyebrow">
                    <FaStar className="text-warning" /> VERIFIED BUYER FEEDBACK
                  </span>
                  <h4 className="od-review-modal-title">
                    {existingProductReview && !isEditingReview && !reviewSubmitted
                      ? "Your Submitted Review"
                      : existingProductReview && isEditingReview
                      ? "Update Your Review"
                      : "Write a Product Review"}
                  </h4>
                </div>

                <button
                  type="button"
                  className="od-review-close-btn"
                  onClick={closeReviewModal}
                  disabled={reviewSubmitting}
                  aria-label="Close review modal"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Modal Body */}
              <div className="od-review-modal-body">
                {reviewSubmitted ? (
                  <div className="od-review-success-state">
                    <div className="od-review-success-icon">
                      <FaCheck />
                    </div>

                    <h4 className="od-review-success-title">
                      Thank You for Your Review!
                    </h4>

                    <p className="od-review-success-text">
                      Your verified purchase review for{" "}
                      <strong>{getProductName(reviewProduct)}</strong> has been
                      published.
                    </p>

                    <div className="od-review-success-actions">
                      {getProductId(reviewProduct) && (
                        <button
                          type="button"
                          className="od-review-btn od-review-btn-secondary"
                          onClick={() => {
                            const pid = getProductId(reviewProduct);
                            closeReviewModal();
                            navigate(`/product/${pid}`);
                          }}
                        >
                          View on Product Page
                        </button>
                      )}
                      <button
                        type="button"
                        className="od-review-btn od-review-btn-primary"
                        onClick={closeReviewModal}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : existingProductReview && !isEditingReview ? (
                  <div className="od-review-existing-view">
                    {/* Product Strip */}
                    <div className="od-review-product-strip">
                      <img
                        src={
                          reviewProduct?.thumbnail ||
                          reviewProduct?.image ||
                          reviewProduct?.img ||
                          "https://images.unsplash.com/photo-1523275335684-37898b30?w=500&auto=format&fit=crop&q=60"
                        }
                        alt={getProductName(reviewProduct)}
                        referrerPolicy="no-referrer"
                        className="od-review-product-img"
                      />
                      <div className="od-review-product-meta">
                        <span className="od-review-verified-pill">
                          <FaCheck /> Verified Purchase
                        </span>
                        <h6 className="od-review-product-name">
                          {getProductName(reviewProduct)}
                        </h6>
                      </div>
                    </div>

                    {/* Submitted Review Card */}
                    <div className="od-review-saved-box">
                      <div className="od-review-saved-top">
                        <div className="od-review-saved-stars">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <FaStar
                              key={s}
                              className={
                                s <= Number(existingProductReview.rating || 5)
                                  ? "star-filled"
                                  : "star-empty"
                              }
                            />
                          ))}
                          <strong>
                            {Number(existingProductReview.rating || 5).toFixed(1)} / 5
                          </strong>
                        </div>
                        <span
                          className={`od-review-status-pill ${String(
                            existingProductReview.status || "Approved"
                          ).toLowerCase()}`}
                        >
                          {existingProductReview.status || "Approved"}
                        </span>
                      </div>

                      <p className="od-review-saved-text">
                        {existingProductReview.review}
                      </p>

                      <div className="od-review-saved-footer">
                        <span>
                          By <strong>{existingProductReview.customerName || getCustomerName()}</strong>
                        </span>
                        <span>
                          {formatDate(
                            existingProductReview.createdAt ||
                              existingProductReview.$createdAt
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="od-review-locked-note mb-3">
                      <FaCheckCircle className="text-success flex-shrink-0" />
                      <span>
                        Your review is verified and approved. Approved reviews are permanently published and cannot be edited.
                      </span>
                    </div>

                    <div className="od-review-modal-actions">
                      {getProductId(reviewProduct) && (
                        <button
                          type="button"
                          className="od-review-btn od-review-btn-secondary"
                          onClick={() => {
                            const pid = getProductId(reviewProduct);
                            closeReviewModal();
                            navigate(`/product/${pid}`);
                          }}
                        >
                          View on Product Page
                        </button>
                      )}
                      <button
                        type="button"
                        className="od-review-btn od-review-btn-primary"
                        onClick={closeReviewModal}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview}>
                    {/* Product Strip */}
                    <div className="od-review-product-strip">
                      <img
                        src={
                          reviewProduct?.thumbnail ||
                          reviewProduct?.image ||
                          reviewProduct?.img ||
                          "https://images.unsplash.com/photo-1523275335684-37898b30?w=500&auto=format&fit=crop&q=60"
                        }
                        alt={getProductName(reviewProduct)}
                        referrerPolicy="no-referrer"
                        className="od-review-product-img"
                      />

                      <div className="od-review-product-meta">
                        <span className="od-review-verified-pill">
                          <FaCheck /> Verified Purchase • Order #{getOrderReference(order)}
                        </span>
                        <h6 className="od-review-product-name">
                          {getProductName(reviewProduct)}
                        </h6>
                      </div>
                    </div>

                    {/* Interactive Rating Selector */}
                    <div className="od-review-field-group">
                      <div className="od-review-label-row">
                        <label className="od-review-label">Overall Rating</label>
                        <span className="od-review-rating-tag">
                          {reviewRating === 5
                            ? "5.0 ★ Excellent"
                            : reviewRating === 4
                            ? "4.0 ★ Very Good"
                            : reviewRating === 3
                            ? "3.0 ★ Good"
                            : reviewRating === 2
                            ? "2.0 ★ Fair"
                            : "1.0 ★ Poor"}
                        </span>
                      </div>

                      <div className="od-review-star-picker">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`od-review-star-btn ${
                              star <= reviewRating ? "active" : ""
                            }`}
                            onClick={() => setReviewRating(star)}
                            aria-label={`Rate ${star} out of 5 stars`}
                          >
                            <FaStar />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Feedback Chips */}
                    <div className="od-review-field-group">
                      <label className="od-review-label">
                        Quick Highlights <small>(Tap to add)</small>
                      </label>
                      <div className="od-review-quick-tags">
                        {[
                          "Excellent build quality!",
                          "Great value for money.",
                          "Fast & safe delivery.",
                          "Works exactly as described.",
                          "Highly recommended!",
                        ].map((tagText) => {
                          const isAdded = reviewText
                            .toLowerCase()
                            .includes(tagText.toLowerCase());
                          return (
                            <button
                              key={tagText}
                              type="button"
                              className={`od-review-tag-chip ${
                                isAdded ? "active" : ""
                              }`}
                              onClick={() => {
                                if (isAdded) return;
                                setReviewText((prev) => {
                                  const cleanPrev = prev.trim();
                                  return cleanPrev
                                    ? `${cleanPrev} ${tagText}`
                                    : tagText;
                                });
                              }}
                            >
                              + {tagText}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Review Textarea */}
                    <div className="od-review-field-group">
                      <label htmlFor="orderReviewText" className="od-review-label">
                        Your Detailed Review
                      </label>

                      <textarea
                        id="orderReviewText"
                        className="od-review-textarea"
                        rows="3"
                        placeholder="Share what you liked most about the product quality, performance, and packaging..."
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        maxLength={2000}
                        disabled={reviewSubmitting}
                      />

                      <div className="od-review-char-row">
                        <span>
                          Posting as <strong>{getCustomerName()}</strong> • Min 5 chars
                        </span>
                        <span>{reviewText.length}/2000</span>
                      </div>
                    </div>

                    {/* Submit / Cancel Buttons */}
                    <div className="od-review-modal-actions">
                      <button
                        type="button"
                        className="od-review-btn od-review-btn-secondary"
                        onClick={() => {
                          if (existingProductReview && isEditingReview) {
                            setIsEditingReview(false);
                          } else {
                            closeReviewModal();
                          }
                        }}
                        disabled={reviewSubmitting}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="od-review-btn od-review-btn-primary"
                        disabled={
                          reviewSubmitting || reviewText.trim().length < 5
                        }
                      >
                        {reviewSubmitting ? (
                          <>
                            <FaSpinner className="fa-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <FaStar />
                            <span>
                              {existingProductReview?.$id
                                ? "Update Review"
                                : "Submit Review"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default OrderDetails;