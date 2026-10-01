import { Databases, ID, Query } from "appwrite";

import client from "./config";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const SHIPMENT_EVENTS_COLLECTION_ID =
  import.meta.env
    .VITE_APPWRITE_SHIPMENT_EVENTS_COLLECTION_ID;

class ShipmentEventService {
  // CREATE EVENT

  async createEvent(data) {
    try {
      return await databases.createDocument(
        DATABASE_ID,
        SHIPMENT_EVENTS_COLLECTION_ID,
        ID.unique(),
        data
      );
    } catch (error) {
      console.error(
        "Create shipment event error:",
        error
      );

      throw error;
    }
  }

  // GET SINGLE EVENT

  async getEvent(documentId) {
    return await databases.getDocument(
      DATABASE_ID,
      SHIPMENT_EVENTS_COLLECTION_ID,
      documentId
    );
  }

  // GET ALL EVENTS

  async getEvents() {
    return await databases.listDocuments(
      DATABASE_ID,
      SHIPMENT_EVENTS_COLLECTION_ID,
      [
        Query.orderDesc("timestamp"),
      ]
    );
  }

  // GET EVENTS BY SHIPMENT

  async getShipmentEvents(shipmentId) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          [
            Query.equal(
              "shipmentId",
              shipmentId
            ),
            Query.orderDesc("timestamp"),
          ]
        );

      return response.documents;
    } catch (error) {
      console.error(
        "Get shipment events error:",
        error
      );

      throw error;
    }
  }

  // GET EVENTS BY TRACKING ID

  async getTrackingEvents(trackingId) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          [
            Query.equal(
              "trackingId",
              trackingId
            ),
            Query.orderDesc("timestamp"),
          ]
        );

      return response.documents;
    } catch (error) {
      console.error(
        "Get tracking events error:",
        error
      );

      throw error;
    }
  }

  // GET EVENTS BY ORDER ID

  async getOrderEvents(orderId) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          [
            Query.equal(
              "orderId",
              orderId
            ),
            Query.orderDesc("timestamp"),
          ]
        );

      return response.documents;
    } catch (error) {
      console.error(
        "Get order events error:",
        error
      );

      throw error;
    }
  }

  // GET LATEST EVENT

  async getLatestEvent(shipmentId) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          [
            Query.equal(
              "shipmentId",
              shipmentId
            ),
            Query.orderDesc("timestamp"),
            Query.limit(1),
          ]
        );

      return response.documents[0] || null;
    } catch (error) {
      console.error(
        "Get latest shipment event error:",
        error
      );

      throw error;
    }
  }

  // GET EVENTS BY STATUS

  async getEventsByStatus(status) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          SHIPMENT_EVENTS_COLLECTION_ID,
          [
            Query.equal(
              "status",
              status
            ),
            Query.orderDesc("timestamp"),
          ]
        );

      return response.documents;
    } catch (error) {
      console.error(
        "Get events by status error:",
        error
      );

      throw error;
    }
  }

  // UPDATE EVENT

  async updateEvent(documentId, data) {
    return await databases.updateDocument(
      DATABASE_ID,
      SHIPMENT_EVENTS_COLLECTION_ID,
      documentId,
      data
    );
  }

  // DELETE EVENT

  async deleteEvent(documentId) {
    return await databases.deleteDocument(
      DATABASE_ID,
      SHIPMENT_EVENTS_COLLECTION_ID,
      documentId
    );
  }
}

export default new ShipmentEventService();