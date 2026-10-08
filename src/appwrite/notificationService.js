import { Databases, ID, Query } from "appwrite";
import client from "./config";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const NOTIFICATIONS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_NOTIFICATIONS_COLLECTION_ID;


class NotificationService {

  // CREATE NOTIFICATION

  async createNotification(data) {
    try {

      if (!data?.userId) {
        throw new Error("User ID is required.");
      }

      const notificationData = {
        userId: String(data.userId),

        type: String(
          data.type || "GENERAL"
        ),

        title: String(
          data.title || "Notification"
        ),

        message: String(
          data.message || ""
        ),

        orderId: String(
          data.orderId || ""
        ),

        shipmentId: String(
          data.shipmentId || ""
        ),

        trackingId: String(
          data.trackingId || ""
        ),

        isRead:
          data.isRead === true,

        createdAt:
          data.createdAt ||
          new Date().toISOString(),
      };


      console.log(
        "📢 Creating notification:",
        notificationData
      );


      const response =
        await databases.createDocument(
          DATABASE_ID,
          NOTIFICATIONS_COLLECTION_ID,
          ID.unique(),
          notificationData
        );


      console.log(
        "✅ Notification created successfully:",
        response
      );


      return response;

    } catch (error) {

      console.error(
        "❌ Create notification error:",
        error
      );

      console.error(
        "❌ Error message:",
        error?.message
      );

      console.error(
        "❌ Error code:",
        error?.code
      );

      console.error(
        "❌ Database ID:",
        DATABASE_ID
      );

      console.error(
        "❌ Notifications Collection ID:",
        NOTIFICATIONS_COLLECTION_ID
      );

      throw error;
    }
  }


  // GET NOTIFICATION BY ID

  async getNotification(documentId) {
    try {

      if (!documentId) {
        throw new Error(
          "Notification ID is required."
        );
      }

      return await databases.getDocument(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        documentId
      );

    } catch (error) {

      console.error(
        "Get notification error:",
        error?.message || error
      );

      throw error;
    }
  }


  // GET ALL USER NOTIFICATIONS

  async getUserNotifications(userId) {
    try {

      if (!userId) {
        throw new Error(
          "User ID is required."
        );
      }


      const response =
        await databases.listDocuments(
          DATABASE_ID,
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "userId",
              String(userId)
            ),

            Query.orderDesc(
              "createdAt"
            ),
          ]
        );


      const rawDocs = response?.documents || [];
      const seenNotifKeys = new Set();
      const cleanedDocs = [];

      for (const doc of rawDocs) {
        const typeKey = String(doc?.type || "").toUpperCase();
        const ordKey = String(doc?.orderId || "").trim();
        let titleKey = String(doc?.title || "").trim();

        // Fix any manual cancellation notifications that were previously saved with "Auto-Cancelled" under type "ORDER_CANCELLED"
        if (
          typeKey === "ORDER_CANCELLED" &&
          /auto-cancelled/i.test(titleKey)
        ) {
          const cleanTitle = "Order Cancelled ❌";
          const cleanMsg = ordKey
            ? `Order ${ordKey} has been cancelled successfully.`
            : "Your order has been cancelled successfully.";
          doc.title = cleanTitle;
          doc.message = cleanMsg;
          titleKey = cleanTitle;

          if (doc?.$id) {
            databases
              .updateDocument(
                DATABASE_ID,
                NOTIFICATIONS_COLLECTION_ID,
                doc.$id,
                {
                  title: cleanTitle,
                  message: cleanMsg,
                }
              )
              .catch(() => {});
          }
        }

        if (
          ordKey &&
          (typeKey === "WALLET_REFUND" ||
            typeKey === "OUT_FOR_DELIVERY" ||
            typeKey === "DELIVERED" ||
            typeKey === "ORDER_DELIVERED" ||
            typeKey === "CANCELLED" ||
            typeKey === "ORDER_CANCELLED" ||
            typeKey === "ORDER_AUTO_CANCELLED")
        ) {
          const sig = `${typeKey}::${ordKey}::${titleKey}`;
          if (seenNotifKeys.has(sig)) {
            if (doc?.$id) {
              databases
                .deleteDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, doc.$id)
                .catch(() => {});
            }
            continue;
          }
          seenNotifKeys.add(sig);
        }

        cleanedDocs.push(doc);
      }

      return {
        ...response,
        documents: cleanedDocs,
        total: cleanedDocs.length,
      };

    } catch (error) {

      console.error(
        "Get user notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // GET ALL ADMIN NOTIFICATIONS

  async getAdminNotifications() {
    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.orderDesc(
              "createdAt"
            ),
          ]
        );


      return response;

    } catch (error) {

      console.error(
        "Get admin notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // GET USER UNREAD NOTIFICATIONS

  async getUnreadNotifications(userId) {
    try {

      if (!userId) {
        throw new Error(
          "User ID is required."
        );
      }


      const response =
        await databases.listDocuments(
          DATABASE_ID,
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "userId",
              String(userId)
            ),

            Query.equal(
              "isRead",
              false
            ),

            Query.orderDesc(
              "createdAt"
            ),
          ]
        );


      return response;

    } catch (error) {

      console.error(
        "Get unread notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // GET ADMIN UNREAD NOTIFICATIONS

  async getUnreadAdminNotifications() {
    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          NOTIFICATIONS_COLLECTION_ID,
          [
            Query.equal(
              "isRead",
              false
            ),

            Query.orderDesc(
              "createdAt"
            ),
          ]
        );


      return response;

    } catch (error) {

      console.error(
        "Get unread admin notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // MARK ONE NOTIFICATION AS READ

  async markAsRead(documentId) {
    try {

      if (!documentId) {
        throw new Error(
          "Notification ID is required."
        );
      }


      return await databases.updateDocument(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        documentId,
        {
          isRead: true,
        }
      );

    } catch (error) {

      console.error(
        "Mark notification as read error:",
        error?.message || error
      );

      throw error;
    }
  }


  // MARK ALL USER NOTIFICATIONS AS READ

  async markAllAsRead(userId) {
    try {

      const response =
        await this.getUnreadNotifications(
          userId
        );


      if (
        !response?.documents?.length
      ) {
        return [];
      }


      return await Promise.all(
        response.documents.map(
          (notification) =>
            this.markAsRead(
              notification.$id
            )
        )
      );

    } catch (error) {

      console.error(
        "Mark all user notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // MARK ALL ADMIN NOTIFICATIONS AS READ

  async markAllAdminAsRead() {
    try {

      const response =
        await this.getUnreadAdminNotifications();


      if (
        !response?.documents?.length
      ) {
        return [];
      }


      return await Promise.all(
        response.documents.map(
          (notification) =>
            this.markAsRead(
              notification.$id
            )
        )
      );

    } catch (error) {

      console.error(
        "Mark all admin notifications error:",
        error?.message || error
      );

      throw error;
    }
  }


  // UPDATE NOTIFICATION

  async updateNotification(
    documentId,
    data
  ) {
    try {

      if (!documentId) {
        throw new Error(
          "Notification ID is required."
        );
      }


      return await databases.updateDocument(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        documentId,
        data
      );

    } catch (error) {

      console.error(
        "Update notification error:",
        error?.message || error
      );

      throw error;
    }
  }


  // DELETE NOTIFICATION

  async deleteNotification(
    documentId
  ) {
    try {

      if (!documentId) {
        throw new Error(
          "Notification ID is required."
        );
      }


      await databases.deleteDocument(
        DATABASE_ID,
        NOTIFICATIONS_COLLECTION_ID,
        documentId
      );


      console.log(
        "Notification deleted successfully:",
        documentId
      );


      return true;

    } catch (error) {

      console.error(
        "Delete notification error:",
        error?.message || error
      );

      throw error;
    }
  }
}


export default new NotificationService();