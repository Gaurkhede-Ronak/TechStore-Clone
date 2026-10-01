import { useLocation, useNavigate } from "react-router-dom";
import {
  FaMoneyBillWave,
  FaTruck,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaWallet,
  FaCheckCircle,
  FaSpinner,
} from "react-icons/fa";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import walletService from "../appwrite/walletService";

import "../css/Payment.css";

function CODPayment() {
  const navigate = useNavigate();
  const location = useLocation();

  const order = useMemo(() => location.state || {}, [location.state]);

  const [processing, setProcessing] = useState(false);

  // PAYMENT AMOUNTS

  const paymentAmounts = useMemo(() => {
    const walletPaid = Math.max(
      0,
      Number(order.walletPaid ?? 0)
    );

    const rawGrandTotal = Number(
      order.orderGrandTotal ??
        order.grandTotal ??
        order.totalBeforeWallet ??
        order.finalTotal ??
        0
    );

    const rawPayableAmount = Number(
      order.payableAmount ??
        order.codAmount ??
        order.total ??
        0
    );

    const calculatedGrandTotal =
      rawGrandTotal > 0
        ? rawGrandTotal
        : rawPayableAmount + walletPaid;

    const orderGrandTotal = Math.max(
      0,
      Number(calculatedGrandTotal.toFixed(2))
    );

    const safeWalletPaid = Math.min(
      walletPaid,
      orderGrandTotal
    );

    const codAmount = Math.max(
      0,
      Number(
        (
          orderGrandTotal - safeWalletPaid
        ).toFixed(2)
      )
    );

    const totalPaid = Number(
      (safeWalletPaid + codAmount).toFixed(2)
    );

    return {
      orderGrandTotal,
      walletPaid: safeWalletPaid,
      codAmount,
      totalPaid,
    };
  }, [order]);

  const {
    orderGrandTotal,
    walletPaid,
    codAmount,
    totalPaid,
  } = paymentAmounts;

  // DELIVERY DATE

  const deliveryDate = useMemo(() => {
    const date = new Date();

    date.setDate(date.getDate() + 5);

    return date;
  }, []);

  // FORMAT MONEY

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // CONFIRM ORDER

  async function confirmOrder() {
    if (processing) {
      return;
    }

    if (
      !order?.orderId &&
      !order?.$id
    ) {
      toast.error(
        "Order information is missing."
      );

      return;
    }

    if (
      walletPaid > 0 &&
      !order?.userId
    ) {
      toast.error(
        "User information is missing. Please try checkout again."
      );

      return;
    }

    setProcessing(true);

    try {
  // DEDUCT WALLET

      let walletResult = null;

      const walletTransactionId =
        order.walletTransactionId ||
        `${
          order.transactionId ||
          order.orderId ||
          order.$id ||
          Date.now()
        }-WALLET`;

      if (walletPaid > 0) {
        walletResult =
          await walletService.deductMoney(
            order.userId,
            walletPaid,
            {
              source: "order",

              orderId:
                order.orderId ||
                order.$id ||
                "",

              transactionId:
                walletTransactionId,

              description:
                `Wallet Payment for Order ${
                  order.orderId ||
                  order.$id ||
                  ""
                }`,
            }
          );
      }

  // WALLET USAGE DETAILS

      const monthlyPromotionUsed = Number(
        walletResult?.monthlyPromotion ??
          order.walletMonthlyPromotionUsed ??
          0
      );

      const welcomePromotionUsed = Number(
        walletResult?.welcomePromotion ??
          order.walletWelcomePromotionUsed ??
          0
      );

      const userMoneyUsed = Number(
        walletResult?.userMoney ??
          order.walletUserMoneyUsed ??
          0
      );

      const walletBalanceAfter =
        walletResult?.wallet?.balance ??
        order.walletBalanceAfter ??
        null;

  // FINAL ORDER STATE

      const finalOrder = {
        ...order,

  // PAYMENT

        payment: "COD",

        paymentStatus:
          order.paymentStatus ||
          "COD_PENDING",

        paymentCompletedAt:
          null,

  // TOTALS

        orderGrandTotal,

        totalOrderAmount:
          orderGrandTotal,

        payableAmount:
          codAmount,

        codAmount,

        totalPaid,

  // WALLET

        walletPaid,

        walletTransactionId:
          walletResult?.transactionId ||
          walletTransactionId,

        walletMonthlyPromotionUsed:
          monthlyPromotionUsed,

        walletWelcomePromotionUsed:
          welcomePromotionUsed,

        walletUserMoneyUsed:
          userMoneyUsed,

        walletBalanceAfter,

        walletPaymentCompletedAt:
          walletPaid > 0
            ? new Date().toISOString()
            : null,

  // ONLINE PAYMENT

        onlinePaid: 0,

        upiPaid: 0,

        cardPaid: 0,

  // PAYMENT BREAKDOWN

        paymentBreakdown: {
          wallet: walletPaid,
          cod: codAmount,
          upi: 0,
          card: 0,
          online: 0,
          total: totalPaid,
          orderTotal: orderGrandTotal,
        },

  // COD DETAILS

        codPayment: {
          amount: codAmount,
          status: "PENDING",
          paymentMethod: "COD",
        },
      };

  // SUCCESS

      toast.success(
        walletPaid > 0
          ? "Order Confirmed & Wallet Updated!"
          : "Order Confirmed"
      );

      navigate(
        "/order-confirmed",
        {
          state: finalOrder,
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "COD confirmation error:",
        error
      );

      toast.error(
        error?.message ||
          "Unable to confirm order. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  // UI

  return (
    <div className="container py-5">
      <div className="payment-card">

        {/* HEADER */}

        <div className="text-center">
          <FaMoneyBillWave
            size={70}
            className="payment-icon"
          />

          <h2 className="mt-3">
            Cash On Delivery
          </h2>

          <p className="text-muted">
            Pay when your order reaches
            your doorstep.
          </p>
        </div>

        <hr />

        {/* ORDER ID */}

        <div className="payment-row">
          <span>
            Order ID
          </span>

          <strong>
            {order.orderId ||
              order.$id ||
              "N/A"}
          </strong>
        </div>

        {/* ORDER TOTAL */}

        <div className="payment-row">
          <span>
            Total Order Amount
          </span>

          <strong>
            ₹{formatMoney(orderGrandTotal)}
          </strong>
        </div>

        {/* WALLET PAYMENT */}

        {walletPaid > 0 && (
          <>
            <div className="payment-row">
              <span className="d-flex align-items-center gap-2">
                <FaWallet className="text-warning" />

                Wallet Used
              </span>

              <strong className="text-success">
                - ₹{formatMoney(walletPaid)}
              </strong>
            </div>

            <div className="payment-row">
              <span>
                Cash To Pay
              </span>

              <strong className="text-primary">
                ₹{formatMoney(codAmount)}
              </strong>
            </div>
          </>
        )}

        {/* COD AMOUNT */}

        <div className="payment-row">
          <span>
            COD Amount
          </span>

          <strong>
            ₹{formatMoney(codAmount)}
          </strong>
        </div>

        {/* TOTAL PAID */}

        <div className="payment-row">
          <span>
            Total Paid
          </span>

          <strong className="text-success">
            ₹{formatMoney(totalPaid)}
          </strong>
        </div>

        {/* PAYMENT METHOD */}

        <div className="payment-row">
          <span>
            Payment Method
          </span>

          <strong>
            {walletPaid > 0
              ? "COD + Wallet"
              : "Cash On Delivery"}
          </strong>
        </div>

        {/* PAYMENT BREAKDOWN */}

        <div className="payment-row">
          <span>
            Payment Breakdown
          </span>

          <strong>
            {walletPaid > 0
              ? `Wallet ₹${formatMoney(
                  walletPaid
                )} + COD ₹${formatMoney(
                  codAmount
                )}`
              : `COD ₹${formatMoney(
                  codAmount
                )}`}
          </strong>
        </div>

        {/* DELIVERY */}

        <div className="payment-row">
          <span className="d-flex align-items-center gap-2">
            <FaTruck />

            Estimated Delivery
          </span>

          <strong>
            {deliveryDate.toDateString()}
          </strong>
        </div>

        {/* ADDRESS */}

        <div className="address-box">
          <h5>
            <FaMapMarkerAlt />{" "}
            Shipping Address
          </h5>

          <p>
            {order.fullName ||
              order.shippingAddress?.fullName ||
              "N/A"}
          </p>

          <p>
            {order.address ||
              order.shippingAddress?.address ||
              "N/A"}
          </p>

          <p>
            {order.city ||
              order.shippingAddress?.city ||
              "N/A"}
            ,{" "}
            {order.state ||
              order.shippingAddress?.state ||
              "N/A"}
          </p>

          <p>
            {order.pincode ||
              order.shippingAddress?.pincode ||
              "N/A"}
          </p>

          <p>
            {order.phone ||
              order.shippingAddress?.phone ||
              "N/A"}
          </p>
        </div>

        {/* CONFIRM BUTTON */}

        <button
          className="btn btn-success w-100 mt-4 payment-btn d-flex align-items-center justify-content-center gap-2"
          onClick={confirmOrder}
          disabled={processing}
        >
          {processing ? (
            <>
              <FaSpinner className="fa-spin" />

              Confirming Order...
            </>
          ) : (
            <>
              <FaCheckCircle />

              Confirm Order
            </>
          )}
        </button>

        {/* SECURITY */}

        <div className="text-center mt-3 text-muted small d-flex align-items-center justify-content-center gap-1">
          <FaShieldAlt className="text-success" />

          Secure Order Confirmation
        </div>
      </div>
    </div>
  );
}

export default CODPayment;