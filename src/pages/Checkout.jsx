import { useEffect, useMemo, useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  useNavigate,
  useLocation,
} from "react-router-dom";

import toast from "react-hot-toast";

import {
  FaUser,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCity,
  FaFlag,
  FaMailBulk,
  FaWallet,
  FaArrowRight,
  FaArrowLeft,
  FaShieldAlt,
  FaMoneyBillWave,
  FaQrcode,
  FaCreditCard,
  FaInfoCircle,
  FaGift,
  FaClock,
  FaCheckCircle,
  FaShoppingBag,
  FaTruck,
} from "react-icons/fa";

import "../css/Checkout.css";
import { scrollToPageTop } from "../components/ScrollToTop";

import authService from "../appwrite/authService";
import orderService from "../appwrite/orderService";
import couponService from "../appwrite/couponService";
import notificationService from "../appwrite/notificationService";
import walletService from "../appwrite/walletService";

import { clearCart } from "../redux/slices/cartSlice";


  // ORDER IDENTIFIERS

function generateOrderIdentifiers() {
  const ts = Date.now();

  return {
    orderId: "ORD" + ts,
    invoiceNo: "INV" + ts,
    transactionId: "TXN" + ts,
    orderDate: new Date(ts).toISOString(),
  };
}


  // MONEY FORMATTER

function formatMoney(value) {
  return Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}


  // NORMALIZE PROMOTIONS

function normalizePromotionDetails(data) {
  const result = {
    monthly: 0,
    welcome: 0,
    monthlyExpiry: null,
    welcomeExpiry: null,
  };

  if (!data) {
    return result;
  }

  /*
   * Current walletService versions may return:
   *
   * {
   *   monthly,
   *   welcome,
   *   monthlyExpiry,
   *   welcomeExpiry
   * }
   *
   * Older versions may return an array.
   *
   * This normalization keeps Checkout compatible
   * without changing the wallet service.
   */

  if (Array.isArray(data)) {
    for (const item of data) {
      const type = String(
        item?.promotionType ||
        item?.type ||
        item?.source ||
        ""
      )
        .trim()
        .toLowerCase();

      const amount = Number(
        item?.amount ||
        item?.balance ||
        item?.availableAmount ||
        item?.value ||
        0
      );

      const expiresAt =
        item?.expiresAt ||
        item?.expiry ||
        item?.expires ||
        null;

      if (
        type.includes("monthly") ||
        type.includes("month")
      ) {
        result.monthly += amount;

        if (
          expiresAt &&
          !result.monthlyExpiry
        ) {
          result.monthlyExpiry =
            expiresAt;
        }
      }

      if (
        type.includes("welcome")
      ) {
        result.welcome += amount;

        if (
          expiresAt &&
          !result.welcomeExpiry
        ) {
          result.welcomeExpiry =
            expiresAt;
        }
      }
    }

    return result;
  }

  result.monthly = Number(
    data?.monthly ||
    data?.monthlyPromotion ||
    0
  );

  result.welcome = Number(
    data?.welcome ||
    data?.welcomePromotion ||
    0
  );

  result.monthlyExpiry =
    data?.monthlyExpiry ||
    data?.monthlyPromotionExpiry ||
    null;

  result.welcomeExpiry =
    data?.welcomeExpiry ||
    data?.welcomePromotionExpiry ||
    null;

  return result;
}

  // CHECKOUT

function Checkout() {
  const navigate = useNavigate();

  useEffect(() => {
    scrollToPageTop();
    const timer = setTimeout(() => scrollToPageTop(), 80);
    return () => clearTimeout(timer);
  }, []);
  const dispatch = useDispatch();
  const location = useLocation();

  const cartItems = useSelector(
    (state) => state.cart.items
  );

  // CHECKOUT DATA

  const {
    subTotal = 0,
    shipping = 0,
    gst = 0,
    platformFee = 9,
    gstApplied = false,
    discount = 0,
    appliedCoupon = null,
  } = location.state || {};

  const fallbackCartGross = useMemo(() => {
    return (cartItems || []).reduce((acc, item) => {
      const price = Number(item?.price || 0);
      const disc = Number(item?.discount || 0);
      const qty = Number(item?.quantity || 1);
      const finalPrice = disc > 0 ? price - (price * disc) / 100 : price;
      return acc + finalPrice * qty;
    }, 0);
  }, [cartItems]);

  const safeSubTotal =
    Number(subTotal || 0) > 0
      ? Number(subTotal)
      : fallbackCartGross / 1.18;
  const safeShipping = Number(shipping || 0);
  const safeGST =
    Number(gst || 0) > 0
      ? Number(gst)
      : fallbackCartGross - fallbackCartGross / 1.18;
  const safePlatformFee = Number(
    platformFee ?? 9
  );
  const safeDiscount = Number(
    discount || 0
  );

  /*
   * Final ecommerce calculation:
   *
   * Subtotal
   * + Shipping
   * + GST
   * + Platform Fee
   * - Coupon Discount
   *
   * If GST has already been included/waived
   * by the previous checkout calculation,
   * GST is not added again.
   */

  const finalTotal = useMemo(() => {
    const gstAmount = gstApplied
      ? 0
      : safeGST;

    return Math.max(
      0,
      safeSubTotal +
        safeShipping +
        gstAmount +
        safePlatformFee -
        safeDiscount
    );
  }, [
    safeSubTotal,
    safeShipping,
    safeGST,
    safePlatformFee,
    safeDiscount,
    gstApplied,
  ]);


  // GENERAL STATE

  const [loading, setLoading] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [errors, setErrors] =
    useState({});

  const [savedAddresses, setSavedAddresses] =
    useState([]);

  const [selectedAddressId, setSelectedAddressId] =
    useState("");


  // WALLET STATE

  const [walletLoading, setWalletLoading] =
    useState(true);

  const [walletBalance, setWalletBalance] =
    useState(0);

  const [
    walletPromotionalBalance,
    setWalletPromotionalBalance,
  ] = useState(0);

  const [
    walletUserMoney,
    setWalletUserMoney,
  ] = useState(0);

  const [
    walletMonthlyPromotion,
    setWalletMonthlyPromotion,
  ] = useState(0);

  const [
    walletWelcomePromotion,
    setWalletWelcomePromotion,
  ] = useState(0);

  const [
    monthlyPromotionExpiry,
    setMonthlyPromotionExpiry,
  ] = useState(null);

  const [
    welcomePromotionExpiry,
    setWelcomePromotionExpiry,
  ] = useState(null);

  const [useWallet, setUseWallet] =
    useState(false);

  const [walletUsage, setWalletUsage] =
    useState({
      monthlyPromotion: 0,
      welcomePromotion: 0,
      userMoney: 0,
      total: 0,
    });


  // WALLET LIMIT

  /*
   * Minimum ₹9 should remain payable.
   */

  const maxWalletAllowed = Math.max(
    0,
    finalTotal - 9
  );


  // FORM STATE

  const [formData, setFormData] =
    useState({
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      payment: "COD",
    });


  // PAYMENT

  const isCOD =
    formData.payment === "COD";

  const isUPI =
    formData.payment === "UPI";

  const isCARD =
    formData.payment === "CARD";


  // WALLET USED

  const walletUsed = useWallet
    ? Number(walletUsage.total || 0)
    : 0;


  // REMAINING AMOUNT

  const remainingAmount = Math.max(
    0,
    finalTotal - walletUsed
  );


  // PAYABLE AMOUNT

  const payableAmount = isCOD
    ? Math.round(remainingAmount)
    : Number(remainingAmount.toFixed(2));


  // TOTAL ITEMS

  const totalItems = useMemo(
    () =>
      (cartItems || []).reduce(
        (total, item) =>
          total +
          Number(item?.quantity || 0),
        0
      ),
    [cartItems]
  );


  // LOAD CURRENT USER + WALLET

  useEffect(() => {
    let mounted = true;

    async function loadWallet() {
      try {
        setWalletLoading(true);

        const user =
          await authService.getCurrentUser();

        if (!mounted) return;

        if (!user) {
          setCurrentUser(null);
          setWalletLoading(false);
          return;
        }

        setCurrentUser(user);

        // Load previously used delivery addresses from user's past orders
        try {
          const ordersRes = await orderService.getOrdersByUser(user.$id);
          const docs = Array.isArray(ordersRes)
            ? ordersRes
            : ordersRes?.documents || [];

          const sortedDocs = [...docs].sort((a, b) => {
            const tA = new Date(a?.orderDate || a?.$createdAt || 0).getTime();
            const tB = new Date(b?.orderDate || b?.$createdAt || 0).getTime();
            return tB - tA;
          });

          const uniqueMap = new Map();
          for (const ord of sortedDocs) {
            const addrText = String(
              ord?.address || ord?.destinationAddress || ""
            ).trim();
            const cityText = String(
              ord?.city || ord?.destinationCity || ""
            ).trim();
            const stateText = String(
              ord?.state || ord?.destinationState || ""
            ).trim();
            const pinText = String(
              ord?.pincode || ord?.destinationPincode || ""
            )
              .replace(/\D/g, "")
              .slice(0, 6);
            const phoneText = String(ord?.phone || ord?.mobile || "")
              .replace(/\D/g, "")
              .slice(-10);
            const nameText = String(
              ord?.fullName || ord?.customerName || user?.name || ""
            ).trim();
            const emailText = String(
              ord?.email || ord?.customerEmail || user?.email || ""
            ).trim();

            if (!addrText || !cityText || !stateText || !pinText) continue;

            const dedupeKey = `${addrText.toLowerCase()}|${cityText.toLowerCase()}|${stateText.toLowerCase()}|${pinText}|${phoneText}`;
            if (!uniqueMap.has(dedupeKey)) {
              uniqueMap.set(dedupeKey, {
                id: `addr-${uniqueMap.size + 1}-${ord?.$id || Date.now()}`,
                fullName: nameText,
                email: emailText,
                phone: phoneText,
                state: stateText,
                city: cityText,
                pincode: pinText,
                address: addrText,
                orderId: ord?.orderId || ord?.$id || "",
              });
            }
          }

          const extracted = Array.from(uniqueMap.values()).slice(0, 2);
          if (mounted) {
            setSavedAddresses(extracted);
            if (extracted.length > 0) {
              const first = extracted[0];
              setSelectedAddressId(first.id);

              setFormData((prev) => {
                if (prev.address && prev.pincode) return prev;
                return {
                  ...prev,
                  fullName: first.fullName || user?.name || "",
                  email: first.email || user?.email || "",
                  phone: first.phone || "",
                  state: String(first.state || "").trim(),
                  city: String(first.city || "").trim(),
                  pincode: first.pincode || "",
                  address: first.address || "",
                };
              });
            } else {
              setFormData((prev) => ({
                ...prev,
                fullName: prev.fullName || user?.name || "",
                email: prev.email || user?.email || "",
              }));
            }
          }
        } catch (addrErr) {
          console.warn("Could not load previous order addresses:", addrErr);
        }


  // CREATE / LOAD WALLET

        const wallet =
          await walletService.getOrCreateWallet(
            user.$id
          );

        if (!mounted) return;


  // BALANCE

        setWalletBalance(
          Number(wallet?.balance || 0)
        );


  // PROMOTIONAL BALANCE

        setWalletPromotionalBalance(
          Number(
            wallet?.promotionalBalance || 0
          )
        );


  // USER MONEY

        let userMoney = 0;

        try {
          if (user?.$id) {
            userMoney =
              await walletService.getAvailableUserMoney(
                user.$id
              );
          }
        } catch {
          userMoney = Math.max(
            0,
            Number(wallet?.balance || 0) -
            Number(wallet?.promotionalBalance || 0)
          );
        }

        if (!mounted) return;

        setWalletUserMoney(
          Number(userMoney || 0)
        );


  // PROMOTIONS

        let promotionDetails = {
          monthly: 0,
          welcome: 0,
          monthlyExpiry: null,
          welcomeExpiry: null,
        };

        try {
          if (
            typeof walletService
              .getAvailablePromotionCredits ===
            "function"
          ) {
            const promotions =
              await walletService.getAvailablePromotionCredits(
                user.$id
              );

            promotionDetails =
              normalizePromotionDetails(
                promotions
              );
          }
        } catch (error) {
          console.warn(
            "Promotion details could not be loaded:",
            error
          );
        }

        if (!mounted) return;

        setWalletMonthlyPromotion(
          promotionDetails.monthly
        );

        setWalletWelcomePromotion(
          promotionDetails.welcome
        );

        setMonthlyPromotionExpiry(
          promotionDetails.monthlyExpiry
        );

        setWelcomePromotionExpiry(
          promotionDetails.welcomeExpiry
        );
      } catch (error) {
        console.error(
          "Wallet loading error:",
          error
        );

        if (mounted) {
          toast.error(
            "Unable to load wallet balance."
          );
        }
      } finally {
        if (mounted) {
          setWalletLoading(false);
        }
      }
    }

    loadWallet();

    return () => {
      mounted = false;
    };
  }, []);


  // CALCULATE WALLET USAGE

  useEffect(() => {
    let mounted = true;

    async function calculateUsage() {
      if (
        !useWallet ||
        !currentUser ||
        maxWalletAllowed <= 0
      ) {
        if (mounted) {
          setWalletUsage({
            monthlyPromotion: 0,
            welcomePromotion: 0,
            userMoney: 0,
            total: 0,
          });
        }

        return;
      }

      try {
        const usage =
          await walletService.calculateWalletUsage(
            currentUser.$id,
            maxWalletAllowed
          );

        if (!mounted) return;

        setWalletUsage({
          monthlyPromotion:
            Number(
              usage?.monthlyPromotion || 0
            ),

          welcomePromotion:
            Number(
              usage?.welcomePromotion || 0
            ),

          userMoney:
            Number(
              usage?.userMoney || 0
            ),

          total:
            Number(
              usage?.total || 0
            ),
        });
      } catch (error) {
        console.error(
          "Wallet usage calculation error:",
          error
        );

        if (mounted) {
          setWalletUsage({
            monthlyPromotion: 0,
            welcomePromotion: 0,
            userMoney: 0,
            total: 0,
          });

          toast.error(
            "Unable to calculate wallet usage."
          );
        }
      }
    }

    calculateUsage();

    return () => {
      mounted = false;
    };
  }, [
    useWallet,
    currentUser,
    maxWalletAllowed,
  ]);


  // INPUT HANDLER

  function handleSelectSavedAddress(addr) {
    if (!addr) return;
    setSelectedAddressId(addr.id);

    setFormData((prev) => ({
      ...prev,
      fullName: addr.fullName || prev.fullName || "",
      email: addr.email || prev.email || "",
      phone: String(addr.phone || "")
        .replace(/\D/g, "")
        .slice(-10),
      state: String(addr.state || "").trim(),
      city: String(addr.city || "").trim(),
      pincode: String(addr.pincode || "")
        .replace(/\D/g, "")
        .slice(0, 6),
      address: addr.address || "",
    }));
    setErrors({});
  }

  function handleUseNewAddress() {
    setSelectedAddressId("NEW");
    setFormData((prev) => ({
      ...prev,
      fullName: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: "",
      state: "",
      city: "",
      pincode: "",
      address: "",
    }));
    setErrors({});
  }

  function handleChange(e) {
    const {
      name,
      value,
    } = e.target;


  // PHONE

    if (name === "phone") {
      const numericValue =
        value
          .replace(/\D/g, "")
          .slice(0, 10);

      setFormData((prev) => ({
        ...prev,
        phone: numericValue,
      }));

      setErrors((prev) => ({
        ...prev,
        phone: "",
      }));

      return;
    }


  // PINCODE

    if (name === "pincode") {
      const numericValue =
        value
          .replace(/\D/g, "")
          .slice(0, 6);

      setFormData((prev) => ({
        ...prev,
        pincode: numericValue,
      }));

      setErrors((prev) => ({
        ...prev,
        pincode: "",
      }));

      return;
    }


  // STATE

    if (name === "state") {
      setFormData((prev) => ({
        ...prev,
        state: value,
      }));

      setErrors((prev) => ({
        ...prev,
        state: "",
      }));

      return;
    }


  // CITY

    if (name === "city") {
      setFormData((prev) => ({
        ...prev,
        city: value,
      }));

      setErrors((prev) => ({
        ...prev,
        city: "",
      }));

      return;
    }


  // PAYMENT

    if (name === "payment") {
      setFormData((prev) => ({
        ...prev,
        payment: value,
      }));

      return;
    }


  // NORMAL INPUT

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  }


  // VALIDATION

  function validate() {
    const newErrors = {};


    if (!formData.fullName.trim()) {
      newErrors.fullName =
        "Full Name is required";
    } else if (
      formData.fullName.trim().length < 2
    ) {
      newErrors.fullName =
        "Enter a valid full name";
    }


    if (!formData.email.trim()) {
      newErrors.email =
        "Email is required";
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(
        formData.email.trim()
      )
    ) {
      newErrors.email =
        "Invalid Email Address";
    }


    if (!formData.phone.trim()) {
      newErrors.phone =
        "Phone Number is required";
    } else if (
      !/^[0-9]{10}$/.test(
        formData.phone
      )
    ) {
      newErrors.phone =
        "Enter Valid 10 Digit Phone Number";
    }


    if (!formData.address.trim()) {
      newErrors.address =
        "Address is required";
    } else if (
      formData.address.trim().length < 5
    ) {
      newErrors.address =
        "Enter a complete delivery address";
    }


    if (!formData.state.trim()) {
      newErrors.state =
        "State is required";
    }


    if (!formData.city.trim()) {
      newErrors.city =
        "City is required";
    }


    if (!formData.pincode.trim()) {
      newErrors.pincode =
        "Pincode is required";
    } else if (
      !/^[1-9][0-9]{5}$/.test(
        formData.pincode
      )
    ) {
      newErrors.pincode =
        "Enter Valid 6 Digit Pincode";
    }


    setErrors(newErrors);

    return (
      Object.keys(newErrors).length === 0
    );
  }


  // WALLET TOGGLE

  function handleWalletToggle(e) {
    const checked =
      e.target.checked;

    if (!currentUser) {
      toast.error(
        "Please login first to use wallet."
      );

      return;
    }

    if (walletBalance <= 0) {
      toast.error(
        "Your wallet balance is ₹0."
      );

      return;
    }

    if (maxWalletAllowed <= 0) {
      toast.error(
        "Wallet cannot be applied because minimum ₹9 payable amount must remain."
      );

      return;
    }

    setUseWallet(checked);
  }


  // PLACE ORDER

  const handlePlaceOrder =
    async () => {
      if (loading) return;


  // CART VALIDATION

      if (
        !cartItems ||
        cartItems.length === 0
      ) {
        toast.error(
          "Your cart is empty."
        );

        navigate("/cart");

        return;
      }


  // FORM VALIDATION

      if (!validate()) {
        toast.error(
          "Please complete all shipping details."
        );

        return;
      }


  // WALLET LOADING

      if (walletLoading) {
        toast.error(
          "Please wait while wallet details are loading."
        );

        return;
      }


      setLoading(true);


      try {
  // CURRENT USER

        const user =
          currentUser ||
          (await authService.getCurrentUser());


        if (!user) {
          toast.error(
            "Please login first."
          );

          navigate("/login");

          return;
        }


  // REFRESH WALLET USAGE

        let finalWalletUsage = {
          monthlyPromotion: 0,
          welcomePromotion: 0,
          userMoney: 0,
          total: 0,
        };


        if (
          useWallet &&
          maxWalletAllowed > 0
        ) {
          const calculatedUsage =
            await walletService.calculateWalletUsage(
              user.$id,
              maxWalletAllowed
            );

          finalWalletUsage = {
            monthlyPromotion:
              Number(
                calculatedUsage?.monthlyPromotion ||
                0
              ),

            welcomePromotion:
              Number(
                calculatedUsage?.welcomePromotion ||
                0
              ),

            userMoney:
              Number(
                calculatedUsage?.userMoney ||
                0
              ),

            total:
              Number(
                calculatedUsage?.total ||
                0
              ),
          };

          setWalletUsage(
            finalWalletUsage
          );
        }


  // WALLET SAFETY CHECK

        const finalWalletPaid =
          useWallet
            ? Math.min(
                Number(
                  finalWalletUsage.total || 0
                ),
                Number(
                  maxWalletAllowed || 0
                )
              )
            : 0;


  // FINAL PAYMENT CALCULATION

        const finalRemainingAmount =
          Math.max(
            0,
            Number(finalTotal) -
              finalWalletPaid
          );


        const finalPayableAmount =
          isCOD
            ? Math.round(
                finalRemainingAmount
              )
            : Number(
                finalRemainingAmount.toFixed(
                  2
                )
              );


  // ORDER IDENTIFIERS

        const ids =
          generateOrderIdentifiers();


  // ORDER DATA

        const orderData = {
          userId:
            String(user.$id),

          fullName:
            formData.fullName.trim(),

          email:
            formData.email.trim(),

          phone:
            "+91 " +
            formData.phone,

          address:
            formData.address.trim(),

          city:
            formData.city,

          state:
            formData.state,

          pincode:
            formData.pincode,

          payment:
            formData.payment,

          paymentStatus:
            isCOD
              ? "COD_PENDING"
              : "PENDING",

          orderId:
            ids.orderId,

          invoiceNo:
            ids.invoiceNo,

          transactionId:
            ids.transactionId,

          orderDate:
            ids.orderDate,

          subTotal:
            Number(safeSubTotal),

          shipping:
            Number(safeShipping),

          gst:
            Number(safeGST),

          discount:
            Number(safeDiscount),

          total:
            Number(finalPayableAmount),

          // ===================================================
          // PAYMENT / GST / WALLET SNAPSHOT
          // These fields MUST be inside orderData because
          // orderService.addOrder() sends orderData to Appwrite.
          // ===================================================

          gstApplied:
            Boolean(gstApplied),

          platformFee:
            Number(safePlatformFee),

          orderGrandTotal:
            Number(finalTotal),

          payableAmount:
            Number(finalPayableAmount),

          walletPaid:
            Number(finalWalletPaid),

          walletMonthlyPromotionUsed:
            Number(
              finalWalletUsage.monthlyPromotion || 0
            ),

          walletWelcomePromotionUsed:
            Number(
              finalWalletUsage.welcomePromotion || 0
            ),

          walletUserMoneyUsed:
            Number(
              finalWalletUsage.userMoney || 0
            ),

          walletBalanceBefore:
            Number(walletBalance || 0),

          walletRemainingPayable:
            Number(finalPayableAmount),

          walletPaymentPending:
            finalWalletPaid > 0,

          upiPaid:
            isUPI
              ? Number(finalPayableAmount)
              : 0,

          cardPaid:
            isCARD
              ? Number(finalPayableAmount)
              : 0,

          onlinePaid:
            isUPI || isCARD
              ? Number(finalPayableAmount)
              : 0,

          totalPaid:
            isCOD
              ? Number(finalWalletPaid)
              : Number(
                  finalWalletPaid +
                  finalPayableAmount
                ),

          couponCode:
            appliedCoupon
              ? String(
                  appliedCoupon.couponCode ||
                  ""
                )
              : "",

          status:
            "Placed",

          items:
            JSON.stringify(
              cartItems
            ),
        };


  // SAVE ORDER
        //
        // COD:
        // shipment is created immediately.
        //
        // UPI/Card:
        // shipment is created only after payment succeeds.
        // =====================================================

  // APPWRITE ORDER PAYLOAD DEBUG
        console.log(
          "========== ORDER APPWRITE TEST =========="
        );
        console.table({
          databaseId:
            "6a62302900356784577e",
          collectionId:
            "orders",
          total:
            orderData.total,
          gstApplied:
            orderData.gstApplied,
          platformFee:
            orderData.platformFee,
          orderGrandTotal:
            orderData.orderGrandTotal,
          payableAmount:
            orderData.payableAmount,
          walletPaid:
            orderData.walletPaid,
          upiPaid:
            orderData.upiPaid,
          cardPaid:
            orderData.cardPaid,
          onlinePaid:
            orderData.onlinePaid,
          totalPaid:
            orderData.totalPaid,
        });
        console.log(
          "Full orderData:",
          orderData
        );
        console.log(
          "========== ORDER APPWRITE TEST END =========="
        );

        const savedOrder =
          await orderService.addOrder(
            orderData,
            {
              createShipment:
                isCOD,
            }
          );


        const savedOrderId =
          savedOrder?.$id ||
          orderData.orderId;


  // CUSTOMER ORDER PLACED NOTIFICATION

        try {
          await notificationService.createNotification(
            {
              userId:
                String(user.$id),

              type:
                "ORDER_PLACED",

              title:
                "Order Placed Successfully 🛒",

              message:
                `Your order ${orderData.orderId} has been placed successfully. ` +
                "We will notify you when your order status changes.",

              orderId:
                String(
                  orderData.orderId ||
                  ""
                ),

              shipmentId:
                String(
                  savedOrder?.shipment?.$id ||
                  savedOrder?.shipmentId ||
                  ""
                ),

              trackingId:
                String(
                  savedOrder?.trackingId ||
                  savedOrder?.shipment?.trackingId ||
                  ""
                ),

              isRead:
                false,

              createdAt:
                new Date().toISOString(),
            }
          );
        } catch (
          notificationError
        ) {
          console.error(
            "Order placed notification failed:",
            notificationError
          );
        }


  // FULL ORDER STATE

        const fullOrderState = {
          ...orderData,

          $id:
            savedOrder?.$id ||
            "",

          savedOrderId,

          gstApplied,

          platformFee:
            safePlatformFee,


  // ORIGINAL ORDER TOTAL

          orderGrandTotal:
            Number(finalTotal),


  // WALLET

          walletPaid:
            Number(finalWalletPaid),

          walletMonthlyPromotionUsed:
            Number(
              finalWalletUsage.monthlyPromotion ||
              0
            ),

          walletWelcomePromotionUsed:
            Number(
              finalWalletUsage.welcomePromotion ||
              0
            ),

          walletUserMoneyUsed:
            Number(
              finalWalletUsage.userMoney ||
              0
            ),

          walletBalanceBefore:
            Number(
              walletBalance || 0
            ),

          walletRemainingPayable:
            Number(
              finalPayableAmount
            ),

          walletPaymentPending:
            finalWalletPaid > 0,


  // PAYMENT

          upiPaid:
            isUPI
              ? Number(
                  finalPayableAmount
                )
              : 0,

          cardPaid:
            isCARD
              ? Number(
                  finalPayableAmount
                )
              : 0,

          codAmount:
            isCOD
              ? Number(
                  finalPayableAmount
                )
              : 0,

          onlinePaid:
            isUPI || isCARD
              ? Number(
                  finalPayableAmount
                )
              : 0,

          totalPaid:
            isCOD
              ? Number(
                  finalWalletPaid
                )
              : Number(
                  finalWalletPaid +
                  finalPayableAmount
                ),


  // ITEMS

          items:
            cartItems,


  // SHIPPING ADDRESS

          shippingAddress: {
            fullName:
              formData.fullName.trim(),

            phone:
              "+91 " +
              formData.phone,

            address:
              formData.address.trim(),

            city:
              formData.city,

            state:
              formData.state,

            pincode:
              formData.pincode,
          },


  // SHIPMENT

          shipment:
            savedOrder?.shipment ||
            null,

          trackingId:
            savedOrder?.trackingId ||
            null,

          courier:
            savedOrder?.courier ||
            null,

          warehouse:
            savedOrder?.warehouse ||
            null,

          estimatedDeliveryDate:
            savedOrder?.estimatedDeliveryDate ||
            null,
        };


  // COUPON USAGE

        if (appliedCoupon) {
          try {
            await couponService.increaseUsage(
              appliedCoupon.$id,
              appliedCoupon.usedCount
            );
          } catch (
            couponError
          ) {
            console.error(
              "Coupon usage update failed:",
              couponError
            );
          }
        }


  // CLEAR CART

        dispatch(
          clearCart()
        );


  // SUCCESS MESSAGE

        toast.success(
          "Order placed successfully!"
        );


  // PAYMENT NAVIGATION

        if (isCOD) {
          /*
           * CODPayment.jsx handles:
           * - final COD confirmation
           * - wallet deduction
           * - final confirmation
           */

          navigate(
            "/cod-payment",
            {
              state:
                fullOrderState,
              replace: true,
            }
          );

          return;
        }


        if (isUPI) {
          /*
           * UPIPayment.jsx handles:
           * - UPI payment
           * - wallet deduction after successful payment
           * - order paymentStatus = PAID
           * - shipment creation
           */

          navigate(
            "/upi-payment",
            {
              state:
                fullOrderState,
            }
          );

          return;
        }


        /*
         * CARD
         */

        navigate(
          "/card-payment",
          {
            state:
              fullOrderState,
          }
        );
      } catch (error) {
        console.error(
          "Place order error:",
          error
        );

        toast.error(
          error?.message ||
          "Failed to place order."
        );
      } finally {
        setLoading(false);
      }
    };


  // UI

  return (
    <div className="checkout-page-wrapper py-5">
      <div className="container">

        {/* PAGE HEADER */}

        <div className="mb-4 text-center text-lg-start">
          <div className="d-flex align-items-center justify-content-center justify-content-lg-start gap-2 mb-2">
            <FaShoppingBag className="text-primary" />

            <span className="small fw-semibold text-primary">
              Secure Shopping
            </span>
          </div>

          <h2 className="fw-bold checkout-main-title mb-1">
            Secure Checkout
          </h2>

          <p className="text-muted small mb-0">
            Complete your shipping and payment details
            to finalize your order securely.
          </p>
        </div>


        {/* CHECKOUT STEPS */}

        <div className="checkout-card mb-4">
          <div className="row g-3 text-center">

            <div className="col-4">
              <div className="d-flex flex-column align-items-center">
                <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center"
                  style={{
                    width: 38,
                    height: 38,
                  }}
                >
                  <FaCheckCircle size={17} />
                </div>

                <small className="fw-semibold mt-2">
                  Cart
                </small>
              </div>
            </div>


            <div className="col-4">
              <div className="d-flex flex-column align-items-center">
                <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                  style={{
                    width: 38,
                    height: 38,
                  }}
                >
                  <FaTruck size={16} />
                </div>

                <small className="fw-semibold mt-2">
                  Delivery
                </small>
              </div>
            </div>


            <div className="col-4">
              <div className="d-flex flex-column align-items-center">
                <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                  style={{
                    width: 38,
                    height: 38,
                  }}
                >
                  <FaShieldAlt size={16} />
                </div>

                <small className="fw-semibold mt-2">
                  Payment
                </small>
              </div>
            </div>

          </div>
        </div>


        {/* MAIN */}

        <div className="row g-4">


          {/* LEFT */}

          <div className="col-lg-8">

            {/* CUSTOMER INFORMATION */}

            <div className="checkout-card mb-4">

              <div className="d-flex align-items-center gap-2 mb-4">

                <div className="checkout-icon-box">
                  <FaUser className="text-primary" />
                </div>

                <div>
                  <h4 className="fw-bold mb-0">
                    Customer Information
                  </h4>

                  <small className="text-muted">
                    Where should we deliver your order?
                  </small>
                </div>

              </div>

              {savedAddresses.length > 0 && (
                <div className="checkout-saved-addresses-box mb-4">
                  <div className="checkout-saved-addresses-head">
                    <div>
                      <span className="checkout-saved-addresses-title">
                        <FaMapMarkerAlt className="me-1 text-primary" />
                        Saved Delivery Addresses
                      </span>
                      <small className="checkout-saved-addresses-sub d-block">
                        Select an address from your previous orders to auto-fill
                      </small>
                    </div>

                    <button
                      type="button"
                      className={`checkout-new-address-btn ${
                        selectedAddressId === "NEW" ? "active" : ""
                      }`}
                      onClick={handleUseNewAddress}
                    >
                      + New Address
                    </button>
                  </div>

                  <div className="checkout-saved-addresses-grid">
                    {savedAddresses.slice(0, 2).map((addr, idx) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          role="button"
                          tabIndex={0}
                          className={`checkout-saved-address-card ${
                            isSelected ? "active" : ""
                          }`}
                          onClick={() => handleSelectSavedAddress(addr)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectSavedAddress(addr);
                            }
                          }}
                        >
                          <div className="checkout-saved-address-top">
                            <div className="d-flex align-items-center gap-2 min-w-0">
                              <span
                                className={`checkout-saved-address-radio ${
                                  isSelected ? "checked" : ""
                                }`}
                              />
                              <strong className="text-truncate">
                                {addr.fullName || "Saved Address"}
                              </strong>
                            </div>
                            {idx === 0 && (
                              <span className="checkout-saved-address-badge">
                                Recent
                              </span>
                            )}
                          </div>

                          <p className="checkout-saved-address-text mb-1">
                            {addr.address}, {addr.city}, {addr.state} -{" "}
                            <strong>{addr.pincode}</strong>
                          </p>

                          {addr.phone && (
                            <small className="checkout-saved-address-phone">
                              Phone: +91 {addr.phone}
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              <div className="row g-3">

                {/* FULL NAME */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    Full Name
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0">
                      <FaUser
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="e.g. John Doe"
                      name="fullName"
                      value={
                        formData.fullName
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.fullName}
                  </small>

                </div>


                {/* EMAIL */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    Email Address
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0">
                      <FaEnvelope
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <input
                      type="email"
                      className="form-control border-start-0 ps-0"
                      placeholder="john@example.com"
                      name="email"
                      value={
                        formData.email
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.email}
                  </small>

                </div>


                {/* PHONE */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    Phone Number
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0 fw-semibold text-secondary px-3">
                      +91
                    </span>

                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="9876543210"
                      name="phone"
                      value={
                        formData.phone
                      }
                      onChange={
                        handleChange
                      }
                      maxLength={10}
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.phone}
                  </small>

                </div>


                {/* STATE */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    State
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0">
                      <FaFlag
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Enter State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.state}
                  </small>

                </div>


                {/* CITY */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    City
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0">
                      <FaCity
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Enter City"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.city}
                  </small>

                </div>


                {/* PINCODE */}

                <div className="col-md-6">

                  <label className="form-label small fw-bold">
                    Pincode
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0">
                      <FaMailBulk
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="6-digit pincode"
                      name="pincode"
                      value={
                        formData.pincode
                      }
                      onChange={
                        handleChange
                      }
                      maxLength={6}
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.pincode}
                  </small>

                </div>


                {/* ADDRESS */}

                <div className="col-12">

                  <label className="form-label small fw-bold">
                    Street Address
                  </label>

                  <div className="input-group shadow-sm">

                    <span className="input-group-text bg-light border-end-0 align-items-start pt-3">
                      <FaMapMarkerAlt
                        size={14}
                        className="text-muted"
                      />
                    </span>

                    <textarea
                      rows="3"
                      className="form-control border-start-0 ps-0"
                      placeholder="House no., Street name, Landmark"
                      name="address"
                      value={
                        formData.address
                      }
                      onChange={
                        handleChange
                      }
                    />

                  </div>

                  <small className="text-danger mt-1 d-block">
                    {errors.address}
                  </small>

                </div>

              </div>

            </div>


            {/* PAYMENT */}

            <div className="checkout-card">

              <div className="d-flex align-items-center gap-2 mb-2">

                <div className="checkout-icon-box">
                  <FaCreditCard className="text-primary" />
                </div>

                <div>
                  <h4 className="fw-bold mb-0">
                    Payment Method
                  </h4>

                  <small className="text-muted">
                    Select your preferred payment option
                  </small>
                </div>

              </div>


              <div className="payment-options mt-4">


                {/* COD */}

                <label
                  className={`payment-option ${
                    formData.payment ===
                    "COD"
                      ? "active"
                      : ""
                  }`}
                >

                  <div className="d-flex align-items-center gap-3">

                    <input
                      type="radio"
                      name="payment"
                      value="COD"
                      checked={
                        formData.payment ===
                        "COD"
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <div className="payment-icon-wrap bg-success-subtle text-success">

                      <FaMoneyBillWave
                        size={18}
                      />

                    </div>

                    <div>

                      <span className="d-block fw-bold">
                        Cash On Delivery
                      </span>

                      <small className="text-muted">
                        Pay when your order arrives
                      </small>

                    </div>

                  </div>

                </label>


                {/* UPI */}

                <label
                  className={`payment-option ${
                    formData.payment ===
                    "UPI"
                      ? "active"
                      : ""
                  }`}
                >

                  <div className="d-flex align-items-center gap-3">

                    <input
                      type="radio"
                      name="payment"
                      value="UPI"
                      checked={
                        formData.payment ===
                        "UPI"
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <div className="payment-icon-wrap bg-primary-subtle text-primary">

                      <FaQrcode
                        size={18}
                      />

                    </div>

                    <div>

                      <span className="d-block fw-bold">
                        UPI Payment
                      </span>

                      <small className="text-muted">
                        Google Pay, PhonePe, Paytm, BHIM
                      </small>

                    </div>

                  </div>

                </label>


                {/* CARD */}

                <label
                  className={`payment-option ${
                    formData.payment ===
                    "CARD"
                      ? "active"
                      : ""
                  }`}
                >

                  <div className="d-flex align-items-center gap-3">

                    <input
                      type="radio"
                      name="payment"
                      value="CARD"
                      checked={
                        formData.payment ===
                        "CARD"
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <div className="payment-icon-wrap bg-warning-subtle text-warning">

                      <FaCreditCard
                        size={18}
                      />

                    </div>

                    <div>

                      <span className="d-block fw-bold">
                        Debit / Credit Card
                      </span>

                      <small className="text-muted">
                        Visa, Mastercard, RuPay & more
                      </small>

                    </div>

                  </div>

                </label>

              </div>


              {/* SECURITY */}

              <div className="mt-4 p-3 rounded-3 bg-light border">

                <div className="d-flex align-items-start gap-3">

                  <FaShieldAlt
                    className="text-success mt-1"
                  />

                  <div>

                    <strong className="small">
                      Secure Payment
                    </strong>

                    <p className="small text-muted mb-0 mt-1">
                      Your payment details are processed
                      securely. Your wallet is deducted
                      only after successful payment.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* RIGHT */}

          <div className="col-lg-4">

            <div className="checkout-summary">


              {/* SUMMARY HEADER */}

              <div className="d-flex align-items-center justify-content-between mb-3">

                <h4 className="fw-bold mb-0">
                  Order Summary
                </h4>

                <span className="badge bg-primary-subtle text-primary">
                  {totalItems} Items
                </span>

              </div>

              <div className="summary-divider mb-4"></div>


              {/* COUPON */}

              {appliedCoupon && (
                <div className="coupon-applied-alert mb-4 d-flex align-items-center justify-content-between p-3 rounded-3">

                  <div>

                    <div className="d-flex align-items-center gap-2">

                      <FaGift />

                      <span className="fw-bold">
                        {appliedCoupon.couponCode}
                      </span>

                    </div>

                    <small>
                      Coupon applied successfully
                    </small>

                  </div>

                  <FaCheckCircle />

                </div>
              )}


              {/* ITEM COUNT */}

              <div className="summary-row">

                <span className="summary-label">
                  Total Items
                </span>

                <span className="summary-value">
                  {totalItems}
                </span>

              </div>


              {/* SUBTOTAL */}

              <div className="summary-row">

                <span className="summary-label">
                  Subtotal
                </span>

                <span className="summary-value">
                  ₹{formatMoney(safeSubTotal)}
                </span>

              </div>


              {/* SHIPPING */}

              <div className="summary-row">

                <span className="summary-label">
                  Shipping
                </span>

                <span className="summary-value text-success fw-bold">

                  {safeShipping === 0
                    ? "FREE"
                    : `₹${formatMoney(
                        safeShipping
                      )}`}

                </span>

              </div>


              {/* GST */}

              <div className="summary-row">

                <span className="summary-label">
                  GST
                </span>

                <span
                  className={`summary-value ${
                    gstApplied
                      ? "text-success"
                      : ""
                  }`}
                >

                  {gstApplied
                    ? "Included"
                    : `₹${formatMoney(
                        safeGST
                      )}`}

                </span>

              </div>


              {/* PLATFORM FEE */}

              <div className="summary-row align-items-start">

                <div>

                  <span className="summary-label">
                    Platform Fee
                  </span>

                  <div className="text-muted platform-fee-note d-flex align-items-center gap-1">

                    <FaInfoCircle
                      size={10}
                    />

                    Non-refundable platform charge

                  </div>

                </div>

                <span className="summary-value">
                  ₹{formatMoney(
                    safePlatformFee
                  )}
                </span>

              </div>


              {/* DISCOUNT */}

              {safeDiscount > 0 && (
                <div className="summary-row">

                  <span className="summary-label text-danger fw-bold">
                    Coupon Savings
                  </span>

                  <span className="summary-value text-danger fw-bold">
                    - ₹{formatMoney(
                      safeDiscount
                    )}
                  </span>

                </div>
              )}


              <div className="summary-divider my-3"></div>


              {/* ORDER GRAND TOTAL BEFORE WALLET */}

              <div className="summary-row">

                <span className="summary-label fw-semibold">
                  Order Total
                </span>

                <span className="summary-value fw-bold">
                  ₹{formatMoney(
                    finalTotal
                  )}
                </span>

              </div>


              {/* WALLET */}

              <div className="wallet-box p-3 rounded-4 mb-3 mt-3">

                <div className="d-flex justify-content-between align-items-center mb-2">

                  <span className="fw-bold d-flex align-items-center gap-2">

                    <FaWallet className="text-warning" />

                    Wallet Balance

                  </span>

                  <strong className="text-success">

                    {walletLoading
                      ? "Loading..."
                      : `₹${formatMoney(
                          walletBalance
                        )}`}

                  </strong>

                </div>


                {/* PROMOTIONAL BALANCE */}

                {!walletLoading &&
                  walletPromotionalBalance >
                    0 && (
                    <div className="small text-primary d-flex align-items-center gap-2 mb-2">

                      <FaGift />

                      <span>
                        Promotion: ₹
                        {formatMoney(
                          walletPromotionalBalance
                        )}
                      </span>

                    </div>
                  )}


                {/* MONTHLY */}

                {!walletLoading &&
                  walletMonthlyPromotion >
                    0 && (
                    <div className="small text-muted mb-1">

                      <strong className="text-primary">
                        Monthly Promotion:
                      </strong>{" "}
                      ₹
                      {formatMoney(
                        walletMonthlyPromotion
                      )}

                      {monthlyPromotionExpiry && (
                        <span className="d-block text-danger">

                          <FaClock className="me-1" />

                          Expires{" "}
                          {new Date(
                            monthlyPromotionExpiry
                          ).toLocaleDateString(
                            "en-IN"
                          )}

                        </span>
                      )}

                    </div>
                  )}


                {/* WELCOME */}

                {!walletLoading &&
                  walletWelcomePromotion >
                    0 && (
                    <div className="small text-muted mb-2">

                      <strong className="text-primary">
                        Welcome Promotion:
                      </strong>{" "}
                      ₹
                      {formatMoney(
                        walletWelcomePromotion
                      )}

                      {welcomePromotionExpiry && (
                        <span className="d-block text-danger">

                          <FaClock className="me-1" />

                          Expires{" "}
                          {new Date(
                            welcomePromotionExpiry
                          ).toLocaleDateString(
                            "en-IN"
                          )}

                        </span>
                      )}

                    </div>
                  )}


                {/* USER MONEY */}

                {!walletLoading &&
                  walletUserMoney >
                    0 && (
                    <div className="small text-muted mb-2">

                      <span className="fw-semibold">
                        Wallet Money:
                      </span>{" "}
                      ₹
                      {formatMoney(
                        walletUserMoney
                      )}

                      <span className="d-block text-success">
                        Does not expire
                      </span>

                    </div>
                  )}


                {/* CHECKBOX */}

                <div className="form-check m-0">

                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="walletCheck"
                    checked={
                      useWallet
                    }
                    onChange={
                      handleWalletToggle
                    }
                    disabled={
                      walletLoading ||
                      !currentUser ||
                      walletBalance <= 0 ||
                      maxWalletAllowed <= 0
                    }
                  />

                  <label
                    htmlFor="walletCheck"
                    className="form-check-label small fw-semibold cursor-pointer"
                  >
                    Use Wallet Balance for this order
                  </label>

                </div>


                {walletBalance <=
                  0 &&
                  !walletLoading && (
                    <small className="text-muted d-block mt-2">
                      Your wallet currently has no
                      available balance.
                    </small>
                  )}


                {maxWalletAllowed <=
                  0 &&
                  !walletLoading && (
                    <small className="text-muted d-block mt-2">
                      Minimum ₹9 payable amount must
                      remain after wallet usage.
                    </small>
                  )}

              </div>


              {/* WALLET USAGE */}

              {useWallet &&
                walletUsed > 0 && (
                  <div className="mb-3">

                    {walletUsage.monthlyPromotion >
                      0 && (
                      <div className="summary-row text-primary small">

                        <span>
                          Monthly Promotion
                        </span>

                        <span>
                          - ₹
                          {formatMoney(
                            walletUsage.monthlyPromotion
                          )}
                        </span>

                      </div>
                    )}


                    {walletUsage.welcomePromotion >
                      0 && (
                      <div className="summary-row text-primary small">

                        <span>
                          Welcome Promotion
                        </span>

                        <span>
                          - ₹
                          {formatMoney(
                            walletUsage.welcomePromotion
                          )}
                        </span>

                      </div>
                    )}


                    {walletUsage.userMoney >
                      0 && (
                      <div className="summary-row text-success small">

                        <span>
                          Wallet Money
                        </span>

                        <span>
                          - ₹
                          {formatMoney(
                            walletUsage.userMoney
                          )}
                        </span>

                      </div>
                    )}


                    <div className="summary-row text-danger fw-bold small">

                      <span>
                        Total Wallet Used
                      </span>

                      <span>
                        - ₹
                        {formatMoney(
                          walletUsed
                        )}
                      </span>

                    </div>

                  </div>
                )}


              <div className="summary-divider my-3"></div>


              {/* FINAL PAYMENT */}

              <div className="summary-row summary-total-row mb-3">

                <div>

                  <span className="fw-bold d-block">
                    {isCOD
                      ? "Cash To Pay"
                      : "Amount To Pay"}
                  </span>

                  {walletUsed > 0 && (
                    <small
                      className="text-success fw-normal"
                      style={{
                        fontSize:
                          "11px",
                      }}
                    >
                      Wallet applied
                    </small>
                  )}

                  {isCOD && (
                    <small
                      className="text-muted fw-normal d-block"
                      style={{
                        fontSize:
                          "11px",
                      }}
                    >
                      Rounded cash amount
                    </small>
                  )}

                </div>


                <span className="summary-price-highlight">

                  ₹
                  {isCOD
                    ? Number(
                        payableAmount
                      ).toLocaleString(
                        "en-IN"
                      )
                    : Number(
                        payableAmount
                      ).toLocaleString(
                        "en-IN",
                        {
                          minimumFractionDigits:
                            2,
                          maximumFractionDigits:
                            2,
                        }
                      )}

                </span>

              </div>


              {/* PAYMENT BREAKDOWN */}

              <div className="p-3 rounded-3 border bg-light mb-3">

                <div className="d-flex justify-content-between small mb-2">

                  <span className="text-muted">
                    Order Total
                  </span>

                  <strong>
                    ₹
                    {formatMoney(
                      finalTotal
                    )}
                  </strong>

                </div>


                {walletUsed > 0 && (
                  <div className="d-flex justify-content-between small mb-2">

                    <span className="text-success">
                      Wallet Used
                    </span>

                    <strong className="text-success">
                      - ₹
                      {formatMoney(
                        walletUsed
                      )}
                    </strong>

                  </div>
                )}


                <div className="d-flex justify-content-between fw-bold">

                  <span>
                    {isCOD
                      ? "Cash To Pay"
                      : isUPI
                      ? "UPI Payment"
                      : "Card Payment"}
                  </span>

                  <span className="text-primary">
                    ₹
                    {formatMoney(
                      payableAmount
                    )}
                  </span>

                </div>

              </div>


              {/* PAYMENT METHOD BADGE */}

              <div className="mb-3">

                <div className="small text-muted mb-2">
                  Selected Payment Method
                </div>

                <div className="d-flex align-items-center gap-2 p-2 rounded-3 border bg-white">

                  {isCOD && (
                    <>
                      <FaMoneyBillWave className="text-success" />

                      <strong className="small">
                        Cash On Delivery
                      </strong>
                    </>
                  )}

                  {isUPI && (
                    <>
                      <FaQrcode className="text-primary" />

                      <strong className="small">
                        UPI Payment
                      </strong>
                    </>
                  )}

                  {isCARD && (
                    <>
                      <FaCreditCard className="text-warning" />

                      <strong className="small">
                        Debit / Credit Card
                      </strong>
                    </>
                  )}

                </div>

              </div>


              {/* PLACE ORDER */}

              <button
                className="btn btn-primary place-order-btn w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow mb-3"
                onClick={
                  handlePlaceOrder
                }
                disabled={
                  loading ||
                  walletLoading ||
                  !cartItems?.length
                }
              >

                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                    ></span>

                    Processing Order...
                  </>
                ) : walletLoading ? (
                  "Loading Wallet..."
                ) : (
                  <>
                    {isCOD
                      ? "Proceed to COD"
                      : isUPI
                      ? "Proceed to UPI Payment"
                      : "Proceed to Card Payment"}

                    <FaArrowRight
                      size={14}
                    />
                  </>
                )}

              </button>


              {/* BACK */}

              <button
                className="btn btn-outline-secondary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 back-btn"
                onClick={() =>
                  navigate("/cart")
                }
                disabled={loading}
              >

                <FaArrowLeft
                  size={13}
                />

                Back to Cart

              </button>


              {/* SECURITY */}

              <div className="text-center mt-4">

                <div className="d-flex justify-content-center align-items-center gap-2 text-success small fw-semibold">

                  <FaShieldAlt />

                  Secure Checkout

                </div>

                <small className="text-muted d-block mt-1">
                  Your order information is securely
                  processed through Appwrite.
                </small>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}


export default Checkout;