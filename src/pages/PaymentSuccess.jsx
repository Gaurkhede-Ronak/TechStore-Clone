import { scrollToPageTop } from "../components/ScrollToTop";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import confetti from "canvas-confetti";

import {
  FaShieldAlt,
  FaLock,
  FaArrowRight,
  FaCheckCircle,
  FaMoneyCheckAlt,
  FaClock,
  FaWallet,
  FaCreditCard,
  FaReceipt,
  FaTag,
  FaTruck,
} from "react-icons/fa";

import "../css/PaymentSuccess.css";

function PaymentSuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    scrollToPageTop();
  }, []);
  const location = useLocation();

  const order = useMemo(
    () => location.state || {},
    [location.state]
  );

  const [seconds, setSeconds] = useState(5);

  // PAYMENT DATA

  /*
   * Checkout / CardPayment / UPI flow:
   *
   * orderGrandTotal = complete order amount BEFORE wallet
   * walletPaid      = wallet amount used
   * cardPaid        = CARD amount
   * upiPaid         = UPI amount
   * onlinePaid      = CARD/UPI amount
   * totalPaid       = wallet + online
   *
   * Example:
   *
   * Order Total = ₹1000
   * Wallet      = ₹300
   * Card        = ₹700
   * Total Paid  = ₹1000
   */

  const rawOrderGrandTotal = Number(
    order.orderGrandTotal ??
      order.totalOrderAmount ??
      order.grandTotal ??
      order.totalBeforeWallet ??
      order.finalTotal ??
      0
  );

  const rawPayableAmount = Number(
    order.payableAmount ??
      order.total ??
      0
  );

  const walletPaid = Math.max(
    0,
    Number(order.walletPaid ?? 0)
  );

  /*
   * If the new flow provides orderGrandTotal,
   * use it directly.
   *
   * Otherwise fallback to:
   *
   * payable + wallet
   */
  const totalAmount = Math.max(
    0,
    Number(
      (
        rawOrderGrandTotal > 0
          ? rawOrderGrandTotal
          : rawPayableAmount + walletPaid
      ).toFixed(2)
    )
  );

  /*
   * Determine actual online payment amount.
   *
   * IMPORTANT:
   * Do not use `cardPaid ?? upiPaid`
   * because cardPaid can be 0 on UPI orders.
   */
  const explicitOnlinePaid = Number(
    order.onlinePaid ??
      (
        Number(order.cardPaid ?? 0) +
        Number(order.upiPaid ?? 0)
      )
  );

  const onlinePaid = Math.max(
    0,
    Number(
      (
        Number.isFinite(explicitOnlinePaid) &&
        explicitOnlinePaid > 0
          ? explicitOnlinePaid
          : Math.max(
              0,
              totalAmount - walletPaid
            )
      ).toFixed(2)
    )
  );

  /*
   * Final amount actually paid.
   *
   * Prefer explicit totalPaid from payment screen.
   * Otherwise calculate wallet + online.
   */
  const calculatedTotalPaid = Number(
    (
      walletPaid + onlinePaid
    ).toFixed(2)
  );

  const totalPaid = Math.max(
    0,
    Number(
      order.totalPaid ??
        calculatedTotalPaid
    )
  );

  const paymentMethod =
    String(
      order.payment || "ONLINE"
    ).toUpperCase();

  const transactionId =
    order.transactionId ||
    order.paymentTransactionId ||
    "N/A";

  const orderId =
    order.orderId ||
    order.$id ||
    "N/A";

  const invoiceNo =
    order.invoiceNo ||
    "N/A";

  const couponCode =
    order.couponCode ||
    "";

  const subtotal = Number(
    order.subTotal || 0
  );

  const shipping = Number(
    order.shipping || 0
  );

  const gst = Number(
    order.gst || 0
  );

  const discount = Number(
    order.discount || 0
  );

  const isWalletUsed =
    walletPaid > 0;

  const isSplitPayment =
    walletPaid > 0 &&
    onlinePaid > 0;

  // PAYMENT LABEL

  const getPaymentLabel = () => {
    if (isSplitPayment) {
      return `${paymentMethod} + Wallet`;
    }

    if (
      walletPaid > 0 &&
      onlinePaid <= 0
    ) {
      return "Wallet";
    }

    return paymentMethod;
  };

  // PAYMENT TIME

  const paymentTime =
    order.paymentCompletedAt ||
    order.paymentTime ||
    null;

  const formattedPaymentTime =
    paymentTime
      ? new Date(
          paymentTime
        ).toLocaleString("en-IN")
      : new Date().toLocaleString(
          "en-IN"
        );

  // CONFETTI + REDIRECT

  useEffect(() => {
    confetti({
      particleCount: 180,
      spread: 120,
      origin: {
        y: 0.6,
      },
    });

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);

          navigate(
            "/order-confirmed",
            {
              state: order,
              replace: true,
            }
          );

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () =>
      clearInterval(timer);
  }, [navigate, order]);

  // PROGRESS

  const progress =
    ((5 - seconds) / 5) * 360;

  const progressPercentage =
    ((5 - seconds) / 5) * 100;

  // FORMAT MONEY

  const formatMoney = (amount) =>
    Number(amount || 0).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );

  // UI

  return (
    <div className="payment-success-page">
      {/* FLOATING BACKGROUND */}

      <div className="floating-circle circle1"></div>

      <div className="floating-circle circle2"></div>

      <div className="floating-circle circle3"></div>

      <div className="glass-card">
        {/* SUCCESS ICON */}

        <div className="animation-box">
          <div className="success-check">
            <FaCheckCircle
              className="success-animation"
            />
          </div>
        </div>

        {/* BADGE */}

        <span className="success-badge">
          PAYMENT VERIFIED
        </span>

        <h1>
          Payment Successful
        </h1>

        <p>
          Your payment has been processed
          securely.
          <br />
          Please wait while we confirm
          your order.
        </p>

        {/* PAYMENT INFORMATION */}

        <div className="payment-info">
          {/* TRANSACTION */}

          <div className="payment-info-row">
            <span>
              <FaMoneyCheckAlt className="me-2" />
              Transaction ID
            </span>

            <strong>
              {transactionId}
            </strong>
          </div>

          {/* ORDER */}

          <div className="payment-info-row">
            <span>
              <FaReceipt className="me-2" />
              Order ID
            </span>

            <strong>
              {orderId}
            </strong>
          </div>

          {/* INVOICE */}

          {invoiceNo !== "N/A" && (
            <div className="payment-info-row">
              <span>
                Invoice Number
              </span>

              <strong>
                {invoiceNo}
              </strong>
            </div>
          )}

          {/* SUBTOTAL */}

          {subtotal > 0 && (
            <div className="payment-info-row">
              <span>
                Subtotal
              </span>

              <strong>
                ₹
                {formatMoney(
                  subtotal
                )}
              </strong>
            </div>
          )}

          {/* SHIPPING */}

          {shipping > 0 && (
            <div className="payment-info-row">
              <span>
                <FaTruck className="me-2" />
                Shipping
              </span>

              <strong>
                ₹
                {formatMoney(
                  shipping
                )}
              </strong>
            </div>
          )}

          {/* GST */}

          {gst > 0 && (
            <div className="payment-info-row">
              <span>
                GST
              </span>

              <strong>
                ₹
                {formatMoney(gst)}
              </strong>
            </div>
          )}

          {/* DISCOUNT */}

          {discount > 0 && (
            <div className="payment-info-row">
              <span className="text-success">
                <FaTag className="me-2" />
                Discount
              </span>

              <strong className="text-success">
                - ₹
                {formatMoney(
                  discount
                )}
              </strong>
            </div>
          )}

          {/* COUPON */}

          {couponCode && (
            <div className="payment-info-row">
              <span>
                Coupon Applied
              </span>

              <strong>
                {couponCode}
              </strong>
            </div>
          )}

          {/* TOTAL ORDER */}

          <div className="payment-info-row">
            <span>
              Order Total
            </span>

            <strong>
              ₹
              {formatMoney(
                totalAmount
              )}
            </strong>
          </div>

          {/* WALLET */}

          {isWalletUsed && (
            <div className="payment-info-row">
              <span className="d-flex align-items-center">
                <FaWallet
                  className="me-2 text-warning"
                />

                Wallet Used
              </span>

              <strong className="text-success">
                - ₹
                {formatMoney(
                  walletPaid
                )}
              </strong>
            </div>
          )}

          {/* ONLINE PAYMENT */}

          {onlinePaid > 0 && (
            <div className="payment-info-row">
              <span className="d-flex align-items-center">
                <FaCreditCard
                  className="me-2 text-primary"
                />

                {paymentMethod} Payment
              </span>

              <strong>
                ₹
                {formatMoney(
                  onlinePaid
                )}
              </strong>
            </div>
          )}

          {/* TOTAL PAID */}

          <div className="payment-info-row">
            <span>
              Amount Paid
            </span>

            <strong className="amount-paid">
              ₹
              {formatMoney(
                totalPaid
              )}
            </strong>
          </div>

          {/* PAYMENT METHOD */}

          <div className="payment-info-row">
            <span>
              Payment Method
            </span>

            <strong>
              {getPaymentLabel()}
            </strong>
          </div>

          {/* PAYMENT TIME */}

          <div className="payment-info-row">
            <span>
              <FaClock className="me-2" />
              Payment Time
            </span>

            <strong>
              {formattedPaymentTime}
            </strong>
          </div>
        </div>

        {/* SECURE BOX */}

        <div className="secure-box">
          <div className="secure-item">
            <FaLock />

            <span>
              SSL Secure
            </span>
          </div>

          <div className="secure-item">
            <FaShieldAlt />

            <span>
              Protected Payment
            </span>
          </div>

          <div className="secure-item">
            <FaCheckCircle />

            <span>
              Payment Verified
            </span>
          </div>
        </div>

        {/* COUNTDOWN */}

        <div className="countdown-wrapper">
          <div
            className="progress-circle"
            style={{
              background: `conic-gradient(
                #22c55e ${progress}deg,
                #e5e7eb ${progress}deg
              )`,
            }}
          >
            <div className="progress-inner">
              <span>
                {seconds}
              </span>
            </div>
          </div>

          {/* REDIRECT SECTION */}

          <div className="redirect-section">
            <h4>
              Confirming Your Order
            </h4>

            <p>
              Redirecting to Order
              Confirmation in{" "}
              <strong>
                {seconds} Seconds
              </strong>
            </p>

            <div className="loading-line">
              <div
                className="loading-fill"
                style={{
                  width: `${progressPercentage}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* PAYMENT STATUS */}

        <div className="payment-status">
          {/* PAYMENT */}

          <div className="status-item">
            <div className="status-icon success">
              ✓
            </div>

            <div>
              <h6>
                Payment Received
              </h6>

              <small>
                Your payment has
                been verified
                successfully.
              </small>
            </div>
          </div>

          {/* SECURITY */}

          <div className="status-item">
            <div className="status-icon success">
              ✓
            </div>

            <div>
              <h6>
                Security Check
              </h6>

              <small>
                Transaction completed
                using a secure
                encrypted connection.
              </small>
            </div>
          </div>

          {/* WALLET */}

          {isWalletUsed && (
            <div className="status-item">
              <div className="status-icon success">
                <FaWallet />
              </div>

              <div>
                <h6>
                  Wallet Payment Applied
                </h6>

                <small>
                  ₹
                  {formatMoney(
                    walletPaid
                  )}{" "}
                  was successfully
                  deducted from
                  your wallet.
                </small>
              </div>
            </div>
          )}

          {/* ORDER */}

          <div className="status-item">
            <div className="status-icon active">
              <FaArrowRight />
            </div>

            <div>
              <h6>
                Creating Your Order
              </h6>

              <small>
                Your order is being
                prepared and will
                be available shortly.
              </small>
            </div>
          </div>
        </div>

        {/* BOTTOM TEXT */}

        <div className="bottom-text">
          <p>
            Please do not refresh or
            close this page while we
            finish confirming your order.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;