import { Databases, ID, Query } from "appwrite";
import client from "./config";
import notificationService from "./notificationService";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const SHIPMENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID;

const SHIPMENT_EVENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENT_EVENTS_COLLECTION_ID;

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

      if (!DELIVERY_OTPS_COLLECTION_ID) {
        throw new Error(
          "VITE_APPWRITE_DELIVERY_OTPS_COLLECTION_ID is missing in .env"
        );
      }

      const now = new Date();

      // Keep OTP valid for 10 years so it NEVER expires before delivery
      const nonExpiringDate = new Date(
        now.getTime() + 3650 * 24 * 60 * 60 * 1000
      ).toISOString();

      // Reuse existing unverified OTP unless forceNew is explicitly requested
      const existingOtpResponse =
        await databases.listDocuments(
          DATABASE_ID,
          DELIVERY_OTPS_COLLECTION_ID,
          [
            Query.equal(
              "shipmentId",
              cleanShipmentId
            ),
            Query.equal("verified", false),
            Query.orderDesc("$createdAt"),
            Query.limit(10),
          ]
        );

      const existingDocs =
        existingOtpResponse?.documents || [];

      if (!mergedData.forceNew && existingDocs.length > 0) {
        const activeOtp = existingDocs[0];

        try {
          const updatedExisting =
            await databases.updateDocument(
              DATABASE_ID,
              DELIVERY_OTPS_COLLECTION_ID,
              activeOtp.$id,
              {
                expiresAt: nonExpiringDate,
                maxAttempts: 999,
              }
            );

          return {
            success: true,
            otpDocument: {
              ...updatedExisting,
              otp: updatedExisting.otpCode,
            },
            otp: updatedExisting.otpCode,
            otpCode: updatedExisting.otpCode,
            expiresAt: nonExpiringDate,
          };
        } catch {
          return {
            success: true,
            otpDocument: {
              ...activeOtp,
              otp: activeOtp.otpCode,
            },
            otp: activeOtp.otpCode,
            otpCode: activeOtp.otpCode,
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
        } catch (cleanupError) {
          console.warn(
            "Old OTP cleanup warning:",
            cleanupError
          );
        }
      }

      const otpCode = this.generateOtpCode();

      const payload = {
        shipmentId: cleanShipmentId,
        orderId: String(mergedData.orderId || ""),
        trackingId: String(mergedData.trackingId || ""),
        userId: String(mergedData.userId || ""),
        customerEmail: String(
          mergedData.customerEmail || ""
        ),
        customerPhone: String(
          mergedData.customerPhone || ""
        ),
        otpCode,
        expiresAt: nonExpiringDate,
        verified: false,
        attempts: 0,
        maxAttempts: 999,
        createdAt: now.toISOString(),
        verifiedAt: "",
      };

      const otpDocument =
        await databases.createDocument(
          DATABASE_ID,
          DELIVERY_OTPS_COLLECTION_ID,
          ID.unique(),
          payload
        );

      return {
        success: true,
        otpDocument: {
          ...otpDocument,
          otp: otpCode,
        },
        otp: otpCode,
        otpCode,
        expiresAt: nonExpiringDate,
      };
    } catch (error) {
      console.error(
        "Generate delivery OTP error:",
        error
      );

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

      if (
        !cleanShipmentId ||
        !DELIVERY_OTPS_COLLECTION_ID
      ) {
        return null;
      }

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          DELIVERY_OTPS_COLLECTION_ID,
          [
            Query.equal(
              "shipmentId",
              cleanShipmentId
            ),
            Query.equal("verified", false),
            Query.orderDesc("$createdAt"),
            Query.limit(1),
          ]
        );

      const doc = response?.documents?.[0] || null;
      if (!doc) return null;
      return {
        ...doc,
        otp: doc.otp || doc.otpCode || "",
        otpCode: doc.otpCode || doc.otp || "",
      };
    } catch (error) {
      console.error(
        "Get active delivery OTP error:",
        error
      );
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
          await databases.updateDocument(
            DATABASE_ID,
            DELIVERY_OTPS_COLLECTION_ID,
            activeOtp.$id,
            {
              verified: true,
              verifiedAt: new Date().toISOString(),
            }
          );
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
          message:
            "Please enter a valid 6-digit OTP.",
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
          message:
            "This order has already been delivered.",
        };
      }

      if (
        currentStatus !== "OUT_FOR_DELIVERY"
      ) {
        return {
          success: false,
          message:
            "OTP verification is only available when the order is Out for Delivery.",
        };
      }

      const otpDocument =
        await this.getActiveOtpByShipmentId(
          cleanShipmentId
        );

      // Also check customer's DELIVERY_OTP notification in case OTP is read from Notifications page
      let notificationOtp = "";
      if (NOTIFICATIONS_COLLECTION_ID) {
        try {
          const notifRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_COLLECTION_ID,
            [
              Query.equal("type", "DELIVERY_OTP"),
              Query.orderDesc("$createdAt"),
              Query.limit(25),
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
            const directOtp = String(matchedNotif.otp || "").replace(/\D/g, "").trim();
            if (directOtp.length === 6) {
              notificationOtp = directOtp;
            } else {
              const msgMatch = String(matchedNotif.message || "").match(/\b(\d{6})\b/);
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
          message:
            "No active OTP found for this shipment.",
        };
      }

      // NOTE: OTP never expires while the parcel is Out for Delivery.
      // It remains valid until the parcel is actually delivered.

      const storedOtp = String(
        otpDocument?.otpCode || otpDocument?.otp || ""
      ).trim();

      const isOtpMatch =
        (storedOtp && enteredOtp === storedOtp) ||
        (notificationOtp && enteredOtp === notificationOtp);

      if (!isOtpMatch) {
        const updatedAttempts =
          Number(otpDocument.attempts || 0) + 1;

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

        return {
          success: false,
          message:
            "Invalid OTP. Please check your 6-digit Delivery OTP and try again.",
        };
      }

      // OTP MATCHED
      const verifiedAt =
        new Date().toISOString();

      if (otpDocument?.$id) {
        await databases.updateDocument(
          DATABASE_ID,
          DELIVERY_OTPS_COLLECTION_ID,
          otpDocument.$id,
          {
            verified: true,
            verifiedAt,
          }
        );
      }

      const deliveredLocation =
        [
          shipment.destinationCity,
          shipment.destinationState,
        ]
          .filter(Boolean)
          .join(", ") ||
        shipment.currentLocation ||
        "Customer Address";

      const updatedShipment =
        await databases.updateDocument(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          cleanShipmentId,
          {
            status: "DELIVERED",
            currentLocation: deliveredLocation,
            deliveredAt: verifiedAt,
            updatedAt: verifiedAt,
          }
        );

      try {
        await databases.createDocument(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          ID.unique(),
          {
            shipmentId: cleanShipmentId,
            trackingId: String(
              shipment.trackingId || ""
            ),
            status: "DELIVERED",
            location: deliveredLocation,
            city: String(
              shipment.destinationCity || ""
            ),
            state: String(
              shipment.destinationState || ""
            ),
            latitude: Number(
              shipment.destinationLat || 0
            ),
            longitude: Number(
              shipment.destinationLng || 0
            ),
            description:
              "Delivered successfully after customer OTP verification.",
             scanType: "DELIVERED",
            timestamp: verifiedAt,
          }
        );
      } catch (eventError) {
        console.warn(
          "Shipment delivered event creation warning:",
          eventError
        );
      }

      // Sync Order status in ORDERS_COLLECTION_ID to "Delivered"
      // while keeping any cancelled items marked as Cancelled
      if (ORDERS_COLLECTION_ID && shipment.orderId) {
        try {
          const orderLookup =
            await databases.listDocuments(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              [
                Query.equal(
                  "orderId",
                  String(shipment.orderId)
                ),
                Query.limit(1),
              ]
            );

          let orderDoc =
            orderLookup?.documents?.[0] || null;

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
        shipment.userId || otpDocument?.userId || ""
      ).trim();

      if (customerUserId) {
        try {
          await notificationService.createNotification({
            userId: customerUserId,
            recipientRole: "user",
            title: "Order Delivered ✅",
            message: `Your order ${shipment.orderId || ""} (Tracking ID: ${shipment.trackingId || "N/A"}) has been delivered successfully! Thank you for shopping with TechStore. You can now rate and review your product.`,
            type: "ORDER_DELIVERED",
            orderId: String(shipment.orderId || ""),
            shipmentId: cleanShipmentId,
            trackingId: String(shipment.trackingId || ""),
            otp: "",
          });
        } catch (notifError) {
          console.warn(
            "Customer delivered notification warning:",
            notifError
          );
        }
      }

      // Send Admin Notification: ORDER_DELIVERED
      try {
        await notificationService.createAdminNotification({
          title: "Order Delivered ✅",
          message: `Order ${shipment.orderId || ""} (${shipment.trackingId || ""}) has been delivered to ${shipment.customerName || "Customer"} after OTP verification.`,
          type: "ORDER_DELIVERED",
          orderId: String(shipment.orderId || ""),
          shipmentId: cleanShipmentId,
          trackingId: String(shipment.trackingId || ""),
        });
      } catch (adminNotifError) {
        console.warn(
          "Admin delivered notification warning:",
          adminNotifError
        );
      }

      return {
        success: true,
        message:
          "OTP verified! Order marked as Delivered.",
        shipment: updatedShipment,
      };
    } catch (error) {
      console.error(
        "Verify delivery OTP error:",
        error
      );

      return {
        success: false,
        message:
          error.message ||
          "Failed to verify OTP.",
      };
    }
  }
}

const deliveryOtpService =
  new DeliveryOtpService();

export default deliveryOtpService;
