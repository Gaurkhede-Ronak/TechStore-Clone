import { databases, ID } from "./database";
import { storage } from "./storage";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_ID = import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID;
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

class ProductService {
    constructor() {
        this.cachedResponse = null;
        this.cachedById = new Map();
    }

    getCachedProducts() {
        return this.cachedResponse?.documents || null;
    }

    getCachedProduct(id) {
        if (!id) return null;
        if (this.cachedById.has(id)) {
            return this.cachedById.get(id);
        }
        const docs = this.cachedResponse?.documents || [];
        return docs.find((item) => item?.$id === id) || null;
    }

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
        const created = await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID,
            ID.unique(),
            data
        );
        if (created?.$id) {
            this.cachedById.set(created.$id, created);
            if (this.cachedResponse?.documents) {
                this.cachedResponse = {
                    ...this.cachedResponse,
                    documents: [created, ...this.cachedResponse.documents],
                };
            }
        }
        return created;
    }

    // Get All Products
    async getProducts(forceRefresh = false) {
        if (!forceRefresh && this.cachedResponse?.documents?.length) {
            // Refresh silently in background so cache stays fresh
            databases
                .listDocuments(DATABASE_ID, COLLECTION_ID)
                .then((res) => {
                    if (res?.documents) {
                        this.cachedResponse = res;
                        res.documents.forEach((doc) => {
                            if (doc?.$id) this.cachedById.set(doc.$id, doc);
                        });
                    }
                })
                .catch(() => {});
            return this.cachedResponse;
        }

        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_ID
        );
        if (response?.documents) {
            this.cachedResponse = response;
            response.documents.forEach((doc) => {
                if (doc?.$id) this.cachedById.set(doc.$id, doc);
            });
        }
        return response;
    }

    // Get Single Product
    async getProduct(id) {
        const doc = await databases.getDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id
        );
        if (doc?.$id) {
            this.cachedById.set(doc.$id, doc);
        }
        return doc;
    }

    // Update Product
    async updateProduct(id, data) {
        const updated = await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id,
            data
        );
        if (updated?.$id) {
            this.cachedById.set(updated.$id, updated);
            if (this.cachedResponse?.documents) {
                this.cachedResponse = {
                    ...this.cachedResponse,
                    documents: this.cachedResponse.documents.map((doc) =>
                        doc.$id === updated.$id ? updated : doc
                    ),
                };
            }
        }
        return updated;
    }

    // Delete Product
    async deleteProduct(id) {
        const res = await databases.deleteDocument(
            DATABASE_ID,
            COLLECTION_ID,
            id
        );
        this.cachedById.delete(id);
        if (this.cachedResponse?.documents) {
            this.cachedResponse = {
                ...this.cachedResponse,
                documents: this.cachedResponse.documents.filter(
                    (doc) => doc.$id !== id
                ),
            };
        }
        return res;
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
