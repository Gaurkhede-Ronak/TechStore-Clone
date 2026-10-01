import { Client, Databases, ID } from "appwrite";

const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);

class CouponService {

  async addCoupon(data) {
    return await databases.createDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID,
      ID.unique(),
      data
    );
  }

  async getCoupons() {
    return await databases.listDocuments(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID
    );
  }

  async updateCoupon(id, data) {
    return await databases.updateDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID,
      id,
      data
    );
  }

  async deleteCoupon(id) {
    return await databases.deleteDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID,
      id
    );
  }

  // Increase Coupon Usage
  async increaseUsage(id, usedCount) {
    return await databases.updateDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COUPONS_COLLECTION_ID,
      id,
      {
        usedCount: usedCount + 1,
      }
    );
  }

}

export default new CouponService();