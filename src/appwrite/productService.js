import { databases, ID } from "./database";
import { storage } from "./storage";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_ID = import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID;
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

class ProductService {

    // Upload Image
    async uploadImage(file) {
        return await storage.createFile(
            BUCKET_ID,
            ID.unique(),
            file
        );
    }

    // Add Product
    async addProduct(data) {
        return await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            ID.unique(),
            data
        );
    }

    // Get All Products
    async getProducts() {
        return await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID
        );
    }

    // Get Single Product
    async getProduct(id) {
        return await databases.getDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id
        );
    }

    // Update Product
    async updateProduct(id, data) {
        return await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id,
            data
        );
    }

    // Delete Product
    async deleteProduct(id) {
        return await databases.deleteDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id
        );
    }

    // Delete Image
    async deleteImage(fileId) {
        return await storage.deleteFile(
            BUCKET_ID,
            fileId
        );
    }

}

const productService = new ProductService();

export default productService;