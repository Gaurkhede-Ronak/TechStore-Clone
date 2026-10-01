import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaQrcode, FaCreditCard, FaCheckCircle, FaLock, FaArrowLeft } from "react-icons/fa";
import toast from "react-hot-toast";
import authService from "../appwrite/authService";
import walletService from "../appwrite/walletService";
import "../css/PaymentGateway.css";

function PaymentGateway() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const amountToPay = location.state?.amount || 500.00;

    const [method, setMethod] = useState("UPI");
    const [step, setStep] = useState("select");
    const [upiId, setUpiId] = useState("");
    const [cardNumber, setCardNumber] = useState("");
    const [generatedTxnId, setGeneratedTxnId] = useState("");

    const handleCardNumberChange = (e) => {
        let value = e.target.value.replace(/\D/g, "");
        let formattedValue = "";
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += " ";
            }
            formattedValue += value[i];
        }
        if (formattedValue.length <= 19) {
            setCardNumber(formattedValue);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        
        if (method === "UPI" && !upiId.trim()) {
            toast.error("Please enter a valid UPI ID");
            return;
        }
        if (method === "Debit Card" && cardNumber.replace(/\s/g, "").length !== 16) {
            toast.error("Please enter a valid 16-digit Card Number");
            return;
        }

        setStep("processing");

        try {
            const currentUser = await authService.getCurrentUser();
            const txnId = `TXN${Math.floor(100000 + Math.random() * 900000)}`;
            setGeneratedTxnId(txnId);

            if (currentUser?.$id) {
                await walletService.addMoney(currentUser.$id, amountToPay, {
                    method,
                    transactionId: txnId,
                    description: `Added Money via ${method}`,
                    referenceId: txnId,
                });
            }

            setStep("success");
            toast.success("Payment Successful! Wallet Credited.");
        } catch (error) {
            console.error("Wallet top-up error:", error);
            toast.error(error?.message || "Failed to update wallet balance.");
            setStep("select");
        }
    };

    return (
        <div className="payment-gateway-wrapper">
            <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: "85vh" }}>
                <div className="payment-card-3d p-4 p-md-5">
                    
                    {step === "select" && (
                        <form onSubmit={handlePaymentSubmit}>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <button type="button" className="btn-back-custom" onClick={() => navigate("/profile")}>
                                    <FaArrowLeft /> Back
                                </button>
                                <span className="badge-ssl">
                                    <FaLock className="me-1" /> 256-bit SSL
                                </span>
                            </div>

                            <div className="amount-display-box mb-4 text-center">
                                <span className="text-muted small d-block mb-1">Total Amount to Add</span>
                                <h2 className="fw-bold text-primary mb-0">₹{parseFloat(amountToPay).toFixed(2)}</h2>
                            </div>

                            <label className="form-label fw-bold mb-3">Choose Payment Mode</label>
                            <div className="d-flex flex-column gap-3 mb-4">
                                <div 
                                    className={`payment-mode-option ${method === "UPI" ? "active-mode" : ""}`}
                                    onClick={() => setMethod("UPI")}
                                >
                                    <FaQrcode className="fs-3 text-primary" />
                                    <div>
                                        <h6 className="fw-bold mb-0">UPI / QR (GPay, PhonePe, Paytm)</h6>
                                        <small className="text-muted">Instant transfer via VPA</small>
                                    </div>
                                </div>

                                <div 
                                    className={`payment-mode-option ${method === "Debit Card" ? "active-mode" : ""}`}
                                    onClick={() => setMethod("Debit Card")}
                                >
                                    <FaCreditCard className="fs-3 text-primary" />
                                    <div>
                                        <h6 className="fw-bold mb-0">Debit / Credit Card</h6>
                                        <small className="text-muted">Visa, Mastercard, RuPay</small>
                                    </div>
                                </div>
                            </div>

                            {method === "UPI" ? (
                                <div className="mb-4">
                                    <label className="form-label small fw-bold">Enter UPI ID</label>
                                    <input
                                        type="text"
                                        className="form-control-3d"
                                        placeholder="username@okhdfcbank"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <label className="form-label small fw-bold">Card Number</label>
                                    <input
                                        type="text"
                                        className="form-control-3d card-number-input"
                                        placeholder="1234 5678 9123 4567"
                                        maxLength="19"
                                        value={cardNumber}
                                        onChange={handleCardNumberChange}
                                        required
                                    />
                                </div>
                            )}

                            <button type="submit" className="btn-pay-3d w-100 py-3 fw-bold rounded-pill shadow-sm">
                                Pay ₹{parseFloat(amountToPay).toFixed(2)} Now
                            </button>
                        </form>
                    )}

                    {step === "processing" && (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary mb-4" role="status" style={{ width: "4rem", height: "4rem" }}>
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <h4 className="fw-bold mb-2">Authorizing Payment...</h4>
                            <p className="text-muted small">Please do not refresh or press back while we securely process your transaction.</p>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="text-center py-4 animate-success">
                            <div className="text-success mb-3" style={{ fontSize: "4.5rem" }}>
                                <FaCheckCircle />
                            </div>
                            <h3 className="fw-bold mb-1">Payment Successful!</h3>
                            <p className="text-muted small mb-4">Money has been successfully added to your wallet.</p>

                            <div className="success-receipt-box p-3 rounded-3 border mb-4 text-start">
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted small">Amount Added:</span>
                                    <strong className="text-success">₹{parseFloat(amountToPay).toFixed(2)}</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted small">Transaction ID:</span>
                                    <strong className="font-monospace">{generatedTxnId}</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-muted small">Payment Mode:</span>
                                    <strong>{method}</strong>
                                </div>
                            </div>

                            <button 
                                className="btn-pay-3d w-100 py-3 fw-bold rounded-pill shadow-sm"
                                onClick={() => navigate("/profile")}
                            >
                                Go to Wallet & View Balance
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default PaymentGateway;