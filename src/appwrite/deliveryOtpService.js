import { Databases, ID, Query } from "appwrite";
import client from "./config";

import shipmentService from "./shipmentService";
import shipmentEventService from "./shipmentEventService";

const databases = new Databases(client);

const DATABASE_ID =
    import.meta.env.VITE_APPWRITE_DATABASE_ID;

const DELIVERY_OTPS_COLLECTION_ID =
    import.meta.env
        .VITE_APPWRITE_DELIVERY_OTPS_COLLECTION_ID;

class DeliveryOtpService {
  // GENERATE 6 DIGIT OTP

    generateOtpCode() {
        return Math.floor(
            100000 +
                Math.random() * 900000
        ).toString();
    }

  // GENERATE OTP

    async generateOtp({
        shipmentId,
        orderId,
        userId,
        trackingId,
    }) {
        try {
            if (!shipmentId) {
                throw new Error(
                    "Shipment ID is required."
                );
            }

            if (!trackingId) {
                throw new Error(
                    "Tracking ID is required."
                );
            }

  // OTP

            const otp =
                this.generateOtpCode();

            const now = new Date();

            const expiresAt =
                new Date(
                    now.getTime() +
                        10 * 60 * 1000
                ).toISOString();

  // CREATE OTP DOCUMENT

            const response =
                await databases.createDocument(
                    DATABASE_ID,
                    DELIVERY_OTPS_COLLECTION_ID,
                    ID.unique(),
                    {
                        shipmentId:
                            String(shipmentId),

                        orderId:
                            String(orderId || ""),

                        userId:
                            String(userId || ""),

                        trackingId:
                            String(trackingId),

                        // Demo only
                        otpHash: otp,

                        expiresAt,

                        attempts: 0,

                        maxAttempts: 3,

                        verified: false,

                        verifiedAt: null,

                        createdAt:
                            now.toISOString(),
                    }
                );

            console.log(
                "Delivery OTP generated:",
                {
                    shipmentId,
                    trackingId,
                    otp,
                    expiresAt,
                }
            );

            return {
                success: true,

                otp,

                expiresAt,

                document: response,
            };
        } catch (error) {
            console.error(
                "Generate OTP Error:",
                error
            );

            return {
                success: false,

                error:
                    error?.message ||
                    "Failed to generate OTP",
            };
        }
    }

  // VERIFY OTP

    async verifyOtp(
        shipmentId,
        otp
    ) {
        try {
            if (!shipmentId) {
                throw new Error(
                    "Shipment ID is required."
                );
            }

            if (!otp) {
                throw new Error(
                    "OTP is required."
                );
            }

  // GET SHIPMENT FIRST

            const shipment =
                await shipmentService.getShipment(
                    shipmentId
                );

            if (!shipment?.$id) {
                return {
                    success: false,

                    message:
                        "Shipment not found.",
                };
            }

  // VERIFY SHIPMENT STATUS

            if (
                String(
                    shipment.status || ""
                ).toUpperCase() !==
                "OUT_FOR_DELIVERY"
            ) {
                return {
                    success: false,

                    message:
                        `OTP can only be verified when shipment is Out for Delivery. Current status: ${shipment.status}`,
                };
            }

  // FIND ACTIVE OTP

            const response =
                await databases.listDocuments(
                    DATABASE_ID,
                    DELIVERY_OTPS_COLLECTION_ID,
                    [
                        Query.equal(
                            "shipmentId",
                            String(shipmentId)
                        ),

                        Query.equal(
                            "verified",
                            false
                        ),

                        Query.orderDesc(
                            "$createdAt"
                        ),

                        Query.limit(1),
                    ]
                );

            if (
                !response.documents.length
            ) {
                return {
                    success: false,

                    message:
                        "No active OTP found.",
                };
            }

            const otpDocument =
                response.documents[0];

  // CHECK MAX ATTEMPTS

            if (
                otpDocument.attempts >=
                otpDocument.maxAttempts
            ) {
                return {
                    success: false,

                    message:
                        "Maximum OTP attempts exceeded.",

                    attempts:
                        otpDocument.attempts,

                    remainingAttempts: 0,
                };
            }

  // CHECK EXPIRY

            if (
                !otpDocument.expiresAt
            ) {
                return {
                    success: false,

                    message:
                        "OTP expiry information is missing.",
                };
            }

            if (
                new Date() >
                new Date(
                    otpDocument.expiresAt
                )
            ) {
                return {
                    success: false,

                    message:
                        "OTP has expired.",
                };
            }

  // CHECK OTP

            if (
                String(
                    otpDocument.otpHash
                ) !== String(otp)
            ) {
                const newAttempts =
                    Number(
                        otpDocument.attempts || 0
                    ) + 1;

                await databases.updateDocument(
                    DATABASE_ID,
                    DELIVERY_OTPS_COLLECTION_ID,
                    otpDocument.$id,
                    {
                        attempts:
                            newAttempts,
                    }
                );

                return {
                    success: false,

                    message:
                        newAttempts >=
                        otpDocument.maxAttempts
                            ? "Maximum OTP attempts exceeded."
                            : "Invalid OTP.",

                    attempts:
                        newAttempts,

                    remainingAttempts:
                        Math.max(
                            0,
                            otpDocument.maxAttempts -
                                newAttempts
                        ),
                };
            }

  // OTP VERIFIED

            const verifiedAt =
                new Date().toISOString();

  // UPDATE SHIPMENT

            const updatedShipment =
                await shipmentService.updateShipment(
                    shipmentId,
                    {
                        status: "DELIVERED",

                        otpRequired: false,

                        otpVerified: true,

                        deliveredAt:
                            verifiedAt,
                    }
                );

            if (!updatedShipment?.$id) {
                return {
                    success: false,

                    message:
                        "OTP was correct, but shipment could not be updated.",
                };
            }

  // MARK OTP AS VERIFIED

            await databases.updateDocument(
                DATABASE_ID,
                DELIVERY_OTPS_COLLECTION_ID,
                otpDocument.$id,
                {
                    verified: true,

                    verifiedAt,
                }
            );

  // CREATE DELIVERED EVENT

            try {
                await shipmentEventService.createEvent(
                    {
                        shipmentId:
                            String(
                                shipmentId
                            ),

                        orderId:
                            String(
                                shipment.orderId ||
                                    otpDocument.orderId ||
                                    ""
                            ),

                        trackingId:
                            String(
                                shipment.trackingId ||
                                    otpDocument.trackingId ||
                                    ""
                            ),

                        status:
                            "DELIVERED",

                        title:
                            "Shipment Delivered",

                        description:
                            "Your shipment has been delivered successfully after OTP verification.",

                        city:
                            String(
                                shipment.destinationCity ||
                                    ""
                            ),

                        state:
                            String(
                                shipment.destinationState ||
                                    ""
                            ),

                        hubName: "",

                        timestamp:
                            verifiedAt,
                    }
                );
            } catch (eventError) {
                console.error(
                    "Delivered event creation failed:",
                    eventError
                );
            }

  // SUCCESS

            return {
                success: true,

                message:
                    "OTP verified successfully. Shipment marked as delivered.",

                verifiedAt,

                shipment:
                    updatedShipment,
            };
        } catch (error) {
            console.error(
                "Verify OTP Error:",
                error
            );

            return {
                success: false,

                error:
                    error?.message ||
                    "Failed to verify OTP",
            };
        }
    }
}

export default new DeliveryOtpService();