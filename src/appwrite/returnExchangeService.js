import { ID, Query } from "appwrite";
import { databases } from "./config";

  // APPWRITE CONFIG

const DATABASE_ID =
    import.meta.env.VITE_APPWRITE_DATABASE_ID;

const COLLECTION_ID =
    import.meta.env
        .VITE_APPWRITE_RETURN_EXCHANGES_COLLECTION_ID;

const PAYMENT_REFUND_COLLECTION_ID =
    import.meta.env
        .VITE_APPWRITE_PAYMENT_REFUND_COLLECTION_ID ||
    "6ab26e940026d48516b8";

  // HELPERS

const getNow = () => {
    return new Date().toISOString();
};

const getTypePrefix = (type) => {
    return String(type).toUpperCase() ===
        "EXCHANGE"
        ? "EX"
        : "RE";
};

  // SERVICE

class ReturnExchangeService {
  // GENERATE REFERENCE ID

    async generateReferenceId(
        originalOrderId,
        type
    ) {
        const prefix =
            getTypePrefix(type);

        const cleanOrderId =
            String(
                originalOrderId || "ORDER"
            )
                .trim()
                .replace(/\s+/g, "");

        try {
            const response =
                await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTION_ID,
                    [
                        Query.equal(
                            "originalOrderId",
                            cleanOrderId
                        ),
                        Query.limit(100),
                    ]
                );

            const existing =
                Array.isArray(
                    response?.documents
                )
                    ? response.documents
                    : [];

            let maxNumber = 0;

            existing.forEach(
                (item) => {
                    const reference =
                        String(
                            item?.referenceId ||
                                ""
                        );

                    const match =
                        reference.match(
                            /-(\d+)$/
                        );

                    if (match) {
                        const number =
                            Number(
                                match[1]
                            );

                        if (
                            Number.isFinite(
                                number
                            ) &&
                            number >
                                maxNumber
                        ) {
                            maxNumber =
                                number;
                        }
                    }
                }
            );

            const nextNumber =
                String(
                    maxNumber + 1
                ).padStart(2, "0");

            return `${prefix}-${cleanOrderId}-${nextNumber}`;
        } catch (error) {
            console.error(
                "Generate reference ID error:",
                error
            );

            return `${prefix}-${cleanOrderId}-01`;
        }
    }

  // CREATE REQUEST

    async createRequest({
        originalOrderId,
        shipmentId,
        userId,
        type,
        reason = "",
        paymentMethod = "",
        refundAmount = 0,
    }) {
        if (!originalOrderId) {
            throw new Error(
                "Original order ID is required."
            );
        }

        if (!shipmentId) {
            throw new Error(
                "Shipment ID is required."
            );
        }

        if (!userId) {
            throw new Error(
                "User ID is required."
            );
        }

        const normalizedType =
            String(type || "")
                .trim()
                .toUpperCase();

        if (
            normalizedType !==
                "RETURN" &&
            normalizedType !==
                "EXCHANGE"
        ) {
            throw new Error(
                "Request type must be RETURN or EXCHANGE."
            );
        }

        const referenceId =
            await this.generateReferenceId(
                originalOrderId,
                normalizedType
            );

        const now = getNow();

        // =================================================
        // IMPORTANT
        // Only attributes that exist in
        // returnExchanges collection are sent here.
        //
        // NO paymentMethod
        // NO paymentStatus
        // NO refundStatus
        // NO refundAmount
        // =================================================

        const requestData = {
            referenceId,
            originalOrderId:
                String(originalOrderId),
            shipmentId:
                String(shipmentId),
            userId: String(userId),
            type: normalizedType,
            status: "REQUESTED",
            reason: String(reason || ""),
            deliveryBoyId: "",
            pickupOtp: "",
            otpVerified: false,
            createdAt: now,
            updatedAt: now,
        };

        const request =
            await databases.createDocument(
                DATABASE_ID,
                COLLECTION_ID,
                ID.unique(),
                requestData
            );

  // PAYMENT / REFUND DOCUMENT

        try {
            await databases.createDocument(
                DATABASE_ID,
                PAYMENT_REFUND_COLLECTION_ID,
                request.$id,
                {
                    paymentMethod:
                        String(
                            paymentMethod ||
                                ""
                        ),

                    paymentStatus:
                        "PENDING",

                    refundStatus:
                        normalizedType ===
                        "RETURN"
                            ? "PENDING"
                            : "NOT_REQUIRED",

                    refundAmount:
                        Number(
                            refundAmount
                        ) || 0,
                }
            );
        } catch (paymentError) {
            console.error(
                "Payment/refund document creation error:",
                paymentError
            );

            /*
             * Request already exists.
             * Do not delete the return/exchange
             * request just because payment/refund
             * metadata failed.
             */
        }

        return this.attachPaymentRefund(
            request
        );
    }

  // GET SINGLE REQUEST

    async getRequest(
        documentId
    ) {
        const request =
            await databases.getDocument(
                DATABASE_ID,
                COLLECTION_ID,
                documentId
            );

        return this.attachPaymentRefund(
            request
        );
    }

  // GET PAYMENT / REFUND

    async getPaymentRefund(
        documentId
    ) {
        try {
            return await databases.getDocument(
                DATABASE_ID,
                PAYMENT_REFUND_COLLECTION_ID,
                documentId
            );
        } catch (error) {
            if (
                error?.code === 404 ||
                error?.response?.code === 404
            ) {
                return null;
            }

            return null;
        }
    }

  // MERGE PAYMENT / REFUND

    async attachPaymentRefund(
        request
    ) {
        if (!request) {
            return request;
        }

        const isCancelledReq =
            String(request?.status || "")
                .trim()
                .toUpperCase() === "CANCELLED";

        const paymentRefund =
            await this.getPaymentRefund(
                request.$id
            );

        if (!paymentRefund) {
            return {
                ...request,
                paymentMethod:
                    request.paymentMethod ||
                    "",
                paymentStatus: isCancelledReq
                    ? "CANCELLED"
                    : request.paymentStatus ||
                      "",
                refundStatus: isCancelledReq
                    ? "NOT_REQUIRED"
                    : request.refundStatus ||
                      "",
                refundAmount: isCancelledReq
                    ? 0
                    : Number(
                          request.refundAmount ||
                              0
                      ),
            };
        }

        return {
            ...request,

            paymentRefund: isCancelledReq
                ? {
                      ...paymentRefund,
                      paymentStatus: "CANCELLED",
                      refundStatus: "NOT_REQUIRED",
                      refundAmount: 0,
                  }
                : paymentRefund,

            paymentMethod:
                paymentRefund.paymentMethod ||
                "",

            paymentStatus: isCancelledReq
                ? "CANCELLED"
                : paymentRefund.paymentStatus ||
                  "",

            refundStatus: isCancelledReq
                ? "NOT_REQUIRED"
                : paymentRefund.refundStatus ||
                  "",

            refundAmount: isCancelledReq
                ? 0
                : Number(
                      paymentRefund.refundAmount ||
                          0
                  ),
        };
    }

  // GET ALL REQUESTS

    async getAllRequests() {
        const response =
            await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [
                    Query.orderDesc(
                        "$createdAt"
                    ),
                    Query.limit(100),
                ]
            );

        const documents =
            Array.isArray(
                response?.documents
            )
                ? response.documents
                : [];

        return Promise.all(
            documents.map(
                (request) =>
                    this.attachPaymentRefund(
                        request
                    )
            )
        );
    }

  // GET USER REQUESTS

    async getUserRequests(
        userId
    ) {
        if (!userId) {
            return [];
        }

        const response =
            await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [
                    Query.equal(
                        "userId",
                        String(userId)
                    ),
                    Query.orderDesc(
                        "$createdAt"
                    ),
                    Query.limit(100),
                ]
            );

        const documents =
            Array.isArray(
                response?.documents
            )
                ? response.documents
                : [];

        return Promise.all(
            documents.map(
                (request) =>
                    this.attachPaymentRefund(
                        request
                    )
            )
        );
    }

  // GET BY ORDER ID

    async getRequestsByOrderId(
        originalOrderId
    ) {
        if (!originalOrderId) {
            return [];
        }

        const response =
            await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [
                    Query.equal(
                        "originalOrderId",
                        String(
                            originalOrderId
                        )
                    ),
                    Query.orderDesc(
                        "$createdAt"
                    ),
                    Query.limit(100),
                ]
            );

        const documents =
            Array.isArray(
                response?.documents
            )
                ? response.documents
                : [];

        return Promise.all(
            documents.map(
                (request) =>
                    this.attachPaymentRefund(
                        request
                    )
            )
        );
    }

  // GET DELIVERY REQUESTS (Assigned or active pickup/exchange requests)

    async getDeliveryRequests(deliveryBoyId = "") {
        try {
            if (deliveryBoyId) {
                return await this.getRequestsByDeliveryBoy(deliveryBoyId);
            }
            const all = await this.getAllRequests();
            return (Array.isArray(all) ? all : []).filter((req) => {
                const status = String(req?.status || "").toUpperCase();
                return (
                    Boolean(req?.deliveryBoyId) ||
                    status === "PICKUP_ASSIGNED" ||
                    status === "CONFIRMED" ||
                    status === "PICKED_UP" ||
                    status === "REFUND_INITIATED" ||
                    status === "REFUND_COMPLETED" ||
                    status === "EXCHANGE_COMPLETED"
                );
            });
        } catch (error) {
            console.error("Get delivery requests error:", error);
            return [];
        }
    }

  // GET BY DELIVERY BOY

    async getRequestsByDeliveryBoy(
        deliveryBoyId
    ) {
        if (!deliveryBoyId) {
            return [];
        }

        const response =
            await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_ID,
                [
                    Query.equal(
                        "deliveryBoyId",
                        String(
                            deliveryBoyId
                        )
                    ),
                    Query.orderDesc(
                        "$createdAt"
                    ),
                    Query.limit(100),
                ]
            );

        const documents =
            Array.isArray(
                response?.documents
            )
                ? response.documents
                : [];

        return Promise.all(
            documents.map(
                (request) =>
                    this.attachPaymentRefund(
                        request
                    )
            )
        );
    }

  // UPDATE REQUEST

    async updateRequest(
        documentId,
        data = {}
    ) {
        if (!documentId) {
            throw new Error(
                "Request document ID is required."
            );
        }

        const allowedFields = [
            "referenceId",
            "originalOrderId",
            "shipmentId",
            "userId",
            "type",
            "status",
            "reason",
            "deliveryBoyId",
            "pickupOtp",
            "otpVerified",
            "createdAt",
            "updatedAt",
        ];

        const cleanData = {};

        allowedFields.forEach(
            (field) => {
                if (
                    Object.prototype.hasOwnProperty.call(
                        data,
                        field
                    )
                ) {
                    cleanData[field] =
                        data[field];
                }
            }
        );

        cleanData.updatedAt =
            getNow();

        const updated =
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTION_ID,
                documentId,
                cleanData
            );

        return this.attachPaymentRefund(
            updated
        );
    }

  // ACCEPT REQUEST (Step 2 for Exchange / Return)

    async acceptRequest(
        documentId
    ) {
        return this.updateRequest(
            documentId,
            {
                status: "ACCEPTED",
            }
        );
    }

  // CONFIRM REQUEST

    async confirmRequest(
        documentId
    ) {
        return this.updateRequest(
            documentId,
            {
                status: "CONFIRMED",
            }
        );
    }

  // PACK EXCHANGE REQUEST

    async packRequest(
        documentId
    ) {
        return this.updateRequest(
            documentId,
            {
                status: "PACKED",
            }
        );
    }

  // DISPATCH EXCHANGE REQUEST

    async dispatchRequest(
        documentId
    ) {
        return this.updateRequest(
            documentId,
            {
                status: "DISPATCHED",
            }
        );
    }

  // CANCEL REQUEST

    async cancelRequest(
        documentId
    ) {
        const updated = await this.updateRequest(
            documentId,
            {
                status: "CANCELLED",
            }
        );

        try {
            await this.updatePaymentRefund(
                documentId,
                {
                    paymentStatus: "CANCELLED",
                    refundStatus: "NOT_REQUIRED",
                    refundAmount: 0,
                }
            );
        } catch (err) {
            console.warn("Cancel request refund reset warning:", err);
        }

        return this.attachPaymentRefund(updated);
    }

  // ASSIGN DELIVERY BOY

    async assignDeliveryBoy(
        documentId,
        deliveryBoyId
    ) {
        if (!documentId) {
            throw new Error(
                "Request ID is required."
            );
        }

        if (!deliveryBoyId) {
            throw new Error(
                "Delivery boy ID is required."
            );
        }

        return this.updateRequest(
            documentId,
            {
                deliveryBoyId:
                    String(
                        deliveryBoyId
                    ),

                status:
                    "PICKUP_ASSIGNED",
            }
        );
    }

  // MARK PICKED UP

    async markPickedUp(
        documentId
    ) {
        if (!documentId) {
            throw new Error(
                "Request ID is required."
            );
        }

        return this.updateRequest(
            documentId,
            {
                status: "PICKED_UP",
            }
        );
    }

    // =====================================================
    // COMPATIBILITY METHOD
    //
    // DeliveryBoyDashboard currently calls:
    //
    // markItemPickedUp()
    //
    // Keep this method so existing dashboard code
    // continues working.
    // =====================================================

    async markItemPickedUp(
        documentId
    ) {
        return this.markPickedUp(
            documentId
        );
    }

  // PICKUP OTP DISABLED

    async setPickupOtp() {
        throw new Error(
            "Pickup OTP is disabled for Return / Exchange."
        );
    }

  // VERIFY PICKUP OTP DISABLED

    async verifyPickupOtp() {
        throw new Error(
            "Pickup OTP is disabled for Return / Exchange."
        );
    }

  // UPDATE PAYMENT / REFUND

    async updatePaymentRefund(
        documentId,
        data = {}
    ) {
        if (!documentId) {
            throw new Error(
                "Request document ID is required."
            );
        }

        const allowedFields = [
            "paymentMethod",
            "paymentStatus",
            "refundStatus",
            "refundAmount",
        ];

        const cleanData = {};

        allowedFields.forEach(
            (field) => {
                if (
                    Object.prototype.hasOwnProperty.call(
                        data,
                        field
                    )
                ) {
                    cleanData[field] =
                        data[field];
                }
            }
        );

        try {
            const existing =
                await this.getPaymentRefund(
                    documentId
                );

            if (existing) {
                return databases.updateDocument(
                    DATABASE_ID,
                    PAYMENT_REFUND_COLLECTION_ID,
                    documentId,
                    cleanData
                );
            }

            return databases.createDocument(
                DATABASE_ID,
                PAYMENT_REFUND_COLLECTION_ID,
                documentId,
                cleanData
            );
        } catch (error) {
            console.error(
                "Update payment/refund error:",
                error
            );

            throw error;
        }
    }

  // INITIATE REFUND

    async initiateRefund(
        documentId,
        refundAmount = 0
    ) {
        return this.updatePaymentRefund(
            documentId,
            {
                paymentStatus:
                    "REFUND_INITIATED",

                refundStatus:
                    "REFUND_INITIATED",

                refundAmount:
                    Number(
                        refundAmount
                    ) || 0,
            }
        );
    }

  // COMPLETE REFUND

    async completeRefund(
        documentId
    ) {
        return this.updatePaymentRefund(
            documentId,
            {
                paymentStatus:
                    "REFUNDED",

                refundStatus:
                    "COMPLETED",
            }
        );
    }

  // REFUND NOT REQUIRED

    async markRefundNotRequired(
        documentId
    ) {
        return this.updatePaymentRefund(
            documentId,
            {
                paymentStatus:
                    "NOT_REQUIRED",

                refundStatus:
                    "NOT_REQUIRED",

                refundAmount: 0,
            }
        );
    }

  // REFRESH REQUEST

    async refreshRequest(
        documentId
    ) {
        return this.getRequest(
            documentId
        );
    }
}

  // EXPORT SINGLETON

export default new ReturnExchangeService();