import shipmentService from "./shipmentService";
import shipmentEventService from "./shipmentEventService";
import warehouseService from "./warehouseService";
import deliveryOtpService from "./deliveryOtpService";
import notificationService from "./notificationService";

  // ADMIN USER IDS

// .env example:
//
// VITE_APPWRITE_ADMIN_USER_IDS=ADMIN_ID_1,ADMIN_ID_2
//
// Single admin:
//
// VITE_APPWRITE_ADMIN_USER_IDS=ADMIN_ID_1

const ADMIN_USER_IDS = String(
    import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS || ""
)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);


  // COURIERS

const COURIERS = [
    {
        name: "FastNexTech",
        code: "FNTX",
    },
    {
        name: "DeTechLiv",
        code: "DTL",
    },
    {
        name: "TechFonish",
        code: "TFN",
    },
    {
        name: "Technoe",
        code: "TNE",
    },
];


  // WAREHOUSE MAPPING

export const WAREHOUSE_MAP = {
    Gujarat: "WH-AHM-01",
    Maharashtra: "WH-MUM-01",
    Delhi: "WH-DEL-01",
    Karnataka: "WH-BLR-01",
};


  // SHIPMENT HELPER

class ShipmentHelper {

  // CREATE ADMIN NOTIFICATION

    async createAdminNotification({
        type = "GENERAL",
        title = "Admin Notification",
        message = "",
        orderId = "",
        shipmentId = "",
        trackingId = "",
    }) {

        try {

  // CHECK ADMIN IDS

            if (ADMIN_USER_IDS.length === 0) {

                console.warn(
                    "Admin notification skipped: " +
                    "VITE_APPWRITE_ADMIN_USER_IDS is not configured."
                );

                return [];

            }


  // COMMON DATA

            const createdAt =
                new Date().toISOString();


  // CREATE NOTIFICATION FOR EVERY ADMIN

            const notifications =
                await Promise.allSettled(
                    ADMIN_USER_IDS.map(
                        (adminUserId) =>
                            notificationService.createNotification({
                                userId:
                                    String(adminUserId),

                                type:
                                    String(type),

                                title:
                                    String(title),

                                message:
                                    String(message),

                                orderId:
                                    String(orderId || ""),

                                shipmentId:
                                    String(shipmentId || ""),

                                trackingId:
                                    String(trackingId || ""),

                                isRead: false,

                                createdAt,
                            })
                    )
                );


  // LOG RESULT

            const successful =
                notifications.filter(
                    (result) =>
                        result.status ===
                        "fulfilled"
                );

            const failed =
                notifications.filter(
                    (result) =>
                        result.status ===
                        "rejected"
                );


            console.log(
                "Admin notification created:",
                {
                    type,
                    title,
                    successful:
                        successful.length,
                    failed:
                        failed.length,
                }
            );


            if (failed.length > 0) {

                console.error(
                    "Some admin notifications failed:",
                    failed
                );

            }


            return successful.map(
                (result) =>
                    result.value
            );

        } catch (error) {

            console.error(
                "Create admin notification error:",
                error
            );

            return [];

        }
    }


  // GENERATE TRACKING ID

    generateTrackingId(courierCode) {

        const randomNumber =
            Math.floor(
                100000000000 +
                Math.random() *
                900000000000
            );

        return `${courierCode}${randomNumber}`;
    }


  // SELECT COURIER

    selectCourier() {

        const index =
            Math.floor(
                Math.random() *
                COURIERS.length
            );

        return COURIERS[index];
    }


  // SELECT WAREHOUSE

    async selectWarehouse(
        destinationState,
        destinationCity
    ) {

        try {

            const activeWarehouses =
                await warehouseService.getActiveWarehouses();


            if (
                !Array.isArray(
                    activeWarehouses
                ) ||
                activeWarehouses.length === 0
            ) {

                console.error(
                    "No active warehouses found."
                );

                return null;
            }


            // Random active warehouse

            const randomIndex =
                Math.floor(
                    Math.random() *
                    activeWarehouses.length
                );


            const warehouse =
                activeWarehouses[
                    randomIndex
                ];


            console.log(
                "Selected Warehouse:",
                {
                    name:
                        warehouse?.name,

                    code:
                        warehouse?.code,

                    city:
                        warehouse?.city,

                    state:
                        warehouse?.state,

                    destinationCity,

                    destinationState,
                }
            );


            return warehouse;

        } catch (error) {

            console.error(
                "Warehouse selection error:",
                error
            );

            return null;
        }
    }


  // CALCULATE ETA

    calculateEstimatedDeliveryDate({
        originState,
        destinationState,
    }) {

        const sameState =
            String(originState || "")
                .trim()
                .toLowerCase() ===
            String(destinationState || "")
                .trim()
                .toLowerCase();


        const minDays =
            sameState ? 2 : 4;

        const maxDays =
            sameState ? 4 : 7;


        const deliveryDays =
            Math.floor(
                Math.random() *
                (
                    maxDays -
                    minDays +
                    1
                )
            ) + minDays;


        const estimatedDate =
            new Date();


        estimatedDate.setDate(
            estimatedDate.getDate() +
            deliveryDays
        );


        return estimatedDate.toISOString();
    }


  // CREATE INITIAL EVENT

    async createInitialEvent({
        shipment,
        warehouse,
    }) {

        const eventData = {

            shipmentId:
                String(
                    shipment.$id
                ),

            orderId:
                String(
                    shipment.orderId ||
                    ""
                ),

            // IMPORTANT:
            // PLACED par tracking ID nahi hoga.

            trackingId: "",

            status:
                "PLACED",

            title:
                "Order Placed",

            description:
                "Your order has been placed successfully and shipment processing has started.",

            city:
                String(
                    warehouse?.city ||
                    shipment.originCity ||
                    ""
                ),

            state:
                String(
                    warehouse?.state ||
                    shipment.originState ||
                    ""
                ),

            hubName:
                String(
                    warehouse?.name ||
                    ""
                ),

            timestamp:
                new Date().toISOString(),
        };


        return await shipmentEventService.createEvent(
            eventData
        );
    }


  // CREATE SHIPMENT

    async createShipment(order) {

        try {

            if (!order) {

                throw new Error(
                    "Order data is required."
                );
            }


  // ORDER ID

            const orderId =
                String(
                    order.orderId ||
                    order.$id ||
                    ""
                );


            if (!orderId) {

                throw new Error(
                    "Order ID is missing."
                );
            }


  // USER ID

            const userId =
                String(
                    order.userId ||
                    ""
                );


            if (!userId) {

                throw new Error(
                    "User ID is missing."
                );
            }


  // DESTINATION

            const destination =
                order.shippingAddress ||
                {};


            const destinationAddress =
                String(
                    destination.address ||
                    order.address ||
                    ""
                ).trim();


            const destinationCity =
                String(
                    destination.city ||
                    order.city ||
                    ""
                ).trim();


            const destinationState =
                String(
                    destination.state ||
                    order.state ||
                    ""
                ).trim();


            const destinationPincode =
                String(
                    destination.pincode ||
                    destination.zipCode ||
                    order.pincode ||
                    ""
                ).trim();


  // VALIDATE DESTINATION

            if (!destinationAddress) {

                throw new Error(
                    "Destination address is missing."
                );
            }


            if (!destinationCity) {

                throw new Error(
                    "Destination city is missing."
                );
            }


            if (!destinationState) {

                throw new Error(
                    "Destination state is missing."
                );
            }


            if (!destinationPincode) {

                throw new Error(
                    "Destination pincode is missing."
                );
            }


  // WAREHOUSE

            const warehouse =
                await this.selectWarehouse(
                    destinationState,
                    destinationCity
                );


            if (!warehouse) {

                throw new Error(
                    "No active warehouse available for shipment."
                );
            }


  // ETA

            const estimatedDeliveryDate =
                this.calculateEstimatedDeliveryDate({
                    originState:
                        warehouse.state,

                    destinationState,
                });


  // IMPORTANT
            //
            // At PLACED:
            //
            // trackingId = ""
            // courier = ""
            // courierCode = ""
            //
            // They will be assigned only at DISPATCHED.
            //
            // =================================================

            const shipmentData = {

                orderId,

                userId,

                trackingId: "",

                courier: "",

                courierCode: "",

                status:
                    "PLACED",

                originWarehouseId:
                    String(
                        warehouse.$id
                    ),

                originCity:
                    String(
                        warehouse.city ||
                        ""
                    ),

                originState:
                    String(
                        warehouse.state ||
                        ""
                    ),

                destinationAddress,

                destinationCity,

                destinationState,

                destinationPincode,

                estimatedDeliveryDate,

                otpRequired:
                    false,

                otpVerified:
                    false,
            };


            console.log(
                "Creating shipment with data:",
                shipmentData
            );


  // CREATE SHIPMENT

            const shipment =
                await shipmentService.createShipment(
                    shipmentData
                );


            if (!shipment?.$id) {

                throw new Error(
                    "Shipment was not created."
                );
            }


            console.log(
                "Shipment created:",
                shipment
            );


  // CREATE INITIAL PLACED EVENT

            try {

                await this.createInitialEvent({
                    shipment,
                    warehouse,
                });


                console.log(
                    "Initial shipment event created."
                );

            } catch (eventError) {

                console.error(
                    "Initial shipment event failed:",
                    eventError
                );
            }


  // ADMIN NOTIFICATION

            try {

                await this.createAdminNotification({

                    type:
                        "NEW_ORDER",

                    title:
                        "New Order Received 🛒",

                    message:
                        `A new order ${orderId} has been placed successfully.`,

                    orderId,

                    shipmentId:
                        String(
                            shipment.$id
                        ),

                    trackingId: "",
                });

            } catch (adminNotificationError) {

                console.error(
                    "New order admin notification failed:",
                    adminNotificationError
                );
            }


  // SUCCESS

            return {

                success:
                    true,

                shipment,

                courier:
                    null,

                warehouse,

                trackingId:
                    "",

                estimatedDeliveryDate,
            };

        } catch (error) {

            console.error(
                "Create shipment error:",
                error
            );


            return {

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to create shipment.",
            };
        }
    }


  // CREATE SHIPMENT FOR EXISTING ORDER

    async createShipmentForOrder(
        orderId,
        order
    ) {

        try {

            if (!orderId) {

                throw new Error(
                    "Order ID is required."
                );
            }


            if (!order) {

                throw new Error(
                    "Order data is required."
                );
            }


            return await this.createShipment({

                ...order,

                orderId:
                    String(orderId),
            });

        } catch (error) {

            console.error(
                "Create shipment for order error:",
                error
            );


            return {

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to create shipment.",
            };
        }
    }


  // UPDATE SHIPMENT STATUS

    async updateShipmentStatus(
        shipmentId,
        status,
        eventData = {}
    ) {

        try {

            if (!shipmentId) {

                throw new Error(
                    "Shipment ID is required."
                );
            }


            if (!status) {

                throw new Error(
                    "Shipment status is required."
                );
            }


            const normalizedStatus =
                String(status)
                    .trim()
                    .toUpperCase();


  // GET CURRENT SHIPMENT

            const currentShipment =
                await shipmentService.getShipment(
                    shipmentId
                );


            if (!currentShipment?.$id) {

                throw new Error(
                    "Shipment not found."
                );
            }


            const previousStatus =
                String(
                    currentShipment.status ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            const updateData = {

                status:
                    normalizedStatus,
            };


  // DISPATCHED

            if (
                normalizedStatus ===
                "DISPATCHED"
            ) {

                // Generate courier only
                // if not already assigned

                let courier = null;


                if (
                    currentShipment.courier &&
                    currentShipment.courierCode
                ) {

                    courier = {

                        name:
                            currentShipment.courier,

                        code:
                            currentShipment.courierCode,
                    };

                } else {

                    courier =
                        this.selectCourier();
                }


                if (!courier?.code) {

                    throw new Error(
                        "Courier could not be assigned."
                    );
                }


                // Generate tracking ID only once

                let trackingId =
                    currentShipment.trackingId;


                if (!trackingId) {

                    trackingId =
                        this.generateTrackingId(
                            courier.code
                        );
                }


                updateData.courier =
                    String(
                        courier.name
                    );


                updateData.courierCode =
                    String(
                        courier.code
                    );


                updateData.trackingId =
                    String(
                        trackingId
                    );


                updateData.shippedAt =
                    eventData.shippedAt ||
                    new Date().toISOString();


                console.log(
                    "Shipment dispatched:",
                    {
                        courier,
                        trackingId,
                    }
                );
            }


  // OUT FOR DELIVERY

            if (
                normalizedStatus ===
                "OUT_FOR_DELIVERY"
            ) {

                updateData.outForDeliveryAt =
                    eventData.outForDeliveryAt ||
                    new Date().toISOString();


                updateData.otpRequired =
                    true;


                updateData.otpVerified =
                    false;
            }


  // DELIVERED

            if (
                normalizedStatus ===
                "DELIVERED"
            ) {

                updateData.deliveredAt =
                    eventData.deliveredAt ||
                    new Date().toISOString();


                updateData.otpRequired =
                    false;
            }


  // CANCELLED

            if (
                normalizedStatus ===
                "CANCELLED"
            ) {

                updateData.otpRequired =
                    false;
            }


  // UPDATE SHIPMENT IN APPWRITE

            const updatedShipment =
                await shipmentService.updateShipment(
                    shipmentId,
                    updateData
                );


            if (!updatedShipment?.$id) {

                throw new Error(
                    "Shipment update failed."
                );
            }


  // AUTOMATIC ADMIN NOTIFICATION
            //
            // Notification only when actual status changes.
            //
            // This prevents duplicate notifications when
            // the same status is selected again.
            //
            // =================================================

            if (
                previousStatus !==
                normalizedStatus
            ) {

                try {

                    const adminNotification =
                        this.getAdminNotificationData(
                            normalizedStatus,
                            updatedShipment,
                            eventData
                        );


                    if (adminNotification) {

                        await this.createAdminNotification(
                            adminNotification
                        );
                    }

                } catch (
                    adminNotificationError
                ) {

                    console.error(
                        "Admin status notification failed:",
                        adminNotificationError
                    );
                }
            }


  // AUTOMATIC DELIVERY OTP + CUSTOMER NOTIFICATION
            //
            // OTP automatically generate hoga jab shipment
            // OUT_FOR_DELIVERY me jayega.
            //
            // Admin ko manually Generate OTP karne ki
            // zarurat nahi hai.
            //
            // Duplicate OTP/notification prevent kiya gaya hai.
            //
            // =================================================

            if (
                normalizedStatus ===
                "OUT_FOR_DELIVERY"
            ) {

                try {
                    const resolvedUserId = String(
                        eventData.userId ||
                        updatedShipment.userId ||
                        currentShipment.userId ||
                        ""
                    );

                    const otpResult =
                        await deliveryOtpService.generateOtp({

                            shipmentId:
                                String(
                                    updatedShipment.$id
                                ),

                            orderId:
                                String(
                                    eventData.orderId ||
                                    updatedShipment.orderId ||
                                    ""
                                ),

                            userId:
                                resolvedUserId,

                            trackingId:
                                String(
                                    updatedShipment.trackingId ||
                                    ""
                                ),
                        });

                    if (!otpResult?.success) {
                        console.error(
                            "Delivery OTP generation failed:",
                            otpResult?.error
                        );
                    } else {
                        console.log(
                            "Delivery OTP and customer notification ensured:",
                            otpResult.otp
                        );
                    }

                } catch (
                    otpNotificationError
                ) {

                    console.error(
                        "OTP / Notification creation error:",
                        otpNotificationError
                    );
                }
            }

            // AUTOMATIC CUSTOMER ORDER DELIVERED NOTIFICATION & ORDER STATUS SYNC
            if (
                normalizedStatus ===
                    "DELIVERED" &&
                previousStatus !==
                    "DELIVERED"
            ) {
                await deliveryOtpService.markShipmentDeliveredSync(
                    String(updatedShipment.$id || shipmentId || ""),
                    String(updatedShipment.orderId || "")
                );

                const resolvedContext =
                    await deliveryOtpService.resolveShipmentContext(
                        String(updatedShipment.$id || shipmentId || ""),
                        {
                            orderId: String(
                                eventData.orderId ||
                                    updatedShipment.orderId ||
                                    ""
                            ),
                            userId: String(
                                eventData.userId ||
                                    updatedShipment.userId ||
                                    currentShipment.userId ||
                                    ""
                            ),
                            trackingId: String(
                                updatedShipment.trackingId || ""
                            ),
                        }
                    );

                if (resolvedContext.userId) {
                    await deliveryOtpService.ensureOrderDeliveredNotification({
                        userId: resolvedContext.userId,
                        orderId: resolvedContext.orderId,
                        shipmentId: String(
                            updatedShipment.$id || shipmentId || ""
                        ),
                        trackingId: resolvedContext.trackingId,
                    });
                }
            }


  // EVENT TRACKING ID

            let eventTrackingId = "";


            if (
                normalizedStatus ===
                "DISPATCHED"
            ) {

                eventTrackingId =
                    String(
                        updatedShipment.trackingId ||
                        ""
                    );

            } else if (
                updatedShipment.trackingId
            ) {

                eventTrackingId =
                    String(
                        updatedShipment.trackingId
                    );
            }


  // CREATE SHIPMENT EVENT

            await shipmentEventService.createEvent({

                shipmentId:
                    String(
                        shipmentId
                    ),

                orderId:
                    String(
                        eventData.orderId ||
                        updatedShipment.orderId ||
                        ""
                    ),

                trackingId:
                    eventTrackingId,

                status:
                    normalizedStatus,

                title:
                    eventData.title ||
                    this.getStatusTitle(
                        normalizedStatus
                    ),

                description:
                    eventData.description ||
                    this.getStatusDescription(
                        normalizedStatus
                    ),

                city:
                    String(
                        eventData.city ||
                        (["PLACED", "PACKED", "DISPATCHED"].includes(normalizedStatus)
                            ? updatedShipment.originCity || "New Delhi"
                            : normalizedStatus === "IN_TRANSIT"
                            ? (String(updatedShipment.originCity || "").toLowerCase().includes("nagpur")
                                ? "Indore"
                                : "Nagpur")
                            : updatedShipment.destinationCity || "")
                    ),

                state:
                    String(
                        eventData.state ||
                        (["PLACED", "PACKED", "DISPATCHED"].includes(normalizedStatus)
                            ? updatedShipment.originState || "Delhi"
                            : normalizedStatus === "IN_TRANSIT"
                            ? (String(updatedShipment.originCity || "").toLowerCase().includes("nagpur")
                                ? "Madhya Pradesh"
                                : "Maharashtra")
                            : updatedShipment.destinationState || "")
                    ),

                hubName:
                    String(
                        eventData.hubName ||
                        (normalizedStatus === "PACKED"
                            ? `${updatedShipment.originCity || "Origin"} Packaging & Manifest Facility`
                            : normalizedStatus === "DISPATCHED"
                            ? `${updatedShipment.originCity || "Origin"} Express Dispatch Terminal`
                            : normalizedStatus === "IN_TRANSIT"
                            ? "Central National Linehaul Exchange Hub"
                            : normalizedStatus === "REACHED_HUB"
                            ? `${updatedShipment.destinationCity || "Destination"} Regional Sorting Hub`
                            : normalizedStatus === "OUT_FOR_DELIVERY"
                            ? `${updatedShipment.destinationCity || "Destination"} Last-Mile Delivery Center`
                            : "")
                    ),

                timestamp:
                    eventData.timestamp ||
                    new Date().toISOString(),
            });


  // SUCCESS

            return {

                success:
                    true,

                shipment:
                    updatedShipment,
            };

        } catch (error) {

            console.error(
                "Update shipment status error:",
                error
            );


            return {

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to update shipment status.",
            };
        }
    }


  // ADMIN NOTIFICATION DATA

    getAdminNotificationData(
        status,
        shipment,
        eventData = {}
    ) {

        const orderId =
            String(
                shipment?.orderId ||
                ""
            );


        const shipmentId =
            String(
                shipment?.$id ||
                ""
            );


        const trackingId =
            String(
                shipment?.trackingId ||
                ""
            );


        const city =
            String(
                eventData.city ||
                shipment?.destinationCity ||
                ""
            );


        const statusData = {

            PLACED: {

                type:
                    "NEW_ORDER",

                title:
                    "New Order Received 🛒",

                message:
                    `Order ${orderId} has been placed successfully.`,
            },


            PACKED: {

                type:
                    "ORDER_PACKED",

                title:
                    "Order Packed 📦",

                message:
                    `Order ${orderId} has been packed and is ready for dispatch.`,
            },


            DISPATCHED: {

                type:
                    "SHIPMENT_DISPATCHED",

                title:
                    "Shipment Dispatched 🚚",

                message:
                    trackingId
                        ? `Order ${orderId} has been dispatched. Tracking ID: ${trackingId}.`
                        : `Order ${orderId} has been dispatched.`,
            },


            IN_TRANSIT: {

                type:
                    "SHIPMENT_IN_TRANSIT",

                title:
                    "Shipment In Transit 🚛",

                message:
                    city
                        ? `Order ${orderId} is currently in transit towards ${city}.`
                        : `Order ${orderId} is currently in transit.`,
            },


            REACHED_HUB: {

                type:
                    "REACHED_HUB",

                title:
                    "Shipment Reached Hub 🏢",

                message:
                    city
                        ? `Order ${orderId} has reached the delivery hub in ${city}.`
                        : `Order ${orderId} has reached a delivery hub.`,
            },


            OUT_FOR_DELIVERY: {

                type:
                    "OUT_FOR_DELIVERY",

                title:
                    "Out for Delivery 🔔",

                message:
                    `Order ${orderId} is out for delivery. Delivery OTP has been generated.`,
            },


            DELIVERED: {

                type:
                    "ORDER_DELIVERED",

                title:
                    "Order Delivered ✅",

                message:
                    `Order ${orderId} has been delivered successfully.`,
            },


            CANCELLED: {

                type:
                    "ORDER_CANCELLED",

                title:
                    "Order Cancelled ❌",

                message:
                    `Order ${orderId} has been cancelled.`,
            },


            EXCEPTION: {

                type:
                    "DELIVERY_EXCEPTION",

                title:
                    "Delivery Exception 🚨",

                message:
                    eventData.description
                        ? `Order ${orderId}: ${eventData.description}`
                        : `There is a delivery exception for order ${orderId}.`,
            },
        };


        const selected =
            statusData[status];


        if (!selected) {

            return {

                type:
                    "SHIPMENT_UPDATED",

                title:
                    "Shipment Updated 🔔",

                message:
                    `Order ${orderId} status changed to ${status}.`,

                orderId,

                shipmentId,

                trackingId,
            };
        }


        return {

            ...selected,

            orderId,

            shipmentId,

            trackingId,
        };
    }


  // STATUS TITLE

    getStatusTitle(status) {

        const titles = {

            PLACED:
                "Order Placed",

            PACKED:
                "Order Packed",

            DISPATCHED:
                "Shipment Dispatched",

            IN_TRANSIT:
                "In Transit",

            REACHED_HUB:
                "Reached Delivery Hub",

            OUT_FOR_DELIVERY:
                "Out for Delivery",

            DELIVERED:
                "Delivered",

            CANCELLED:
                "Order Cancelled",

            EXCEPTION:
                "Delivery Exception",
        };


        return (
            titles[status] ||
            "Shipment Updated"
        );
    }


  // STATUS DESCRIPTION

    getStatusDescription(status) {

        const descriptions = {

            PLACED:
                "Your order has been placed successfully.",

            PACKED:
                "Your order has been packed and is ready for dispatch.",

            DISPATCHED:
                "Your shipment has been dispatched from the warehouse.",

            IN_TRANSIT:
                "Your shipment is currently in transit.",

            REACHED_HUB:
                "Your shipment has reached a delivery hub.",

            OUT_FOR_DELIVERY:
                "Your shipment is out for delivery.",

            DELIVERED:
                "Your shipment has been delivered successfully.",

            CANCELLED:
                "Your shipment has been cancelled.",

            EXCEPTION:
                "There is an issue affecting your shipment.",
        };


        return (
            descriptions[status] ||
            "Your shipment status has been updated."
        );
    }
}


  // EXPORT

export default new ShipmentHelper();