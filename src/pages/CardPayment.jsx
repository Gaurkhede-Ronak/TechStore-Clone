import { scrollToPageTop } from "../components/ScrollToTop";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  FaCreditCard,
  FaLock,
  FaShieldAlt,
  FaWallet,
  FaSpinner,
} from "react-icons/fa";

import toast from "react-hot-toast";

import orderService from "../appwrite/orderService";
import walletService from "../appwrite/walletService";

import "../css/Payment.css";

function CardPayment() {
  const navigate = useNavigate();
  useEffect(() => {
    scrollToPageTop();
  }, []);
  const location = useLocation();

  const order = location.state || {};

  const [cardData, setCardData] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });

  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);

  // ORDER / PAYMENT AMOUNTS

  /*
   * Checkout sends:
   *
   * orderGrandTotal = complete order amount BEFORE wallet
   * total           = remaining payable amount
   * walletPaid      = wallet amount
   *
   * Example:
   *
   * Order Total = ₹1000
   * Wallet      = ₹300
   * Card        = ₹700
   *
   * Total Paid  = ₹1000
   */

  const rawGrandTotal = Number(
    order.orderGrandTotal ??
      order.grandTotal ??
      order.totalBeforeWallet ??
      order.finalTotal ??
      0
  );

  const rawPayableAmount = Number(order.total ?? 0);

  const rawWalletPaid = Number(order.walletPaid ?? 0);

  /*
   * If orderGrandTotal exists, it is the source of truth.
   *
   * Older checkout state may only have `total`, so fallback:
   *
   * total + wallet
   */
  const calculatedGrandTotal =
    rawGrandTotal > 0
      ? rawGrandTotal
      : rawPayableAmount + Math.max(0, rawWalletPaid);

  const totalOrderAmount = Math.max(
    0,
    Number(calculatedGrandTotal.toFixed(2))
  );

  /*
   * Wallet cannot exceed order total.
   */
  const walletPaid = Math.max(
    0,
    Math.min(
      Number(rawWalletPaid.toFixed(2)),
      totalOrderAmount
    )
  );

  /*
   * Remaining amount that must be paid by card.
   */
  const cardPayableAmount = Math.max(
    0,
    Number(
      (totalOrderAmount - walletPaid).toFixed(2)
    )
  );

  /*
   * Unique wallet transaction ID.
   *
   * This is intentionally stable for the current order/payment
   * attempt instead of generating a new ID on every render.
   */
  const walletTransactionId = useMemo(() => {
    return (
      order.walletTransactionId ||
      `${order.transactionId || order.orderId || "WALLET"}-WALLET`
    );
  }, [order.walletTransactionId, order.transactionId, order.orderId]);

  // INPUT HANDLER

  function handleChange(e) {
    let { name, value } = e.target;

  // CARD NUMBER

    if (name === "cardNumber") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(.{4})/g, "$1 ")
        .trim();
    }

  // CARD HOLDER NAME

    if (name === "cardName") {
      value = value
        .replace(/[^a-zA-Z\s.'-]/g, "")
        .slice(0, 50);
    }

  // EXPIRY

    if (name === "expiry") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 4);

      if (value.length > 2) {
        value =
          value.slice(0, 2) +
          "/" +
          value.slice(2);
      }
    }

  // CVV

    if (name === "cvv") {
      value = value
        .replace(/\D/g, "")
        .slice(0, 3);
    }

    setCardData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  }

  // VALIDATE CARD

  function validateCard() {
    const newErrors = {};

  // CARD HOLDER

    if (!cardData.cardName.trim()) {
      newErrors.cardName =
        "Card Holder Name is required";
    } else if (cardData.cardName.trim().length < 3) {
      newErrors.cardName =
        "Enter a valid card holder name";
    }

  // CARD NUMBER

    const cleanCardNumber =
      cardData.cardNumber.replace(/\s/g, "");

    if (cleanCardNumber.length !== 16) {
      newErrors.cardNumber =
        "Enter a valid 16-digit card number";
    }

  // EXPIRY

    const expiryPattern =
      /^(0[1-9]|1[0-2])\/([0-9]{2})$/;

    if (!expiryPattern.test(cardData.expiry)) {
      newErrors.expiry =
        "Invalid expiry date (MM/YY)";
    } else {
      const [month, year] =
        cardData.expiry.split("/");

      const expiryMonth = Number(month);
      const expiryYear = 2000 + Number(year);

      const now = new Date();

      const currentMonth =
        now.getMonth() + 1;

      const currentYear =
        now.getFullYear();

      if (
        expiryYear < currentYear ||
        (expiryYear === currentYear &&
          expiryMonth < currentMonth)
      ) {
        newErrors.expiry =
          "Card has expired";
      }
    }

  // CVV

    if (cardData.cvv.length !== 3) {
      newErrors.cvv = "Invalid CVV";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  // PAY NOW

  async function payNow() {
    if (processing) {
      return;
    }

  // ORDER VALIDATION

    if (!order?.orderId && !order?.$id) {
      toast.error(
        "Order information is missing. Please try checkout again."
      );

      return;
    }

  // AMOUNT VALIDATION

    if (
      !Number.isFinite(totalOrderAmount) ||
      totalOrderAmount <= 0
    ) {
      toast.error(
        "Invalid order amount. Please try checkout again."
      );

      return;
    }

    if (walletPaid > 0 && !order?.userId) {
      toast.error(
        "User information is missing. Please try checkout again."
      );

      return;
    }

  // CARD VALIDATION

    /*
     * If wallet covers the complete order, card details
     * are not required.
     */
    if (
      cardPayableAmount > 0 &&
      !validateCard()
    ) {
      toast.error(
        "Please correct your card details."
      );

      return;
    }

    setProcessing(true);

    try {
      let walletResult = null;

      // ===================================================
      // STEP 1
      // DEDUCT WALLET
      // ===================================================

      if (walletPaid > 0) {
        walletResult =
          await walletService.deductMoney(
            order.userId,
            walletPaid,
            {
              source: "order",

              orderId:
                order.orderId || "",

              transactionId:
                walletTransactionId,

              description:
                `Wallet Payment for Order ${
                  order.orderId || ""
                }`,
            }
          );
      }

      // ===================================================
      // STEP 2
      // COMPLETE CARD PAYMENT / ORDER PAYMENT
      // ===================================================

      /*
       * Even if wallet pays the full amount, we still
       * complete the online payment flow as CARD because
       * the selected checkout method is CARD.
       *
       * If cardPayableAmount === 0, no real card charge
       * is required.
       */
      const paidOrder =
        await orderService.completePayment(
          order.$id || order.orderId,
          "CARD"
        );

      // ===================================================
      // STEP 3
      // PAYMENT BREAKDOWN
      // ===================================================

      const monthlyPromotionUsed =
        Number(
          walletResult?.monthlyPromotion ??
            order.walletMonthlyPromotionUsed ??
            0
        );

      const welcomePromotionUsed =
        Number(
          walletResult?.welcomePromotion ??
            order.walletWelcomePromotionUsed ??
            0
        );

      const userMoneyUsed =
        Number(
          walletResult?.userMoney ??
            order.walletUserMoneyUsed ??
            0
        );

      const walletBalanceAfter =
        walletResult?.wallet?.balance ??
        order.walletBalanceAfter ??
        null;

      /*
       * Actual amount paid in this transaction.
       *
       * Wallet + Card = Complete order amount
       */
      const totalPaid = Number(
        (
          walletPaid +
          cardPayableAmount
        ).toFixed(2)
      );

  // FINAL ORDER STATE

      const finalOrder = {
        ...order,
        ...paidOrder,

  // PAYMENT

        payment: "CARD",

        paymentStatus: "PAID",

        paymentCompletedAt:
          new Date().toISOString(),

  // ORDER TOTALS

        /*
         * Keep original complete order total.
         */
        orderGrandTotal:
          totalOrderAmount,

        totalOrderAmount:
          totalOrderAmount,

        /*
         * `total` is kept as the original payable amount
         * coming from Checkout for compatibility.
         */
        payableAmount:
          cardPayableAmount,

  // PAYMENT BREAKDOWN

        walletPaid,

        cardPaid:
          cardPayableAmount,

        onlinePaid:
          cardPayableAmount,

        totalPaid,

        paymentBreakdown: {
          wallet: walletPaid,

          card: cardPayableAmount,

          total: totalPaid,

          orderTotal:
            totalOrderAmount,
        },

  // WALLET DETAILS

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
      };

  // SUCCESS

      toast.success(
        walletPaid > 0
          ? "Payment Successful & Wallet Updated!"
          : "Card Payment Successful!"
      );

      navigate(
        "/payment-success",
        {
          state: finalOrder,
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "Card payment error:",
        error
      );

      /*
       * Important:
       *
       * If wallet deduction succeeded but a later step failed,
       * the wallet service currently owns that transaction.
       *
       * We do not silently create another deduction/refund here
       * because the current walletService contract does not expose
       * a safe rollback operation for this payment attempt.
       */

      toast.error(
        error?.message ||
          "Payment failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  // UI

  return (
    <div className="card-payment-wrapper py-5">
      <div
        className="container py-3"
        style={{
          maxWidth: "1000px",
        }}
      >
        {/* HEADER */}

        <div className="text-center mb-5">
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold mb-2">
            <FaLock
              className="me-1"
              size={12}
            />

            Secure 256-Bit Encrypted
            Checkout
          </span>

          <h2 className="fw-bold display-6 payment-main-title">
            Complete Your Payment
          </h2>

          <p className="text-muted">
            Experience ultra-secure
            and seamless card
            transactions.
          </p>
        </div>

        <div className="row g-5 align-items-center flex-column-reverse flex-lg-row">
          {/* CARD PREVIEW + SUMMARY */}

          <div className="col-lg-5">
            {/* CARD */}

            <div className="credit-card-container">
              <div className="credit-card">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="chip"></div>

                  <FaCreditCard
                    size={32}
                    className="text-white opacity-75"
                  />
                </div>

                <h3 className="card-number-display">
                  {cardData.cardNumber ||
                    "#### #### #### ####"}
                </h3>

                <div className="card-bottom">
                  <div>
                    <small>
                      CARD HOLDER
                    </small>

                    <h5>
                      {cardData.cardName ||
                        "YOUR NAME"}
                    </h5>
                  </div>

                  <div>
                    <small>
                      EXPIRES
                    </small>

                    <h5>
                      {cardData.expiry ||
                        "MM/YY"}
                    </h5>
                  </div>
                </div>
              </div>
            </div>

            {/* AMOUNT SUMMARY */}

            <div className="order-summary-box shadow-sm">
              <div className="payment-row">
                <span className="text-muted">
                  Total Order Amount
                </span>

                <strong className="payment-total-price fs-4">
                  ₹
                  {totalOrderAmount.toFixed(
                    2
                  )}
                </strong>
              </div>

              {walletPaid > 0 && (
                <>
                  <div className="payment-row mt-2">
                    <span className="text-muted d-flex align-items-center gap-2">
                      <FaWallet className="text-warning" />

                      Wallet Used
                    </span>

                    <strong className="text-success">
                      - ₹
                      {walletPaid.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div className="payment-row mt-2">
                    <span className="text-muted">
                      Card Payment
                    </span>

                    <strong className="text-primary">
                      ₹
                      {cardPayableAmount.toFixed(
                        2
                      )}
                    </strong>
                  </div>
                </>
              )}

              {!walletPaid && (
                <div className="payment-row mt-2">
                  <span className="text-muted">
                    Card Payment
                  </span>

                  <strong className="text-primary">
                    ₹
                    {cardPayableAmount.toFixed(
                      2
                    )}
                  </strong>
                </div>
              )}

              <div className="payment-row mt-3 pt-3 border-top">
                <span className="fw-semibold">
                  Total Paid
                </span>

                <strong className="text-success fs-5">
                  ₹
                  {totalOrderAmount.toFixed(
                    2
                  )}
                </strong>
              </div>

              <div className="text-center mt-3 text-muted small d-flex align-items-center justify-content-center gap-1">
                <FaShieldAlt className="text-success" />

                Guaranteed Safe &
                Secure Checkout
              </div>
            </div>
          </div>

          {/* CARD FORM */}

          <div className="col-lg-7">
            <div className="payment-card shadow-lg border-0">
              <h4 className="fw-bold mb-4 payment-section-title border-bottom pb-3">
                Enter Card Details
              </h4>

              {/* CARD HOLDER */}

              <div className="mb-3">
                <label className="form-label">
                  Card Holder Name
                </label>

                <input
                  type="text"
                  className={`form-control ${
                    errors.cardName
                      ? "is-invalid"
                      : ""
                  }`}
                  name="cardName"
                  value={
                    cardData.cardName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. John Doe"
                  autoComplete="cc-name"
                />

                {errors.cardName && (
                  <small className="text-danger">
                    {errors.cardName}
                  </small>
                )}
              </div>

              {/* CARD NUMBER */}

              <div className="mb-3">
                <label className="form-label">
                  Card Number
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  className={`form-control ${
                    errors.cardNumber
                      ? "is-invalid"
                      : ""
                  }`}
                  name="cardNumber"
                  value={
                    cardData.cardNumber
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />

                {errors.cardNumber && (
                  <small className="text-danger">
                    {errors.cardNumber}
                  </small>
                )}
              </div>

              {/* EXPIRY + CVV */}

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label">
                    Expiry Date
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    className={`form-control ${
                      errors.expiry
                        ? "is-invalid"
                        : ""
                    }`}
                    name="expiry"
                    value={
                      cardData.expiry
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="MM/YY"
                    maxLength={5}
                  />

                  {errors.expiry && (
                    <small className="text-danger">
                      {errors.expiry}
                    </small>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">
                    CVV Security
                    Code
                  </label>

                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    className={`form-control ${
                      errors.cvv
                        ? "is-invalid"
                        : ""
                    }`}
                    name="cvv"
                    value={
                      cardData.cvv
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="***"
                    maxLength={3}
                  />

                  {errors.cvv && (
                    <small className="text-danger">
                      {errors.cvv}
                    </small>
                  )}
                </div>
              </div>

              {/* PAYMENT INFORMATION */}

              <div className="alert alert-light border small mb-4">
                <div className="d-flex align-items-start gap-2">
                  <FaShieldAlt className="text-success mt-1" />

                  <div>
                    <strong>
                      Secure Payment
                    </strong>

                    <div className="text-muted mt-1">
                      Your card details are
                      used only for this
                      payment session and
                      are not stored in
                      the order.
                    </div>
                  </div>
                </div>
              </div>

              {/* PAY BUTTON */}

              <button
                className="btn btn-primary payment-btn w-100 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2"
                onClick={payNow}
                disabled={
                  processing ||
                  cardPayableAmount <= 0
                }
              >
                {processing ? (
                  <>
                    <FaSpinner
                      className="fa-spin"
                      size={16}
                    />

                    Processing
                    Payment...
                  </>
                ) : cardPayableAmount <=
                  0 ? (
                  <>
                    <FaLock
                      size={16}
                    />

                    Wallet Payment
                    Completed
                  </>
                ) : (
                  <>
                    <FaLock
                      size={16}
                    />

                    Pay ₹
                    {cardPayableAmount.toFixed(
                      2
                    )}{" "}
                    Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardPayment;