import { Databases, ID, Query } from "appwrite";
import client from "./config";
import shipmentHelper from "./shipmentHelper";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const ORDERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;

const SHIPMENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID;

const SHIPMENT_EVENTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_SHIPMENT_EVENTS_COLLECTION_ID;

const DELIVERY_OTPS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_DELIVERY_OTPS_COLLECTION_ID;

const NOTIFICATIONS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_NOTIFICATIONS_COLLECTION_ID;

const VALID_ORDER_ATTRIBUTES = [
  "orderId",
  "invoiceNo",
  "transactionId",
  "fullName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "pincode",
  "payment",
  "orderDate",
  "subTotal",
  "shipping",
  "gst",
  "discount",
  "total",
  "couponCode",
  "items",
  "userId",
  "status",
  "paymentStatus",
  "gstApplied",
  "platformFee",
  "orderGrandTotal",
  "payableAmount",
  "walletPaid",
  "walletMonthlyPromotionUsed",
  "walletWelcomePromotionUsed",
  "walletUserMoneyUsed",
  "walletBalanceBefore",
  "walletRemainingPayable",
  "walletPaymentPending",
  "upiPaid",
  "cardPaid",
  "onlinePaid",
  "totalPaid",
];

const sanitizeOrderData = (data) => {
  if (!data || typeof data !== "object") return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (VALID_ORDER_ATTRIBUTES.includes(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

class OrderService {
  // ADD ORDER

  async addOrder(data, options = {}) {
    const { createShipment = true } = options;

    try {
      if (!data) {
        throw new Error("Order data is required.");
      }

      const sanitizedData = sanitizeOrderData(data);

      const order = await databases.createDocument(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        ID.unique(),
        sanitizedData
      );

      console.log("Order created successfully:", order);

      let shipmentResult = null;

      if (!createShipment) {
        console.log(
          "Shipment creation deferred until payment succeeds."
        );
      } else {
        try {
          shipmentResult =
            await shipmentHelper.createShipmentForOrder(
              data.orderId || order.$id,
              {
                ...data,
                ...order,
                orderId:
                  data.orderId ||
                  order.orderId ||
                  order.$id,
                userId:
                  data.userId ||
                  order.userId ||
                  "",
              }
            );

          if (shipmentResult?.success) {
            console.log(
              "Shipment created successfully:",
              shipmentResult.shipment
            );

            console.log(
              "Tracking ID:",
              shipmentResult.trackingId
            );

            console.log(
              "Courier:",
              shipmentResult.courier?.name
            );

            console.log(
              "Warehouse:",
              shipmentResult.warehouse?.name
            );

            console.log(
              "Estimated Delivery:",
              shipmentResult.estimatedDeliveryDate
            );
          } else {
            console.error(
              "Shipment creation failed:",
              shipmentResult?.error
            );
          }
        } catch (shipmentError) {
          console.error(
            "Shipment creation error:",
            shipmentError
          );
        }
      }

      return {
        ...order,

        shipment:
          shipmentResult?.success
            ? shipmentResult.shipment
            : null,

        trackingId:
          shipmentResult?.success
            ? shipmentResult.trackingId
            : null,

        courier:
          shipmentResult?.success
            ? shipmentResult.courier
            : null,

        warehouse:
          shipmentResult?.success
            ? shipmentResult.warehouse
            : null,

        estimatedDeliveryDate:
          shipmentResult?.success
            ? shipmentResult.estimatedDeliveryDate
            : null,
      };
    } catch (error) {
      console.error("Add order error:", error);
      throw error;
    }
  }

  // GET ALL ORDERS

  async getOrders() {
    try {
      return await databases.listDocuments(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [
          Query.orderDesc("$createdAt"),
        ]
      );
    } catch (error) {
      console.error("Get orders error:", error);
      throw error;
    }
  }

  // GET ORDERS BY USER

  async getUserOrders(userId) {
    return this.getOrdersByUser(userId);
  }

  async getOrdersByUser(userId) {
    try {
      const cleanUserId = String(userId || "").trim();

      if (!cleanUserId) {
        return {
          total: 0,
          documents: [],
        };
      }

      return await databases.listDocuments(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [
          Query.equal("userId", cleanUserId),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ]
      );
    } catch (error) {
      console.error(
        "Get orders by user error:",
        error
      );
      throw error;
    }
  }

  // GET SINGLE ORDER BY APPWRITE DOCUMENT ID

  async getOrder(documentId) {
    try {
      const cleanDocumentId =
        String(documentId || "").trim();

      if (!cleanDocumentId) {
        throw new Error(
          "Order document ID is required."
        );
      }

      return await databases.getDocument(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        cleanDocumentId
      );
    } catch (error) {
      console.error("Get order error:", error);
      throw error;
    }
  }

  // GET ORDER BY CUSTOM ORDER ID

  async getOrderByOrderId(orderId) {
    try {
      const cleanOrderId =
        String(orderId || "").trim();

      if (!cleanOrderId) {
        return null;
      }

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [
            Query.equal(
              "orderId",
              cleanOrderId
            ),
            Query.limit(1),
          ]
        );

      return response?.documents?.[0] || null;
    } catch (error) {
      console.error(
        "Get order by orderId error:",
        error
      );
      throw error;
    }
  }

  // =====================================================
  // GET ORDER SMART
  //
  // IMPORTANT:
  // ORD1790072337703 = CUSTOM orderId
  // Appwrite $id = DIFFERENT ID
  //
  // We first identify custom order IDs and query them
  // directly instead of causing a useless 404.
  // =====================================================

  async getOrderSmart(identifier) {
    try {
      const cleanIdentifier =
        String(identifier || "").trim();

      if (!cleanIdentifier) {
        throw new Error("Order ID is required.");
      }

      /*
       * CUSTOM ORDER ID FORMAT
       *
       * Example:
       * ORD1790072337703
       *
       * Your checkout/order system creates this as
       * the orderId field, while Appwrite creates
       * its own $id.
       */

      const looksLikeCustomOrderId =
        /^ORD/i.test(cleanIdentifier);

  // 1. CUSTOM ORDER ID

      if (looksLikeCustomOrderId) {
        const order =
          await this.getOrderByOrderId(
            cleanIdentifier
          );

        if (!order) {
          throw new Error(
            `Order not found for orderId: ${cleanIdentifier}`
          );
        }

        return order;
      }

  // 2. OTHERWISE TRY APPWRITE DOCUMENT ID

      try {
        return await this.getOrder(
          cleanIdentifier
        );
      } catch (documentError) {
        console.warn(
          "Appwrite document lookup failed. Trying custom orderId...",
          documentError
        );
      }

  // 3. FALLBACK TO CUSTOM ORDER ID

      const order =
        await this.getOrderByOrderId(
          cleanIdentifier
        );

      if (!order) {
        throw new Error("Order not found.");
      }

      return order;
    } catch (error) {
      console.error(
        "Get order smart error:",
        error
      );
      throw error;
    }
  }

  // GET DELIVERED ORDER FOR PRODUCT

  async getDeliveredOrderForProduct(
    userId,
    productId
  ) {
    try {
      const cleanUserId =
        String(userId || "").trim();

      const cleanProductId =
        String(productId || "").trim();

      if (
        !cleanUserId ||
        !cleanProductId
      ) {
        return null;
      }

      const orderResponse =
        await this.getOrdersByUser(
          cleanUserId
        );

      const orders =
        orderResponse?.documents || [];

      if (!orders.length) {
        return null;
      }

      for (const order of orders) {
        if (!order) {
          continue;
        }

        const orderStatus =
          String(order.status || "")
            .trim()
            .toLowerCase();

        if (orderStatus === "cancelled") {
          continue;
        }

        let items = order.items;

        if (typeof items === "string") {
          try {
            items = JSON.parse(items);
          } catch (parseError) {
            console.warn(
              "Unable to parse order items:",
              order.$id,
              parseError
            );

            continue;
          }
        }

        if (!Array.isArray(items)) {
          continue;
        }

        const purchasedProduct =
          items.some((item) => {
            if (!item) {
              return false;
            }

            const possibleProductIds = [
              item.$id,
              item.productId,
              item.productID,
              item.id,
            ]
              .filter(Boolean)
              .map((value) =>
                String(value)
              );

            return possibleProductIds.includes(
              cleanProductId
            );
          });

        if (!purchasedProduct) {
          continue;
        }

        let shipmentResponse = null;

        try {
          shipmentResponse =
            await databases.listDocuments(
              DATABASE_ID,
              SHIPMENTS_COLLECTION_ID,
              [
                Query.equal(
                  "orderId",
                  String(
                    order.orderId ||
                      order.$id
                  )
                ),
                Query.orderDesc(
                  "$createdAt"
                ),
                Query.limit(10),
              ]
            );
        } catch (shipmentError) {
          console.error(
            "Shipment lookup failed:",
            shipmentError
          );

          continue;
        }

        const shipments =
          shipmentResponse?.documents || [];

        const deliveredShipment =
          shipments.find((shipment) => {
            const status =
              String(
                shipment?.status || ""
              )
                .trim()
                .toUpperCase();

            return status === "DELIVERED";
          });

        if (deliveredShipment) {
          return {
            verified: true,
            order,
            shipment: deliveredShipment,
            productId: cleanProductId,
          };
        }
      }

      return null;
    } catch (error) {
      console.error(
        "Delivered product verification error:",
        error
      );

      throw error;
    }
  }

  // COMPLETE PAYMENT

  async completePayment(
    identifier,
    paymentMethod
  ) {
    try {
      const order =
        await this.getOrderSmart(
          identifier
        );

      if (!order?.$id) {
        throw new Error(
          "Order not found."
        );
      }

      const method =
        String(
          paymentMethod ||
            order.payment ||
            ""
        )
          .trim()
          .toUpperCase();

      if (!["UPI", "CARD"].includes(method)) {
        throw new Error(
          "Invalid online payment method."
        );
      }

      const currentPaymentStatus =
        String(
          order.paymentStatus ||
            "PENDING"
        )
          .trim()
          .toUpperCase();

      if (
        currentPaymentStatus === "PAID"
      ) {
        return await this.getOrderWithShipment(
          order
        );
      }

      const updatedOrder =
        await databases.updateDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          order.$id,
          {
            paymentStatus: "PAID",
            payment: method,
          }
        );

      const shipmentResponse =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          [
            Query.equal(
              "orderId",
              String(
                order.orderId ||
                  order.$id
              )
            ),
            Query.limit(10),
          ]
        );

      let shipmentResult = null;

      const existingShipment =
        shipmentResponse?.documents?.[0] ||
        null;

      if (!existingShipment) {
        shipmentResult =
          await shipmentHelper.createShipmentForOrder(
            String(
              order.orderId ||
                order.$id
            ),
            {
              ...order,
              ...updatedOrder,
              userId:
                order.userId ||
                updatedOrder.userId ||
                "",
              orderId:
                order.orderId ||
                order.$id,
            }
          );

        if (!shipmentResult?.success) {
          throw new Error(
            shipmentResult?.error ||
              "Payment was completed, but shipment creation failed."
          );
        }
      }

      return {
        ...updatedOrder,

        paymentStatus: "PAID",

        shipment:
          shipmentResult?.shipment ||
          existingShipment ||
          null,

        trackingId:
          shipmentResult?.trackingId ||
          existingShipment?.trackingId ||
          null,

        courier:
          shipmentResult?.courier ||
          null,

        warehouse:
          shipmentResult?.warehouse ||
          null,

        estimatedDeliveryDate:
          shipmentResult?.estimatedDeliveryDate ||
          null,
      };
    } catch (error) {
      console.error(
        "Complete payment error:",
        error
      );

      throw error;
    }
  }

  // GET ORDER WITH SHIPMENT

  async getOrderWithShipment(order) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENTS_COLLECTION_ID,
          [
            Query.equal(
              "orderId",
              String(
                order.orderId ||
                  order.$id
              )
            ),
            Query.limit(10),
          ]
        );

      const shipment =
        response?.documents?.[0] ||
        null;

      return {
        ...order,

        shipment,

        trackingId:
          shipment?.trackingId ||
          null,

        courier:
          shipment?.courier ||
          null,

        estimatedDeliveryDate:
          shipment?.estimatedDeliveryDate ||
          null,
      };
    } catch (error) {
      console.error(
        "Get order shipment error:",
        error
      );

      return order;
    }
  }

  // UPDATE ORDER

  async updateOrder(
    documentId,
    data
  ) {
    try {
      const cleanDocumentId =
        String(documentId || "").trim();

      if (!cleanDocumentId) {
        throw new Error(
          "Order document ID is required."
        );
      }

      const sanitizedData = sanitizeOrderData(data);

      return await databases.updateDocument(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        cleanDocumentId,
        sanitizedData
      );
    } catch (error) {
      console.error(
        "Update order error:",
        error
      );

      throw error;
    }
  }

  // DELETE DOCUMENTS BY QUERY

  async deleteDocumentsByQuery(
    collectionId,
    queries = []
  ) {
    if (!collectionId) {
      return [];
    }

    const deletedIds = [];

    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          collectionId,
          [
            ...queries,
            Query.limit(100),
          ]
        );

      const documents =
        response?.documents || [];

      for (const document of documents) {
        if (!document?.$id) {
          continue;
        }

        await databases.deleteDocument(
          DATABASE_ID,
          collectionId,
          document.$id
        );

        deletedIds.push(
          document.$id
        );
      }

      return deletedIds;
    } catch (error) {
      console.error(
        "Delete related documents error:",
        {
          collectionId,
          error,
        }
      );

      throw error;
    }
  }

  // DELETE SHIPMENT EVENTS

  async deleteShipmentEvents(
    shipmentId
  ) {
    if (
      !shipmentId ||
      !SHIPMENT_EVENTS_COLLECTION_ID
    ) {
      return [];
    }

    return await this.deleteDocumentsByQuery(
      SHIPMENT_EVENTS_COLLECTION_ID,
      [
        Query.equal(
          "shipmentId",
          String(shipmentId)
        ),
      ]
    );
  }

  // DELETE DELIVERY OTPS

  async deleteDeliveryOtps(
    shipmentId
  ) {
    if (
      !shipmentId ||
      !DELIVERY_OTPS_COLLECTION_ID
    ) {
      return [];
    }

    return await this.deleteDocumentsByQuery(
      DELIVERY_OTPS_COLLECTION_ID,
      [
        Query.equal(
          "shipmentId",
          String(shipmentId)
        ),
      ]
    );
  }

  // DELETE NOTIFICATIONS

  async deleteNotifications({
    orderId,
    shipmentId,
    trackingId,
  }) {
    if (!NOTIFICATIONS_COLLECTION_ID) {
      return [];
    }

    const deletedIds = [];

    if (shipmentId) {
      const ids =
        await this.deleteDocumentsByQuery(
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "shipmentId",
              String(shipmentId)
            ),
          ]
        );

      deletedIds.push(...ids);
    }

    if (orderId) {
      const ids =
        await this.deleteDocumentsByQuery(
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "orderId",
              String(orderId)
            ),
          ]
        );

      deletedIds.push(...ids);
    }

    if (trackingId) {
      const ids =
        await this.deleteDocumentsByQuery(
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "trackingId",
              String(trackingId)
            ),
          ]
        );

      deletedIds.push(...ids);
    }

    return [
      ...new Set(deletedIds),
    ];
  }

  // DELETE SHIPMENT

  async deleteShipment(
    shipment
  ) {
    if (
      !shipment ||
      !shipment.$id
    ) {
      return null;
    }

    const shipmentId =
      String(shipment.$id);

    const orderId =
      String(
        shipment.orderId || ""
      );

    const trackingId =
      String(
        shipment.trackingId || ""
      );

    await this.deleteShipmentEvents(
      shipmentId
    );

    await this.deleteDeliveryOtps(
      shipmentId
    );

    await this.deleteNotifications({
      orderId,
      shipmentId,
      trackingId,
    });

    if (SHIPMENTS_COLLECTION_ID) {
      await databases.deleteDocument(
        DATABASE_ID,
        SHIPMENTS_COLLECTION_ID,
        shipmentId
      );
    }

    return shipmentId;
  }

  // DELETE ORDER + EVERYTHING RELATED

  async deleteOrder(
    documentId
  ) {
    try {
      const cleanDocumentId =
        String(documentId || "").trim();

      if (!cleanDocumentId) {
        throw new Error(
          "Order document ID is required."
        );
      }

      console.log(
        "Starting order deletion:",
        cleanDocumentId
      );

      const order =
        await this.getOrder(
          cleanDocumentId
        );

      const orderId =
        String(
          order?.orderId || ""
        );

      console.log(
        "Order found:",
        {
          appwriteId: order?.$id,
          orderId,
        }
      );

      let shipments = [];

      if (SHIPMENTS_COLLECTION_ID) {
        if (orderId) {
          const response =
            await databases.listDocuments(
              DATABASE_ID,
              SHIPMENTS_COLLECTION_ID,
              [
                Query.equal(
                  "orderId",
                  orderId
                ),
                Query.limit(100),
              ]
            );

          shipments =
            response?.documents || [];
        }

        if (
          shipments.length === 0 &&
          cleanDocumentId !== orderId
        ) {
          const response =
            await databases.listDocuments(
              DATABASE_ID,
              SHIPMENTS_COLLECTION_ID,
              [
                Query.equal(
                  "orderId",
                  cleanDocumentId
                ),
                Query.limit(100),
              ]
            );

          shipments =
            response?.documents || [];
        }
      }

      console.log(
        "Related shipments found:",
        shipments.length
      );

      for (const shipment of shipments) {
        console.log(
          "Deleting shipment:",
          shipment.$id
        );

        await this.deleteShipment(
          shipment
        );
      }

      if (
        orderId &&
        NOTIFICATIONS_COLLECTION_ID
      ) {
        await this.deleteNotifications({
          orderId,
        });
      }

      console.log(
        "Deleting Appwrite order:",
        cleanDocumentId
      );

      await databases.deleteDocument(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        cleanDocumentId
      );

      console.log(
        "Order deleted successfully:",
        cleanDocumentId
      );

      return {
        success: true,
        orderId: cleanDocumentId,
        customOrderId: orderId,
        deletedShipments:
          shipments.length,
      };
    } catch (error) {
      console.error(
        "Delete order error:",
        error
      );

      if (
        error?.code === 401 ||
        error?.response?.code === 401
      ) {
        throw new Error(
          "Order delete permission denied. Appwrite Orders collection ma Delete permission check karo.",
          { cause: error }
        );
      }

      throw error;
    }
  }

  // GET ORDERS BY STATUS

  async getOrdersByStatus(
    status
  ) {
    try {
      return await databases.listDocuments(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [
          Query.equal(
            "status",
            status
          ),
          Query.orderDesc(
            "$createdAt"
          ),
        ]
      );
    } catch (error) {
      console.error(
        "Get orders by status error:",
        error
      );

      throw error;
    }
  }

  // GET ORDERS BY PAYMENT

  async getOrdersByPayment(
    payment
  ) {
    try {
      return await databases.listDocuments(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        [
          Query.equal(
            "payment",
            payment
          ),
          Query.orderDesc(
            "$createdAt"
          ),
        ]
      );
    } catch (error) {
      console.error(
        "Get orders by payment error:",
        error
      );

      throw error;
    }
  }
}

export default new OrderService();