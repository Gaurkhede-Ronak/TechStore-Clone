import { Databases, ID, Query } from "appwrite";
import client from "./config";

const databases = new Databases(client);

class UserService {
  async createUser(data) {
    return await databases.createDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID,
      ID.unique(),
      data
    );
  }

  async getUserByUserId(userId) {
    const response = await databases.listDocuments(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );

    return response.documents[0] || null;
  }

  // ⭐ નવું Function
  async getUserByEmail(email) {
    const response = await databases.listDocuments(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID,
      [Query.equal("email", email)]
    );

    return response.documents[0] || null;
  }

  async updateUser(documentId, data) {
    return await databases.updateDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID,
      documentId,
      data
    );
  }
}

export default new UserService();