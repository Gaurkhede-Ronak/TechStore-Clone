import { Databases, ID, Query } from "appwrite";
import client from "./config";
import notificationService from "./notificationService";
import shipmentEventService from "./shipmentEventService";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const SHIPMENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID;

const DELIVERY_OTPS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_DELIVERY_OTPS_COLLECTION_ID;

const ORDERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;

const NOTIFICATIONS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_NOTIFICATIONS_COLLECTION_ID;

class DeliveryOtpService {
  // GENERATE RANDOM 6-DIGIT OTP
  generateOtpCode() {
    return String(
      Math.floor(100000 + Math.random() * 900000)
    );
  }

  // HELPER: RESOLVE MISSING ORDER / USER / TRACKING INFO
  async resolveShipmentContext(shipmentId, data = {}) {
    let orderId = String(data.orderId || "").trim();
    let userId = String(data.userId || "").trim();
    let trackingId = String(data.trackingId || "").trim();
    let shipmentDoc = null;

    if (shipmentId && SHIPMENTS_COLLECTION_ID) {
      try {
        shipmentDoc = await databases.getDocument(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          String(shipmentId)
        );
        if (shipmentDoc) {
          orderId = orderId || String(shipmentDoc.orderId || "").trim();
          userId = userId || String(shipmentDoc.userId || "").trim();
          trackingId = trackingId || String(shipmentDoc.trackingId || "").trim();
        }
      } catch {
        // ignore
      }
    }

    if ((!userId || !orderId) && orderId && ORDERS_COLLECTION_ID) {
      try {
        const orderLookup = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("orderId", orderId), Query.limit(1)]
        );
        let orderDoc = orderLookup?.documents?.[0] || null;
        if (!orderDoc) {
          try {
            orderDoc = await databases.getDocument(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              orderId
            );
          } catch {
            orderDoc = null;
          }
        }
        if (orderDoc) {
          userId = userId || String(orderDoc.userId || "").trim();
          orderId = String(orderDoc.orderId || orderDoc.$id || orderId).trim();
        }
      } catch {
        // ignore
      }
    }

    return {
      orderId,
      userId,
      trackingId,
      shipmentDoc,
    };
  }

  // ENSURE CUSTOMER HAS DELIVERY_OTP NOTIFICATION IN APPWRITE
  async ensureDeliveryOtpNotification({
    userId,
    orderId,
    shipmentId,
    trackingId,
    otpCode,
  }) {
    const cleanUserId = String(userId || "").trim();
    const cleanShipmentId = String(shipmentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanTrackingId = String(trackingId || "").trim();
    const cleanOtp = String(otpCode || "").trim();

    if (!cleanUserId || !cleanOtp || !NOTIFICATIONS_COLLECTION_ID) {
      return null;
    }

    try {
      const existingRes = await databases.listDocuments(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        [
          Query.equal("userId", cleanUserId),
          Query.equal("type", "DELIVERY_OTP"),
          Query.orderDesc("$createdAt"),
          Query.limit(25),
        ]
      );

      const existingNotif = (existingRes?.documents || []).find(
        (n) =>
          (cleanShipmentId && String(n.shipmentId || "") === cleanShipmentId) ||
          (cleanOrderId && String(n.orderId || "") === cleanOrderId)
      );

      const expectedMessage =
        `Your delivery OTP for Order ${cleanOrderId || ""} is ${cleanOtp}. ` +
        `Please share this 6-digit OTP with our delivery executive at the time of delivery.`;

      if (existingNotif) {
        if (!String(existingNotif.message || "").includes(cleanOtp)) {
          try {
            return await databases.updateDocument(
              DATABASE_ID,
              NOTIFICATIONS_COLLECTION_ID,
              existingNotif.$id,
              {
                title: "Out for Delivery — Your OTP 🔐",
                message: expectedMessage,
                isRead: false,
              }
            );
          } catch {
            return existingNotif;
          }
        }
        return existingNotif;
      }

      return await notificationService.createNotification({
        userId: cleanUserId,
        type: "DELIVERY_OTP",
        title: "Out for Delivery — Your OTP 🔐",
        message: expectedMessage,
        orderId: cleanOrderId,
        shipmentId: cleanShipmentId,
        trackingId: cleanTrackingId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("ensureDeliveryOtpNotification warning:", err);
      return null;
    }
  }

  // ENSURE CUSTOMER HAS ORDER_DELIVERED NOTIFICATION IN APPWRITE
  async ensureOrderDeliveredNotification({
    userId,
    orderId,
    shipmentId,
    trackingId,
  }) {
    const cleanUserId = String(userId || "").trim();
    const cleanShipmentId = String(shipmentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanTrackingId = String(trackingId || "").trim();

    if (!cleanUserId || !NOTIFICATIONS_COLLECTION_ID) {
      return null;
    }

    try {
      const existingRes = await databases.listDocuments(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        [
          Query.equal("userId", cleanUserId),
          Query.equal("type", "ORDER_DELIVERED"),
          Query.orderDesc("$createdAt"),
          Query.limit(25),
        ]
      );

      const existingNotif = (existingRes?.documents || []).find(
        (n) =>
          (cleanShipmentId && String(n.shipmentId || "") === cleanShipmentId) ||
          (cleanOrderId && String(n.orderId || "") === cleanOrderId)
      );

      if (existingNotif) {
        return existingNotif;
      }

      return await notificationService.createNotification({
        userId: cleanUserId,
        type: "ORDER_DELIVERED",
        title: "Order Delivered Successfully ✅",
        message: `Your order ${cleanOrderId || ""} ${
          cleanTrackingId ? `(Tracking ID: ${cleanTrackingId}) ` : ""
        }has been delivered successfully after OTP verification! Thank you for shopping with TechStore.`,
        orderId: cleanOrderId,
        shipmentId: cleanShipmentId,
        trackingId: cleanTrackingId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("ensureOrderDeliveredNotification warning:", err);
      return null;
    }
  }

  // GENERATE & SAVE OTP FOR OUT_FOR_DELIVERY SHIPMENT
  // NOTE: OTP never expires until the parcel is actually delivered!
  async generateOtp(shipmentIdOrData, data = {}) {
    try {
      const isObjectArg =
        shipmentIdOrData &&
        typeof shipmentIdOrData === "object";

      const mergedData = isObjectArg
        ? { ...shipmentIdOrData, ...data }
        : { ...data };

      const rawShipmentId = isObjectArg
        ? shipmentIdOrData.shipmentId ||
          shipmentIdOrData.$id ||
          shipmentIdOrData.id ||
          ""
        : shipmentIdOrData;

      const cleanShipmentId =
        String(rawShipmentId || "").trim();

      if (!cleanShipmentId) {
        throw new Error("Shipment ID is required.");
      }

      const context = await this.resolveShipmentContext(
        cleanShipmentId,
        mergedData
      );
      const resolvedOrderId = context.orderId || cleanShipmentId;
      const resolvedUserId = context.userId || "";
      const resolvedTrackingId =
        context.trackingId || resolvedOrderId || cleanShipmentId;

      const now = new Date();
      // Keep OTP valid for 10 years so it NEVER expires before delivery
      const nonExpiringDate = new Date(
        now.getTime() + 3650 * 24 * 60 * 60 * 1000
      ).toISOString();

      let existingDocs = [];
      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          const existingOtpResponse =
            await databases.listDocuments(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              [
                Query.equal("shipmentId", cleanShipmentId),
                Query.equal("verified", false),
                Query.orderDesc("$createdAt"),
                Query.limit(10),
              ]
            );
          existingDocs = existingOtpResponse?.documents || [];
        } catch (listErr) {
          console.warn("List existing OTP warning:", listErr);
        }
      }

      if (!mergedData.forceNew && existingDocs.length > 0) {
        const activeOtp = existingDocs[0];
        const existingCode = String(
          activeOtp.otpHash || activeOtp.otpCode || activeOtp.otp || ""
        ).trim();

        if (existingCode) {
          await this.ensureDeliveryOtpNotification({
            userId: resolvedUserId || activeOtp.userId,
            orderId: resolvedOrderId || activeOtp.orderId,
            shipmentId: cleanShipmentId,
            trackingId: resolvedTrackingId || activeOtp.trackingId,
            otpCode: existingCode,
          });

          return {
            success: true,
            alreadyExists: true,
            otpDocument: {
              ...activeOtp,
              otp: existingCode,
              otpCode: existingCode,
            },
            otp: existingCode,
            otpCode: existingCode,
            expiresAt: activeOtp.expiresAt || nonExpiringDate,
          };
        }
      }

      // If forceNew was requested, mark older unverified OTPs as verified/replaced
      for (const oldOtp of existingDocs) {
        try {
          await databases.updateDocument(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            oldOtp.$id,
            {
              verified: true,
            }
          );
        } catch {
          // ignore cleanup warning
        }
      }

      const otpCode = this.generateOtpCode();
      let otpDocument = null;

      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          // Exact Appwrite delivery_otps collection schema
          const payload = {
            shipmentId: String(cleanShipmentId),
            orderId: String(resolvedOrderId),
            userId: String(resolvedUserId || "customer"),
            trackingId: String(resolvedTrackingId),
            otpHash: String(otpCode),
            expiresAt: nonExpiringDate,
            attempts: 0,
            maxAttempts: 999,
            verified: false,
            verifiedAt: null,
            createdAt: now.toISOString(),
          };

          otpDocument = await databases.createDocument(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            ID.unique(),
            payload
          );
        } catch (createOtpErr) {
          console.warn(
            "delivery_otps createDocument warning (will still send notification OTP):",
            createOtpErr?.message || createOtpErr
          );
        }
      }

      // Always create/ensure the customer's DELIVERY_OTP notification
      const notifDoc = await this.ensureDeliveryOtpNotification({
        userId: resolvedUserId,
        orderId: resolvedOrderId,
        shipmentId: cleanShipmentId,
        trackingId: resolvedTrackingId,
        otpCode,
      });

      return {
        success: true,
        alreadyExists: false,
        otpDocument: otpDocument
          ? {
              ...otpDocument,
              otp: otpCode,
              otpCode,
            }
          : {
              shipmentId: cleanShipmentId,
              orderId: resolvedOrderId,
              userId: resolvedUserId,
              trackingId: resolvedTrackingId,
              otp: otpCode,
              otpCode,
              otpHash: otpCode,
            },
        notification: notifDoc,
        otp: otpCode,
        otpCode,
        expiresAt: nonExpiringDate,
      };
    } catch (error) {
      console.error("Generate delivery OTP error:", error);
      return {
        success: false,
        error:
          error.message ||
          "Failed to generate delivery OTP.",
      };
    }
  }

  // GET ACTIVE OTP BY SHIPMENT ID
  async getActiveOtpByShipmentId(shipmentId) {
    try {
      const cleanShipmentId =
        String(shipmentId || "").trim();

      if (!cleanShipmentId) {
        return null;
      }

      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          const response =
            await databases.listDocuments(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              [
                Query.equal("shipmentId", cleanShipmentId),
                Query.equal("verified", false),
                Query.orderDesc("$createdAt"),
                Query.limit(1),
              ]
            );

          const doc = response?.documents?.[0] || null;
          if (doc) {
            const code = String(
              doc.otpHash || doc.otpCode || doc.otp || ""
            ).trim();
            if (code) {
              return {
                ...doc,
                otp: code,
                otpCode: code,
                otpHash: code,
              };
            }
          }
        } catch (err) {
          console.warn("getActiveOtpByShipmentId db lookup warning:", err);
        }
      }

      // Fallback: check DELIVERY_OTP notification for this shipment
      if (NOTIFICATIONS_COLLECTION_ID) {
        try {
          const notifRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_COLLECTION_ID,
            [
              Query.equal("type", "DELIVERY_OTP"),
              Query.orderDesc("$createdAt"),
              Query.limit(30),
            ]
          );
          const matched = (notifRes?.documents || []).find(
            (n) => String(n?.shipmentId || "") === cleanShipmentId
          );
          if (matched) {
            const m = String(matched.message || "").match(/\b(\d{6})\b/);
            if (m) {
              return {
                $id: "",
                shipmentId: cleanShipmentId,
                orderId: matched.orderId || "",
                userId: matched.userId || "",
                otp: m[1],
                otpCode: m[1],
                otpHash: m[1],
              };
            }
          }
        } catch {
          // ignore
        }
      }

      return null;
    } catch (error) {
      console.error("Get active delivery OTP error:", error);
      return null;
    }
  }

  // MARK OTP VERIFIED & SYNC ORDER STATUS WHEN SHIPMENT IS DELIVERED
  async markShipmentDeliveredSync(shipmentId, orderId = "") {
    try {
      const cleanShipmentId = String(shipmentId || "").trim();
      if (cleanShipmentId && DELIVERY_OTPS_COLLECTION_ID) {
        const activeOtp = await this.getActiveOtpByShipmentId(cleanShipmentId);
        if (activeOtp?.$id) {
          try {
            await databases.updateDocument(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              activeOtp.$id,
              {
                verified: true,
                verifiedAt: new Date().toISOString(),
              }
            );
          } catch {
            // ignore
          }
        }
      }

      const cleanOrderId = String(orderId || "").trim();
      if (cleanOrderId && ORDERS_COLLECTION_ID) {
        const orderLookup = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [
            Query.equal("orderId", cleanOrderId),
            Query.limit(1),
          ]
        );
        const orderDoc = orderLookup?.documents?.[0] || null;
        if (orderDoc?.$id) {
          await databases.updateDocument(
            DATABASE_ID,
            ORDERS_COLLECTION_ID,
            orderDoc.$id,
            { status: "Delivered" }
          );
        }
      }
    } catch (syncError) {
      console.warn("markShipmentDeliveredSync warning:", syncError);
    }
  }

  // VERIFY OTP & MARK SHIPMENT + ORDER AS DELIVERED + NOTIFY USER
  async verifyOtp(shipmentId, otpInput) {
    try {
      const cleanShipmentId =
        String(shipmentId || "").trim();

      const enteredOtp = String(otpInput || "")
        .replace(/\D/g, "")
        .trim();

      if (!cleanShipmentId) {
        return {
          success: false,
          message: "Shipment ID is required.",
        };
      }

      if (enteredOtp.length !== 6) {
        return {
          success: false,
          message: "Please enter a valid 6-digit OTP.",
        };
      }

      const shipment =
        await databases.getDocument(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          cleanShipmentId
        );

      if (!shipment) {
        return {
          success: false,
          message: "Shipment not found.",
        };
      }

      const currentStatus = String(
        shipment.status || ""
      ).toUpperCase();

      if (currentStatus === "DELIVERED") {
        return {
          success: false,
          message: "This order has already been delivered.",
        };
      }

      if (currentStatus !== "OUT_FOR_DELIVERY") {
        return {
          success: false,
          message:
            "OTP verification is only available when the order is Out for Delivery.",
        };
      }

      const otpDocument =
        await this.getActiveOtpByShipmentId(cleanShipmentId);

      // Also check customer's DELIVERY_OTP notification in case OTP is read from Notifications page
      let notificationOtp = "";
      let matchedNotifUserId = "";
      if (NOTIFICATIONS_COLLECTION_ID) {
        try {
          const notifRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_COLLECTION_ID,
            [
              Query.equal("type", "DELIVERY_OTP"),
              Query.orderDesc("$createdAt"),
              Query.limit(30),
            ]
          );
          const matchedNotif = (notifRes?.documents || []).find(
            (n) =>
              (n?.shipmentId && String(n.shipmentId) === cleanShipmentId) ||
              (shipment.orderId &&
                n?.orderId &&
                String(n.orderId) === String(shipment.orderId))
          );
          if (matchedNotif) {
            matchedNotifUserId = String(matchedNotif.userId || "").trim();
            const directOtp = String(matchedNotif.otp || "")
              .replace(/\D/g, "")
              .trim();
            if (directOtp.length === 6) {
              notificationOtp = directOtp;
            } else {
              const msgMatch = String(matchedNotif.message || "").match(
                /\b(\d{6})\b/
              );
              if (msgMatch) {
                notificationOtp = msgMatch[1];
              }
            }
          }
        } catch (notifLookupErr) {
          console.warn("Notification OTP lookup warning:", notifLookupErr);
        }
      }

      if (!otpDocument && !notificationOtp) {
        return {
          success: false,
          message: "No active OTP found for this shipment.",
        };
      }

      const storedOtp = String(
        otpDocument?.otpHash || otpDocument?.otpCode || otpDocument?.otp || ""
      ).trim();

      const isOtpMatch =
        (storedOtp && enteredOtp === storedOtp) ||
        (notificationOtp && enteredOtp === notificationOtp);

      if (!isOtpMatch) {
        if (otpDocument?.$id) {
          const updatedAttempts = Number(otpDocument.attempts || 0) + 1;
          try {
            await databases.updateDocument(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              otpDocument.$id,
              {
                attempts: updatedAttempts,
              }
            );
          } catch (attemptErr) {
            console.warn("OTP attempt update warning:", attemptErr);
          }
        }

        return {
          success: false,
          message:
            "Invalid OTP. Please check the 6-digit Delivery OTP in customer notifications and try again.",
        };
      }

      // OTP MATCHED
      const verifiedAt = new Date().toISOString();

      if (otpDocument?.$id) {
        try {
          await databases.updateDocument(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            otpDocument.$id,
            {
              verified: true,
              verifiedAt,
            }
          );
        } catch (markOtpErr) {
          console.warn("Mark OTP verified warning:", markOtpErr);
        }
      }

      // Update Shipment using exact Appwrite shipments schema fields
      const updatedShipment = await databases.updateDocument(
        DATABASE_ID,
        SHIPMENTS_COLLECTION_ID,
        cleanShipmentId,
        {
          status: "DELIVERED",
          otpRequired: false,
          otpVerified: true,
          deliveredAt: verifiedAt,
        }
      );

      // Create Shipment Event using exact Appwrite shipment_events schema fields
      try {
        await shipmentEventService.createEvent({
          shipmentId: cleanShipmentId,
          orderId: String(shipment.orderId || otpDocument?.orderId || ""),
          trackingId: String(
            shipment.trackingId || otpDocument?.trackingId || ""
          ),
          status: "DELIVERED",
          title: "Shipment Delivered",
          description:
            "Your shipment has been delivered successfully after OTP verification.",
          city: String(shipment.destinationCity || ""),
          state: String(shipment.destinationState || ""),
          hubName: "",
          timestamp: verifiedAt,
        });
      } catch (eventError) {
        console.warn("Shipment delivered event creation warning:", eventError);
      }

      // Sync Order status in ORDERS_COLLECTION_ID to "Delivered"
      let resolvedOrderUserId = "";
      if (ORDERS_COLLECTION_ID && shipment.orderId) {
        try {
          const orderLookup = await databases.listDocuments(
            DATABASE_ID,
            ORDERS_COLLECTION_ID,
            [
              Query.equal("orderId", String(shipment.orderId)),
              Query.limit(1),
            ]
          );

          let orderDoc = orderLookup?.documents?.[0] || null;
          if (!orderDoc) {
            try {
              orderDoc = await databases.getDocument(
                DATABASE_ID,
                ORDERS_COLLECTION_ID,
                String(shipment.orderId)
              );
            } catch {
              orderDoc = null;
            }
          }

          if (orderDoc?.$id) {
            resolvedOrderUserId = String(orderDoc.userId || "").trim();
            const orderUpdatePayload = {
              status: "Delivered",
            };

            if (orderDoc.items) {
              try {
                const parsedItems =
                  typeof orderDoc.items === "string"
                    ? JSON.parse(orderDoc.items)
                    : Array.isArray(orderDoc.items)
                    ? orderDoc.items
                    : [];

                if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                  const syncedItems = parsedItems.map((it) => {
                    const isCanc =
                      Boolean(it?.isCancelled) ||
                      ["CANCELLED", "CANCELED"].includes(
                        String(it?.status || "").trim().toUpperCase()
                      );
                    if (isCanc) {
                      return {
                        ...it,
                        isCancelled: true,
                        status: "Cancelled",
                      };
                    }
                    return {
                      ...it,
                      status: "Delivered",
                    };
                  });
                  orderUpdatePayload.items = JSON.stringify(syncedItems);
                }
              } catch (itemParseErr) {
                console.warn("Order items delivery sync warning:", itemParseErr);
              }
            }

            await databases.updateDocument(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              orderDoc.$id,
              orderUpdatePayload
            );
          }
        } catch (orderSyncError) {
          console.warn(
            "Order status sync warning on OTP verification:",
            orderSyncError
          );
        }
      }

      // Send Customer Notification: ORDER_DELIVERED
      const customerUserId = String(
        shipment.userId ||
          otpDocument?.userId ||
          resolvedOrderUserId ||
          matchedNotifUserId ||
          ""
      ).trim();

      if (customerUserId) {
        await this.ensureOrderDeliveredNotification({
          userId: customerUserId,
          orderId: String(shipment.orderId || ""),
          shipmentId: cleanShipmentId,
          trackingId: String(shipment.trackingId || ""),
        });
      }

      return {
        success: true,
        message: "OTP verified! Order marked as Delivered.",
        shipment: updatedShipment,
      };
    } catch (error) {
      console.error("Verify delivery OTP error:", error);
      return {
        success: false,
        message: error.message || "Failed to verify OTP.",
      };
    }
  }

  // AUTO-SYNC MISSING DELIVERY_OTP & ORDER_DELIVERED NOTIFICATIONS FOR USER
  async syncUserShipmentNotifications(userId) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId || !SHIPMENTS_COLLECTION_ID) return;

    try {
      const shipRes = await databases.listDocuments(
        DATABASE_ID,
        SHIPMENTS_COLLECTION_ID,
        [
          Query.equal("userId", cleanUserId),
          Query.orderDesc("$createdAt"),
          Query.limit(20),
        ]
      );

      const userShipments = shipRes?.documents || [];
      for (const ship of userShipments) {
        const st = String(ship?.status || "").trim().toUpperCase();
        if (st === "OUT_FOR_DELIVERY") {
          await this.generateOtp({
            shipmentId: String(ship.$id),
            orderId: String(ship.orderId || ""),
            userId: cleanUserId,
            trackingId: String(ship.trackingId || ""),
          });
        } else if (st === "DELIVERED") {
          await this.ensureOrderDeliveredNotification({
            userId: cleanUserId,
            orderId: String(ship.orderId || ""),
            shipmentId: String(ship.$id),
            trackingId: String(ship.trackingId || ""),
          });
        }
      }
    } catch (syncErr) {
      console.warn("syncUserShipmentNotifications warning:", syncErr);
    }
  }
}

const deliveryOtpService = new DeliveryOtpService();

export default deliveryOtpService;
