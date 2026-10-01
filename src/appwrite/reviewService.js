import { Databases, ID, Query } from "appwrite";
import client from "./config";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const REVIEWS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_REVIEWS_COLLECTION_ID;


class ReviewService {

  // CREATE REVIEW

  async createReview(data) {

    try {

      if (!data?.productName) {
        throw new Error("Product name is required.");
      }

      if (!data?.customerName) {
        throw new Error("Customer name is required.");
      }

      if (!data?.customerEmail) {
        throw new Error("Customer email is required.");
      }

      if (!data?.review) {
        throw new Error("Review text is required.");
      }

      const rating = Number(data.rating);

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        throw new Error(
          "Rating must be between 1 and 5."
        );
      }

      const now =
        new Date().toISOString();

      const payload = {

        productId:
          String(data.productId || ""),

        productName:
          String(data.productName),

        userId:
          String(data.userId || ""),

        customerName:
          String(data.customerName),

        customerEmail:
          String(data.customerEmail),

        rating,

        review:
          String(data.review),

        status:
          String(data.status || "Pending"),

        orderId:
          String(data.orderId || ""),

        createdAt:
          String(data.createdAt || now),

      };

      const response =
        await databases.createDocument(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          ID.unique(),
          payload
        );

      console.log(
        "✅ Review created:",
        response
      );

      return response;

    } catch (error) {

      console.error(
        "❌ Create Review Error:",
        error
      );

      throw error;
    }
  }


  // GET ALL REVIEWS

  async getReviews() {

    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.orderDesc("$createdAt"),
            Query.limit(100),
          ]
        );

      return response;

    } catch (error) {

      console.error(
        "❌ Get Reviews Error:",
        error
      );

      throw error;
    }
  }


  // GET SINGLE REVIEW

  async getReview(documentId) {

    try {

      return await databases.getDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        documentId
      );

    } catch (error) {

      console.error(
        "❌ Get Review Error:",
        error
      );

      throw error;
    }
  }


  // GET REVIEWS BY PRODUCT

  async getReviewsByProduct(productId) {

    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal(
              "productId",
              String(productId)
            ),
            Query.equal(
              "status",
              "Approved"
            ),
            Query.orderDesc("$createdAt"),
          ]
        );

      return response.documents;

    } catch (error) {

      console.error(
        "❌ Get Product Reviews Error:",
        error
      );

      throw error;
    }
  }


  // GET REVIEWS BY USER

  async getReviewsByUser(userId) {

    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal(
              "userId",
              String(userId)
            ),
            Query.orderDesc("$createdAt"),
          ]
        );

      return response.documents;

    } catch (error) {

      console.error(
        "❌ Get User Reviews Error:",
        error
      );

      throw error;
    }
  }


  // GET REVIEWS BY STATUS

  async getReviewsByStatus(status) {

    try {

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal(
              "status",
              String(status)
            ),
            Query.orderDesc("$createdAt"),
          ]
        );

      return response.documents;

    } catch (error) {

      console.error(
        "❌ Get Status Reviews Error:",
        error
      );

      throw error;
    }
  }


  // UPDATE REVIEW

  async updateReview(
    documentId,
    data
  ) {

    try {

      return await databases.updateDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        documentId,
        data
      );

    } catch (error) {

      console.error(
        "❌ Update Review Error:",
        error
      );

      throw error;
    }
  }


  // UPDATE STATUS

  async updateReviewStatus(
    documentId,
    status
  ) {

    try {

      return await databases.updateDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        documentId,
        {
          status: String(status),
        }
      );

    } catch (error) {

      console.error(
        "❌ Update Review Status Error:",
        error
      );

      throw error;
    }
  }


  // DELETE REVIEW

  async deleteReview(documentId) {

    try {

      await databases.deleteDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        documentId
      );

      console.log(
        "✅ Review deleted:",
        documentId
      );

      return true;

    } catch (error) {

      console.error(
        "❌ Delete Review Error:",
        error
      );

      throw error;
    }
  }

}


export default new ReviewService();