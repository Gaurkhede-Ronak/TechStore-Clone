import { Databases, ID, Query } from "appwrite";

import client from "./config";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const WAREHOUSE_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_WAREHOUSES_COLLECTION_ID;

class WarehouseService {
  // CREATE WAREHOUSE

  async createWarehouse(data) {
    return await databases.createDocument(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      ID.unique(),
      data
    );
  }

  // GET SINGLE WAREHOUSE

  async getWarehouse(documentId) {
    return await databases.getDocument(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      documentId
    );
  }

  // GET WAREHOUSE BY CODE

  async getWarehouseByCode(code) {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          WAREHOUSE_COLLECTION_ID,
          [
            Query.equal("code", code),
            Query.limit(1),
          ]
        );

      return response.documents[0] || null;
    } catch (error) {
      console.error(
        "Get warehouse by code error:",
        error
      );

      throw error;
    }
  }

  // GET ALL WAREHOUSES

  async getAllWarehouses() {
    return await databases.listDocuments(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      [
        Query.orderAsc("name"),
      ]
    );
  }

  // GET ACTIVE WAREHOUSES

  async getActiveWarehouses() {
    try {
      const response =
        await databases.listDocuments(
          DATABASE_ID,
          WAREHOUSE_COLLECTION_ID,
          [
            Query.equal("isActive", true),
            Query.orderAsc("name"),
          ]
        );

      return response.documents;
    } catch (error) {
      console.error(
        "Get active warehouses error:",
        error
      );

      throw error;
    }
  }

  // GET WAREHOUSES BY STATE

  async getWarehousesByState(state) {
    return await databases.listDocuments(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      [
        Query.equal("state", state),
        Query.equal("isActive", true),
        Query.orderAsc("name"),
      ]
    );
  }

  // GET WAREHOUSES BY CITY

  async getWarehousesByCity(city) {
    return await databases.listDocuments(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      [
        Query.equal("city", city),
        Query.equal("isActive", true),
        Query.orderAsc("name"),
      ]
    );
  }

  // UPDATE WAREHOUSE

  async updateWarehouse(documentId, data) {
    return await databases.updateDocument(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      documentId,
      data
    );
  }

  // DELETE WAREHOUSE

  async deleteWarehouse(documentId) {
    return await databases.deleteDocument(
      DATABASE_ID,
      WAREHOUSE_COLLECTION_ID,
      documentId
    );
  }

  // ACTIVATE WAREHOUSE

  async activateWarehouse(documentId) {
    return await this.updateWarehouse(
      documentId,
      {
        isActive: true,
      }
    );
  }

  // DEACTIVATE WAREHOUSE

  async deactivateWarehouse(documentId) {
    return await this.updateWarehouse(
      documentId,
      {
        isActive: false,
      }
    );
  }
}

export default new WarehouseService();