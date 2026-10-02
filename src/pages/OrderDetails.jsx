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

  /* CANCEL */

  const [cancelPhase, setCancelPhase] =
    useState("none");

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

  const { activeProduct, activeProductIndex } = useMemo(() => {
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
  }, [location.search, location.state, order?.singleProduct, rawOrderItems]);

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
              "Unable to load shipment tracking from Appwrite."
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
    return (
      params.get("returnId") ||
      location.state?.returnRequest?.referenceId ||
      ""
    );
  }, [location.search, location.state]);

  const focusedReturnRequest = useMemo(() => {
    if (selectedReturnIdParam) {
      const matched = returnRequests.find(
        (r) =>
          String(r?.referenceId || "") === String(selectedReturnIdParam) ||
          String(r?.$id || "") === String(selectedReturnIdParam)
      );
      if (matched) return matched;
    }
    if (location.state?.returnRequest) {
      return location.state.returnRequest;
    }
    return null;
  }, [selectedReturnIdParam, returnRequests, location.state]);

  const isFocusedExchange =
    String(focusedReturnRequest?.type || "").toUpperCase() === "EXCHANGE";
  const isFocusedReturn =
    String(focusedReturnRequest?.type || "").toUpperCase() === "RETURN";
  const isFocusedReqCancelled =
    String(focusedReturnRequest?.status || "").toUpperCase() === "CANCELLED";



  /* STATUS */

  const shipmentStatus =
    normalizeStatus(
      shipment?.status
    );

  const orderDatabaseStatus =
    normalizeStatus(
      order?.status
    );

  /*
    IMPORTANT:
    Shipment status ALWAYS wins.
  */
  const currentStatus =
    shipmentStatus ||
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
    currentStatus ===
    "DELIVERED";

  const isItemCancelled =
    Boolean(activeProduct?.isCancelled) ||
    normalizeStatus(activeProduct?.status) === "CANCELLED";

  const isCancelled =
    isItemCancelled ||
    currentStatus === "CANCELLED" ||
    cancelPhase === "cancelled";

  const isDeliveryUnsuccessful = [
    "EXCEPTION",
    "DELIVERY_UNSUCCESSFUL",
    "UNDELIVERED",
    "FAILED",
    "RTO",
  ].includes(currentStatus);

  const isOutForDelivery =
    currentStatus ===
    "OUT_FOR_DELIVERY";

  const isDispatchedStage = [
    "DISPATCHED",
    "IN_TRANSIT",
    "REACHED_HUB",
    "OUT_FOR_DELIVERY",
  ].includes(currentStatus);

  const existingActiveRequest = useMemo(() => {
    return (
      returnRequests.find(
        (r) => String(r?.status || "").trim().toUpperCase() !== "CANCELLED"
      ) || null
    );
  }, [returnRequests]);

  const hasExistingReturnOrExchange = Boolean(existingActiveRequest);

  /* Cancel is available until the order is Packed */
  const canCancel =
    !isDelivered &&
    !isCancelled &&
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
      ? 0
      : Math.max(
          0,
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

  let actualRefundAmount;

  if (isPureCOD) {
    actualRefundAmount = 0;
  } else {
    let baseRefund =
      itemTotalPrice;

    if (
      rawOrderItems.length ===
      1
    ) {
      baseRefund = Math.max(
        0,
        totalPaid -
          platformFeeVal
      );
    }

    actualRefundAmount =
      isCodWithWallet
        ? Math.min(
            walletPaidVal,
            baseRefund
          )
        : baseRefund;
  }

  const refundToWallet =
    walletPaidVal > 0
      ? Math.min(
          walletPaidVal,
          actualRefundAmount
        )
      : 0;

  const refundToOnline =
    Math.max(
      0,
      actualRefundAmount -
        refundToWallet
    );

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
            } request (${req?.referenceId || "Request"}) was registered.`,
            date: reqRawDate,
            isCompleted: true,
            isCurrent: false,
          },
          {
            key: "REQ_CANCELLED",
            label: isReturn ? "Return Cancelled" : "Exchange Cancelled",
            description: `Your ${
              isReturn ? "return" : "exchange"
            } request has been cancelled.`,
            date: reqUpdatedRawDate,
            isCompleted: false,
            isCurrent: false,
            isCancelledStep: true,
          },
        ];
      }

      /* EXCHANGE TIMELINE: — 1. Exchange Created — 2. Exchange Accepted — 3. Confirmed — 4. Packed — 5. Dispatched — 6. Out for Exchange — 7. Exchange Complete */
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
              req?.reason ? ` Reason: ${req.reason}` : ""
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
            label: "Confirmed",
            description:
              stageIdx >= 2
                ? "Your replacement product order has been confirmed."
                : "Replacement order will be confirmed after approval.",
          },
          {
            key: "EX_PACKED",
            label: "Packed",
            description:
              stageIdx >= 3
                ? "Your replacement product has been packed and is ready for dispatch."
                : "Replacement product is being prepared for packing.",
          },
          {
            key: "EX_DISPATCHED",
            label: "Dispatched",
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
                ? "Replacement product is out for exchange with our delivery partner."
                : "Delivery partner will be assigned for exchange.",
          },
          {
            key: "EX_COMPLETE",
            label: "Exchange Complete",
            description: isAllExchangeDone
              ? "Your exchange has been completed successfully."
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

      /* RETURN TIMELINE: — 1. Return Created — 2. Return Accepted — 3. Out for Pickup / Refund Initiated — 4. Return Complete */
      const isStep2Done = [
        "ACCEPTED",
        "CONFIRMED",
        "APPROVED",
        "PICKUP_ASSIGNED",
        "PICKED_UP",
        "REFUND_INITIATED",
        "REFUND_COMPLETED",
        "REFUNDED",
        "COMPLETED",
      ].includes(requestStatus);

      const isStep3Done =
        refundStatus === "INITIATED" ||
        refundStatus === "COMPLETED" ||
        [
          "PICKUP_ASSIGNED",
          "PICKED_UP",
          "REFUND_INITIATED",
          "REFUND_COMPLETED",
          "REFUNDED",
          "COMPLETED",
        ].includes(requestStatus);

      const isStep4Done =
        refundStatus === "COMPLETED" ||
        ["REFUND_COMPLETED", "REFUNDED", "COMPLETED"].includes(requestStatus);

      return [
        {
          key: "REQ_CREATED",
          label: "Return Created",
          description: `Your return request (${
            req?.referenceId || "Request"
          }) has been placed successfully.${
            req?.reason ? ` Reason: ${req.reason}` : ""
          }`,
          date: reqRawDate,
          isCompleted: true,
          isCurrent: !isStep2Done,
        },
        {
          key: "REQ_ACCEPTED",
          label: "Return Accepted",
          description: isStep2Done
            ? "Your return request has been approved by TechStore."
            : "Awaiting approval and pickup confirmation from TechStore.",
          date: isStep2Done ? reqUpdatedRawDate : "",
          isCompleted: isStep2Done,
          isCurrent: isStep2Done && !isStep3Done,
        },
        {
          key: "REQ_PROCESS",
          label:
            requestStatus === "PICKUP_ASSIGNED"
              ? "Out for Pickup"
              : "Refund Initiated",
          description:
            requestStatus === "PICKUP_ASSIGNED"
              ? "Our delivery partner is out to pick up your return item."
              : refundAmount > 0
              ? `Refund of ₹${formatMoney(
                  refundAmount
                )} initiated to original payment mode (credited in 7-10 business days).`
              : "Refund will be initiated after pickup verification.",
          date: isStep3Done ? reqUpdatedRawDate : "",
          isCompleted: isStep3Done,
          isCurrent: isStep3Done && !isStep4Done,
        },
        {
          key: "REQ_COMPLETE",
          label: "Return Complete",
          description: isStep4Done
            ? "Your return and refund has been completed successfully."
            : `Expected completion by ${formatDate(expectedCompleteDate)}.`,
          date: isStep4Done ? expectedCompleteDate : "",
          isCompleted: isStep4Done,
          isCurrent: false,
        },
      ];
    },
    [
      actualRefundAmount,
      order?.orderDate,
      order?.$createdAt,
    ]
  );

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
      if (!shipment?.$id || currentStatus !== "OUT_FOR_DELIVERY") {
        if (currentStatus === "DELIVERED") {
          setDeliveryOtp("");
          setShowOtp(false);
          setOtpExpiresAt(null);
          setOtpTimeLeft(0);
        }
        return;
      }

      try {
        const activeDoc =
          await deliveryOtpService.getActiveOtpByShipmentId(
            shipment.$id
          );

        if (!cancelled && activeDoc) {
          const code = String(
            activeDoc.otp || activeDoc.otpCode || ""
          ).trim();
          if (code) {
            setDeliveryOtp(code);
            setOtpExpiresAt(activeDoc.expiresAt || null);
            setShowOtp(true);
            setOtpTimeLeft(999999);
          }
        }
      } catch (err) {
        console.warn("Active OTP load warning:", err);
      }
    };

    syncActiveOtp();

    return () => {
      cancelled = true;
    };
  }, [shipment?.$id, currentStatus, otpExpiresAt]);

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

  // eslint-disable-next-line no-unused-vars
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

      navigate(
        `/return-exchange/${encodeURIComponent(
          orderReference
        )}`
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
        setCancelPhase(
          "submitting"
        );

        toast.loading(
          "Processing cancellation request...",
          {
            id: "cancelToast",
          }
        );

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

        setOrder({
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
        });

        // Only cancel the whole shipment if all items in the order are cancelled
        if (allItemsCancelled && shipment?.$id) {
          try {
            await shipmentHelper.updateShipmentStatus(
              shipment.$id,
              "CANCELLED",
              {
                orderId:
                  shipment.orderId ||
                  order?.orderId ||
                  orderDocumentId,

                trackingId:
                  shipment.trackingId,

                title:
                  "Shipment Cancelled",

                description:
                  "This shipment was cancelled by the customer.",

                city:
                  shipment.destinationCity ||
                  order?.city ||
                  "",

                state:
                  shipment.destinationState ||
                  order?.state ||
                  "",
              }
            );

            await loadShipmentFromAppwrite(
              false
            );
          } catch (
            shipmentError
          ) {
            console.error(
              "Shipment cancellation error:",
              shipmentError
            );
          }
        }

        setCancelPhase(
          "cancelled"
        );

        toast.success(
          rawOrderItems.length > 1 && !allItemsCancelled
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
      await returnExchangeService.cancelRequest(focusedReturnRequest.$id);
      await loadReturnExchangeRequests();
      toast.success(
        `${isFocusedExchange ? "Exchange" : "Return"} request cancelled successfully.`
      );
    } catch (err) {
      toast.error(err?.message || "Unable to cancel request.");
    } finally {
      setCancelReturnLoading(false);
    }
  };

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
                  Order Details
                </h2>

                <span
                  className={`badge rounded-pill px-3 py-1 fw-bold fs-6 shadow-sm ${
                    focusedReturnRequest
                      ? isFocusedReqCancelled
                        ? "bg-danger text-white"
                        : isFocusedExchange
                        ? "bg-primary text-white"
                        : "bg-warning text-dark"
                      : isCancelled
                      ? "bg-danger text-white"
                      : cancelPhase ===
                        "submitting"
                      ? "bg-warning text-dark"
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
                    : cancelPhase ===
                      "submitting"
                    ? "Cancellation requested"
                    : isCancelled
                    ? "Cancelled"
                    : orderStatus}
                </span>

              </div>

              <small className="text-muted fw-medium">
                Your complete order
                summary
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
                className="badge bg-light text-primary border mb-2"
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

                  <span className="badge bg-danger-subtle text-danger">
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

        <section className="shipment-progress-section mb-4">
          <div className="shipment-progress-card glass-card hover-lift">
            {focusedReturnRequest ? (
              (() => {
                const rxSteps = buildReturnExchangeSteps(focusedReturnRequest);
                const rxRefId =
                  focusedReturnRequest.referenceId ||
                  `${isFocusedExchange ? "EX" : "RE"}-${getOrderReference(order)}-01`;
                const rxStatus = String(
                  focusedReturnRequest?.status || "REQUESTED"
                ).toUpperCase();
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
                          {`Live tracking • ${rxRefId}`}
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
                              ? "danger"
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
                            ? isFocusedExchange
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

                        <button
                          type="button"
                          className="shipment-progress-track-btn"
                          onClick={() => handleTrackReturn(focusedReturnRequest)}
                        >
                          <FaRoute className="me-1" />
                          Track
                        </button>
                      </div>
                    </div>

                    <div className="shipment-progress-timeline">
                      {rxSteps.map((step, index) => {
                        const nextStep = rxSteps[index + 1];
                        const isLastStep = index === rxSteps.length - 1;
                        return (
                          <div
                            className={`shipment-progress-step ${
                              step.isCancelledStep
                                ? "cancelled-step current"
                                : step.isCompleted
                                ? "completed"
                                : "pending"
                            } ${step.isCurrent ? "current" : ""}`}
                            key={step.key}
                          >
                            <div className="shipment-progress-marker-column">
                              <span
                                className={`shipment-progress-marker ${
                                  step.isCancelledStep ? "cancelled" : ""
                                }`}
                              >
                                {step.isCancelledStep ? (
                                  <FaTimes />
                                ) : step.isCompleted ? (
                                  <FaCheck />
                                ) : null}
                              </span>

                              {!isLastStep && (
                                <span
                                  className={`shipment-progress-line ${
                                    nextStep?.isCancelledStep
                                      ? "cancelled-line"
                                      : nextStep?.isCompleted
                                      ? "completed"
                                      : ""
                                  }`}
                                />
                              )}
                            </div>

                            <div className="shipment-progress-step-content">
                              <div className="shipment-progress-step-top">
                                <div>
                                  <h5 className="shipment-progress-step-title mb-1">
                                    {step.label}
                                  </h5>

                                  {!isLastStep && step.description ? (
                                    <p className="shipment-progress-step-description mb-0">
                                      {step.description}
                                    </p>
                                  ) : null}
                                </div>

                                {step.date ? (
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
                  </>
                );
              })()
            ) : isCancelled || cancelPhase === "submitting" ? (
              <>
                <div className="shipment-progress-head">
                  <div className="shipment-progress-head-left">
                    <h4 className="shipment-progress-title mb-1">
                      Shipment Progress
                    </h4>

                    <p className="shipment-progress-subtitle mb-0">
                      {shipment?.trackingId
                        ? `Live tracking • ${shipment.trackingId}`
                        : `Cancelled by you on ${cancelledFormattedDate}`}
                    </p>
                  </div>

                  <div className="shipment-progress-head-actions">
                    <span className="shipment-progress-status-pill danger">
                      <span className="shipment-progress-status-dot" />
                      {cancelPhase === "submitting" ? "Cancelling..." : "Cancelled"}
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
                      <span className="shipment-progress-line completed" />
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
                  <div className="shipment-progress-step completed">
                    <div className="shipment-progress-marker-column">
                      <span className="shipment-progress-marker">
                        <FaCheck />
                      </span>
                      <span className="shipment-progress-line cancelled-line" />
                    </div>

                    <div className="shipment-progress-step-content">
                      <div className="shipment-progress-step-top">
                        <div>
                          <h5 className="shipment-progress-step-title mb-1">
                            Cancellation requested
                          </h5>
                          <p className="shipment-progress-step-description mb-0">
                            You requested to cancel this order.
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
                  <div className="shipment-progress-step cancelled-step current">
                    <div className="shipment-progress-marker-column">
                      <span className="shipment-progress-marker cancelled">
                        <FaTimes />
                      </span>
                    </div>

                    <div className="shipment-progress-step-content">
                      <div className="shipment-progress-step-top">
                        <div>
                          <h5 className="shipment-progress-step-title mb-1">
                            Cancelled
                          </h5>
                          <p className="shipment-progress-step-description mb-0">
                            {cancellationTrackingEvent?.description ||
                              `Cancelled by you on ${cancelledFormattedDate}.`}
                          </p>
                        </div>

                        <div className="shipment-progress-date">
                          <strong>{cancelledFormattedDate}</strong>
                          <span>{cancelledFormattedTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
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
                        ? "Loading shipment from Appwrite..."
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
                        Fetching live shipment and event data from Appwrite.
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="shipment-progress-timeline">
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
                      const isWarningStep = Boolean(step.isUnsuccessful);
                      const isNextWarning = Boolean(nextStep?.isUnsuccessful);

                      return (
                        <div
                          className={`shipment-progress-step ${
                            isWarningStep
                              ? "cancelled-step current"
                              : step.isCompleted
                              ? "completed"
                              : "pending"
                          } ${step.isCurrent ? "current" : ""}`}
                          key={step.key}
                        >
                          <div className="shipment-progress-marker-column">
                            <span
                              className={`shipment-progress-marker ${
                                isWarningStep ? "cancelled" : ""
                              }`}
                            >
                              {isWarningStep ? (
                                <FaExclamationTriangle size={8} />
                              ) : step.isCompleted ? (
                                <FaCheck />
                              ) : null}
                            </span>

                            {index < trackingMilestones.length - 1 && (
                              <span
                                className={`shipment-progress-line ${
                                  isNextWarning && nextStep?.isCompleted
                                    ? "cancelled-line"
                                    : nextStep?.isCompleted
                                    ? "completed"
                                    : ""
                                }`}
                              />
                            )}
                          </div>

                          <div className="shipment-progress-step-content">
                            <div className="shipment-progress-step-top">
                              <div>
                                <h5 className="shipment-progress-step-title mb-1">
                                  {step.label}
                                </h5>

                                {step.description ? (
                                  <p className="shipment-progress-step-description mb-0">
                                    {step.description}
                                  </p>
                                ) : null}
                              </div>

                              {step.date ? (
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
                    className={`btn order-action-btn ${
                      hasExistingReturnOrExchange
                        ? "order-action-btn-disabled"
                        : "order-action-btn-return"
                    }`}
                    onClick={handleReturnExchange}
                    disabled={hasExistingReturnOrExchange}
                  >
                    <FaExchangeAlt className="flex-shrink-0" />
                    <span>
                      {hasExistingReturnOrExchange
                        ? String(existingActiveRequest?.type || "").toUpperCase() ===
                          "EXCHANGE"
                          ? "Exchange Requested"
                          : "Return Requested"
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
                    canCancel
                      ? "order-action-btn-cancel"
                      : "order-action-btn-disabled"
                  }`}
                  onClick={handleCancel}
                  disabled={
                    !canCancel ||
                    cancelPhase !== "none"
                  }
                >
                  {cancelPhase === "submitting" ? (
                    <>
                      <FaSpinner className="fa-spin flex-shrink-0" />
                      <span>Cancelling Product...</span>
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

        {/* REFUND */}

        {(isCancelled || isFocusedReturn) && (
          <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift order-refund-card">

            {isPureCOD ? (
              <div>

                <h4 className="fw-bold mb-3">
                  Refund Details
                </h4>

                <p className="text-muted mb-0">
                  No refund is involved
                  as the order was a
                  Cash on Delivery
                  order.
                </p>

              </div>
            ) : (
              <div>

                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">

                  <h4 className="fw-bold mb-0">
                    Total Refund ₹
                    {formatMoney(
                      actualRefundAmount
                    )}
                  </h4>

                </div>

                <p className="text-muted mb-4">
                  Refund has been initiated on{" "}
                  {formatFullDayDate(cancelledRawDate)}, the amount should get
                  credited in 7-10 business days.
                </p>

                <h6 className="fw-bold mb-3">
                  Refund Credit Mode
                </h6>

                {refundToWallet >
                  0 && (
                  <div className="d-flex justify-content-between mb-2">

                    <span className="text-muted d-inline-flex align-items-center gap-2">
                      <FaWallet className="text-primary" />
                      TechStore Wallet
                    </span>

                    <strong>
                      ₹
                      {formatMoney(
                        refundToWallet
                      )}
                    </strong>

                  </div>
                )}

                {refundToOnline >
                  0 && (
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

                    <strong>
                      ₹
                      {formatMoney(
                        refundToOnline
                      )}
                    </strong>

                  </div>
                )}

                <hr />

                <div className="d-flex justify-content-between fw-bold fs-5">

                  <span>Total</span>

                  <span>
                    ₹
                    {formatMoney(
                      actualRefundAmount
                    )}
                  </span>

                </div>

              </div>
            )}

          </div>
        )}

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
                        setOrder(
                          (
                            previous
                          ) => ({
                            ...previous,
                            singleProduct:
                              item,
                          })
                        );

                        window.scrollTo(
                          {
                            top: 0,
                            behavior:
                              "smooth",
                          }
                        );
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
                        rows="4"
                        placeholder="Share what you liked most about the product quality, performance, and packaging..."
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        maxLength={2000}
                        disabled={reviewSubmitting}
                      />

                      <div className="od-review-char-row">
                        <span>Minimum 5 characters</span>
                        <span>{reviewText.length}/2000</span>
                      </div>
                    </div>

                    {/* Reviewer Identity Box */}
                    <div className="od-review-identity-bar">
                      <div className="od-review-identity-avatar">
                        {getCustomerName().charAt(0).toUpperCase()}
                      </div>
                      <div className="od-review-identity-info">
                        <strong>Posting as {getCustomerName()}</strong>
                        <span>
                          {getCustomerEmail() || "Verified TechStore Customer"}
                        </span>
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