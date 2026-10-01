import { Databases, ID, Query } from "appwrite";
import client from "./config";

const databases = new Databases(client);

class ShipmentService {
  // CREATE SHIPMENT
  async createShipment(data) {
    try {
      const response = await databases.createDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        ID.unique(),
        data
      );

      return response;
    } catch (error) {
      console.error("Create Shipment Error:", error);
      throw error;
    }
  }

  // GET SHIPMENT BY DOCUMENT ID
  async getShipment(documentId) {
    try {
      const response = await databases.getDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        documentId
      );

      return response;
    } catch (error) {
      console.error("Get Shipment Error:", error);
      throw error;
    }
  }

  // GET SHIPMENT BY TRACKING ID
  async getShipmentByTrackingId(trackingId) {
    try {
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        [
          Query.equal("trackingId", trackingId),
          Query.limit(1),
        ]
      );

      return response.documents?.[0] || null;
    } catch (error) {
      console.error("Get Shipment By Tracking ID Error:", error);
      throw error;
    }
  }

  // GET SHIPMENTS BY ORDER ID
  async getShipmentsByOrderId(orderId) {
    try {
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        [
          Query.equal("orderId", String(orderId)),
          Query.orderDesc("$createdAt"),
        ]
      );

      return response.documents || [];
    } catch (error) {
      console.error("Get Shipments By Order ID Error:", error);
      throw error;
    }
  }

  // GET USER SHIPMENTS
  async getUserShipments(userId) {
    try {
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        [
          Query.equal("userId", String(userId)),
          Query.orderDesc("$createdAt"),
        ]
      );

      return response.documents || [];
    } catch (error) {
      console.error("Get User Shipments Error:", error);
      throw error;
    }
  }

  // GET ALL SHIPMENTS
  async getShipments() {
    try {
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        [
          Query.orderDesc("$createdAt"),
        ]
      );

      return response.documents || [];
    } catch (error) {
      console.error("Get Shipments Error:", error);
      throw error;
    }
  }

  // GET SHIPMENTS BY STATUS
  async getShipmentsByStatus(status) {
    try {
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        [
          Query.equal("status", status),
          Query.orderDesc("$createdAt"),
        ]
      );

      return response.documents || [];
    } catch (error) {
      console.error("Get Shipments By Status Error:", error);
      throw error;
    }
  }

  // UPDATE SHIPMENT
  async updateShipment(documentId, data) {
    try {
      const response = await databases.updateDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        documentId,
        data
      );

      return response;
    } catch (error) {
      console.error("Update Shipment Error:", error);
      throw error;
    }
  }

  // UPDATE ONLY STATUS
  async updateShipmentStatus(documentId, status) {
    try {
      const response = await databases.updateDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        documentId,
        {
          status,
        }
      );

      return response;
    } catch (error) {
      console.error("Update Shipment Status Error:", error);
      throw error;
    }
  }

  // DELETE SHIPMENT
  async deleteShipment(documentId) {
    try {
      await databases.deleteDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID,
        documentId
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error("Delete Shipment Error:", error);
      throw error;
    }
  }
}

export default new ShipmentService();

