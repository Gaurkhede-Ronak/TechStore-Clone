import { useEffect, useRef, lazy, Suspense } from "react";
import {
    Routes,
    Route,
    useLocation,
    Navigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import userService from "./appwrite/userService";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import AdminLayout from "./pages/Admin/AdminLayout";

import {
    login,
    finishAuthLoading,
} from "./redux/slices/authSlice";
import { setTheme } from "./redux/slices/themeSlice";
import { setCartItems } from "./redux/slices/cartSlice";
import { setWishlistItems } from "./redux/slices/wishlistSlice";

import authService from "./appwrite/authService";

import OrderConfirmed from "./pages/OrderConfirmed";
import PaymentGateway from "./pages/PaymentGateway";
import ForgotPassword from "./pages/ForgotPassword";

/* CUSTOMER PAGES */

const Home = lazy(() => import("./pages/Home"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Cart = lazy(() => import("./pages/Cart"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CODPayment = lazy(() => import("./pages/CODPayment"));
const UPIPayment = lazy(() => import("./pages/UPIPayment"));
const CardPayment = lazy(() => import("./pages/CardPayment"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const ReturnExchange = lazy(() => import("./pages/ReturnExchange"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Profile = lazy(() => import("./pages/Profile"));
const Invoice = lazy(() => import("./pages/Invoice"));
const Notifications = lazy(() => import("./pages/Notifications"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const NotFound = lazy(() => import("./pages/NotFound"));

/* ADMIN PAGES */

const Users = lazy(() => import("./pages/Admin/Users"));
const Dashboard = lazy(() => import("./pages/Admin/Dashboard"));
const ProductList = lazy(() => import("./pages/Admin/ProductList"));
const AddProduct = lazy(() => import("./pages/Admin/AddProduct"));
const EditProduct = lazy(() => import("./pages/Admin/EditProduct"));

const AdminShipments = lazy(
    () => import("./pages/Admin/AdminShipments")
);

const Orders = lazy(() => import("./pages/Admin/Orders"));
const Reviews = lazy(() => import("./pages/Admin/Reviews"));
const Categories = lazy(() => import("./pages/Admin/Categories"));
const Coupons = lazy(() => import("./pages/Admin/Coupons"));
const Inventory = lazy(() => import("./pages/Admin/Inventory"));
const Analytics = lazy(() => import("./pages/Admin/Analytics"));
const Settings = lazy(() => import("./pages/Admin/Settings"));
const AdminProfile = lazy(() => import("./pages/Admin/Profile"));

/* DELIVERY BOY PAGES */

const DeliveryBoyDashboard = lazy(
    () => import("./pages/DeliveryBoy/DeliveryBoyDashboard")
);

const DeliveryOrders = lazy(
    () => import("./pages/DeliveryBoy/DeliveryOrders")
);

const DeliveryShipmentDetails = lazy(
    () => import("./pages/DeliveryBoy/DeliveryShipmentDetails")
);

/* COMPACT SERIALIZER FOR APPWRITE PREFS */

const compactProductList = (items = []) => {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 25).map((item) => {
        const title = item?.title || item?.name || "Product";
        const rawImg =
            item?.thumbnail ||
            item?.image ||
            (Array.isArray(item?.images) ? item.images[0] : "") ||
            "";
        const safeImg =
            typeof rawImg === "string" && !rawImg.startsWith("data:")
                ? rawImg
                : "";
        return {
            $id: item?.$id || item?.id || "",
            title,
            name: title,
            price: Number(item?.price || 0),
            discount: Number(item?.discount || 0),
            image: safeImg,
            thumbnail: safeImg,
            category: item?.category || "",
            brand: item?.brand || "",
            rating: Number(item?.rating || 4.5),
            stock: Number(item?.stock ?? 10),
            quantity: Number(item?.quantity || 1),
        };
    });
};

/* APP */

function App() {
    const dispatch = useDispatch();

    const location = useLocation();

    const theme = useSelector(
        (state) => state.theme.mode
    );

    const cartItems = useSelector(
        (state) => state.cart.items
    );

    const wishlistItems = useSelector(
        (state) => state.wishlist.items
    );

    const authLoading = useSelector(
        (state) => state.auth.authLoading
    );

    const authUser = useSelector(
        (state) => state.auth.user
    );

    const isLoggedIn = useSelector(
        (state) => state.auth.isLoggedIn
    );

    const prefsHydratedRef = useRef(false);

    /* RESTORE SESSION & APPWRITE PREFS */

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser =
                    await authService.getCurrentUser();

                if (currentUser) {
                    const [user, prefs] = await Promise.all([
                        userService.getUserByUserId(currentUser.$id),
                        authService.getPrefs(),
                    ]);

                    if (prefs) {
                        if (
                            prefs.userTheme === "dark" ||
                            prefs.userTheme === "light"
                        ) {
                            dispatch(setTheme(prefs.userTheme));
                        } else if (typeof prefs.darkMode === "boolean") {
                            dispatch(
                                setTheme(prefs.darkMode ? "dark" : "light")
                            );
                        }

                        if (prefs.userCartJson) {
                            try {
                                const parsedCart = JSON.parse(
                                    prefs.userCartJson
                                );
                                if (Array.isArray(parsedCart)) {
                                    dispatch(setCartItems(parsedCart));
                                }
                            } catch {
                                // ignore invalid json
                            }
                        }

                        if (prefs.userWishlistJson) {
                            try {
                                const parsedWishlist = JSON.parse(
                                    prefs.userWishlistJson
                                );
                                if (Array.isArray(parsedWishlist)) {
                                    dispatch(
                                        setWishlistItems(parsedWishlist)
                                    );
                                }
                            } catch {
                                // ignore invalid json
                            }
                        }
                    }

                    prefsHydratedRef.current = true;

                    if (user) {
                        dispatch(
                            login({
                                ...currentUser,
                                role: user.role,
                                status: user.status,
                            })
                        );
                    }
                }
            } catch (error) {
                console.log(
                    "Session restore error:",
                    error
                );
            } finally {
                dispatch(finishAuthLoading());
            }
        };

        checkUser();
    }, [dispatch]);

    /* SYNC THEME, CART & WISHLIST TO APPWRITE */

    useEffect(() => {
        if (!isLoggedIn || !prefsHydratedRef.current) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const currentPrefs = await authService.getPrefs();
                const userCartJson = JSON.stringify(
                    compactProductList(cartItems)
                );
                const userWishlistJson = JSON.stringify(
                    compactProductList(wishlistItems)
                );

                if (
                    currentPrefs?.userTheme === theme &&
                    currentPrefs?.userCartJson === userCartJson &&
                    currentPrefs?.userWishlistJson === userWishlistJson
                ) {
                    return;
                }

                await authService.updatePrefs({
                    ...currentPrefs,
                    userTheme: theme,
                    userCartJson,
                    userWishlistJson,
                });
            } catch (err) {
                console.warn("Appwrite prefs sync warning:", err);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [isLoggedIn, theme, cartItems, wishlistItems]);

    /* THEME */

    useEffect(() => {
        document.body.className = theme;
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    /* ROLE & STANDALONE ROUTES */

    const userRole = authUser?.role;

    const isAdminRoute =
        location.pathname.startsWith("/admin");

    const isDeliveryRoute =
        location.pathname.startsWith("/delivery");

    const isTrackOrderRoute =
        location.pathname.startsWith("/track-order");

    /* DELIVERY BOY: — NEVER SHOW CUSTOMER HOME */

    if (
        !authLoading &&
        isLoggedIn &&
        userRole === "deliveryBoy" &&
        !isDeliveryRoute &&
        location.pathname !== "/login" &&
        location.pathname !== "/register"
    ) {
        return (
            <Navigate
                to="/delivery/dashboard"
                replace
            />
        );
    }

    /* AUTH LOADING */

    if (authLoading) {
        return (
            <div
                className="d-flex justify-content-center align-items-center"
                style={{
                    minHeight: "100vh",
                }}
            >
                <div className="text-center">
                    <div
                        className="spinner-border"
                        role="status"
                    >
                        <span className="visually-hidden">
                            Loading...
                        </span>
                    </div>

                    <p className="mt-3">
                        Loading...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* CUSTOMER NAVBAR (Hidden on Admin, Delivery Boy, and Standalone Courier Tracking Portal) */}

            {!isAdminRoute &&
                !isDeliveryRoute &&
                !isTrackOrderRoute && (
                    <Navbar />
                )}

            <Suspense
                fallback={
                    <div
                        className="d-flex justify-content-center align-items-center"
                        style={{
                            minHeight: "60vh",
                        }}
                    >
                        <div className="text-center">
                            <div
                                className="spinner-border"
                                role="status"
                            >
                                <span className="visually-hidden">
                                    Loading...
                                </span>
                            </div>

                            <p className="mt-3">
                                Loading...
                            </p>
                        </div>
                    </div>
                }
            >
                <Routes>

                    {/* CUSTOMER */}

                    <Route
                        path="/"
                        element={<Home />}
                    />

                    <Route
                        path="/products"
                        element={<Products />}
                    />

                    <Route
                        path="/product/:id"
                        element={<ProductDetails />}
                    />

                    <Route
                        path="/cart"
                        element={<Cart />}
                    />

                    <Route
                        path="/wishlist"
                        element={<Wishlist />}
                    />

                    <Route
                        path="/about"
                        element={<About />}
                    />

                    <Route
                        path="/contact"
                        element={<Contact />}
                    />

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/register"
                        element={<Register />}
                    />

                    <Route
                        path="/checkout"
                        element={
                            <ProtectedRoute>
                                <Checkout />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute>
                                <OrderHistory />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/notifications"
                        element={<Notifications />}
                    />

                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        }
                    />

                    {/* PAYMENTS */}

                    <Route
                        path="/cod-payment"
                        element={
                            <ProtectedRoute>
                                <CODPayment />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/upi-payment"
                        element={
                            <ProtectedRoute>
                                <UPIPayment />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/card-payment"
                        element={
                            <ProtectedRoute>
                                <CardPayment />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/payment-success"
                        element={
                            <ProtectedRoute>
                                <PaymentSuccess />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/order-confirmed"
                        element={<OrderConfirmed />}
                    />

                    <Route
                        path="/order-details"
                        element={
                            <ProtectedRoute>
                                <OrderDetails />
                            </ProtectedRoute>
                        }
                    />

                    {/* RETURN / EXCHANGE */}

                    <Route
                        path="/return-exchange/:orderId"
                        element={
                            <ProtectedRoute>
                                <ReturnExchange />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/track-order"
                        element={
                            <ProtectedRoute>
                                <TrackOrder />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/invoice"
                        element={
                            <ProtectedRoute>
                                <Invoice />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/payment-gateway"
                        element={<PaymentGateway />}
                    />

                    <Route
                        path="/forgot-password"
                        element={<ForgotPassword />}
                    />

                    {/* DELIVERY BOY */}

                    <Route
                        path="/delivery/dashboard"
                        element={
                            <ProtectedRoute>
                                <DeliveryBoyDashboard />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/delivery/orders"
                        element={
                            <ProtectedRoute>
                                <DeliveryOrders />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/delivery/shipment/:id"
                        element={
                            <ProtectedRoute>
                                <DeliveryShipmentDetails />
                            </ProtectedRoute>
                        }
                    />

                    {/* ADMIN */}

                    <Route
                        path="/admin"
                        element={
                            <AdminProtectedRoute>
                                <AdminLayout />
                            </AdminProtectedRoute>
                        }
                    >
                        <Route
                            path="dashboard"
                            element={<Dashboard />}
                        />

                        <Route
                            path="products"
                            element={<ProductList />}
                        />

                        <Route
                            path="add-product"
                            element={<AddProduct />}
                        />

                        <Route
                            path="edit-product/:id"
                            element={<EditProduct />}
                        />

                        <Route
                            path="orders"
                            element={<Orders />}
                        />

                        <Route
                            path="shipments"
                            element={<AdminShipments />}
                        />

                        <Route
                            path="users"
                            element={<Users />}
                        />

                        <Route
                            path="reviews"
                            element={<Reviews />}
                        />

                        <Route
                            path="categories"
                            element={<Categories />}
                        />

                        <Route
                            path="coupons"
                            element={<Coupons />}
                        />

                        <Route
                            path="inventory"
                            element={<Inventory />}
                        />

                        <Route
                            path="analytics"
                            element={<Analytics />}
                        />

                        <Route
                            path="settings"
                            element={<Settings />}
                        />

                        <Route
                            path="profile"
                            element={<AdminProfile />}
                        />
                    </Route>

                    {/* 404 */}

                    <Route
                        path="*"
                        element={<NotFound />}
                    />

                </Routes>
            </Suspense>

            {/* CUSTOMER FOOTER (Hidden on Admin, Delivery Boy, and Standalone Courier Tracking Portal) */}

            {!isAdminRoute &&
                !isDeliveryRoute &&
                !isTrackOrderRoute && (
                    <Footer />
                )}
        </>
    );
}

export default App;
