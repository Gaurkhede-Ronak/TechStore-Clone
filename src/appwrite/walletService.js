import { ID, Query } from "appwrite";
import { databases } from "./config";

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
    promotionTransactionId
) => {
    const cleanId = cleanUserId(userId);

    if (!promotionTransactionId) {
        return 0;
    }

    const response = await databases.listDocuments(
        DATABASE_ID,
        WALLET_TRANSACTIONS_COLLECTION_ID,
        [
            Query.equal("userId", cleanId),
            Query.equal(
                "referenceTransactionId",
                promotionTransactionId
            ),
            Query.equal("type", "debit"),
            Query.limit(100),
        ]
    );

    return roundMoney(
        (response.documents || []).reduce(
            (total, transaction) =>
                total +
                Number(transaction.amount || 0),
            0
        )
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
                credit.$id
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

    return wallet;
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
                "wallet_add" ||
            transaction.source ===
                "refund"
    );
};

  // GET USER MONEY USED

const getUserMoneyUsage = async (
    userId,
    creditId
) => {
    const cleanId = cleanUserId(userId);

    if (!creditId) {
        return 0;
    }

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
                    "referenceTransactionId",
                    creditId
                ),

                Query.equal(
                    "type",
                    "debit"
                ),

                Query.limit(100),
            ]
        );

    return roundMoney(
        (response.documents || []).reduce(
            (total, transaction) =>
                total +
                Number(
                    transaction.amount || 0
                ),
            0
        )
    );
};

  // GET AVAILABLE PROMOTION CREDITS

const getAvailablePromotionCredits = async (
    userId
) => {
    const cleanId = cleanUserId(userId);

    const credits =
        await getPromotionalCredits(
            cleanId
        );

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
                credit.$id
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

    return available;
};

  // GET AVAILABLE USER MONEY

const getAvailableUserMoney = async (
    userId
) => {
    const cleanId = cleanUserId(userId);

    const credits =
        await getUserMoneyCredits(
            cleanId
        );

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
                credit.$id
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

    return totalAvailable;
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

  // 1. MONTHLY PROMOTION

    const promotionCredits =
        await getAvailablePromotionCredits(
            cleanId
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
                cleanId
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

    const updatedWallet =
        await databases.updateDocument(
            DATABASE_ID,
            WALLET_COLLECTION_ID,
            wallet.$id,
            {
                balance:
                    balanceAfter,

                totalAdded:
                    roundMoney(
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

    return updatedWallet;
};

  // REFUND TO WALLET

const refundMoney = async (
    userId,
    amount,
    options = {}
) => {
    return await addMoney(
        userId,
        amount,
        {
            description:
                options.description ||
                "Order Refund",

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

    const promotionCredits =
        await getAvailablePromotionCredits(
            cleanId
        );

    const monthlyPromotion =
        roundMoney(
            promotionCredits
                .filter(
                    (item) =>
                        item.promotionType ===
                        "monthly"
                )
                .reduce(
                    (total, item) =>
                        total +
                        Number(
                            item.remainingAmount ||
                            0
                        ),
                    0
                )
        );

    const welcomePromotion =
        roundMoney(
            promotionCredits
                .filter(
                    (item) =>
                        item.promotionType ===
                        "welcome"
                )
                .reduce(
                    (total, item) =>
                        total +
                        Number(
                            item.remainingAmount ||
                            0
                        ),
                    0
                )
        );

    const userMoney =
        await getAvailableUserMoney(
            cleanId
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

    addMoney,

    deductMoney,

    refundMoney,

    getTransactions,

    getBalance,

    getWalletSummary,

    calculateWalletUsage,
};

export default walletService;