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
      order.createdAt || order.$createdAt
    );

    const computedSubtotal = items.reduce(
      (sum, it) =>
        sum + Number(it?.price || 0) * Math.max(1, Number(it?.quantity || 1)),
      0
    );

    const computedMrp = items.reduce((sum, it) => {
      const unitPrice = Number(it?.price || 0);
      const unitMrp = Number(it?.oldPrice || it?.mrp || Math.round(unitPrice * 1.25));
      const qty = Math.max(1, Number(it?.quantity || 1));
      return sum + unitMrp * qty;
    }, 0);

    const subtotal = Number(order.subtotal || computedSubtotal || 0);
    const totalMrp = Math.max(computedMrp, subtotal);
    const mrpDiscount = Math.max(0, totalMrp - subtotal);
    const couponDiscount = Number(order.discount || 0);
    const convenienceFee = Number(order.convenienceFee ?? 7);
    const gst = Number(order.gst ?? order.tax ?? Math.round(subtotal * 0.18));
    const shipping = Number(order.shipping || 0);
    const grandTotal = Number(
      order.totalAmount ||
        order.finalAmount ||
        Math.max(0, subtotal - couponDiscount + convenienceFee + gst + shipping)
    );
    const walletUsed = Number(order.walletUsed || 0);
    const balancePaid = Math.max(0, Number(order.onlinePaid ?? grandTotal - walletUsed));

    const paymentModeRaw = String(order.paymentMethod || "ONLINE").toUpperCase();
    const paymentStatusRaw = String(order.paymentStatus || "PAID").toUpperCase();

    return {
      orderRef,
      invoiceNumber,
      invoiceDate,
      totalMrp,
      subtotal,
      mrpDiscount,
      couponDiscount,
      convenienceFee,
      gst,
      shipping,
      grandTotal,
      walletUsed,
      balancePaid,
      paymentModeRaw,
      paymentStatusRaw,
      couponCode: order.couponCode || "",
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

      // 4. Price Breakup Summary Card on Right
      const summaryX = pageWidth - 96;
      let curY = finalY;

      const summaryRows = [
        ["Total MRP", formatPdfMoney(invoiceSummary.totalMrp)],
        ...(invoiceSummary.mrpDiscount > 0
          ? [["Discount on MRP", `-${formatPdfMoney(invoiceSummary.mrpDiscount)}`]]
          : []),
        ["Selling Subtotal", formatPdfMoney(invoiceSummary.subtotal)],
        ...(invoiceSummary.couponDiscount > 0
          ? [
              [
                `Coupon (${invoiceSummary.couponCode || "APPLIED"})`,
                `-${formatPdfMoney(invoiceSummary.couponDiscount)}`,
              ],
            ]
          : []),
        ["Convenience Fee", formatPdfMoney(invoiceSummary.convenienceFee)],
        ["GST & Taxes", formatPdfMoney(invoiceSummary.gst)],
        [
          "Delivery Charges",
          invoiceSummary.shipping > 0
            ? formatPdfMoney(invoiceSummary.shipping)
            : "FREE",
        ],
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);

      summaryRows.forEach(([label, val]) => {
        doc.setTextColor(71, 85, 105);
        doc.text(label, summaryX, curY);
        doc.setTextColor(15, 23, 42);
        doc.text(val, pageWidth - 14, curY, { align: "right" });
        curY += 6;
      });

      // Grand Total Highlight Bar
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(summaryX - 4, curY - 3, 86, 11, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 58, 138);
      doc.text("Grand Total", summaryX, curY + 4);
      doc.text(formatPdfMoney(invoiceSummary.grandTotal), pageWidth - 16, curY + 4, {
        align: "right",
      });

      curY += 15;

      if (invoiceSummary.walletUsed > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(22, 163, 74);
        doc.text(
          `Paid via TechStore Wallet: ${formatPdfMoney(invoiceSummary.walletUsed)}`,
          summaryX,
          curY
        );
        curY += 5;
        doc.setTextColor(71, 85, 105);
        doc.text(
          `Balance (${invoiceSummary.paymentModeRaw}): ${formatPdfMoney(
            invoiceSummary.balancePaid
          )}`,
          summaryX,
          curY
        );
        curY += 6;
      }

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
                <div className="invoice-total-row">
                  <span>Total MRP</span>
                  <strong>₹{formatINR(invoiceSummary.totalMrp)}</strong>
                </div>

                {invoiceSummary.mrpDiscount > 0 && (
                  <div className="invoice-total-row discount">
                    <span>Discount on MRP</span>
                    <strong>-₹{formatINR(invoiceSummary.mrpDiscount)}</strong>
                  </div>
                )}

                <div className="invoice-total-row">
                  <span>Selling Subtotal</span>
                  <strong>₹{formatINR(invoiceSummary.subtotal)}</strong>
                </div>

                {invoiceSummary.couponDiscount > 0 && (
                  <div className="invoice-total-row discount">
                    <span>
                      Coupon Discount
                      {invoiceSummary.couponCode
                        ? ` (${invoiceSummary.couponCode})`
                        : ""}
                    </span>
                    <strong>
                      -₹{formatINR(invoiceSummary.couponDiscount)}
                    </strong>
                  </div>
                )}

                <div className="invoice-total-row">
                  <span>Convenience Fee</span>
                  <strong>₹{formatINR(invoiceSummary.convenienceFee)}</strong>
                </div>

                <div className="invoice-total-row">
                  <span>GST & Applicable Taxes</span>
                  <strong>₹{formatINR(invoiceSummary.gst)}</strong>
                </div>

                <div className="invoice-total-row">
                  <span>Delivery Charges</span>
                  <strong
                    className={
                      invoiceSummary.shipping === 0 ? "text-success" : ""
                    }
                  >
                    {invoiceSummary.shipping > 0
                      ? `₹${formatINR(invoiceSummary.shipping)}`
                      : "FREE"}
                  </strong>
                </div>

                <div className="invoice-grand-total-row">
                  <span>Grand Total</span>
                  <strong>₹{formatINR(invoiceSummary.grandTotal)}</strong>
                </div>

                {invoiceSummary.walletUsed > 0 && (
                  <div className="invoice-payment-split">
                    <div className="split-row">
                      <span>Paid via TechStore Wallet</span>
                      <strong>₹{formatINR(invoiceSummary.walletUsed)}</strong>
                    </div>
                    <div className="split-row">
                      <span>
                        Paid via {invoiceSummary.paymentModeRaw}
                      </span>
                      <strong>₹{formatINR(invoiceSummary.balancePaid)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Invoice;
