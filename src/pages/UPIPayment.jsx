import { scrollToPageTop } from "../components/ScrollToTop";
import { useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import {
    FaCopy,
    FaCheckCircle,
    FaShieldAlt,
    FaLock,
    FaClock,
    FaSpinner,
    FaWallet,
    FaRupeeSign,
    FaArrowLeft,
} from "react-icons/fa";

import toast from "react-hot-toast";

import orderService from "../appwrite/orderService";
import walletService from "../appwrite/walletService";

import "../css/Payment.css";



function UPIPayment() {

    const navigate = useNavigate();
  useEffect(() => {
    scrollToPageTop();
  }, []);

    const location = useLocation();

    const order = location.state || {};



  // CONSTANTS

    const upiId = "techstore@upi";

    const PAYMENT_TIME = 300;



  // STATE

    const [seconds, setSeconds] =
        useState(PAYMENT_TIME);

    const [processing, setProcessing] =
        useState(false);

    const [copied, setCopied] =
        useState(false);



  // ORDER DATA

    const orderId =
        order?.orderId ||
        order?.$id ||
        "";



    const userId =
        order?.userId ||
        "";



    const walletPaid =
        Number(
            order?.walletPaid || 0
        );



    const onlinePayable =
        Number(
            order?.total || 0
        );



    const subtotal =
        Number(
            order?.subTotal || 0
        );



    const shipping =
        Number(
            order?.shipping || 0
        );



    const gst =
        Number(
            order?.gst || 0
        );



    const discount =
        Number(
            order?.discount || 0
        );



    const couponCode =
        order?.couponCode ||
        "";



    const transactionId =
        order?.transactionId ||
        "";



    const invoiceNo =
        order?.invoiceNo ||
        "";



  // WALLET TRANSACTION ID

    const walletTransactionId =
        order?.walletTransactionId ||
        `${orderId}-WALLET`;



  // TIMER

    useEffect(() => {

        if (seconds <= 0) {
            return;
        }



        const timer =
            setInterval(() => {

                setSeconds((previous) =>
                    Math.max(
                        0,
                        previous - 1
                    )
                );

            }, 1000);



        return () =>
            clearInterval(timer);

    }, [seconds]);



  // TIMER FORMAT

    const minutes =
        Math.floor(
            seconds / 60
        );



    const sec =
        seconds % 60;



  // COPY UPI

    async function copyUPI() {

        try {

            await navigator.clipboard.writeText(
                upiId
            );

            setCopied(true);

            toast.success(
                "UPI ID Copied!"
            );

            setTimeout(() => {
                setCopied(false);
            }, 1800);

        } catch (error) {

            console.error(
                "Copy UPI error:",
                error
            );

            toast.error(
                "Unable to copy UPI ID"
            );
        }
    }



  // VALIDATE ORDER

    function validateOrder() {

        if (!orderId) {

            toast.error(
                "Order information is missing."
            );

            return false;
        }



        if (!userId) {

            toast.error(
                "User information is missing."
            );

            return false;
        }



        if (
            !Number.isFinite(
                onlinePayable
            ) ||
            onlinePayable < 0
        ) {

            toast.error(
                "Invalid payment amount."
            );

            return false;
        }



        return true;
    }



  // VERIFY PAYMENT

    async function verifyPayment() {

        if (processing) {
            return;
        }



        if (seconds <= 0) {

            toast.error(
                "QR payment session has expired. Please try again."
            );

            return;
        }



        if (!validateOrder()) {
            return;
        }



        setProcessing(true);



        try {

            // =================================================
            // STEP 1
            // COMPLETE UPI PAYMENT IN APPWRITE
            // =================================================

            const paidOrder =
                await orderService.completePayment(
                    order?.$id ||
                    order?.orderId,
                    "UPI"
                );



            // =================================================
            // STEP 2
            // DEDUCT WALLET
            // =================================================

            let walletResult = null;



            if (walletPaid > 0) {

                walletResult =
                    await walletService.deductMoney(
                        userId,
                        walletPaid,
                        {
                            source:
                                "order",

                            orderId:
                                orderId,

                            transactionId:
                                walletTransactionId,

                            description:
                                `Wallet Payment for Order ${orderId}`,
                        }
                    );
            }



            // =================================================
            // STEP 3
            // FINAL ORDER STATE
            // =================================================

            const finalOrder = {

                ...order,

                ...paidOrder,

                payment:
                    "UPI",

                paymentStatus:
                    "PAID",

                paymentCompletedAt:
                    new Date().toISOString(),

                orderId,

                invoiceNo,

                transactionId,

                couponCode,

                subTotal:
                    subtotal,

                shipping:
                    shipping,

                gst:
                    gst,

                discount:
                    discount,

                total:
                    onlinePayable,

                walletPaid,

                walletTransactionId:

                    walletResult?.transactionId ||
                    walletTransactionId,

                walletMonthlyPromotionUsed:

                    Number(
                        walletResult?.monthlyPromotion ||
                        order?.walletMonthlyPromotionUsed ||
                        0
                    ),

                walletWelcomePromotionUsed:

                    Number(
                        walletResult?.welcomePromotion ||
                        order?.walletWelcomePromotionUsed ||
                        0
                    ),

                walletUserMoneyUsed:

                    Number(
                        walletResult?.userMoney ||
                        order?.walletUserMoneyUsed ||
                        0
                    ),

                walletBalanceAfter:

                    walletResult?.wallet?.balance ??
                    walletResult?.balance ??
                    order?.walletBalanceAfter ??
                    null,
            };



  // SUCCESS

            toast.success(
                walletPaid > 0
                    ? "UPI Payment Successful & Wallet Updated!"
                    : "UPI Payment Successful!"
            );



            navigate(
                "/payment-success",
                {
                    state:
                        finalOrder,

                    replace:
                        true,
                }
            );

        } catch (error) {

            console.error(
                "UPI payment error:",
                error
            );

            toast.error(
                error?.message ||
                "Payment verification failed. Please try again."
            );

        } finally {

            setProcessing(false);
        }
    }



  // GO BACK

    function handleBack() {

        if (processing) {
            return;
        }

        navigate(-1);
    }



  // UI

    return (

        <div className="card-payment-wrapper py-5">

            <div
                className="container py-3"
                style={{
                    maxWidth: "650px",
                }}
            >

                {/* HEADER */}

                <div className="text-center mb-4">

                    <span
                        className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold mb-2"
                    >

                        <FaLock
                            className="me-1"
                            size={12}
                        />

                        Secure UPI Gateway

                    </span>



                    <h2
                        className="fw-bold payment-main-title"
                    >
                        Scan & Pay via UPI
                    </h2>



                    <p className="text-muted mb-1">

                        Scan the QR code using any
                        UPI app on your phone.

                    </p>



                    {orderId && (

                        <small className="text-muted">

                            Order ID:{" "}

                            <strong>
                                {orderId}
                            </strong>

                        </small>
                    )}

                </div>



                {/* PAYMENT CARD */}

                <div
                    className="payment-card p-4 p-md-5 shadow-lg border-0"
                >

                    {/* TIMER */}

                    <div
                        className="d-flex justify-content-center timer"
                    >

                        <div
                            className="large-timer-badge d-flex align-items-center justify-content-center gap-3 shadow-sm"
                        >

                            <FaClock
                                className={
                                    seconds <= 30
                                        ? "text-danger"
                                        : "text-primary"
                                }
                                size={24}
                            />



                            <div className="text-start">

                                <span
                                    className="d-block text-muted small fw-semibold"
                                    style={{
                                        fontSize:
                                            "12px",
                                    }}
                                >
                                    QR Code Expires In
                                </span>



                                <span
                                    className="font-monospace fw-bold text-danger fs-3"
                                >

                                    {minutes}:

                                    {sec
                                        .toString()
                                        .padStart(
                                            2,
                                            "0"
                                        )}

                                </span>

                            </div>

                        </div>

                    </div>



                    {/* QR CODE */}

                    <div
                        className="qr-container text-center p-3 mb-4 shadow-sm"
                    >

                        <img
                            src={
                                `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                                    upiId
                                )}`
                            }
                            alt="TechStore UPI QR Code"
                            className="img-fluid rounded-3"
                        />

                    </div>



                    {/* UPI ID */}

                    <div
                        className="upi-box mb-4 shadow-sm"
                    >

                        <div className="text-start">

                            <small
                                className="text-muted d-block"
                                style={{
                                    fontSize:
                                        "11px",
                                }}
                            >
                                UPI ID
                            </small>



                            <span
                                className="font-monospace upi-text"
                            >
                                {upiId}
                            </span>

                        </div>



                        <button
                            className="btn btn-outline-primary btn-sm px-3 py-2 rounded-pill fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={copyUPI}
                            type="button"
                        >

                            {copied ? (
                                <FaCheckCircle />
                            ) : (
                                <FaCopy />
                            )}

                            {copied
                                ? "Copied"
                                : "Copy"}

                        </button>

                    </div>



                    {/* ORDER SUMMARY */}

                    <div
                        className="order-summary-box mb-4 shadow-sm"
                    >

                        {/* TOTAL ORDER */}

                        <div className="payment-row">

                            <span className="text-muted">

                                Order Total

                            </span>



                            <strong>

                                ₹
                                {(
                                    onlinePayable +
                                    walletPaid
                                ).toFixed(2)}

                            </strong>

                        </div>



                        {/* SUBTOTAL */}

                        {subtotal > 0 && (

                            <div className="payment-row mt-2">

                                <span className="text-muted">

                                    Subtotal

                                </span>



                                <span>

                                    ₹
                                    {subtotal.toFixed(2)}

                                </span>

                            </div>
                        )}



                        {/* SHIPPING */}

                        {shipping > 0 && (

                            <div className="payment-row mt-2">

                                <span className="text-muted">

                                    Shipping

                                </span>



                                <span>

                                    ₹
                                    {shipping.toFixed(2)}

                                </span>

                            </div>
                        )}



                        {/* GST */}

                        {gst > 0 && (

                            <div className="payment-row mt-2">

                                <span className="text-muted">

                                    GST

                                </span>



                                <span>

                                    ₹
                                    {gst.toFixed(2)}

                                </span>

                            </div>
                        )}



                        {/* COUPON */}

                        {discount > 0 && (

                            <div className="payment-row mt-2">

                                <span className="text-muted">

                                    Coupon Discount

                                    {couponCode && (
                                        <small className="ms-1 text-success">
                                            ({couponCode})
                                        </small>
                                    )}

                                </span>



                                <strong className="text-success">

                                    - ₹
                                    {discount.toFixed(2)}

                                </strong>

                            </div>
                        )}



                        {/* DIVIDER */}

                        <hr className="my-3" />



                        {/* WALLET */}

                        {walletPaid > 0 && (

                            <div className="payment-row">

                                <span
                                    className="text-muted d-flex align-items-center gap-2"
                                >

                                    <FaWallet
                                        className="text-success"
                                    />

                                    Wallet Used

                                </span>



                                <strong className="text-success">

                                    - ₹
                                    {walletPaid.toFixed(2)}

                                </strong>

                            </div>
                        )}



                        {/* ONLINE PAYMENT */}

                        <div
                            className="payment-row mt-2"
                        >

                            <span className="text-muted">

                                UPI Payable

                            </span>



                            <strong
                                className="payment-total-price fs-4"
                            >

                                ₹
                                {onlinePayable.toFixed(2)}

                            </strong>

                        </div>



                        {/* PAYMENT BREAKDOWN */}

                        {walletPaid > 0 && (

                            <div
                                className="mt-3 p-3 rounded-3 bg-light"
                            >

                                <div
                                    className="d-flex justify-content-between align-items-center small"
                                >

                                    <span
                                        className="text-muted"
                                    >
                                        Wallet
                                    </span>



                                    <strong
                                        className="text-success"
                                    >
                                        ₹
                                        {walletPaid.toFixed(2)}
                                    </strong>

                                </div>



                                <div
                                    className="d-flex justify-content-between align-items-center small mt-2"
                                >

                                    <span
                                        className="text-muted"
                                    >
                                        UPI
                                    </span>



                                    <strong
                                        className="text-primary"
                                    >
                                        ₹
                                        {onlinePayable.toFixed(2)}
                                    </strong>

                                </div>



                                <hr className="my-2" />



                                <div
                                    className="d-flex justify-content-between align-items-center"
                                >

                                    <span
                                        className="fw-bold"
                                    >
                                        Total Paid
                                    </span>



                                    <strong
                                        className="text-dark"
                                    >
                                        ₹
                                        {(
                                            walletPaid +
                                            onlinePayable
                                        ).toFixed(2)}
                                    </strong>

                                </div>

                            </div>
                        )}

                    </div>



                    {/* PAYMENT INFORMATION */}

                    <div
                        className="alert alert-primary border-0 rounded-3 small mb-4"
                    >

                        <div
                            className="d-flex gap-2"
                        >

                            <FaRupeeSign
                                className="mt-1"
                            />

                            <div>

                                <strong>
                                    How to pay
                                </strong>

                                <div className="mt-1">

                                    1. Open Google Pay,
                                    PhonePe, Paytm or any
                                    UPI app.

                                </div>

                                <div>

                                    2. Scan the QR code.

                                </div>

                                <div>

                                    3. Pay the displayed
                                    UPI amount.

                                </div>

                                <div>

                                    4. After payment,
                                    click
                                    <strong>
                                        {" "}I Have Paid
                                    </strong>.

                                </div>

                            </div>

                        </div>

                    </div>



                    {/* PAYMENT BUTTON */}

                    <button
                        className="btn btn-success payment-btn w-100 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2"
                        onClick={
                            verifyPayment
                        }
                        disabled={
                            processing ||
                            seconds <= 0
                        }
                    >

                        {processing ? (

                            <>

                                <FaSpinner
                                    className="fa-spin"
                                    size={18}
                                />

                                Verifying Payment...

                            </>

                        ) : (

                            <>

                                <FaCheckCircle
                                    size={18}
                                />

                                I Have Paid

                            </>

                        )}

                    </button>



                    {/* BACK BUTTON */}

                    {!processing && (

                        <button
                            type="button"
                            className="btn btn-light w-100 mt-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
                            onClick={
                                handleBack
                            }
                        >

                            <FaArrowLeft />

                            Back

                        </button>
                    )}



                    {/* SECURITY */}

                    <div
                        className="text-center mt-3 text-muted small d-flex align-items-center justify-content-center gap-1"
                    >

                        <FaShieldAlt
                            className="text-success"
                        />

                        Verified Merchant Secure
                        Transaction

                    </div>



                    {/* SECURITY FOOTER */}

                    <div
                        className="text-center mt-2"
                    >

                        <small className="text-muted">

                            🔒 Your payment is processed
                            securely.

                        </small>

                    </div>

                </div>

            </div>

        </div>
    );
}



export default UPIPayment;