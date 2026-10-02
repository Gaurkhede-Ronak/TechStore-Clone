import { scrollToPageTop } from "../components/ScrollToTop";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaSyncAlt,
  FaSun,
  FaMoon,
  FaCopy,
  FaTruck,
  FaBoxOpen,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaWarehouse,
  FaSearch,
  FaRoute,
  FaExchangeAlt,
  FaUndoAlt,
  FaShieldAlt,
  FaPhoneAlt,
  FaIdBadge,
  FaClock,
} from "react-icons/fa";
import { Query } from "appwrite";

import { toggleTheme } from "../redux/slices/themeSlice";
import { databases } from "../appwrite/config";
import shipmentService from "../appwrite/shipmentService";
import shipmentEventService from "../appwrite/shipmentEventService";
import warehouseService from "../appwrite/warehouseService";
import orderService from "../appwrite/orderService";
import returnExchangeService from "../appwrite/returnExchangeService";
import deliveryOtpService from "../appwrite/deliveryOtpService";

import "../css/TrackOrder.css";

/* 4 COURIER PORTAL BRANDS — Each has its own unique color palette AND layout structure */

const COURIER_PORTALS = {
  FastNexTech: {
    key: "FastNexTech",
    layout: "layout-fastnextech",
    cssClass: "courier-fastnextech",
    name: "FastNexTech",
    code: "FNTX",
    tagline: "Superfast Express Air & Surface Parcel Network",
    hubLabel: "FastNexTech SuperHub",
    badgeText: "EXPRESS AIR & SURFACE",
  },
  DeTechLiv: {
    key: "DeTechLiv",
    layout: "layout-detechliv",
    cssClass: "courier-detechliv",
    name: "DeTechLiv",
    code: "DTL",
    tagline: "Nationwide Precision Supply Chain & Express Carrier",
    hubLabel: "DeTechLiv Gateway Hub",
    badgeText: "ENTERPRISE SUPPLY CHAIN",
  },
  TechFonish: {
    key: "TechFonish",
    layout: "layout-techfonish",
    cssClass: "courier-techfonish",
    name: "TechFonish",
    code: "TFN",
    tagline: "Smart E-Commerce Priority Fulfillment Network",
    hubLabel: "TechFonish Priority Hub",
    badgeText: "PRIORITY E-COMMERCE LOGISTICS",
  },
  Technoe: {
    key: "Technoe",
    layout: "layout-technoe",
    cssClass: "courier-technoe",
    name: "Technoe",
    code: "TNE",
    tagline: "AI-Powered Rapid Transit & Doorstep Delivery",
    hubLabel: "Technoe Rapid Hub",
    badgeText: "AI HYPERLOCAL & LINEHAUL",
  },
};

const COURIER_LIST = Object.values(COURIER_PORTALS);

/* STATUS DEFINITIONS */

const STATUS_ORDER = [
  "PLACED",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "REACHED_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_LABELS = {
  PLACED: "Order Placed",
  PACKED: "Order Packed",
  DISPATCHED: "Shipment Dispatched",
  IN_TRANSIT: "In Transit",
  REACHED_HUB: "Reached Delivery Hub",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  EXCEPTION: "Delivery Exception",
};

const STATUS_DESCRIPTIONS = {
  PLACED:
    "Order confirmed at origin facility and registered for courier manifest.",
  PACKED:
    "Package has been securely packed, barcoded, and queued for courier pickup.",
  DISPATCHED:
    "Parcel has been picked up and dispatched from the origin warehouse.",
  IN_TRANSIT:
    "Parcel is moving across the intercity linehaul network towards destination city.",
  REACHED_HUB:
    "Parcel has arrived at the nearest destination sorting hub.",
  OUT_FOR_DELIVERY:
    "Delivery executive is out with your parcel for doorstep delivery.",
  DELIVERED:
    "Parcel has been delivered successfully to the consignee.",
  CANCELLED:
    "This shipment has been cancelled.",
  EXCEPTION:
    "Delivery attempt encountered an exception. Our team is reviewing it.",
};

/* HELPERS */

const normalizeStatus = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  const aliases = {
    CONFIRMED: "PLACED",
    ORDER_PLACED: "PLACED",
    ORDER_PACKED: "PACKED",
    SHIPPED: "DISPATCHED",
    SHIPMENT_DISPATCHED: "DISPATCHED",
    TRANSIT: "IN_TRANSIT",
    REACHED_DELIVERY_HUB: "REACHED_HUB",
    CANCELED: "CANCELLED",
  };

  return aliases[value] || value || "PLACED";
};

const resolveCourierBrand = (
  rawCourier,
  rawCode,
  rawTrackingId,
  fallbackSeed = ""
) => {
  const courierStr = String(rawCourier || "").trim().toLowerCase();
  const codeStr = String(rawCode || "").trim().toUpperCase();
  const trackStr = String(rawTrackingId || "").trim().toUpperCase();

  if (
    courierStr.includes("fastnextech") ||
    codeStr === "FNTX" ||
    trackStr.startsWith("FNTX")
  ) {
    return COURIER_PORTALS.FastNexTech;
  }

  if (
    courierStr.includes("detechliv") ||
    codeStr === "DTL" ||
    trackStr.startsWith("DTL")
  ) {
    return COURIER_PORTALS.DeTechLiv;
  }

  if (
    courierStr.includes("techfonish") ||
    codeStr === "TFN" ||
    trackStr.startsWith("TFN")
  ) {
    return COURIER_PORTALS.TechFonish;
  }

  if (
    courierStr.includes("technoe") ||
    codeStr === "TNE" ||
    trackStr.startsWith("TNE")
  ) {
    return COURIER_PORTALS.Technoe;
  }

  const seed = String(fallbackSeed || trackStr || "FNTX");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COURIER_LIST[hash % COURIER_LIST.length];
};

/**
 * Formats city & state without ugly duplicates like "Delhi, Delhi"
 */
const formatCityState = (city, state) => {
  const c = String(city || "").trim();
  const s = String(state || "").trim();
  if (!c && !s) return "India";
  if (!s) return c;
  if (!c) return s;
  if (c.toLowerCase() === s.toLowerCase()) {
    return c.toLowerCase() === "delhi" ? "New Delhi, Delhi NCR" : c;
  }
  return `${c}, ${s}`;
};

/**
 * Builds a 3-letter uppercase station code from any city name (e.g. Delhi -> DEL, Port Blair -> PBL)
 */
const getCityStationCode = (city, fallback = "HUB") => {
  const clean = String(city || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "");
  if (!clean) return fallback;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1].slice(0, 2)).padEnd(3, "X").slice(0, 3);
  }
  const consonants = clean.replace(/[AEIOU]/g, "");
  if (consonants.length >= 3) {
    return (clean[0] + consonants.slice(1, 3)).slice(0, 3);
  }
  return clean.slice(0, 3).padEnd(3, "X");
};

/**
 * Picks a realistic intermediate Transit Hub between Origin and Destination
 * so "In Transit" never repeats the exact same location as Origin or Destination.
 */
const getIntermediateTransitHub = (originCity, destCity, courierCode) => {
  const o = String(originCity || "").toLowerCase();
  const d = String(destCity || "").toLowerCase();

  if (d.includes("port blair") || d.includes("andaman")) {
    return {
      city: "Kolkata",
      state: "West Bengal",
      code: "CCU",
      hubName: `Kolkata Air Cargo & Port Gateway (${courierCode}-TRN-CCU)`,
      facilityAddress: "NSCBI Air Cargo Complex, Jessore Rd, Kolkata - 700052",
    };
  }

  if (o.includes("delhi") && (d.includes("ahmedabad") || d.includes("surat") || d.includes("rajkot") || d.includes("vadodara"))) {
    return {
      city: "Jaipur",
      state: "Rajasthan",
      code: "JAI",
      hubName: `Jaipur NH-48 Linehaul Exchange (${courierCode}-TRN-JAI)`,
      facilityAddress: "VKIA Logistics Park, Sikar Road, Jaipur - 302013",
    };
  }

  if (o.includes("delhi")) {
    return {
      city: "Nagpur",
      state: "Maharashtra",
      code: "NGP",
      hubName: `Nagpur Zero-Mile National Hub (${courierCode}-TRN-NGP)`,
      facilityAddress: "MIHAN SEZ Cargo Terminal, Wardha Rd, Nagpur - 441108",
    };
  }

  if (o.includes("mumbai") || o.includes("pune")) {
    return {
      city: "Surat",
      state: "Gujarat",
      code: "STV",
      hubName: `Surat Western Corridor Hub (${courierCode}-TRN-STV)`,
      facilityAddress: "Kadodara NH-48 Freight Park, Surat - 394327",
    };
  }

  return {
    city: "Indore",
    state: "Madhya Pradesh",
    code: "IDR",
    hubName: `Indore Central Interstate Hub (${courierCode}-TRN-IDR)`,
    facilityAddress: "Dewas Naka Logistics Park, AB Road, Indore - 452010",
  };
};

/**
 * Generates a dynamic masked phone number (+91 xxxxx xxx78, +91 xxxxx xxx63, etc.)
 * Changes dynamically per session/refresh when no explicit phone is stored, or uses
 * a rotating 2-digit ending so it never stays stuck on 45!
 */
const DYNAMIC_PHONE_ENDINGS = [
  "78",
  "63",
  "84",
  "29",
  "56",
  "91",
  "37",
  "68",
  "49",
  "82",
  "74",
  "53",
];

const formatMaskedDeliveryPhone = (rawPhone, dynamicRoll = 0) => {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length >= 2 && digits.slice(-2) !== "45") {
    return `+91 xxxxx xxx${digits.slice(-2)}`;
  }
  const idx = Math.abs(Number(dynamicRoll) || 0) % DYNAMIC_PHONE_ENDINGS.length;
  return `+91 xxxxx xxx${DYNAMIC_PHONE_ENDINGS[idx]}`;
};

const formatDate = (value) => {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "Within 3–5 Days";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Within 3–5 Days";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getEventDate = (event) =>
  event?.timestamp || event?.$createdAt || event?.createdAt || null;

/* STANDALONE COURIER TRACKING PORTAL COMPONENT */

function TrackOrder() {
  const navigate = useNavigate();
  useEffect(() => {
    scrollToPageTop();
  }, []);
  const location = useLocation();
  const dispatch = useDispatch();

  const themeMode = useSelector((state) => state.theme?.mode || "light");

  const [searchParams] = useSearchParams();

  const urlTrackingId = searchParams.get("trackingId") || "";
  const urlOrderId = searchParams.get("orderId") || "";
  const urlReturnId = searchParams.get("returnId") || "";
  const urlCourier = searchParams.get("courier") || "";

  const stateOrder = location.state?.order || null;
  const stateShipment = location.state?.shipment || null;

  const [trackingInput, setTrackingInput] = useState(
    urlTrackingId || urlOrderId || ""
  );

  const [shipment, setShipment] = useState(stateShipment);
  const [events, setEvents] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [order, setOrder] = useState(stateOrder);
  const [returnRequest, setReturnRequest] = useState(null);
  const [assignedDeliveryBoy, setAssignedDeliveryBoy] = useState(null);
  const [activeDeliveryOtp, setActiveDeliveryOtp] = useState("");
  const [phoneRollSeed, setPhoneRollSeed] = useState(() =>
    Math.floor(Math.random() * 100)
  );

  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  /* LOAD ORDER & RETURN REQUEST FROM APPWRITE */

  const loadOrder = useCallback(async (orderId) => {
    if (!orderId) return null;
    try {
      const data = await orderService.getOrderSmart(orderId);
      return data?.document || data || null;
    } catch {
      return null;
    }
  }, []);

  const loadReturnRequest = useCallback(async (returnId, orderId) => {
    try {
      if (returnId) {
        try {
          const req = await returnExchangeService.getRequest(returnId);
          if (req) return req;
        } catch {
          // continue to orderId lookup
        }
      }

      if (orderId) {
        const requests = await returnExchangeService.getRequestsByOrderId(
          orderId
        );
        if (Array.isArray(requests) && requests.length > 0) {
          const active = requests.find(
            (item) =>
              String(item?.status || "").toUpperCase() !== "CANCELLED"
          );
          return active || requests[requests.length - 1];
        }
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  /* RESOLVE ASSIGNED DELIVERY BOY FROM APPWRITE USERS */

  const resolveDeliveryBoyDetails = useCallback(
    async (rawBoyId, rawBoyName, rawBoyPhone, rollIndex = 0) => {
      let boyId = String(rawBoyId || "").trim();
      let boyName = String(rawBoyName || "").trim();
      let boyPhone = String(rawBoyPhone || "").trim();

      try {
        const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
        const usersCollectionId =
          import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || "users";

        if (databaseId && usersCollectionId) {
          const response = await databases.listDocuments(
            databaseId,
            usersCollectionId,
            [Query.limit(100)]
          );
          const docs = Array.isArray(response?.documents)
            ? response.documents
            : [];

          let matchedUser = null;

          if (boyId) {
            matchedUser = docs.find(
              (u) =>
                String(u?.userId || "") === boyId ||
                String(u?.$id || "") === boyId
            );
          }

          if (!matchedUser && boyName) {
            const lowerName = boyName.toLowerCase();
            matchedUser = docs.find(
              (u) =>
                String(u?.name || u?.fullName || u?.username || "")
                  .trim()
                  .toLowerCase() === lowerName
            );
          }

          if (!matchedUser && !boyName) {
            matchedUser = docs.find((u) => {
              const role = String(u?.role || u?.userRole || "")
                .trim()
                .toLowerCase();
              return (
                role === "deliveryboy" ||
                role === "delivery_boy" ||
                role === "delivery"
              );
            });
          }

          if (matchedUser) {
            boyId = boyId || String(matchedUser.userId || matchedUser.$id || "");
            boyName =
              boyName ||
              matchedUser.name ||
              matchedUser.fullName ||
              matchedUser.username ||
              matchedUser.email ||
              "Delivery Executive";
            boyPhone =
              boyPhone ||
              matchedUser.phone ||
              matchedUser.mobile ||
              matchedUser.phoneNumber ||
              matchedUser.contact ||
              "";
          }
        }
      } catch {
        // Fallback to event/shipment metadata if users collection query fails
      }

      if (!boyName && !boyId) {
        return null;
      }

      const finalName = boyName || "Delivery Partner";
      const firstInitial =
        String(finalName).trim().charAt(0).toUpperCase() || "D";

      return {
        id: boyId,
        name: finalName,
        initial: firstInitial,
        maskedPhone: formatMaskedDeliveryPhone(boyPhone, rollIndex),
      };
    },
    []
  );

  /* FETCH LIVE SHIPMENT & EVENTS FROM APPWRITE */

  const fetchTracking = useCallback(
    async (rawTrackingOrOrder, explicitOrderId = "", explicitReturnId = "") => {
      const queryValue = String(rawTrackingOrOrder || "").trim();
      const cleanOrderId = String(explicitOrderId || urlOrderId || "").trim();
      const cleanReturnId = String(explicitReturnId || urlReturnId || "").trim();

      if (!queryValue && !cleanOrderId) {
        setError("Please enter a valid Tracking AWB or Order ID.");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const nextRoll = Math.floor(Math.random() * 100);
        setPhoneRollSeed(nextRoll);

        let shipmentData = null;

        // 1. Search by Tracking ID
        if (queryValue) {
          try {
            shipmentData = await shipmentService.getShipmentByTrackingId(
              queryValue
            );
          } catch {
            // fallback to orderId search
          }
        }

        // 2. Search by Order ID
        const orderIdCandidate = cleanOrderId || queryValue;
        if (!shipmentData && orderIdCandidate) {
          try {
            const response = await shipmentService.getShipmentsByOrderId(
              orderIdCandidate
            );
            const docs = Array.isArray(response?.documents)
              ? response.documents
              : Array.isArray(response)
              ? response
              : [];

            if (docs.length > 0) {
              shipmentData = [...docs].sort(
                (a, b) =>
                  new Date(b?.$updatedAt || b?.$createdAt || 0).getTime() -
                  new Date(a?.$updatedAt || a?.$createdAt || 0).getTime()
              )[0];
            }
          } catch {
            // ignore
          }
        }

        // 3. Load Order Document
        const resolvedOrderId =
          shipmentData?.orderId ||
          orderIdCandidate ||
          stateOrder?.orderId ||
          stateOrder?.$id ||
          "";

        let orderData = resolvedOrderId
          ? await loadOrder(resolvedOrderId)
          : stateOrder;

        if (!orderData && stateOrder) {
          orderData = stateOrder;
        }

        // Synthesize fallback shipment object from order if shipment doc wasn't created yet
        if (!shipmentData && orderData) {
          const shippingAddr =
            typeof orderData.shippingAddress === "object" &&
            orderData.shippingAddress
              ? orderData.shippingAddress
              : {};
          shipmentData = {
            $id: "",
            orderId: orderData.orderId || orderData.$id,
            trackingId: orderData.trackingId || "",
            courier: orderData.courier || "",
            courierCode: orderData.courierCode || "",
            status: orderData.status || "PLACED",
            originCity: "New Delhi",
            originState: "Delhi",
            destinationAddress:
              shippingAddr.address || orderData.address || "Customer Address",
            destinationCity:
              shippingAddr.city || orderData.city || "Destination City",
            destinationState: shippingAddr.state || orderData.state || "",
            destinationPincode:
              shippingAddr.pincode ||
              shippingAddr.zipCode ||
              orderData.pincode ||
              "",
            estimatedDeliveryDate: orderData.estimatedDeliveryDate || "",
            $createdAt: orderData.$createdAt || new Date().toISOString(),
            $updatedAt: orderData.$updatedAt || new Date().toISOString(),
          };
        }

        if (!shipmentData) {
          throw new Error(
            "No shipment found for this Tracking AWB or Order ID."
          );
        }

        setShipment(shipmentData);
        setOrder(orderData);

        // 4. Load Shipment Events from Appwrite & extract DELIVERY_BOY_ASSIGNED metadata
        let parsedBoyId = String(shipmentData?.deliveryBoyId || "").trim();
        let parsedBoyName = String(shipmentData?.deliveryBoyName || "").trim();
        let parsedBoyPhone = String(shipmentData?.deliveryBoyPhone || "").trim();

        if (shipmentData.$id) {
          try {
            const eventDocs = await shipmentEventService.getShipmentEvents(
              shipmentData.$id
            );
            const rawList = Array.isArray(eventDocs) ? eventDocs : [];

            for (const ev of rawList) {
              const desc = String(ev?.description || "");
              if (desc.startsWith("DELIVERY_BOY_ASSIGNED:")) {
                const parts = desc.split(":");
                if (parts[1]) parsedBoyId = parts[1];
                if (parts[2]) parsedBoyName = parts[2];
                if (parts[3]) parsedBoyPhone = parts[3];
              }
            }

            const cleanEvents = rawList
              .filter(
                (ev) =>
                  !String(ev?.description || "").startsWith(
                    "DELIVERY_BOY_ASSIGNED:"
                  )
              )
              .sort(
                (a, b) =>
                  new Date(getEventDate(a) || 0).getTime() -
                  new Date(getEventDate(b) || 0).getTime()
              );
            setEvents(cleanEvents);
          } catch {
            setEvents([]);
          }
        } else {
          setEvents([]);
        }

        // 5. Load Origin Warehouse
        if (shipmentData.originWarehouseId) {
          try {
            const wh = await warehouseService.getWarehouse(
              shipmentData.originWarehouseId
            );
            setWarehouse(wh || null);
          } catch {
            setWarehouse(null);
          }
        } else {
          setWarehouse(null);
        }

        // 6. Load Return / Exchange Request if applicable
        const req = await loadReturnRequest(cleanReturnId, resolvedOrderId);
        setReturnRequest(req);

        if (!parsedBoyId && req?.deliveryBoyId) {
          parsedBoyId = String(req.deliveryBoyId);
        }

        // 7. Resolve Delivery Boy info when assigned or when status is OUT_FOR_DELIVERY / DELIVERED
        const normSt = normalizeStatus(
          shipmentData?.status || orderData?.status || "PLACED"
        );
        if (
          parsedBoyId ||
          parsedBoyName ||
          normSt === "OUT_FOR_DELIVERY" ||
          normSt === "DELIVERED"
        ) {
          const boyInfo = await resolveDeliveryBoyDetails(
            parsedBoyId,
            parsedBoyName,
            parsedBoyPhone,
            nextRoll
          );
          setAssignedDeliveryBoy(boyInfo);
        } else {
          setAssignedDeliveryBoy(null);
        }

        if (normSt === "OUT_FOR_DELIVERY" && shipmentData?.$id) {
          try {
            let otpDoc = await deliveryOtpService.getActiveOtpByShipmentId(
              shipmentData.$id
            );
            let otpVal = String(otpDoc?.otp || otpDoc?.otpCode || "").trim();
            if (!otpVal) {
              const gen = await deliveryOtpService.generateOtp({
                shipmentId: String(shipmentData.$id),
                orderId: String(resolvedOrderId || ""),
                userId: String(shipmentData.userId || orderData?.userId || ""),
                trackingId: String(shipmentData.trackingId || ""),
              });
              if (gen?.success && gen?.otp) {
                otpVal = String(gen.otp).trim();
              }
            }
            setActiveDeliveryOtp(otpVal);
          } catch {
            setActiveDeliveryOtp("");
          }
        } else {
          setActiveDeliveryOtp("");
        }

        setTrackingInput(
          shipmentData.trackingId || resolvedOrderId || queryValue
        );
        setLastUpdated(new Date());
      } catch (err) {
        setError(err?.message || "Unable to load parcel tracking details.");
      } finally {
        setLoading(false);
      }
    },
    [
      loadOrder,
      loadReturnRequest,
      resolveDeliveryBoyDetails,
      stateOrder,
      urlOrderId,
      urlReturnId,
    ]
  );

  useEffect(() => {
    setShowDetails(false);
    if (urlTrackingId || urlOrderId) {
      fetchTracking(urlTrackingId || urlOrderId, urlOrderId, urlReturnId);
    }
  }, [urlTrackingId, urlOrderId, urlReturnId, fetchTracking]);

  /* ACTIVE COURIER BRAND & AWB (LOCKED TO ORDER'S COURIER) */

  const detectedCourier = useMemo(() => {
    if (urlCourier && COURIER_PORTALS[urlCourier]) {
      return COURIER_PORTALS[urlCourier];
    }
    return resolveCourierBrand(
      shipment?.courier,
      shipment?.courierCode,
      shipment?.trackingId,
      shipment?.orderId || order?.orderId || order?.$id || urlOrderId
    );
  }, [
    urlCourier,
    shipment?.courier,
    shipment?.courierCode,
    shipment?.trackingId,
    shipment?.orderId,
    order?.orderId,
    order?.$id,
    urlOrderId,
  ]);

  const displayAwb = (() => {
    if (shipment?.trackingId) {
      return shipment.trackingId;
    }
    const seed = String(
      shipment?.orderId || order?.orderId || order?.$id || "9048271635"
    ).replace(/[^0-9]/g, "");
    const suffix = (seed + "8472910384").slice(0, 10);
    return `${detectedCourier.code}${suffix}`;
  })();

  /* CURRENT STATUS, CODES & PARCEL POSITION */

  const currentStatus = normalizeStatus(
    shipment?.status || order?.status || "PLACED"
  );

  const currentStepIndex = useMemo(() => {
    const idx = STATUS_ORDER.indexOf(currentStatus);
    return idx >= 0 ? idx : 0;
  }, [currentStatus]);

  const originCityName =
    warehouse?.city || shipment?.originCity || "New Delhi";
  const originStateName =
    warehouse?.state || shipment?.originState || "Delhi";
  const cleanOriginLocation = formatCityState(originCityName, originStateName);
  const originCode = getCityStationCode(originCityName, "DEL");
  const originHubName =
    warehouse?.name || `${originCityName} Main Warehouse`;

  const destCityName =
    shipment?.destinationCity || order?.city || "Destination City";
  const destStateName =
    shipment?.destinationState || order?.state || "";
  const cleanDestLocation = formatCityState(destCityName, destStateName);
  const destCode = getCityStationCode(destCityName, "DST");
  const destPincode =
    shipment?.destinationPincode || order?.pincode || "";
  const destFullAddress =
    shipment?.destinationAddress ||
    order?.address ||
    "Customer Delivery Address";

  const transitHub = useMemo(
    () =>
      getIntermediateTransitHub(
        originCityName,
        destCityName,
        detectedCourier.code
      ),
    [originCityName, destCityName, detectedCourier.code]
  );

  const showDeliveryPartnerCard =
    (currentStatus === "OUT_FOR_DELIVERY" ||
      currentStatus === "DELIVERED" ||
      Boolean(assignedDeliveryBoy?.id)) &&
    Boolean(assignedDeliveryBoy);

  /* CLEAN, REALISTIC 3-BOX ROUTE POSITION (IMAGE 2 FIX) — Shows In Transit / Hub Code / Clean Address without messy text */

  const livePositionInfo = useMemo(() => {
    if (currentStatus === "CANCELLED") {
      return {
        currentPlace: `Cancelled • ${originCityName} (${detectedCourier.code}-${originCode})`,
        currentNote: "Order shipment was cancelled before dispatch.",
        footerLeft: `Hub: ${detectedCourier.code}-${originCode}`,
        footerRight: "Movement Stopped",
      };
    }

    if (currentStatus === "DELIVERED") {
      return {
        currentPlace: `Delivered • ${destCityName} (${detectedCourier.code}-${destCode})`,
        currentNote: `${destFullAddress} • PIN ${destPincode || "Verified"}`,
        footerLeft: `Code: ${detectedCourier.code}-${destCode}`,
        footerRight: "Delivered ✓",
      };
    }

    if (currentStatus === "OUT_FOR_DELIVERY") {
      return {
        currentPlace: `In Transit (Out for Delivery) • ${destCityName} (${detectedCourier.code}-${destCode})`,
        currentNote: `${cleanDestLocation} • ${destFullAddress}${
          destPincode ? " • PIN " + destPincode : ""
        }`,
        footerLeft: `Hub Code: ${detectedCourier.code}-${destCode}`,
        footerRight: `PIN: ${destPincode || destCode}`,
      };
    }

    if (currentStatus === "REACHED_HUB") {
      return {
        currentPlace: `Reached Hub • ${destCityName} (${detectedCourier.code}-${destCode})`,
        currentNote: `${destCityName} ${detectedCourier.hubLabel} • ${cleanDestLocation}${
          destPincode ? " • PIN " + destPincode : ""
        }`,
        footerLeft: `Hub Code: ${detectedCourier.code}-${destCode}`,
        footerRight: `Next: Out for Delivery (${destPincode || destCode})`,
      };
    }

    if (currentStatus === "IN_TRANSIT") {
      return {
        currentPlace: `In Transit • ${transitHub.city} (${detectedCourier.code}-${transitHub.code})`,
        currentNote: `${transitHub.hubName} • ${transitHub.facilityAddress}`,
        footerLeft: `Route: ${originCode} → ${transitHub.code} → ${destCode}`,
        footerRight: `Next: ${destCityName} (${destPincode || destCode})`,
      };
    }

    if (currentStatus === "DISPATCHED") {
      return {
        currentPlace: `In Transit • ${originCityName} (${detectedCourier.code}-${originCode})`,
        currentNote: `Dispatched from ${originHubName} (${cleanOriginLocation}) towards ${transitHub.city} Linehaul Hub`,
        footerLeft: `Hub Code: ${detectedCourier.code}-${originCode}`,
        footerRight: `Next: ${transitHub.city} (${transitHub.code})`,
      };
    }

    if (currentStatus === "PACKED") {
      return {
        currentPlace: `Packed at Origin • ${originCityName} (${detectedCourier.code}-${originCode})`,
        currentNote: `${originHubName} Packaging Bay • ${cleanOriginLocation}`,
        footerLeft: `Hub Code: ${detectedCourier.code}-${originCode}`,
        footerRight: `Next: Linehaul Dispatch`,
      };
    }

    return {
      currentPlace: `Origin Facility • ${originCityName} (${detectedCourier.code}-${originCode})`,
      currentNote: `${originHubName} • ${cleanOriginLocation}`,
      footerLeft: `Hub Code: ${detectedCourier.code}-${originCode}`,
      footerRight: "Next: Packaging & Barcode",
    };
  }, [
    cleanDestLocation,
    cleanOriginLocation,
    currentStatus,
    destCityName,
    destCode,
    destFullAddress,
    destPincode,
    detectedCourier.code,
    detectedCourier.hubLabel,
    originCityName,
    originCode,
    originHubName,
    transitHub,
  ]);

  /* RETURN / EXCHANGE STEPS (IF ACTIVE) */

  const returnType = String(returnRequest?.type || "RETURN").toUpperCase();
  const rawReturnStatus = String(returnRequest?.status || "REQUESTED")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  const returnSteps = useMemo(() => {
    return returnType === "EXCHANGE"
      ? [
          { key: "REQUESTED", label: "Exchange Created" },
          { key: "ACCEPTED", label: "Exchange Accepted" },
          { key: "CONFIRMED", label: "Confirmed" },
          { key: "PACKED", label: "Packed" },
          { key: "DISPATCHED", label: "Dispatched" },
          { key: "PICKUP_ASSIGNED", label: "Out for Exchange" },
          { key: "EXCHANGE_COMPLETED", label: "Exchange Complete" },
        ]
      : [
          { key: "REQUESTED", label: "Return Created" },
          { key: "CONFIRMED", label: "Return Accepted" },
          { key: "PICKUP_ASSIGNED", label: "Out for Pickup" },
          { key: "PICKED_UP", label: "Item Picked Up" },
          { key: "REFUND_INITIATED", label: "Refund Initiated" },
          { key: "REFUND_COMPLETED", label: "Return Complete" },
        ];
  }, [returnType]);

  const normalizedReturnStatus = useMemo(() => {
    if (
      rawReturnStatus === "ASSIGNED" ||
      rawReturnStatus === "OUT_FOR_EXCHANGE" ||
      (returnType === "EXCHANGE" && rawReturnStatus === "PICKED_UP")
    ) {
      return "PICKUP_ASSIGNED";
    }
    if (
      rawReturnStatus === "EXCHANGED" ||
      (returnType === "EXCHANGE" && rawReturnStatus === "COMPLETED")
    ) {
      return "EXCHANGE_COMPLETED";
    }
    if (
      rawReturnStatus === "REFUNDED" ||
      (returnType !== "EXCHANGE" && rawReturnStatus === "COMPLETED")
    ) {
      return "REFUND_COMPLETED";
    }
    if (returnType !== "EXCHANGE" && rawReturnStatus === "ACCEPTED") {
      return "CONFIRMED";
    }
    return rawReturnStatus;
  }, [rawReturnStatus, returnType]);

  const returnStepIndex = useMemo(() => {
    const idx = returnSteps.findIndex((s) => s.key === normalizedReturnStatus);
    return idx >= 0 ? idx : 0;
  }, [returnSteps, normalizedReturnStatus]);

  /* STAGE-ACCURATE SCAN TIMELINE (IMAGE 3 FIX) — Every checkpoint shows its true, non-repeating location & hub code! */

  const buildStageScanDetails = useCallback(
    (st) => {
      switch (st) {
        case "PLACED":
          return {
            title: "Order Placed",
            description: `Order confirmed and registered at ${originHubName} under AWB ${displayAwb}.`,
            locationText: `${originHubName} (${detectedCourier.code}-WH-${originCode}) • ${cleanOriginLocation}`,
          };
        case "PACKED":
          return {
            title: "Order Packed",
            description: `Package quality-checked, sealed, barcoded, and manifested at ${originCityName} fulfillment bay.`,
            locationText: `${originCityName} Fulfillment & Packaging Center (${detectedCourier.code}-PKG-${originCode}) • ${cleanOriginLocation}`,
          };
        case "DISPATCHED":
          return {
            title: "Shipment Dispatched",
            description: `Parcel handed over to ${detectedCourier.name} linehaul fleet and departed ${originCityName} origin facility.`,
            locationText: `${originCityName} Express Dispatch Terminal (${detectedCourier.code}-DSP-${originCode}) • ${cleanOriginLocation}`,
          };
        case "IN_TRANSIT":
          return {
            title: `In Transit • ${transitHub.city} (${detectedCourier.code}-${transitHub.code})`,
            description: `Shipment in transit via ${transitHub.hubName} en route from ${originCityName} (${originCode}) to ${destCityName} (${destCode}).`,
            locationText: `${transitHub.hubName} • ${transitHub.facilityAddress}`,
          };
        case "REACHED_HUB":
          return {
            title: "Reached Delivery Hub",
            description: `Parcel arrived at ${destCityName} destination sorting hub; inward scan completed for local dispatch.`,
            locationText: `${destCityName} ${detectedCourier.hubLabel} (${detectedCourier.code}-HUB-${destCode}) • ${cleanDestLocation}${
              destPincode ? " • PIN " + destPincode : ""
            }`,
          };
        case "OUT_FOR_DELIVERY":
          return {
            title: "Out for Delivery",
            description: assignedDeliveryBoy?.name
              ? `Out for doorstep delivery with ${detectedCourier.name} executive ${assignedDeliveryBoy.name} (${assignedDeliveryBoy.maskedPhone}).`
              : `Parcel is out for doorstep delivery from ${destCityName} delivery station.`,
            locationText: `${destCityName} Last-Mile Delivery Center (${detectedCourier.code}-LM-${destCode}) → ${destFullAddress}, ${cleanDestLocation}${
              destPincode ? " • PIN " + destPincode : ""
            }`,
          };
        case "DELIVERED":
          return {
            title: "Delivered",
            description: `Parcel delivered successfully to consignee at ${destCityName} after OTP verification.`,
            locationText: `Consignee Doorstep • ${destFullAddress}, ${cleanDestLocation}${
              destPincode ? " • PIN " + destPincode : ""
            }`,
          };
        default:
          return {
            title: STATUS_LABELS[st] || st,
            description: STATUS_DESCRIPTIONS[st] || "",
            locationText: cleanDestLocation,
          };
      }
    },
    [
      assignedDeliveryBoy,
      cleanDestLocation,
      cleanOriginLocation,
      destCityName,
      destCode,
      destFullAddress,
      destPincode,
      detectedCourier.code,
      detectedCourier.hubLabel,
      detectedCourier.name,
      displayAwb,
      originCityName,
      originCode,
      originHubName,
      transitHub,
    ]
  );

  const displayScans = useMemo(() => {
    if (!shipment) return [];

    // Map existing events by normalized status so we keep real Appwrite timestamps
    const eventTimeByStatus = {};
    for (const ev of events) {
      const norm = normalizeStatus(ev?.status || ev?.title);
      const t = getEventDate(ev);
      if (norm && t) {
        eventTimeByStatus[norm] = t;
      }
    }

    const baseTime = new Date(
      shipment.$createdAt || shipment.$updatedAt || "2026-01-01T10:00:00.000Z"
    ).getTime();

    const scans = [];
    for (let i = 0; i <= currentStepIndex; i++) {
      const st = STATUS_ORDER[i];
      const stageInfo = buildStageScanDetails(st);
      const ts =
        eventTimeByStatus[st] ||
        new Date(baseTime + i * 3600 * 1000 * 2).toISOString();

      scans.push({
        $id: `stage-${st}`,
        status: st,
        title: stageInfo.title,
        description: stageInfo.description,
        locationText: stageInfo.locationText,
        timestamp: ts,
      });
    }

    return scans.reverse();
  }, [shipment, events, currentStepIndex, buildStageScanDetails]);

  /* HANDLERS */

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text));
      toast.success(`${label} copied!`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setShowDetails(true);
    fetchTracking(
      trackingInput || displayAwb || urlTrackingId || urlOrderId,
      shipment?.orderId || order?.orderId || order?.$id || urlOrderId,
      urlReturnId
    );
  };

  const handleBack = () => {
    const resolvedOrdId =
      shipment?.orderId || order?.orderId || order?.$id || urlOrderId;
    if (resolvedOrdId) {
      navigate(
        `/order-details?orderId=${encodeURIComponent(resolvedOrdId)}`,
        { state: order }
      );
    } else {
      navigate("/orders");
    }
  };

  /* REUSABLE SUB-BLOCKS FOR THE 4 UNIQUE PORTAL STRUCTURES */

  const renderDeliveryExecutiveCard = () => {
    if (!showDeliveryPartnerCard) return null;

    const initialLetter =
      assignedDeliveryBoy.initial ||
      String(assignedDeliveryBoy.name || "D")
        .trim()
        .charAt(0)
        .toUpperCase() ||
      "D";

    const dynamicPhone = formatMaskedDeliveryPhone(
      assignedDeliveryBoy.rawPhone,
      phoneRollSeed
    );

    return (
      <div className="cp-agent-card">
        <div className="cp-agent-card-header">
          <span className="cp-agent-courier-badge">
            <FaTruck size={11} />
            <span>{detectedCourier.name} Official Delivery Partner</span>
          </span>
          <span className="cp-agent-live-tag">
            <span className="cp-pulse-dot" />
            {currentStatus === "DELIVERED"
              ? "Delivered by Executive"
              : `In Transit • ${destCityName} (${detectedCourier.code}-${destCode})`}
          </span>
        </div>

        <div className="cp-agent-card-body">
          {/* IMAGE 1 FIX: First letter of Delivery Boy's Name in Avatar */}
          <div
            className="cp-agent-avatar"
            title={assignedDeliveryBoy.name}
            aria-label={assignedDeliveryBoy.name}
          >
            <span className="cp-agent-avatar-letter">{initialLetter}</span>
          </div>

          <div className="cp-agent-details">
            <span className="cp-agent-role-label">
              Assigned Delivery Executive ({detectedCourier.name})
            </span>
            <h4 className="cp-agent-name">{assignedDeliveryBoy.name}</h4>

            {/* Delivery Boy Hub & Destination Route Address */}
            <div className="cp-agent-address-line">
              <FaMapMarkerAlt size={12} />
              <span>
                {cleanDestLocation} • {destFullAddress}
                {destPincode ? ` • PIN ${destPincode}` : ""}
              </span>
            </div>

            <div className="cp-agent-phone-pill">
              <FaPhoneAlt size={11} />
              <span>{dynamicPhone}</span>
            </div>
          </div>

          <div className="cp-agent-meta-right">
            <div className="cp-agent-id-chip">
              <FaIdBadge size={12} />
              <span>
                {detectedCourier.code}-{destCode} Verified
              </span>
            </div>
            <small className="cp-agent-privacy-note">
              Hub Code: {detectedCourier.code}-LM-{destCode}
            </small>
            {currentStatus === "OUT_FOR_DELIVERY" && activeDeliveryOtp && (
              <button
                type="button"
                onClick={() => handleCopy(activeDeliveryOtp, "Delivery OTP")}
                style={{
                  marginTop: "8px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1.5px dashed #3b82f6",
                  background: "rgba(37, 99, 235, 0.12)",
                  color: "#2563eb",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  letterSpacing: "1.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
                title="Click to copy Delivery OTP"
              >
                <FaShieldAlt size={12} />
                <span>OTP: {activeDeliveryOtp}</span>
                <FaCopy size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMilestoneStepper = () => (
    <div className="cp-milestones-wrap">
      <div className="cp-milestones-track">
        {STATUS_ORDER.map((st, idx) => {
          const isCompleted =
            currentStepIndex > idx || currentStatus === "DELIVERED";
          const isActive =
            currentStepIndex === idx && currentStatus !== "DELIVERED";

          return (
            <div
              key={st}
              className={`cp-milestone-step ${
                isCompleted ? "completed" : isActive ? "active" : "pending"
              }`}
            >
              {idx < STATUS_ORDER.length - 1 && (
                <div
                  className={`cp-milestone-line ${
                    currentStepIndex > idx ? "completed" : ""
                  }`}
                />
              )}

              <div className="cp-milestone-dot">
                {isCompleted ? "✓" : idx + 1}
              </div>

              <div className="cp-milestone-label">{STATUS_LABELS[st]}</div>

              <span className="cp-milestone-state">
                {isCompleted
                  ? "Reached"
                  : isActive
                  ? "Parcel Here"
                  : "Pending"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderReturnExchangeSection = () => {
    if (!returnRequest) return null;

    return (
      <section className="cp-live-position-card">
        <div className="cp-section-head">
          <div className="cp-section-title-group">
            <div className="cp-section-icon">
              {returnType === "EXCHANGE" ? <FaExchangeAlt /> : <FaUndoAlt />}
            </div>
            <div>
              <h3 className="cp-section-title">
                {returnType === "EXCHANGE"
                  ? "Exchange Shipment Progress"
                  : "Return Pickup Progress"}
              </h3>
              <p className="cp-section-subtitle">
                Reference ID: {returnRequest.referenceId || "N/A"} • Handled by{" "}
                {detectedCourier.name}
              </p>
            </div>
          </div>

          <span className="cp-status-badge">
            {returnSteps[returnStepIndex]?.label || normalizedReturnStatus}
          </span>
        </div>

        <div className="cp-milestones-wrap">
          <div
            className="cp-milestones-track"
            style={{
              gridTemplateColumns: `repeat(${returnSteps.length}, minmax(105px, 1fr))`,
            }}
          >
            {returnSteps.map((step, idx) => {
              const isCompleted = returnStepIndex > idx;
              const isActive = returnStepIndex === idx;

              return (
                <div
                  key={step.key}
                  className={`cp-milestone-step ${
                    isCompleted ? "completed" : isActive ? "active" : "pending"
                  }`}
                >
                  {idx < returnSteps.length - 1 && (
                    <div
                      className={`cp-milestone-line ${
                        returnStepIndex > idx ? "completed" : ""
                      }`}
                    />
                  )}
                  <div className="cp-milestone-dot">
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div className="cp-milestone-label">{step.label}</div>
                  <span className="cp-milestone-state">
                    {isCompleted
                      ? "Completed"
                      : isActive
                      ? "Current"
                      : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderScanHistoryCard = () => (
    <section className="cp-card cp-scan-card">
      <div className="cp-section-head">
        <div className="cp-section-title-group">
          <div className="cp-section-icon">
            <FaBoxOpen />
          </div>
          <div>
            <h3 className="cp-section-title">
              {detectedCourier.name} Scan History
            </h3>
            <p className="cp-section-subtitle">
              Checkpoint-by-checkpoint parcel movement log
            </p>
          </div>
        </div>

        <span className="cp-brand-code-pill">{displayScans.length} Scans</span>
      </div>

      <div className="cp-scan-list">
        {displayScans.map((scan, index) => {
          const isLatest = index === 0;
          const scanStatus = normalizeStatus(scan?.status);
          return (
            <div
              key={scan.$id || `${scanStatus}-${index}`}
              className={`cp-scan-item ${isLatest ? "latest" : ""}`}
            >
              <div className="cp-scan-marker-col">
                <div className="cp-scan-dot">{isLatest ? "●" : "✓"}</div>
                {index < displayScans.length - 1 && (
                  <div className="cp-scan-line" />
                )}
              </div>

              <div className="cp-scan-body">
                <div className="cp-scan-top">
                  <h4 className="cp-scan-title">
                    {scan.title || STATUS_LABELS[scanStatus] || scanStatus}
                  </h4>
                  <span className="cp-scan-time">
                    {formatDate(scan.timestamp)}
                  </span>
                </div>

                {scan.description && (
                  <p className="cp-scan-desc">{scan.description}</p>
                )}

                {scan.locationText && (
                  <div className="cp-scan-loc">
                    <FaMapMarkerAlt size={11} />
                    <span>{scan.locationText}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderShipmentSummaryCard = () => (
    <section className="cp-card cp-summary-card">
      <div className="cp-section-head">
        <div className="cp-section-title-group">
          <div className="cp-section-icon">
            <FaCheckCircle />
          </div>
          <div>
            <h3 className="cp-section-title">Shipment Details</h3>
            <p className="cp-section-subtitle">
              Essential parcel & consignee information
            </p>
          </div>
        </div>
      </div>

      <div className="cp-info-grid">
        <div className="cp-info-box">
          <span className="cp-info-label">AWB / Tracking ID</span>
          <div className="cp-info-value">
            <span>{displayAwb}</span>
            <button
              type="button"
              className="btn btn-sm p-0 border-0 text-muted"
              onClick={() => handleCopy(displayAwb, "AWB ID")}
              title="Copy AWB"
            >
              <FaCopy size={12} />
            </button>
          </div>
        </div>

        <div className="cp-info-box">
          <span className="cp-info-label">Order ID</span>
          <div className="cp-info-value">
            <span>
              {shipment?.orderId || order?.orderId || order?.$id || "N/A"}
            </span>
            <button
              type="button"
              className="btn btn-sm p-0 border-0 text-muted"
              onClick={() =>
                handleCopy(
                  shipment?.orderId || order?.orderId || "",
                  "Order ID"
                )
              }
              title="Copy Order ID"
            >
              <FaCopy size={12} />
            </button>
          </div>
        </div>

        <div className="cp-info-box">
          <span className="cp-info-label">Courier Partner</span>
          <div className="cp-info-value">
            <span>
              {detectedCourier.name} ({detectedCourier.code})
            </span>
          </div>
        </div>

        <div className="cp-info-box">
          <span className="cp-info-label">Current Status</span>
          <div className="cp-info-value">
            <span style={{ color: "var(--cp-primary)" }}>
              {STATUS_LABELS[currentStatus] || currentStatus}
            </span>
          </div>
        </div>

        {showDeliveryPartnerCard && (
          <div className="cp-info-box full">
            <span className="cp-info-label">
              Assigned Delivery Executive ({detectedCourier.name})
            </span>
            <div className="cp-info-value">
              <span>
                {assignedDeliveryBoy.name} •{" "}
                {formatMaskedDeliveryPhone(
                  assignedDeliveryBoy.rawPhone,
                  phoneRollSeed
                )}
              </span>
            </div>
          </div>
        )}

        <div className="cp-info-box full">
          <span className="cp-info-label">Origin Facility</span>
          <div className="cp-info-value">
            <span>
              {originHubName} ({detectedCourier.code}-WH-{originCode}) —{" "}
              {cleanOriginLocation}
            </span>
          </div>
        </div>

        <div className="cp-info-box full">
          <span className="cp-info-label">Delivery Address (Destination)</span>
          <div className="cp-info-value">
            <span>
              {destFullAddress}, {cleanDestLocation}
              {destPincode ? ` - PIN ${destPincode}` : ""}
            </span>
          </div>
        </div>
      </div>

      {currentStatus === "OUT_FOR_DELIVERY" && (
        <div className="cp-otp-banner">
          <FaShieldAlt
            size={22}
            style={{ color: "var(--cp-primary)", flexShrink: 0 }}
          />
          <div>
            <strong className="d-block" style={{ fontSize: "13px" }}>
              Delivery OTP Verification Active
            </strong>
            <small className="text-muted">
              Share your delivery OTP with the {detectedCourier.name} agent (
              {assignedDeliveryBoy?.name || "Delivery Partner"}) only at the
              time of doorstep handover.
            </small>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div className="mt-3 text-end">
          <small className="text-muted" style={{ fontSize: "11px" }}>
            Synced with Appwrite at{" "}
            {lastUpdated.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        </div>
      )}
    </section>
  );

  const renderThreePointRouteNodes = () => (
    <div className="cp-live-route-grid">
      {/* 1. ORIGIN */}
      <div className="cp-route-node">
        <div>
          <div className="cp-node-tag">
            <FaWarehouse /> 1. Dispatched From (Origin)
          </div>
          <h4 className="cp-node-place">{cleanOriginLocation}</h4>
          <p className="cp-node-desc">
            {originHubName} • Code: {detectedCourier.code}-ORG-{originCode}
          </p>
        </div>
        <div className="cp-node-footer">
          <span>✓ Origin Processed</span>
          <span>{formatDateOnly(shipment?.$createdAt)}</span>
        </div>
      </div>

      {/* 2. CURRENT PARCEL LOCATION (CLEAN TRANSIT / HUB CODE + ADDRESS) */}
      <div className="cp-route-node current-node">
        <div>
          <div className="cp-node-tag">
            <span className="cp-pulse-dot" />
            2. Current Parcel Position (Live)
          </div>
          <h4 className="cp-node-place">{livePositionInfo.currentPlace}</h4>
          <p className="cp-node-desc">{livePositionInfo.currentNote}</p>
        </div>
        <div className="cp-node-footer">
          <span>{livePositionInfo.footerLeft}</span>
          <span>{livePositionInfo.footerRight}</span>
        </div>
      </div>

      {/* 3. DESTINATION */}
      <div className="cp-route-node">
        <div>
          <div className="cp-node-tag">
            <FaMapMarkerAlt /> 3. Final Destination
          </div>
          <h4 className="cp-node-place">{cleanDestLocation}</h4>
          <p className="cp-node-desc">
            {destFullAddress}
            {destPincode ? ` • PIN ${destPincode}` : ""}
          </p>
        </div>
        <div className="cp-node-footer">
          <span>
            {currentStatus === "DELIVERED"
              ? "✓ Reached Doorstep"
              : "⏳ Upcoming Delivery"}
          </span>
          <span>ETA: {formatDateOnly(shipment?.estimatedDeliveryDate)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`courier-portal-wrapper ${detectedCourier.cssClass} ${detectedCourier.layout} theme-${themeMode}`}
      data-theme={themeMode}
    >
      <div className="courier-portal-bg">
        {/* 1. STICKY COURIER PORTAL TOPBAR (NO SWITCHER!) */}
        <header className="cp-topbar">
          <div className="cp-container cp-topbar-inner">
            <div className="cp-topbar-left">
              <button
                type="button"
                className="cp-back-btn"
                onClick={handleBack}
              >
                <FaArrowLeft size={12} />
                <span>Back to Order</span>
              </button>

              <div className="cp-brand-block">
                <div className="cp-brand-logo">{detectedCourier.code}</div>
                <div className="cp-brand-text">
                  <div className="cp-brand-name-row">
                    <h1 className="cp-brand-name">{detectedCourier.name}</h1>
                    <span className="cp-brand-code-pill">
                      {detectedCourier.badgeText}
                    </span>
                  </div>
                  <p className="cp-brand-tagline">{detectedCourier.tagline}</p>
                </div>
              </div>
            </div>

            {/* THEME TOGGLE + REFRESH */}
            <div className="cp-topbar-actions">
              <button
                type="button"
                className="cp-icon-btn"
                onClick={() => dispatch(toggleTheme())}
                title="Toggle Light / Dark Theme"
              >
                {themeMode === "dark" ? (
                  <>
                    <FaSun className="text-warning" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <FaMoon />
                    <span>Dark</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="cp-icon-btn"
                onClick={() =>
                  fetchTracking(
                    trackingInput || urlTrackingId || urlOrderId,
                    shipment?.orderId || order?.orderId || order?.$id || urlOrderId,
                    urlReturnId
                  )
                }
                disabled={loading}
              >
                <FaSyncAlt className={loading ? "fa-spin" : ""} />
                <span>Sync</span>
              </button>
            </div>
          </div>
        </header>

        <div className="cp-container">
          {/* 2. COURIER HERO BANNER & AWB SEARCH */}
          <section className="cp-hero-banner">
            <div className="cp-hero-top">
              <div>
                <div className="cp-hero-badge-row">
                  <span className="cp-live-pill">
                    <span className="cp-live-dot" />
                    {detectedCourier.name} Official Tracking Portal
                  </span>

                  {(shipment?.orderId || order?.orderId || urlOrderId) && (
                    <span className="cp-live-pill">
                      Order #{shipment?.orderId || order?.orderId || urlOrderId}
                    </span>
                  )}
                </div>

                <h2 className="cp-awb-title">
                  <span>AWB: {displayAwb}</span>
                  <button
                    type="button"
                    className="cp-copy-chip"
                    onClick={() => handleCopy(displayAwb, "AWB Tracking ID")}
                  >
                    <FaCopy size={11} /> Copy AWB
                  </button>
                </h2>

                <p className="cp-hero-sub">
                  {STATUS_DESCRIPTIONS[currentStatus] ||
                    "Your parcel is moving safely through our logistics network."}
                </p>
              </div>

              <div className="cp-hero-eta-box">
                <span className="cp-hero-eta-label">
                  {currentStatus === "DELIVERED"
                    ? "Delivered On"
                    : "Estimated Delivery"}
                </span>
                <strong className="cp-hero-eta-date">
                  {currentStatus === "DELIVERED"
                    ? formatDateOnly(
                        shipment?.deliveredAt || shipment?.$updatedAt
                      )
                    : formatDateOnly(shipment?.estimatedDeliveryDate)}
                </strong>
                <span className="cp-hero-eta-status">
                  ● {STATUS_LABELS[currentStatus] || currentStatus}
                </span>
              </div>
            </div>

            <form className="cp-hero-search" onSubmit={handleSearchSubmit}>
              <div className="cp-search-input-wrap">
                <FaSearch size={13} />
                <input
                  type="text"
                  className="cp-search-input"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder={`Enter ${detectedCourier.name} AWB or Order ID...`}
                />
              </div>
              <button
                type="submit"
                className="cp-search-btn"
                disabled={loading}
              >
                {loading ? "Tracking..." : "Track Parcel"}
              </button>
            </form>
          </section>

          {/* ERROR MESSAGE */}
          {showDetails && error && (
            <div className="cp-empty-card">
              <h4 className="fw-bold mb-2 text-danger">Unable to Find Parcel</h4>
              <p className="mb-0 text-muted">{error}</p>
            </div>
          )}

          {/* LOADING STATE */}
          {showDetails && loading && !shipment && (
            <div className="cp-empty-card">
              <FaSyncAlt className="fa-spin mb-3" size={28} />
              <h4 className="fw-bold mb-1">
                Fetching Live {detectedCourier.name} Scans...
              </h4>
              <p className="mb-0 text-muted">
                Connecting to Appwrite shipment & hub telemetry.
              </p>
            </div>
          )}

          {/* 3. UNIQUE PORTAL STRUCTURES PER COURIER BRAND */}
          {shipment && showDetails && (
            <>
              {/* PORTAL 1: FastNexTech (Express Split Ribbon + 2-Col) */}
              {detectedCourier.key === "FastNexTech" && (
                <div className="cp-layout-fntx">
                  {renderDeliveryExecutiveCard()}

                  <section className="cp-live-position-card">
                    <div className="cp-section-head">
                      <div className="cp-section-title-group">
                        <div className="cp-section-icon">
                          <FaRoute />
                        </div>
                        <div>
                          <h3 className="cp-section-title">
                            FastNexTech Express Route & Parcel Position
                          </h3>
                          <p className="cp-section-subtitle">
                            Real-time air & surface linehaul telemetry
                          </p>
                        </div>
                      </div>

                      <span
                        className={`cp-status-badge ${
                          currentStatus === "DELIVERED"
                            ? "delivered"
                            : currentStatus === "CANCELLED"
                            ? "cancelled"
                            : ""
                        }`}
                      >
                        <FaTruck size={13} />
                        <span>
                          {STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
                      </span>
                    </div>

                    {renderThreePointRouteNodes()}
                    {renderMilestoneStepper()}
                  </section>

                  {renderReturnExchangeSection()}

                  <div className="cp-two-col">
                    {renderScanHistoryCard()}
                    {renderShipmentSummaryCard()}
                  </div>
                </div>
              )}

              {/* PORTAL 2: DeTechLiv (Enterprise Left Sidebar + Right Command Panel) */}
              {detectedCourier.key === "DeTechLiv" && (
                <div className="cp-layout-dtl">
                  <div className="cp-dtl-enterprise-grid">
                    {/* LEFT SIDEBAR: EXECUTIVE + SUMMARY */}
                    <div className="cp-dtl-sidebar">
                      {renderDeliveryExecutiveCard()}
                      {renderShipmentSummaryCard()}
                    </div>

                    {/* RIGHT MAIN PANEL: MILESTONES + ROUTE + SCANS */}
                    <div className="cp-dtl-main">
                      <section className="cp-live-position-card">
                        <div className="cp-section-head">
                          <div className="cp-section-title-group">
                            <div className="cp-section-icon">
                              <FaRoute />
                            </div>
                            <div>
                              <h3 className="cp-section-title">
                                DeTechLiv Precision Supply Chain Matrix
                              </h3>
                              <p className="cp-section-subtitle">
                                Live hub-to-hub progression & checkpoint status
                              </p>
                            </div>
                          </div>

                          <span
                            className={`cp-status-badge ${
                              currentStatus === "DELIVERED"
                                ? "delivered"
                                : currentStatus === "CANCELLED"
                                ? "cancelled"
                                : ""
                            }`}
                          >
                            <FaTruck size={13} />
                            <span>
                              {STATUS_LABELS[currentStatus] || currentStatus}
                            </span>
                          </span>
                        </div>

                        {renderMilestoneStepper()}
                        <div className="mt-4">{renderThreePointRouteNodes()}</div>
                      </section>

                      {renderReturnExchangeSection()}
                      {renderScanHistoryCard()}
                    </div>
                  </div>
                </div>
              )}

              {/* PORTAL 3: TechFonish (E-Commerce Stepper First + 3-Card Showcase) */}
              {detectedCourier.key === "TechFonish" && (
                <div className="cp-layout-tfn">
                  {/* STEPPER BANNER FIRST */}
                  <section className="cp-live-position-card cp-tfn-stepper-card">
                    <div className="cp-section-head">
                      <div className="cp-section-title-group">
                        <div className="cp-section-icon">
                          <FaTruck />
                        </div>
                        <div>
                          <h3 className="cp-section-title">
                            TechFonish Priority Fulfillment Tracker
                          </h3>
                          <p className="cp-section-subtitle">
                            7-stage verified e-commerce delivery pipeline
                          </p>
                        </div>
                      </div>

                      <span
                        className={`cp-status-badge ${
                          currentStatus === "DELIVERED"
                            ? "delivered"
                            : currentStatus === "CANCELLED"
                            ? "cancelled"
                            : ""
                        }`}
                      >
                        <FaClock size={12} />
                        <span>
                          {STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
                      </span>
                    </div>

                    {renderMilestoneStepper()}
                  </section>

                  {/* ASSIGNED DELIVERY BOY FULL HIGHLIGHT */}
                  {renderDeliveryExecutiveCard()}

                  {renderReturnExchangeSection()}

                  {/* 3-POINT ROUTE */}
                  <section className="cp-live-position-card">
                    <div className="cp-section-head">
                      <div className="cp-section-title-group">
                        <div className="cp-section-icon">
                          <FaMapMarkerAlt />
                        </div>
                        <div>
                          <h3 className="cp-section-title">
                            Where Is My Parcel Right Now?
                          </h3>
                          <p className="cp-section-subtitle">
                            Origin facility, live checkpoint, and doorstep
                            destination
                          </p>
                        </div>
                      </div>
                    </div>
                    {renderThreePointRouteNodes()}
                  </section>

                  {/* REVERSED 2-COLUMN: SUMMARY LEFT, SCANS RIGHT */}
                  <div className="cp-two-col cp-two-col-reverse">
                    {renderShipmentSummaryCard()}
                    {renderScanHistoryCard()}
                  </div>
                </div>
              )}

              {/* PORTAL 4: Technoe (AI Hyperlocal KPI Strip + Radar Layout) */}
              {detectedCourier.key === "Technoe" && (
                <div className="cp-layout-tne">
                  {/* 4-KPI TELEMETRY STRIP */}
                  <div className="cp-tne-kpi-grid">
                    <div className="cp-tne-kpi-card">
                      <span className="cp-tne-kpi-label">CARRIER NETWORK</span>
                      <strong className="cp-tne-kpi-val">
                        {detectedCourier.name} ({detectedCourier.code})
                      </strong>
                      <small className="cp-tne-kpi-sub">
                        AI Hyperlocal Routing
                      </small>
                    </div>

                    <div className="cp-tne-kpi-card">
                      <span className="cp-tne-kpi-label">CURRENT HUB CODE</span>
                      <strong className="cp-tne-kpi-val">
                        {currentStatus === "IN_TRANSIT"
                          ? `${transitHub.city} (${detectedCourier.code}-${transitHub.code})`
                          : currentStatus === "OUT_FOR_DELIVERY" ||
                            currentStatus === "REACHED_HUB" ||
                            currentStatus === "DELIVERED"
                          ? `${destCityName} (${detectedCourier.code}-${destCode})`
                          : `${originCityName} (${detectedCourier.code}-${originCode})`}
                      </strong>
                      <small className="cp-tne-kpi-sub">
                        {STATUS_LABELS[currentStatus] || currentStatus}
                      </small>
                    </div>

                    <div className="cp-tne-kpi-card">
                      <span className="cp-tne-kpi-label">DELIVERY AGENT</span>
                      <strong className="cp-tne-kpi-val">
                        {showDeliveryPartnerCard
                          ? assignedDeliveryBoy.name
                          : "Assigning at Hub"}
                      </strong>
                      <small className="cp-tne-kpi-sub">
                        {showDeliveryPartnerCard
                          ? formatMaskedDeliveryPhone(
                              assignedDeliveryBoy.rawPhone,
                              phoneRollSeed
                            )
                          : "Assigned on Out for Delivery"}
                      </small>
                    </div>

                    <div className="cp-tne-kpi-card">
                      <span className="cp-tne-kpi-label">DESTINATION PIN</span>
                      <strong className="cp-tne-kpi-val">
                        {destCityName} {destPincode ? `(${destPincode})` : ""}
                      </strong>
                      <small className="cp-tne-kpi-sub">
                        ETA: {formatDateOnly(shipment?.estimatedDeliveryDate)}
                      </small>
                    </div>
                  </div>

                  {renderDeliveryExecutiveCard()}

                  <section className="cp-live-position-card">
                    <div className="cp-section-head">
                      <div className="cp-section-title-group">
                        <div className="cp-section-icon">
                          <FaRoute />
                        </div>
                        <div>
                          <h3 className="cp-section-title">
                            Technoe AI Live Parcel Radar
                          </h3>
                          <p className="cp-section-subtitle">
                            Automated checkpoint telemetry & doorstep handoff
                          </p>
                        </div>
                      </div>

                      <span
                        className={`cp-status-badge ${
                          currentStatus === "DELIVERED"
                            ? "delivered"
                            : currentStatus === "CANCELLED"
                            ? "cancelled"
                            : ""
                        }`}
                      >
                        <FaTruck size={13} />
                        <span>
                          {STATUS_LABELS[currentStatus] || currentStatus}
                        </span>
                      </span>
                    </div>

                    {renderThreePointRouteNodes()}
                    {renderMilestoneStepper()}
                  </section>

                  {renderReturnExchangeSection()}

                  <div className="cp-two-col">
                    {renderScanHistoryCard()}
                    {renderShipmentSummaryCard()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrackOrder;
