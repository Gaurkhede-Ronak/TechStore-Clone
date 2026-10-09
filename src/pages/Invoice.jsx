import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FaArrowLeft,
  FaDownload,
  FaPrint,
  FaCheckCircle,
  FaFileInvoice,
  FaShieldAlt,
  FaMapMarkerAlt,
  FaCreditCard,
  FaMobileAlt,
  FaMoneyBillWave,
  FaWallet,
} from "react-icons/fa";
import toast from "react-hot-toast";
import orderService from "../appwrite/orderService";
import { scrollToPageTop } from "../components/ScrollToTop";
import "../css/Invoice.css";

const formatINR = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPdfMoney = (value) => `Rs. ${formatINR(value)}`;

const formatInvoiceDateStr = (rawDate) => {
  const d = rawDate ? new Date(rawDate) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return valid.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const parseOrderItems = (order) => {
  const raw = order?.items || order?.products || order?.cartItems || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      return [];
    }
  }
  return raw && typeof raw === "object" ? [raw] : [];
};

function Invoice() {
  const { state } = useLocation();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder] = useState(state || null);
  const [loading, setLoading] = useState(!state);
  const autoDownloadedRef = useRef(false);

  useEffect(() => {
    scrollToPageTop();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOrderIfNeeded = async () => {
      const params = new URLSearchParams(location.search);
      const queryOrderId =
        params.get("orderId") || state?.orderId || state?.$id || "";

      if (state && (state.items || state.products || state.totalAmount)) {
        setOrder(state);
        setLoading(false);
        return;
      }

      if (!queryOrderId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const fetched = await orderService.getOrderSmart(String(queryOrderId));
        if (!cancelled && fetched) {
          setOrder({ ...fetched, autoDownload: Boolean(state?.autoDownload) });
        }
      } catch (err) {
        console.warn("Invoice order lookup failed:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchOrderIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [location.search, state]);

  const items = useMemo(() => parseOrderItems(order), [order]);

  const invoiceSummary = useMemo(() => {
    if (!order) return null;

    const orderRef = String(
      order.orderId || order.$id || order.id || "ORD-TECHSTORE"
    ).trim();
    const shortNumeric = orderRef.replace(/[^0-9]/g, "").slice(-8) || "849201";
    const invoiceNumber = `TS-INV-${shortNumeric}`;

    const invoiceDate = formatInvoiceDateStr(
      order.createdAt || order.$createdAt || order.orderDate
    );

    const rawOrderItems = items;

    const itemsOriginalMrpTotal = rawOrderItems.reduce((acc, item) => {
      const price = Number(item?.oldPrice ?? item?.mrp ?? item?.price ?? 0);
      const qty = Math.max(1, Number(item?.quantity || item?.qty || 1));
      return acc + price * qty;
    }, 0);

    const itemsSellingTotal = rawOrderItems.reduce((acc, item) => {
      const orig = Number(item?.price || 0);
      const disc = Number(item?.discount || 0);
      const qty = Math.max(1, Number(item?.quantity || item?.qty || 1));
      const selling = disc > 0 ? orig - (orig * disc) / 100 : orig;
      return acc + selling * qty;
    }, 0);

    const productLevelSavings = Math.max(
      0,
      itemsOriginalMrpTotal - itemsSellingTotal
    );

    const subTotalVal = Number(
      order.subTotal ??
        order.subtotal ??
        order.subTotalAmount ??
        itemsSellingTotal ??
        0
    );

    const shippingVal = Number(order.shipping ?? 0);
    const gstVal = Number(order.gst ?? order.tax ?? 0);
    const gstApplied = Boolean(order.gstApplied);
    const platformFeeVal = Number(
      order.platformFee ?? order.convenienceFee ?? 9
    );
    const couponDiscount = Number(order.discount ?? order.couponDiscount ?? 0);

    const orderOriginalAmount =
      itemsOriginalMrpTotal > 0
        ? itemsOriginalMrpTotal
        : itemsSellingTotal > 0
        ? itemsSellingTotal
        : subTotalVal + (gstApplied ? 0 : gstVal);

    const effectiveSelling =
      itemsSellingTotal > 0 ? itemsSellingTotal : orderOriginalAmount;

    const baseSubtotal =
      subTotalVal > 0 && gstVal > 0
        ? subTotalVal
        : effectiveSelling / 1.18;

    const effectiveGst =
      gstVal > 0
        ? gstVal
        : effectiveSelling - effectiveSelling / 1.18;

    const totalOrderSavings =
      productLevelSavings + couponDiscount + (gstApplied ? effectiveGst : 0);

    const storedGrandTotal = Number(
      order.orderGrandTotal ??
        order.grandTotal ??
        order.totalAmount ??
        order.finalAmount ??
        0
    );

    const calculatedGrandTotal = Math.max(
      0,
      subTotalVal +
        shippingVal +
        (gstApplied ? 0 : effectiveGst) +
        platformFeeVal -
        couponDiscount
    );

    const orderGrandTotal =
      storedGrandTotal > 0 ? storedGrandTotal : calculatedGrandTotal;

    const walletPaidVal = Math.max(
      0,
      Number(
        order.walletPaid ??
          order.usedWalletAmount ??
          order.walletUsed ??
          0
      )
    );

    const rawPaymentMethod = String(
      order.payment || order.paymentMethod || "ONLINE"
    ).toUpperCase();

    const isCOD =
      rawPaymentMethod.includes("COD") || rawPaymentMethod.includes("CASH");
    const isUPI =
      rawPaymentMethod.includes("UPI") ||
      rawPaymentMethod.includes("GPAY") ||
      rawPaymentMethod.includes("PHONEPE") ||
      rawPaymentMethod.includes("PAYTM");
    const isCard =
      rawPaymentMethod.includes("CARD") ||
      rawPaymentMethod.includes("CREDIT") ||
      rawPaymentMethod.includes("DEBIT");

    const storedOnlinePaid = Number(order.onlinePaid ?? 0);
    const storedUpiPaid = Number(order.upiPaid ?? 0);
    const storedCardPaid = Number(order.cardPaid ?? 0);

    const externalPaymentAmount = isUPI
      ? Math.max(
          0,
          storedUpiPaid ||
            storedOnlinePaid ||
            Math.max(0, orderGrandTotal - walletPaidVal)
        )
      : isCard
      ? Math.max(
          0,
          storedCardPaid ||
            storedOnlinePaid ||
            Math.max(0, orderGrandTotal - walletPaidVal)
        )
      : 0;

    const codDueAmount = isCOD
      ? Math.max(
          0,
          Number(order.codAmount ?? orderGrandTotal - walletPaidVal)
        )
      : 0;

    const couponCode = String(order.couponCode || "").trim();

    return {
      orderRef,
      invoiceNumber,
      invoiceDate,
      orderOriginalAmount,
      totalMrp: orderOriginalAmount,
      productLevelSavings,
      mrpDiscount: productLevelSavings,
      baseSubtotal,
      subtotal: baseSubtotal,
      effectiveGst,
      gst: effectiveGst,
      gstApplied,
      couponDiscount,
      couponCode,
      shippingVal,
      shipping: shippingVal,
      platformFeeVal,
      convenienceFee: platformFeeVal,
      totalOrderSavings,
      orderGrandTotal,
      grandTotal: orderGrandTotal,
      walletPaidVal,
      walletUsed: walletPaidVal,
      externalPaymentAmount,
      codDueAmount,
      balancePaid: externalPaymentAmount || codDueAmount,
      isUPI,
      isCard,
      isCOD,
      rawPaymentMethod,
      paymentModeRaw: isCOD
        ? "Cash on Delivery"
        : isUPI
        ? "BHIM UPI"
        : isCard
        ? "Debit / Credit Card"
        : rawPaymentMethod || "Online Payment",
      paymentStatusRaw: String(order.paymentStatus || "PAID").toUpperCase(),
    };
  }, [order, items]);

  const downloadInvoice = useCallback(() => {
    if (!order || !invoiceSummary) return;

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // 1. Top Luxury Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 42, "F");

      doc.setTextColor(59, 130, 246);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Tech", 14, 18);
      doc.setTextColor(255, 255, 255);
      doc.text("Store", 33, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("Premium Electronics & Smart Gadgets Store", 14, 25);
      doc.text("GSTIN: 24AABCT1332L1Z5  |  support@techstore.in", 14, 31);

      // Right Side Invoice Title & Badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("TAX INVOICE", pageWidth - 14, 17, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`Invoice No: ${invoiceSummary.invoiceNumber}`, pageWidth - 14, 24, {
        align: "right",
      });
      doc.text(`Order ID: ${invoiceSummary.orderRef}`, pageWidth - 14, 30, {
        align: "right",
      });
      doc.text(`Date: ${invoiceSummary.invoiceDate}`, pageWidth - 14, 36, {
        align: "right",
      });

      // 2. Billing & Order Meta Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 48, pageWidth - 28, 38, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(37, 99, 235);
      doc.text("BILLED & SHIPPED TO", 19, 55);
      doc.text("PAYMENT & ORDER DETAILS", pageWidth / 2 + 6, 55);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(order.customerName || "Valued Customer"), 19, 62);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const addrLine1 = String(order.address || "Verified Delivery Address").slice(0, 48);
      const addrLine2 = [order.city, order.state, order.pincode]
        .filter(Boolean)
        .join(", ");
      const phoneLine = `Phone: ${order.phone || "N/A"}${
        order.email ? `  |  ${order.email}` : ""
      }`;
      doc.text(addrLine1, 19, 68);
      if (addrLine2) doc.text(addrLine2, 19, 73.5);
      doc.text(phoneLine.slice(0, 52), 19, 79.5);

      const rightColX = pageWidth / 2 + 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Payment Mode: ${invoiceSummary.paymentModeRaw}`, rightColX, 62);
      doc.text(`Payment Status: ${invoiceSummary.paymentStatusRaw}`, rightColX, 68);
      doc.text(
        `Order Status: ${String(order.shipment?.status || order.status || "Confirmed")}`,
        rightColX,
        74
      );
      doc.text("Place of Supply: India (INR)", rightColX, 80);

      // 3. Itemized Product Table
      const tableRows = items.map((item, idx) => {
        const qty = Math.max(1, Number(item?.quantity || 1));
        const unitPrice = Number(item?.price || 0);
        const unitMrp = Number(
          item?.oldPrice || item?.mrp || Math.round(unitPrice * 1.25)
        );
        const unitDisc = Math.max(0, unitMrp - unitPrice);
        const lineTotal = unitPrice * qty;

        return [
          idx + 1,
          String(item?.title || item?.name || "TechStore Product"),
          qty,
          formatPdfMoney(unitMrp),
          unitDisc > 0 ? `-${formatPdfMoney(unitDisc)}` : "Rs. 0.00",
          formatPdfMoney(unitPrice),
          formatPdfMoney(lineTotal),
        ];
      });

      autoTable(doc, {
        startY: 92,
        head: [
          [
            "#",
            "Item Description",
            "Qty",
            "Unit MRP",
            "Discount",
            "Unit Price",
            "Line Total",
          ],
        ],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8.8,
          textColor: [30, 41, 59],
          cellPadding: 3.5,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { halign: "left", cellWidth: 58 },
          2: { halign: "center", cellWidth: 13 },
          3: { halign: "right", cellWidth: 25 },
          4: { halign: "right", cellWidth: 24 },
          5: { halign: "right", cellWidth: 26 },
          6: { halign: "right", cellWidth: 26, fontStyle: "bold" },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      const finalY = (doc.lastAutoTable?.finalY || 130) + 8;

      // 4. Order Payment Details Breakdown on Right
      const summaryWidth = 92;
      const summaryX = pageWidth - 14 - summaryWidth;
      let curY = finalY;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 138);
      doc.text("Order Payment Details", summaryX, curY);
      curY += 6.5;

      const summaryRows = [
        {
          label: "Order Amount (MRP)",
          val: formatPdfMoney(invoiceSummary.orderOriginalAmount),
        },
        ...(invoiceSummary.productLevelSavings > 0
          ? [
              {
                label: "Product Discount",
                val: `-${formatPdfMoney(invoiceSummary.productLevelSavings)}`,
                isGreen: true,
              },
            ]
          : []),
        {
          label: "Base Subtotal (Excl. GST)",
          val: formatPdfMoney(invoiceSummary.baseSubtotal),
        },
        {
          label: invoiceSummary.gstApplied
            ? "GST (18%) (Credit Applied)"
            : "GST (18%)",
          val: invoiceSummary.gstApplied
            ? `-${formatPdfMoney(invoiceSummary.effectiveGst)}`
            : `+${formatPdfMoney(invoiceSummary.effectiveGst)}`,
          isGreen: invoiceSummary.gstApplied,
        },
        {
          label: invoiceSummary.couponCode
            ? `Coupon Discount (${invoiceSummary.couponCode})`
            : "Coupon Discount",
          val:
            invoiceSummary.couponDiscount > 0
              ? `-${formatPdfMoney(invoiceSummary.couponDiscount)}`
              : "Rs. 0.00",
          isGreen: invoiceSummary.couponDiscount > 0,
        },
        {
          label: "Shipping / Delivery Fee",
          val:
            invoiceSummary.shippingVal > 0
              ? formatPdfMoney(invoiceSummary.shippingVal)
              : "FREE",
          isGreen: invoiceSummary.shippingVal === 0,
        },
        {
          label: "Convenience Fee (Non-refundable)",
          val: formatPdfMoney(invoiceSummary.platformFeeVal),
        },
        {
          label: invoiceSummary.couponCode
            ? `Total Order Savings (${invoiceSummary.couponCode})`
            : "Total Order Savings",
          val: `-${formatPdfMoney(invoiceSummary.totalOrderSavings)}`,
          isGreen: true,
        },
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);

      summaryRows.forEach((row) => {
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        doc.text(row.label, summaryX, curY);

        if (row.isGreen) {
          doc.setTextColor(22, 163, 74);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
        }
        doc.text(row.val, pageWidth - 14, curY, { align: "right" });
        curY += 5.5;
      });

      // Grand Total Highlight Bar
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(summaryX - 3, curY - 2, summaryWidth + 3, 10, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 58, 138);
      doc.text("Order Total", summaryX + 2, curY + 4.5);
      doc.text(
        formatPdfMoney(invoiceSummary.orderGrandTotal),
        pageWidth - 16,
        curY + 4.5,
        { align: "right" }
      );

      curY += 12;

      // Payment Mode Section
      doc.setDrawColor(226, 232, 240);
      doc.line(summaryX, curY - 1, pageWidth - 14, curY - 1);
      curY += 4.5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Payment Mode", summaryX, curY);
      curY += 5.5;

      const paymentRows = [];
      if (invoiceSummary.isUPI && invoiceSummary.externalPaymentAmount > 0) {
        paymentRows.push([
          "BHIM UPI",
          formatPdfMoney(invoiceSummary.externalPaymentAmount),
        ]);
      }
      if (invoiceSummary.isCard && invoiceSummary.externalPaymentAmount > 0) {
        paymentRows.push([
          "Debit / Credit Card",
          formatPdfMoney(invoiceSummary.externalPaymentAmount),
        ]);
      }
      if (invoiceSummary.isCOD && invoiceSummary.codDueAmount > 0) {
        paymentRows.push([
          "Cash on Delivery",
          formatPdfMoney(invoiceSummary.codDueAmount),
        ]);
      }
      if (
        !invoiceSummary.isUPI &&
        !invoiceSummary.isCard &&
        !invoiceSummary.isCOD &&
        invoiceSummary.externalPaymentAmount > 0
      ) {
        paymentRows.push([
          "Online Payment",
          formatPdfMoney(invoiceSummary.externalPaymentAmount),
        ]);
      }
      if (invoiceSummary.walletPaidVal > 0) {
        paymentRows.push([
          "TechStore Wallet",
          formatPdfMoney(invoiceSummary.walletPaidVal),
        ]);
      }
      if (paymentRows.length === 0) {
        paymentRows.push([
          invoiceSummary.paymentModeRaw,
          formatPdfMoney(invoiceSummary.orderGrandTotal),
        ]);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      paymentRows.forEach(([mode, amount]) => {
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        doc.text(mode, summaryX, curY);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(amount, pageWidth - 14, curY, { align: "right" });
        curY += 5;
      });

      // 5. Left Side Declaration & Authorized Signatory
      const footerY = Math.max(curY + 8, finalY + 48);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, footerY, pageWidth - 14, footerY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Terms & Customer Declaration:", 14, footerY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "1. Goods sold are intended for end-user consumption and covered by standard brand warranty.",
        14,
        footerY + 12.5
      );
      doc.text(
        "2. This is a computer-generated official Tax Invoice and does not require a physical signature.",
        14,
        footerY + 17.5
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(37, 99, 235);
      doc.text("For TechStore Retail Pvt. Ltd.", pageWidth - 14, footerY + 11, {
        align: "right",
      });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Authorized Signatory", pageWidth - 14, footerY + 17, {
        align: "right",
      });

      doc.save(`TechStore-Invoice-${invoiceSummary.orderRef}.pdf`);
      toast.success("Invoice PDF downloaded! 📄");
    } catch (err) {
      console.error("Invoice PDF Error:", err);
      toast.error("Unable to generate PDF invoice.");
    }
  }, [order, invoiceSummary, items]);

  // Trigger instant PDF download when opened from OrderDetails Invoice button
  useEffect(() => {
    if (
      order &&
      invoiceSummary &&
      order.autoDownload &&
      !autoDownloadedRef.current
    ) {
      autoDownloadedRef.current = true;
      const timer = setTimeout(() => {
        downloadInvoice();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [order, invoiceSummary, downloadInvoice]);

  if (loading) {
    return (
      <div className="invoice-page-wrapper">
        <div className="container py-5 text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <h5 className="fw-bold">Preparing Your Tax Invoice...</h5>
        </div>
      </div>
    );
  }

  if (!order || !invoiceSummary) {
    return (
      <div className="invoice-page-wrapper">
        <div className="container py-5 text-center">
          <div className="invoice-empty-card mx-auto">
            <FaFileInvoice size={42} className="text-primary mb-3" />
            <h3 className="fw-bold">No Invoice Data Found</h3>
            <p className="text-muted mb-4">
              Please open the invoice from your Order Details page.
            </p>
            <button
              type="button"
              className="invoice-action-btn primary"
              onClick={() => navigate("/orders")}
            >
              Go to My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-page-wrapper">
      <div className="container py-4 py-md-5">
        {/* TOP ACTION BAR (HIDDEN IN PRINT) */}
        <div className="invoice-toolbar no-print mb-4">
          <button
            type="button"
            className="invoice-back-btn"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
            <span>Back to Order</span>
          </button>

          <div className="invoice-toolbar-actions">
            <button
              type="button"
              className="invoice-action-btn secondary"
              onClick={() => window.print()}
            >
              <FaPrint />
              <span>Print Invoice</span>
            </button>

            <button
              type="button"
              className="invoice-action-btn primary"
              onClick={downloadInvoice}
            >
              <FaDownload />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* MAIN TAX INVOICE SHEET */}
        <div className="invoice-sheet-card">
          {/* SHEET HEADER BANNER */}
          <div className="invoice-sheet-banner">
            <div className="invoice-brand-col">
              <div className="invoice-brand-logo">
                <span className="brand-tech">Tech</span>
                <span className="brand-store">Store</span>
              </div>
              <p className="invoice-brand-tagline">
                Premium Electronics & Verified Smart Gadgets
              </p>
              <div className="invoice-gst-pill">
                <FaShieldAlt />
                <span>GSTIN: 24AABCT1332L1Z5</span>
              </div>
            </div>

            <div className="invoice-doc-meta">
              <span className="invoice-doc-badge">
                <FaCheckCircle /> OFFICIAL TAX INVOICE
              </span>
              <h2 className="invoice-doc-number">
                #{invoiceSummary.invoiceNumber}
              </h2>
              <div className="invoice-doc-dates">
                <span>
                  <strong>Order ID:</strong> #{invoiceSummary.orderRef}
                </span>
                <span>
                  <strong>Invoice Date:</strong> {invoiceSummary.invoiceDate}
                </span>
              </div>
            </div>
          </div>

          {/* ADDRESS & PAYMENT GRID */}
          <div className="invoice-info-grid">
            <div className="invoice-info-box">
              <div className="invoice-info-head">
                <FaMapMarkerAlt />
                <span>Billed & Shipped To</span>
              </div>
              <h5 className="invoice-customer-name">
                {order.customerName || "Valued Customer"}
              </h5>
              <p className="invoice-customer-address">
                {order.address || "Standard Doorstep Delivery"}
                {order.city || order.state || order.pincode ? (
                  <>
                    <br />
                    {[order.city, order.state].filter(Boolean).join(", ")}
                    {order.pincode ? ` - ${order.pincode}` : ""}
                  </>
                ) : null}
              </p>
              <div className="invoice-customer-contact">
                <span>
                  <strong>Phone:</strong> {order.phone || "N/A"}
                </span>
                {order.email && (
                  <span>
                    <strong>Email:</strong> {order.email}
                  </span>
                )}
              </div>
            </div>

            <div className="invoice-info-box">
              <div className="invoice-info-head">
                <FaCreditCard />
                <span>Payment & Fulfillment Summary</span>
              </div>

              <div className="invoice-kv-list">
                <div className="invoice-kv-row">
                  <span>Payment Method</span>
                  <strong>{invoiceSummary.paymentModeRaw}</strong>
                </div>
                <div className="invoice-kv-row">
                  <span>Payment Status</span>
                  <span className="invoice-paid-chip">
                    {invoiceSummary.paymentStatusRaw}
                  </span>
                </div>
                <div className="invoice-kv-row">
                  <span>Fulfillment Status</span>
                  <strong>
                    {String(
                      order.shipment?.status || order.status || "Confirmed"
                    ).replace(/_/g, " ")}
                  </strong>
                </div>
                <div className="invoice-kv-row">
                  <span>Currency / Supply</span>
                  <strong>INR (₹) • India</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ITEMIZED TABLE */}
          <div className="invoice-table-container">
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Description</th>
                  <th className="text-center">Qty</th>
                  <th className="text-end">Unit MRP</th>
                  <th className="text-end">Discount</th>
                  <th className="text-end">Selling Price</th>
                  <th className="text-end">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const qty = Math.max(1, Number(item?.quantity || 1));
                  const unitPrice = Number(item?.price || 0);
                  const unitMrp = Number(
                    item?.oldPrice || item?.mrp || Math.round(unitPrice * 1.25)
                  );
                  const unitDisc = Math.max(0, unitMrp - unitPrice);
                  const lineTotal = unitPrice * qty;

                  return (
                    <tr key={idx}>
                      <td className="row-index">{idx + 1}</td>
                      <td>
                        <div className="invoice-item-title">
                          {item?.title || item?.name || "TechStore Product"}
                        </div>
                        <small className="invoice-item-sub">
                          Brand: {item?.brand || "TechStore"} • HSN: 8517
                        </small>
                      </td>
                      <td className="text-center fw-bold">{qty}</td>
                      <td className="text-end text-muted">
                        ₹{formatINR(unitMrp)}
                      </td>
                      <td className="text-end text-success">
                        {unitDisc > 0 ? `-₹${formatINR(unitDisc)}` : "₹0.00"}
                      </td>
                      <td className="text-end fw-semibold">
                        ₹{formatINR(unitPrice)}
                      </td>
                      <td className="text-end fw-bold invoice-line-total">
                        ₹{formatINR(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TOTALS & SIGNATURE SECTION */}
          <div className="invoice-bottom-grid">
            <div className="invoice-notes-col">
              <div className="invoice-declaration-box">
                <h6>Terms & Warranty Declaration</h6>
                <ul>
                  <li>
                    All items listed in this invoice are covered by official
                    manufacturer warranty from the date of delivery.
                  </li>
                  <li>
                    Eligible items can be returned or exchanged within 7 days of
                    delivery through the TechStore Order Details portal.
                  </li>
                  <li>
                    This is a digitally generated Tax Invoice and is valid
                    without a physical stamp or signature.
                  </li>
                </ul>
              </div>

              <div className="invoice-signatory-box">
                <span className="signatory-company">
                  For TechStore Retail Pvt. Ltd.
                </span>
                <div className="signatory-stamp">TechStore Verified</div>
                <small>Authorized Signatory</small>
              </div>
            </div>

            <div className="invoice-totals-col">
              <div className="invoice-totals-card">
                <div className="order-payment-header-row mb-3">
                  <h5 className="order-payment-heading m-0">
                    Order Payment Details
                  </h5>
                </div>

                <div className="order-payment-breakdown invoice-screen-breakdown">
                  <div className="order-payment-row">
                    <span>Order Amount (MRP)</span>
                    <strong>₹{formatINR(invoiceSummary.orderOriginalAmount)}</strong>
                  </div>

                  {invoiceSummary.productLevelSavings > 0 && (
                    <div className="order-payment-row is-savings">
                      <span>Product Discount</span>
                      <strong className="order-savings-amount">
                        -₹{formatINR(invoiceSummary.productLevelSavings)}
                      </strong>
                    </div>
                  )}

                  <div className="order-payment-row">
                    <span>Base Subtotal (Excl. GST)</span>
                    <strong>₹{formatINR(invoiceSummary.baseSubtotal)}</strong>
                  </div>

                  <div className="order-payment-row">
                    <span>
                      GST (18%)
                      {invoiceSummary.gstApplied && (
                        <small className="d-block text-success fw-semibold">
                          Corporate GSTIN Credit Applied
                        </small>
                      )}
                    </span>
                    {invoiceSummary.gstApplied ? (
                      <strong className="order-savings-amount">
                        -₹{formatINR(invoiceSummary.effectiveGst)}
                      </strong>
                    ) : (
                      <strong>+₹{formatINR(invoiceSummary.effectiveGst)}</strong>
                    )}
                  </div>

                  <div className="order-payment-row is-savings">
                    <span>
                      Coupon Discount
                      {invoiceSummary.couponCode ? (
                        <small className="d-block text-success fw-semibold">
                          Coupon applied: {invoiceSummary.couponCode}
                        </small>
                      ) : (
                        <small className="d-block text-muted">
                          {invoiceSummary.couponDiscount > 0
                            ? "Promo discount applied"
                            : "No coupon applied"}
                        </small>
                      )}
                    </span>
                    <strong
                      className={
                        invoiceSummary.couponDiscount > 0
                          ? "order-savings-amount"
                          : "text-muted"
                      }
                    >
                      {invoiceSummary.couponDiscount > 0
                        ? `-₹${formatINR(invoiceSummary.couponDiscount)}`
                        : "₹0.00"}
                    </strong>
                  </div>

                  <div className="order-payment-row">
                    <span>Shipping / Delivery Fee</span>
                    <strong
                      className={
                        invoiceSummary.shippingVal === 0 ? "text-success" : ""
                      }
                    >
                      {invoiceSummary.shippingVal > 0
                        ? `₹${formatINR(invoiceSummary.shippingVal)}`
                        : "FREE"}
                    </strong>
                  </div>

                  <div className="order-payment-row">
                    <div>
                      <span>Convenience Fee</span>
                      <small className="order-non-refundable-label d-block text-muted">
                        (Non-refundable)
                      </small>
                    </div>
                    <strong>₹{formatINR(invoiceSummary.platformFeeVal)}</strong>
                  </div>

                  <div className="order-payment-row is-savings">
                    <span>
                      Total Order Savings
                      {invoiceSummary.couponCode && (
                        <small className="d-block text-success">
                          Includes coupon ({invoiceSummary.couponCode})
                        </small>
                      )}
                    </span>
                    <strong className="order-savings-amount">
                      -₹{formatINR(invoiceSummary.totalOrderSavings)}
                    </strong>
                  </div>

                  <div className="order-payment-total-row">
                    <span>Order Total</span>
                    <strong>₹{formatINR(invoiceSummary.orderGrandTotal)}</strong>
                  </div>
                </div>

                <hr className="order-payment-section-divider my-3" />

                <div className="order-payment-mode-section">
                  <h6 className="order-payment-mode-heading">Payment Mode</h6>

                  <div className="order-payment-mode-list">
                    {invoiceSummary.isUPI &&
                      invoiceSummary.externalPaymentAmount > 0 && (
                        <div className="order-payment-mode-item">
                          <div className="order-payment-mode-left">
                            <span className="order-payment-mode-icon upi">
                              <FaMobileAlt />
                            </span>
                            <strong>BHIM UPI</strong>
                          </div>
                          <strong className="order-payment-mode-amount">
                            ₹{formatINR(invoiceSummary.externalPaymentAmount)}
                          </strong>
                        </div>
                      )}

                    {invoiceSummary.isCard &&
                      invoiceSummary.externalPaymentAmount > 0 && (
                        <div className="order-payment-mode-item">
                          <div className="order-payment-mode-left">
                            <span className="order-payment-mode-icon card-mode">
                              <FaCreditCard />
                            </span>
                            <strong>Debit / Credit Card</strong>
                          </div>
                          <strong className="order-payment-mode-amount">
                            ₹{formatINR(invoiceSummary.externalPaymentAmount)}
                          </strong>
                        </div>
                      )}

                    {invoiceSummary.isCOD && invoiceSummary.codDueAmount > 0 && (
                      <div className="order-payment-mode-item">
                        <div className="order-payment-mode-left">
                          <span className="order-payment-mode-icon cod">
                            <FaMoneyBillWave />
                          </span>
                          <strong>Cash on Delivery</strong>
                        </div>
                        <strong className="order-payment-mode-amount">
                          ₹{formatINR(invoiceSummary.codDueAmount)}
                        </strong>
                      </div>
                    )}

                    {!invoiceSummary.isUPI &&
                      !invoiceSummary.isCard &&
                      !invoiceSummary.isCOD &&
                      invoiceSummary.externalPaymentAmount > 0 && (
                        <div className="order-payment-mode-item">
                          <div className="order-payment-mode-left">
                            <span className="order-payment-mode-icon card-mode">
                              <FaCreditCard />
                            </span>
                            <strong>Online Payment</strong>
                          </div>
                          <strong className="order-payment-mode-amount">
                            ₹{formatINR(invoiceSummary.externalPaymentAmount)}
                          </strong>
                        </div>
                      )}

                    {invoiceSummary.walletPaidVal > 0 && (
                      <div className="order-payment-mode-item">
                        <div className="order-payment-mode-left">
                          <span className="order-payment-mode-icon wallet">
                            <FaWallet />
                          </span>
                          <strong>TechStore Wallet</strong>
                        </div>
                        <strong className="order-payment-mode-amount">
                          ₹{formatINR(invoiceSummary.walletPaidVal)}
                        </strong>
                      </div>
                    )}

                    {!invoiceSummary.externalPaymentAmount &&
                      !invoiceSummary.codDueAmount &&
                      !invoiceSummary.walletPaidVal && (
                        <div className="order-payment-mode-item">
                          <div className="order-payment-mode-left">
                            <span className="order-payment-mode-icon card-mode">
                              <FaCreditCard />
                            </span>
                            <strong>{invoiceSummary.paymentModeRaw}</strong>
                          </div>
                          <strong className="order-payment-mode-amount">
                            ₹{formatINR(invoiceSummary.orderGrandTotal)}
                          </strong>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Invoice;
