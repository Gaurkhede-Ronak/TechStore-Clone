import { useEffect, useMemo, useState } from "react";
import {
    FaWallet,
    FaPlus,
    FaGift,
    FaClock,
    FaArrowDown,
    FaArrowUp,
    FaShoppingBag,
    FaUndo,
    FaSyncAlt,
    FaExclamationCircle,
    FaCheckCircle,
    FaCalendarAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import authService from "../appwrite/authService";
import walletService from "../appwrite/walletService";

import "../styles/Wallet.css";

const Wallet = () => {
    const navigate = useNavigate();

  // STATES

    const [user, setUser] = useState(null);
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

  // LOAD WALLET

    const loadWallet = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

  // Get logged-in user

            const currentUser =
                await authService.getCurrentUser();

            if (!currentUser?.$id) {
                setUser(null);
                setWallet(null);
                setTransactions([]);
                setError(
                    "Please login to access your wallet."
                );
                return;
            }

            setUser(currentUser);

  // Get / create wallet

            const walletData =
                await walletService.getOrCreateWallet(
                    currentUser.$id
                );

  // Get transaction history

            const transactionData =
                await walletService.getTransactions(
                    currentUser.$id
                );

            setWallet(walletData);
            setTransactions(
                Array.isArray(transactionData)
                    ? transactionData
                    : []
            );
        } catch (err) {
            console.error(
                "Wallet loading error:",
                err
            );

            setWallet(null);
            setTransactions([]);

            setError(
                err?.message ||
                    "Unable to load wallet."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

  // INITIAL LOAD

    useEffect(() => {
        loadWallet();
    }, []);

  // FORMAT CURRENCY

    const formatCurrency = (value) => {
        const amount = Number(value || 0);

        return `₹${amount.toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        )}`;
    };

  // FORMAT DATE

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "N/A";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "N/A";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

  // FORMAT DATE + TIME

    const formatDateTime = (dateValue) => {
        if (!dateValue) {
            return "N/A";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "N/A";
        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    };

  // TRANSACTION ICON

    const getTransactionIcon = (
        transaction
    ) => {
        const type = String(
            transaction?.type || ""
        ).toLowerCase();

        const source = String(
            transaction?.source || ""
        ).toLowerCase();

        if (
            source === "promotion" &&
            type === "credit"
        ) {
            return (
                <div className="wallet-transaction-icon wallet-icon-promotion">
                    <FaGift />
                </div>
            );
        }

        if (
            source === "promotion_expiry"
        ) {
            return (
                <div className="wallet-transaction-icon wallet-icon-expired">
                    <FaClock />
                </div>
            );
        }

        if (source === "order") {
            return (
                <div className="wallet-transaction-icon wallet-icon-order">
                    <FaShoppingBag />
                </div>
            );
        }

        if (source === "refund") {
            return (
                <div className="wallet-transaction-icon wallet-icon-refund">
                    <FaUndo />
                </div>
            );
        }

        if (
            type === "credit"
        ) {
            return (
                <div className="wallet-transaction-icon wallet-icon-credit">
                    <FaArrowDown />
                </div>
            );
        }

        return (
            <div className="wallet-transaction-icon wallet-icon-debit">
                <FaArrowUp />
            </div>
        );
    };

  // TRANSACTION LABEL

    const getTransactionTitle = (
        transaction
    ) => {
        const source = String(
            transaction?.source || ""
        ).toLowerCase();

        const promotionType = String(
            transaction?.promotionType || ""
        ).toLowerCase();

        const amtStr = formatCurrency(
            transaction?.amount || 0
        );
        const ordId = transaction?.orderId
            ? ` #${transaction.orderId}`
            : "";
        const credit = isCredit(transaction);

        if (source === "refund") {
            return `${amtStr} Credited to Wallet — Refund for Cancelled Order${ordId}`;
        }

        if (
            source === "order" ||
            (!credit && transaction?.orderId)
        ) {
            if (promotionType === "welcome") {
                return `${amtStr} Debited from Wallet — Welcome Promotion Used for Order${ordId}`;
            }
            if (promotionType === "monthly") {
                return `${amtStr} Debited from Wallet — Monthly Promotion Used for Order${ordId}`;
            }
            return `${amtStr} Debited from Wallet — Payment for Order${ordId}`;
        }

        if (source === "promotion") {
            if (promotionType === "welcome") {
                return `${amtStr} Credited to Wallet — Welcome Promotion ₹1,000`;
            }
            if (promotionType === "monthly") {
                return `${amtStr} Credited to Wallet — Monthly Promotion ₹500`;
            }
            return `${amtStr} Credited to Wallet — Promotion Reward`;
        }

        if (source === "promotion_expiry") {
            return `${amtStr} Debited from Wallet — Unused Promotion Expired`;
        }

        if (source === "wallet_add") {
            return `${amtStr} Credited to Wallet — ${transaction?.description || "Added Money to Wallet"}`;
        }

        if (credit) {
            return (
                transaction?.description ||
                `${amtStr} Credited to Wallet`
            );
        }

        return (
            transaction?.description ||
            `${amtStr} Debited from Wallet`
        );
    };

    const getTransactionBadge = (
        transaction
    ) => {
        const source = String(
            transaction?.source || ""
        ).toLowerCase();
        const promotionType = String(
            transaction?.promotionType || ""
        ).toLowerCase();
        const credit = isCredit(transaction);

        if (source === "refund") {
            return "Order Refund Credited";
        }

        if (
            source === "order" ||
            (!credit && transaction?.orderId)
        ) {
            if (promotionType === "welcome") {
                return "Order Payment Debited • Welcome Promo";
            }
            if (promotionType === "monthly") {
                return "Order Payment Debited • Monthly Promo";
            }
            return "Order Payment Debited";
        }

        if (source === "promotion") {
            if (promotionType === "monthly") {
                return "Monthly Promotion Credited";
            }
            if (promotionType === "welcome") {
                return "Welcome Promotion Credited";
            }
            return "Promotion Credited";
        }

        if (source === "promotion_expiry") {
            return "Promotion Expired Debited";
        }

        if (source === "wallet_add") {
            return "Wallet Money Credited";
        }

        return credit
            ? "Wallet Credited"
            : "Wallet Debited";
    };


  // TRANSACTION TYPE

    const isCredit = (transaction) => {
        return (
            String(
                transaction?.type || ""
            ).toLowerCase() === "credit"
        );
    };

  // EXPIRY STATUS

    const getExpiryStatus = (
        expiresAt
    ) => {
        if (!expiresAt) {
            return null;
        }

        const expiryDate =
            new Date(expiresAt);

        if (
            Number.isNaN(
                expiryDate.getTime()
            )
        ) {
            return null;
        }

        const now = new Date();

        if (expiryDate <= now) {
            return {
                expired: true,
                text: "Expired",
            };
        }

        const difference =
            expiryDate.getTime() -
            now.getTime();

        const days = Math.ceil(
            difference /
                (1000 * 60 * 60 * 24)
        );

        return {
            expired: false,
            text:
                days === 1
                    ? "Expires in 1 day"
                    : `Expires in ${days} days`,
        };
    };

  // PROMOTIONAL TRANSACTIONS

    const promotionalTransactions =
        useMemo(() => {
            return transactions.filter(
                (transaction) =>
                    transaction?.source ===
                        "promotion" &&
                    transaction?.type ===
                        "credit"
            );
        }, [transactions]);

  // RECENT TRANSACTIONS

    const recentTransactions =
        useMemo(() => {
            return [...transactions].sort(
                (a, b) => {
                    const dateA =
                        new Date(
                            a?.createdAt ||
                                a?.$createdAt ||
                                0
                        ).getTime();

                    const dateB =
                        new Date(
                            b?.createdAt ||
                                b?.$createdAt ||
                                0
                        ).getTime();

                    return dateB - dateA;
                }
            );
        }, [transactions]);

  // LOGIN REQUIRED

    if (
        !loading &&
        !user &&
        error
    ) {
        return (
            <div className="wallet-page">
                <div className="container py-5">
                    <div className="wallet-empty-state">
                        <div className="wallet-empty-icon">
                            <FaWallet />
                        </div>

                        <h2>
                            Login Required
                        </h2>

                        <p>
                            Please login to view
                            and manage your wallet.
                        </p>

                        <button
                            type="button"
                            className="btn btn-dark rounded-pill px-5 py-3 fw-bold"
                            onClick={() =>
                                navigate(
                                    "/login"
                                )
                            }
                        >
                            Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

  // LOADING

    if (loading) {
        return (
            <div className="wallet-page">
                <div className="container py-5">
                    <div className="wallet-loading">
                        <div
                            className="spinner-border"
                            role="status"
                        />

                        <h5 className="mt-3 fw-bold">
                            Loading Wallet...
                        </h5>

                        <p className="text-muted mb-0">
                            Please wait.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

  // ERROR

    if (error && !wallet) {
        return (
            <div className="wallet-page">
                <div className="container py-5">
                    <div className="wallet-empty-state">
                        <div className="wallet-empty-icon text-danger">
                            <FaExclamationCircle />
                        </div>

                        <h2>
                            Wallet Error
                        </h2>

                        <p>{error}</p>

                        <button
                            type="button"
                            className="btn btn-dark rounded-pill px-5 py-3 fw-bold"
                            onClick={() =>
                                loadWallet()
                            }
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

  // WALLET VALUES

    const balance = Number(
        wallet?.balance || 0
    );

    const promotionalBalance =
        Number(
            wallet?.promotionalBalance ||
                0
        );

    const totalAdded = Number(
        wallet?.totalAdded || 0
    );

    const totalSpent = Number(
        wallet?.totalSpent || 0
    );

  // UI

    return (
        <div className="wallet-page">
            <div className="container py-4 py-md-5">

                {/* HEADER */}

                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                    <div>
                        <h1 className="wallet-page-title">
                            My Wallet
                        </h1>

                        <p className="wallet-page-subtitle mb-0">
                            Manage your wallet balance
                            and promotional rewards.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="btn btn-outline-dark rounded-pill px-4 py-2 fw-bold"
                        onClick={() =>
                            loadWallet(true)
                        }
                        disabled={refreshing}
                    >
                        <FaSyncAlt
                            className={
                                refreshing
                                    ? "wallet-spin me-2"
                                    : "me-2"
                            }
                        />

                        Refresh
                    </button>
                </div>

                {/* BALANCE CARD */}

                <div className="wallet-balance-card mb-4">
                    <div className="wallet-balance-glow" />

                    <div className="position-relative">
                        <div className="d-flex align-items-center gap-3 mb-3">
                            <div className="wallet-main-icon">
                                <FaWallet />
                            </div>

                            <div>
                                <span className="wallet-small-label">
                                    Available Wallet Balance
                                </span>

                                <h2 className="wallet-balance-amount mb-0">
                                    {formatCurrency(
                                        balance
                                    )}
                                </h2>
                            </div>
                        </div>

                        <div className="row g-3 mt-2">
                            <div className="col-12 col-sm-4">
                                <div className="wallet-stat-card">
                                    <FaGift className="wallet-stat-icon" />

                                    <div>
                                        <small>
                                            Promotional
                                        </small>

                                        <strong>
                                            {formatCurrency(
                                                promotionalBalance
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-sm-4">
                                <div className="wallet-stat-card">
                                    <FaArrowDown className="wallet-stat-icon" />

                                    <div>
                                        <small>
                                            Total Added
                                        </small>

                                        <strong>
                                            {formatCurrency(
                                                totalAdded
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-sm-4">
                                <div className="wallet-stat-card">
                                    <FaArrowUp className="wallet-stat-icon" />

                                    <div>
                                        <small>
                                            Total Spent
                                        </small>

                                        <strong>
                                            {formatCurrency(
                                                totalSpent
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CANCELLED ORDER REFUND CREDITED BANNER */}
                {(() => {
                    const seenOrderRefunds = new Set();
                    const refundTxns = (transactions || []).filter(
                        (t) => {
                            if (
                                String(t?.source || "").toLowerCase() !==
                                    "refund" ||
                                !isCredit(t)
                            ) {
                                return false;
                            }
                            const sig = `${String(t?.orderId || "").trim()}::${Number(t?.amount || 0)}`;
                            if (seenOrderRefunds.has(sig)) return false;
                            seenOrderRefunds.add(sig);
                            return true;
                        }
                    );
                    if (refundTxns.length === 0) return null;
                    const latestRefund = refundTxns[0];
                    const latestRefundAmt = Number(latestRefund?.amount || 0);
                    return (
                        <div
                            className="p-4 rounded-4 mb-4"
                            style={{
                                background:
                                    "linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(5, 150, 105, 0.06))",
                                border: "1.5px solid rgba(16, 185, 129, 0.45)",
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                                        style={{ width: 46, height: 46 }}
                                    >
                                        <FaCheckCircle size={22} />
                                    </div>
                                    <div>
                                        <span className="badge bg-success mb-1">
                                            Order Cancelled Refund Credited
                                        </span>
                                        <h5 className="fw-bold text-success mb-1">
                                            +{formatCurrency(latestRefundAmt)} Credited to Your Wallet
                                        </h5>
                                        <small className="text-muted d-block">
                                            {latestRefund?.orderId
                                                ? `Refund from Cancelled Order #${latestRefund.orderId} has been credited back to your TechStore Wallet.`
                                                : "Your cancelled order wallet payment has been credited back to your TechStore Wallet."}
                                        </small>
                                    </div>
                                </div>
                                <div className="text-md-end">
                                    <span className="small text-muted d-block">
                                        Available Wallet Balance
                                    </span>
                                    <strong className="fs-4 text-success">
                                        {formatCurrency(balance)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* PROMOTIONS */}

                <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-body p-4">

                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h4 className="fw-bold mb-1">
                                    Your Promotions
                                </h4>

                                <p className="text-muted mb-0">
                                    Promotional wallet
                                    credits and their
                                    validity.
                                </p>
                            </div>

                            <FaGift
                                size={25}
                                className="text-warning"
                            />
                        </div>

                        {promotionalTransactions.length ===
                        0 ? (
                            <div className="text-center py-4">
                                <FaGift
                                    size={40}
                                    className="text-muted mb-3"
                                />

                                <p className="text-muted mb-0">
                                    No promotional
                                    credits yet.
                                </p>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {promotionalTransactions
                                    .slice(0, 6)
                                    .map(
                                        (
                                            transaction
                                        ) => {
                                            const expiry =
                                                getExpiryStatus(
                                                    transaction?.expiresAt
                                                );

                                            return (
                                                <div
                                                    className="col-12 col-md-6"
                                                    key={
                                                        transaction.$id
                                                    }
                                                >
                                                    <div className="wallet-promotion-card">

                                                        <div className="d-flex justify-content-between align-items-start gap-3">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div className="wallet-promotion-icon">
                                                                    <FaGift />
                                                                </div>

                                                                <div>
                                                                    <div className="wallet-promotion-badge">
                                                                        Promotion
                                                                    </div>

                                                                    <h6 className="fw-bold mb-1 mt-1">
                                                                        {transaction?.promotionType ===
                                                                        "monthly"
                                                                            ? "Monthly Promotion"
                                                                            : "Welcome Promotion"}
                                                                    </h6>

                                                                    <small className="text-muted">
                                                                        Received{" "}
                                                                        {formatDate(
                                                                            transaction?.createdAt ||
                                                                                transaction?.$createdAt
                                                                        )}
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            <strong className="text-success">
                                                                +{formatCurrency(
                                                                    transaction?.amount
                                                                )}
                                                            </strong>
                                                        </div>

                                                        {expiry && (
                                                            <div
                                                                className={`wallet-expiry ${
                                                                    expiry.expired
                                                                        ? "wallet-expired"
                                                                        : ""
                                                                }`}
                                                            >
                                                                <FaClock />

                                                                <span>
                                                                    {expiry.text}
                                                                    {" · "}
                                                                    Valid
                                                                    until{" "}
                                                                    {formatDate(
                                                                        transaction?.expiresAt
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ADD MONEY */}

                <div className="card border-0 shadow-sm rounded-4 mb-4">
                    <div className="card-body p-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <div>
                                <h4 className="fw-bold mb-1">
                                    Add Money
                                </h4>

                                <p className="text-muted mb-0">
                                    Add money to your wallet
                                    for faster checkout.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-dark rounded-pill px-4 py-3 fw-bold"
                                onClick={() =>
                                    toast.success(
                                        "Payment gateway will be connected next."
                                    )
                                }
                            >
                                <FaPlus className="me-2" />
                                Add Money
                            </button>
                        </div>
                    </div>
                </div>

                {/* TRANSACTION HISTORY */}

                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body p-4">

                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h4 className="fw-bold mb-1">
                                    Transaction History
                                </h4>

                                <p className="text-muted mb-0">
                                    All wallet activity
                                </p>
                            </div>

                            <FaCalendarAlt className="text-muted" />
                        </div>

                        {recentTransactions.length ===
                        0 ? (
                            <div className="text-center py-5">
                                <FaWallet
                                    size={45}
                                    className="text-muted mb-3"
                                />

                                <h5 className="fw-bold">
                                    No Transactions
                                </h5>

                                <p className="text-muted mb-0">
                                    Your wallet activity
                                    will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="wallet-transactions-list">
                                {recentTransactions.map(
                                    (
                                        transaction
                                    ) => {
                                        const credit =
                                            isCredit(
                                                transaction
                                            );

                                        const source =
                                            String(
                                                transaction?.source ||
                                                    ""
                                            ).toLowerCase();

                                        const expired =
                                            source ===
                                            "promotion_expiry";

                                        const badgeLabel =
                                            getTransactionBadge(
                                                transaction
                                            );

                                        return (
                                            <div
                                                className="wallet-transaction"
                                                style={
                                                    credit
                                                        ? {
                                                              background:
                                                                  "rgba(16, 185, 129, 0.08)",
                                                              border: "1px solid rgba(16, 185, 129, 0.35)",
                                                          }
                                                        : {
                                                              background:
                                                                  "rgba(239, 68, 68, 0.07)",
                                                              border: "1px solid rgba(239, 68, 68, 0.35)",
                                                          }
                                                }
                                                key={
                                                    transaction.$id
                                                }
                                            >
                                                {getTransactionIcon(
                                                    transaction
                                                )}

                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-start gap-2">
                                                        <div className="min-w-0">
                                                            <h6 className="fw-bold mb-1">
                                                                {getTransactionTitle(
                                                                    transaction
                                                                )}
                                                            </h6>

                                                            <div className="mb-1">
                                                                <span
                                                                    className={`badge rounded-pill ${
                                                                        credit
                                                                            ? "bg-success"
                                                                            : "bg-danger"
                                                                    }`}
                                                                >
                                                                    {badgeLabel}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div
                                                            className="text-sm-end flex-shrink-0"
                                                            style={{
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            <strong
                                                                className={`d-block fs-6 ${
                                                                    credit
                                                                        ? "text-success"
                                                                        : "text-danger"
                                                                }`}
                                                            >
                                                                {credit
                                                                    ? "+"
                                                                    : "-"}
                                                                {formatCurrency(
                                                                    transaction?.amount
                                                                )}
                                                            </strong>
                                                            <small
                                                                className={`fw-semibold d-block ${
                                                                    credit
                                                                        ? "text-success"
                                                                        : "text-danger"
                                                                }`}
                                                            >
                                                                {credit
                                                                    ? "Credited"
                                                                    : "Debited"}
                                                            </small>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex flex-wrap gap-2 align-items-center mt-1">
                                                        <small className="text-muted">
                                                            {formatDateTime(
                                                                transaction?.createdAt ||
                                                                    transaction?.$createdAt
                                                            )}
                                                            {transaction?.orderId
                                                                ? ` • Order #${transaction.orderId}`
                                                                : ""}
                                                            {" • ID: "}
                                                            {transaction?.transactionId ||
                                                                transaction?.$id ||
                                                                "N/A"}
                                                        </small>

                                                        {transaction?.source ===
                                                            "promotion" &&
                                                            transaction?.expiresAt && (
                                                                <span
                                                                    className={`wallet-mini-expiry ${
                                                                        new Date(
                                                                            transaction.expiresAt
                                                                        ) <=
                                                                        new Date()
                                                                            ? "expired"
                                                                            : ""
                                                                    }`}
                                                                >
                                                                    <FaClock className="me-1" />

                                                                    {new Date(
                                                                        transaction.expiresAt
                                                                    ) <=
                                                                    new Date()
                                                                        ? "Expired"
                                                                        : `Expires ${formatDate(
                                                                              transaction.expiresAt
                                                                          )}`}
                                                                </span>
                                                            )}

                                                        {expired && (
                                                            <span className="wallet-expired-tag">
                                                                Expired
                                                            </span>
                                                        )}
                                                    </div>

                                                    {transaction?.promotionType && (
                                                        <small
                                                            className={`d-block fw-semibold mt-1 ${
                                                                credit
                                                                    ? "text-success"
                                                                    : "text-danger"
                                                            }`}
                                                        >
                                                            Promotion Type:{" "}
                                                            {
                                                                transaction.promotionType
                                                            }
                                                        </small>
                                                    )}
                                                </div>

                                                <div className="wallet-transaction-balance d-none d-md-block">
                                                    <small className="text-muted">
                                                        Balance
                                                    </small>

                                                    <strong>
                                                        {formatCurrency(
                                                            transaction?.balanceAfter
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* CHECKOUT INFO */}

                <div className="wallet-checkout-info mt-4">
                    <div className="d-flex align-items-start gap-3">
                        <FaCheckCircle className="mt-1" />

                        <div>
                            <strong>
                                Use your wallet at
                                checkout
                            </strong>

                            <p className="mb-0 mt-1">
                                Your available wallet
                                balance can be used
                                directly while placing
                                an order. Promotional
                                credits are subject to
                                their validity period.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Wallet;