import { useCallback, useEffect, useMemo, useState } from "react";

import {
    FaChartLine,
    FaShoppingCart,
    FaRupeeSign,
    FaUsers,
    FaBoxOpen,
    FaSyncAlt,
    FaExclamationTriangle,
    FaDatabase,
    FaTrophy,
    FaCalendarAlt,
    FaBoxes,
} from "react-icons/fa";

import { Databases, Query } from "appwrite";
import { toast } from "react-hot-toast";

import client from "../../appwrite/config";
import orderService from "../../appwrite/orderService";
import productService from "../../appwrite/productService";

import "../../css/Analytics.css";


  // APPWRITE

const databases = new Databases(client);

const DATABASE_ID =
    import.meta.env.VITE_APPWRITE_DATABASE_ID;

const USERS_COLLECTION_ID =
    import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID;


  // HELPERS

const safeNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
};


const getOrderTotal = (order) => {
    return safeNumber(
        order?.total ??
        order?.grandTotal ??
        order?.amount ??
        order?.finalAmount ??
        order?.price ??
        0
    );
};


const getOrderDate = (order) => {
    return (
        order?.createdAt ||
        order?.orderDate ||
        order?.$createdAt ||
        order?.date ||
        null
    );
};


const getOrderItems = (order) => {
    const items =
        order?.items ||
        order?.products ||
        order?.cartItems ||
        [];

    if (!Array.isArray(items)) {
        return [];
    }

    return items;
};


const getItemName = (item) => {
    return (
        item?.name ||
        item?.productName ||
        item?.title ||
        item?.product?.name ||
        item?.product?.title ||
        "Unknown Product"
    );
};


const getItemQuantity = (item) => {
    return (
        safeNumber(
            item?.qty ??
            item?.quantity ??
            item?.count ??
            1
        ) || 1
    );
};


const getItemPrice = (item) => {
    return safeNumber(
        item?.price ??
        item?.sellingPrice ??
        item?.productPrice ??
        item?.amount ??
        item?.total ??
        0
    );
};


const getItemId = (item) => {
    return (
        item?.productId ||
        item?.productID ||
        item?.id ||
        item?.$id ||
        getItemName(item)
    );
};


const isCancelledOrder = (order) => {
    const status = String(
        order?.status ||
        order?.shippingStatus ||
        ""
    ).toUpperCase();

    return [
        "CANCELLED",
        "CANCELED",
        "CANCEL",
    ].includes(status);
};


const formatCurrency = (value) => {
    return `₹${safeNumber(value).toLocaleString("en-IN")}`;
};


const formatCompactCurrency = (value) => {
    const number = safeNumber(value);

    if (number >= 10000000) {
        return `₹${(number / 10000000).toFixed(1)}Cr`;
    }

    if (number >= 100000) {
        return `₹${(number / 100000).toFixed(1)}L`;
    }

    if (number >= 1000) {
        return `₹${(number / 1000).toFixed(1)}K`;
    }

    return formatCurrency(number);
};


const getMonthKey = (date) => {
    if (!date) {
        return null;
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return `${parsed.getFullYear()}-${String(
        parsed.getMonth() + 1
    ).padStart(2, "0")}`;
};


const getMonthLabel = (date) => {
    if (!date) {
        return "";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return parsed.toLocaleDateString(
        "en-IN",
        {
            month: "short",
        }
    );
};


  // USERS LOADER

const getAllUsers = async () => {
    if (!DATABASE_ID || !USERS_COLLECTION_ID) {
        return [];
    }

    const allUsers = [];
    let offset = 0;

    try {
        while (true) {
            const response =
                await databases.listDocuments(
                    DATABASE_ID,
                    USERS_COLLECTION_ID,
                    [
                        Query.limit(100),
                        Query.offset(offset),
                    ]
                );

            allUsers.push(
                ...response.documents
            );

            if (
                response.documents.length < 100
            ) {
                break;
            }

            offset += 100;
        }

        return allUsers;
    } catch (error) {
        console.error(
            "Users Analytics Error:",
            error
        );

        return [];
    }
};


  // ANALYTICS COMPONENT

function Analytics() {

    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [error, setError] =
        useState("");


  // LOAD DATA

    const loadAnalytics = useCallback(
        async (showToast = false) => {

            try {

                setError("");

                if (showToast) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }


  // ORDERS

                let ordersResponse = [];

                try {

                    const response =
                        await orderService.getOrders();

                    ordersResponse =
                        Array.isArray(response)
                            ? response
                            : response?.documents || [];

                } catch (orderError) {

                    console.error(
                        "Orders Analytics Error:",
                        orderError
                    );

                    ordersResponse = [];
                }


  // PRODUCTS

                let productsResponse = [];

                try {

                    const response =
                        await productService.getProducts();

                    productsResponse =
                        response?.documents ||
                        (Array.isArray(response)
                            ? response
                            : []);

                } catch (productError) {

                    console.error(
                        "Products Analytics Error:",
                        productError
                    );

                    productsResponse = [];
                }


  // CUSTOMERS

                const usersResponse =
                    await getAllUsers();


                setOrders(
                    ordersResponse
                );

                setProducts(
                    productsResponse
                );

                setCustomers(
                    usersResponse
                );


                if (showToast) {
                    toast.success(
                        "Analytics refreshed successfully"
                    );
                }

            } catch (error) {

                console.error(
                    "Analytics Load Error:",
                    error
                );

                setError(
                    error?.message ||
                    "Failed to load analytics data."
                );

                toast.error(
                    "Failed to load analytics"
                );

            } finally {

                setLoading(false);
                setRefreshing(false);
            }

        },
        []
    );


    useEffect(() => {
        loadAnalytics(false);
    }, [loadAnalytics]);


  // CALCULATE ANALYTICS

    const analytics = useMemo(() => {

        const validOrders =
            orders.filter(
                (order) => !isCancelledOrder(order)
            );


  // REVENUE

        const totalRevenue =
            validOrders.reduce(
                (sum, order) =>
                    sum + getOrderTotal(order),
                0
            );


  // MONTHLY SALES

        const monthlyMap = {};

        validOrders.forEach((order) => {

            const date =
                getOrderDate(order);

            const monthKey =
                getMonthKey(date);

            if (!monthKey) {
                return;
            }

            if (!monthlyMap[monthKey]) {

                monthlyMap[monthKey] = {
                    month: getMonthLabel(date),
                    sales: 0,
                    orders: 0,
                };
            }

            monthlyMap[monthKey].sales +=
                getOrderTotal(order);

            monthlyMap[monthKey].orders += 1;
        });


        const monthlySales =
            Object.entries(monthlyMap)
                .sort(([a], [b]) =>
                    a.localeCompare(b)
                )
                .slice(-12)
                .map(
                    ([key, value]) => ({
                        key,
                        ...value,
                    })
                );


  // TOP PRODUCTS

        const productMap = {};


        validOrders.forEach((order) => {

            const items =
                getOrderItems(order);


            items.forEach((item) => {

                const id =
                    String(getItemId(item));

                const name =
                    getItemName(item);

                const quantity =
                    getItemQuantity(item);

                const price =
                    getItemPrice(item);

                if (!productMap[id]) {

                    productMap[id] = {
                        id,
                        name,
                        sold: 0,
                        revenue: 0,
                    };
                }


                productMap[id].sold +=
                    quantity;

                productMap[id].revenue +=
                    quantity * price;
            });
        });


        const topProducts =
            Object.values(productMap)
                .sort(
                    (a, b) =>
                        b.sold - a.sold
                )
                .slice(0, 10);


  // AVERAGE ORDER VALUE

        const averageOrderValue =
            validOrders.length > 0
                ? totalRevenue /
                  validOrders.length
                : 0;


  // TOTAL UNITS SOLD

        const totalUnitsSold =
            validOrders.reduce(
                (total, order) => {

                    const items =
                        getOrderItems(order);

                    return (
                        total +
                        items.reduce(
                            (sum, item) =>
                                sum +
                                getItemQuantity(item),
                            0
                        )
                    );
                },
                0
            );


  // INVENTORY

        const totalProducts =
            products.length;

        const totalStock =
            products.reduce(
                (sum, product) =>
                    sum +
                    safeNumber(
                        product?.stock
                    ),
                0
            );


  // CUSTOMER COUNT

        const totalCustomers =
            customers.length;


        return {

            totalRevenue,

            totalOrders:
                validOrders.length,

            totalCustomers,

            totalProducts,

            totalStock,

            totalUnitsSold,

            averageOrderValue,

            monthlySales,

            topProducts,
        };

    }, [
        orders,
        products,
        customers,
    ]);


  // MAX MONTHLY SALES

    const maxMonthlySales =
        Math.max(
            ...analytics.monthlySales.map(
                (item) =>
                    item.sales
            ),
            1
        );


  // LOADING

    if (loading) {

        return (
            <div className="container-fluid analytics-page py-4">

                <div className="analytics-loading">

                    <div className="analytics-spinner">
                        <FaSyncAlt />
                    </div>

                    <h5>
                        Loading Analytics...
                    </h5>

                    <p>
                        Fetching your latest
                        Appwrite data.
                    </p>

                </div>

            </div>
        );
    }


  // ERROR

    if (error && !orders.length && !products.length) {

        return (
            <div className="container-fluid analytics-page py-4">

                <div className="analytics-error">

                    <div className="analytics-error-icon">
                        <FaExclamationTriangle />
                    </div>

                    <h4>
                        Unable to Load Analytics
                    </h4>

                    <p>
                        {error}
                    </p>

                    <button
                        className="btn btn-primary"
                        onClick={() =>
                            loadAnalytics(true)
                        }
                    >
                        <FaSyncAlt className="me-2" />
                        Try Again
                    </button>

                </div>

            </div>
        );
    }


    return (

        <div className="container-fluid analytics-page py-4">


            {/* HEADER */}

            <div className="analytics-header">

                <div>

                    <div className="analytics-title-row">

                        <div className="analytics-title-icon">
                            <FaChartLine />
                        </div>

                        <div>

                            <h2 className="analytics-page-title">
                                Analytics Dashboard
                            </h2>

                            <p className="analytics-subtitle">
                                Real-time business performance
                                from your Appwrite database.
                            </p>

                        </div>

                    </div>

                </div>


                <button
                    className="btn analytics-refresh-btn"
                    onClick={() =>
                        loadAnalytics(true)
                    }
                    disabled={refreshing}
                >

                    <FaSyncAlt
                        className={
                            refreshing
                                ? "analytics-spin me-2"
                                : "me-2"
                        }
                    />

                    {refreshing
                        ? "Refreshing..."
                        : "Refresh Data"}

                </button>

            </div>


            {/* DATABASE STATUS */}

            <div className="analytics-db-banner">

                <div className="analytics-db-icon">
                    <FaDatabase />
                </div>

                <div>

                    <strong>
                        Live Appwrite Analytics
                    </strong>

                    <span>
                        Data is calculated from your
                        Orders, Products and Users collections.
                    </span>

                </div>

            </div>


            {/* STATISTICS */}

            <div className="row g-4 mb-4">


                {/* Revenue */}

                <div className="col-xl-3 col-md-6">

                    <div className="analytics-stat-card revenue-card">

                        <div className="analytics-stat-content">

                            <span>
                                Total Revenue
                            </span>

                            <h3>
                                {formatCompactCurrency(
                                    analytics.totalRevenue
                                )}
                            </h3>

                            <small>
                                From {analytics.totalOrders}
                                valid orders
                            </small>

                        </div>

                        <div className="analytics-stat-icon">
                            <FaRupeeSign />
                        </div>

                    </div>

                </div>


                {/* Orders */}

                <div className="col-xl-3 col-md-6">

                    <div className="analytics-stat-card orders-card">

                        <div className="analytics-stat-content">

                            <span>
                                Total Orders
                            </span>

                            <h3>
                                {analytics.totalOrders.toLocaleString(
                                    "en-IN"
                                )}
                            </h3>

                            <small>
                                Cancelled orders excluded
                            </small>

                        </div>

                        <div className="analytics-stat-icon">
                            <FaShoppingCart />
                        </div>

                    </div>

                </div>


                {/* Customers */}

                <div className="col-xl-3 col-md-6">

                    <div className="analytics-stat-card customer-card">

                        <div className="analytics-stat-content">

                            <span>
                                Total Customers
                            </span>

                            <h3>
                                {analytics.totalCustomers.toLocaleString(
                                    "en-IN"
                                )}
                            </h3>

                            <small>
                                Registered users
                            </small>

                        </div>

                        <div className="analytics-stat-icon">
                            <FaUsers />
                        </div>

                    </div>

                </div>


                {/* Products */}

                <div className="col-xl-3 col-md-6">

                    <div className="analytics-stat-card product-card">

                        <div className="analytics-stat-content">

                            <span>
                                Total Products
                            </span>

                            <h3>
                                {analytics.totalProducts.toLocaleString(
                                    "en-IN"
                                )}
                            </h3>

                            <small>
                                {analytics.totalStock.toLocaleString(
                                    "en-IN"
                                )} units in stock
                            </small>

                        </div>

                        <div className="analytics-stat-icon">
                            <FaBoxOpen />
                        </div>

                    </div>

                </div>

            </div>


            {/* SECONDARY STATS */}

            <div className="row g-4 mb-4">

                <div className="col-xl-4 col-md-6">

                    <div className="analytics-mini-card">

                        <div className="analytics-mini-icon">
                            <FaRupeeSign />
                        </div>

                        <div>

                            <span>
                                Average Order Value
                            </span>

                            <strong>
                                {formatCurrency(
                                    analytics.averageOrderValue
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div className="col-xl-4 col-md-6">

                    <div className="analytics-mini-card">

                        <div className="analytics-mini-icon">
                            <FaBoxes />
                        </div>

                        <div>

                            <span>
                                Units Sold
                            </span>

                            <strong>
                                {analytics.totalUnitsSold.toLocaleString(
                                    "en-IN"
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div className="col-xl-4 col-md-6">

                    <div className="analytics-mini-card">

                        <div className="analytics-mini-icon">
                            <FaCalendarAlt />
                        </div>

                        <div>

                            <span>
                                Sales Months
                            </span>

                            <strong>
                                {analytics.monthlySales.length}
                            </strong>

                        </div>

                    </div>

                </div>

            </div>


            {/* MONTHLY SALES */}

            <div className="card analytics-section-card mb-4">

                <div className="card-header analytics-section-header">

                    <div>

                        <h5>
                            Monthly Sales Performance
                        </h5>

                        <span>
                            Revenue generated from actual orders
                        </span>

                    </div>

                    <div className="analytics-header-badge">
                        <FaChartLine />
                        Live Data
                    </div>

                </div>


                <div className="card-body">

                    {analytics.monthlySales.length === 0 ? (

                        <div className="analytics-empty">
                            <FaChartLine />
                            <h6>
                                No sales data available
                            </h6>
                            <p>
                                Monthly sales will appear
                                when orders are created.
                            </p>
                        </div>

                    ) : (

                        <div className="analytics-month-list">

                            {analytics.monthlySales.map(
                                (item) => {

                                    const percentage =
                                        Math.min(
                                            100,
                                            (
                                                item.sales /
                                                maxMonthlySales
                                            ) * 100
                                        );

                                    return (

                                        <div
                                            className="analytics-month-item"
                                            key={item.key}
                                        >

                                            <div className="analytics-month-info">

                                                <div>

                                                    <strong>
                                                        {item.month}
                                                    </strong>

                                                    <small>
                                                        {item.orders}
                                                        {" "}
                                                        {item.orders === 1
                                                            ? "order"
                                                            : "orders"}
                                                    </small>

                                                </div>

                                                <strong>
                                                    {formatCurrency(
                                                        item.sales
                                                    )}
                                                </strong>

                                            </div>


                                            <div className="analytics-progress">

                                                <div
                                                    className="analytics-progress-bar"
                                                    style={{
                                                        width:
                                                            `${percentage}%`,
                                                    }}
                                                />

                                            </div>

                                        </div>

                                    );
                                }
                            )}

                        </div>

                    )}

                </div>

            </div>


            {/* TOP PRODUCTS */}

            <div className="card analytics-section-card">

                <div className="card-header analytics-section-header">

                    <div>

                        <h5>
                            Top Selling Products
                        </h5>

                        <span>
                            Based on actual order items
                        </span>

                    </div>

                    <div className="analytics-header-badge">
                        <FaTrophy />
                        Top 10
                    </div>

                </div>


                <div className="card-body p-0">

                    {analytics.topProducts.length === 0 ? (

                        <div className="analytics-empty">

                            <FaTrophy />

                            <h6>
                                No product sales yet
                            </h6>

                            <p>
                                Product sales will appear
                                after orders contain items.
                            </p>

                        </div>

                    ) : (

                        <div className="table-responsive">

                            <table className="table analytics-table align-middle mb-0">

                                <thead>

                                    <tr>

                                        <th>
                                            Rank
                                        </th>

                                        <th>
                                            Product
                                        </th>

                                        <th>
                                            Units Sold
                                        </th>

                                        <th>
                                            Revenue
                                        </th>

                                        <th>
                                            Performance
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {analytics.topProducts.map(
                                        (product, index) => {

                                            const highestSales =
                                                analytics.topProducts[0]?.sold ||
                                                1;

                                            const performance =
                                                Math.min(
                                                    100,
                                                    (
                                                        product.sold /
                                                        highestSales
                                                    ) * 100
                                                );

                                            return (

                                                <tr
                                                    key={
                                                        product.id
                                                    }
                                                >

                                                    <td>

                                                        <span
                                                            className={`analytics-rank rank-${index + 1}`}
                                                        >
                                                            {index + 1}
                                                        </span>

                                                    </td>


                                                    <td>

                                                        <div className="analytics-product-name">

                                                            {product.name}

                                                        </div>

                                                    </td>


                                                    <td>

                                                        <span className="sales-badge">

                                                            {product.sold.toLocaleString(
                                                                "en-IN"
                                                            )}

                                                        </span>

                                                    </td>


                                                    <td>

                                                        <strong className="analytics-revenue-text">

                                                            {formatCurrency(
                                                                product.revenue
                                                            )}

                                                        </strong>

                                                    </td>


                                                    <td>

                                                        <div className="analytics-table-progress">

                                                            <div className="analytics-table-progress-track">

                                                                <div
                                                                    className="analytics-table-progress-fill"
                                                                    style={{
                                                                        width:
                                                                            `${performance}%`,
                                                                    }}
                                                                />

                                                            </div>

                                                            <span>
                                                                {Math.round(
                                                                    performance
                                                                )}%
                                                            </span>

                                                        </div>

                                                    </td>

                                                </tr>

                                            );
                                        }
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </div>

            </div>


            {/* FOOTER INFO */}

            <div className="analytics-footer">

                <FaDatabase />

                <span>
                    Analytics calculated from your
                    current Appwrite data.
                </span>

                <span className="analytics-footer-dot">
                    •
                </span>

                <span>
                    {orders.length} orders loaded
                </span>

            </div>

        </div>
    );
}

export default Analytics;