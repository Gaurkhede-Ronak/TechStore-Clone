import { useEffect, useMemo, useState } from "react";

import {
    FaBell,
    FaCheck,
    FaCheckDouble,
    FaTrash,
    FaShoppingBag,
    FaTruck,
    FaBox,
    FaLock,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle,
    FaGift,
    FaArrowLeft,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import authService from "../appwrite/authService";
import notificationService from "../appwrite/notificationService";


const Notifications = () => {

    const navigate = useNavigate();


    const [notifications, setNotifications] = useState([]);

    const [activeFilter, setActiveFilter] =
        useState("ALL");

    const [loading, setLoading] =
        useState(true);

    const [markingAll, setMarkingAll] =
        useState(false);


  // LOAD NOTIFICATIONS

    const loadNotifications = async () => {

        try {

            setLoading(true);


            const currentUser =
                await authService.getCurrentUser();


            if (!currentUser?.$id) {

                setNotifications([]);

                return;
            }


            const response =
                await notificationService.getUserNotifications(
                    currentUser.$id
                );


            const documents =
                response?.documents || [];


            const sortedDocuments =
                [...documents].sort(
                    (a, b) => {

                        const dateA =
                            new Date(
                                a.createdAt ||
                                a.$createdAt
                            ).getTime();


                        const dateB =
                            new Date(
                                b.createdAt ||
                                b.$createdAt
                            ).getTime();


                        return dateB - dateA;
                    }
                );


            setNotifications(
                sortedDocuments
            );

        } catch (error) {

            console.error(
                "Load notifications error:",
                error
            );


            toast.error(
                "Failed to load notifications."
            );

        } finally {

            setLoading(false);

        }
    };


  // INITIAL LOAD

    useEffect(() => {

        loadNotifications();

    }, []);


  // FILTERED NOTIFICATIONS

    const filteredNotifications =
        useMemo(() => {

            if (
                activeFilter === "UNREAD"
            ) {

                return notifications.filter(
                    (notification) =>
                        notification.isRead === false
                );

            }


            return notifications;

        }, [
            notifications,
            activeFilter,
        ]);


  // UNREAD COUNT

    const unreadCount =
        notifications.filter(
            (notification) =>
                notification.isRead === false
        ).length;


  // MARK SINGLE AS READ

    const handleMarkAsRead = async (
        notification
    ) => {

        try {

            if (!notification?.$id) {
                return;
            }


            if (notification.isRead) {
                return;
            }


            await notificationService.markAsRead(
                notification.$id
            );


            setNotifications(
                (previous) =>
                    previous.map(
                        (item) =>
                            item.$id ===
                            notification.$id
                                ? {
                                    ...item,
                                    isRead: true,
                                }
                                : item
                    )
            );

        } catch (error) {

            console.error(
                "Mark notification read error:",
                error
            );


            toast.error(
                "Failed to mark notification as read."
            );

        }
    };


  // MARK ALL AS READ

    const handleMarkAllAsRead =
        async () => {

            try {

                if (unreadCount === 0) {
                    return;
                }


                setMarkingAll(true);


                const currentUser =
                    await authService.getCurrentUser();


                if (!currentUser?.$id) {
                    return;
                }


                await notificationService.markAllAsRead(
                    currentUser.$id
                );


                setNotifications(
                    (previous) =>
                        previous.map(
                            (item) => ({
                                ...item,
                                isRead: true,
                            })
                        )
                );


                toast.success(
                    "All notifications marked as read."
                );

            } catch (error) {

                console.error(
                    "Mark all read error:",
                    error
                );


                toast.error(
                    "Failed to mark all notifications."
                );

            } finally {

                setMarkingAll(false);

            }
        };


  // DELETE NOTIFICATION

    const handleDelete = async (
        notification
    ) => {

        try {

            if (!notification?.$id) {
                return;
            }


            await notificationService.deleteNotification(
                notification.$id
            );


            setNotifications(
                (previous) =>
                    previous.filter(
                        (item) =>
                            item.$id !==
                            notification.$id
                    )
            );


            toast.success(
                "Notification deleted."
            );

        } catch (error) {

            console.error(
                "Delete notification error:",
                error
            );


            toast.error(
                "Failed to delete notification."
            );

        }
    };


  // NOTIFICATION CLICK

    const handleNotificationClick =
        async (
            notification
        ) => {

            await handleMarkAsRead(
                notification
            );


            // Order notification

            if (notification.orderId) {

                navigate("/orders");

                return;
            }
        };


  // NOTIFICATION ICON

    const getNotificationIcon =
        (notification) => {

            const type =
                String(
                    notification?.type || ""
                ).toUpperCase();


            if (
                type === "DELIVERY_OTP"
            ) {

                return (
                    <FaLock />
                );
            }


            if (
                type.includes("DELIVER")
            ) {

                return (
                    <FaCheckCircle />
                );
            }


            if (
                type.includes("DISPATCH")
            ) {

                return (
                    <FaTruck />
                );
            }


            if (
                type.includes("TRANSIT")
            ) {

                return (
                    <FaTruck />
                );
            }


            if (
                type.includes("PACK")
            ) {

                return (
                    <FaBox />
                );
            }


            if (
                type.includes("CANCEL")
            ) {

                return (
                    <FaTimesCircle />
                );
            }


            if (
                type.includes("EXCEPTION")
            ) {

                return (
                    <FaExclamationTriangle />
                );
            }


            if (
                type.includes("OFFER")
            ) {

                return (
                    <FaGift />
                );
            }


            if (
                type.includes("ORDER")
            ) {

                return (
                    <FaShoppingBag />
                );
            }


            return (
                <FaBell />
            );
        };


  // NOTIFICATION COLOR

    const getNotificationColor =
        (notification) => {

            const type =
                String(
                    notification?.type || ""
                ).toUpperCase();


            if (
                type === "DELIVERY_OTP"
            ) {

                return "#7c3aed";
            }


            if (
                type.includes("DELIVER")
            ) {

                return "#16a34a";
            }


            if (
                type.includes("CANCEL")
            ) {

                return "#dc2626";
            }


            if (
                type.includes("EXCEPTION")
            ) {

                return "#ea580c";
            }


            if (
                type.includes("DISPATCH") ||
                type.includes("TRANSIT")
            ) {

                return "#2563eb";
            }


            return "#0d6efd";
        };


  // FORMAT TIME

    const formatTime =
        (createdAt) => {

            if (!createdAt) {
                return "";
            }


            const date =
                new Date(createdAt);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "";
            }


            const now =
                new Date();


            const difference =
                now.getTime() -
                date.getTime();


            const seconds =
                Math.floor(
                    difference / 1000
                );


            const minutes =
                Math.floor(
                    seconds / 60
                );


            const hours =
                Math.floor(
                    minutes / 60
                );


            const days =
                Math.floor(
                    hours / 24
                );


            if (seconds < 60) {
                return "Just now";
            }


            if (minutes < 60) {

                return `${minutes} min ago`;

            }


            if (hours < 24) {

                return `${hours} hour${
                    hours > 1
                        ? "s"
                        : ""
                } ago`;

            }


            if (days < 7) {

                return `${days} day${
                    days > 1
                        ? "s"
                        : ""
                } ago`;

            }


            return date.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }
            );
        };


  // LOADING

    if (loading) {

        return (

            <div
                className="container py-5"
                style={{
                    minHeight: "70vh",
                }}
            >

                <div
                    className="d-flex flex-column align-items-center justify-content-center"
                    style={{
                        minHeight:
                            "500px",
                    }}
                >

                    <div
                        className="spinner-border text-primary"
                        role="status"
                        style={{
                            width: "3rem",
                            height: "3rem",
                        }}
                    />

                    <p className="mt-3 text-muted mb-0">
                        Loading notifications...
                    </p>

                </div>

            </div>
        );
    }


  // MAIN UI

    return (

        <div
            className="container py-4 py-md-5"
            style={{
                minHeight: "75vh",
            }}
        >

            {/* HEADER */}

            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">

                <div>

                    <button
                        type="button"
                        className="btn btn-link text-decoration-none p-0 mb-2 text-muted"
                        onClick={() =>
                            navigate(-1)
                        }
                    >

                        <FaArrowLeft className="me-2" />

                        Back

                    </button>


                    <div className="d-flex align-items-center gap-3">

                        <div
                            className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white"
                            style={{
                                width: "52px",
                                height: "52px",
                                fontSize: "22px",
                                flexShrink: 0,
                            }}
                        >

                            <FaBell />

                        </div>


                        <div>

                            <h2 className="fw-bold mb-1">
                                Notifications
                            </h2>


                            <p className="text-muted mb-0">
                                Stay updated with your orders and deliveries.
                            </p>

                        </div>

                    </div>

                </div>


                {unreadCount > 0 && (

                    <button
                        className="btn btn-outline-primary"
                        onClick={
                            handleMarkAllAsRead
                        }
                        disabled={
                            markingAll
                        }
                    >

                        <FaCheckDouble className="me-2" />


                        {markingAll
                            ? "Marking..."
                            : "Mark All as Read"}

                    </button>

                )}

            </div>


            {/* FILTERS */}

            <div className="d-flex flex-wrap gap-2 mb-4">

                <button
                    className={`btn ${
                        activeFilter ===
                        "ALL"
                            ? "btn-primary"
                            : "btn-outline-secondary"
                    }`}
                    onClick={() =>
                        setActiveFilter(
                            "ALL"
                        )
                    }
                >

                    All

                    <span className="ms-2">
                        {notifications.length}
                    </span>

                </button>


                <button
                    className={`btn ${
                        activeFilter ===
                        "UNREAD"
                            ? "btn-primary"
                            : "btn-outline-secondary"
                    }`}
                    onClick={() =>
                        setActiveFilter(
                            "UNREAD"
                        )
                    }
                >

                    Unread

                    <span className="ms-2">
                        {unreadCount}
                    </span>

                </button>

            </div>


            {/* EMPTY STATE */}

            {filteredNotifications.length ===
                0 && (

                <div
                    className="card border-0 shadow-sm"
                    style={{
                        borderRadius:
                            "18px",
                    }}
                >

                    <div
                        className="card-body text-center py-5"
                    >

                        <div
                            className="d-flex align-items-center justify-content-center rounded-circle mx-auto mb-3"
                            style={{
                                width:
                                    "80px",
                                height:
                                    "80px",
                                background:
                                    "#f1f5f9",
                                color:
                                    "#94a3b8",
                                fontSize:
                                    "30px",
                            }}
                        >

                            <FaBell />

                        </div>


                        <h5 className="fw-bold">

                            {activeFilter ===
                            "UNREAD"
                                ? "No Unread Notifications"
                                : "No Notifications"}

                        </h5>


                        <p className="text-muted mb-0">

                            {activeFilter ===
                            "UNREAD"
                                ? "You're all caught up!"
                                : "You don't have any notifications yet."}

                        </p>

                    </div>

                </div>
            )}


            {/* NOTIFICATION LIST */}

            <div className="d-flex flex-column gap-3">

                {filteredNotifications.map(
                    (notification) => {

                        const isUnread =
                            notification.isRead ===
                            false;


                        const iconColor =
                            getNotificationColor(
                                notification
                            );


                        return (

                            <div
                                key={
                                    notification.$id
                                }
                                className="card border-0 shadow-sm"
                                style={{
                                    borderRadius:
                                        "16px",
                                    overflow:
                                        "hidden",
                                    background:
                                        isUnread
                                            ? "#f8fbff"
                                            : "#ffffff",
                                    borderLeft:
                                        isUnread
                                            ? "4px solid #0d6efd"
                                            : "4px solid transparent",
                                }}
                            >

                                <div className="card-body p-3 p-md-4">

                                    <div className="d-flex gap-3">


                                        {/* ICON */}

                                        <div
                                            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                            style={{
                                                width:
                                                    "50px",
                                                height:
                                                    "50px",
                                                background:
                                                    `${iconColor}15`,
                                                color:
                                                    iconColor,
                                                fontSize:
                                                    "19px",
                                            }}
                                        >

                                            {getNotificationIcon(
                                                notification
                                            )}

                                        </div>


                                        {/* CONTENT */}

                                        <div
                                            className="flex-grow-1"
                                            style={{
                                                minWidth:
                                                    0,
                                            }}
                                        >

                                            <div className="d-flex flex-column flex-md-row justify-content-between gap-2">

                                                <div className="d-flex align-items-center gap-2">

                                                    <h5 className="fw-bold mb-0">

                                                        {
                                                            notification.title
                                                        }

                                                    </h5>


                                                    {isUnread && (

                                                        <span
                                                            className="badge bg-primary"
                                                            style={{
                                                                fontSize:
                                                                    "10px",
                                                            }}
                                                        >
                                                            NEW
                                                        </span>

                                                    )}

                                                </div>


                                                <small className="text-muted">

                                                    {formatTime(
                                                        notification.createdAt ||
                                                        notification.$createdAt
                                                    )}

                                                </small>

                                            </div>


                                            <p className="text-muted mt-2 mb-2">

                                                {
                                                    notification.message
                                                }

                                            </p>


                                            {/* ORDER INFO */}

                                            {notification.orderId && (

                                                <div className="d-flex flex-wrap gap-2 mb-3">

                                                    <span className="badge bg-light text-dark border">

                                                        Order:{" "}

                                                        {
                                                            notification.orderId
                                                        }

                                                    </span>


                                                    {notification.trackingId && (

                                                        <span className="badge bg-light text-dark border">

                                                            Tracking:{" "}

                                                            {
                                                                notification.trackingId
                                                            }

                                                        </span>

                                                    )}

                                                </div>

                                            )}


                                            {/* ACTIONS */}

                                            <div className="d-flex flex-wrap gap-2">

                                                {notification.orderId && (

                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() =>
                                                            handleNotificationClick(
                                                                notification
                                                            )
                                                        }
                                                    >
                                                        View Order
                                                    </button>

                                                )}


                                                {isUnread && (

                                                    <button
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={() =>
                                                            handleMarkAsRead(
                                                                notification
                                                            )
                                                        }
                                                    >

                                                        <FaCheck className="me-1" />

                                                        Mark as Read

                                                    </button>

                                                )}


                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() =>
                                                        handleDelete(
                                                            notification
                                                        )
                                                    }
                                                >

                                                    <FaTrash className="me-1" />

                                                    Delete

                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        );

                    }
                )}

            </div>

        </div>
    );
};


export default Notifications;