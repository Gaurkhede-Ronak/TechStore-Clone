import { useEffect, useState } from 'react'
import { scrollToPageTop } from '../components/ScrollToTop'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { FaHeart, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import "../css/Cart.css";

function Wishlist() {
    const navigate = useNavigate();
    const wishlist = useSelector(state => state.wishlist.items);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        scrollToPageTop();
    }, [currentPage]);
    const itemsPerPage = 8;

    // Calculate current items for pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentWishlist = wishlist.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(wishlist.length / itemsPerPage);

    if (wishlist.length === 0) {
        return (
            <div className="wishlist-page-wrapper py-5 d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
                <div className="container py-5 text-center">
                    <div className="empty-cart-large-box py-5 px-4 animate-float-in">
                        <div className="empty-illustration-wrap mb-4 mx-auto" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.25)" }}>
                            <FaHeart size={85} style={{ color: "#ef4444", filter: "drop-shadow(0 10px 15px rgba(239, 68, 68, 0.4))" }} />
                        </div>
                        <h2 className="fw-bold mb-2 display-5">Your Wishlist is Empty</h2>
                        <p className="text-muted mb-4 fs-5" style={{ maxWidth: "450px", margin: "0 auto" }}>
                            Save your favorite tech gadgets here and shop them whenever you're ready.
                        </p>
                        <button
                            className="btn btn-primary px-5 py-3 fw-bold rounded-pill shadow-lg start-shopping-btn"
                            onClick={() => navigate("/products")}
                        >
                            Explore Products
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='container mt-5 mb-5'>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>My WishList</h2>
                <span className="text-muted small fw-semibold">Total Items: {wishlist.length}</span>
            </div>
      
            <div className="row g-3 g-md-4">
                {currentWishlist.map((product) => (
                    <div
                        className="col-6 col-md-4 col-lg-3"
                        key={product.$id}
                    >
                        <ProductCard
                            product={product}
                            isWishlistPage={true}
                        />
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="d-flex justify-content-center align-items-center gap-2 mt-5">
                    <button
                        className="btn btn-outline-primary px-3 py-2 rounded-pill fw-bold d-flex align-items-center gap-1"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <FaChevronLeft size={12} /> Prev
                    </button>

                    {[...Array(totalPages)].map((_, index) => {
                        const pageNum = index + 1;
                        return (
                            <button
                                key={pageNum}
                                className={`btn px-3 py-2 rounded-circle fw-bold ${currentPage === pageNum ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                                style={{ width: "40px", height: "40px" }}
                                onClick={() => setCurrentPage(pageNum)}
                            >
                                {pageNum}
                            </button>
                        );
                    })}

                    <button
                        className="btn btn-outline-primary px-3 py-2 rounded-pill fw-bold d-flex align-items-center gap-1"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next <FaChevronRight size={12} />
                    </button>
                </div>
            )}
        </div>
    )
}

export default Wishlist;