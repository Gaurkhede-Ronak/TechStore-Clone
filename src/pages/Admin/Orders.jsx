import { useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";

import {
    FaSearch,
    FaEye,
    FaPrint,
    FaFileInvoice,
    FaShoppingBag,
    FaRupeeSign,
    FaTruck,
    FaCheckCircle,
    FaClock,
    FaTimesCircle,
    FaFilter,
    FaTrash,
    FaSyncAlt,
    FaExclamationTriangle,
    FaBox,
    FaRoute,
    FaMapMarkerAlt,
    FaKey,
} from "react-icons/fa";

import { toast } from "react-hot-toast";
import { Databases, Query } from "appwrite";

import "../../css/Orders.css";

import client from "../../appwrite/config";
import orderService from "../../appwrite/orderService";
import shipmentHelper from "../../appwrite/shipmentHelper";


  // APPWRITE

const databases = new Databases(client);

const DATABASE_ID =
    import.meta.env.VITE_APPWRITE_DATABASE_ID;

const SHIPMENTS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID;

const SHIPMENT_EVENTS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_SHIPMENT_EVENTS_COLLECTION_ID;

const DELIVERY_OTPS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_DELIVERY_OTPS_COLLECTION_ID;

const NOTIFICATIONS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_NOTIFICATIONS_COLLECTION_ID;


  // STATUS CONFIG

const STATUS_OPTIONS = [
    "PLACED",
    "PACKED",
    "DISPATCHED",
    "IN_TRANSIT",
    "REACHED_HUB",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "EXCEPTION",
];


  // STATUS FLOW

const STATUS_FLOW = {
    PLACED: [
        "PACKED",
        "CANCELLED",
        "EXCEPTION",
    ],

    PACKED: [
        "DISPATCHED",
        "CANCELLED",
        "EXCEPTION",
    ],

    DISPATCHED: [
        "IN_TRANSIT",
        "EXCEPTION",
    ],

    IN_TRANSIT: [
        "REACHED_HUB",
        "OUT_FOR_DELIVERY",
        "EXCEPTION",
    ],

    REACHED_HUB: [
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "EXCEPTION",
    ],

    OUT_FOR_DELIVERY: [
        "DELIVERED",
        "EXCEPTION",
    ],

    EXCEPTION: [
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "CANCELLED",
    ],

    DELIVERED: [],

    CANCELLED: [],
};


  // STATUS LABEL

const STATUS_LABELS = {
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


  // HELPERS

const safeString = (value) => {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);
};


  // ORDER ID

const getOrderId = (order) => {
    return (
        order?.orderId ||
        order?.id ||
        order?.$id ||
        ""
    );
};


  // CUSTOMER NAME

const getCustomerName = (order) => {
    return (
        order?.customerName ||
        order?.customer ||
        order?.name ||
        order?.userName ||
        order?.fullName ||
        "Customer"
    );
};


  // CUSTOMER EMAIL

const getCustomerEmail = (order) => {
    return (
        order?.email ||
        order?.customerEmail ||
        order?.userEmail ||
        ""
    );
};


  // CUSTOMER PHONE

const getCustomerPhone = (order) => {
    return (
        order?.phone ||
        order?.customerPhone ||
        order?.mobile ||
        order?.contactNumber ||
        ""
    );
};


  // ADDRESS

const getCustomerAddress = (order) => {

    if (
        typeof order?.address ===
        "string"
    ) {
        return order.address;
    }

    if (
        typeof order?.shippingAddress ===
        "string"
    ) {
        return order.shippingAddress;
    }

    if (
        order?.shippingAddress
    ) {

        const address =
            order.shippingAddress;

        return [
            address.address,
            address.street,
            address.city,
            address.state,
            address.pincode,
        ]
            .filter(Boolean)
            .join(", ");
    }

    return [
        order?.city,
        order?.state,
        order?.pincode,
    ]
        .filter(Boolean)
        .join(", ");
};


  // PAYMENT

const getPaymentStatus = (order) => {
    return (
        order?.paymentStatus ||
        order?.payment ||
        order?.paymentMethodStatus ||
        "Pending"
    );
};


  // SHIPPING

const getShippingStatus = (order) => {
    return (
        order?.shippingStatus ||
        order?.shipping ||
        order?.status ||
        "Processing"
    );
};


  // TOTAL

const getOrderTotal = (order) => {

    const total =
        order?.total ??
        order?.grandTotal ??
        order?.amount ??
        order?.finalAmount ??
        order?.price ??
        0;

    const numericTotal =
        Number(total);

    return Number.isFinite(
        numericTotal
    )
        ? numericTotal
        : 0;
};


  // DATE

const getOrderDate = (order) => {

    const date =
        order?.createdAt ||
        order?.$createdAt ||
        order?.date;

    if (!date) {
        return "-";
    }

    const parsedDate =
        new Date(date);

    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {
        return safeString(date);
    }

    return parsedDate.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};


  // AVATAR

const getAvatar = (order) => {

    return (
        order?.avatar ||
        order?.profileImage ||
        order?.image ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            getCustomerName(order)
        )}&background=0d6efd&color=fff`
    );
};


  // ITEMS

const getItems = (order) => {

    const possibleItems =
        order?.items ||
        order?.products ||
        order?.cartItems ||
        [];

    if (
        !Array.isArray(
            possibleItems
        )
    ) {
        return [];
    }

    return possibleItems.map(
        (item) => ({

            name:
                item?.name ||
                item?.productName ||
                item?.title ||
                "Product",

            qty:
                Number(
                    item?.qty ??
                    item?.quantity ??
                    1
                ) || 1,

            price:
                Number(
                    item?.price ??
                    item?.sellingPrice ??
                    item?.productPrice ??
                    item?.amount ??
                    0
                ) || 0,

            image:
                item?.image ||
                item?.productImage ||
                "",
        })
    );
};


  // STATUS DISPLAY

const formatStatus = (status) => {

    const normalized =
        safeString(status)
            .toUpperCase();

    return (
        STATUS_LABELS[
            normalized
        ] ||
        status ||
        "Unknown"
    );
};


  // ORDER CASCADE DELETE

const deleteDocumentsByQuery = async (
    collectionId,
    queries = []
) => {

    if (!collectionId) {
        return [];
    }

    const deletedIds = [];

    let response;

    try {

        response =
            await databases.listDocuments(
                DATABASE_ID,
                collectionId,
                [
                    ...queries,
                    Query.limit(100),
                ]
            );

    } catch (error) {

        console.error(
            `Failed to read collection ${collectionId}:`,
            error
        );

        throw error;
    }

    const documents =
        response?.documents || [];

    for (
        const document
        of documents
    ) {

        try {

            await databases.deleteDocument(
                DATABASE_ID,
                collectionId,
                document.$id
            );

            deletedIds.push(
                document.$id
            );

        } catch (error) {

            console.error(
                `Failed to delete document ${document.$id}:`,
                error
            );

            throw error;
        }
    }

    return deletedIds;
};


  // DELETE SHIPMENT RELATED DATA

const deleteShipmentRelatedData = async (
    shipment
) => {

    const shipmentId =
        safeString(
            shipment?.$id
        );

    const orderId =
        safeString(
            shipment?.orderId
        );

    const trackingId =
        safeString(
            shipment?.trackingId
        );


  // SHIPMENT EVENTS

    if (
        SHIPMENT_EVENTS_COLLECTION_ID &&
        shipmentId
    ) {

        await deleteDocumentsByQuery(
            SHIPMENT_EVENTS_COLLECTION_ID,
            [
                Query.equal(
                    "shipmentId",
                    shipmentId
                ),
            ]
        );
    }


  // DELIVERY OTPS

    if (
        DELIVERY_OTPS_COLLECTION_ID &&
        shipmentId
    ) {

        await deleteDocumentsByQuery(
            DELIVERY_OTPS_COLLECTION_ID,
            [
                Query.equal(
                    "shipmentId",
                    shipmentId
                ),
            ]
        );
    }


  // NOTIFICATIONS

    if (
        NOTIFICATIONS_COLLECTION_ID
    ) {

        if (shipmentId) {

            await deleteDocumentsByQuery(
                NOTIFICATIONS_COLLECTION_ID,
                [
                    Query.equal(
                        "shipmentId",
                        shipmentId
                    ),
                ]
            );
        }

        if (orderId) {

            await deleteDocumentsByQuery(
                NOTIFICATIONS_COLLECTION_ID,
                [
                    Query.equal(
                        "orderId",
                        orderId
                    ),
                ]
            );
        }

        if (trackingId) {

            await deleteDocumentsByQuery(
                NOTIFICATIONS_COLLECTION_ID,
                [
                    Query.equal(
                        "trackingId",
                        trackingId
                    ),
                ]
            );
        }
    }


  // DELETE SHIPMENT

    if (
        SHIPMENTS_COLLECTION_ID &&
        shipmentId
    ) {

        await databases.deleteDocument(
            DATABASE_ID,
            SHIPMENTS_COLLECTION_ID,
            shipmentId
        );
    }
};


  // DELETE ORDER CASCADE

const deleteOrderCascade = async (
    order
) => {

    const customOrderId =
        safeString(
            order?.orderId
        );

    const appwriteOrderId =
        safeString(
            order?.$id
        );


    let shipments = [];


  // FIND BY CUSTOM ORDER ID

    if (
        SHIPMENTS_COLLECTION_ID &&
        customOrderId
    ) {

        const response =
            await databases.listDocuments(
                DATABASE_ID,
                SHIPMENTS_COLLECTION_ID,
                [
                    Query.equal(
                        "orderId",
                        customOrderId
                    ),
                    Query.limit(100),
                ]
            );

        shipments =
            response?.documents || [];
    }


  // FALLBACK APPWRITE ORDER ID

    if (
        shipments.length === 0 &&
        SHIPMENTS_COLLECTION_ID &&
        appwriteOrderId &&
        appwriteOrderId !==
            customOrderId
    ) {

        const response =
            await databases.listDocuments(
                DATABASE_ID,
                SHIPMENTS_COLLECTION_ID,
                [
                    Query.equal(
                        "orderId",
                        appwriteOrderId
                    ),
                    Query.limit(100),
                ]
            );

        shipments =
            response?.documents || [];
    }


  // DELETE SHIPMENTS

    for (
        const shipment
        of shipments
    ) {

        await deleteShipmentRelatedData(
            shipment
        );
    }


  // ORDER NOTIFICATIONS

    if (
        NOTIFICATIONS_COLLECTION_ID &&
        customOrderId
    ) {

        await deleteDocumentsByQuery(
            NOTIFICATIONS_COLLECTION_ID,
            [
                Query.equal(
                    "orderId",
                    customOrderId
                ),
            ]
        );
    }


    if (
        NOTIFICATIONS_COLLECTION_ID &&
        appwriteOrderId &&
        appwriteOrderId !==
            customOrderId
    ) {

        await deleteDocumentsByQuery(
            NOTIFICATIONS_COLLECTION_ID,
            [
                Query.equal(
                    "orderId",
                    appwriteOrderId
                ),
            ]
        );
    }


  // DELETE ORDER

    if (!appwriteOrderId) {

        throw new Error(
            "Appwrite Order document ID ($id) is missing."
        );
    }

    await orderService.deleteOrder(
        appwriteOrderId
    );


    return {
        success: true,
        deletedOrderId:
            appwriteOrderId,
        deletedShipments:
            shipments.length,
    };
};


  // PAYMENT BADGE

const renderPaymentBadge = (
    payment
) => {

    const value =
        safeString(payment)
            .toLowerCase();


    if (
        value === "paid" ||
        value === "success" ||
        value === "successful"
    ) {

        return (
            <span className="badge bg-success px-3 py-2">
                <FaCheckCircle className="me-1" />
                {payment}
            </span>
        );
    }


    if (
        value === "pending" ||
        value === "processing"
    ) {

        return (
            <span className="badge bg-warning text-dark px-3 py-2">
                <FaClock className="me-1" />
                {payment}
            </span>
        );
    }


    if (
        value === "failed" ||
        value === "cancelled"
    ) {

        return (
            <span className="badge bg-danger px-3 py-2">
                <FaTimesCircle className="me-1" />
                {payment}
            </span>
        );
    }


    return (
        <span className="badge bg-secondary px-3 py-2">
            {payment || "Unknown"}
        </span>
    );
};


  // SHIPPING BADGE

const renderShippingBadge = (
    shipping
) => {

    const value =
        safeString(shipping)
            .toUpperCase();


    if (
        value === "DELIVERED"
    ) {

        return (
            <span className="badge bg-success px-3 py-2">
                <FaCheckCircle className="me-1" />
                Delivered
            </span>
        );
    }


    if (
        value === "CANCELLED" ||
        value === "CANCELED"
    ) {

        return (
            <span className="badge bg-danger px-3 py-2">
                Cancelled
            </span>
        );
    }


    if (
        value === "OUT_FOR_DELIVERY"
    ) {

        return (
            <span className="badge bg-warning text-dark px-3 py-2">
                Out for Delivery
            </span>
        );
    }


    if (
        value === "DISPATCHED" ||
        value === "IN_TRANSIT"
    ) {

        return (
            <span className="badge bg-primary px-3 py-2">
                {formatStatus(value)}
            </span>
        );
    }


    if (
        value === "REACHED_HUB"
    ) {

        return (
            <span className="badge bg-info text-dark px-3 py-2">
                Reached Hub
            </span>
        );
    }


    if (
        value === "PACKED" ||
        value === "PLACED" ||
        value === "PROCESSING"
    ) {

        return (
            <span className="badge bg-secondary px-3 py-2">
                {formatStatus(value)}
            </span>
        );
    }


    if (
        value === "EXCEPTION"
    ) {

        return (
            <span className="badge bg-danger px-3 py-2">
                Exception
            </span>
        );
    }


    return (
        <span className="badge bg-secondary px-3 py-2">
            {shipping || "Unknown"}
        </span>
    );
};


  // COMPONENT

function Orders() {

    const [
        orders,
        setOrders
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        deletingId,
        setDeletingId
    ] = useState(null);

    const [
        updatingId,
        setUpdatingId
    ] = useState(null);

    const [
        search,
        setSearch
    ] = useState("");

    const [
        statusFilter,
        setStatusFilter
    ] = useState("All");

    const [
        selectedOrder,
        setSelectedOrder
    ] = useState(null);

    const [
        selectedShipment,
        setSelectedShipment
    ] = useState(null);

    const [
        selectedNewStatus,
        setSelectedNewStatus
    ] = useState("");

    const [
        shipmentLoading,
        setShipmentLoading
    ] = useState(false);


  // LOAD ORDERS

    const loadOrders = async () => {

        try {

            setLoading(true);

            const response =
                await orderService.getOrders();

            const documents =
                response?.documents || [];

            setOrders(documents);

        } catch (error) {

            console.error(
                "Load orders error:",
                error
            );

            toast.error(
                error?.message ||
                "Failed to load orders."
            );

        } finally {

            setLoading(false);
        }
    };


    useEffect(() => {

        loadOrders();

    }, []);


  // NORMALIZED ORDERS

    const normalizedOrders =
        useMemo(() => {

            return orders.map(
                (order) => ({

                    ...order,

                    id:
                        getOrderId(
                            order
                        ),

                    customer:
                        getCustomerName(
                            order
                        ),

                    email:
                        getCustomerEmail(
                            order
                        ),

                    phone:
                        getCustomerPhone(
                            order
                        ),

                    address:
                        getCustomerAddress(
                            order
                        ),

                    avatar:
                        getAvatar(
                            order
                        ),

                    payment:
                        getPaymentStatus(
                            order
                        ),

                    shipping:
                        getShippingStatus(
                            order
                        ),

                    total:
                        getOrderTotal(
                            order
                        ),

                    date:
                        getOrderDate(
                            order
                        ),

                    items:
                        getItems(
                            order
                        ),
                })
            );

        }, [orders]);


  // FILTER

    const filteredOrders =
        useMemo(() => {

            const searchValue =
                search
                    .trim()
                    .toLowerCase();

            const filter =
                statusFilter
                    .toUpperCase();


            return normalizedOrders.filter(
                (order) => {

                    const matchSearch =
                        !searchValue ||
                        safeString(
                            order.customer
                        )
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        safeString(
                            order.email
                        )
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        safeString(
                            order.id
                        )
                            .toLowerCase()
                            .includes(
                                searchValue
                            );


                    const shipping =
                        safeString(
                            order.shipping
                        )
                            .toUpperCase();


                    const matchStatus =
                        statusFilter ===
                            "All" ||
                        shipping ===
                            filter;


                    return (
                        matchSearch &&
                        matchStatus
                    );
                }
            );

        }, [
            normalizedOrders,
            search,
            statusFilter
        ]);


  // STATISTICS

    const totalOrders =
        normalizedOrders.length;


    const totalRevenue =
        normalizedOrders.reduce(
            (sum, order) => {

                const payment =
                    safeString(
                        order.payment
                    )
                        .toLowerCase();


                if (
                    payment === "paid" ||
                    payment === "success" ||
                    payment === "successful"
                ) {

                    return (
                        sum +
                        Number(
                            order.total || 0
                        )
                    );
                }

                return sum;

            },
            0
        );


    const delivered =
        normalizedOrders.filter(
            (order) =>
                safeString(
                    order.shipping
                )
                    .toUpperCase() ===
                "DELIVERED"
        ).length;


    const pending =
        normalizedOrders.filter(
            (order) =>
                safeString(
                    order.payment
                )
                    .toLowerCase() ===
                "pending"
        ).length;


  // FIND SHIPMENT

    const findShipmentForOrder =
        async (order) => {

            const customOrderId =
                safeString(
                    order?.orderId
                );

            const appwriteOrderId =
                safeString(
                    order?.$id
                );


            if (
                !SHIPMENTS_COLLECTION_ID
            ) {

                throw new Error(
                    "Shipments collection ID is missing."
                );
            }


  // First: custom orderId

            if (
                customOrderId
            ) {

                const response =
                    await databases.listDocuments(
                        DATABASE_ID,
                        SHIPMENTS_COLLECTION_ID,
                        [
                            Query.equal(
                                "orderId",
                                customOrderId
                            ),
                            Query.limit(10),
                        ]
                    );


                if (
                    response?.documents
                        ?.length
                ) {

                    return response.documents[0];
                }
            }


  // Second: Appwrite order $id

            if (
                appwriteOrderId &&
                appwriteOrderId !==
                    customOrderId
            ) {

                const response =
                    await databases.listDocuments(
                        DATABASE_ID,
                        SHIPMENTS_COLLECTION_ID,
                        [
                            Query.equal(
                                "orderId",
                                appwriteOrderId
                            ),
                            Query.limit(10),
                        ]
                    );


                if (
                    response?.documents
                        ?.length
                ) {

                    return response.documents[0];
                }
            }


            return null;
        };


  // LOAD SHIPMENT FOR SELECTED ORDER

    const openOrderDetails =
        async (order) => {

            setSelectedOrder(order);
            setSelectedShipment(null);
            setSelectedNewStatus("");
            setShipmentLoading(true);


            try {

                const shipment =
                    await findShipmentForOrder(
                        order
                    );

                setSelectedShipment(
                    shipment
                );


                if (shipment) {

                    setSelectedNewStatus(
                        String(
                            shipment.status ||
                            "PLACED"
                        )
                            .toUpperCase()
                    );
                }

            } catch (error) {

                console.error(
                    "Shipment load error:",
                    error
                );

                toast.error(
                    error?.message ||
                    "Unable to load shipment."
                );

            } finally {

                setShipmentLoading(
                    false
                );
            }
        };


  // STATUS UPDATE

    const handleStatusUpdate =
        async () => {

            if (!selectedOrder) {

                toast.error(
                    "Order is not selected."
                );

                return;
            }


            if (!selectedShipment) {

                toast.error(
                    "Shipment not found for this order."
                );

                return;
            }


            const currentStatus =
                String(
                    selectedShipment.status ||
                    "PLACED"
                )
                    .toUpperCase();


            const newStatus =
                String(
                    selectedNewStatus
                )
                    .trim()
                    .toUpperCase();


            if (!newStatus) {

                toast.error(
                    "Please select a status."
                );

                return;
            }


            if (
                currentStatus ===
                newStatus
            ) {

                toast.error(
                    "This shipment is already in this status."
                );

                return;
            }


            const allowedStatuses =
                STATUS_FLOW[
                    currentStatus
                ] || [];


            if (
                !allowedStatuses.includes(
                    newStatus
                )
            ) {

                toast.error(
                    `Cannot move shipment directly from ${formatStatus(
                        currentStatus
                    )} to ${formatStatus(
                        newStatus
                    )}.`
                );

                return;
            }


            try {

                setUpdatingId(
                    selectedOrder.$id
                );


                toast.loading(
                    `Updating shipment to ${formatStatus(
                        newStatus
                    )}...`,
                    {
                        id: "shipment-status",
                    }
                );


                // =================================================
                // IMPORTANT
                // shipmentHelper handles:
                //
                // DISPATCHED -> courier + tracking ID
                // OUT_FOR_DELIVERY -> OTP
                // notification
                // tracking event
                // admin notification
                // =================================================

                const result =
                    await shipmentHelper.updateShipmentStatus(
                        selectedShipment.$id,
                        newStatus,
                        {
                            orderId:
                                String(
                                    selectedShipment.orderId ||
                                    selectedOrder.orderId ||
                                    selectedOrder.$id ||
                                    ""
                                ),

                            userId:
                                String(
                                    selectedShipment.userId ||
                                    selectedOrder.userId ||
                                    ""
                                ),

                            trackingId:
                                String(
                                    selectedShipment.trackingId ||
                                    ""
                                ),
                        }
                    );


                if (
                    !result?.success
                ) {

                    throw new Error(
                        result?.error ||
                        result?.message ||
                        "Shipment status update failed."
                    );
                }


                const updatedShipment =
                    result.shipment;


                setSelectedShipment(
                    updatedShipment
                );


                setSelectedNewStatus(
                    String(
                        updatedShipment?.status ||
                        newStatus
                    )
                        .toUpperCase()
                );


  // Update order UI locally

                setOrders(
                    (currentOrders) =>
                        currentOrders.map(
                            (item) => {

                                if (
                                    item.$id !==
                                    selectedOrder.$id
                                ) {
                                    return item;
                                }


                                return {
                                    ...item,

                                    shippingStatus:
                                        newStatus,

                                    shipping:
                                        newStatus,

                                    status:
                                        newStatus,
                                };
                            }
                        )
                );


                setSelectedOrder(
                    (current) =>
                        current
                            ? {
                                  ...current,

                                  shippingStatus:
                                      newStatus,

                                  shipping:
                                      newStatus,

                                  status:
                                      newStatus,
                              }
                            : current
                );


                toast.success(
                    `Shipment updated to ${formatStatus(
                        newStatus
                    )}`,
                    {
                        id: "shipment-status",
                    }
                );


  // DISPATCH INFO

                if (
                    newStatus ===
                    "DISPATCHED"
                ) {

                    const courier =
                        updatedShipment?.courier ||
                        "Assigned";

                    const trackingId =
                        updatedShipment?.trackingId ||
                        "Generated";


                    toast.success(
                        `Courier: ${courier} | Tracking: ${trackingId}`,
                        {
                            duration: 5000,
                        }
                    );
                }


  // OUT FOR DELIVERY

                if (
                    newStatus ===
                    "OUT_FOR_DELIVERY"
                ) {

                    toast.success(
                        "Delivery OTP generated and customer notified.",
                        {
                            duration: 5000,
                        }
                    );
                }


            } catch (error) {

                console.error(
                    "Status update error:",
                    error
                );


                toast.error(
                    error?.message ||
                    "Failed to update shipment status.",
                    {
                        id: "shipment-status",
                    }
                );

            } finally {

                setUpdatingId(
                    null
                );
            }
        };


  // QUICK STATUS UPDATE FROM TABLE

    // eslint-disable-next-line no-unused-vars
    const handleQuickStatus =
        async (
            order,
            newStatus
        ) => {

            try {

                setUpdatingId(
                    order.$id
                );


                const shipment =
                    await findShipmentForOrder(
                        order
                    );


                if (!shipment) {

                    throw new Error(
                        "Shipment not found for this order."
                    );
                }


                const currentStatus =
                    String(
                        shipment.status ||
                        "PLACED"
                    )
                        .toUpperCase();


                const allowed =
                    STATUS_FLOW[
                        currentStatus
                    ] || [];


                if (
                    !allowed.includes(
                        newStatus
                    )
                ) {

                    throw new Error(
                        `Cannot move from ${formatStatus(
                            currentStatus
                        )} to ${formatStatus(
                            newStatus
                        )}.`
                    );
                }


                const result =
                    await shipmentHelper.updateShipmentStatus(
                        shipment.$id,
                        newStatus,
                        {
                            orderId:
                                String(
                                    shipment.orderId ||
                                    order.orderId ||
                                    order.$id ||
                                    ""
                                ),

                            userId:
                                String(
                                    shipment.userId ||
                                    order.userId ||
                                    ""
                                ),

                            trackingId:
                                String(
                                    shipment.trackingId ||
                                    ""
                                ),
                        }
                    );


                if (
                    !result?.success
                ) {

                    throw new Error(
                        result?.error ||
                        "Shipment update failed."
                    );
                }


                const updatedShipment =
                    result.shipment;


                setOrders(
                    (currentOrders) =>
                        currentOrders.map(
                            (item) =>
                                item.$id ===
                                order.$id
                                    ? {
                                          ...item,

                                          shippingStatus:
                                              newStatus,

                                          shipping:
                                              newStatus,

                                          status:
                                              newStatus,
                                      }
                                    : item
                        )
                );


                if (
                    selectedOrder?.$id ===
                    order.$id
                ) {

                    setSelectedOrder(
                        (current) =>
                            current
                                ? {
                                      ...current,

                                      shippingStatus:
                                          newStatus,

                                      shipping:
                                          newStatus,

                                      status:
                                          newStatus,
                                  }
                                : current
                    );

                    setSelectedShipment(
                        updatedShipment
                    );

                    setSelectedNewStatus(
                        newStatus
                    );
                }


                toast.success(
                    `${formatStatus(
                        newStatus
                    )} successfully`
                );


                if (
                    newStatus ===
                    "DISPATCHED"
                ) {

                    toast.success(
                        `Tracking ID: ${
                            updatedShipment?.trackingId ||
                            "Generated"
                        }`,
                        {
                            duration: 5000,
                        }
                    );
                }


                if (
                    newStatus ===
                    "OUT_FOR_DELIVERY"
                ) {

                    toast.success(
                        "Delivery OTP generated.",
                        {
                            duration: 5000,
                        }
                    );
                }

            } catch (error) {

                console.error(
                    "Quick status error:",
                    error
                );

                toast.error(
                    error?.message ||
                    "Status update failed."
                );

            } finally {

                setUpdatingId(
                    null
                );
            }
        };


  // DELETE ORDER

    const handleDeleteOrder =
        async (order) => {

            const orderId =
                getOrderId(order);


            if (!order?.$id) {

                toast.error(
                    "Appwrite Order ID is missing."
                );

                return;
            }


            const customer =
                getCustomerName(order);


            const confirmed =
                window.confirm(
                    `Delete order ${orderId} of ${customer}?\n\n` +
                    `This will permanently delete:\n` +
                    `• Order\n` +
                    `• Shipment\n` +
                    `• Shipment Events\n` +
                    `• Delivery OTPs\n` +
                    `• Notifications\n\n` +
                    `This action cannot be undone.`
                );


            if (!confirmed) {
                return;
            }


            try {

                setDeletingId(
                    order.$id
                );


                toast.loading(
                    "Deleting order and related data...",
                    {
                        id: `delete-${order.$id}`,
                    }
                );


                await deleteOrderCascade(
                    order
                );


                setOrders(
                    (currentOrders) =>
                        currentOrders.filter(
                            (item) =>
                                item.$id !==
                                order.$id
                        )
                );


                if (
                    selectedOrder?.$id ===
                    order.$id
                ) {

                    setSelectedOrder(
                        null
                    );

                    setSelectedShipment(
                        null
                    );
                }


                toast.success(
                    `Order ${orderId} deleted successfully.`,
                    {
                        id: `delete-${order.$id}`,
                    }
                );

            } catch (error) {

                console.error(
                    "Delete order cascade error:",
                    error
                );


                toast.error(
                    error?.message ||
                    "Order deletion failed.",
                    {
                        id: `delete-${order.$id}`,
                    }
                );

            } finally {

                setDeletingId(
                    null
                );
            }
        };


  // PRINT

    const printInvoice = () => {
        window.print();
    };


  // INVOICE

    const handleInvoice =
        (order) => {

            setSelectedOrder(
                order
            );

            toast.success(
                "Order opened. You can print the invoice."
            );
        };


  // FORMAT MONEY

    const formatMoney =
        (amount) => {

            return Number(
                amount || 0
            ).toLocaleString(
                "en-IN"
            );
        };


  // CURRENT ALLOWED STATUSES

    const allowedNextStatuses =
        selectedShipment
            ? (
                  STATUS_FLOW[
                      String(
                          selectedShipment.status ||
                          "PLACED"
                      )
                          .toUpperCase()
                  ] || []
              )
            : [];


  // RENDER

    return (
<div className="container-fluid py-4 orders-page">


            {/* HEADER */}

            <div className="d-flex justify-content-between align-items-center flex-wrap mb-4">

                <div>

                    <h2 className="fw-bold mb-1">
                        Orders Management
                    </h2>

                    <p className="text-muted mb-0">
                        Manage orders, shipments,
                        tracking and delivery.
                    </p>

                </div>


                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={loadOrders}
                    disabled={loading}
                >

                    <FaSyncAlt
                        className={`me-2 ${
                            loading
                                ? "fa-spin"
                                : ""
                        }`}
                    />

                    Refresh Orders

                </button>

            </div>


            {/* STATISTICS */}

            <div className="row g-4 mb-4">


                <div className="col-lg-3 col-md-6">

                    <div className="card border-0 shadow-lg h-100">

                        <div className="card-body text-center">

                            <FaShoppingBag
                                className="text-primary mb-3"
                                size={40}
                            />

                            <h3 className="fw-bold">
                                {totalOrders}
                            </h3>

                            <p className="text-muted mb-0">
                                Total Orders
                            </p>

                        </div>

                    </div>

                </div>


                <div className="col-lg-3 col-md-6">

                    <div className="card border-0 shadow-lg h-100">

                        <div className="card-body text-center">

                            <FaRupeeSign
                                className="text-success mb-3"
                                size={40}
                            />

                            <h3 className="fw-bold">
                                ₹{" "}
                                {formatMoney(
                                    totalRevenue
                                )}
                            </h3>

                            <p className="text-muted mb-0">
                                Revenue
                            </p>

                        </div>

                    </div>

                </div>


                <div className="col-lg-3 col-md-6">

                    <div className="card border-0 shadow-lg h-100">

                        <div className="card-body text-center">

                            <FaTruck
                                className="text-info mb-3"
                                size={40}
                            />

                            <h3 className="fw-bold">
                                {delivered}
                            </h3>

                            <p className="text-muted mb-0">
                                Delivered
                            </p>

                        </div>

                    </div>

                </div>


                <div className="col-lg-3 col-md-6">

                    <div className="card border-0 shadow-lg h-100">

                        <div className="card-body text-center">

                            <FaClock
                                className="text-warning mb-3"
                                size={40}
                            />

                            <h3 className="fw-bold">
                                {pending}
                            </h3>

                            <p className="text-muted mb-0">
                                Pending Payments
                            </p>

                        </div>

                    </div>

                </div>

            </div>


            {/* SEARCH + FILTER */}

            <div className="card border-0 shadow-lg mb-4">

                <div className="card-body">

                    <div className="row g-3">


                        <div className="col-lg-8">

                            <div className="input-group">

                                <span className="input-group-text">
                                    <FaSearch />
                                </span>

                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search Order ID or Customer..."
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

                            <div className="input-group">

                                <span className="input-group-text">
                                    <FaFilter />
                                </span>

                                <AdminCustomSelect
                                    className="form-select"
                                    value={
                                        statusFilter
                                    }
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="All">
                                        All
                                    </option>

                                    {STATUS_OPTIONS.map(
                                        (status) => (

                                            <option
                                                key={
                                                    status
                                                }
                                                value={
                                                    status
                                                }
                                            >
                                                {formatStatus(
                                                    status
                                                )}
                                            </option>

                                        )
                                    )}

                                </AdminCustomSelect>

                            </div>

                        </div>

                    </div>

                </div>

            </div>


            {/* ORDERS TABLE */}

            <div className="card border-0 shadow-lg">

                <div className="table-responsive">

                    <table className="table table-hover align-middle mb-0">

                        <thead className="table-dark">

                            <tr>

                                <th>
                                    Order ID
                                </th>

                                <th>
                                    Customer
                                </th>

                                <th>
                                    Payment
                                </th>

                                <th>
                                    Shipping
                                </th>

                                <th>
                                    Total
                                </th>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Actions
                                </th>

                            </tr>

                        </thead>


                        <tbody>


                            {/* LOADING */}

                            {loading && (

                                <tr>

                                    <td
                                        colSpan="7"
                                        className="text-center py-5"
                                    >

                                        <div
                                            className="spinner-border text-primary"
                                            role="status"
                                        />

                                        <p className="text-muted mt-3 mb-0">
                                            Loading orders...
                                        </p>

                                    </td>

                                </tr>

                            )}


                            {/* EMPTY */}

                            {!loading &&
                                filteredOrders.length ===
                                    0 && (

                                    <tr>

                                        <td
                                            colSpan="7"
                                            className="text-center py-5"
                                        >

                                            <FaShoppingBag
                                                size={45}
                                                className="text-muted mb-3"
                                            />

                                            <h5>
                                                No Orders Found
                                            </h5>

                                            <p className="text-muted mb-0">
                                                No orders match your search or filter.
                                            </p>

                                        </td>

                                    </tr>
                                )}


                            {/* ORDERS */}

                            {!loading &&
                                filteredOrders.map(
                                    (order) => (

                                        <tr
                                            key={
                                                order.$id
                                            }
                                        >


                                            {/* ORDER ID */}

                                            <td>

                                                <span className="fw-bold">
                                                    {
                                                        order.id
                                                    }
                                                </span>

                                            </td>


                                            {/* CUSTOMER */}

                                            <td>

                                                <div className="d-flex align-items-center">

                                                    <img
                                                        src={
                                                            order.avatar
                                                        }
                                                        alt={
                                                            order.customer
                                                        }
                                                        width="45"
                                                        height="45"
                                                        className="rounded-circle me-3 border"
                                                        onError={(
                                                            e
                                                        ) => {

                                                            e.currentTarget.src =
                                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                                    order.customer
                                                                )}`;
                                                        }}
                                                    />

                                                    <div>

                                                        <h6 className="mb-0 fw-bold">
                                                            {
                                                                order.customer
                                                            }
                                                        </h6>

                                                        <small className="text-muted">
                                                            {order.email ||
                                                                "No email"}
                                                        </small>

                                                    </div>

                                                </div>

                                            </td>


                                            {/* PAYMENT */}

                                            <td>
                                                {renderPaymentBadge(
                                                    order.payment
                                                )}
                                            </td>


                                            {/* SHIPPING */}

                                            <td>
                                                {renderShippingBadge(
                                                    order.shipping
                                                )}
                                            </td>


                                            {/* TOTAL */}

                                            <td className="fw-bold">
                                                ₹{" "}
                                                {formatMoney(
                                                    order.total
                                                )}
                                            </td>


                                            {/* DATE */}

                                            <td>
                                                {order.date}
                                            </td>


                                            {/* ACTIONS */}

                                            <td>

                                                <div className="d-flex gap-2 flex-wrap">


                                                    {/* VIEW */}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-primary"
                                                        title="View Order"
                                                        onClick={() =>
                                                            openOrderDetails(
                                                                order
                                                            )
                                                        }
                                                    >
                                                        <FaEye />
                                                    </button>


                                                    {/* INVOICE */}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success"
                                                        title="Invoice"
                                                        onClick={() =>
                                                            handleInvoice(
                                                                order
                                                            )
                                                        }
                                                    >
                                                        <FaFileInvoice />
                                                    </button>


                                                    {/* PRINT */}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-dark"
                                                        title="Print"
                                                        onClick={
                                                            printInvoice
                                                        }
                                                    >
                                                        <FaPrint />
                                                    </button>


                                                    {/* DELETE */}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger"
                                                        title="Delete Order"
                                                        disabled={
                                                            deletingId ===
                                                            order.$id
                                                        }
                                                        onClick={() =>
                                                            handleDeleteOrder(
                                                                order
                                                            )
                                                        }
                                                    >

                                                        {deletingId ===
                                                        order.$id ? (

                                                            <span className="spinner-border spinner-border-sm" />

                                                        ) : (

                                                            <FaTrash />

                                                        )}

                                                    </button>

                                                </div>

                                            </td>

                                        </tr>

                                    )
                                )}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* ORDER DETAILS MODAL */}

            {selectedOrder && (

                <div
                    className="modal fade show d-block"
                    style={{
                        background:
                            "rgba(0,0,0,.55)",
                    }}
                >

                    <div className="modal-dialog modal-xl modal-dialog-scrollable">

                        <div className="modal-content">


                            {/* HEADER */}

                            <div className="modal-header">

                                <div>

                                    <h4 className="modal-title mb-1">
                                        Order Details
                                    </h4>

                                    <small className="text-muted">
                                        {
                                            selectedOrder.id
                                        }
                                    </small>

                                </div>


                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {

                                        setSelectedOrder(
                                            null
                                        );

                                        setSelectedShipment(
                                            null
                                        );
                                    }}
                                />

                            </div>


                            {/* BODY */}

                            <div className="modal-body">


                                {/* CUSTOMER + ORDER */}

                                <div className="row g-4 mb-4">


                                    <div className="col-lg-4">

                                        <div className="card border-0 shadow-sm h-100">

                                            <div className="card-body text-center">

                                                <img
                                                    src={
                                                        selectedOrder.avatar
                                                    }
                                                    alt={
                                                        selectedOrder.customer
                                                    }
                                                    width="110"
                                                    height="110"
                                                    className="rounded-circle border mb-3"
                                                />

                                                <h5 className="fw-bold">
                                                    {
                                                        selectedOrder.customer
                                                    }
                                                </h5>

                                                <p className="text-muted mb-1">
                                                    {
                                                        selectedOrder.email ||
                                                        "No email"
                                                    }
                                                </p>

                                                <p className="text-muted mb-0">
                                                    {
                                                        selectedOrder.phone ||
                                                        "No phone"
                                                    }
                                                </p>

                                            </div>

                                        </div>

                                    </div>


                                    <div className="col-lg-8">

                                        <div className="card border-0 shadow-sm h-100">

                                            <div className="card-body">

                                                <h5 className="fw-bold mb-4">
                                                    Order Information
                                                </h5>


                                                <div className="row g-3">

                                                    <div className="col-md-6">

                                                        <small className="text-muted">
                                                            Order ID
                                                        </small>

                                                        <div className="fw-bold">
                                                            {
                                                                selectedOrder.id
                                                            }
                                                        </div>

                                                    </div>


                                                    <div className="col-md-6">

                                                        <small className="text-muted">
                                                            Date
                                                        </small>

                                                        <div className="fw-bold">
                                                            {
                                                                selectedOrder.date
                                                            }
                                                        </div>

                                                    </div>


                                                    <div className="col-md-6">

                                                        <small className="text-muted">
                                                            Payment
                                                        </small>

                                                        <div className="mt-1">
                                                            {renderPaymentBadge(
                                                                selectedOrder.payment
                                                            )}
                                                        </div>

                                                    </div>


                                                    <div className="col-md-6">

                                                        <small className="text-muted">
                                                            Total
                                                        </small>

                                                        <div className="fw-bold text-success fs-5">
                                                            ₹{" "}
                                                            {formatMoney(
                                                                selectedOrder.total
                                                            )}
                                                        </div>

                                                    </div>


                                                    <div className="col-12">

                                                        <small className="text-muted">
                                                            Delivery Address
                                                        </small>

                                                        <div className="fw-semibold">
                                                            <FaMapMarkerAlt className="text-danger me-2" />

                                                            {
                                                                selectedOrder.address ||
                                                                "Address not available"
                                                            }
                                                        </div>

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>


                                {/* SHIPMENT MANAGEMENT */}

                                <div className="card border-0 shadow-sm mb-4">

                                    <div className="card-header bg-dark text-white">

                                        <div className="d-flex justify-content-between align-items-center">

                                            <div>

                                                <h5 className="mb-1 fw-bold">
                                                    <FaTruck className="me-2" />
                                                    Shipment Management
                                                </h5>

                                                <small className="opacity-75">
                                                    Update customer shipment status
                                                </small>

                                            </div>


                                            {selectedShipment && (

                                                <span className="badge bg-light text-dark px-3 py-2">
                                                    {
                                                        formatStatus(
                                                            selectedShipment.status
                                                        )
                                                    }
                                                </span>

                                            )}

                                        </div>

                                    </div>


                                    <div className="card-body">


                                        {shipmentLoading && (

                                            <div className="text-center py-4">

                                                <div className="spinner-border text-primary" />

                                                <p className="text-muted mt-2 mb-0">
                                                    Loading shipment...
                                                </p>

                                            </div>

                                        )}


                                        {!shipmentLoading &&
                                            !selectedShipment && (

                                                <div className="alert alert-warning mb-0">

                                                    <FaExclamationTriangle className="me-2" />

                                                    Shipment has not been found for this order.

                                                </div>

                                            )}


                                        {!shipmentLoading &&
                                            selectedShipment && (

                                                <>

                                                    {/* SHIPMENT DETAILS */}

                                                    <div className="row g-3 mb-4">


                                                        <div className="col-md-3">

                                                            <div className="border rounded p-3 h-100">

                                                                <small className="text-muted d-block">
                                                                    Status
                                                                </small>

                                                                <div className="fw-bold mt-1">
                                                                    {renderShippingBadge(
                                                                        selectedShipment.status
                                                                    )}
                                                                </div>

                                                            </div>

                                                        </div>


                                                        <div className="col-md-3">

                                                            <div className="border rounded p-3 h-100">

                                                                <small className="text-muted d-block">
                                                                    Courier
                                                                </small>

                                                                <div className="fw-bold mt-1">
                                                                    {
                                                                        selectedShipment.courier ||
                                                                        "Not assigned"
                                                                    }
                                                                </div>

                                                            </div>

                                                        </div>


                                                        <div className="col-md-3">

                                                            <div className="border rounded p-3 h-100">

                                                                <small className="text-muted d-block">
                                                                    Courier Code
                                                                </small>

                                                                <div className="fw-bold mt-1">
                                                                    {
                                                                        selectedShipment.courierCode ||
                                                                        "Not assigned"
                                                                    }
                                                                </div>

                                                            </div>

                                                        </div>


                                                        <div className="col-md-3">

                                                            <div className="border rounded p-3 h-100">

                                                                <small className="text-muted d-block">
                                                                    Tracking ID
                                                                </small>

                                                                <div className="fw-bold mt-1">
                                                                    {
                                                                        selectedShipment.trackingId ||
                                                                        "Not generated"
                                                                    }
                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div>


                                                    {/* STATUS UPDATE */}

                                                    <div className="border rounded p-4">

                                                        <div className="row g-3 align-items-end">


                                                            <div className="col-lg-8">

                                                                <label className="form-label fw-bold">

                                                                    Update Shipment Status

                                                                </label>

                                                                <AdminCustomSelect
                                                                    className="form-select form-select-lg"
                                                                    value={
                                                                        selectedNewStatus
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setSelectedNewStatus(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        updatingId ===
                                                                            selectedOrder.$id ||
                                                                        allowedNextStatuses.length ===
                                                                            0
                                                                    }
                                                                >

                                                                    <option value="">
                                                                        Select next status
                                                                    </option>


                                                                    {allowedNextStatuses.map(
                                                                        (
                                                                            status
                                                                        ) => (

                                                                            <option
                                                                                key={
                                                                                    status
                                                                                }
                                                                                value={
                                                                                    status
                                                                                }
                                                                            >
                                                                                {formatStatus(
                                                                                    status
                                                                                )}
                                                                            </option>

                                                                        )
                                                                    )}

                                                                </AdminCustomSelect>


                                                                {allowedNextStatuses.length ===
                                                                    0 && (

                                                                    <small className="text-muted d-block mt-2">

                                                                        This shipment has reached a terminal status.

                                                                    </small>

                                                                )}

                                                            </div>


                                                            <div className="col-lg-4">

                                                                <button
                                                                    type="button"
                                                                    className="btn btn-primary btn-lg w-100"
                                                                    onClick={
                                                                        handleStatusUpdate
                                                                    }
                                                                    disabled={
                                                                        updatingId ===
                                                                            selectedOrder.$id ||
                                                                        !selectedNewStatus ||
                                                                        selectedNewStatus ===
                                                                            String(
                                                                                selectedShipment.status
                                                                            ).toUpperCase()
                                                                    }
                                                                >

                                                                    {updatingId ===
                                                                    selectedOrder.$id ? (

                                                                        <>

                                                                            <span className="spinner-border spinner-border-sm me-2" />

                                                                            Updating...

                                                                        </>

                                                                    ) : (

                                                                        <>

                                                                            <FaRoute className="me-2" />

                                                                            Update Status

                                                                        </>

                                                                    )}

                                                                </button>

                                                            </div>

                                                        </div>

                                                    </div>


                                                    {/* AUTOMATIC ACTION INFO */}

                                                    <div className="row g-3 mt-3">


                                                        <div className="col-md-4">

                                                            <div className="alert alert-info mb-0 h-100">

                                                                <FaBox className="me-2" />

                                                                <strong>DISPATCHED</strong>

                                                                <div className="small mt-2">

                                                                    Courier and Tracking ID will be generated automatically.

                                                                </div>

                                                            </div>

                                                        </div>


                                                        <div className="col-md-4">

                                                            <div className="alert alert-warning mb-0 h-100">

                                                                <FaKey className="me-2" />

                                                                <strong>OUT FOR DELIVERY</strong>

                                                                <div className="small mt-2">

                                                                    Delivery OTP will be generated automatically.

                                                                </div>

                                                            </div>

                                                        </div>


                                                        <div className="col-md-4">

                                                            <div className="alert alert-success mb-0 h-100">

                                                                <FaCheckCircle className="me-2" />

                                                                <strong>DELIVERED</strong>

                                                                <div className="small mt-2">

                                                                    Shipment becomes completed after delivery verification.

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div>

                                                </>

                                            )}

                                    </div>

                                </div>


                                {/* PRODUCTS */}

                                <div className="card border-0 shadow-sm mb-4">

                                    <div className="card-body">

                                        <h5 className="fw-bold mb-3">
                                            Ordered Products
                                        </h5>


                                        {selectedOrder.items.length ===
                                            0 ? (

                                            <div className="alert alert-light border mb-0">
                                                Product information not available.
                                            </div>

                                        ) : (

                                            <div className="table-responsive">

                                                <table className="table table-bordered align-middle">

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                Product
                                                            </th>

                                                            <th>
                                                                Qty
                                                            </th>

                                                            <th>
                                                                Price
                                                            </th>

                                                            <th>
                                                                Total
                                                            </th>

                                                        </tr>

                                                    </thead>


                                                    <tbody>

                                                        {selectedOrder.items.map(
                                                            (
                                                                item,
                                                                index
                                                            ) => (

                                                                <tr
                                                                    key={
                                                                        index
                                                                    }
                                                                >

                                                                    <td>

                                                                        <div className="d-flex align-items-center">

                                                                            {item.image && (

                                                                                <img
                                                                                    src={
                                                                                        item.image
                                                                                    }
                                                                                    alt={
                                                                                        item.name
                                                                                    }
                                                                                    width="45"
                                                                                    height="45"
                                                                                    className="rounded border me-2"
                                                                                />

                                                                            )}

                                                                            <span>
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </span>

                                                                        </div>

                                                                    </td>


                                                                    <td>
                                                                        {
                                                                            item.qty
                                                                        }
                                                                    </td>


                                                                    <td>
                                                                        ₹{" "}
                                                                        {formatMoney(
                                                                            item.price
                                                                        )}
                                                                    </td>


                                                                    <td className="fw-bold">
                                                                        ₹{" "}
                                                                        {formatMoney(
                                                                            item.price *
                                                                            item.qty
                                                                        )}
                                                                    </td>

                                                                </tr>

                                                            )
                                                        )}

                                                    </tbody>

                                                </table>

                                            </div>

                                        )}

                                    </div>

                                </div>


                                {/* ORDER TIMELINE */}

                                <div className="card border-0 shadow-sm">

                                    <div className="card-body">

                                        <h5 className="fw-bold mb-3">
                                            Order Timeline
                                        </h5>


                                        <div className="list-group">


                                            <div className="list-group-item d-flex justify-content-between align-items-center">

                                                <span>
                                                    🛒 Order Placed
                                                </span>

                                                <strong>
                                                    {
                                                        selectedOrder.date
                                                    }
                                                </strong>

                                            </div>


                                            <div className="list-group-item d-flex justify-content-between align-items-center">

                                                <span>
                                                    💳 Payment
                                                </span>

                                                {
                                                    renderPaymentBadge(
                                                        selectedOrder.payment
                                                    )
                                                }

                                            </div>


                                            <div className="list-group-item d-flex justify-content-between align-items-center">

                                                <span>
                                                    🚚 Current Shipping Status
                                                </span>

                                                {
                                                    renderShippingBadge(
                                                        selectedShipment?.status ||
                                                        selectedOrder.shipping
                                                    )
                                                }

                                            </div>


                                            {selectedShipment?.trackingId && (

                                                <div className="list-group-item d-flex justify-content-between align-items-center">

                                                    <span>
                                                        📦 Tracking ID
                                                    </span>

                                                    <strong>
                                                        {
                                                            selectedShipment.trackingId
                                                        }
                                                    </strong>

                                                </div>

                                            )}


                                            {selectedShipment?.courier && (

                                                <div className="list-group-item d-flex justify-content-between align-items-center">

                                                    <span>
                                                        🚛 Courier
                                                    </span>

                                                    <strong>
                                                        {
                                                            selectedShipment.courier
                                                        }
                                                    </strong>

                                                </div>

                                            )}


                                            {selectedShipment?.otpRequired && (

                                                <div className="list-group-item d-flex justify-content-between align-items-center">

                                                    <span>
                                                        🔐 Delivery OTP
                                                    </span>

                                                    <span className="badge bg-warning text-dark">
                                                        Required
                                                    </span>

                                                </div>

                                            )}

                                        </div>

                                    </div>

                                </div>


                                {/* DELETE WARNING */}

                                <div className="alert alert-warning d-flex align-items-start mt-4 mb-0">

                                    <FaExclamationTriangle
                                        className="me-2 mt-1"
                                    />

                                    <div>

                                        <strong>
                                            Delete Order
                                        </strong>

                                        <div>
                                            Deleting this order from Admin will also remove its related shipment, tracking events, delivery OTPs and notifications.
                                        </div>

                                    </div>

                                </div>

                            </div>


                            {/* FOOTER */}

                            <div className="modal-footer">


                                <button
                                    type="button"
                                    className="btn btn-danger me-auto"
                                    disabled={
                                        deletingId ===
                                        selectedOrder.$id
                                    }
                                    onClick={() =>
                                        handleDeleteOrder(
                                            selectedOrder
                                        )
                                    }
                                >

                                    {deletingId ===
                                    selectedOrder.$id ? (

                                        <>

                                            <span className="spinner-border spinner-border-sm me-2" />

                                            Deleting...

                                        </>

                                    ) : (

                                        <>

                                            <FaTrash className="me-2" />

                                            Delete Order

                                        </>

                                    )}

                                </button>


                                <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={() =>
                                        handleInvoice(
                                            selectedOrder
                                        )
                                    }
                                >

                                    <FaFileInvoice className="me-2" />

                                    Invoice

                                </button>


                                <button
                                    type="button"
                                    className="btn btn-dark"
                                    onClick={
                                        printInvoice
                                    }
                                >

                                    <FaPrint className="me-2" />

                                    Print

                                </button>


                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {

                                        setSelectedOrder(
                                            null
                                        );

                                        setSelectedShipment(
                                            null
                                        );
                                    }}
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}


export default Orders;