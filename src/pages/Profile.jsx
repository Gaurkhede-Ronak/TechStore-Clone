import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
    FaUser,
    FaBoxOpen,
    FaHeart,
    FaShoppingCart,
    FaShieldAlt,
    FaSignOutAlt,
    FaWallet,
    FaHistory,
    FaCheckCircle,
    FaPlusCircle,
    FaQrcode,
    FaCreditCard,
    FaArrowLeft,
    FaLock,
    FaGift,
    FaClock,
    FaSpinner,
} from "react-icons/fa";

import "../css/Profile.css";

import {
    logout,
    updateProfile,
} from "../redux/slices/authSlice";

import authService from "../appwrite/authService";
import walletService from "../appwrite/walletService";
import orderService from "../appwrite/orderService";
import userService from "../appwrite/userService";


  // HELPERS

const formatMoney = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDate = (value) => {
    if (!value) {
        return "N/A";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};


  // PROFILE

function Profile() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

  // SAFE REDUX STATE

    const authState = useSelector(
        (state) => state?.auth || {}
    );

    const cartState = useSelector(
        (state) => state?.cart || {}
    );

    const wishlistState = useSelector(
        (state) => state?.wishlist || {}
    );

    const user = authState?.user || null;

    const cart = Array.isArray(cartState?.items)
        ? cartState.items
        : [];

    const wishlist = Array.isArray(wishlistState?.items)
        ? wishlistState.items
        : [];


  // GENERAL STATE

    const [orders, setOrders] = useState([]);

    const [activeTab, setActiveTab] =
        useState(() => {
            const params = new URLSearchParams(window.location.search);
            const tab = String(params.get("tab") || "").toLowerCase();
            return ["overview", "wallet", "edit"].includes(tab)
                ? tab
                : "overview";
        });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = String(params.get("tab") || "").toLowerCase();
        if (["overview", "wallet", "edit"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [location.search]);

    const [name, setName] =
        useState(user?.name || "");

    const [email] =
        useState(
            user?.email ||
            "user@techstore.com"
        );

    const [phone, setPhone] =
        useState(
            user?.phone ||
            ""
        );

    const [dob, setDob] =
        useState(
            user?.dob ||
            ""
        );

    const [gender, setGender] =
        useState(
            user?.gender ||
            "Male"
        );


    const todayStr = new Date()
        .toISOString()
        .split("T")[0];


  // WALLET STATE

    const [walletBalance, setWalletBalance] =
        useState(0);

    const [promotionalBalance, setPromotionalBalance] =
        useState(0);

    const [totalAdded, setTotalAdded] =
        useState(0);

    const [totalSpent, setTotalSpent] =
        useState(0);

    const [monthlyPromotion, setMonthlyPromotion] =
        useState(0);

    const [welcomePromotion, setWelcomePromotion] =
        useState(0);

    const [monthlyPromotionExpiry, setMonthlyPromotionExpiry] =
        useState(null);

    const [welcomePromotionExpiry, setWelcomePromotionExpiry] =
        useState(null);

    const [transactions, setTransactions] =
        useState([]);

    const [walletLoading, setWalletLoading] =
        useState(true);

    const [walletError, setWalletError] =
        useState("");


  // ADD MONEY / PAYMENT STATE

    const [gatewayStep, setGatewayStep] =
        useState("wallet");

    const [inputAmount, setInputAmount] =
        useState("");

    const [paymentMethod, setPaymentMethod] =
        useState("UPI");

    const [upiId, setUpiId] =
        useState("");

    const [cardNumber, setCardNumber] =
        useState("");

    const [successTxnId, setSuccessTxnId] =
        useState("");

    const [processingPayment, setProcessingPayment] =
        useState(false);


  // USER INITIAL

    const getUserInitial = (value) => {
        if (!value) {
            return "U";
        }

        return String(value)
            .trim()
            .charAt(0)
            .toUpperCase();
    };

    const userInitial =
        getUserInitial(name || user?.name);


  // SYNC USER DATA

    useEffect(() => {
        setName(user?.name || "");
        setPhone(user?.phone || "");
        setDob(user?.dob || "");
        setGender(user?.gender || "Male");
    }, [
        user?.name,
        user?.phone,
        user?.dob,
        user?.gender,
    ]);


  // LOAD ORDERS (APPWRITE DIRECT)

    useEffect(() => {
        let isMounted = true;
        const fetchOrders = async () => {
            const uid = user?.$id || user?.id;
            if (!uid) {
                setOrders([]);
                return;
            }
            try {
                const res = await orderService.getOrdersByUser(uid);
                if (isMounted) {
                    setOrders(Array.isArray(res?.documents) ? res.documents : []);
                }
            } catch (err) {
                console.error("Profile orders load error:", err);
                if (isMounted) setOrders([]);
            }
        };

        fetchOrders();

        return () => {
            isMounted = false;
        };
    }, [user?.$id, user?.id]);


  // WALLET DATA LOADER

    const loadWalletData = async () => {
        try {
            setWalletLoading(true);
            setWalletError("");

            const currentUser =
                await authService.getCurrentUser();

            if (!currentUser?.$id) {
                setWalletBalance(0);
                setPromotionalBalance(0);
                setTotalAdded(0);
                setTotalSpent(0);
                setMonthlyPromotion(0);
                setWelcomePromotion(0);
                setMonthlyPromotionExpiry(null);
                setWelcomePromotionExpiry(null);
                setTransactions([]);
                return;
            }

  // GET / CREATE WALLET

            const wallet =
                await walletService.getOrCreateWallet(
                    currentUser.$id
                );

            if (!wallet) {
                throw new Error(
                    "Wallet could not be loaded."
                );
            }

            setWalletBalance(
                Number(wallet?.balance || 0)
            );

            setPromotionalBalance(
                Number(
                    wallet?.promotionalBalance || 0
                )
            );

            setTotalAdded(
                Number(wallet?.totalAdded || 0)
            );

            setTotalSpent(
                Number(wallet?.totalSpent || 0)
            );


  // PROMOTIONS

            let promotions = null;

            if (
                typeof walletService
                    .getAvailablePromotionCredits ===
                "function"
            ) {
                promotions =
                    await walletService
                        .getAvailablePromotionCredits(
                            currentUser.$id
                        );
            }

            setMonthlyPromotion(
                Number(
                    promotions?.monthly || 0
                )
            );

            setWelcomePromotion(
                Number(
                    promotions?.welcome || 0
                )
            );

            setMonthlyPromotionExpiry(
                promotions?.monthlyExpiry ||
                null
            );

            setWelcomePromotionExpiry(
                promotions?.welcomeExpiry ||
                null
            );


  // TRANSACTIONS

            const transactionResponse =
                await walletService.getTransactions(
                    currentUser.$id
                );

            const transactionDocuments =
                Array.isArray(
                    transactionResponse
                        ?.documents
                )
                    ? transactionResponse.documents
                    : Array.isArray(
                        transactionResponse
                    )
                        ? transactionResponse
                        : [];

            setTransactions(
                transactionDocuments
            );
        } catch (error) {
            console.error(
                "Wallet loading error:",
                error
            );

            setWalletError(
                error?.message ||
                "Unable to load wallet."
            );

            toast.error(
                error?.message ||
                "Unable to load wallet."
            );
        } finally {
            setWalletLoading(false);
        }
    };


  // INITIAL WALLET LOAD

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            if (!mounted) {
                return;
            }

            await loadWalletData();
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);


  // REFRESH WALLET

    const refreshWallet = async () => {
        await loadWalletData();
    };


  // CARD NUMBER FORMAT

    const handleCardNumberChange = (event) => {
        let value =
            event.target.value.replace(
                /\D/g,
                ""
            );

        value = value.slice(0, 16);

        let formatted = "";

        for (
            let index = 0;
            index < value.length;
            index++
        ) {
            if (
                index > 0 &&
                index % 4 === 0
            ) {
                formatted += " ";
            }

            formatted += value[index];
        }

        setCardNumber(formatted);
    };


  // PROCEED TO PAYMENT

    const handleProceedToPay = (event) => {
        event.preventDefault();

        const amount =
            Number(inputAmount);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            toast.error(
                "Please enter a valid amount!"
            );
            return;
        }

        if (amount > 1000000) {
            toast.error(
                "Maximum wallet addition limit is ₹10,00,000."
            );
            return;
        }

        setGatewayStep("checkout");
    };


  // CONFIRM ADD MONEY PAYMENT

    const handleConfirmPayment = (event) => {
        event.preventDefault();

        if (processingPayment) {
            return;
        }

        const amount =
            Number(inputAmount);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            toast.error(
                "Please enter a valid amount."
            );
            return;
        }

  // UPI VALIDATION

        if (
            paymentMethod === "UPI" &&
            !upiId.trim()
        ) {
            toast.error(
                "Please enter a valid UPI ID."
            );
            return;
        }

  // CARD VALIDATION

        if (
            paymentMethod === "Debit Card" &&
            cardNumber.replace(/\s/g, "").length !==
            16
        ) {
            toast.error(
                "Please enter a valid 16-digit Card Number."
            );
            return;
        }

        setProcessingPayment(true);
        setGatewayStep("processing");


  // DEMO PAYMENT

        setTimeout(async () => {
            try {
                const currentUser =
                    await authService.getCurrentUser();

                if (!currentUser?.$id) {
                    throw new Error(
                        "Please login again."
                    );
                }

                const uniqueTxnId =
                    `TXN${Date.now()}${Math.floor(
                        100 +
                        Math.random() * 900
                    )}`;


  // ADD MONEY TO APPWRITE WALLET

                const walletResult =
                    await walletService.addMoney(
                        currentUser.$id,
                        amount,
                        {
                            source: "wallet_add",
                            transactionId:
                                uniqueTxnId,
                            description:
                                `Added Money via ${paymentMethod}`,
                        }
                    );


                setSuccessTxnId(
                    walletResult?.transactionId ||
                    uniqueTxnId
                );

                await loadWalletData();

                setGatewayStep("success");

                toast.success(
                    "Payment Successful! Money added to wallet."
                );
            } catch (error) {
                console.error(
                    "Wallet add money error:",
                    error
                );

                setGatewayStep("checkout");

                toast.error(
                    error?.message ||
                    "Unable to add money to wallet."
                );
            } finally {
                setProcessingPayment(false);
            }
        }, 1800);
    };


  // RETURN TO WALLET

    const handleReturnToWallet = async () => {
        setGatewayStep("wallet");

        setInputAmount("");
        setUpiId("");
        setCardNumber("");
        setSuccessTxnId("");

        await refreshWallet();
    };


  // SAVE PROFILE

    const saveProfile = async (event) => {
        event.preventDefault();

        if (!name.trim()) {
            toast.error(
                "Name cannot be empty."
            );
            return;
        }

        if (
            dob &&
            dob > todayStr
        ) {
            toast.error(
                "Date of Birth cannot be in the future!"
            );
            return;
        }

        try {
            const uid = user?.$id || user?.id;
            if (uid) {
                try {
                    const userDoc = await userService.getUserByUserId(uid);
                    if (userDoc?.$id) {
                        await userService.updateUser(userDoc.$id, {
                            name: name.trim(),
                            phone: phone || "",
                            dob: dob || "",
                            gender: gender || "Male"
                        });
                    }
                } catch (appwriteErr) {
                    console.warn("Appwrite user doc sync notice:", appwriteErr);
                }
            }

            dispatch(
                updateProfile({
                    name: name.trim(),
                    phone,
                    dob,
                    gender,
                })
            );

            toast.success(
                "Profile Updated & Synced to Appwrite Successfully!"
            );
        } catch (error) {
            console.error(
                "Profile update error:",
                error
            );

            toast.error(
                "Failed to update profile."
            );
        }
    };


  // LOGOUT

    const handleLogout = () => {
        dispatch(logout());

        toast.success(
            "Logged Out Successfully"
        );

        navigate("/login");
    };


  // TRANSACTION HELPERS

    const getTransactionTitle = (txn) => {
        const source = String(txn?.source || "").toLowerCase();
        const promoType = String(txn?.promotionType || "").toLowerCase();
        const amtStr = `₹${formatMoney(txn?.amount || 0)}`;
        const ordId = txn?.orderId ? ` #${txn.orderId}` : "";
        const credit = isCredit(txn);

        if (source === "refund") {
            return `₹${formatMoney(txn?.amount || 0)} Credited to Wallet — Refund for Cancelled Order${ordId}`;
        }

        if (source === "order" || (!credit && txn?.orderId)) {
            if (promoType === "welcome") {
                return `${amtStr} Debited from Wallet — Welcome Promotion Used for Order${ordId}`;
            }
            if (promoType === "monthly") {
                return `${amtStr} Debited from Wallet — Monthly Promotion Used for Order${ordId}`;
            }
            return `${amtStr} Debited from Wallet — Payment for Order${ordId}`;
        }

        if (source === "promotion") {
            if (promoType === "monthly") {
                return `${amtStr} Credited to Wallet — Monthly Promotion ₹500`;
            }
            if (promoType === "welcome") {
                return `${amtStr} Credited to Wallet — Welcome Promotion ₹1,000`;
            }
            return `${amtStr} Credited to Wallet — ${txn?.description || "Promotion Reward"}`;
        }

        if (source === "promotion_expiry") {
            return `${amtStr} Debited from Wallet — Unused Promotion Expired`;
        }

        if (source === "wallet_add") {
            return `${amtStr} Credited to Wallet — ${txn?.description || "Added Money to Wallet"}`;
        }

        if (credit) {
            return txn?.description || `${amtStr} Credited to Wallet`;
        }

        return txn?.description || `${amtStr} Debited from Wallet`;
    };

    const getTransactionBadge = (txn) => {
        const source = String(txn?.source || "").toLowerCase();
        const promoType = String(txn?.promotionType || "").toLowerCase();
        const credit = isCredit(txn);

        if (source === "refund") {
            return "Order Refund Credited";
        }

        if (source === "order" || (!credit && txn?.orderId)) {
            if (promoType === "welcome") {
                return "Order Payment Debited • Welcome Promo";
            }
            if (promoType === "monthly") {
                return "Order Payment Debited • Monthly Promo";
            }
            return "Order Payment Debited";
        }

        if (source === "promotion") {
            if (promoType === "monthly") {
                return "Monthly Promotion Credited";
            }
            if (promoType === "welcome") {
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

        return credit ? "Wallet Credited" : "Wallet Debited";
    };


    const isCredit = (txn) => {
        const type =
            String(
                txn?.type || ""
            ).toLowerCase();

        return (
            type === "credit" ||
            type === "credited"
        );
    };


  // RENDER

    return (
        <div className="profile-page-wrapper">

            <div className="container py-5">

                <div className="row g-4">

                    {/* SIDEBAR */}

                    <div className="col-lg-4">

                        <div className="profile-sidebar-card p-4 animate-float-in">

                            <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom custom-border">

                                <div className="sidebar-avatar-box">

                                    <span className="text-white fw-bold fs-4 d-flex align-items-center justify-content-center h-100 w-100 bg-primary">
                                        {userInitial}
                                    </span>

                                </div>

                                <div className="overflow-hidden">

                                    <h5 className="fw-bold mb-1 text-truncate">
                                        {user?.name ||
                                            "Customer"}
                                    </h5>

                                    <p className="text-muted small mb-0 text-truncate">
                                        {user?.email ||
                                            "customer@techstore.com"}
                                    </p>

                                </div>

                            </div>


                            <div className="profile-nav-menu">

                                <button
                                    type="button"
                                    className={`profile-nav-link ${
                                        activeTab ===
                                        "overview"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setActiveTab(
                                            "overview"
                                        )
                                    }
                                >
                                    <FaUser className="me-2" />
                                    Account Overview
                                </button>


                                <button
                                    type="button"
                                    className={`profile-nav-link ${
                                        activeTab ===
                                        "wallet"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() => {
                                        setActiveTab(
                                            "wallet"
                                        );

                                        setGatewayStep(
                                            "wallet"
                                        );

                                        refreshWallet();
                                    }}
                                >
                                    <FaWallet className="me-2" />
                                    My Wallet & History
                                </button>


                                <button
                                    type="button"
                                    className={`profile-nav-link ${
                                        activeTab ===
                                        "edit"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        setActiveTab(
                                            "edit"
                                        )
                                    }
                                >
                                    <FaShieldAlt className="me-2" />
                                    Edit Profile & Security
                                </button>


                                <div className="profile-nav-divider my-2" />

                                <button
                                    type="button"
                                    className="profile-nav-link text-danger"
                                    onClick={
                                        handleLogout
                                    }
                                >
                                    <FaSignOutAlt className="me-2" />
                                    Logout Account
                                </button>

                            </div>

                        </div>

                    </div>


                    {/* MAIN CONTENT */}

                    <div className="col-lg-8">


                        {/* OVERVIEW */}

                        {activeTab ===
                            "overview" && (

                            <div className="profile-content-card p-4 p-md-5 animate-float-in">

                                <div className="d-flex justify-content-between align-items-center mb-4">

                                    <h3 className="fw-bold mb-0">
                                        Dashboard Overview
                                    </h3>

                                    <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill">
                                        <FaCheckCircle className="me-1" />
                                        Active Account
                                    </span>

                                </div>


                                <div className="row g-3 mb-4">

                                    <div
                                        className="col-md-4"
                                        onClick={() =>
                                            navigate(
                                                "/cart"
                                            )
                                        }
                                        style={{
                                            cursor: "pointer",
                                        }}
                                    >

                                        <div className="stats-box">

                                            <div className="stats-icon text-primary bg-primary bg-opacity-10 mb-2">
                                                <FaShoppingCart />
                                            </div>

                                            <h4>
                                                {cart.length}
                                            </h4>

                                            <p>
                                                Cart Items
                                            </p>

                                        </div>

                                    </div>


                                    <div
                                        className="col-md-4"
                                        onClick={() =>
                                            navigate(
                                                "/wishlist"
                                            )
                                        }
                                        style={{
                                            cursor: "pointer",
                                        }}
                                    >

                                        <div className="stats-box">

                                            <div className="stats-icon text-danger bg-danger bg-opacity-10 mb-2">
                                                <FaHeart />
                                            </div>

                                            <h4>
                                                {wishlist.length}
                                            </h4>

                                            <p>
                                                Wishlist
                                            </p>

                                        </div>

                                    </div>


                                    <div
                                        className="col-md-4"
                                        onClick={() =>
                                            navigate(
                                                "/orders"
                                            )
                                        }
                                        style={{
                                            cursor: "pointer",
                                        }}
                                    >

                                        <div className="stats-box">

                                            <div className="stats-icon text-success bg-success bg-opacity-10 mb-2">
                                                <FaBoxOpen />
                                            </div>

                                            <h4>
                                                {orders.length}
                                            </h4>

                                            <p>
                                                Total Orders
                                            </p>

                                        </div>

                                    </div>

                                </div>


                                <div className="info-summary-box p-4 rounded-4 border">

                                    <h5 className="fw-bold mb-3">
                                        Personal Information
                                    </h5>

                                    <div className="row g-3">

                                        <div className="col-sm-6">

                                            <span className="text-muted small d-block">
                                                Full Name
                                            </span>

                                            <strong className="text-dark">
                                                {user?.name ||
                                                    "N/A"}
                                            </strong>

                                        </div>


                                        <div className="col-sm-6">

                                            <span className="text-muted small d-block">
                                                Email Address
                                            </span>

                                            <strong className="text-dark">
                                                {user?.email ||
                                                    "N/A"}
                                            </strong>

                                        </div>


                                        <div className="col-sm-6 mt-3">

                                            <span className="text-muted small d-block">
                                                Phone Number
                                            </span>

                                            <strong className="text-dark">
                                                {phone ||
                                                    "N/A"}
                                            </strong>

                                        </div>


                                        <div className="col-sm-6 mt-3">

                                            <span className="text-muted small d-block">
                                                Date of Birth & Gender
                                            </span>

                                            <strong className="text-dark">
                                                {dob ||
                                                    "N/A"}{" "}
                                                ({gender ||
                                                    "N/A"})
                                            </strong>

                                        </div>

                                    </div>

                                </div>

                            </div>
                        )}


                        {/* WALLET */}

                        {activeTab ===
                            "wallet" && (

                            <div className="profile-content-card p-4 p-md-5 animate-float-in">


                                {/* WALLET HOME */}

                                {gatewayStep ===
                                    "wallet" && (
                                    <>

                                        <div className="d-flex justify-content-between align-items-center mb-4">

                                            <h3 className="fw-bold mb-0">
                                                TechStore Pay Wallet
                                            </h3>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary rounded-pill"
                                                onClick={
                                                    refreshWallet
                                                }
                                                disabled={
                                                    walletLoading
                                                }
                                            >
                                                {walletLoading
                                                    ? "Refreshing..."
                                                    : "Refresh"}
                                            </button>

                                        </div>


                                        {/* ERROR */}

                                        {walletError && (

                                            <div className="alert alert-danger rounded-3">
                                                {walletError}
                                            </div>

                                        )}


                                        {/* BALANCE */}

                                        <div className="wallet-balance-banner p-4 mb-4 rounded-4 text-white">

                                            <div className="d-flex justify-content-between align-items-center">

                                                <div>

                                                    <span className="opacity-75 small d-block mb-1">
                                                        Available Balance
                                                    </span>

                                                    <h2 className="fw-bold mb-0">
                                                        {walletLoading
                                                            ? "Loading..."
                                                            : `₹${formatMoney(
                                                                walletBalance
                                                            )}`}
                                                    </h2>

                                                </div>

                                                <div className="wallet-card-icon">
                                                    <FaWallet />
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
                                                                    +₹{formatMoney(latestRefundAmt)} Credited to Your Wallet
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
                                                                ₹{formatMoney(walletBalance)}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}


                                        {/* WALLET STATS */}

                                        <div className="row g-3 mb-4">

                                            <div className="col-md-4">

                                                <div className="stats-box h-100">

                                                    <div className="stats-icon text-primary bg-primary bg-opacity-10 mb-2">
                                                        <FaWallet />
                                                    </div>

                                                    <h5 className="fw-bold">
                                                        ₹
                                                        {formatMoney(
                                                            promotionalBalance
                                                        )}
                                                    </h5>

                                                    <p>
                                                        Promotion Balance
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="col-md-4">

                                                <div className="stats-box h-100">

                                                    <div className="stats-icon text-success bg-success bg-opacity-10 mb-2">
                                                        <FaPlusCircle />
                                                    </div>

                                                    <h5 className="fw-bold">
                                                        ₹
                                                        {formatMoney(
                                                            totalAdded
                                                        )}
                                                    </h5>

                                                    <p>
                                                        Total Added
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="col-md-4">

                                                <div className="stats-box h-100">

                                                    <div className="stats-icon text-danger bg-danger bg-opacity-10 mb-2">
                                                        <FaCreditCard />
                                                    </div>

                                                    <h5 className="fw-bold">
                                                        ₹
                                                        {formatMoney(
                                                            totalSpent
                                                        )}
                                                    </h5>

                                                    <p>
                                                        Total Spent
                                                    </p>

                                                </div>

                                            </div>

                                        </div>


                                        {/* PROMOTIONS */}

                                        <div className="info-summary-box p-4 rounded-4 border mb-4">

                                            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                                <FaGift className="text-primary" />
                                                Active Promotions
                                            </h5>


                                            {/* MONTHLY PROMOTION */}

                                            <div className="border rounded-3 p-3 mb-3">

                                                <div className="d-flex justify-content-between align-items-center">

                                                    <div>

                                                        <span className="badge bg-primary mb-2">
                                                            Promotion
                                                        </span>

                                                        <h6 className="fw-bold mb-1">
                                                            Monthly Promotion
                                                        </h6>

                                                        <small className="text-muted">
                                                            ₹500 monthly promotion
                                                        </small>

                                                    </div>

                                                    <strong className="text-primary fs-5">
                                                        ₹
                                                        {formatMoney(
                                                            monthlyPromotion
                                                        )}
                                                    </strong>

                                                </div>


                                                {monthlyPromotionExpiry && (

                                                    <small className="text-danger d-block mt-2">
                                                        <FaClock className="me-1" />
                                                        Expires on{" "}
                                                        {formatDate(
                                                            monthlyPromotionExpiry
                                                        )}
                                                    </small>

                                                )}

                                            </div>


                                            {/* WELCOME PROMOTION */}

                                            <div className="border rounded-3 p-3">

                                                <div className="d-flex justify-content-between align-items-center">

                                                    <div>

                                                        <span className="badge bg-success mb-2">
                                                            Promotion
                                                        </span>

                                                        <h6 className="fw-bold mb-1">
                                                            Welcome Promotion
                                                        </h6>

                                                        <small className="text-muted">
                                                            ₹1000 welcome promotion
                                                        </small>

                                                    </div>

                                                    <strong className="text-success fs-5">
                                                        ₹
                                                        {formatMoney(
                                                            welcomePromotion
                                                        )}
                                                    </strong>

                                                </div>


                                                {welcomePromotionExpiry && (

                                                    <small className="text-danger d-block mt-2">
                                                        <FaClock className="me-1" />
                                                        Expires on{" "}
                                                        {formatDate(
                                                            welcomePromotionExpiry
                                                        )}
                                                    </small>

                                                )}

                                            </div>

                                        </div>


                                        {/* ADD MONEY */}

                                        <div className="info-summary-box p-4 rounded-4 border mb-4">

                                            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                                <FaPlusCircle className="text-primary" />
                                                Add Money to Wallet
                                            </h5>


                                            <form
                                                onSubmit={
                                                    handleProceedToPay
                                                }
                                            >

                                                <div className="row g-3">

                                                    <div className="col-md-8">

                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="1000000"
                                                            step="0.01"
                                                            className="form-control"
                                                            placeholder="Enter amount (e.g. 1000)"
                                                            value={
                                                                inputAmount
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                setInputAmount(
                                                                    event.target.value
                                                                )
                                                            }
                                                            required
                                                        />

                                                    </div>


                                                    <div className="col-md-4">

                                                        <button
                                                            type="submit"
                                                            className="btn btn-primary w-100 h-100 fw-bold rounded-pill"
                                                            disabled={
                                                                walletLoading
                                                            }
                                                        >
                                                            Proceed to Pay
                                                        </button>

                                                    </div>

                                                </div>

                                            </form>


                                            <small className="text-muted d-block mt-2">
                                                Money you add to your wallet does not expire.
                                            </small>

                                        </div>


                                        {/* TRANSACTIONS */}

                                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                            <FaHistory className="text-primary" />
                                            Transaction History
                                        </h5>


                                        <div className="transaction-list">

                                            {walletLoading ? (

                                                <div className="text-center py-4">

                                                    <FaSpinner
                                                        className="fa-spin text-primary mb-2"
                                                        size={24}
                                                    />

                                                    <p className="text-muted mb-0">
                                                        Loading transactions...
                                                    </p>

                                                </div>

                                            ) : transactions.length === 0 ? (

                                                <div className="text-center py-4 border rounded-3">

                                                    <FaHistory
                                                        className="text-muted mb-2"
                                                        size={25}
                                                    />

                                                    <p className="text-muted mb-0">
                                                        No wallet transactions yet.
                                                    </p>

                                                </div>

                                            ) : (

                                                transactions.map(
                                                    (txn) => {

                                                        const credit =
                                                            isCredit(
                                                                txn
                                                            );
                                                        const badgeLabel =
                                                            getTransactionBadge(
                                                                txn
                                                            );

                                                        return (
                                                            <div
                                                                className="transaction-item d-flex justify-content-between align-items-center gap-3 p-3 mb-2 rounded-3 border"
                                                                style={
                                                                    credit
                                                                        ? {
                                                                              background:
                                                                                  "rgba(16, 185, 129, 0.08)",
                                                                              borderColor:
                                                                                  "rgba(16, 185, 129, 0.35)",
                                                                          }
                                                                        : {
                                                                              background:
                                                                                  "rgba(239, 68, 68, 0.07)",
                                                                              borderColor:
                                                                                  "rgba(239, 68, 68, 0.35)",
                                                                          }
                                                                }
                                                                key={
                                                                    txn?.$id ||
                                                                    txn?.transactionId ||
                                                                    `${txn?.createdAt}-${txn?.amount}`
                                                                }
                                                            >

                                                                <div className="d-flex align-items-center gap-3 min-w-0">

                                                                    <div
                                                                        className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${
                                                                            credit
                                                                                ? "bg-success bg-opacity-10 text-success"
                                                                                : "bg-danger bg-opacity-10 text-danger"
                                                                        }`}
                                                                        style={{
                                                                            width: 42,
                                                                            height: 42,
                                                                        }}
                                                                    >
                                                                        <FaWallet className="fs-5" />
                                                                    </div>


                                                                    <div className="min-w-0">

                                                                        <h6 className="fw-bold mb-1">
                                                                            {getTransactionTitle(
                                                                                txn
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

                                                                        <small className="text-muted d-block">

                                                                            {formatDate(
                                                                                txn?.createdAt ||
                                                                                txn?.$createdAt
                                                                            )}

                                                                            {txn?.orderId
                                                                                ? ` • Order #${txn.orderId}`
                                                                                : ""}

                                                                            {" • "}

                                                                            ID:{" "}
                                                                            {txn?.transactionId ||
                                                                                txn?.$id ||
                                                                                "N/A"}

                                                                        </small>


                                                                        {txn?.promotionType && (

                                                                            <small
                                                                                className={`d-block fw-semibold ${
                                                                                    credit
                                                                                        ? "text-success"
                                                                                        : "text-danger"
                                                                                }`}
                                                                            >
                                                                                Promotion Type:{" "}
                                                                                {txn.promotionType}
                                                                            </small>

                                                                        )}

                                                                    </div>

                                                                </div>


                                                                <div
                                                                    className="text-end flex-shrink-0 ms-2"
                                                                    style={{
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    <div
                                                                        className={`fw-bold fs-6 ${
                                                                            credit
                                                                                ? "text-success"
                                                                                : "text-danger"
                                                                        }`}
                                                                    >
                                                                        {credit
                                                                            ? "+"
                                                                            : "-"}
                                                                        ₹
                                                                        {formatMoney(
                                                                            txn?.amount
                                                                        )}
                                                                    </div>
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
                                                        );
                                                    }
                                                )
                                            )}

                                        </div>

                                    </>
                                )}


                                {/* PAYMENT CHECKOUT */}

                                {gatewayStep ===
                                    "checkout" && (

                                    <form
                                        onSubmit={
                                            handleConfirmPayment
                                        }
                                    >

                                        <div className="d-flex align-items-center gap-2 mb-4">

                                            <button
                                                type="button"
                                                className="btn btn-light btn-sm border rounded-pill px-3"
                                                onClick={() =>
                                                    setGatewayStep(
                                                        "wallet"
                                                    )
                                                }
                                                disabled={
                                                    processingPayment
                                                }
                                            >
                                                <FaArrowLeft className="me-1" />
                                                Back
                                            </button>

                                            <h4 className="fw-bold mb-0 ms-2">
                                                Secure 3D Checkout
                                            </h4>

                                        </div>


                                        <div className="p-3 rounded-4 mb-4 border d-flex justify-content-between align-items-center info-summary-box">

                                            <div>

                                                <span className="text-muted small d-block">
                                                    Amount to Add
                                                </span>

                                                <h3 className="fw-bold text-primary mb-0">
                                                    ₹
                                                    {formatMoney(
                                                        inputAmount
                                                    )}
                                                </h3>

                                            </div>


                                            <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill">
                                                <FaLock className="me-1" />
                                                SSL Secure
                                            </span>

                                        </div>


                                        <label className="form-label fw-bold mb-3">
                                            Select Payment Method
                                        </label>


                                        <div className="d-flex flex-column gap-3 mb-4">

                                            {/* UPI */}

                                            <div
                                                className={`p-3 rounded-3 border d-flex align-items-center gap-3 transaction-item ${
                                                    paymentMethod ===
                                                    "UPI"
                                                        ? "border-primary bg-primary bg-opacity-10"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    !processingPayment &&
                                                    setPaymentMethod(
                                                        "UPI"
                                                    )
                                                }
                                                style={{
                                                    cursor:
                                                        processingPayment
                                                            ? "not-allowed"
                                                            : "pointer",
                                                }}
                                            >

                                                <FaQrcode className="fs-3 text-primary" />

                                                <div>

                                                    <h6 className="fw-bold mb-0">
                                                        UPI / QR (GPay, PhonePe, Paytm)
                                                    </h6>

                                                    <small className="text-muted">
                                                        Instant transfer via VPA
                                                    </small>

                                                </div>

                                            </div>


                                            {/* CARD */}

                                            <div
                                                className={`p-3 rounded-3 border d-flex align-items-center gap-3 transaction-item ${
                                                    paymentMethod ===
                                                    "Debit Card"
                                                        ? "border-primary bg-primary bg-opacity-10"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    !processingPayment &&
                                                    setPaymentMethod(
                                                        "Debit Card"
                                                    )
                                                }
                                                style={{
                                                    cursor:
                                                        processingPayment
                                                            ? "not-allowed"
                                                            : "pointer",
                                                }}
                                            >

                                                <FaCreditCard className="fs-3 text-primary" />

                                                <div>

                                                    <h6 className="fw-bold mb-0">
                                                        Debit / Credit Card
                                                    </h6>

                                                    <small className="text-muted">
                                                        Visa, Mastercard, RuPay
                                                    </small>

                                                </div>

                                            </div>

                                        </div>


                                        {/* PAYMENT INPUT */}

                                        {paymentMethod ===
                                            "UPI" ? (

                                            <div className="mb-4">

                                                <label className="form-label small fw-bold">
                                                    Enter UPI ID
                                                </label>

                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="username@okhdfcbank"
                                                    value={
                                                        upiId
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        setUpiId(
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={
                                                        processingPayment
                                                    }
                                                    required
                                                />

                                            </div>

                                        ) : (

                                            <div className="mb-4">

                                                <label className="form-label small fw-bold">
                                                    Card Number
                                                </label>

                                                <input
                                                    type="text"
                                                    className="form-control card-number-input"
                                                    placeholder="1234 5678 9123 4567"
                                                    maxLength="19"
                                                    value={
                                                        cardNumber
                                                    }
                                                    onChange={
                                                        handleCardNumberChange
                                                    }
                                                    disabled={
                                                        processingPayment
                                                    }
                                                    required
                                                />

                                            </div>

                                        )}


                                        <button
                                            type="submit"
                                            className="btn btn-success w-100 py-3 fw-bold rounded-pill shadow-sm"
                                            disabled={
                                                processingPayment
                                            }
                                        >

                                            {processingPayment ? (
                                                <>
                                                    <FaSpinner className="fa-spin me-2" />
                                                    Processing Payment...
                                                </>
                                            ) : (
                                                <>
                                                    Pay ₹
                                                    {formatMoney(
                                                        inputAmount
                                                    )}{" "}
                                                    Now
                                                </>
                                            )}

                                        </button>

                                    </form>
                                )}


                                {/* PROCESSING */}

                                {gatewayStep ===
                                    "processing" && (

                                    <div className="text-center py-5">

                                        <div
                                            className="spinner-border text-primary mb-4"
                                            role="status"
                                            style={{
                                                width: "4rem",
                                                height: "4rem",
                                            }}
                                        >
                                            <span className="visually-hidden">
                                                Loading...
                                            </span>
                                        </div>

                                        <h4 className="fw-bold mb-2">
                                            Authorizing Payment...
                                        </h4>

                                        <p className="text-muted small">
                                            Please do not refresh or leave this page.
                                        </p>

                                    </div>
                                )}


                                {/* SUCCESS */}

                                {gatewayStep ===
                                    "success" && (

                                    <div className="text-center py-4">

                                        <div
                                            className="text-success mb-3"
                                            style={{
                                                fontSize: "4.5rem",
                                            }}
                                        >
                                            <FaCheckCircle />
                                        </div>


                                        <h3 className="fw-bold mb-1">
                                            Payment Successful!
                                        </h3>


                                        <p className="text-muted small mb-4">
                                            Money has been credited to your wallet successfully.
                                        </p>


                                        <div className="p-3 rounded-3 border mb-4 text-start info-summary-box">

                                            <div className="d-flex justify-content-between mb-2">

                                                <span className="text-muted small">
                                                    Added Amount:
                                                </span>

                                                <strong className="text-success">
                                                    ₹
                                                    {formatMoney(
                                                        inputAmount
                                                    )}
                                                </strong>

                                            </div>


                                            <div className="d-flex justify-content-between mb-2">

                                                <span className="text-muted small">
                                                    Transaction ID:
                                                </span>

                                                <strong className="font-monospace">
                                                    {successTxnId}
                                                </strong>

                                            </div>


                                            <div className="d-flex justify-content-between">

                                                <span className="text-muted small">
                                                    Payment Mode:
                                                </span>

                                                <strong>
                                                    {paymentMethod}
                                                </strong>

                                            </div>


                                            <div className="d-flex justify-content-between mt-2">

                                                <span className="text-muted small">
                                                    New Wallet Balance:
                                                </span>

                                                <strong className="text-primary">
                                                    ₹
                                                    {formatMoney(
                                                        walletBalance
                                                    )}
                                                </strong>

                                            </div>

                                        </div>


                                        <button
                                            type="button"
                                            className="btn btn-primary w-100 py-3 fw-bold rounded-pill shadow-sm"
                                            onClick={
                                                handleReturnToWallet
                                            }
                                        >
                                            View Updated Wallet & History
                                        </button>

                                    </div>
                                )}

                            </div>
                        )}


                        {/* EDIT PROFILE */}

                        {activeTab ===
                            "edit" && (

                            <div className="profile-content-card p-4 p-md-5 animate-float-in">

                                <h3 className="fw-bold mb-4">
                                    Edit Profile Details
                                </h3>


                                <form
                                    onSubmit={
                                        saveProfile
                                    }
                                >

                                    <div className="row g-3">


                                        <div className="col-md-6 mb-3">

                                            <label className="form-label">
                                                Full Name
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                value={
                                                    name
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setName(
                                                        event.target.value
                                                    )
                                                }
                                                required
                                            />

                                        </div>


                                        <div className="col-md-6 mb-3">

                                            <label className="form-label">
                                                Email Address (Read-only)
                                            </label>

                                            <input
                                                type="email"
                                                className="form-control profile-readonly-input"
                                                value={
                                                    email
                                                }
                                                readOnly
                                                disabled
                                            />

                                        </div>


                                        <div className="col-md-6 mb-3">

                                            <label className="form-label">
                                                Phone Number
                                            </label>

                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Enter phone number"
                                                value={
                                                    phone
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPhone(
                                                        event.target.value
                                                    )
                                                }
                                            />

                                        </div>


                                        <div className="col-md-6 mb-3">

                                            <label className="form-label">
                                                Date of Birth
                                            </label>

                                            <input
                                                type="date"
                                                className="form-control"
                                                max={
                                                    todayStr
                                                }
                                                value={
                                                    dob
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setDob(
                                                        event.target.value
                                                    )
                                                }
                                            />

                                        </div>


                                        <div className="col-md-12 mb-4">

                                            <label className="form-label">
                                                Gender
                                            </label>

                                            <select
                                                className="form-select"
                                                value={
                                                    gender
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setGender(
                                                        event.target.value
                                                    )
                                                }
                                            >

                                                <option value="Male">
                                                    Male
                                                </option>

                                                <option value="Female">
                                                    Female
                                                </option>

                                                <option value="Other">
                                                    Other
                                                </option>

                                            </select>

                                        </div>

                                    </div>


                                    <button
                                        type="submit"
                                        className="btn btn-primary px-4 py-3 fw-bold rounded-pill"
                                    >
                                        Save Changes
                                    </button>

                                </form>

                            </div>
                        )}

                    </div>

                </div>

            </div>

        </div>
    );
}

export default Profile;