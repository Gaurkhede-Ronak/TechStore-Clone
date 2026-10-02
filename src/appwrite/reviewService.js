import { Databases, ID, Query } from "appwrite";
import client from "./config";

const databases = new Databases(client);

const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID;

const REVIEWS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_REVIEWS_COLLECTION_ID;

class ReviewService {
  // Check Configuration
  isConfigured() {
    return Boolean(
      DATABASE_ID &&
      REVIEWS_COLLECTION_ID
    );
  }

  ensureConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        "Appwrite Reviews collection is not configured. Check VITE_APPWRITE_REVIEWS_COLLECTION_ID in .env"
      );
    }
  }

  // Get All Reviews (Admin Panel)
  async getAllReviews() {
    try {
      this.ensureConfigured();

      return await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ]
      );
    } catch (error) {
      console.error(
        "Get all reviews error:",
        error
      );
      throw error;
    }
  }

  // Get Product Reviews (Customer Product Page)
  // Returns all Approved & Pending verified buyer reviews (excludes Rejected)
  async getReviewsByProduct(productId) {
    try {
      this.ensureConfigured();

      const cleanProductId =
        String(productId || "").trim();

      if (!cleanProductId) {
        return {
          documents: [],
          total: 0,
        };
      }

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal(
              "productId",
              cleanProductId
            ),
            Query.orderDesc("$createdAt"),
            Query.limit(100),
          ]
        );

      const visibleDocs = (
        response?.documents || []
      ).filter(
        (doc) =>
          String(doc?.status || "Approved")
            .trim()
            .toLowerCase() !== "rejected"
      );

      return {
        ...response,
        documents: visibleDocs,
        total: visibleDocs.length,
      };
    } catch (error) {
      console.error(
        "Get product reviews error:",
        error
      );
      throw error;
    }
  }

  // Create Review
  async createReview(data) {
    try {
      this.ensureConfigured();

      const payload = {
        customerName:
          String(
            data.customerName || "Customer"
          ).trim(),

        customerEmail:
          String(
            data.customerEmail || ""
          ).trim(),

        userId:
          String(
            data.userId || ""
          ).trim(),

        productId:
          String(
            data.productId || ""
          ).trim(),

        productName:
          String(
            data.productName || ""
          ).trim(),

        orderId:
          String(
            data.orderId || ""
          ).trim(),

        rating:
          Math.min(
            5,
            Math.max(
              1,
              Number(data.rating || 5)
            )
          ),

        review:
          String(
            data.review || ""
          ).trim(),

        status:
          data.status || "Approved",

        createdAt:
          data.createdAt ||
          new Date().toISOString(),
      };

      return await databases.createDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        ID.unique(),
        payload
      );
    } catch (error) {
      console.error(
        "Create review error:",
        error
      );
      throw error;
    }
  }

  // Update Review Status (Approve / Reject / Pending)
  async updateReviewStatus(
    reviewId,
    status
  ) {
    try {
      this.ensureConfigured();

      return await databases.updateDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        reviewId,
        {
          status,
        }
      );
    } catch (error) {
      console.error(
        "Update review status error:",
        error
      );
      throw error;
    }
  }

  // Update Review Document
  async updateReview(
    reviewId,
    data
  ) {
    try {
      this.ensureConfigured();

      return await databases.updateDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        reviewId,
        data
      );
    } catch (error) {
      console.error(
        "Update review error:",
        error
      );
      throw error;
    }
  }

  // Delete Review
  async deleteReview(reviewId) {
    try {
      this.ensureConfigured();

      return await databases.deleteDocument(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        reviewId
      );
    } catch (error) {
      console.error(
        "Delete review error:",
        error
      );
      throw error;
    }
  }

  // Get Reviews By User
  async getReviewsByUser(userId) {
    try {
      this.ensureConfigured();

      if (!userId) {
        return {
          documents: [],
          total: 0,
        };
      }

      return await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_COLLECTION_ID,
        [
          Query.equal(
            "userId",
            String(userId)
          ),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ]
      );
    } catch (error) {
      console.error(
        "Get user reviews error:",
        error
      );
      throw error;
    }
  }

  // Get User Review For Product
  async getUserReviewForProduct(
    userId,
    productId
  ) {
    try {
      this.ensureConfigured();

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

      const response =
        await databases.listDocuments(
          DATABASE_ID,
          REVIEWS_COLLECTION_ID,
          [
            Query.equal(
              "userId",
              cleanUserId
            ),
            Query.equal(
              "productId",
              cleanProductId
            ),
            Query.orderDesc("$createdAt"),
            Query.limit(1),
          ]
        );

      return (
        response?.documents?.[0] ||
        null
      );
    } catch (error) {
      console.error(
        "Get user product review error:",
        error
      );
      return null;
    }
  }
}

const reviewService =
  new ReviewService();

export default reviewService;
