import { ID, Query } from "appwrite";
import { databases } from "./config";
import notificationService from "./notificationService";

  // APPWRITE CONFIG

const DATABASE_ID =
    import.meta.env.VITE_APPWRITE_DATABASE_ID ||
    "6a62302900356784577e";

const WALLET_COLLECTION_ID =
    import.meta.env.VITE_WALLET_COLLECTION_ID ||
    "wallets";

const WALLET_TRANSACTIONS_COLLECTION_ID =
    import.meta.env.VITE_WALLET_TRANSACTIONS_COLLECTION_ID ||
    "walletTransactions";

const ORDERS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID ||
    "69b8ebce0018a5c6be94";

const SHIPMENTS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_SHIPMENTS_COLLECTION_ID ||
    "shipments";

  // PROMOTION CONSTANTS

const WELCOME_BONUS = 1000;
const MONTHLY_BONUS = 500;

const WELCOME_VALIDITY_DAYS = 365;
const MONTHLY_VALIDITY_DAYS = 15;

  // HELPERS

const now = () => new Date();

const isoNow = () => new Date().toISOString();

const cleanUserId = (userId) => {
    if (!userId) {
        throw new Error("User ID is required.");
    }

    return String(userId).trim();
};

const addDays = (date, days) => {
    const result = new Date(date);

    result.setDate(result.getDate() + days);

    return result;
};

const getMonthKey = (date = new Date()) => {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}`;
};

const roundMoney = (value) => {
    return Math.round(
        (Number(value) + Number.EPSILON) * 100
    ) / 100;
};

const parseOrderItemsSafe = (itemsRaw) => {
    if (Array.isArray(itemsRaw)) return itemsRaw;
    if (typeof itemsRaw === "string" && itemsRaw.trim()) {
        try {
            const parsed = JSON.parse(itemsRaw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const isOrderItemCancelled = (item) => {
    if (!item || typeof item !== "object") return false;
    const st = String(item.status || "").trim().toUpperCase();
    return Boolean(
        item.isCancelled === true ||
            st === "CANCELLED" ||
            st === "CANCELED"
    );
};

const computeItemSellingTotal = (item) => {
    const price = Number(item?.price || 0);
    const discount = Number(item?.discount || 0);
    const qty = Math.max(1, Number(item?.quantity || 1));
    const sellingUnit =
        discount > 0 ? price - (price * discount) / 100 : price;
    return roundMoney(sellingUnit * qty);
};

  // GET WALLET

const getWallet = async (userId) => {
    const cleanId = cleanUserId(userId);

    const response = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION_ID,
        [
            Query.equal("userId", cleanId),
            Query.limit(1),
        ]
    );

    return response.documents?.[0] || null;
};

  // GET TRANSACTIONS

const getTransactions = async (userId) => {
    const cleanId = cleanUserId(userId);

    const response = await databases.listDocuments(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        [
            Query.equal("userId", cleanId),
            Query.orderDesc("$createdAt"),
            Query.limit(100),
        ]
    );

    return response.documents || [];
};

  // COMPUTE REFUND OFFSET MAP BY DEBIT TRANSACTION ID
  // Matches `source: "refund"` credits against `source: "order"` debits for the same orderId
  // so that refunded order payments restore the user's promotional & wallet credits.

const getEffectiveDebitAmountsMap = async (userId, preloadedTransactions = null) => {
    const cleanId = cleanUserId(userId);
    const allTx = preloadedTransactions || (await getTransactions(cleanId));

    const refundByOrderKey = new Map();
    for (const tx of allTx) {
        if (
            String(tx?.type || "").toLowerCase() === "credit" &&
            String(tx?.source || "").toLowerCase() === "refund"
        ) {
            const key = String(tx?.orderId || "").trim();
            if (!key) continue;
            const prev = refundByOrderKey.get(key) || 0;
            refundByOrderKey.set(key, roundMoney(prev + Number(tx?.amount || 0)));
        }
    }

    // Group order debits by orderId
    const debitsByOrderKey = new Map();
    for (const tx of allTx) {
        if (String(tx?.type || "").toLowerCase() === "debit") {
            const key = String(tx?.orderId || "").trim();
            if (!key) continue;
            if (!debitsByOrderKey.has(key)) {
                debitsByOrderKey.set(key, []);
            }
            debitsByOrderKey.get(key).push(tx);
        }
    }

    const effectiveDebitMap = new Map();
    for (const tx of allTx) {
        if (String(tx?.type || "").toLowerCase() === "debit") {
            effectiveDebitMap.set(tx.$id, roundMoney(Number(tx?.amount || 0)));
        }
    }

    // Apply refund offsets to each order's debits
    for (const [orderKey, debits] of debitsByOrderKey.entries()) {
        let remainingRefundToOffset = roundMoney(refundByOrderKey.get(orderKey) || 0);
        if (remainingRefundToOffset <= 0) continue;

        // Sort debits so user money is restored first, then welcome, then monthly
        const sortedDebits = [...debits].sort((a, b) => {
            const rank = (d) => {
                const pt = String(d?.promotionType || "").toLowerCase();
                if (!pt) return 1;
                if (pt === "welcome") return 2;
                if (pt === "monthly") return 3;
                return 4;
            };
            return rank(a) - rank(b);
        });

        for (const debitTx of sortedDebits) {
            if (remainingRefundToOffset <= 0) break;
            const origAmt = roundMoney(Number(debitTx?.amount || 0));
            const offset = roundMoney(Math.min(origAmt, remainingRefundToOffset));
            effectiveDebitMap.set(debitTx.$id, roundMoney(Math.max(0, origAmt - offset)));
            remainingRefundToOffset = roundMoney(remainingRefundToOffset - offset);
        }
    }

    return {
        effectiveDebitMap,
        allTx,
        refundByOrderKey,
        debitsByOrderKey,
    };
};

  // GET PROMOTIONAL CREDIT TRANSACTIONS

const getPromotionalCredits = async (userId) => {
    const cleanId = cleanUserId(userId);

    const response = await databases.listDocuments(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        [
            Query.equal("userId", cleanId),
            Query.equal("type", "credit"),
            Query.equal("source", "promotion"),
            Query.limit(100),
        ]
    );

    return response.documents || [];
};

  // GET PROMOTION USAGE

const getPromotionUsage = async (
    userId,
    promotionTransactionId,
    preloadedOffsetData = null
) => {
    const cleanId = cleanUserId(userId);

    if (!promotionTransactionId) {
        return 0;
    }

    const offsetData =
        preloadedOffsetData ||
        (await getEffectiveDebitAmountsMap(cleanId));

    const matchingDebits = (offsetData.allTx || []).filter(
        (tx) =>
            String(tx?.type || "").toLowerCase() === "debit" &&
            String(tx?.referenceTransactionId || "") ===
                String(promotionTransactionId) &&
            String(tx?.promotionType || "").toLowerCase() !== "expired"
    );

    return roundMoney(
        matchingDebits.reduce((total, tx) => {
            const effectiveAmt = offsetData.effectiveDebitMap.has(tx.$id)
                ? offsetData.effectiveDebitMap.get(tx.$id)
                : Number(tx?.amount || 0);
            return total + Number(effectiveAmt || 0);
        }, 0)
    );
};

  // CREATE WALLET WITH ₹1000 WELCOME PROMOTION

const createWallet = async (userId) => {
    const cleanId = cleanUserId(userId);

    // Check existing wallet
    const existingWallet = await getWallet(cleanId);

    if (existingWallet) {
        return existingWallet;
    }

    const createdAt = now();

    const welcomeExpiresAt = addDays(
        createdAt,
        WELCOME_VALIDITY_DAYS
    );

  // CREATE WALLET

    const wallet = await databases.createDocument(
        DATABASE_ID,
        WALLET_COLLECTION_ID,
        ID.unique(),
        {
            userId: cleanId,

            balance: WELCOME_BONUS,

            promotionalBalance: WELCOME_BONUS,

            totalAdded: 0,

            totalSpent: 0,

            createdAt:
                createdAt.toISOString(),

            updatedAt:
                createdAt.toISOString(),
        }
    );

  // WELCOME PROMOTION TRANSACTION

    await databases.createDocument(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        ID.unique(),
        {
            userId: cleanId,

            type: "credit",

            amount: WELCOME_BONUS,

            balanceBefore: 0,

            balanceAfter: WELCOME_BONUS,

            description:
                "Welcome Promotion",

            source: "promotion",

            promotionType: "welcome",

            expiresAt:
                welcomeExpiresAt.toISOString(),

            orderId: "",

            transactionId:
                `WELCOME-${Date.now()}`,

            referenceTransactionId: "",

            createdAt:
                createdAt.toISOString(),
        }
    );

    return wallet;
};

  // APPLY MONTHLY ₹500 PROMOTION

const applyMonthlyPromotion = async (
    userId,
    wallet
) => {
    const cleanId = cleanUserId(userId);

    if (!wallet) {
        return wallet;
    }

    const currentMonth = getMonthKey();

    const existingTransactions =
        await databases.listDocuments(
            DATABASE_ID,
            WALLET_TRANSACTIONS_COLLECTION_ID,
            [
                Query.equal(
                    "userId",
                    cleanId
                ),

                Query.equal(
                    "promotionType",
                    "monthly"
                ),

                Query.equal(
                    "type",
                    "credit"
                ),

                Query.limit(100),
            ]
        );

    const alreadyReceived =
        existingTransactions.documents?.some(
            (transaction) => {
                const transactionDate =
                    new Date(
                        transaction.createdAt ||
                        transaction.$createdAt
                    );

                return (
                    getMonthKey(
                        transactionDate
                    ) === currentMonth
                );
            }
        );

    if (alreadyReceived) {
        return wallet;
    }

  // MONTHLY PROMOTION

    const createdAt = now();

    const expiresAt = addDays(
        createdAt,
        MONTHLY_VALIDITY_DAYS
    );

    const balanceBefore = roundMoney(
        wallet.balance || 0
    );

    const promotionalBalanceBefore =
        roundMoney(
            wallet.promotionalBalance || 0
        );

    const balanceAfter = roundMoney(
        balanceBefore + MONTHLY_BONUS
    );

    const promotionalBalanceAfter =
        roundMoney(
            promotionalBalanceBefore +
            MONTHLY_BONUS
        );

    const updatedWallet =
        await databases.updateDocument(
            DATABASE_ID,
            WALLET_COLLECTION_ID,
            wallet.$id,
            {
                balance: balanceAfter,

                promotionalBalance:
                    promotionalBalanceAfter,

                updatedAt:
                    createdAt.toISOString(),
            }
        );

  // MONTHLY TRANSACTION

    await databases.createDocument(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        ID.unique(),
        {
            userId: cleanId,

            type: "credit",

            amount: MONTHLY_BONUS,

            balanceBefore,

            balanceAfter,

            description:
                "Monthly Promotion",

            source: "promotion",

            promotionType: "monthly",

            expiresAt:
                expiresAt.toISOString(),

            orderId: "",

            transactionId:
                `MONTHLY-${currentMonth}-${Date.now()}`,

            referenceTransactionId: "",

            createdAt:
                createdAt.toISOString(),
        }
    );

    return updatedWallet;
};

  // EXPIRE PROMOTIONS

const expirePromotions = async (
    userId,
    wallet
) => {
    const cleanId = cleanUserId(userId);

    if (!wallet) {
        return wallet;
    }

    const currentTime = now();

    const promotionalCredits =
        await getPromotionalCredits(cleanId);

    const offsetData =
        await getEffectiveDebitAmountsMap(cleanId);

    let currentWallet = wallet;

    for (const credit of promotionalCredits) {
        if (!credit.expiresAt) {
            continue;
        }

        const expiresAt =
            new Date(credit.expiresAt);

        if (
            expiresAt > currentTime
        ) {
            continue;
        }

        const originalAmount =
            roundMoney(
                credit.amount || 0
            );

        if (originalAmount <= 0) {
            continue;
        }

  // CHECK IF THIS PROMOTION WAS ALREADY EXPIRED

        const expiryTransactions =
            await databases.listDocuments(
                DATABASE_ID,
                WALLET_TRANSACTIONS_COLLECTION_ID,
                [
                    Query.equal(
                        "userId",
                        cleanId
                    ),

                    Query.equal(
                        "referenceTransactionId",
                        credit.$id
                    ),

                    Query.equal(
                        "promotionType",
                        "expired"
                    ),

                    Query.equal(
                        "type",
                        "debit"
                    ),

                    Query.limit(10),
                ]
            );

        if (
            expiryTransactions.documents?.length
        ) {
            continue;
        }

  // FIND HOW MUCH OF THIS PROMOTION WAS USED

        const usedAmount =
            await getPromotionUsage(
                cleanId,
                credit.$id,
                offsetData
            );

        const remainingPromotion =
            roundMoney(
                Math.max(
                    0,
                    originalAmount -
                    usedAmount
                )
            );

        // Nothing left to expire
        if (remainingPromotion <= 0) {
            continue;
        }

        const currentBalance =
            roundMoney(
                currentWallet.balance || 0
            );

        const currentPromotionalBalance =
            roundMoney(
                currentWallet.promotionalBalance ||
                0
            );

        const amountToRemove =
            roundMoney(
                Math.min(
                    remainingPromotion,
                    currentBalance,
                    currentPromotionalBalance
                )
            );

        if (amountToRemove <= 0) {
            continue;
        }

        const newBalance =
            roundMoney(
                currentBalance -
                amountToRemove
            );

        const newPromotionalBalance =
            roundMoney(
                Math.max(
                    0,
                    currentPromotionalBalance -
                    amountToRemove
                )
            );

  // UPDATE WALLET

        currentWallet =
            await databases.updateDocument(
                DATABASE_ID,
                WALLET_COLLECTION_ID,
                currentWallet.$id,
                {
                    balance: newBalance,

                    promotionalBalance:
                        newPromotionalBalance,

                    updatedAt:
                        isoNow(),
                }
            );

  // EXPIRY TRANSACTION

        await databases.createDocument(
            DATABASE_ID,
            WALLET_TRANSACTIONS_COLLECTION_ID,
            ID.unique(),
            {
                userId: cleanId,

                type: "debit",

                amount: amountToRemove,

                balanceBefore:
                    currentBalance,

                balanceAfter:
                    newBalance,

                description:
                    `${
                        credit.promotionType ===
                        "monthly"
                            ? "Monthly Promotion"
                            : "Welcome Promotion"
                    } Expired`,

                source:
                    "promotion_expiry",

                promotionType:
                    "expired",

                expiresAt:
                    credit.expiresAt,

                orderId: "",

                transactionId:
                    `EXPIRY-${Date.now()}-${credit.$id}`,

                referenceTransactionId:
                    credit.$id,

                createdAt:
                    isoNow(),
            }
        );
    }

    return currentWallet;
};

  // GET USER MONEY CREDIT TRANSACTIONS

const getUserMoneyCredits = async (
    userId
) => {
    const cleanId = cleanUserId(userId);

    const response =
        await databases.listDocuments(
            DATABASE_ID,
            WALLET_TRANSACTIONS_COLLECTION_ID,
            [
                Query.equal(
                    "userId",
                    cleanId
                ),

                Query.equal(
                    "type",
                    "credit"
                ),

                Query.limit(100),
            ]
        );

    return (
        response.documents || []
    ).filter(
        (transaction) =>
            transaction.source ===
            "wallet_add"
    );
};

  // GET USER MONEY USED

const getUserMoneyUsage = async (
    userId,
    creditId,
    preloadedOffsetData = null
) => {
    const cleanId = cleanUserId(userId);

    if (!creditId) {
        return 0;
    }

    const offsetData =
        preloadedOffsetData ||
        (await getEffectiveDebitAmountsMap(cleanId));

    const matchingDebits = (offsetData.allTx || []).filter(
        (tx) =>
            String(tx?.type || "").toLowerCase() === "debit" &&
            String(tx?.referenceTransactionId || "") ===
                String(creditId)
    );

    return roundMoney(
        matchingDebits.reduce((total, tx) => {
            const effectiveAmt = offsetData.effectiveDebitMap.has(tx.$id)
                ? offsetData.effectiveDebitMap.get(tx.$id)
                : Number(tx?.amount || 0);
            return total + Number(effectiveAmt || 0);
        }, 0)
    );
};

  // GET AVAILABLE PROMOTION CREDITS

const getAvailablePromotionCredits = async (
    userId,
    preloadedOffsetData = null
) => {
    const cleanId = cleanUserId(userId);

    const credits =
        await getPromotionalCredits(
            cleanId
        );

    const offsetData =
        preloadedOffsetData ||
        (await getEffectiveDebitAmountsMap(cleanId));

    const available = [];

    for (const credit of credits) {
        const originalAmount =
            roundMoney(
                credit.amount || 0
            );

        if (originalAmount <= 0) {
            continue;
        }

        if (
            credit.expiresAt &&
            new Date(
                credit.expiresAt
            ) <= now()
        ) {
            continue;
        }

        const usedAmount =
            await getPromotionUsage(
                cleanId,
                credit.$id,
                offsetData
            );

        const remaining =
            roundMoney(
                Math.max(
                    0,
                    originalAmount -
                    usedAmount
                )
            );

        if (remaining <= 0) {
            continue;
        }

        available.push({
            ...credit,
            remainingAmount:
                remaining,
        });
    }

    const monthlyCredits = available.filter(
        (c) => String(c.promotionType || "").toLowerCase() === "monthly"
    );
    const welcomeCredits = available.filter(
        (c) => String(c.promotionType || "").toLowerCase() === "welcome"
    );

    available.monthly = roundMoney(
        monthlyCredits.reduce(
            (sum, c) => sum + Number(c.remainingAmount || 0),
            0
        )
    );
    available.welcome = roundMoney(
        welcomeCredits.reduce(
            (sum, c) => sum + Number(c.remainingAmount || 0),
            0
        )
    );
    available.monthlyExpiry = monthlyCredits[0]?.expiresAt || null;
    available.welcomeExpiry = welcomeCredits[0]?.expiresAt || null;

    return available;
};

  // GET AVAILABLE USER MONEY

const getAvailableUserMoney = async (
    userId,
    preloadedOffsetData = null
) => {
    const cleanId = cleanUserId(userId);

    const credits =
        await getUserMoneyCredits(
            cleanId
        );

    const offsetData =
        preloadedOffsetData ||
        (await getEffectiveDebitAmountsMap(cleanId));

    let totalAvailable = 0;

    for (const credit of credits) {
        const originalAmount =
            roundMoney(
                credit.amount || 0
            );

        if (originalAmount <= 0) {
            continue;
        }

        const usedAmount =
            await getUserMoneyUsage(
                cleanId,
                credit.$id,
                offsetData
            );

        const remaining =
            roundMoney(
                Math.max(
                    0,
                    originalAmount -
                    usedAmount
                )
            );

        totalAvailable =
            roundMoney(
                totalAvailable +
                remaining
            );
    }

    // Also include any standalone refund credits that exceeded recorded debits for their orderId
    for (const [orderKey, refundTotal] of offsetData.refundByOrderKey.entries()) {
        const orderDebits = offsetData.debitsByOrderKey.get(orderKey) || [];
        const debitsSum = roundMoney(
            orderDebits.reduce((s, d) => s + Number(d?.amount || 0), 0)
        );
        const excessRefund = roundMoney(Math.max(0, refundTotal - debitsSum));
        if (excessRefund > 0) {
            totalAvailable = roundMoney(totalAvailable + excessRefund);
        }
    }

    return totalAvailable;
};

  // RECONCILE WALLET BALANCE WITH ACTUAL CREDITS & REFUNDED DEBITS

const reconcileWalletState = async (userId, walletDoc = null) => {
    const cleanId = cleanUserId(userId);
    let wallet = walletDoc || (await getWallet(cleanId));
    if (!wallet) return null;

    const offsetData = await getEffectiveDebitAmountsMap(cleanId);
    const promoCredits = await getAvailablePromotionCredits(cleanId, offsetData);
    const userMoney = await getAvailableUserMoney(cleanId, offsetData);

    const expectedPromotionalBalance = roundMoney(
        Number(promoCredits.monthly || 0) + Number(promoCredits.welcome || 0)
    );
    const expectedBalance = roundMoney(expectedPromotionalBalance + userMoney);

    let expectedTotalSpent = 0;
    for (const tx of offsetData.allTx || []) {
        if (
            String(tx?.type || "").toLowerCase() === "debit" &&
            String(tx?.promotionType || "").toLowerCase() !== "expired"
        ) {
            const eff = offsetData.effectiveDebitMap.has(tx.$id)
                ? offsetData.effectiveDebitMap.get(tx.$id)
                : Number(tx?.amount || 0);
            expectedTotalSpent = roundMoney(expectedTotalSpent + Number(eff || 0));
        }
    }

    const currentBalance = roundMoney(wallet.balance || 0);
    const currentPromo = roundMoney(wallet.promotionalBalance || 0);
    const currentSpent = roundMoney(wallet.totalSpent || 0);

    if (
        currentBalance !== expectedBalance ||
        currentPromo !== expectedPromotionalBalance ||
        currentSpent !== expectedTotalSpent
    ) {
        try {
            wallet = await databases.updateDocument(
                DATABASE_ID,
                WALLET_COLLECTION_ID,
                wallet.$id,
                {
                    balance: expectedBalance,
                    promotionalBalance: expectedPromotionalBalance,
                    totalSpent: expectedTotalSpent,
                    updatedAt: isoNow(),
                }
            );
        } catch (err) {
            console.warn("Wallet state reconciliation warning:", err);
        }
    }

    return wallet;
};

  // REFUND ORDER WALLET (IDEMPOTENT FOR FULL OR PARTIAL CANCELLATION)

const refundOrderWallet = async (orderOrId, options = {}) => {
    try {
        let order =
            orderOrId && typeof orderOrId === "object" ? orderOrId : null;

        if (!order && orderOrId) {
            const cleanRef = String(orderOrId).trim();
            if (/^ORD/i.test(cleanRef)) {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    ORDERS_COLLECTION_ID,
                    [Query.equal("orderId", cleanRef), Query.limit(1)]
                );
                order = res?.documents?.[0] || null;
            } else {
                try {
                    order = await databases.getDocument(
                        DATABASE_ID,
                        ORDERS_COLLECTION_ID,
                        cleanRef
                    );
                } catch {
                    const res = await databases.listDocuments(
                        DATABASE_ID,
                        ORDERS_COLLECTION_ID,
                        [Query.equal("orderId", cleanRef), Query.limit(1)]
                    );
                    order = res?.documents?.[0] || null;
                }
            }
        }

        if (!order) {
            return { refunded: false, amount: 0 };
        }

        const userId = String(order.userId || options.userId || "").trim();
        if (!userId) {
            return { refunded: false, amount: 0 };
        }

        const orderIdStr = String(order.orderId || order.$id || "").trim();
        const orderDocIdStr = String(order.$id || "").trim();
        const matchKeys = new Set(
            [orderIdStr, orderDocIdStr].filter(Boolean)
        );

        let wallet = await getWallet(userId);
        if (!wallet) {
            wallet = await createWallet(userId);
        }

        const allTx = await getTransactions(userId);

        // Find all order debits for this order
        const orderDebits = allTx.filter(
            (tx) =>
                String(tx?.type || "").toLowerCase() === "debit" &&
                matchKeys.has(String(tx?.orderId || "").trim())
        );

        const debitsTotal = roundMoney(
            orderDebits.reduce((sum, tx) => sum + Number(tx?.amount || 0), 0)
        );

        // Find all existing refund credits for this order
        const existingRefunds = allTx.filter(
            (tx) =>
                String(tx?.type || "").toLowerCase() === "credit" &&
                String(tx?.source || "").toLowerCase() === "refund" &&
                matchKeys.has(String(tx?.orderId || "").trim())
        );

        const alreadyRefunded = roundMoney(
            existingRefunds.reduce(
                (sum, tx) => sum + Number(tx?.amount || 0),
                0
            )
        );

        const storedWalletPaid = roundMoney(Number(order.walletPaid || 0));
        const totalWalletPaidForOrder = roundMoney(
            Math.max(storedWalletPaid, debitsTotal)
        );

        if (totalWalletPaidForOrder <= 0) {
            return { refunded: false, amount: 0, alreadyRefunded };
        }

        // Determine if order is fully or partially cancelled
        const items = parseOrderItemsSafe(order.items);
        const cancelledItems = items.filter(isOrderItemCancelled);
        const orderStatusUpper = String(order.status || "")
            .trim()
            .toUpperCase();

        const isFullOrderCancelled =
            Boolean(options.fullOrder) ||
            orderStatusUpper === "CANCELLED" ||
            orderStatusUpper === "CANCELED" ||
            (items.length > 0 && cancelledItems.length === items.length);

        let targetWalletRefund = 0;

        if (Number(options.refundAmount) > 0) {
            targetWalletRefund = roundMoney(
                Math.min(
                    totalWalletPaidForOrder,
                    alreadyRefunded + Number(options.refundAmount)
                )
            );
        } else if (isFullOrderCancelled) {
            targetWalletRefund = totalWalletPaidForOrder;
        } else if (cancelledItems.length > 0) {
            const cancelledSellingSum = roundMoney(
                cancelledItems.reduce(
                    (sum, item) => sum + computeItemSellingTotal(item),
                    0
                )
            );
            targetWalletRefund = roundMoney(
                Math.min(totalWalletPaidForOrder, cancelledSellingSum)
            );
        }

        const amountToRefundNow = roundMoney(
            Math.max(0, targetWalletRefund - alreadyRefunded)
        );

        if (amountToRefundNow <= 0) {
            return {
                refunded: false,
                amount: 0,
                alreadyRefunded,
                totalRefunded: alreadyRefunded,
            };
        }

        const canonicalOrderKey =
            orderDebits[0]?.orderId || orderIdStr || orderDocIdStr;

        // If this order had walletPaid > 0 on the order document, but deductMoney was never recorded
        // in walletTransactions (debitsTotal === 0), record the order debit first so the ledger
        // has the matching debit + refund credit pair without double-counting the wallet balance.
        if (debitsTotal <= 0 && storedWalletPaid > 0) {
            const currentBal = roundMoney(wallet.balance || 0);
            const afterDebitBal = roundMoney(
                Math.max(0, currentBal - amountToRefundNow)
            );
            await databases.createDocument(
                DATABASE_ID,
                WALLET_TRANSACTIONS_COLLECTION_ID,
                ID.unique(),
                {
                    userId,
                    type: "debit",
                    amount: amountToRefundNow,
                    balanceBefore: currentBal,
                    balanceAfter: afterDebitBal,
                    description: `Wallet Payment for Order #${canonicalOrderKey}`,
                    source: "order",
                    promotionType:
                        Number(order.walletWelcomePromotionUsed || 0) >=
                        amountToRefundNow
                            ? "welcome"
                            : Number(order.walletMonthlyPromotionUsed || 0) > 0
                            ? "monthly"
                            : "welcome",
                    expiresAt: "",
                    orderId: canonicalOrderKey,
                    transactionId: `ORDER-DEBIT-${canonicalOrderKey}`,
                    referenceTransactionId: "",
                    createdAt: order.orderDate || order.$createdAt || isoNow(),
                }
            );
        }

        const balanceBeforeRefund =
            debitsTotal <= 0
                ? roundMoney(
                      Math.max(0, Number(wallet.balance || 0) - amountToRefundNow)
                  )
                : roundMoney(wallet.balance || 0);

        const balanceAfterRefund = roundMoney(
            balanceBeforeRefund + amountToRefundNow
        );

        const refundDescription =
            options.description ||
            `₹${amountToRefundNow.toFixed(2)} Credited to Wallet — Refund for Cancelled Order #${canonicalOrderKey}`;

        await databases.createDocument(
            DATABASE_ID,
            WALLET_TRANSACTIONS_COLLECTION_ID,
            ID.unique(),
            {
                userId,
                type: "credit",
                amount: amountToRefundNow,
                balanceBefore: balanceBeforeRefund,
                balanceAfter: balanceAfterRefund,
                description: refundDescription,
                source: "refund",
                promotionType: "",
                expiresAt: "",
                orderId: canonicalOrderKey,
                transactionId: `REFUND-${canonicalOrderKey}-${Date.now()}`,
                referenceTransactionId: orderDebits[0]?.$id || "",
                createdAt: isoNow(),
            }
        );

        wallet = await reconcileWalletState(userId, wallet);

        // Send customer notification confirming wallet refund credit
        try {
            await notificationService.createUserNotification({
                userId,
                type: "WALLET_REFUND",
                title: `₹${amountToRefundNow.toFixed(0)} Credited to Wallet 💰`,
                message: `₹${amountToRefundNow.toFixed(2)} has been refunded and credited back to your TechStore Wallet for cancelled Order #${canonicalOrderKey}. Available Wallet Balance: ₹${roundMoney(wallet?.balance || balanceAfterRefund).toFixed(2)}.`,
                orderId: canonicalOrderKey,
                shipmentId: String(options.shipmentId || ""),
                trackingId: String(options.trackingId || ""),
            });
        } catch (notifErr) {
            console.warn("Wallet refund notification warning:", notifErr);
        }

        return {
            refunded: true,
            amount: amountToRefundNow,
            totalRefunded: roundMoney(alreadyRefunded + amountToRefundNow),
            wallet,
        };
    } catch (error) {
        console.error("refundOrderWallet error:", error);
        return { refunded: false, amount: 0, error: error?.message };
    }
};

  // AUTOMATICALLY SYNC REFUNDS FOR ANY CANCELLED ORDERS OF USER

const syncCancelledOrderRefunds = async (userId) => {
    try {
        const cleanId = cleanUserId(userId);

        const [ordersRes, shipmentsRes] = await Promise.all([
            databases
                .listDocuments(DATABASE_ID, ORDERS_COLLECTION_ID, [
                    Query.equal("userId", cleanId),
                    Query.orderDesc("$createdAt"),
                    Query.limit(100),
                ])
                .catch(() => ({ documents: [] })),
            databases
                .listDocuments(DATABASE_ID, SHIPMENTS_COLLECTION_ID, [
                    Query.equal("userId", cleanId),
                    Query.limit(100),
                ])
                .catch(() => ({ documents: [] })),
        ]);

        const orders = ordersRes?.documents || [];
        const shipments = shipmentsRes?.documents || [];

        const cancelledShipmentOrderIds = new Set();
        for (const sh of shipments) {
            const st = String(sh?.status || "").trim().toUpperCase();
            if (st === "CANCELLED" || st === "CANCELED") {
                if (sh.orderId) {
                    cancelledShipmentOrderIds.add(String(sh.orderId).trim());
                }
            }
        }

        for (const order of orders) {
            const orderIdStr = String(order.orderId || "").trim();
            const docIdStr = String(order.$id || "").trim();
            const statusUpper = String(order.status || "").trim().toUpperCase();
            const isShipmentCancelled =
                cancelledShipmentOrderIds.has(orderIdStr) ||
                cancelledShipmentOrderIds.has(docIdStr);

            const items = parseOrderItemsSafe(order.items);
            const hasCancelledItem = items.some(isOrderItemCancelled);

            if (
                statusUpper === "CANCELLED" ||
                statusUpper === "CANCELED" ||
                isShipmentCancelled ||
                hasCancelledItem
            ) {
                await refundOrderWallet(order, {
                    userId: cleanId,
                    fullOrder:
                        statusUpper === "CANCELLED" ||
                        statusUpper === "CANCELED" ||
                        isShipmentCancelled,
                });
            }
        }
    } catch (err) {
        console.warn("syncCancelledOrderRefunds warning:", err);
    }
};

  // GET OR CREATE WALLET

const getOrCreateWallet = async (userId) => {
    const cleanId = cleanUserId(userId);

    let wallet = await getWallet(cleanId);

    if (!wallet) {
        wallet = await createWallet(
            cleanId
        );
    }

  // FIRST EXPIRE OLD PROMOTIONS

    wallet = await expirePromotions(
        cleanId,
        wallet
    );

  // THEN GIVE CURRENT MONTH PROMOTION

    wallet = await applyMonthlyPromotion(
        cleanId,
        wallet
    );

  // SYNC ANY CANCELLED ORDER WALLET REFUNDS & RECONCILE

    await syncCancelledOrderRefunds(cleanId);

    wallet = await reconcileWalletState(cleanId, wallet);

    return wallet;
};

  // CALCULATE WALLET USAGE
//
// Priority:
//
// 1. Monthly Promotion
// 2. Welcome Promotion
// 3. User Added Money
//
// ============================================================

const calculateWalletUsage = async (
    userId,
    requestedAmount
) => {
    const cleanId = cleanUserId(userId);

    const amount =
        roundMoney(requestedAmount);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return {
            requestedAmount: 0,
            monthlyPromotion: 0,
            welcomePromotion: 0,
            userMoney: 0,
            total: 0,
        };
    }

    const wallet =
        await getOrCreateWallet(
            cleanId
        );

    if (!wallet) {
        return {
            requestedAmount: amount,
            monthlyPromotion: 0,
            welcomePromotion: 0,
            userMoney: 0,
            total: 0,
        };
    }

    let remaining = amount;

    let monthlyPromotion = 0;
    let welcomePromotion = 0;
    let userMoney = 0;

    const offsetData =
        await getEffectiveDebitAmountsMap(cleanId);

  // 1. MONTHLY PROMOTION

    const promotionCredits =
        await getAvailablePromotionCredits(
            cleanId,
            offsetData
        );

    const monthlyCredits =
        promotionCredits
            .filter(
                (credit) =>
                    credit.promotionType ===
                    "monthly"
            )
            .sort(
                (a, b) =>
                    new Date(a.createdAt) -
                    new Date(b.createdAt)
            );

    for (const credit of monthlyCredits) {
        if (remaining <= 0) {
            break;
        }

        const useAmount =
            roundMoney(
                Math.min(
                    remaining,
                    credit.remainingAmount
                )
            );

        monthlyPromotion =
            roundMoney(
                monthlyPromotion +
                useAmount
            );

        remaining =
            roundMoney(
                remaining -
                useAmount
            );
    }

  // 2. WELCOME PROMOTION

    if (remaining > 0) {
        const welcomeCredits =
            promotionCredits
                .filter(
                    (credit) =>
                        credit.promotionType ===
                        "welcome"
                )
                .sort(
                    (a, b) =>
                        new Date(a.createdAt) -
                        new Date(b.createdAt)
                );

        for (
            const credit of welcomeCredits
        ) {
            if (remaining <= 0) {
                break;
            }

            const useAmount =
                roundMoney(
                    Math.min(
                        remaining,
                        credit.remainingAmount
                    )
                );

            welcomePromotion =
                roundMoney(
                    welcomePromotion +
                    useAmount
                );

            remaining =
                roundMoney(
                    remaining -
                    useAmount
                );
        }
    }

  // 3. USER ADDED MONEY

    if (remaining > 0) {
        const availableUserMoney =
            await getAvailableUserMoney(
                cleanId,
                offsetData
            );

        userMoney =
            roundMoney(
                Math.min(
                    remaining,
                    availableUserMoney
                )
            );

    }

    return {
        requestedAmount: amount,

        monthlyPromotion,

        welcomePromotion,

        userMoney,

        total: roundMoney(
            monthlyPromotion +
            welcomePromotion +
            userMoney
        ),
    };
};

  // DEDUCT MONEY FROM WALLET

const deductMoney = async (
    userId,
    amount,
    options = {}
) => {
    const cleanId = cleanUserId(userId);

    const numericAmount =
        roundMoney(amount);

    if (
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {
        throw new Error(
            "Invalid wallet amount."
        );
    }

    let wallet =
        await getOrCreateWallet(
            cleanId
        );

    if (!wallet) {
        throw new Error(
            "Wallet not found."
        );
    }

    // IDEMPOTENCY CHECK: Avoid double-deducting for the same orderId
    if (options.orderId) {
        const existingOrderDebits = await databases.listDocuments(
            DATABASE_ID,
            WALLET_TRANSACTIONS_COLLECTION_ID,
            [
                Query.equal("userId", cleanId),
                Query.equal("type", "debit"),
                Query.equal("orderId", String(options.orderId).trim()),
                Query.limit(20),
            ]
        );
        const alreadyDeducted = roundMoney(
            (existingOrderDebits.documents || []).reduce(
                (s, d) => s + Number(d?.amount || 0),
                0
            )
        );
        if (alreadyDeducted >= numericAmount) {
            return {
                wallet,
                amount: numericAmount,
                monthlyPromotion: 0,
                welcomePromotion: 0,
                userMoney: 0,
                total: numericAmount,
                transactionId:
                    existingOrderDebits.documents?.[0]?.transactionId ||
                    options.transactionId ||
                    `PAY-${Date.now()}`,
            };
        }
    }

    const currentBalance =
        roundMoney(
            wallet.balance || 0
        );

    if (
        numericAmount >
        currentBalance
    ) {
        throw new Error(
            "Insufficient wallet balance."
        );
    }

  // CALCULATE PRIORITY USAGE

    const usage =
        await calculateWalletUsage(
            cleanId,
            numericAmount
        );

    if (
        usage.total <
        numericAmount
    ) {
        throw new Error(
            "Insufficient wallet balance."
        );
    }

    const balanceBefore =
        currentBalance;

    let runningBalance =
        balanceBefore;

    let runningPromotionalBalance =
        roundMoney(
            wallet.promotionalBalance || 0
        );

    const transactionId =
        options.transactionId ||
        `PAY-${Date.now()}`;

    const createdAt =
        isoNow();

  // HELPER: CREATE DEBIT

    const createDebit =
        async ({
            amount: debitAmount,
            description,
            promotionType,
            referenceTransactionId,
        }) => {
            if (
                debitAmount <= 0
            ) {
                return;
            }

            const before =
                runningBalance;

            runningBalance =
                roundMoney(
                    runningBalance -
                    debitAmount
                );

            if (
                promotionType ===
                    "monthly" ||
                promotionType ===
                    "welcome"
            ) {
                runningPromotionalBalance =
                    roundMoney(
                        Math.max(
                            0,
                            runningPromotionalBalance -
                            debitAmount
                        )
                    );
            }

            await databases.createDocument(
                DATABASE_ID,
                WALLET_TRANSACTIONS_COLLECTION_ID,
                ID.unique(),
                {
                    userId: cleanId,

                    type: "debit",

                    amount:
                        debitAmount,

                    balanceBefore:
                        before,

                    balanceAfter:
                        runningBalance,

                    description,

                    source:
                        options.source ||
                        "order",

                    promotionType:
                        promotionType ||
                        "",

                    expiresAt: "",

                    orderId:
                        options.orderId ||
                        "",

                    transactionId,

                    referenceTransactionId:
                        referenceTransactionId ||
                        "",

                    createdAt,
                }
            );
        };

  // MONTHLY PROMOTION

    let remainingMonthly =
        usage.monthlyPromotion;

    if (
        remainingMonthly > 0
    ) {
        const monthlyCredits =
            (
                await getAvailablePromotionCredits(
                    cleanId
                )
            )
                .filter(
                    (credit) =>
                        credit.promotionType ===
                        "monthly"
                )
                .sort(
                    (a, b) =>
                        new Date(
                            a.createdAt
                        ) -
                        new Date(
                            b.createdAt
                        )
                );

        for (
            const credit of monthlyCredits
        ) {
            if (
                remainingMonthly <=
                0
            ) {
                break;
            }

            const debitAmount =
                roundMoney(
                    Math.min(
                        remainingMonthly,
                        credit.remainingAmount
                    )
                );

            if (
                debitAmount <= 0
            ) {
                continue;
            }

            await createDebit({
                amount:
                    debitAmount,

                description:
                    "Wallet Payment - Monthly Promotion",

                promotionType:
                    "monthly",

                referenceTransactionId:
                    credit.$id,
            });

            remainingMonthly =
                roundMoney(
                    remainingMonthly -
                    debitAmount
                );
        }
    }

  // WELCOME PROMOTION

    let remainingWelcome =
        usage.welcomePromotion;

    if (
        remainingWelcome > 0
    ) {
        const welcomeCredits =
            (
                await getAvailablePromotionCredits(
                    cleanId
                )
            )
                .filter(
                    (credit) =>
                        credit.promotionType ===
                        "welcome"
                )
                .sort(
                    (a, b) =>
                        new Date(
                            a.createdAt
                        ) -
                        new Date(
                            b.createdAt
                        )
                );

        for (
            const credit of welcomeCredits
        ) {
            if (
                remainingWelcome <=
                0
            ) {
                break;
            }

            const debitAmount =
                roundMoney(
                    Math.min(
                        remainingWelcome,
                        credit.remainingAmount
                    )
                );

            if (
                debitAmount <= 0
            ) {
                continue;
            }

            await createDebit({
                amount:
                    debitAmount,

                description:
                    "Wallet Payment - Welcome Promotion",

                promotionType:
                    "welcome",

                referenceTransactionId:
                    credit.$id,
            });

            remainingWelcome =
                roundMoney(
                    remainingWelcome -
                    debitAmount
                );
        }
    }

  // USER MONEY

    let remainingUserMoney =
        usage.userMoney;

    if (
        remainingUserMoney > 0
    ) {
        const userCredits =
            (
                await getUserMoneyCredits(
                    cleanId
                )
            ).sort(
                (a, b) =>
                    new Date(
                        a.createdAt
                    ) -
                    new Date(
                        b.createdAt
                    )
            );

        for (
            const credit of userCredits
        ) {
            if (
                remainingUserMoney <=
                0
            ) {
                break;
            }

            const usedAmount =
                await getUserMoneyUsage(
                    cleanId,
                    credit.$id
                );

            const availableAmount =
                roundMoney(
                    Math.max(
                        0,
                        Number(
                            credit.amount ||
                            0
                        ) -
                        usedAmount
                    )
                );

            if (
                availableAmount <=
                0
            ) {
                continue;
            }

            const debitAmount =
                roundMoney(
                    Math.min(
                        remainingUserMoney,
                        availableAmount
                    )
                );

            await createDebit({
                amount:
                    debitAmount,

                description:
                    "Wallet Payment - Wallet Balance",

                promotionType:
                    "",

                referenceTransactionId:
                    credit.$id,
            });

            remainingUserMoney =
                roundMoney(
                    remainingUserMoney -
                    debitAmount
                );
        }
    }

  // FINAL VALIDATION

    const actualDeducted =
        roundMoney(
            balanceBefore -
            runningBalance
        );

    if (
        actualDeducted !==
        numericAmount
    ) {
        throw new Error(
            "Wallet deduction could not be completed."
        );
    }

  // UPDATE WALLET

    wallet =
        await databases.updateDocument(
            DATABASE_ID,
            WALLET_COLLECTION_ID,
            wallet.$id,
            {
                balance:
                    runningBalance,

                promotionalBalance:
                    runningPromotionalBalance,

                totalSpent:
                    roundMoney(
                        Number(
                            wallet.totalSpent ||
                            0
                        ) +
                        numericAmount
                    ),

                updatedAt:
                    createdAt,
            }
        );

    return {
        wallet,

        amount:
            numericAmount,

        monthlyPromotion:
            usage.monthlyPromotion,

        welcomePromotion:
            usage.welcomePromotion,

        userMoney:
            usage.userMoney,

        total:
            numericAmount,

        transactionId,
    };
};

  // ADD USER MONEY
//
// IMPORTANT:
// This function should only be called AFTER your payment
// gateway confirms the wallet top-up successfully.
// ============================================================

const addMoney = async (
    userId,
    amount,
    options = {}
) => {
    const cleanId = cleanUserId(userId);

    const numericAmount =
        roundMoney(amount);

    if (
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {
        throw new Error(
            "Invalid wallet amount."
        );
    }

    const wallet =
        await getOrCreateWallet(
            cleanId
        );

    const balanceBefore =
        roundMoney(
            wallet.balance || 0
        );

    const balanceAfter =
        roundMoney(
            balanceBefore +
            numericAmount
        );

    const isRefund =
        String(options.source || "").toLowerCase() === "refund";

    const updatedWallet =
        await databases.updateDocument(
            DATABASE_ID,
            WALLET_COLLECTION_ID,
            wallet.$id,
            {
                balance:
                    balanceAfter,

                totalAdded: isRefund
                    ? roundMoney(Number(wallet.totalAdded || 0))
                    : roundMoney(
                          Number(
                              wallet.totalAdded ||
                              0
                          ) +
                          numericAmount
                      ),

                updatedAt:
                    isoNow(),
            }
        );

  // USER MONEY CREDIT

    await databases.createDocument(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        ID.unique(),
        {
            userId: cleanId,

            type: "credit",

            amount:
                numericAmount,

            balanceBefore,

            balanceAfter,

            description:
                options.description ||
                "Money Added to Wallet",

            source:
                options.source ||
                "wallet_add",

            promotionType: "",

            expiresAt: "",

            orderId:
                options.orderId ||
                "",

            transactionId:
                options.transactionId ||
                `ADD-${Date.now()}`,

            referenceTransactionId:
                "",

            createdAt:
                isoNow(),
        }
    );

    return await reconcileWalletState(cleanId, updatedWallet);
};

  // REFUND TO WALLET

const refundMoney = async (
    userId,
    amount,
    options = {}
) => {
    if (options.order || options.orderId) {
        const res = await refundOrderWallet(
            options.order || options.orderId,
            {
                ...options,
                userId,
                refundAmount: amount,
            }
        );
        if (res?.wallet) return res.wallet;
    }

    return await addMoney(
        userId,
        amount,
        {
            description:
                options.description ||
                "Order Cancelled Refund Credited",

            source:
                "refund",

            orderId:
                options.orderId ||
                "",

            transactionId:
                options.transactionId ||
                `REFUND-${Date.now()}`,
        }
    );
};

  // GET BALANCE

const getBalance = async (
    userId
) => {
    const wallet =
        await getOrCreateWallet(
            userId
        );

    return roundMoney(
        wallet.balance || 0
    );
};

  // GET WALLET SUMMARY

const getWalletSummary = async (
    userId
) => {
    const cleanId =
        cleanUserId(userId);

    const wallet =
        await getOrCreateWallet(
            cleanId
        );

    const transactions =
        await getTransactions(
            cleanId
        );

    const offsetData =
        await getEffectiveDebitAmountsMap(
            cleanId,
            transactions
        );

    const promotionCredits =
        await getAvailablePromotionCredits(
            cleanId,
            offsetData
        );

    const monthlyPromotion =
        roundMoney(
            promotionCredits.monthly || 0
        );

    const welcomePromotion =
        roundMoney(
            promotionCredits.welcome || 0
        );

    const userMoney =
        await getAvailableUserMoney(
            cleanId,
            offsetData
        );

    return {
        wallet,

        balance:
            roundMoney(
                wallet.balance || 0
            ),

        promotionalBalance:
            roundMoney(
                wallet.promotionalBalance ||
                0
            ),

        monthlyPromotion,

        welcomePromotion,

        userMoney,

        totalAdded:
            roundMoney(
                wallet.totalAdded || 0
            ),

        totalSpent:
            roundMoney(
                wallet.totalSpent || 0
            ),

        transactions,
    };
};

  // EXPORT

const walletService = {
    getWallet,

    createWallet,

    getOrCreateWallet,

    applyMonthlyPromotion,

    expirePromotions,

    getAvailablePromotionCredits,

    addMoney,

    deductMoney,

    refundMoney,

    refundOrderWallet,

    syncCancelledOrderRefunds,

    getTransactions,

    getBalance,

    getWalletSummary,

    calculateWalletUsage,
};

export default walletService;