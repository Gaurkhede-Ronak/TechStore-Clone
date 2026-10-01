import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../css/Invoice.css";

function Invoice() {

    const location = useLocation();
    const navigate = useNavigate();

    const order = location.state || {};

    function downloadInvoice() {

        const doc = new jsPDF();

        // Company Header
        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235);
        doc.text("TechStore", 14, 20);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text("Premium Electronics Store", 14, 28);

        doc.setDrawColor(220);
        doc.line(14, 34, 195, 34);

        // Invoice Details
        doc.setFontSize(14);
        doc.setTextColor(0);

        doc.text("Invoice", 150, 20);

        doc.setFontSize(11);

        doc.text(`Invoice No : ${order.invoiceNo}`, 140, 30);
        doc.text(`Order ID : ${order.orderId}`, 140, 37);
        doc.text(`Transaction : ${order.transactionId}`, 140, 44);
        doc.text(`Date : ${order.orderDate}`, 140, 51);

        // Customer
        doc.setFontSize(13);

        doc.text("Bill To", 14, 48);

        doc.setFontSize(11);

        doc.text(order.fullName || "", 14, 56);
        doc.text(order.email || "", 14, 63);
        doc.text(order.phone || "", 14, 70);
        doc.text(order.address || "", 14, 77);
        doc.text(`${order.city}, ${order.state}`, 14, 84);
        doc.text(order.pincode || "", 14, 91);

        // Products Table
        const rows = (order.items || []).map((item) => [

            item.title,
            item.quantity,
            `$${item.price}`,
            `$${(item.price * item.quantity).toFixed(2)}`

        ]);

        autoTable(doc, {

            startY: 100,

            head: [[
                "Product",
                "Qty",
                "Price",
                "Total"
            ]],

            body: rows,

            theme: "grid",

            headStyles: {

                fillColor: [37, 99, 235]

            }

        });

        let y = doc.lastAutoTable.finalY + 15;

        doc.setFontSize(11);

        doc.text(`Subtotal : $${order.subTotal?.toFixed(2)}`, 140, y);

        y += 8;

        doc.text(`Shipping : $${order.shipping?.toFixed(2)}`, 140, y);

        y += 8;

        doc.text(`GST : $${order.tax?.toFixed(2)}`, 140, y);

        y += 8;

        doc.text(`Discount : -$${order.discount?.toFixed(2)}`, 140, y);

        y += 8;

        doc.setFontSize(14);

        doc.text(`Grand Total : $${order.total?.toFixed(2)}`, 140, y);

        y += 20;

        doc.setFontSize(11);

        doc.setTextColor(100);

        doc.text(
            "Thank you for shopping with TechStore!",
            14,
            y
        );

        doc.save(`Invoice-${order.invoiceNo}.pdf`);

    }

    return (

        <div className="container py-5">

            <div className="invoice-card">

                <h2>Invoice</h2>

                <p className="text-muted">

                    Your order has been placed successfully.

                </p>

                <div className="invoice-info">

                    <p>

                        <strong>Invoice No :</strong>

                        {order.invoiceNo}

                    </p>

                    <p>

                        <strong>Order ID :</strong>

                        {order.orderId}

                    </p>

                    <p>

                        <strong>Total :</strong>

                        ${order.total?.toFixed(2)}

                    </p>

                </div>

                <button
                    className="btn btn-primary me-3"
                    onClick={downloadInvoice}
                >

                    Download PDF

                </button>

                <button
                    className="btn btn-success"
                    onClick={() => navigate("/orders")}
                >

                    View Orders

                </button>

            </div>

        </div>

    );

}

export default Invoice;