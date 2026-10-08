import { Databases, ID, Query } from "appwrite";
import client from "./config";
import notificationService from "./notificationService";
import shipmentEventService from "./shipmentEventService";
import walletService from "./walletService";

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

const ADMIN_USER_IDS = String(
  import.meta.env.VITE_APPWRITE_ADMIN_USER_IDS || ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// 2 days (48 hours) in milliseconds for Out for Delivery auto-cancellation
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

class DeliveryOtpService {
  // GENERATE RANDOM 6-DIGIT OTP
  generateOtpCode() {
    return String(
      Math.floor(100000 + Math.random() * 900000)
    );
  }

  // RESOLVE SHIPMENT + ORDER CONTEXT SO userId / orderId / trackingId ARE NEVER EMPTY
  async resolveShipmentContext(shipmentId, initialData = {}) {
    const cleanShipmentId = String(shipmentId || "").trim();
    let userId = String(initialData.userId || "").trim();
    let orderId = String(initialData.orderId || "").trim();
    let trackingId = String(initialData.trackingId || "").trim();
    let shipmentDoc = initialData.shipmentDoc || null;
    let orderDoc = initialData.orderDoc || null;

    if (cleanShipmentId && SHIPMENTS_COLLECTION_ID && !shipmentDoc) {
      try {
        shipmentDoc = await databases.getDocument(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          cleanShipmentId
        );
      } catch (err) {
        console.warn("resolveShipmentContext shipment lookup warning:", err);
      }
    }

    if (shipmentDoc) {
      if (!userId && shipmentDoc.userId) {
        userId = String(shipmentDoc.userId).trim();
      }
      if (!orderId && shipmentDoc.orderId) {
        orderId = String(shipmentDoc.orderId).trim();
      }
      if (!trackingId && shipmentDoc.trackingId) {
        trackingId = String(shipmentDoc.trackingId).trim();
      }
    }

    if (orderId && ORDERS_COLLECTION_ID && (!userId || !orderDoc)) {
      try {
        const orderList = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("orderId", orderId), Query.limit(1)]
        );
        orderDoc = orderList?.documents?.[0] || null;
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
        if (orderDoc?.userId && !userId) {
          userId = String(orderDoc.userId).trim();
        }
      } catch (err) {
        console.warn("resolveShipmentContext order lookup warning:", err);
      }
    }

    return {
      shipmentId: cleanShipmentId,
      userId,
      orderId: orderId || cleanShipmentId,
      trackingId:
        trackingId ||
        `TRK-${(orderId || cleanShipmentId).slice(0, 10).toUpperCase()}`,
      shipmentDoc,
      orderDoc,
    };
  }

  // DETERMINE WHEN SHIPMENT ENTERED OUT_FOR_DELIVERY
  getOutForDeliveryTimestampMs(shipmentDoc, otpDoc = null, notifDoc = null) {
    const candidates = [
      shipmentDoc?.outForDeliveryAt,
      otpDoc?.createdAt,
      otpDoc?.$createdAt,
      notifDoc?.createdAt,
      notifDoc?.$createdAt,
      shipmentDoc?.$updatedAt,
      shipmentDoc?.updatedAt,
      shipmentDoc?.$createdAt,
    ];

    for (const raw of candidates) {
      if (!raw) continue;
      const parsed = new Date(raw).getTime();
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return Date.now();
  }

  // CHECK IF OUT_FOR_DELIVERY HAS EXCEEDED 2 DAYS (48 HOURS) WITHOUT DELIVERY
  isOutForDeliveryExpired(shipmentDoc, otpDoc = null, notifDoc = null) {
    if (!shipmentDoc) return false;
    const status = String(shipmentDoc.status || "")
      .trim()
      .toUpperCase();
    if (status !== "OUT_FOR_DELIVERY") return false;

    const startMs = this.getOutForDeliveryTimestampMs(
      shipmentDoc,
      otpDoc,
      notifDoc
    );
    const elapsedMs = Date.now() - startMs;
    return elapsedMs >= TWO_DAYS_MS;
  }

  // ENSURE CUSTOMER RECEIVES ORDER_CANCELLED NOTIFICATION WHEN AUTO-CANCELLED AFTER 2 DAYS
  async ensureOrderAutoCancelledNotification({
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
          Query.orderDesc("createdAt"),
          Query.limit(50),
        ]
      );

      const docs = existingRes?.documents || [];
      const existingCancelledNotif = docs.find((doc) => {
        const type = String(doc?.type || "").toUpperCase();
        if (!type.includes("CANCEL")) return false;
        const sameShipment =
          cleanShipmentId &&
          String(doc?.shipmentId || "") === cleanShipmentId;
        const sameOrder =
          cleanOrderId && String(doc?.orderId || "") === cleanOrderId;
        return sameShipment || sameOrder;
      });

      if (existingCancelledNotif) {
        return existingCancelledNotif;
      }

      const orderLabel = cleanOrderId ? `Order ${cleanOrderId}` : "Your order";
      const trackingLabel =
        cleanTrackingId && !cleanTrackingId.startsWith("TRK-")
          ? ` (Tracking ID: ${cleanTrackingId})`
          : "";

      const createdNotif = await notificationService.createNotification({
        userId: cleanUserId,
        type: "ORDER_CANCELLED",
        title: "Order Auto-Cancelled ❌",
        message: `${orderLabel}${trackingLabel} has been automatically cancelled because it was not delivered within 2 days of going Out for Delivery.`,
        orderId: cleanOrderId,
        shipmentId: cleanShipmentId,
        trackingId: cleanTrackingId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      // Notify Admin as well
      if (ADMIN_USER_IDS.length > 0) {
        await Promise.allSettled(
          ADMIN_USER_IDS.map((adminId) =>
            notificationService.createNotification({
              userId: String(adminId),
              type: "ORDER_CANCELLED",
              title: "Order Auto-Cancelled (2-Day Timeout) ❌",
              message: `${orderLabel}${trackingLabel} was automatically cancelled because it remained Out for Delivery for more than 2 days without delivery.`,
              orderId: cleanOrderId,
              shipmentId: cleanShipmentId,
              trackingId: cleanTrackingId,
              isRead: false,
              createdAt: new Date().toISOString(),
            })
          )
        );
      }

      return createdNotif;
    } catch (err) {
      console.error("ensureOrderAutoCancelledNotification error:", err);
      return null;
    }
  }

  // AUTO-CANCEL SHIPMENT + ORDER IF OUT FOR DELIVERY FOR > 2 DAYS WITHOUT DELIVERY
  async autoCancelExpiredOutForDeliveryShipment(
    shipmentDocOrId,
    initialData = {}
  ) {
    try {
      const rawId =
        typeof shipmentDocOrId === "object"
          ? shipmentDocOrId?.$id || shipmentDocOrId?.shipmentId || ""
          : shipmentDocOrId;

      const resolved = await this.resolveShipmentContext(rawId, {
        ...initialData,
        shipmentDoc:
          typeof shipmentDocOrId === "object" ? shipmentDocOrId : null,
      });

      const {
        shipmentId,
        userId,
        orderId,
        trackingId,
        shipmentDoc,
        orderDoc,
      } = resolved;

      if (!shipmentId) {
        return { cancelled: false };
      }

      const cancelledAt = new Date().toISOString();

      // 1. Update Shipment status to CANCELLED
      let updatedShipment = shipmentDoc;
      if (SHIPMENTS_COLLECTION_ID) {
        try {
          updatedShipment = await databases.updateDocument(
            DATABASE_ID,
            SHIPMENTS_COLLECTION_ID,
            shipmentId,
            {
              status: "CANCELLED",
              otpRequired: false,
            }
          );
        } catch (shipErr) {
          console.warn("Auto-cancel shipment update warning:", shipErr);
        }
      }

      // 2. Invalidate any active OTPs for this shipment
      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          const otpRes = await databases.listDocuments(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            [
              Query.equal("shipmentId", shipmentId),
              Query.equal("verified", false),
              Query.limit(10),
            ]
          );
          for (const doc of otpRes?.documents || []) {
            try {
              await databases.updateDocument(
                DATABASE_ID,
                DELIVERY_OTPS_COLLECTION_ID,
                doc.$id,
                { verified: true }
              );
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. Log CANCELLED event in shipment_events
      try {
        await shipmentEventService.createEvent({
          shipmentId,
          orderId: String(orderId || ""),
          trackingId: String(
            trackingId && !trackingId.startsWith("TRK-") ? trackingId : ""
          ),
          status: "CANCELLED",
          title: "Order Auto-Cancelled (Delivery Timeout)",
          description:
            "Order was automatically cancelled because it was not delivered within 2 days of being Out for Delivery.",
          city: String(shipmentDoc?.destinationCity || ""),
          state: String(shipmentDoc?.destinationState || ""),
          hubName: "",
          timestamp: cancelledAt,
        });
      } catch (eventErr) {
        console.warn("Auto-cancel shipment event warning:", eventErr);
      }

      // 4. Update Order status in ORDERS_COLLECTION_ID to "Cancelled"
      if (ORDERS_COLLECTION_ID && orderId) {
        try {
          let targetOrder = orderDoc;
          if (!targetOrder) {
            const lookup = await databases.listDocuments(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              [Query.equal("orderId", String(orderId)), Query.limit(1)]
            );
            targetOrder = lookup?.documents?.[0] || null;
            if (!targetOrder) {
              try {
                targetOrder = await databases.getDocument(
                  DATABASE_ID,
                  ORDERS_COLLECTION_ID,
                  String(orderId)
                );
              } catch {
                targetOrder = null;
              }
            }
          }

          if (targetOrder?.$id) {
            const orderPayload = {
              status: "Cancelled",
            };

            if (targetOrder.items) {
              try {
                const parsedItems =
                  typeof targetOrder.items === "string"
                    ? JSON.parse(targetOrder.items)
                    : Array.isArray(targetOrder.items)
                    ? targetOrder.items
                    : [];
                if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                  const cancelledItems = parsedItems.map((it) => ({
                    ...it,
                    isCancelled: true,
                    status: "Cancelled",
                    cancelReason:
                      it?.cancelReason ||
                      "Auto-cancelled: Not delivered within 2 days of Out for Delivery",
                  }));
                  orderPayload.items = JSON.stringify(cancelledItems);
                }
              } catch {
                // ignore item parse errors
              }
            }

            await databases.updateDocument(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              targetOrder.$id,
              orderPayload
            );

            // Refund any wallet payment used on this auto-cancelled order
            try {
              await walletService.refundOrderWallet(
                { ...targetOrder, ...orderPayload },
                {
                  userId: userId || targetOrder.userId || "",
                  fullOrder: true,
                  shipmentId,
                  trackingId:
                    trackingId && !trackingId.startsWith("TRK-")
                      ? trackingId
                      : "",
                }
              );
            } catch (walletErr) {
              console.warn("Auto-cancel wallet refund warning:", walletErr);
            }
          }
        } catch (orderErr) {
          console.warn("Auto-cancel order update warning:", orderErr);
        }
      }

      // 5. Send Customer & Admin Notification
      if (userId) {
        await this.ensureOrderAutoCancelledNotification({
          userId,
          orderId,
          shipmentId,
          trackingId:
            trackingId && !trackingId.startsWith("TRK-") ? trackingId : "",
        });
      }

      return {
        cancelled: true,
        shipment: updatedShipment || {
          ...(shipmentDoc || {}),
          status: "CANCELLED",
        },
      };
    } catch (err) {
      console.error("autoCancelExpiredOutForDeliveryShipment error:", err);
      return { cancelled: false };
    }
  }

  // FIND EXISTING DELIVERY_OTP NOTIFICATION FOR SHIPMENT / ORDER
  async findExistingDeliveryOtpNotification(
    shipmentId,
    orderId = "",
    userId = ""
  ) {
    if (!NOTIFICATIONS_COLLECTION_ID) return null;

    const cleanShipmentId = String(shipmentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanUserId = String(userId || "").trim();

    try {
      const queries = cleanUserId
        ? [
            Query.equal("userId", cleanUserId),
            Query.orderDesc("createdAt"),
            Query.limit(50),
          ]
        : [
            Query.equal("type", "DELIVERY_OTP"),
            Query.orderDesc("createdAt"),
            Query.limit(50),
          ];

      const res = await databases.listDocuments(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        queries
      );

      const docs = res?.documents || [];
      return (
        docs.find((doc) => {
          const type = String(doc?.type || "").toUpperCase();
          if (type !== "DELIVERY_OTP") return false;
          const sameShipment =
            cleanShipmentId &&
            String(doc?.shipmentId || "") === cleanShipmentId;
          const sameOrder =
            cleanOrderId && String(doc?.orderId || "") === cleanOrderId;
          return sameShipment || sameOrder;
        }) || null
      );
    } catch (err) {
      console.warn("findExistingDeliveryOtpNotification warning:", err);
      return null;
    }
  }

  // ENSURE CUSTOMER HAS A DELIVERY_OTP NOTIFICATION IN NOTIFICATIONS COLLECTION
  async ensureDeliveryOtpNotification({
    userId,
    orderId,
    shipmentId,
    trackingId,
    otpCode,
    forceUpdate = false,
  }) {
    const cleanUserId = String(userId || "").trim();
    const cleanShipmentId = String(shipmentId || "").trim();
    const cleanOrderId = String(orderId || "").trim();
    const cleanTrackingId = String(trackingId || "").trim();
    const cleanOtp = String(otpCode || "").replace(/\D/g, "").trim();

    if (!cleanUserId || !cleanOtp || !NOTIFICATIONS_COLLECTION_ID) {
      return null;
    }

    try {
      const existingOtpNotif = await this.findExistingDeliveryOtpNotification(
        cleanShipmentId,
        cleanOrderId,
        cleanUserId
      );

      const orderLabel = cleanOrderId ? `Order ${cleanOrderId}` : "your order";
      const trackingLabel =
        cleanTrackingId && !cleanTrackingId.startsWith("TRK-")
          ? ` (Tracking ID: ${cleanTrackingId})`
          : "";

      const messageText =
        `Your 6-digit Delivery OTP for ${orderLabel}${trackingLabel} is ${cleanOtp}. ` +
        `Please share this OTP with our delivery partner at the time of delivery. ` +
        `Note: If the order is not delivered within 2 days of Out for Delivery, it will be automatically cancelled.`;

      if (existingOtpNotif) {
        const msgHasSameOtp = String(existingOtpNotif.message || "").includes(
          cleanOtp
        );
        if (forceUpdate || !msgHasSameOtp) {
          try {
            return await notificationService.updateNotification(
              existingOtpNotif.$id,
              {
                title: "Out for Delivery — Your OTP 🔐",
                message: messageText,
                isRead: false,
              }
            );
          } catch {
            return existingOtpNotif;
          }
        }
        return existingOtpNotif;
      }

      return await notificationService.createNotification({
        userId: cleanUserId,
        type: "DELIVERY_OTP",
        title: "Out for Delivery — Your OTP 🔐",
        message: messageText,
        orderId: cleanOrderId,
        shipmentId: cleanShipmentId,
        trackingId: cleanTrackingId.startsWith("TRK-") ? "" : cleanTrackingId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("ensureDeliveryOtpNotification error:", err);
      return null;
    }
  }

  // ENSURE CUSTOMER HAS AN ORDER_DELIVERED NOTIFICATION
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
          Query.orderDesc("createdAt"),
          Query.limit(50),
        ]
      );

      const docs = existingRes?.documents || [];
      const existingDeliveredNotif = docs.find((doc) => {
        const type = String(doc?.type || "").toUpperCase();
        if (!type.includes("DELIVERED")) return false;
        const sameShipment =
          cleanShipmentId &&
          String(doc?.shipmentId || "") === cleanShipmentId;
        const sameOrder =
          cleanOrderId && String(doc?.orderId || "") === cleanOrderId;
        return sameShipment || sameOrder;
      });

      if (existingDeliveredNotif) {
        return existingDeliveredNotif;
      }

      const orderLabel = cleanOrderId ? `Order ${cleanOrderId}` : "Your order";
      const trackingLabel =
        cleanTrackingId && !cleanTrackingId.startsWith("TRK-")
          ? ` (Tracking ID: ${cleanTrackingId})`
          : "";

      return await notificationService.createNotification({
        userId: cleanUserId,
        type: "ORDER_DELIVERED",
        title: "Order Delivered Successfully ✅",
        message: `${orderLabel}${trackingLabel} has been delivered successfully! Thank you for shopping with TechStore. You can now rate and review your product.`,
        orderId: cleanOrderId,
        shipmentId: cleanShipmentId,
        trackingId: cleanTrackingId.startsWith("TRK-") ? "" : cleanTrackingId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("ensureOrderDeliveredNotification error:", err);
      return null;
    }
  }

  // GENERATE & SAVE OTP FOR OUT_FOR_DELIVERY SHIPMENT + SEND USER NOTIFICATION
  async generateOtp(shipmentIdOrData, data = {}) {
    try {
      const isObjectArg =
        shipmentIdOrData && typeof shipmentIdOrData === "object";

      const mergedData = isObjectArg
        ? { ...shipmentIdOrData, ...data }
        : { ...data };

      const rawShipmentId = isObjectArg
        ? shipmentIdOrData.shipmentId ||
          shipmentIdOrData.$id ||
          shipmentIdOrData.id ||
          ""
        : shipmentIdOrData;

      const cleanShipmentId = String(rawShipmentId || "").trim();

      if (!cleanShipmentId) {
        throw new Error("Shipment ID is required.");
      }

      const resolved = await this.resolveShipmentContext(
        cleanShipmentId,
        mergedData
      );

      // Check existing OTP document in delivery_otps collection
      let existingDocs = [];
      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          const existingOtpResponse = await databases.listDocuments(
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
          console.warn("List delivery_otps warning:", listErr);
        }
      }

      // Check existing DELIVERY_OTP notification in notifications collection
      const existingNotif = await this.findExistingDeliveryOtpNotification(
        cleanShipmentId,
        resolved.orderId,
        resolved.userId
      );

      // Check 2-day auto-cancellation rule first if shipment is OUT_FOR_DELIVERY
      if (
        resolved.shipmentDoc &&
        this.isOutForDeliveryExpired(
          resolved.shipmentDoc,
          existingDocs[0] || null,
          existingNotif
        )
      ) {
        await this.autoCancelExpiredOutForDeliveryShipment(
          resolved.shipmentDoc,
          resolved
        );
        return {
          success: false,
          autoCancelled: true,
          error:
            "Order was automatically cancelled because it was not delivered within 2 days of Out for Delivery.",
        };
      }

      const now = new Date();
      // OTP stays valid for 2 days (48 hours) while Out for Delivery
      const twoDaysExpiryDate = new Date(
        now.getTime() + TWO_DAYS_MS
      ).toISOString();

      // Extract OTP if already generated in either delivery_otps or notifications
      let existingCode = "";
      if (existingDocs.length > 0) {
        const activeOtp = existingDocs[0];
        existingCode = String(
          activeOtp.otpHash || activeOtp.otpCode || activeOtp.otp || ""
        )
          .replace(/\D/g, "")
          .trim();
      }
      if (!existingCode && existingNotif) {
        const match = String(existingNotif.message || "").match(/\b(\d{6})\b/);
        if (match) {
          existingCode = match[1];
        }
      }

      if (!mergedData.forceNew && existingCode.length === 6) {
        await this.ensureDeliveryOtpNotification({
          userId: resolved.userId,
          orderId: resolved.orderId,
          shipmentId: cleanShipmentId,
          trackingId: resolved.trackingId,
          otpCode: existingCode,
          forceUpdate: false,
        });

        return {
          success: true,
          alreadyExists: true,
          otpDocument: existingDocs[0]
            ? {
                ...existingDocs[0],
                otp: existingCode,
                otpCode: existingCode,
                otpHash: existingCode,
              }
            : {
                shipmentId: cleanShipmentId,
                orderId: resolved.orderId,
                userId: resolved.userId,
                otp: existingCode,
                otpCode: existingCode,
                otpHash: existingCode,
                expiresAt: twoDaysExpiryDate,
              },
          otp: existingCode,
          otpCode: existingCode,
          expiresAt: existingDocs[0]?.expiresAt || twoDaysExpiryDate,
        };
      }

      // If forceNew was requested, mark older unverified OTPs as verified
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
        } catch (cleanupError) {
          console.warn("Old OTP cleanup warning:", cleanupError);
        }
      }

      const otpCode = this.generateOtpCode();
      let otpDocument = null;

      // Save in delivery_otps collection (try otpHash schema first, then fallback)
      if (DELIVERY_OTPS_COLLECTION_ID) {
        const primaryPayload = {
          shipmentId: cleanShipmentId,
          orderId: String(resolved.orderId || cleanShipmentId),
          trackingId: String(resolved.trackingId || `TRK-${cleanShipmentId.slice(0, 8)}`),
          userId: String(resolved.userId || "customer"),
          otpHash: String(otpCode),
          expiresAt: twoDaysExpiryDate,
          verified: false,
          attempts: 0,
          maxAttempts: 10,
          createdAt: now.toISOString(),
          verifiedAt: null,
        };

        try {
          otpDocument = await databases.createDocument(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            ID.unique(),
            primaryPayload
          );
        } catch (primaryErr) {
          console.warn(
            "Primary delivery_otps create warning, trying fallback schema:",
            primaryErr?.message || primaryErr
          );
          try {
            // eslint-disable-next-line no-unused-vars
            const { verifiedAt: _unusedVerifiedAt, ...withoutVerifiedAt } =
              primaryPayload;
            otpDocument = await databases.createDocument(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              ID.unique(),
              withoutVerifiedAt
            );
          } catch {
            try {
              otpDocument = await databases.createDocument(
                DATABASE_ID,
                DELIVERY_OTPS_COLLECTION_ID,
                ID.unique(),
                {
                  shipmentId: cleanShipmentId,
                  orderId: String(resolved.orderId || cleanShipmentId),
                  trackingId: String(
                    resolved.trackingId || `TRK-${cleanShipmentId.slice(0, 8)}`
                  ),
                  userId: String(resolved.userId || "customer"),
                  otpCode: String(otpCode),
                  expiresAt: twoDaysExpiryDate,
                  verified: false,
                  attempts: 0,
                  maxAttempts: 10,
                  createdAt: now.toISOString(),
                }
              );
            } catch (fallbackErr) {
              console.warn(
                "Fallback delivery_otps create warning (notification OTP will still work):",
                fallbackErr?.message || fallbackErr
              );
            }
          }
        }
      }

      // Always create/update the customer's DELIVERY_OTP notification!
      await this.ensureDeliveryOtpNotification({
        userId: resolved.userId,
        orderId: resolved.orderId,
        shipmentId: cleanShipmentId,
        trackingId: resolved.trackingId,
        otpCode,
        forceUpdate: true,
      });

      return {
        success: true,
        alreadyExists: false,
        otpDocument: {
          ...(otpDocument || {
            shipmentId: cleanShipmentId,
            orderId: resolved.orderId,
            userId: resolved.userId,
          }),
          otp: otpCode,
          otpCode,
          otpHash: otpCode,
        },
        otp: otpCode,
        otpCode,
        expiresAt: twoDaysExpiryDate,
      };
    } catch (error) {
      console.error("Generate delivery OTP error:", error);

      return {
        success: false,
        error: error.message || "Failed to generate delivery OTP.",
      };
    }
  }

  // GET ACTIVE OTP BY SHIPMENT ID (CHECKS BOTH DELIVERY_OTPS & NOTIFICATIONS)
  async getActiveOtpByShipmentId(shipmentId) {
    try {
      const cleanShipmentId = String(shipmentId || "").trim();
      if (!cleanShipmentId) return null;

      if (DELIVERY_OTPS_COLLECTION_ID) {
        try {
          const response = await databases.listDocuments(
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
          console.warn("getActiveOtpByShipmentId delivery_otps warning:", err);
        }
      }

      // Fallback: check customer's DELIVERY_OTP notification
      const notif = await this.findExistingDeliveryOtpNotification(
        cleanShipmentId
      );
      if (notif) {
        const match = String(notif.message || "").match(/\b(\d{6})\b/);
        if (match) {
          return {
            $id: notif.$id,
            shipmentId: cleanShipmentId,
            orderId: notif.orderId || "",
            userId: notif.userId || "",
            otp: match[1],
            otpCode: match[1],
            otpHash: match[1],
            createdAt: notif.createdAt || notif.$createdAt,
          };
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
            // ignore if activeOtp came from notifications fallback
          }
        }
      }

      const cleanOrderId = String(orderId || "").trim();
      if (cleanOrderId && ORDERS_COLLECTION_ID) {
        const orderLookup = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("orderId", cleanOrderId), Query.limit(1)]
        );
        let orderDoc = orderLookup?.documents?.[0] || null;
        if (!orderDoc) {
          try {
            orderDoc = await databases.getDocument(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              cleanOrderId
            );
          } catch {
            orderDoc = null;
          }
        }
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
      const cleanShipmentId = String(shipmentId || "").trim();

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

      const shipment = await databases.getDocument(
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

      const currentStatus = String(shipment.status || "").toUpperCase();

      if (currentStatus === "DELIVERED") {
        return {
          success: false,
          message: "This order has already been delivered.",
        };
      }

      if (currentStatus === "CANCELLED") {
        return {
          success: false,
          message: "This order has been cancelled and cannot be delivered.",
        };
      }

      if (currentStatus !== "OUT_FOR_DELIVERY") {
        return {
          success: false,
          message:
            "OTP verification is only available when the order is Out for Delivery.",
        };
      }

      const otpDocument = await this.getActiveOtpByShipmentId(cleanShipmentId);

      // Also check customer's DELIVERY_OTP notification
      let notificationOtp = "";
      let matchedNotifDoc = null;
      let matchedNotifUserId = "";
      if (NOTIFICATIONS_COLLECTION_ID) {
        try {
          const notifRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_COLLECTION_ID,
            [
              Query.equal("type", "DELIVERY_OTP"),
              Query.orderDesc("createdAt"),
              Query.limit(50),
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
            matchedNotifDoc = matchedNotif;
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

      // Check 2-day auto-cancel rule before verifying OTP
      if (
        this.isOutForDeliveryExpired(shipment, otpDocument, matchedNotifDoc)
      ) {
        await this.autoCancelExpiredOutForDeliveryShipment(shipment, {
          userId:
            shipment.userId ||
            otpDocument?.userId ||
            matchedNotifUserId ||
            "",
          orderId: shipment.orderId || "",
          trackingId: shipment.trackingId || "",
        });

        return {
          success: false,
          autoCancelled: true,
          message:
            "This order was Out for Delivery for more than 2 days without delivery and has been automatically cancelled.",
        };
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
        if (otpDocument?.$id && DELIVERY_OTPS_COLLECTION_ID) {
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

      if (otpDocument?.$id && DELIVERY_OTPS_COLLECTION_ID) {
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
                console.warn(
                  "Order items delivery sync warning:",
                  itemParseErr
                );
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

  // PROCESS OUT_FOR_DELIVERY SHIPMENTS (USED BY DELIVERY BOY & ADMIN VIEWS)
  // Auto-cancels any shipment that has been OUT_FOR_DELIVERY for >= 2 days,
  // and ensures OTP + customer notification exist for active ones.
  async processOutForDeliveryShipments(shipmentList = []) {
    if (!Array.isArray(shipmentList) || shipmentList.length === 0) {
      return [];
    }

    const activeShipments = [];

    for (const ship of shipmentList) {
      if (!ship?.$id) continue;
      const status = String(ship.status || "").trim().toUpperCase();
      if (status !== "OUT_FOR_DELIVERY") {
        activeShipments.push(ship);
        continue;
      }

      const otpResult = await this.generateOtp({
        shipmentId: String(ship.$id),
        orderId: String(ship.orderId || ""),
        userId: String(ship.userId || ""),
        trackingId: String(ship.trackingId || ""),
        shipmentDoc: ship,
      });

      if (otpResult?.autoCancelled) {
        // Skip adding to active OUT_FOR_DELIVERY queue since it was auto-cancelled
        continue;
      }

      activeShipments.push(ship);
    }

    return activeShipments;
  }

  // AUTO-SYNC MISSING DELIVERY_OTP, ORDER_DELIVERED & 2-DAY AUTO-CANCEL NOTIFICATIONS FOR USER
  async syncUserShipmentNotifications(userId) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId || !SHIPMENTS_COLLECTION_ID) return;

    try {
      const shipmentsByIdMap = new Map();
      const ordersByRefMap = new Map();

      // 1. Fetch shipments directly matching userId
      try {
        const shipRes = await databases.listDocuments(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          [
            Query.equal("userId", cleanUserId),
            Query.orderDesc("$createdAt"),
            Query.limit(30),
          ]
        );
        for (const s of shipRes?.documents || []) {
          if (s?.$id) shipmentsByIdMap.set(s.$id, s);
        }
      } catch (shipErr) {
        console.warn("syncUserShipmentNotifications direct ship query:", shipErr);
      }

      // 2. Also fetch user's orders so even if a shipment had missing/different userId, we find it!
      if (ORDERS_COLLECTION_ID) {
        try {
          const orderRes = await databases.listDocuments(
            DATABASE_ID,
            ORDERS_COLLECTION_ID,
            [
              Query.equal("userId", cleanUserId),
              Query.orderDesc("$createdAt"),
              Query.limit(25),
            ]
          );

          const userOrders = orderRes?.documents || [];
          for (const ord of userOrders) {
            const customRef = String(ord?.orderId || "").trim();
            const docRef = String(ord?.$id || "").trim();
            if (customRef) ordersByRefMap.set(customRef, ord);
            if (docRef) ordersByRefMap.set(docRef, ord);

            const alreadyHasShipment = Array.from(
              shipmentsByIdMap.values()
            ).some(
              (s) =>
                (customRef && String(s?.orderId || "") === customRef) ||
                (docRef && String(s?.orderId || "") === docRef)
            );

            if (!alreadyHasShipment && (customRef || docRef)) {
              try {
                const lookupRef = customRef || docRef;
                const byOrderRes = await databases.listDocuments(
                  DATABASE_ID,
                  SHIPMENTS_COLLECTION_ID,
                  [Query.equal("orderId", lookupRef), Query.limit(5)]
                );
                for (const s of byOrderRes?.documents || []) {
                  if (s?.$id) {
                    shipmentsByIdMap.set(s.$id, s);
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (ordErr) {
          console.warn("syncUserShipmentNotifications order query:", ordErr);
        }
      }

      const userShipments = Array.from(shipmentsByIdMap.values());

      for (const ship of userShipments) {
        const st = String(ship?.status || "").trim().toUpperCase();
        const linkedOrder =
          ordersByRefMap.get(String(ship?.orderId || "").trim()) || null;

        if (st === "OUT_FOR_DELIVERY") {
          await this.generateOtp({
            shipmentId: String(ship.$id),
            orderId: String(ship.orderId || linkedOrder?.orderId || ""),
            userId: cleanUserId,
            trackingId: String(ship.trackingId || ""),
            shipmentDoc: ship,
            orderDoc: linkedOrder,
          });
        } else if (st === "DELIVERED") {
          await this.ensureOrderDeliveredNotification({
            userId: cleanUserId,
            orderId: String(ship.orderId || linkedOrder?.orderId || ""),
            shipmentId: String(ship.$id),
            trackingId: String(ship.trackingId || ""),
          });
        }
      }

      // 3. Also sync wallet refunds for any cancelled orders/items
      await walletService.syncCancelledOrderRefunds(cleanUserId);
    } catch (syncErr) {
      console.warn("syncUserShipmentNotifications warning:", syncErr);
    }
  }
}

const deliveryOtpService = new DeliveryOtpService();

export default deliveryOtpService;
