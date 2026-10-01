import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";
import AdminNavbar from "../../components/AdminNavbar";
import "../../css/Admin.css";

function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Desktop પર sidebar હંમેશા ખુલ્લી રાખવી
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 992) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };

        handleResize();

        window.addEventListener("resize", handleResize);

        return () =>
            window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="admin-layout">

            {/* Mobile Overlay */}
            {sidebarOpen && window.innerWidth < 992 && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            <AdminSidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
            />

            <div className="admin-main">

                <AdminNavbar
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                />

                <main
                    className="admin-page"
                    onClick={() => {
                        if (window.innerWidth < 992) {
                            setSidebarOpen(false);
                        }
                    }}
                >
                    <Outlet />
                </main>

            </div>

        </div>
    );
}

export default AdminLayout;