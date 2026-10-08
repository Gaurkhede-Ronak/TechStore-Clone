import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  FaBoxOpen,
  FaTimes,
  FaCheckCircle,
  FaTruck,
  FaRoute,
  FaCheck,
  FaCreditCard,
  FaSyncAlt,
} from "react-icons/fa";

import toast from "react-hot-toast";
import "../css/OrderDetailsPage.css";

/* STATUS */

const STATUS_MAP = {
  PLACED: "Placed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  REACHED_HUB: "Reached Hub",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  EXCEPTION: "Exception",
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

const formatTime = (value) =>
  getDate(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const formatDateTime = (value) =>
  `${formatDate(value)}, ${formatTime(value)}`;

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* COMPONENT */

function OrderDetails() {
  const navigate = useNavigate();
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
  const [originWarehouse, setOriginWarehouse] =
    useState(null);

  const [shipmentLoading, setShipmentLoading] =
    useState(true);

  const [trackingLoading, setTrackingLoading] =
    useState(false);

  const [trackingError, setTrackingError] =
    useState("");

  /* RETURN / EXCHANGE */

  const [returnRequests, setReturnRequests] =
    useState([]);

  const [returnRequestLoading, setReturnRequestLoading] =
    useState(false);

  /* CANCEL */

  const [cancelPhase, setCancelPhase] =
    useState("none");

  const [timeLeft, setTimeLeft] = useState(60);

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

  const activeProduct =
    order?.singleProduct ||
    rawOrderItems[0] ||
    {};

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
    useCallback(async () => {
      const orderReference =
        getOrderReference(order);

      if (!orderReference) {
        setReturnRequests([]);
        return;
      }

      try {
        setReturnRequestLoading(
          true
        );

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
        setReturnRequestLoading(
          false
        );
      }
    }, [order]);

  useEffect(() => {
    if (!order) return;

    loadReturnExchangeRequests();

    const timer =
      setInterval(() => {
        loadReturnExchangeRequests();
      }, 10000);

    return () =>
      clearInterval(timer);
  }, [
    order,
    loadReturnExchangeRequests,
  ]);

  /* CANCELLATION TIMER */

  useEffect(() => {
    if (
      !order?.orderDate &&
      !order?.$createdAt
    ) {
      return;
    }

    const calculateTimeLeft =
      () => {
        const orderTime =
          new Date(
            order.orderDate ||
              order.$createdAt
          ).getTime();

        const difference =
          Math.floor(
            (
              60 * 1000 -
              (Date.now() -
                orderTime)
            ) / 1000
          );

        setTimeLeft(
          difference > 0
            ? difference
            : 0
        );
      };

    calculateTimeLeft();

    const timer =
      setInterval(
        calculateTimeLeft,
        1000
      );

    return () =>
      clearInterval(timer);
  }, [
    order?.orderDate,
    order?.$createdAt,
  ]);

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

  const orderStatus =
    STATUS_MAP[
      currentStatus
    ] ||
    currentStatus ||
    "Placed";

  const isDelivered =
    currentStatus ===
    "DELIVERED";

  const isCancelled =
    currentStatus ===
      "CANCELLED" ||
    cancelPhase ===
      "cancelled" ||
    Boolean(
      activeProduct?.isCancelled
    );

  const isOutForDelivery =
    currentStatus ===
    "OUT_FOR_DELIVERY";

  const canCancel =
    timeLeft > 0 &&
    !isDelivered &&
    !isCancelled &&
    currentStatus ===
      "PLACED";

  /* PRODUCT HELPERS */

  const getProductId = (
    product
  ) =>
    String(
      product?.productId ||
        product?.$id ||
        product?.id ||
        ""
    );

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

  const originalPlacedDate =
    formatDate(
      order?.orderDate ||
        order?.$createdAt
    );

  const originalPlacedTime =
    formatTime(
      order?.orderDate ||
        order?.$createdAt
    );

  const cancelledFormattedDate =
    formatDate(
      activeProduct?.cancelledDate ||
        order?.cancelledDate ||
        new Date()
    );

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

  const storedGst =
    Number(order?.gst ?? 0);

  const gstVal =
    storedGst > 0
      ? storedGst
      : Number(
          (
            (subTotalVal * 18) /
            118
          ).toFixed(2)
        );

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

  const calculatedGrandTotal =
    Math.max(
      0,
      subTotalVal +
        shippingVal +
        (gstApplied ? 0 : storedGst) +
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

  // Payment state helpers used by the refund section.
  // COD amount is only due on delivery; it is not counted as paid before delivery.
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

  const balanceDue =
    Math.max(
      0,
      orderGrandTotal -
        totalPaidVal
    );

  // Backward-compatible alias used by the existing
  // refund/share logic below.
  const totalPaid = totalPaidVal;

  const payableAmount =
    isCOD
      ? codDueAmount
      : externalPaymentAmount;

  const paymentDisplayName =
    isCOD
      ? "Cash on Delivery"
      : isUPI
      ? "UPI"
      : isCard
      ? "Debit / Credit Card"
      : rawPaymentMethod ||
        "Online Payment";

  const paymentMethodLabel =
    walletPaidVal > 0
      ? `${paymentDisplayName} + Wallet`
      : paymentDisplayName;

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

  /* REFRESH TRACKING */

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
    if (currentStatus === "DELIVERED") {
      setDeliveryOtp("");
      setShowOtp(false);
      setOtpExpiresAt(null);
      setOtpTimeLeft(0);
    } else if (otpExpiresAt) {
      setOtpTimeLeft(999999);
    }
  }, [otpExpiresAt, currentStatus]);

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

      setReviewRating(5);
      setReviewText("");
      setReviewSubmitted(false);
      setReviewModalOpen(true);
    };

  const closeReviewModal =
    () => {
      if (reviewSubmitting) {
        return;
      }

      setReviewModalOpen(false);
      setReviewProduct(null);
      setReviewRating(5);
      setReviewText("");
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

        await reviewService.createReview(
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

        setReviewSubmitted(
          true
        );

        setReviewText("");
        setReviewRating(5);

        toast.success(
          "Review submitted successfully â­"
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
        `Total Amount: â‚¹${formatMoney(
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

      navigate(
        "/invoice",
        {
          state: order,
        }
      );
    };

  /* RETURN / EXCHANGE */

  const handleReturnExchange =
    () => {
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

      if (request?.referenceId) {
        params.set(
          "returnId",
          request.referenceId
        );
      }

      navigate(
        `/track-order?${params.toString()}`
      );
    };

  /* CANCEL */

  const handleCancel =
    async () => {
      if (!canCancel) {
        toast.error(
          "1-minute cancellation window has expired!"
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

        const updatedItems =
          rawOrderItems.map(
            (item) => {
              const isCurrentProduct =
                (
                  item?.id &&
                  item.id ===
                    activeProduct?.id
                ) ||
                (
                  item?.productId &&
                  item.productId ===
                    activeProduct?.productId
                ) ||
                (
                  item?.title &&
                  item.title ===
                    activeProduct?.title
                );

              if (
                isCurrentProduct
              ) {
                return {
                  ...item,
                  status:
                    "Cancelled",
                  isCancelled:
                    true,
                  cancelledDate:
                    cancelTimeISO,
                };
              }

              return item;
            }
          );

        const updatedSingleProduct =
          {
            ...activeProduct,
            status:
              "Cancelled",
            isCancelled:
              true,
            cancelledDate:
              cancelTimeISO,
          };

        const updatedOrder =
          await orderService.updateOrder(
            orderDocumentId,
            {
              status:
                "Cancelled",
            }
          );

        setOrder({
          ...order,
          ...updatedOrder,
          items:
            updatedItems,
          singleProduct:
            updatedSingleProduct,
          status:
            "Cancelled",
          cancelledDate:
            cancelTimeISO,
        });

        if (shipment?.$id) {
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
          "Order Cancelled Successfully",
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
            "Unable to cancel order.",
          {
            id: "cancelToast",
          }
        );
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

        <div className="pro-card p-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3 glass-card hover-lift">

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
                    isCancelled
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
                  {cancelPhase ===
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

        {/* ORDER INFO */}

        <div className="pro-card p-4 mb-4 glass-card hover-lift">
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
        </div>

        {/* PRODUCT */}

        <div className="pro-card p-4 mb-4 glass-card hover-lift">

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">

            <div>
              <small className="text-muted d-block mb-1">
                Product
              </small>

              <h5 className="fw-bold mb-0">
                {itemName}
              </h5>
            </div>

            <div>
              {isCancelled ? (
                <span className="badge bg-danger rounded-pill px-3 py-2">
                  Cancelled
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

          <div className="d-flex align-items-center gap-3 flex-wrap">

            <img
              src={itemImage}
              alt={itemName}
              referrerPolicy="no-referrer"
              style={{
                width: "90px",
                height: "90px",
                objectFit: "cover",
                borderRadius: "16px",
              }}
              className="shadow-sm border"
              onError={(e) => {
                e.currentTarget.onerror =
                  null;

                e.currentTarget.src =
                  "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";
              }}
            />

            <div className="flex-grow-1">

              <span
                className="badge bg-light text-primary border mb-2"
                style={{
                  fontSize: "10px",
                }}
              >
                {activeProduct?.brand ||
                  "TechStore"}
              </span>

              <h5 className="fw-bold mb-1">
                {itemName}
              </h5>

              <small className="text-muted">
                Quantity:{" "}
                <strong className="text-dark">
                  {itemQty}
                </strong>
              </small>

            </div>

            <div className="text-end">

              <h4 className="fw-bold mb-0">
                â‚¹
                {formatMoney(
                  activeItemSellingPrice *
                    itemQty
                )}
              </h4>

              {activeItemDiscountPercent >
                0 && (
                <div className="mt-1">
                  <span className="text-muted text-decoration-line-through me-2">
                    â‚¹
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
        </div>

        {/* TOP HERO SHIPMENT BANNER (Image 1) */}

        <div className="order-shipment-hero-banner mb-3">
          <div className="banner-top-row">
            <div className="banner-left-info">
              <div className="banner-truck-icon">
                <FaTruck />
              </div>
              <div>
                <span className="banner-label">Shipment</span>
                <h4 className="banner-title">Track your shipment</h4>
                <p className="banner-subtitle">
                  {shipment?.trackingId
                    ? `Tracking ID: ${shipment.trackingId}`
                    : "Tracking information will appear when shipment is created."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="banner-track-btn"
              onClick={() => {
                const el = document.getElementById("shipment-progress-section");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <FaTruck className="me-2" /> Track Shipment
            </button>
          </div>
          <div className="banner-divider" />
          <div className="banner-bottom-row">
            <span className="banner-status-label">Current Shipment Status</span>
            <span className="banner-status-value">
              {STATUS_MAP[currentStatus] || currentStatus || "Placed"}
            </span>
          </div>
        </div>

        {/* CANCEL PRODUCT COUNTDOWN STRIP (Image 1) */}

        <div className="order-cancel-strip-card mb-4">
          {!isCancelled && !isDelivered ? (
            canCancel ? (
              <button
                type="button"
                className="order-cancel-countdown-btn"
                onClick={handleCancel}
                disabled={cancelPhase !== "none"}
              >
                {cancelPhase === "submitting" ? (
                  <>
                    <FaSpinner className="fa-spin me-2" /> Cancelling Product...
                  </>
                ) : (
                  `Cancel Product (${timeLeft}s)`
                )}
              </button>
            ) : (
              <div className="order-cancel-disabled-pill">
                Cancellation Not Available
              </div>
            )
          ) : isCancelled ? (
            <div className="order-cancel-disabled-pill text-danger">
              Order Cancelled
            </div>
          ) : (
            <div className="order-cancel-disabled-pill text-success">
              Order Delivered
            </div>
          )}
        </div>

        {/* SHIPMENT PROGRESS CARD (Image 2) */}

        <div id="shipment-progress-section" className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift">
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h4 className="fw-bold mb-0 text-dark">Shipment Progress</h4>
            {isCancelled ? (
              <span className="text-danger fw-bold fs-6">
                Cancelled on {cancelledFormattedDate}
              </span>
            ) : isDelivered ? (
              <span className="text-success fw-bold fs-6">
                Delivered on {formatDate(shipment?.deliveredAt || order?.deliveredDate || new Date())}
              </span>
            ) : (
              <span className="text-muted fw-semibold">
                {shipment?.estimatedDeliveryDate
                  ? `Arriving ${formatDate(shipment.estimatedDeliveryDate)}`
                  : "Shipment in progress"}
              </span>
            )}
          </div>

          <div className="custom-shipment-stepper mb-4">
            {isCancelled ? (
              <div className="stepper-vertical-list">
                <div className="stepper-item">
                  <div className="stepper-marker dot-green" />
                  <div className="stepper-line-dotted" />
                  <div className="stepper-text">
                    <strong className="d-block text-dark">Confirmed</strong>
                    <small className="text-muted">{originalPlacedDate}</small>
                  </div>
                </div>
                <div className="stepper-item">
                  <div className="stepper-marker dot-yellow" />
                  <div className="stepper-line-dotted" />
                  <div className="stepper-text">
                    <strong className="d-block text-dark">Cancelation requested</strong>
                    <small className="text-muted">{cancelledFormattedDate}</small>
                  </div>
                </div>
                <div className="stepper-item is-last">
                  <div className="stepper-marker dot-red" />
                  <div className="stepper-text">
                    <strong className="d-block text-danger">Cancelled</strong>
                    <small className="text-muted">{cancelledFormattedDate}</small>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stepper-vertical-list">
                <div className="stepper-item">
                  <div className="stepper-marker dot-green" />
                  <div className="stepper-line-dotted" />
                  <div className="stepper-text">
                    <strong className="d-block text-dark">Confirmed</strong>
                    <small className="text-muted">{originalPlacedDate}</small>
                  </div>
                </div>
                <div className="stepper-item">
                  <div className={`stepper-marker ${currentStatus === "PLACED" ? "dot-yellow" : "dot-green"}`} />
                  <div className="stepper-line-dotted" />
                  <div className="stepper-text">
                    <strong className="d-block text-dark">
                      {currentStatus === "PLACED" ? "Processing Shipment" : (STATUS_MAP[currentStatus] || "In Transit")}
                    </strong>
                    <small className="text-muted">
                      {shipment?.updatedAt ? formatDateTime(shipment.updatedAt) : originalPlacedDate}
                    </small>
                  </div>
                </div>
                <div className="stepper-item is-last">
                  <div className={`stepper-marker ${isDelivered ? "dot-green" : "dot-grey"}`} />
                  <div className="stepper-text">
                    <strong className={`d-block ${isDelivered ? "text-success" : "text-muted"}`}>
                      {isDelivered ? "Delivered" : "Delivery"}
                    </strong>
                    <small className="text-muted">
                      {isDelivered
                        ? formatDate(shipment?.deliveredAt || new Date())
                        : shipment?.estimatedDeliveryDate
                        ? formatDate(shipment.estimatedDeliveryDate)
                        : "Expected soon"}
                    </small>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="courier-partner-grey-card mb-4 p-3 rounded-3 border">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <small className="text-muted d-block" style={{ fontSize: "12px" }}>Courier Partner</small>
                <strong className="courier-partner-name text-dark fw-bold">
                  {shipment?.courier || shipment?.courierPartner || "TECHSONEX"}
                </strong>
              </div>
              <div className="text-end">
                <small className="text-muted d-block" style={{ fontSize: "12px" }}>Tracking ID</small>
                <div className="d-flex align-items-center gap-2">
                  <strong className="font-monospace tracking-code-val text-dark fw-bold">
                    {shipment?.trackingId || order?.trackingNumber || "TX3777084964AJP"}
                  </strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border p-1 rounded d-flex align-items-center justify-content-center"
                    style={{ width: "26px", height: "26px", cursor: "pointer" }}
                    title="Copy Tracking ID"
                    onClick={() => {
                      const tid = shipment?.trackingId || order?.trackingNumber || "TX3777084964AJP";
                      navigator.clipboard.writeText(tid);
                      toast.success("Tracking ID copied!");
                    }}
                  >
                    ðŸ“‹
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="shipment-progress-actions-row d-flex gap-3 flex-wrap">
            <button
              type="button"
              className="btn btn-dark fw-bold px-4 py-3 d-flex align-items-center justify-content-center gap-2 flex-grow-1"
              style={{ background: "#111827", borderRadius: "10px" }}
              onClick={() => {
                const liveEl = document.getElementById("appwrite-live-tracking-card");
                if (liveEl) liveEl.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <FaTruck /> Track Shipment
            </button>

            {isDelivered ? (
              <div className="d-flex gap-2 flex-grow-1 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-dark fw-bold px-4 py-3 d-flex align-items-center justify-content-center gap-2 flex-grow-1"
                  style={{ borderRadius: "10px" }}
                  onClick={handleReviewProducts}
                >
                  <FaStar className="text-warning" /> Review Product
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold px-4 py-3 d-flex align-items-center justify-content-center gap-2 flex-grow-1"
                  style={{ borderRadius: "10px" }}
                  onClick={handleReturnExchange}
                >
                  <FaExchangeAlt /> Return / Exchange
                </button>
              </div>
            ) : canCancel ? (
              <button
                type="button"
                className="btn btn-outline-danger fw-bold px-4 py-3 d-flex align-items-center justify-content-center gap-2 flex-grow-1"
                style={{ borderRadius: "10px" }}
                onClick={handleCancel}
                disabled={cancelPhase !== "none"}
              >
                {cancelPhase === "submitting" ? (
                  <FaSpinner className="fa-spin" />
                ) : null}
                Cancel Product ({timeLeft}s)
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline-secondary fw-bold px-4 py-3 d-flex align-items-center justify-content-center gap-2 flex-grow-1"
                style={{ borderRadius: "10px", opacity: 0.7, cursor: "not-allowed" }}
                disabled
              >
                Cancellation Not Available
              </button>
            )}
          </div>
        </div>

        {/* APPWRITE SHIPMENT TRACKING — Replaces the old "Track Shipment" CTA. — Everything below is live from Appwrite: — shipment document + shipment events + warehouse. */}

        <section id="appwrite-live-tracking-card" className="order-tracking-card glass-card hover-lift mb-4">
          <div className="order-tracking-header">
            <div className="order-tracking-title-wrap">
              <div className="order-tracking-icon">
                <FaTruck />
              </div>

              <div>
                <h5 className="order-tracking-title mb-1">
                  Shipment Progress
                </h5>

                <p className="order-tracking-subtitle mb-0">
                  {shipment?.trackingId
                    ? `Live tracking • ${shipment.trackingId}`
                    : shipmentLoading
                    ? "Connecting to live shipment..."
                    : "Shipment tracking information"}
                </p>
              </div>
            </div>

            <div className="order-tracking-status-wrap">
              <span
                className={`order-tracking-status ${
                  currentStatus === "DELIVERED"
                    ? "is-success"
                    : currentStatus === "CANCELLED"
                    ? "is-danger"
                    : currentStatus === "OUT_FOR_DELIVERY"
                    ? "is-warning"
                    : "is-primary"
                }`}
              >
                <span className="order-tracking-status-dot" />
                {STATUS_MAP[currentStatus] || currentStatus}
              </span>

              {shipment?.updatedAt && (
                <small className="order-tracking-updated">
                  Updated {formatDateTime(shipment.updatedAt)}
                </small>
              )}
            </div>
          </div>

          <div className="order-tracking-body">
            {shipmentLoading && !shipment ? (
              <div className="order-tracking-loading">
                <div className="order-tracking-spinner">
                  <FaSpinner className="fa-spin" />
                </div>
                <div>
                  <strong>Loading shipment tracking...</strong>
                  <small>Fetching live shipment events.</small>
                </div>
              </div>
            ) : !shipment ? (
              <div className="order-tracking-empty">
                <div className="order-tracking-empty-icon">
                  <FaBoxOpen />
                </div>
                <h6>Tracking Not Available Yet</h6>
                <p>
                  {trackingError ||
                    "A shipment will appear here automatically once the order is dispatched."}
                </p>
              </div>
            ) : (
              <>
                <div className="order-tracking-timeline">
                  {shipmentEvents.length > 0 ? (
                    [...shipmentEvents]
                      .sort((a, b) => {
                        const aTime = new Date(
                          a?.timestamp ||
                            a?.createdAt ||
                            a?.$createdAt ||
                            0
                        ).getTime();

                        const bTime = new Date(
                          b?.timestamp ||
                            b?.createdAt ||
                            b?.$createdAt ||
                            0
                        ).getTime();

                        return bTime - aTime;
                      })
                      .map((event, index) => {
                        const eventStatus = normalizeStatus(
                          event?.status
                        );

                        const eventIsLatest = index === 0;
                        const eventIsCancelled =
                          eventStatus === "CANCELLED";

                        const eventLabel =
                          event?.title ||
                          STATUS_MAP[eventStatus] ||
                          event?.status ||
                          "Shipment Update";

                        const eventDate =
                          event?.timestamp ||
                          event?.createdAt ||
                          event?.$createdAt;

                        return (
                          <div
                            className={`order-tracking-event ${
                              eventIsLatest
                                ? "is-current"
                                : ""
                            } ${
                              eventIsCancelled
                                ? "is-cancelled"
                                : ""
                            }`}
                            key={
                              event?.$id ||
                              `${eventStatus}-${index}`
                            }
                          >
                            <div className="order-tracking-event-rail">
                              <span className="order-tracking-event-dot">
                                {eventIsCancelled ? (
                                  <FaTimes />
                                ) : eventIsLatest ? (
                                  <FaCheck />
                                ) : (
                                  <span />
                                )}
                              </span>
                            </div>

                            <div className="order-tracking-event-content">
                              <div className="order-tracking-event-top">
                                <div>
                                  <h6 className="order-tracking-event-title">
                                    {eventLabel}
                                  </h6>

                                  {event?.description && (
                                    <p className="order-tracking-event-description">
                                      {event.description}
                                    </p>
                                  )}
                                </div>

                                {eventDate && (
                                  <div className="order-tracking-event-date">
                                    <strong>
                                      {formatDate(eventDate)}
                                    </strong>
                                    <span>
                                      {formatTime(eventDate)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {(event?.city ||
                                event?.state) && (
                                <div className="order-tracking-event-location">
                                  <FaMapMarkerAlt />
                                  <span>
                                    {event.city || ""}
                                    {event.city &&
                                    event.state
                                      ? ", "
                                      : ""}
                                    {event.state || ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="order-tracking-stepper">
                      {[
                        "PLACED",
                        "PACKED",
                        "DISPATCHED",
                        "IN_TRANSIT",
                        "REACHED_HUB",
                        "OUT_FOR_DELIVERY",
                        "DELIVERED",
                      ].map((stepStatus) => {
                        const stepIndex =
                          {
                            PLACED: 0,
                            PACKED: 1,
                            DISPATCHED: 2,
                            IN_TRANSIT: 3,
                            REACHED_HUB: 4,
                            OUT_FOR_DELIVERY: 5,
                            DELIVERED: 6,
                          }[stepStatus];

                        const isCompleted =
                          currentStatus ===
                            "CANCELLED"
                            ? false
                            : eventStepMapFallback(
                                currentStatus
                              ) >= stepIndex;

                        const isCurrent =
                          currentStatus ===
                          stepStatus;

                        return (
                          <div
                            className={`order-tracking-step ${
                              isCompleted
                                ? "is-completed"
                                : ""
                            } ${
                              isCurrent
                                ? "is-current"
                                : ""
                            }`}
                            key={stepStatus}
                          >
                            <div className="order-tracking-step-rail">
                              <span className="order-tracking-step-dot">
                                {isCompleted ? (
                                  <FaCheck />
                                ) : (
                                  <span />
                                )}
                              </span>
                            </div>

                            <div className="order-tracking-step-content">
                              <h6>
                                {STATUS_MAP[stepStatus]}
                              </h6>

                              <small>
                                {isCurrent
                                  ? "Current shipment status"
                                  : isCompleted
                                  ? "Completed"
                                  : "Pending"}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="order-tracking-info-grid">
                  <div className="order-tracking-info-card">
                    <div className="order-tracking-info-icon courier">
                      <FaTruck />
                    </div>

                    <div>
                      <small>Courier Partner</small>
                      <strong>
                        {shipment.courier ||
                          "Standard Delivery"}
                      </strong>

                      <span>
                        Code:{" "}
                        {shipment.courierCode ||
                          "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="order-tracking-info-card">
                    <div className="order-tracking-info-icon tracking">
                      <FaRoute />
                    </div>

                    <div>
                      <small>Tracking ID</small>
                      <strong className="font-monospace">
                        {shipment.trackingId ||
                          "Pending"}
                      </strong>

                      <span>
                        {STATUS_MAP[
                          normalizeStatus(
                            shipment.status
                          )
                        ] ||
                          shipment.status ||
                          "Processing"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="order-tracking-route">
                  <div className="order-tracking-route-point">
                    <span className="order-tracking-route-icon origin">
                      <FaMapMarkerAlt />
                    </span>

                    <div>
                      <small>Origin Warehouse</small>
                      <strong>
                        {originWarehouse?.name ||
                          shipment.originCity ||
                          "Warehouse"}
                      </strong>

                      <span>
                        {originWarehouse?.city ||
                          shipment.originCity ||
                          "Hub"}
                        {(originWarehouse?.state ||
                          shipment.originState) &&
                          `, ${
                            originWarehouse?.state ||
                            shipment.originState
                          }`}
                      </span>
                    </div>
                  </div>

                  <div className="order-tracking-route-line">
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="order-tracking-route-point">
                    <span className="order-tracking-route-icon destination">
                      <FaMapMarkerAlt />
                    </span>

                    <div>
                      <small>Destination</small>
                      <strong>
                        {shipment.destinationCity ||
                          order?.city ||
                          "Customer City"}
                      </strong>

                      <span>
                        {shipment.destinationState ||
                          order?.state ||
                          "State"}
                        {(shipment.destinationPincode ||
                          order?.pincode) &&
                          ` - ${
                            shipment.destinationPincode ||
                            order?.pincode
                          }`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="order-tracking-footer">
                  <div>
                    <span className="order-tracking-live-dot" />
                    <span>
                      Live shipment data
                    </span>
                  </div>

                  <button
                    type="button"
                    className="order-tracking-refresh"
                    onClick={refreshTracking}
                    disabled={trackingLoading}
                  >
                    <FaSyncAlt
                      className={
                        trackingLoading
                          ? "fa-spin"
                          : ""
                      }
                    />
                    {trackingLoading
                      ? "Refreshing..."
                      : "Refresh Tracking"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RETURN / EXCHANGE STATUS */}

        {returnRequests.length >
          0 && (
          <div className="pro-card p-4 mb-4 glass-card hover-lift">

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">

              <div>
                <h5 className="fw-bold mb-1">
                  Return / Exchange Request
                </h5>

                <small className="text-muted">
                  Live status
                </small>
              </div>

              {returnRequestLoading && (
                <FaSpinner className="fa-spin text-secondary" />
              )}

            </div>

            {returnRequests.map(
              (request) => {
                const requestStatus =
                  String(
                    request?.status ||
                      "REQUESTED"
                  ).toUpperCase();

                const paymentRefund =
                  request?.paymentRefund ||
                  {};

                const refundStatus =
                  String(
                    request?.refundStatus ||
                      paymentRefund?.refundStatus ||
                      ""
                  ).toUpperCase();

                const refundAmount =
                  Number(
                    request?.refundAmount ??
                      paymentRefund?.refundAmount ??
                      0
                  );

                const isReturn =
                  String(
                    request?.type ||
                      ""
                  ).toUpperCase() ===
                  "RETURN";

                const statusClass =
                  requestStatus ===
                    "CONFIRMED" ||
                  requestStatus ===
                    "REFUNDED"
                    ? "bg-success-subtle text-success"
                    : requestStatus ===
                      "CANCELLED"
                    ? "bg-danger-subtle text-danger"
                    : "bg-warning-subtle text-warning-emphasis";

                const statusText =
                  requestStatus ===
                  "REQUESTED"
                    ? "Request Submitted"
                    : requestStatus ===
                      "CONFIRMED"
                    ? "Request Confirmed"
                    : requestStatus ===
                      "CANCELLED"
                    ? "Request Cancelled"
                    : requestStatus ===
                      "PICKED_UP"
                    ? "Picked Up"
                    : requestStatus ===
                      "REFUND_INITIATED"
                    ? "Refund Initiated"
                    : requestStatus ===
                      "REFUNDED"
                    ? "Refund Completed"
                    : requestStatus;

                return (
                  <div
                    key={
                      request.$id ||
                      request.referenceId
                    }
                    className="border rounded-4 p-3 mb-3"
                  >

                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">

                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">

                          <strong>
                            {isReturn
                              ? "Return"
                              : "Exchange"}
                          </strong>

                          <span className="badge bg-light text-dark border">
                            {request.referenceId ||
                              "Request"}
                          </span>

                        </div>

                        <small className="text-muted">
                          Requested on{" "}
                          {formatDate(
                            request.createdAt ||
                              request.$createdAt
                          )}
                        </small>
                      </div>

                      <span
                        className={`badge rounded-pill px-3 py-2 ${statusClass}`}
                      >
                        {statusText}
                      </span>

                    </div>

                    {request.reason && (
                      <div className="mt-3 small text-muted">
                        <strong>
                          Reason:
                        </strong>{" "}
                        {request.reason}
                      </div>
                    )}

                    {requestStatus ===
                      "CONFIRMED" && (
                      <div className="alert alert-success rounded-4 mt-3 mb-0">
                        <FaCheckCircle className="me-2" />
                        Your{" "}
                        {isReturn
                          ? "return"
                          : "exchange"}{" "}
                        request has been confirmed by TechStore.
                      </div>
                    )}

                    {requestStatus ===
                      "CANCELLED" && (
                      <div className="alert alert-danger rounded-4 mt-3 mb-0">
                        <FaTimes className="me-2" />
                        Your{" "}
                        {isReturn
                          ? "return"
                          : "exchange"}{" "}
                        request has been cancelled.
                      </div>
                    )}

                    {refundStatus ===
                      "INITIATED" && (
                      <div className="alert alert-info rounded-4 mt-3 mb-0">
                        Refund Initiated
                        {refundAmount > 0
                          ? ` â€” â‚¹${formatMoney(
                              refundAmount
                            )}`
                          : ""}
                      </div>
                    )}

                    {refundStatus ===
                      "COMPLETED" && (
                      <div className="alert alert-success rounded-4 mt-3 mb-0">
                        Refund Completed
                        {refundAmount > 0
                          ? ` â€” â‚¹${formatMoney(
                              refundAmount
                            )}`
                          : ""}
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-outline-dark btn-sm mt-3"
                      onClick={() =>
                        handleTrackReturn(
                          request
                        )
                      }
                    >
                      <FaRoute className="me-2" />
                      Track Request
                    </button>

                  </div>
                );
              }
            )}

          </div>
        )}

        {/* ACTIONS */}

        {!isCancelled && (
          <div className="pro-card p-4 mb-4 glass-card hover-lift">

            {isDelivered ? (
              <div className="d-flex gap-2 flex-wrap">

                <button
                  className="btn btn-outline-dark flex-fill d-flex align-items-center justify-content-center gap-2"
                  onClick={
                    handleReviewProducts
                  }
                >
                  <FaStar className="text-warning" />
                  Review Product
                </button>

                <button
                  className="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2"
                  onClick={
                    handleReturnExchange
                  }
                >
                  <FaExchangeAlt />
                  Return / Exchange
                </button>

              </div>
            ) : (
              <button
                className={`w-100 btn d-flex align-items-center justify-content-center gap-2 ${
                  canCancel
                    ? "btn-outline-danger"
                    : "btn-outline-secondary"
                }`}
                onClick={
                  handleCancel
                }
                disabled={
                  !canCancel ||
                  cancelPhase !==
                    "none"
                }
              >
                {cancelPhase ===
                "submitting" ? (
                  <>
                    <FaSpinner className="fa-spin" />
                    Cancelling Product...
                  </>
                ) : canCancel ? (
                  <>
                    Cancel Product (
                    {timeLeft}s)
                  </>
                ) : (
                  "Cancellation Not Available"
                )}
              </button>
            )}

          </div>
        )}

        {/* REFUND */}

        {isCancelled && (
          <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift">

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

                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">

                  <h4 className="fw-bold mb-0">
                    Total Refund â‚¹
                    {formatMoney(
                      actualRefundAmount
                    )}
                  </h4>

                </div>

                <p className="text-muted mb-4">
                  Refund has been
                  initiated on{" "}
                  {
                    cancelledFormattedDate
                  }
                </p>

                <h6 className="fw-bold mb-3">
                  Refund Credit Mode
                </h6>

                {refundToWallet >
                  0 && (
                  <div className="d-flex justify-content-between mb-2">

                    <span className="text-muted">
                      TechStore Wallet
                    </span>

                    <strong>
                      â‚¹
                      {formatMoney(
                        refundToWallet
                      )}
                    </strong>

                  </div>
                )}

                {refundToOnline >
                  0 && (
                  <div className="d-flex justify-content-between mb-2">

                    <span className="text-muted">
                      {isUPI
                        ? "UPI"
                        : isCard
                        ? "Debit / Credit Card"
                        : "Original Payment Method"}
                    </span>

                    <strong>
                      â‚¹
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
                    â‚¹
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

        <div className="pro-card p-4 p-md-5 mb-4 glass-card hover-lift order-payment-card">

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">

            <div>
              <h5 className="fw-bold mb-1">
                Order Payment Details
              </h5>

              <small className="text-muted">
                Complete payment breakdown for this order
              </small>
            </div>

            <span className={`order-payment-method-badge ${
              paymentConfirmed
                ? "is-paid"
                : isCOD
                ? "is-cod"
                : "is-pending"
            }`}>
              <FaCheckCircle className="me-1" />
              {paymentMethodLabel}
            </span>

          </div>

          <div className="order-payment-breakdown">

            <div className="order-payment-row">
              <span>Subtotal</span>
              <strong>â‚¹{formatMoney(subTotalVal)}</strong>
            </div>

            <div className="order-payment-row">
              <span>Shipping</span>
              <strong className="text-success">
                {shippingVal === 0
                  ? "FREE"
                  : `â‚¹${formatMoney(shippingVal)}`}
              </strong>
            </div>

            <div className="order-payment-row">
              <span>
                GST
                {gstApplied && (
                  <small className="d-block text-success">
                    GST benefit applied
                  </small>
                )}
              </span>

              <strong>
                â‚¹{formatMoney(gstApplied ? 0 : gstVal)}
              </strong>
            </div>

            <div className="order-payment-row">
              <span>Platform Fee</span>
              <strong>â‚¹{formatMoney(platformFeeVal)}</strong>
            </div>

            {couponDiscount > 0 && (
              <div className="order-payment-row is-discount">
                <span>
                  Coupon Savings
                  {order?.couponCode && (
                    <small className="d-block">
                      Code: {order.couponCode}
                    </small>
                  )}
                </span>

                <strong>
                  - â‚¹{formatMoney(couponDiscount)}
                </strong>
              </div>
            )}

            <div className="order-payment-total-row">
              <span>Order Total</span>
              <strong>â‚¹{formatMoney(orderGrandTotal)}</strong>
            </div>

          </div>

          <div className="order-payment-components mt-4">

            <div className="order-payment-components-title">
              <FaCreditCard className="me-2" />
              Payment Breakdown
            </div>

            {walletPaidVal > 0 && (
              <div className="order-payment-component wallet">
                <div>
                  <strong>TechStore Wallet</strong>
                  <small>
                    {paymentConfirmed
                      ? "Wallet amount used"
                      : "Wallet amount reserved for this payment"}
                  </small>
                </div>

                <strong>
                  â‚¹{formatMoney(walletPaidVal)}
                </strong>
              </div>
            )}

            {isUPI && externalPaymentAmount > 0 && (
              <div className="order-payment-component online">
                <div>
                  <strong>UPI Payment</strong>
                  <small>
                    {paymentConfirmed
                      ? "Amount paid via UPI"
                      : "Amount to be paid via UPI"}
                  </small>
                </div>

                <strong>
                  â‚¹{formatMoney(externalPaymentAmount)}
                </strong>
              </div>
            )}

            {isCard && externalPaymentAmount > 0 && (
              <div className="order-payment-component online">
                <div>
                  <strong>Debit / Credit Card</strong>
                  <small>
                    {paymentConfirmed
                      ? "Amount paid by card"
                      : "Amount to be paid by card"}
                  </small>
                </div>

                <strong>
                  â‚¹{formatMoney(externalPaymentAmount)}
                </strong>
              </div>
            )}

            {isCOD && codDueAmount > 0 && (
              <div className="order-payment-component cod">
                <div>
                  <strong>Cash on Delivery</strong>
                  <small>
                    {paymentConfirmed
                      ? "Cash paid on delivery"
                      : "Amount payable at delivery"}
                  </small>
                </div>

                <strong>
                  â‚¹{formatMoney(codDueAmount)}
                </strong>
              </div>
            )}

            {walletPaidVal > 0 && payableAmount > 0 && (
              <div className="order-split-payment-banner">
                <div>
                  <strong>Split Payment</strong>
                  <small>
                    {paymentConfirmed
                      ? "Order paid using two payment sources"
                      : "Wallet + remaining payment method"}
                  </small>
                </div>

                <span>
                  {paymentMethodLabel}
                </span>
              </div>
            )}

          </div>

          <div className="order-payment-status-grid mt-4">

            <div className="order-payment-status-box">
              <small>Payment Status</small>
              <strong className={
                paymentConfirmed
                  ? "text-success"
                  : isCOD
                  ? "text-warning"
                  : "text-primary"
              }>
                {paymentStatusLabel}
              </strong>
            </div>

            <div className="order-payment-status-box">
              <small>Total Paid</small>
              <strong>
                â‚¹{formatMoney(totalPaidVal)}
              </strong>
            </div>

            <div className="order-payment-status-box">
              <small>
                {isCOD ? "Cash Due" : "Balance Due"}
              </small>
              <strong className={
                balanceDue > 0
                  ? "text-danger"
                  : "text-success"
              }>
                â‚¹{formatMoney(
                  isCOD
                    ? (paymentConfirmed ? 0 : codDueAmount)
                    : balanceDue
                )}
              </strong>
            </div>

          </div>

          <div className="order-payment-final-row mt-4">

            <div>
              <strong>
                {paymentConfirmed
                  ? "Total Paid"
                  : isCOD
                  ? "Amount Payable on Delivery"
                  : "Amount Pending"}
              </strong>

              <small>
                {paymentConfirmed
                  ? paymentMethodLabel
                  : isCOD
                  ? paymentMethodLabel
                  : `${paymentMethodLabel} payment is pending`}
              </small>
            </div>

            <strong className="amount">
              â‚¹{formatMoney(
                paymentConfirmed
                  ? totalPaidVal
                  : isCOD
                  ? codDueAmount
                  : externalPaymentAmount
              )}
            </strong>

          </div>

        </div>

        {/* REVIEW MODAL */}

        {reviewModalOpen && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{
              zIndex: 9999,
              background:
                "rgba(0,0,0,0.65)",
              backdropFilter:
                "blur(6px)",
              padding: "20px",
            }}
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeReviewModal();
              }
            }}
          >

            <div
              className="bg-white rounded-4 shadow-lg w-100"
              style={{
                maxWidth:
                  "560px",
                maxHeight:
                  "90vh",
                overflowY:
                  "auto",
              }}
            >

              <div className="d-flex align-items-center justify-content-between p-4 border-bottom">

                <div>
                  <h4 className="fw-bold mb-1">
                    Write a Review â­
                  </h4>

                  <small className="text-muted">
                    Share your
                    experience
                    with this
                    product
                  </small>
                </div>

                <button
                  type="button"
                  className="btn btn-light rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width:
                      "40px",
                    height:
                      "40px",
                  }}
                  onClick={
                    closeReviewModal
                  }
                  disabled={
                    reviewSubmitting
                  }
                >
                  <FaTimes />
                </button>

              </div>

              <div className="p-4">

                {reviewSubmitted ? (
                  <div className="text-center py-4">

                    <div
                      className="d-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mx-auto mb-3"
                      style={{
                        width:
                          "75px",
                        height:
                          "75px",
                        fontSize:
                          "34px",
                      }}
                    >
                      <FaCheck />
                    </div>

                    <h4 className="fw-bold mb-2">
                      Review Submitted!
                    </h4>

                    <p className="text-muted mb-4">
                      Thank you for
                      sharing your
                      experience.
                      <br />
                      Your review
                      is currently{" "}
                      <strong>
                        Pending Admin
                        Approval
                      </strong>
                      .
                    </p>

                    <button
                      type="button"
                      className="btn btn-dark px-4"
                      onClick={
                        closeReviewModal
                      }
                    >
                      Done
                    </button>

                  </div>
                ) : (
                  <form
                    onSubmit={
                      handleSubmitReview
                    }
                  >

                    <div className="d-flex align-items-center gap-3 p-3 rounded-4 border bg-light mb-4">

                      <img
                        src={
                          reviewProduct?.thumbnail ||
                          reviewProduct?.image ||
                          reviewProduct?.img ||
                          "https://images.unsplash.com/photo-1523275335684-37898b30?w=500&auto=format&fit=crop&q=60"
                        }
                        alt={getProductName(
                          reviewProduct
                        )}
                        referrerPolicy="no-referrer"
                        style={{
                          width:
                            "70px",
                          height:
                            "70px",
                          objectFit:
                            "cover",
                          borderRadius:
                            "14px",
                        }}
                      />

                      <div className="flex-grow-1">

                        <small className="text-muted d-block">
                          Reviewing
                        </small>

                        <h6 className="fw-bold mb-0">
                          {getProductName(
                            reviewProduct
                          )}
                        </h6>

                      </div>
                    </div>

                    <div className="p-3 rounded-4 border mb-4">

                      <small className="text-muted d-block mb-1">
                        Review by
                      </small>

                      <strong className="d-block">
                        {getCustomerName()}
                      </strong>

                      {getCustomerEmail() && (
                        <small className="text-muted">
                          {getCustomerEmail()}
                        </small>
                      )}

                    </div>

                    <div className="mb-4">

                      <label className="form-label fw-bold">
                        Your Rating
                      </label>

                      <div className="d-flex gap-2">

                        {[1, 2, 3, 4, 5].map(
                          (star) => (
                            <button
                              key={
                                star
                              }
                              type="button"
                              className="btn p-0 border-0"
                              style={{
                                background:
                                  "transparent",
                                fontSize:
                                  "32px",
                              }}
                              onClick={() =>
                                setReviewRating(
                                  star
                                )
                              }
                            >
                              <FaStar
                                className={
                                  star <=
                                  reviewRating
                                    ? "text-warning"
                                    : "text-secondary opacity-25"
                                }
                              />
                            </button>
                          )
                        )}

                      </div>

                    </div>

                    <div className="mb-4">

                      <label
                        htmlFor="orderReviewText"
                        className="form-label fw-bold"
                      >
                        Your Review
                      </label>

                      <textarea
                        id="orderReviewText"
                        className="form-control rounded-4"
                        rows="5"
                        placeholder="Tell us about your experience with this product..."
                        value={
                          reviewText
                        }
                        onChange={(
                          event
                        ) =>
                          setReviewText(
                            event.target
                              .value
                          )
                        }
                        maxLength={
                          2000
                        }
                        disabled={
                          reviewSubmitting
                        }
                      />

                      <div className="d-flex justify-content-between mt-2">

                        <small className="text-muted">
                          Minimum 5
                          characters
                        </small>

                        <small className="text-muted">
                          {
                            reviewText.length
                          }
                          /2000
                        </small>

                      </div>

                    </div>

                    <div className="alert alert-light border rounded-4 mb-4">

                      <div className="d-flex align-items-center gap-2 mb-1">

                        <FaBoxOpen />

                        <strong>
                          Verified
                          Purchase
                        </strong>

                      </div>

                      <small className="text-muted">
                        This review is
                        being
                        submitted
                        from your
                        delivered
                        TechStore
                        order.
                      </small>

                    </div>

                    <div className="d-flex gap-2">

                      <button
                        type="button"
                        className="btn btn-outline-secondary flex-fill"
                        onClick={
                          closeReviewModal
                        }
                        disabled={
                          reviewSubmitting
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="btn btn-dark flex-fill d-flex align-items-center justify-content-center gap-2"
                        disabled={
                          reviewSubmitting ||
                          !reviewText.trim()
                        }
                      >
                        {reviewSubmitting ? (
                          <>
                            <FaSpinner className="fa-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FaStar />
                            Submit Review
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
