import { useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";
import {
    FaBoxOpen,
    FaCheckCircle,
    FaChevronRight,
    FaEye,
    FaMapMarkerAlt,
    FaSearch,
    FaShippingFast,
    FaTruck,
    FaUndo,
    FaExchangeAlt,
    FaTimes,
    FaUserCheck,
    FaUserTie,
    FaSyncAlt,
    FaClock,
    FaRoute,
    FaBox,
} from "react-icons/fa";
import toast from "react-hot-toast";

import shipmentService from "../../appwrite/shipmentService";
import shipmentEventService from "../../appwrite/shipmentEventService";
import shipmentHelper from "../../appwrite/shipmentHelper";
import returnExchangeService from "../../appwrite/returnExchangeService";
import orderService from "../../appwrite/orderService";
import {
    getActiveDeliveryItems,
    getCancelledOrderItems,
    resolveReturnRequestItem,
    extractCleanReason,
} from "../../utils/orderItemHelper";
import { databases } from "../../appwrite/config";
import { Query } from "appwrite";

/* STATUS FLOW */

const NEXT_STATUS = {
    PLACED: "PACKED",
    PACKED: "DISPATCHED",
    DISPATCHED: "IN_TRANSIT",
    IN_TRANSIT: "REACHED_HUB",
    REACHED_HUB: "OUT_FOR_DELIVERY",
};

/* STATUS LABEL */

const getStatusLabel = (status) => {
    const labels = {
        PLACED: "Placed",
        PACKED: "Packed",
        DISPATCHED: "Dispatched",
        IN_TRANSIT: "In Transit",
        REACHED_HUB: "Reached Hub",
        OUT_FOR_DELIVERY: "Out for Delivery",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
        EXCEPTION: "Exception",

        REQUESTED: "Requested",
        ACCEPTED: "Exchange Accepted",
        CONFIRMED: "Confirmed",
        OUT_FOR_EXCHANGE: "Out for Exchange",
        PICKUP_ASSIGNED: "Out for Exchange / Pickup",
        PICKED_UP: "Picked Up",
        REFUND_INITIATED: "Refund Initiated",
        REFUND_COMPLETED: "Refund Completed",
        REFUNDED: "Refunded",
        EXCHANGE_COMPLETED: "Exchange Complete",
        EXCHANGED: "Exchanged",
    };

    return labels[status] || status || "—";
};

/* STATUS COLORS */

const getStatusClass = (status) => {
    const classes = {
        PLACED: "shipment-status placed",
        PACKED: "shipment-status packed",
        DISPATCHED: "shipment-status dispatched",
        IN_TRANSIT: "shipment-status transit",
        REACHED_HUB: "shipment-status hub",
        OUT_FOR_DELIVERY: "shipment-status delivery",
        DELIVERED: "shipment-status delivered",
        CANCELLED: "shipment-status cancelled",
        EXCEPTION: "shipment-status cancelled",

        REQUESTED: "shipment-status requested",
        ACCEPTED: "shipment-status confirmed",
        CONFIRMED: "shipment-status confirmed",
        OUT_FOR_EXCHANGE: "shipment-status assigned",
        PICKUP_ASSIGNED: "shipment-status assigned",
        PICKED_UP: "shipment-status transit",
        REFUND_INITIATED: "shipment-status transit",
        REFUND_COMPLETED: "shipment-status delivered",
        REFUNDED: "shipment-status delivered",
        EXCHANGE_COMPLETED: "shipment-status delivered",
        EXCHANGED: "shipment-status delivered",
    };

    return classes[status] || "shipment-status default";
};

/* STATUS ICON */

const getStatusIcon = (status) => {
    if (
        status === "DELIVERED" ||
        status === "REFUNDED" ||
        status === "REFUND_COMPLETED" ||
        status === "EXCHANGE_COMPLETED" ||
        status === "EXCHANGED"
    ) {
        return <FaCheckCircle />;
    }

    if (
        status === "DISPATCHED" ||
        status === "IN_TRANSIT" ||
        status === "OUT_FOR_DELIVERY" ||
        status === "PICKED_UP"
    ) {
        return <FaTruck />;
    }

    if (status === "PICKUP_ASSIGNED") {
        return <FaUserCheck />;
    }

    if (
        status === "CONFIRMED" ||
        status === "REQUESTED"
    ) {
        return <FaUndo />;
    }

    return <FaBoxOpen />;
};

/* DATE */

const formatDate = (date) => {
    if (!date) return "—";

    try {
        return new Date(date).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
};

/* REQUEST TYPE */

const getRequestTypeLabel = (type) => {
    if (type === "RETURN") return "Return";
    if (type === "EXCHANGE") return "Exchange";

    return type || "Request";
};

const parseAppwriteAssignmentEvents = (eventsDocs = []) => {
    const map = {};
    for (const ev of eventsDocs) {
        const desc = String(ev?.description || "");
        if (desc.startsWith("DELIVERY_BOY_ASSIGNED:")) {
            const parts = desc.split(":");
            const deliveryBoyId = parts[1] || "";
            const deliveryBoyName = parts.slice(2).join(":") || "Delivery Boy";
            if (deliveryBoyId) {
                const info = { deliveryBoyId, deliveryBoyName };
                if (ev?.shipmentId && !map[String(ev.shipmentId)]) {
                    map[String(ev.shipmentId)] = info;
                }
                if (ev?.orderId && !map[`order_${ev.orderId}`]) {
                    map[`order_${ev.orderId}`] = info;
                }
            }
        }
    }
    return map;
};

/* COMPONENT */

function AdminShipments() {
    const [shipments, setShipments] = useState([]);
    const [ordersMap, setOrdersMap] = useState({});
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [selectedShipment, setSelectedShipment] =
        useState(null);

    const [updatingId, setUpdatingId] = useState(null);

    const [requests, setRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] =
        useState(true);

    const [selectedRequest, setSelectedRequest] =
        useState(null);

    const [requestUpdatingId, setRequestUpdatingId] =
        useState(null);

    const [deliveryBoys, setDeliveryBoys] = useState([]);
    const [deliveryBoysLoading, setDeliveryBoysLoading] =
        useState(false);

    const [assignmentRequest, setAssignmentRequest] =
        useState(null);

    const [assignmentShipment, setAssignmentShipment] =
        useState(null);


    const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] =
        useState("");

    const [assigningDeliveryBoy, setAssigningDeliveryBoy] =
        useState(false);

    /* LOAD SHIPMENTS */

    const loadShipments = async () => {
        try {
            setLoading(true);

            const response =
                await shipmentService.getShipments();

            let storedMap = {};
            try {
                const evRes = await shipmentEventService.getEvents();
                const evDocs = Array.isArray(evRes) ? evRes : evRes?.documents || [];
                storedMap = parseAppwriteAssignmentEvents(evDocs);
            } catch {
                storedMap = {};
            }
            const rawList = Array.isArray(response) ? response : [];
            const mergedList = rawList.map((item) => {
                const stored =
                    storedMap[String(item.$id)] ||
                    (item.orderId ? storedMap[`order_${item.orderId}`] : null);
                if (!item.deliveryBoyId && stored?.deliveryBoyId) {
                    return {
                        ...item,
                        deliveryBoyId: stored.deliveryBoyId,
                        deliveryBoyName: stored.deliveryBoyName || "",
                    };
                }
                return item;
            });

            setShipments(mergedList);
        } catch (error) {
            console.error(
                "Load shipments error:",
                error
            );

            toast.error(
                "Failed to load shipments."
            );

            setShipments([]);
        } finally {
            setLoading(false);
        }
    };

    /* LOAD RETURN / EXCHANGE REQUESTS */

    const loadRequests = async () => {
        try {
            setRequestsLoading(true);

            const response =
                await returnExchangeService.getAllRequests();

            const list =
                Array.isArray(response)
                    ? response
                    : response?.documents || [];

            setRequests(list);

            try {
                const allOrdersRes = await orderService.getAllOrders();
                const allOrdersDocs = Array.isArray(allOrdersRes?.documents)
                    ? allOrdersRes.documents
                    : Array.isArray(allOrdersRes)
                    ? allOrdersRes
                    : [];
                const map = {};
                allOrdersDocs.forEach((ord) => {
                    if (ord?.orderId) map[String(ord.orderId)] = ord;
                    if (ord?.$id) map[String(ord.$id)] = ord;
                });
                setOrdersMap(map);
            } catch (ordMapErr) {
                console.warn("Orders map load warning:", ordMapErr);
            }
        } catch (error) {
            console.error(
                "Load return/exchange requests error:",
                error
            );

            toast.error(
                "Failed to load return/exchange requests."
            );

            setRequests([]);
        } finally {
            setRequestsLoading(false);
        }
    };

    /* LOAD DELIVERY BOYS — IMPORTANT: — Appwrite role is deliveryBoy */

    const loadDeliveryBoys = async () => {
        try {
            setDeliveryBoysLoading(true);

            const databaseId =
                import.meta.env
                    .VITE_APPWRITE_DATABASE_ID;

            const usersCollectionId =
                import.meta.env
                    .VITE_APPWRITE_USERS_COLLECTION_ID ||
                "users";

            const response =
                await databases.listDocuments(
                    databaseId,
                    usersCollectionId,
                    [Query.limit(100)]
                );

            const documents =
                Array.isArray(response?.documents)
                    ? response.documents
                    : [];

            const list = documents
                .filter((user) => {
                    const role = String(
                        user?.role ||
                            user?.userRole ||
                            ""
                    )
                        .trim()
                        .toLowerCase();

                    const status = String(
                        user?.status ||
                            "active"
                    )
                        .trim()
                        .toLowerCase();

                    const isDeliveryBoy =
                        role === "deliveryboy" ||
                        role === "delivery_boy" ||
                        role === "delivery";

                    const isActive =
                        status === "active" ||
                        status === "approved" ||
                        status === "enabled" ||
                        !user?.status;

                    return (
                        isDeliveryBoy &&
                        isActive
                    );
                })
                .map((user) => ({
                    ...user,
                    displayName:
                        user?.name ||
                        user?.fullName ||
                        user?.username ||
                        user?.email ||
                        user?.userId ||
                        user?.$id,
                }));

            setDeliveryBoys(list);
        } catch (error) {
            console.error(
                "Load delivery boys error:",
                error
            );

            setDeliveryBoys([]);

            toast.error(
                "Failed to load delivery boys."
            );
        } finally {
            setDeliveryBoysLoading(false);
        }
    };

    /* INITIAL LOAD */

    useEffect(() => {
        loadShipments();
        loadRequests();
        loadDeliveryBoys();
    }, []);

    /* REFRESH */

    const refreshAll = async () => {
        await Promise.all([
            loadShipments(),
            loadRequests(),
            loadDeliveryBoys(),
        ]);

        toast.success("Dashboard refreshed.");
    };

    /* SHIPMENT STATS */

    const stats = useMemo(() => {
        return {
            total: shipments.length,

            placed: shipments.filter(
                (item) =>
                    item.status === "PLACED"
            ).length,

            packed: shipments.filter(
                (item) =>
                    item.status === "PACKED"
            ).length,

            dispatched: shipments.filter(
                (item) =>
                    item.status === "DISPATCHED"
            ).length,

            inTransit: shipments.filter(
                (item) =>
                    item.status === "IN_TRANSIT"
            ).length,

            outForDelivery: shipments.filter(
                (item) =>
                    item.status ===
                    "OUT_FOR_DELIVERY"
            ).length,

            delivered: shipments.filter(
                (item) =>
                    item.status === "DELIVERED"
            ).length,
        };
    }, [shipments]);

    /* REQUEST STATS */

    const requestStats = useMemo(() => {
        return {
            total: requests.length,

            requested: requests.filter(
                (item) =>
                    item.status ===
                    "REQUESTED"
            ).length,

            confirmed: requests.filter(
                (item) =>
                    item.status ===
                    "CONFIRMED"
            ).length,

            pickupAssigned: requests.filter(
                (item) =>
                    item.status ===
                    "PICKUP_ASSIGNED"
            ).length,

            cancelled: requests.filter(
                (item) =>
                    item.status ===
                    "CANCELLED"
            ).length,
        };
    }, [requests]);

    /* FILTER SHIPMENTS */

    const filteredShipments = useMemo(() => {
        const searchValue =
            search
                .trim()
                .toLowerCase();

        return shipments.filter(
            (shipment) => {
                const matchesSearch =
                    !searchValue ||
                    String(
                        shipment.orderId || ""
                    )
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(
                        shipment.trackingId || ""
                    )
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(
                        shipment.courier || ""
                    )
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(
                        shipment.destinationCity ||
                            ""
                    )
                        .toLowerCase()
                        .includes(searchValue);

                const matchesStatus =
                    statusFilter === "ALL" ||
                    shipment.status ===
                        statusFilter;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );
    }, [
        shipments,
        search,
        statusFilter,
    ]);

    /* UPDATE SHIPMENT STATUS */

    const handleStatusUpdate = async (
        shipment
    ) => {
        const nextStatus =
            NEXT_STATUS[
                shipment.status
            ];

        if (!nextStatus) {
            toast.error(
                "No next status available."
            );

            return;
        }

        try {
            setUpdatingId(
                shipment.$id
            );

            const result =
                await shipmentHelper.updateShipmentStatus(
                    shipment.$id,
                    nextStatus,
                    {
                        orderId:
                            shipment.orderId,
                    }
                );

            if (!result?.success) {
                throw new Error(
                    result?.error ||
                        "Shipment status update failed."
                );
            }

            const updatedShipment =
                result.shipment;

            if (!updatedShipment?.$id) {
                throw new Error(
                    "Updated shipment data not received."
                );
            }

            setShipments((prev) =>
                prev.map((item) =>
                    item.$id ===
                    shipment.$id
                        ? {
                              ...item,
                              ...updatedShipment,
                          }
                        : item
                )
            );

            setSelectedShipment(
                (prev) =>
                    prev?.$id ===
                    shipment.$id
                        ? {
                              ...prev,
                              ...updatedShipment,
                          }
                        : prev
            );

            if (
                nextStatus ===
                "OUT_FOR_DELIVERY"
            ) {
                toast.success(
                    "Shipment is out for delivery. Delivery OTP and customer notification created automatically."
                );
            } else {
                toast.success(
                    `Shipment moved to ${getStatusLabel(
                        nextStatus
                    )}`
                );
            }
        } catch (error) {
            console.error(
                "Status update error:",
                error
            );

            toast.error(
                error?.message ||
                    "Failed to update shipment."
            );
        } finally {
            setUpdatingId(null);
        }
    };

    /* CONFIRM REQUEST */

    const getNextRequestStep = (request) => {
        const isEx = String(request?.type || "").toUpperCase() === "EXCHANGE";
        const st = String(request?.status || "REQUESTED").toUpperCase();

        if (isEx) {
            if (st === "REQUESTED") {
                return { nextStatus: "ACCEPTED", buttonLabel: "Accept Exchange", toastLabel: "Exchange Accepted" };
            }
            if (st === "ACCEPTED") {
                return { nextStatus: "CONFIRMED", buttonLabel: "Move to Confirmed", toastLabel: "Confirmed" };
            }
            if (st === "CONFIRMED") {
                return { nextStatus: "PACKED", buttonLabel: "Move to Packed", toastLabel: "Packed" };
            }
            if (st === "PACKED") {
                return { nextStatus: "DISPATCHED", buttonLabel: "Move to Dispatched", toastLabel: "Dispatched" };
            }
            return null;
        } else {
            if (st === "REQUESTED") {
                return { nextStatus: "CONFIRMED", buttonLabel: "Accept Return", toastLabel: "Return Accepted" };
            }
            return null;
        }
    };

    const canAssignRequestDeliveryBoy = (request) => {
        const isEx = String(request?.type || "").toUpperCase() === "EXCHANGE";
        const st = String(request?.status || "").toUpperCase();
        if (isEx) {
            return st === "DISPATCHED";
        }
        return st === "CONFIRMED" || st === "ACCEPTED";
    };

    const handleConfirmRequest = async (
        request
    ) => {
        const stepInfo = getNextRequestStep(request);
        if (!stepInfo) {
            return;
        }

        try {
            setRequestUpdatingId(
                request.$id
            );

            const updated =
                await returnExchangeService.updateRequest(
                    request.$id,
                    {
                        status: stepInfo.nextStatus,
                    }
                );

            const updatedRequest = {
                ...request,
                ...updated,
                status: stepInfo.nextStatus,
            };

            setRequests((prev) =>
                prev.map((item) =>
                    item.$id ===
                    request.$id
                        ? updatedRequest
                        : item
                )
            );

            setSelectedRequest(
                (prev) =>
                    prev?.$id ===
                    request.$id
                        ? updatedRequest
                        : prev
            );

            toast.success(
                `${getRequestTypeLabel(
                    request.type
                )} moved to ${stepInfo.toastLabel}.`
            );
        } catch (error) {
            console.error(
                "Update request status error:",
                error
            );

            toast.error(
                error?.message ||
                    "Failed to update request status."
            );
        } finally {
            setRequestUpdatingId(null);
        }
    };

    /* CANCEL REQUEST */

    const handleCancelRequest = async (
        request
    ) => {
        if (
            request.status !==
            "REQUESTED"
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                `Are you sure you want to cancel this ${getRequestTypeLabel(
                    request.type
                ).toLowerCase()} request?`
            );

        if (!confirmed) return;

        try {
            setRequestUpdatingId(
                request.$id
            );

            const updated =
                await returnExchangeService.cancelRequest(
                    request.$id
                );

            const updatedRequest = {
                ...request,
                ...updated,
                status: "CANCELLED",
            };

            setRequests((prev) =>
                prev.map((item) =>
                    item.$id ===
                    request.$id
                        ? updatedRequest
                        : item
                )
            );

            setSelectedRequest(
                (prev) =>
                    prev?.$id ===
                    request.$id
                        ? updatedRequest
                        : prev
            );

            toast.success(
                `${getRequestTypeLabel(
                    request.type
                )} request cancelled.`
            );
        } catch (error) {
            console.error(
                "Cancel request error:",
                error
            );

            toast.error(
                error?.message ||
                    "Failed to cancel request."
            );
        } finally {
            setRequestUpdatingId(null);
        }
    };

    /* DELIVERY BOY DISPLAY HELPER */

    const getDeliveryBoyName = (idOrObj) => {
        const id =
            typeof idOrObj === "object"
                ? idOrObj?.deliveryBoyId
                : idOrObj;
        const fallbackName =
            typeof idOrObj === "object"
                ? idOrObj?.deliveryBoyName
                : "";

        if (!id) return "";

        const found = deliveryBoys.find(
            (boy) =>
                String(boy?.userId || boy?.$id) === String(id)
        );

        if (found?.displayName) {
            return found.displayName;
        }

        if (fallbackName) {
            return fallbackName;
        }

        return String(id).slice(0, 18);
    };

    /* ASSIGN DELIVERY BOY (SHIPMENT - OUT FOR DELIVERY) */

    const openAssignShipmentDeliveryBoy = (shipment) => {
        if (shipment?.status !== "OUT_FOR_DELIVERY") {
            return;
        }

        setAssignmentRequest(null);
        setAssignmentShipment(shipment);
        setSelectedDeliveryBoyId(
            String(shipment?.deliveryBoyId || "")
        );

        if (deliveryBoys.length === 0) {
            loadDeliveryBoys();
        }
    };

    const handleAssignShipmentDeliveryBoy = async () => {
        if (!assignmentShipment?.$id) {
            return;
        }

        if (!selectedDeliveryBoyId) {
            toast.error("Please select a delivery boy.");
            return;
        }

        const selectedBoy = deliveryBoys.find(
            (boy) =>
                String(boy?.userId || boy?.$id) ===
                String(selectedDeliveryBoyId)
        );

        const deliveryBoyId =
            selectedBoy?.userId || selectedBoy?.$id;

        if (!deliveryBoyId) {
            toast.error("Selected delivery boy ID is missing.");
            return;
        }

        const deliveryBoyName =
            selectedBoy?.displayName || "Delivery Boy";

        try {
            setAssigningDeliveryBoy(true);
            setUpdatingId(assignmentShipment.$id);

            let updatedDoc = null;
            try {
                updatedDoc = await shipmentService.updateShipment(
                    assignmentShipment.$id,
                    {
                        deliveryBoyId: String(deliveryBoyId),
                    }
                );
            } catch {
                // If Appwrite shipments collection does not have deliveryBoyId attribute, persist locally
            }

            try {
                await shipmentEventService.createEvent({
                    shipmentId: String(assignmentShipment.$id),
                    orderId: String(assignmentShipment.orderId || ""),
                    trackingId: String(assignmentShipment.trackingId || ""),
                    status: String(assignmentShipment.status || "OUT_FOR_DELIVERY"),
                    title: `Assigned to ${deliveryBoyName}`,
                    description: `DELIVERY_BOY_ASSIGNED:${deliveryBoyId}:${deliveryBoyName}`,
                    city: String(assignmentShipment.destinationCity || ""),
                    state: String(assignmentShipment.destinationState || ""),
                    hubName: String(deliveryBoyName),
                    timestamp: new Date().toISOString(),
                });
            } catch (eventErr) {
                console.warn("Appwrite assignment event log warning:", eventErr);
            }

            const updatedShipment = {
                ...assignmentShipment,
                ...(updatedDoc || {}),
                deliveryBoyId: String(deliveryBoyId),
                deliveryBoyName,
            };

            setShipments((prev) =>
                prev.map((item) =>
                    item.$id === assignmentShipment.$id
                        ? updatedShipment
                        : item
                )
            );

            setSelectedShipment((prev) =>
                prev?.$id === assignmentShipment.$id
                    ? updatedShipment
                    : prev
            );

            setAssignmentShipment(null);
            setSelectedDeliveryBoyId("");

            toast.success(
                `Order ${
                    assignmentShipment.orderId || ""
                } assigned to ${deliveryBoyName}.`
            );
        } catch (error) {
            console.error(
                "Assign shipment delivery boy error:",
                error
            );
            toast.error(
                error?.message ||
                    "Failed to assign delivery boy."
            );
        } finally {
            setAssigningDeliveryBoy(false);
            setUpdatingId(null);
        }
    };

    /* ASSIGN DELIVERY BOY (RETURN / EXCHANGE) */

    const openAssignDeliveryBoy = (
        request
    ) => {
        if (!canAssignRequestDeliveryBoy(request)) {
            return;
        }

        setAssignmentShipment(null);
        setAssignmentShipment(null);
        setAssignmentRequest(
            request
        );

        setSelectedDeliveryBoyId(
            String(
                request?.deliveryBoyId ||
                    ""
            )
        );

        if (
            deliveryBoys.length === 0
        ) {
            loadDeliveryBoys();
        }
    };

    const handleAssignDeliveryBoy =
        async () => {
            if (
                !assignmentRequest?.$id
            ) {
                return;
            }

            if (
                !selectedDeliveryBoyId
            ) {
                toast.error(
                    "Please select a delivery boy."
                );

                return;
            }

            const selectedBoy =
                deliveryBoys.find(
                    (boy) =>
                        String(
                            boy?.userId ||
                                boy?.$id
                        ) ===
                        String(
                            selectedDeliveryBoyId
                        )
                );

            const deliveryBoyId =
                selectedBoy?.userId ||
                selectedBoy?.$id;

            if (!deliveryBoyId) {
                toast.error(
                    "Selected delivery boy ID is missing."
                );

                return;
            }

            try {
                setAssigningDeliveryBoy(
                    true
                );

                setRequestUpdatingId(
                    assignmentRequest.$id
                );

                const updated =
                    await returnExchangeService.assignDeliveryBoy(
                        assignmentRequest.$id,
                        deliveryBoyId
                    );

                const updatedRequest = {
                    ...assignmentRequest,
                    ...updated,
                    deliveryBoyId:
                        String(
                            deliveryBoyId
                        ),
                    status:
                        "PICKUP_ASSIGNED",
                };

                setRequests((prev) =>
                    prev.map(
                        (item) =>
                            item.$id ===
                            assignmentRequest.$id
                                ? updatedRequest
                                : item
                    )
                );

                setSelectedRequest(
                    (prev) =>
                        prev?.$id ===
                        assignmentRequest.$id
                            ? updatedRequest
                            : prev
                );

                setAssignmentRequest(
                    null
                );

                setSelectedDeliveryBoyId(
                    ""
                );

                toast.success(
                    `${getRequestTypeLabel(
                        assignmentRequest.type
                    )} pickup assigned to ${
                        selectedBoy?.displayName ||
                        "delivery boy"
                    }.`
                );
            } catch (error) {
                console.error(
                    "Assign delivery boy error:",
                    error
                );

                toast.error(
                    error?.message ||
                        "Failed to assign delivery boy."
                );
            } finally {
                setAssigningDeliveryBoy(
                    false
                );

                setRequestUpdatingId(
                    null
                );
            }
        };

    /* UI */

    return (
        <>
            {/* PREMIUM LIGHT / DARK UI */}

            <style>{`
                .shipments-admin-page {
                    --ship-bg: #f5f7fb;
                    --ship-card: #ffffff;
                    --ship-card-soft: #f8fafc;
                    --ship-border: #e7ebf2;
                    --ship-text: #172033;
                    --ship-muted: #748096;
                    --ship-primary: #4f46e5;
                    --ship-primary-soft: #eef2ff;
                    --ship-shadow: 0 10px 35px rgba(15, 23, 42, .07);
                    --ship-shadow-hover: 0 18px 45px rgba(15, 23, 42, .12);
                    min-height: 100vh;
                    padding: 28px;
                    color: var(--ship-text);
                    background:
                        radial-gradient(
                            circle at top right,
                            rgba(99,102,241,.08),
                            transparent 30%
                        ),
                        var(--ship-bg);
                    transition:
                        background .25s ease,
                        color .25s ease;
                }

                body.dark .shipments-admin-page,
                body.dark-mode .shipments-admin-page {
                    --ship-bg: #0b1020;
                    --ship-card: #121a2b;
                    --ship-card-soft: #172136;
                    --ship-border: #263249;
                    --ship-text: #eef2ff;
                    --ship-muted: #9aa7bd;
                    --ship-primary: #818cf8;
                    --ship-primary-soft: rgba(99,102,241,.15);
                    --ship-shadow: 0 14px 40px rgba(0,0,0,.25);
                    --ship-shadow-hover: 0 20px 50px rgba(0,0,0,.38);
                }

                .shipments-admin-page * {
                    box-sizing: border-box;
                }

                .ship-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 28px;
                }

                .ship-title {
                    font-size: 30px;
                    font-weight: 800;
                    letter-spacing: -.7px;
                    margin: 0;
                }

                .ship-subtitle {
                    margin: 7px 0 0;
                    color: var(--ship-muted);
                    font-size: 14px;
                }

                .ship-refresh-btn {
                    border: 1px solid rgba(79, 70, 229, 0.28);
                    border-radius: 13px;
                    padding: 11px 18px;
                    background: linear-gradient(135deg, #4f46e5, #2563eb);
                    color: #ffffff !important;
                    font-weight: 700;
                    box-shadow: 0 8px 22px rgba(79, 70, 229, 0.25);
                    transition: .2s ease;
                }

                .ship-refresh-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                }

                .ship-card {
                    background: var(--ship-card);
                    border: 1px solid var(--ship-border);
                    border-radius: 20px;
                    box-shadow: var(--ship-shadow);
                    transition:
                        transform .2s ease,
                        box-shadow .2s ease,
                        background .25s ease,
                        border-color .25s ease;
                    overflow: hidden;
                }

                .ship-card:hover {
                    box-shadow: var(--ship-shadow-hover);
                }

                .ship-stat {
                    position: relative;
                    padding: 20px;
                    min-height: 128px;
                }

                .ship-stat::after {
                    content: "";
                    position: absolute;
                    right: -25px;
                    top: -35px;
                    width: 110px;
                    height: 110px;
                    border-radius: 50%;
                    background: var(--ship-primary-soft);
                }

                .ship-stat-icon {
                    width: 43px;
                    height: 43px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 13px;
                    background: var(--ship-primary-soft);
                    color: var(--ship-primary);
                    margin-bottom: 15px;
                    position: relative;
                    z-index: 2;
                }

                .ship-stat-label {
                    color: var(--ship-muted);
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 3px;
                }

                .ship-stat-value {
                    font-size: 25px;
                    line-height: 1;
                    font-weight: 800;
                    position: relative;
                    z-index: 2;
                }

                .ship-filter {
                    padding: 18px;
                    margin-bottom: 24px;
                }

                .ship-input-wrap {
                    position: relative;
                }

                .ship-input-icon {
                    position: absolute;
                    left: 15px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--ship-muted);
                    z-index: 3;
                }

                .ship-input,
                .ship-select {
                    width: 100%;
                    min-height: 48px;
                    border: 1px solid var(--ship-border) !important;
                    border-radius: 12px !important;
                    background: var(--ship-card-soft) !important;
                    color: var(--ship-text) !important;
                    padding: 10px 14px;
                    outline: none;
                    transition: .2s ease;
                }

                .ship-input {
                    padding-left: 43px !important;
                }

                .ship-input:focus,
                .ship-select:focus {
                    border-color: var(--ship-primary);
                    box-shadow: 0 0 0 4px rgba(99,102,241,.11);
                }

                .ship-table-wrap {
                    overflow-x: auto;
                }

                .ship-table {
                    width: 100%;
                    min-width: 1050px;
                    border-collapse: collapse;
                }

                .ship-table th {
                    background: var(--ship-card-soft);
                    color: var(--ship-muted);
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: .6px;
                    font-weight: 800;
                    padding: 15px 18px;
                    border-bottom: 1px solid var(--ship-border);
                    white-space: nowrap;
                }

                .ship-table td {
                    padding: 17px 18px;
                    border-bottom: 1px solid var(--ship-border);
                    color: var(--ship-text);
                    vertical-align: middle;
                }

                .ship-table tbody tr {
                    transition: background .18s ease;
                }

                .ship-table tbody tr:hover {
                    background: var(--ship-card-soft);
                }

                .ship-order {
                    font-weight: 800;
                    font-size: 14px;
                }

                .ship-small {
                    display: block;
                    margin-top: 4px;
                    color: var(--ship-muted);
                    font-size: 12px;
                }

                .ship-location {
                    display: flex;
                    align-items: flex-start;
                    gap: 9px;
                }

                .ship-location svg {
                    margin-top: 3px;
                    color: var(--ship-primary);
                }

                .shipment-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 11px;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 800;
                    white-space: nowrap;
                }

                .shipment-status.placed {
                    background: #eef2ff;
                    color: #4f46e5;
                }

                .shipment-status.packed {
                    background: #fff7df;
                    color: #a16207;
                }

                .shipment-status.dispatched {
                    background: #e0f2fe;
                    color: #0369a1;
                }

                .shipment-status.transit {
                    background: #e0f2fe;
                    color: #0369a1;
                }

                .shipment-status.hub {
                    background: #f1f5f9;
                    color: #475569;
                }

                .shipment-status.delivery {
                    background: #fff7df;
                    color: #a16207;
                }

                .shipment-status.delivered {
                    background: #dcfce7;
                    color: #15803d;
                }

                .shipment-status.cancelled {
                    background: #fee2e2;
                    color: #dc2626;
                }

                .shipment-status.requested {
                    background: #fff7df;
                    color: #a16207;
                }

                .shipment-status.confirmed {
                    background: #eef2ff;
                    color: #4f46e5;
                }

                .shipment-status.assigned {
                    background: #dcfce7;
                    color: #15803d;
                }

                .shipment-status.default {
                    background: var(--ship-card-soft);
                    color: var(--ship-muted);
                }

                body.dark .shipment-status.placed,
                body.dark-mode .shipment-status.placed {
                    background: rgba(99,102,241,.18);
                    color: #a5b4fc;
                }

                body.dark .shipment-status.packed,
                body.dark-mode .shipment-status.packed {
                    background: rgba(234,179,8,.16);
                    color: #fde68a;
                }

                body.dark .shipment-status.dispatched,
                body.dark-mode .shipment-status.dispatched,
                body.dark .shipment-status.transit,
                body.dark-mode .shipment-status.transit {
                    background: rgba(14,165,233,.15);
                    color: #7dd3fc;
                }

                body.dark .shipment-status.hub,
                body.dark-mode .shipment-status.hub {
                    background: rgba(148,163,184,.14);
                    color: #cbd5e1;
                }

                body.dark .shipment-status.delivery,
                body.dark-mode .shipment-status.delivery {
                    background: rgba(234,179,8,.16);
                    color: #fde68a;
                }

                body.dark .shipment-status.delivered,
                body.dark-mode .shipment-status.delivered {
                    background: rgba(34,197,94,.15);
                    color: #86efac;
                }

                body.dark .shipment-status.cancelled,
                body.dark-mode .shipment-status.cancelled {
                    background: rgba(239,68,68,.15);
                    color: #fca5a5;
                }

                .ship-action {
                    border: 1px solid var(--ship-border);
                    background: var(--ship-card-soft);
                    color: var(--ship-text);
                    min-height: 36px;
                    border-radius: 10px;
                    padding: 7px 11px;
                    font-size: 12px;
                    font-weight: 700;
                    transition: .2s ease;
                }

                .ship-action:hover:not(:disabled) {
                    border-color: var(--ship-primary);
                    color: var(--ship-primary);
                    transform: translateY(-1px);
                }

                .ship-action.primary {
                    background: var(--ship-primary);
                    color: #fff;
                    border-color: var(--ship-primary);
                }

                .ship-action.primary:hover:not(:disabled) {
                    color: #fff;
                    opacity: .9;
                }

                .ship-action:disabled {
                    opacity: .55;
                    cursor: not-allowed;
                }

                .ship-section-head {
                    padding: 20px 22px;
                    border-bottom: 1px solid var(--ship-border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 15px;
                }

                .ship-section-title {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 800;
                }

                .ship-section-subtitle {
                    color: var(--ship-muted);
                    font-size: 12px;
                    margin-top: 4px;
                }

                .ship-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--ship-muted);
                }

                .ship-empty-icon {
                    width: 65px;
                    height: 65px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 15px;
                    background: var(--ship-card-soft);
                    color: var(--ship-primary);
                    font-size: 25px;
                }

                .ship-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 2000;
                    background: rgba(2,6,23,.68);
                    backdrop-filter: blur(7px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                    overflow-y: auto;
                }

                .ship-modal {
                    width: 100%;
                    max-width: 900px;
                    background: var(--ship-card);
                    color: var(--ship-text);
                    border: 1px solid var(--ship-border);
                    border-radius: 22px;
                    box-shadow: 0 30px 90px rgba(0,0,0,.28);
                    overflow: hidden;
                    animation: shipModalIn .2s ease;
                }

                .ship-modal.small {
                    max-width: 540px;
                }

                @keyframes shipModalIn {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(.98);
                    }

                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .ship-modal-head {
                    padding: 20px 23px;
                    border-bottom: 1px solid var(--ship-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 15px;
                }

                .ship-modal-title {
                    margin: 0;
                    font-weight: 800;
                    font-size: 19px;
                }

                .ship-modal-body {
                    padding: 23px;
                    max-height: 72vh;
                    overflow-y: auto;
                }

                .ship-modal-foot {
                    padding: 17px 23px;
                    border-top: 1px solid var(--ship-border);
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .ship-close {
                    border: 0;
                    background: var(--ship-card-soft);
                    color: var(--ship-muted);
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .ship-close:hover {
                    color: var(--ship-text);
                }

                .ship-info-box {
                    height: 100%;
                    padding: 16px;
                    border: 1px solid var(--ship-border);
                    background: var(--ship-card-soft);
                    border-radius: 15px;
                }

                .ship-info-label {
                    display: block;
                    color: var(--ship-muted);
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: .5px;
                    font-weight: 700;
                    margin-bottom: 6px;
                }

                .ship-info-value {
                    font-weight: 750;
                    word-break: break-word;
                }

                .ship-alert {
                    padding: 14px;
                    border-radius: 14px;
                    background: var(--ship-primary-soft);
                    color: var(--ship-text);
                    border: 1px solid var(--ship-border);
                    margin-bottom: 18px;
                }

                .ship-select-large {
                    min-height: 50px;
                }

                .ship-spinner {
                    animation: shipSpin .8s linear infinite;
                }

                @keyframes shipSpin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 768px) {
                    .shipments-admin-page {
                        padding: 16px;
                    }

                    .ship-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .ship-title {
                        font-size: 24px;
                    }

                    .ship-modal-body {
                        padding: 17px;
                    }

                    .ship-modal-head {
                        padding: 17px;
                    }

                    .ship-modal-foot {
                        padding: 14px 17px;
                    }
                }

                @media (max-width: 576px) {
                    .shipments-admin-page {
                        padding: 12px;
                    }

                    .ship-refresh-btn {
                        width: 100%;
                    }

                    .ship-section-head {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                }
            `}</style>

            <div className="shipments-admin-page">

                {/* HEADER */}

                <div className="ship-header">

                    <div>
                        <h1 className="ship-title">
                            Shipments
                        </h1>

                        <p className="ship-subtitle">
                            Manage shipments, tracking,
                            delivery status and
                            return / exchange requests.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="ship-refresh-btn"
                        onClick={refreshAll}
                        disabled={
                            loading ||
                            requestsLoading ||
                            deliveryBoysLoading
                        }
                    >
                        <FaSyncAlt
                            className={
                                loading ||
                                requestsLoading ||
                                deliveryBoysLoading
                                    ? "ship-spinner me-2"
                                    : "me-2"
                            }
                        />

                        {loading ||
                        requestsLoading ||
                        deliveryBoysLoading
                            ? "Refreshing..."
                            : "Refresh Dashboard"}
                    </button>

                </div>

                {/* SHIPMENT STATS */}

                <div className="row g-3 mb-4">

                    {[
                        [
                            "Total Shipments",
                            stats.total,
                            <FaBox />,
                        ],
                        [
                            "Placed",
                            stats.placed,
                            <FaClock />,
                        ],
                        [
                            "Packed",
                            stats.packed,
                            <FaBoxOpen />,
                        ],
                        [
                            "Dispatched",
                            stats.dispatched,
                            <FaShippingFast />,
                        ],
                        [
                            "In Transit",
                            stats.inTransit,
                            <FaRoute />,
                        ],
                        [
                            "Out for Delivery",
                            stats.outForDelivery,
                            <FaTruck />,
                        ],
                        [
                            "Delivered",
                            stats.delivered,
                            <FaCheckCircle />,
                        ],
                    ].map(
                        ([label, value, icon]) => (
                            <div
                                className="col-6 col-md-4 col-xl"
                                key={label}
                            >
                                <div className="ship-card ship-stat h-100">

                                    <div className="ship-stat-icon">
                                        {icon}
                                    </div>

                                    <div className="ship-stat-label">
                                        {label}
                                    </div>

                                    <div className="ship-stat-value">
                                        {value}
                                    </div>

                                </div>
                            </div>
                        )
                    )}

                </div>

                {/* RETURN EXCHANGE STATS */}

                <div className="row g-3 mb-4">

                    {[
                        [
                            "Return / Exchange",
                            requestStats.total,
                            <FaExchangeAlt />,
                        ],
                        [
                            "Pending Requests",
                            requestStats.requested,
                            <FaClock />,
                        ],
                        [
                            "Confirmed",
                            requestStats.confirmed,
                            <FaCheckCircle />,
                        ],
                        [
                            "Pickup Assigned",
                            requestStats.pickupAssigned,
                            <FaUserCheck />,
                        ],
                    ].map(
                        ([label, value, icon]) => (
                            <div
                                className="col-6 col-md-3"
                                key={label}
                            >
                                <div className="ship-card ship-stat h-100">

                                    <div className="ship-stat-icon">
                                        {icon}
                                    </div>

                                    <div className="ship-stat-label">
                                        {label}
                                    </div>

                                    <div className="ship-stat-value">
                                        {value}
                                    </div>

                                </div>
                            </div>
                        )
                    )}

                </div>

                {/* FILTER */}

                <div className="ship-card ship-filter">

                    <div className="row g-3">

                        <div className="col-lg-8">

                            <div className="ship-input-wrap">

                                <FaSearch className="ship-input-icon" />

                                <input
                                    type="text"
                                    className="ship-input"
                                    placeholder="Search order ID, tracking ID, courier or city..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                />

                            </div>

                        </div>

                        <div className="col-lg-4">

                            <AdminCustomSelect
                                className="ship-select"
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(
                                        e.target.value
                                    )
                                }
                            >
                                <option value="ALL">
                                    All Shipment Status
                                </option>

                                <option value="PLACED">
                                    Placed
                                </option>

                                <option value="PACKED">
                                    Packed
                                </option>

                                <option value="DISPATCHED">
                                    Dispatched
                                </option>

                                <option value="IN_TRANSIT">
                                    In Transit
                                </option>

                                <option value="REACHED_HUB">
                                    Reached Hub
                                </option>

                                <option value="OUT_FOR_DELIVERY">
                                    Out for Delivery
                                </option>

                                <option value="DELIVERED">
                                    Delivered
                                </option>

                                <option value="CANCELLED">
                                    Cancelled
                                </option>
                            </AdminCustomSelect>

                        </div>

                    </div>

                </div>

                {/* SHIPMENT LIST */}

                <div className="ship-card mb-5">

                    <div className="ship-section-head">

                        <div>
                            <h2 className="ship-section-title">
                                Shipment List
                            </h2>

                            <div className="ship-section-subtitle">
                                {filteredShipments.length} shipment
                                {filteredShipments.length !==
                                1
                                    ? "s"
                                    : ""}{" "}
                                found
                            </div>
                        </div>

                        <div className="shipment-status placed">
                            <FaShippingFast />
                            Live Data
                        </div>

                    </div>

                    {loading ? (
                        <div className="ship-empty">

                            <div className="ship-empty-icon">
                                <FaSyncAlt className="ship-spinner" />
                            </div>

                            <h5>
                                Loading shipments...
                            </h5>

                            <p className="mb-0">
                                Fetching latest
                                shipment data.
                            </p>

                        </div>
                    ) : filteredShipments.length ===
                      0 ? (
                        <div className="ship-empty">

                            <div className="ship-empty-icon">
                                <FaBoxOpen />
                            </div>

                            <h5>
                                No shipments found
                            </h5>

                            <p className="mb-0">
                                Try changing your
                                search or status filter.
                            </p>

                        </div>
                    ) : (
                        <div className="ship-table-wrap">

                            <table className="ship-table">

                                <thead>
                                    <tr>
                                        <th>
                                            Order
                                        </th>

                                        <th>
                                            Tracking
                                        </th>

                                        <th>
                                            Courier
                                        </th>

                                        <th>
                                            Destination
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Delivery Boy
                                        </th>

                                        <th>
                                            Updated
                                        </th>

                                        <th>
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {filteredShipments.map(
                                        (shipment) => {
                                            const nextStatus =
                                                NEXT_STATUS[
                                                    shipment.status
                                                ];

                                            const isUpdating =
                                                updatingId ===
                                                shipment.$id;

                                            return (
                                                <tr
                                                    key={
                                                        shipment.$id
                                                    }
                                                >

                                                    <td>
                                                        <div className="ship-order">
                                                            {
                                                                shipment.orderId ||
                                                                "—"
                                                            }
                                                        </div>

                                                        <span className="ship-small">
                                                            {formatDate(
                                                                shipment.$createdAt
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {shipment.trackingId ? (
                                                            <div className="ship-order">
                                                                {
                                                                    shipment.trackingId
                                                                }
                                                            </div>
                                                        ) : (
                                                            <span className="ship-small">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        {shipment.courier ? (
                                                            <div className="d-flex align-items-center gap-2">

                                                                <FaTruck className="text-primary" />

                                                                <div>
                                                                    <div className="fw-bold">
                                                                        {
                                                                            shipment.courier
                                                                        }
                                                                    </div>

                                                                    <span className="ship-small">
                                                                        {
                                                                            shipment.courierCode ||
                                                                            "—"
                                                                        }
                                                                    </span>
                                                                </div>

                                                            </div>
                                                        ) : (
                                                            <span className="ship-small">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <div className="ship-location">

                                                            <FaMapMarkerAlt />

                                                            <div>
                                                                <div className="fw-bold">
                                                                    {
                                                                        shipment.destinationCity ||
                                                                        "—"
                                                                    }
                                                                </div>

                                                                <span className="ship-small">
                                                                    {
                                                                        shipment.destinationState ||
                                                                        "—"
                                                                    }
                                                                </span>
                                                            </div>

                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={getStatusClass(
                                                                shipment.status
                                                            )}
                                                        >
                                                            {getStatusIcon(
                                                                shipment.status
                                                            )}

                                                            {getStatusLabel(
                                                                shipment.status
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {shipment.deliveryBoyId ? (
                                                            <div>
                                                                <span className="shipment-status assigned">
                                                                    <FaUserCheck />
                                                                    Assigned
                                                                </span>

                                                                <span className="ship-small">
                                                                    {getDeliveryBoyName(
                                                                        shipment
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="ship-small">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <span className="ship-small">
                                                            {formatDate(
                                                                shipment.$updatedAt
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <div className="d-flex gap-2 flex-wrap">

                                                            <button
                                                                type="button"
                                                                className="ship-action"
                                                                onClick={() =>
                                                                    setSelectedShipment(
                                                                        shipment
                                                                    )
                                                                }
                                                                title="View shipment"
                                                            >
                                                                <FaEye />
                                                            </button>

                                                            {nextStatus && (
                                                                <button
                                                                    type="button"
                                                                    className="ship-action primary"
                                                                    disabled={
                                                                        isUpdating
                                                                    }
                                                                    onClick={() =>
                                                                        handleStatusUpdate(
                                                                            shipment
                                                                        )
                                                                    }
                                                                >
                                                                    {isUpdating ? (
                                                                        <FaSyncAlt className="ship-spinner" />
                                                                    ) : (
                                                                        <>
                                                                            Move to{" "}
                                                                            {getStatusLabel(
                                                                                nextStatus
                                                                            )}

                                                                            <FaChevronRight className="ms-1" />
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}

                                                            {shipment.status ===
                                                                "OUT_FOR_DELIVERY" &&
                                                                !shipment.deliveryBoyId && (
                                                                    <button
                                                                        type="button"
                                                                        className="ship-action primary"
                                                                        onClick={() =>
                                                                            openAssignShipmentDeliveryBoy(
                                                                                shipment
                                                                            )
                                                                        }
                                                                    >
                                                                        <FaUserTie />

                                                                        <span className="ms-1">
                                                                            Assign
                                                                        </span>
                                                                    </button>
                                                                )}

                                                            {shipment.status ===
                                                                "OUT_FOR_DELIVERY" &&
                                                                shipment.deliveryBoyId && (
                                                                    <span className="shipment-status assigned">
                                                                        <FaUserCheck />
                                                                        Delivery Assigned
                                                                    </span>
                                                                )}

                                                        </div>
                                                    </td>

                                                </tr>
                                            );
                                        }
                                    )}

                                </tbody>

                            </table>

                        </div>
                    )}

                </div>

                {/* RETURN / EXCHANGE */}

                <div className="ship-card mb-5">

                    <div className="ship-section-head">

                        <div>
                            <h2 className="ship-section-title">
                                Return / Exchange Requests
                            </h2>

                            <div className="ship-section-subtitle">
                                Confirm customer requests
                                and assign delivery boys
                                for pickup.
                            </div>
                        </div>

                        <div className="shipment-status confirmed">
                            <FaExchangeAlt />
                            {requests.length} Requests
                        </div>

                    </div>

                    {requestsLoading ? (
                        <div className="ship-empty">

                            <div className="ship-empty-icon">
                                <FaSyncAlt className="ship-spinner" />
                            </div>

                            <h5>
                                Loading requests...
                            </h5>

                        </div>
                    ) : requests.length === 0 ? (
                        <div className="ship-empty">

                            <div className="ship-empty-icon">
                                <FaUndo />
                            </div>

                            <h5>
                                No Return / Exchange Requests
                            </h5>

                            <p className="mb-0">
                                Customer requests
                                will appear here.
                            </p>

                        </div>
                    ) : (
                        <div className="ship-table-wrap">

                            <table className="ship-table">

                                <thead>
                                    <tr>
                                        <th>
                                            Reference
                                        </th>

                                        <th>
                                            Order
                                        </th>

                                        <th>
                                            Type
                                        </th>

                                        <th>
                                            Reason
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Delivery Boy
                                        </th>

                                        <th>
                                            Created
                                        </th>

                                        <th>
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {requests.map(
                                        (request) => {
                                            const isUpdating =
                                                requestUpdatingId ===
                                                request.$id;

                                            const canTakeAction =
                                                request.status ===
                                                "REQUESTED";

                                            return (
                                                <tr
                                                    key={
                                                        request.$id
                                                    }
                                                >

                                                    <td>
                                                        <div className="ship-order">
                                                            {
                                                                request.referenceId ||
                                                                "—"
                                                            }
                                                        </div>

                                                        <span className="ship-small">
                                                            Request
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <div className="fw-bold">
                                                            {
                                                                request.originalOrderId ||
                                                                "—"
                                                            }
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`shipment-status ${
                                                                request.type ===
                                                                "RETURN"
                                                                    ? "cancelled"
                                                                    : "transit"
                                                            }`}
                                                        >
                                                            {request.type ===
                                                            "RETURN" ? (
                                                                <FaUndo />
                                                            ) : (
                                                                <FaExchangeAlt />
                                                            )}

                                                            {getRequestTypeLabel(
                                                                request.type
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {(() => {
                                                            const ord =
                                                                ordersMap[
                                                                    String(
                                                                        request.originalOrderId ||
                                                                            ""
                                                                    )
                                                                ] || null;
                                                            const rxItem =
                                                                resolveReturnRequestItem(
                                                                    request,
                                                                    ord
                                                                );
                                                            return (
                                                                <div
                                                                    style={{
                                                                        maxWidth:
                                                                            "240px",
                                                                    }}
                                                                >
                                                                    {rxItem?.itemName && (
                                                                        <div className="fw-bold text-dark mb-1">
                                                                            {rxItem.itemName}{" "}
                                                                            <span className="text-muted">
                                                                                (x{rxItem.itemQty || 1})
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className="ship-small">
                                                                        {rxItem?.cleanReason ||
                                                                            extractCleanReason(
                                                                                request.reason
                                                                            ) ||
                                                                            "—"}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={getStatusClass(
                                                                request.status
                                                            )}
                                                        >
                                                            {getStatusIcon(
                                                                request.status
                                                            )}

                                                            {getStatusLabel(
                                                                request.status
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        {request.deliveryBoyId ? (
                                                            <div>
                                                                <span className="shipment-status assigned">
                                                                    <FaUserCheck />
                                                                    Assigned
                                                                </span>

                                                                <span className="ship-small">
                                                                    {getDeliveryBoyName(
                                                                        request.deliveryBoyId
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="ship-small">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <span className="ship-small">
                                                            {formatDate(
                                                                request.createdAt ||
                                                                    request.$createdAt
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <div className="d-flex gap-2 flex-wrap">

                                                            <button
                                                                type="button"
                                                                className="ship-action"
                                                                onClick={() =>
                                                                    setSelectedRequest(
                                                                        request
                                                                    )
                                                                }
                                                            >
                                                                <FaEye />
                                                            </button>

                                                            {(() => {
                                                                const stepInfo = getNextRequestStep(request);
                                                                if (!stepInfo) return null;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        className="ship-action primary"
                                                                        disabled={isUpdating}
                                                                        onClick={() => handleConfirmRequest(request)}
                                                                    >
                                                                        {isUpdating ? (
                                                                            <FaSyncAlt className="ship-spinner" />
                                                                        ) : (
                                                                            <FaCheckCircle />
                                                                        )}
                                                                        <span className="ms-1">
                                                                            {stepInfo.buttonLabel}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })()}

                                                            {canTakeAction && (
                                                                <button
                                                                    type="button"
                                                                    className="ship-action"
                                                                    disabled={isUpdating}
                                                                    onClick={() => handleCancelRequest(request)}
                                                                    title="Cancel Request"
                                                                >
                                                                    <FaTimes />
                                                                </button>
                                                            )}

                                                            {canAssignRequestDeliveryBoy(request) && (
                                                                <button
                                                                    type="button"
                                                                    className="ship-action primary"
                                                                    onClick={() => openAssignDeliveryBoy(request)}
                                                                >
                                                                    <FaUserTie />
                                                                    <span className="ms-1">
                                                                        {String(request?.type || "").toUpperCase() === "EXCHANGE"
                                                                            ? "Out for Exchange (Assign)"
                                                                            : "Assign Pickup"}
                                                                    </span>
                                                                </button>
                                                            )}

                                                            {request.status ===
                                                                "PICKUP_ASSIGNED" && (
                                                                <span className="shipment-status assigned">
                                                                    <FaUserCheck />
                                                                    {String(request?.type || "").toUpperCase() === "EXCHANGE"
                                                                        ? "Out for Exchange"
                                                                        : "Pickup Assigned"}
                                                                </span>
                                                            )}

                                                        </div>
                                                    </td>

                                                </tr>
                                            );
                                        }
                                    )}

                                </tbody>

                            </table>

                        </div>
                    )}

                </div>

                {/* SHIPMENT DETAILS MODAL */}

                {selectedShipment && (
                    <div
                        className="ship-modal-backdrop"
                        onClick={() =>
                            setSelectedShipment(
                                null
                            )
                        }
                    >

                        <div
                            className="ship-modal"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="ship-modal-head">

                                <div>
                                    <h3 className="ship-modal-title">
                                        Shipment Details
                                    </h3>

                                    <span className="ship-small">
                                        {
                                            selectedShipment.orderId ||
                                            "Shipment"
                                        }
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="ship-close"
                                    onClick={() =>
                                        setSelectedShipment(
                                            null
                                        )
                                    }
                                >
                                    <FaTimes />
                                </button>

                            </div>

                            <div className="ship-modal-body">

                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">

                                    <div>
                                        <span className="ship-info-label">
                                            Current Status
                                        </span>

                                        <span
                                            className={getStatusClass(
                                                selectedShipment.status
                                            )}
                                        >
                                            {getStatusIcon(
                                                selectedShipment.status
                                            )}

                                            {getStatusLabel(
                                                selectedShipment.status
                                            )}
                                        </span>
                                    </div>

                                    {NEXT_STATUS[
                                        selectedShipment.status
                                    ] && (
                                        <button
                                            type="button"
                                            className="ship-action primary"
                                            disabled={
                                                updatingId ===
                                                selectedShipment.$id
                                            }
                                            onClick={() =>
                                                handleStatusUpdate(
                                                    selectedShipment
                                                )
                                            }
                                        >
                                            {updatingId ===
                                            selectedShipment.$id
                                                ? "Updating..."
                                                : `Move to ${getStatusLabel(
                                                      NEXT_STATUS[
                                                          selectedShipment.status
                                                      ]
                                                  )}`}

                                            <FaChevronRight className="ms-1" />
                                        </button>
                                    )}

                                </div>

                                <div className="row g-3 mb-3">

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Tracking ID
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedShipment.trackingId ||
                                                    "Not assigned yet"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Courier
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedShipment.courier ||
                                                    "Not assigned yet"
                                                }
                                            </div>

                                            {selectedShipment.courierCode && (
                                                <span className="ship-small">
                                                    {
                                                        selectedShipment.courierCode
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                </div>

                                <div className="ship-info-box mb-3">

                                    <h6 className="fw-bold mb-3">
                                        Shipment Route
                                    </h6>

                                    <div className="row g-3">

                                        <div className="col-md-6">

                                            <span className="ship-info-label">
                                                Origin
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedShipment.originCity ||
                                                    "—"
                                                }
                                            </div>

                                            <span className="ship-small">
                                                {
                                                    selectedShipment.originState ||
                                                    "—"
                                                }
                                            </span>

                                        </div>

                                        <div className="col-md-6">

                                            <span className="ship-info-label">
                                                Destination
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedShipment.destinationCity ||
                                                    "—"
                                                }
                                            </div>

                                            <span className="ship-small">
                                                {
                                                    selectedShipment.destinationState ||
                                                    "—"
                                                }
                                            </span>

                                        </div>

                                    </div>

                                </div>

                                <div className="ship-info-box">

                                    <h6 className="fw-bold mb-3">
                                        Delivery Information
                                    </h6>

                                    <div className="row g-3">

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                Estimated Delivery
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedShipment.estimatedDeliveryDate
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                OTP Required
                                            </span>

                                            <div className="ship-info-value">
                                                {selectedShipment.otpRequired
                                                    ? "Yes"
                                                    : "No"}
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                OTP Verified
                                            </span>

                                            <div className="ship-info-value">
                                                {selectedShipment.otpVerified
                                                    ? "Yes"
                                                    : "No"}
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                Shipped At
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedShipment.shippedAt
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                Out for Delivery
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedShipment.outForDeliveryAt
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <span className="ship-info-label">
                                                Delivered At
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedShipment.deliveredAt
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-12">
                                            <span className="ship-info-label">
                                                Delivery Boy Assignment
                                            </span>

                                            <div className="ship-info-value">
                                                {selectedShipment.deliveryBoyId
                                                    ? "Assigned — " + getDeliveryBoyName(selectedShipment)
                                                    : "Not Assigned"}
                                            </div>
                                        </div>

                                    </div>

                                </div>

                                {(() => {
                                    const ord =
                                        ordersMap[
                                            String(
                                                selectedShipment.orderId || ""
                                            )
                                        ] || null;
                                    if (!ord) return null;
                                    const activeItems =
                                        getActiveDeliveryItems(ord);
                                    const cancelledItems =
                                        getCancelledOrderItems(ord);
                                    if (
                                        activeItems.length === 0 &&
                                        cancelledItems.length === 0
                                    ) {
                                        return null;
                                    }
                                    return (
                                        <div className="ship-info-box mt-3">
                                            <h6 className="fw-bold mb-2">
                                                Products to Deliver (
                                                {activeItems.length})
                                            </h6>
                                            {activeItems.map((it, i) => (
                                                <div
                                                    key={i}
                                                    className="d-flex justify-content-between align-items-center py-1 border-bottom"
                                                >
                                                    <span className="fw-semibold">
                                                        {it?.title ||
                                                            it?.name ||
                                                            "Product"}{" "}
                                                        (x
                                                        {it?.quantity ||
                                                            it?.qty ||
                                                            1}
                                                        )
                                                    </span>
                                                    <span className="badge bg-success">
                                                        Deliver
                                                    </span>
                                                </div>
                                            ))}
                                            {cancelledItems.length > 0 && (
                                                <div className="mt-2">
                                                    <span className="ship-info-label text-danger">
                                                        Cancelled by Customer (Hidden from Delivery Boy)
                                                    </span>
                                                    {cancelledItems.map(
                                                        (it, i) => (
                                                            <div
                                                                key={i}
                                                                className="d-flex justify-content-between align-items-center py-1 text-muted"
                                                            >
                                                                <span className="text-decoration-line-through">
                                                                    {it?.title ||
                                                                        it?.name ||
                                                                        "Product"}{" "}
                                                                    (x
                                                                    {it?.quantity ||
                                                                        it?.qty ||
                                                                        1}
                                                                    )
                                                                </span>
                                                                <span className="badge bg-danger">
                                                                    Cancelled
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                            </div>

                            <div className="ship-modal-foot">

                                {selectedShipment.status ===
                                    "OUT_FOR_DELIVERY" && (
                                    <button
                                        type="button"
                                        className="ship-action primary"
                                        onClick={() =>
                                            openAssignShipmentDeliveryBoy(
                                                selectedShipment
                                            )
                                        }
                                    >
                                        <FaUserTie className="me-1" />
                                        {selectedShipment.deliveryBoyId
                                            ? "Change Delivery Boy"
                                            : "Assign Delivery Boy"}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="ship-action"
                                    onClick={() =>
                                        setSelectedShipment(
                                            null
                                        )
                                    }
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>
                )}

                {/* ASSIGN DELIVERY BOY MODAL */}

                {(assignmentRequest || assignmentShipment) && (
                    <div
                        className="ship-modal-backdrop"
                        onClick={() => {
                            if (!assigningDeliveryBoy) {
                                setAssignmentRequest(null);
                                setAssignmentShipment(null);
                            }
                        }}
                    >

                        <div
                            className="ship-modal small"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="ship-modal-head">

                                <div>
                                    <h3 className="ship-modal-title">
                                        Assign Delivery Boy
                                    </h3>

                                    <span className="ship-small">
                                        {assignmentShipment
                                            ? `Order Delivery • ${assignmentShipment.orderId || assignmentShipment.trackingId || "Shipment"}`
                                            : `${getRequestTypeLabel(assignmentRequest?.type)} • ${assignmentRequest?.referenceId || ""}`}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="ship-close"
                                    disabled={assigningDeliveryBoy}
                                    onClick={() => {
                                        setAssignmentRequest(null);
                                        setAssignmentShipment(null);
                                    }}
                                >
                                    <FaTimes />
                                </button>

                            </div>

                            <div className="ship-modal-body">

                                <div className="ship-alert">

                                    <div className="fw-bold mb-1">
                                        {assignmentShipment
                                            ? "Out for Delivery Assignment"
                                            : "Pickup Assignment"}
                                    </div>

                                    <small>
                                        {assignmentShipment
                                            ? "Select the delivery partner who will deliver this order to the customer."
                                            : "Return / Exchange pickup does not require OTP. The selected delivery boy will receive the pickup request on their dashboard."}
                                    </small>

                                </div>

                                <label className="ship-info-label">
                                    Select Delivery Boy
                                </label>

                                {deliveryBoysLoading ? (
                                    <div className="ship-info-box text-center">
                                        <FaSyncAlt className="ship-spinner me-2" />
                                        Loading delivery boys...
                                    </div>
                                ) : deliveryBoys.length === 0 ? (
                                    <div className="ship-alert">
                                        <strong>No active delivery boys found.</strong>
                                        <br />
                                        <small>
                                            Check the users collection and ensure role is
                                            <strong> deliveryBoy</strong>.
                                        </small>
                                    </div>
                                ) : (
                                    <AdminCustomSelect
                                        className="ship-select ship-select-large"
                                        value={selectedDeliveryBoyId}
                                        onChange={(e) =>
                                            setSelectedDeliveryBoyId(e.target.value)
                                        }
                                        disabled={assigningDeliveryBoy}
                                    >
                                        <option value="">Select delivery boy</option>
                                        {deliveryBoys.map((boy) => {
                                            const id = boy?.userId || boy?.$id;
                                            return (
                                                <option key={id} value={id}>
                                                    {boy.displayName}
                                                    {boy?.email ? ` — ${boy.email}` : ""}
                                                </option>
                                            );
                                        })}
                                    </AdminCustomSelect>
                                )}

                            </div>

                            <div className="ship-modal-foot">

                                <button
                                    type="button"
                                    className="ship-action"
                                    disabled={assigningDeliveryBoy}
                                    onClick={() => {
                                        setAssignmentRequest(null);
                                        setAssignmentShipment(null);
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className="ship-action primary"
                                    disabled={
                                        assigningDeliveryBoy ||
                                        !selectedDeliveryBoyId ||
                                        deliveryBoys.length === 0
                                    }
                                    onClick={
                                        assignmentShipment
                                            ? handleAssignShipmentDeliveryBoy
                                            : handleAssignDeliveryBoy
                                    }
                                >
                                    {assigningDeliveryBoy ? (
                                        <>
                                            <FaSyncAlt className="ship-spinner me-2" />
                                            Assigning...
                                        </>
                                    ) : (
                                        <>
                                            <FaUserCheck className="me-2" />
                                            {assignmentShipment
                                                ? "Assign Delivery"
                                                : "Assign Pickup"}
                                        </>
                                    )}
                                </button>

                            </div>

                        </div>

                    </div>
                )}

                {/* RETURN / EXCHANGE DETAILS */}

                {selectedRequest && (
                    <div
                        className="ship-modal-backdrop"
                        onClick={() =>
                            setSelectedRequest(
                                null
                            )
                        }
                    >

                        <div
                            className="ship-modal"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="ship-modal-head">

                                <div>
                                    <h3 className="ship-modal-title">

                                        {
                                            getRequestTypeLabel(
                                                selectedRequest.type
                                            )
                                        }{" "}
                                        Request

                                    </h3>

                                    <span className="ship-small">
                                        {
                                            selectedRequest.referenceId
                                        }
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="ship-close"
                                    onClick={() =>
                                        setSelectedRequest(
                                            null
                                        )
                                    }
                                >
                                    <FaTimes />
                                </button>

                            </div>

                            <div className="ship-modal-body">

                                <div className="row g-3 mb-3">

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Reference ID
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedRequest.referenceId ||
                                                    "—"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Original Order ID
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedRequest.originalOrderId ||
                                                    "—"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Request Type
                                            </span>

                                            <div className="ship-info-value">
                                                {getRequestTypeLabel(
                                                    selectedRequest.type
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Status
                                            </span>

                                            <span
                                                className={getStatusClass(
                                                    selectedRequest.status
                                                )}
                                            >
                                                {getStatusIcon(
                                                    selectedRequest.status
                                                )}

                                                {getStatusLabel(
                                                    selectedRequest.status
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                </div>

                                <div className="ship-info-box mb-3">

                                    <span className="ship-info-label">
                                        Delivery Boy Assignment
                                    </span>

                                    <div className="ship-info-value">

                                        {selectedRequest.deliveryBoyId
                                            ? "Pickup Assigned"
                                            : "Not Assigned"}

                                    </div>

                                    {selectedRequest.deliveryBoyId && (
                                        <span className="ship-small">
                                            Delivery Boy ID:{" "}
                                            {
                                                selectedRequest.deliveryBoyId
                                            }
                                        </span>
                                    )}

                                </div>

                                {(() => {
                                    const ord =
                                        ordersMap[
                                            String(
                                                selectedRequest.originalOrderId ||
                                                    ""
                                            )
                                        ] || null;
                                    const rxItem = resolveReturnRequestItem(
                                        selectedRequest,
                                        ord
                                    );
                                    return (
                                        <>
                                            <div className="ship-info-box mb-3">
                                                <span className="ship-info-label">
                                                    {String(
                                                        selectedRequest.type ||
                                                            ""
                                                    ).toUpperCase() ===
                                                    "EXCHANGE"
                                                        ? "Product to Exchange"
                                                        : "Product to Return"}
                                                </span>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    {rxItem?.itemImage && (
                                                        <img
                                                            src={
                                                                rxItem.itemImage
                                                            }
                                                            alt={
                                                                rxItem.itemName
                                                            }
                                                            style={{
                                                                width: 52,
                                                                height: 52,
                                                                objectFit:
                                                                    "cover",
                                                                borderRadius: 10,
                                                            }}
                                                            className="border"
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="ship-info-value">
                                                            {rxItem?.itemName ||
                                                                "Product"}
                                                        </div>
                                                        <span className="ship-small">
                                                            Quantity: x
                                                            {rxItem?.itemQty ||
                                                                1}
                                                            {rxItem?.itemPrice
                                                                ? ` • Price: ₹${Number(
                                                                      rxItem.itemPrice *
                                                                          (rxItem.itemQty ||
                                                                              1)
                                                                  ).toFixed(2)}`
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="ship-info-box mb-3">
                                                <span className="ship-info-label">
                                                    Customer Reason
                                                </span>

                                                <div className="ship-info-value">
                                                    {rxItem?.cleanReason ||
                                                        extractCleanReason(
                                                            selectedRequest.reason
                                                        ) ||
                                                        "No reason provided."}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="row g-3">

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Payment Method
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedRequest.paymentMethod ||
                                                    "—"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Refund Amount
                                            </span>

                                            <div className="ship-info-value">
                                                ₹
                                                {Number(
                                                    selectedRequest.refundAmount ||
                                                        0
                                                ).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Refund Status
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedRequest.refundStatus ||
                                                    "—"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Payment Status
                                            </span>

                                            <div className="ship-info-value">
                                                {
                                                    selectedRequest.paymentStatus ||
                                                    "—"
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Created At
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedRequest.createdAt ||
                                                        selectedRequest.$createdAt
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="ship-info-box">
                                            <span className="ship-info-label">
                                                Updated At
                                            </span>

                                            <div className="ship-info-value">
                                                {formatDate(
                                                    selectedRequest.updatedAt ||
                                                        selectedRequest.$updatedAt
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>

                            </div>

                            <div className="ship-modal-foot">

                                {selectedRequest.status ===
                                    "REQUESTED" && (
                                    <button
                                        type="button"
                                        className="ship-action"
                                        disabled={
                                            requestUpdatingId ===
                                            selectedRequest.$id
                                        }
                                        onClick={() =>
                                            handleCancelRequest(
                                                selectedRequest
                                            )
                                        }
                                    >
                                        <FaTimes className="me-1" />
                                        Cancel
                                    </button>
                                )}

                                {(() => {
                                    const stepInfo = getNextRequestStep(selectedRequest);
                                    if (!stepInfo) return null;
                                    return (
                                        <button
                                            type="button"
                                            className="ship-action primary"
                                            disabled={
                                                requestUpdatingId ===
                                                selectedRequest.$id
                                            }
                                            onClick={() =>
                                                handleConfirmRequest(
                                                    selectedRequest
                                                )
                                            }
                                        >
                                            {requestUpdatingId ===
                                            selectedRequest.$id ? (
                                                <FaSyncAlt className="ship-spinner me-1" />
                                            ) : (
                                                <FaCheckCircle className="me-1" />
                                            )}
                                            {stepInfo.buttonLabel}
                                        </button>
                                    );
                                })()}

                                {canAssignRequestDeliveryBoy(selectedRequest) && (
                                    <button
                                        type="button"
                                        className="ship-action primary"
                                        disabled={
                                            requestUpdatingId ===
                                            selectedRequest.$id
                                        }
                                        onClick={() =>
                                            openAssignDeliveryBoy(
                                                selectedRequest
                                            )
                                        }
                                    >
                                        <FaUserTie className="me-1" />
                                        {String(selectedRequest?.type || "").toUpperCase() === "EXCHANGE"
                                            ? "Out for Exchange (Assign Delivery Boy)"
                                            : "Assign Delivery Boy"}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="ship-action"
                                    onClick={() =>
                                        setSelectedRequest(
                                            null
                                        )
                                    }
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>
                )}

            </div>
        </>
    );
}

export default AdminShipments;