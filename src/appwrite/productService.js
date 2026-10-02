import { Query } from "appwrite";
import { databases, ID } from "./database";
import { storage } from "./storage";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_ID = import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID;
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

const dataUrlToFile = (dataUrl, fileName = "product-image.png") => {
    const parts = String(dataUrl || "").split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const binaryStr = atob(parts[1]);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mime });
};

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

    // Upload Image to Appwrite Storage Bucket
    async uploadImage(file) {
        return await storage.createFile(
            BUCKET_ID,
            ID.unique(),
            file
        );
    }

    // Ensure any File, Blob, data: URL, or long URL (> 180 chars) becomes a short Appwrite file ID or valid short string
    async resolveImageInput(input, fallbackValue = "") {
        if (!input) return fallbackValue;

        // 1. Direct File or Blob upload
        if (typeof File !== "undefined" && input instanceof File) {
            const uploaded = await this.uploadImage(input);
            return uploaded?.$id || fallbackValue;
        }
        if (typeof Blob !== "undefined" && input instanceof Blob) {
            const file = new File([input], `product-${Date.now()}.png`, {
                type: input.type || "image/png",
            });
            const uploaded = await this.uploadImage(file);
            return uploaded?.$id || fallbackValue;
        }

        const str = String(input).trim();
        if (!str) return fallbackValue;

        // 2. Base64 data:image/... URI -> convert to File and upload to Appwrite Storage
        if (str.startsWith("data:")) {
            try {
                const file = dataUrlToFile(str, `product-${Date.now()}.png`);
                if (file) {
                    const uploaded = await this.uploadImage(file);
                    if (uploaded?.$id) return uploaded.$id;
                }
            } catch (err) {
                console.warn("Base64 image upload fallback failed:", err);
            }
            return fallbackValue;
        }

        // 3. Long URL (> 180 chars) -> try fetching image blob and uploading to Appwrite Storage so it becomes a 20-char $id
        if (
            str.length > 180 &&
            (str.startsWith("http://") || str.startsWith("https://"))
        ) {
            try {
                const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(str)}&output=webp`;
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    const file = new File([blob], `product-${Date.now()}.webp`, {
                        type: blob.type || "image/webp",
                    });
                    const uploaded = await this.uploadImage(file);
                    if (uploaded?.$id) return uploaded.$id;
                }
            } catch (err) {
                console.warn("Long URL proxy upload fallback failed:", err);
            }

            // If proxy fetch did not succeed, strip long query string if still > 190 chars
            if (str.length > 190) {
                const withoutQuery = str.split("?")[0];
                if (withoutQuery.length <= 190 && withoutQuery.length > 10) {
                    return withoutQuery;
                }
                return str.slice(0, 190);
            }
        }

        return str;
    }

    async sanitizeProductPayload(data = {}) {
        const clean = { ...data };

        if (clean.title !== undefined) {
            clean.title = String(clean.title || "").trim().slice(0, 200);
        }
        if (clean.brand !== undefined) {
            clean.brand = String(clean.brand || "").trim().slice(0, 150);
        }
        if (clean.category !== undefined) {
            clean.category = String(clean.category || "").trim().slice(0, 150);
        }
        if (clean.description !== undefined) {
            clean.description = String(clean.description || "").trim().slice(0, 2000);
        }
        if (clean.price !== undefined) {
            clean.price = Number(clean.price || 0);
        }
        if (clean.discount !== undefined) {
            clean.discount = Number(clean.discount || 0);
        }
        if (clean.stock !== undefined) {
            clean.stock = Number(clean.stock || 0);
        }
        if (clean.rating !== undefined) {
            clean.rating = Math.min(5, Math.max(0, Number(clean.rating || 4.5)));
        }

        if (clean.thumbnail !== undefined) {
            clean.thumbnail = await this.resolveImageInput(clean.thumbnail, "");
        }
        if (clean.image !== undefined) {
            clean.image = await this.resolveImageInput(
                clean.image,
                clean.thumbnail || ""
            );
        }
        if (clean.image2 !== undefined) {
            clean.image2 = await this.resolveImageInput(
                clean.image2,
                clean.image || clean.thumbnail || ""
            );
        }

        return clean;
    }

    async executeWithSchemaRetry(operationFn, payload) {
        let currentPayload = { ...payload };

        for (let attempt = 0; attempt < 6; attempt += 1) {
            try {
                return await operationFn(currentPayload);
            } catch (error) {
                const msg = String(error?.message || "");

                // Match: Attribute "xyz" has invalid type. Value must be a valid string and no longer than N chars
                const lenMatch = msg.match(
                    /Attribute\s+"([^"]+)"\s+has invalid type\.\s*Value must be a valid string and no longer than\s+(\d+)\s+chars/i
                );
                if (lenMatch) {
                    const attr = lenMatch[1];
                    const maxChars = Math.max(1, Number(lenMatch[2]) || 190);
                    const curVal = String(currentPayload[attr] ?? "");

                    if (
                        (attr === "image" || attr === "image2") &&
                        currentPayload.thumbnail &&
                        String(currentPayload.thumbnail).length <= maxChars
                    ) {
                        currentPayload[attr] = String(currentPayload.thumbnail);
                    } else if (curVal.length > maxChars) {
                        currentPayload[attr] = curVal.slice(0, maxChars);
                    } else {
                        currentPayload[attr] = curVal || "N/A";
                    }
                    continue;
                }

                // Match: Invalid document structure: Attribute "xyz" has invalid type. Value must be a valid URL
                const urlMatch = msg.match(
                    /Attribute\s+"([^"]+)"\s+has invalid type\.\s*Value must be a valid URL/i
                );
                if (urlMatch) {
                    const attr = urlMatch[1];
                    const val = String(currentPayload[attr] || "").trim();
                    if (val && !val.startsWith("http")) {
                        currentPayload[attr] = `https://fra.cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${val}/view?project=${
                            import.meta.env.VITE_APPWRITE_PROJECT_ID
                        }`;
                    } else if (!val && currentPayload.thumbnail) {
                        currentPayload[attr] = currentPayload.thumbnail;
                    } else {
                        delete currentPayload[attr];
                    }
                    continue;
                }

                // Match: Unknown attribute: "xyz"
                const unknownMatch = msg.match(/Unknown attribute:\s*"([^"]+)"/i);
                if (unknownMatch) {
                    const attr = unknownMatch[1];
                    delete currentPayload[attr];
                    continue;
                }

                throw error;
            }
        }

        return await operationFn(currentPayload);
    }

    // Add Product
    async addProduct(data) {
        const sanitized = await this.sanitizeProductPayload(data);
        const created = await this.executeWithSchemaRetry(
            (payload) =>
                databases.createDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    ID.unique(),
                    payload
                ),
            sanitized
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
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [Query.limit(500)]
            );
            if (response?.documents) {
                this.cachedResponse = response;
                response.documents.forEach((doc) => {
                    if (doc?.$id) this.cachedById.set(doc.$id, doc);
                });
            }
            return response;
        } catch (err) {
            if (!forceRefresh && this.cachedResponse?.documents?.length) {
                return this.cachedResponse;
            }
            throw err;
        }
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
        const sanitized = await this.sanitizeProductPayload(data);
        const updated = await this.executeWithSchemaRetry(
            (payload) =>
                databases.updateDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    id,
                    payload
                ),
            sanitized
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
