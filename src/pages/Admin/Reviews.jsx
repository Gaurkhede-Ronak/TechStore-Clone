import AdminCustomSelect from "../../components/AdminCustomSelect";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaSearch,
  FaStar,
  FaRegStar,
  FaCheckCircle,
  FaTimesCircle,
  FaTrashAlt,
  FaEye,
  FaFilter,
  FaComments,
  FaStarHalfAlt,
  FaClipboardList,
  FaSyncAlt,
  FaUser,
  FaBoxOpen,
  FaEnvelope,
  FaCalendarAlt,
  FaShoppingBag,
} from "react-icons/fa";

import { toast } from "react-hot-toast";

import reviewService from "../../appwrite/reviewService";

import "../../css/Reviews.css";


function Reviews() {

  // STATE

  const [reviews, setReviews] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [ratingFilter, setRatingFilter] =
    useState("All");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [selectedReview, setSelectedReview] =
    useState(null);

  const [currentPage, setCurrentPage] =
    useState(1);

  const reviewsPerPage = 8;


  // LOAD REVIEWS

  useEffect(() => {

    loadReviews();

  }, []);


  async function loadReviews(
    showRefresh = false
  ) {

    try {

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        typeof reviewService.getReviews === "function"
          ? await reviewService.getReviews()
          : typeof reviewService.getAllReviews === "function"
          ? await reviewService.getAllReviews()
          : [];

      setReviews(
        Array.isArray(response)
          ? response
          : response?.documents || []
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error?.message ||
        "Failed to load reviews."
      );

      setReviews([]);

    } finally {

      setLoading(false);
      setRefreshing(false);
    }
  }


  // STATISTICS

  const approvedReviews =
    reviews.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        "approved"
    ).length;


  const pendingReviews =
    reviews.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        "pending"
    ).length;


  const rejectedReviews =
    reviews.filter(
      (item) =>
        String(item.status)
          .toLowerCase() ===
        "rejected"
    ).length;


  const averageRating = reviews.length
    ? (
        reviews.reduce(
          (sum, item) =>
            sum + Number(item.rating || 0),
          0
        ) / reviews.length
      ).toFixed(1)
    : "0.0";


  // FILTER

  const filteredReviews =
    useMemo(() => {

      const searchValue =
        search
          .trim()
          .toLowerCase();

      return reviews.filter(
        (item) => {

          const customer =
            String(
              item.customerName || ""
            ).toLowerCase();

          const email =
            String(
              item.customerEmail || ""
            ).toLowerCase();

          const product =
            String(
              item.productName || ""
            ).toLowerCase();

          const reviewText =
            String(
              item.review || ""
            ).toLowerCase();

          const matchesSearch =
            !searchValue ||
            customer.includes(searchValue) ||
            email.includes(searchValue) ||
            product.includes(searchValue) ||
            reviewText.includes(searchValue);

          const matchesRating =
            ratingFilter === "All" ||
            Number(item.rating) ===
              Number(ratingFilter);

          const matchesStatus =
            statusFilter === "All" ||
            String(item.status) ===
              statusFilter;

          return (
            matchesSearch &&
            matchesRating &&
            matchesStatus
          );
        }
      );

    }, [
      reviews,
      search,
      ratingFilter,
      statusFilter,
    ]);


  // PAGINATION

  const totalPages =
    Math.ceil(
      filteredReviews.length /
        reviewsPerPage
    );


  const currentReviews =
    filteredReviews.slice(
      (currentPage - 1) *
        reviewsPerPage,

      currentPage *
        reviewsPerPage
    );


  // RESET PAGE

  useEffect(() => {

    setCurrentPage(1);

  }, [
    search,
    ratingFilter,
    statusFilter,
  ]);


  // FORMAT DATE

  function formatDate(date) {

    if (!date) {
      return "—";
    }

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return String(date);
    }

    return parsed.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }


  // FORMAT TIME

  function formatTime(date) {

    if (!date) {
      return "";
    }

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "";
    }

    return parsed.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  }


  // RENDER STARS

  function renderStars(
    rating = 0
  ) {

    const value =
      Number(rating);

    return (
      <div className="reviews-stars">

        {[1, 2, 3, 4, 5].map(
          (star) =>
            star <= value ? (
              <FaStar
                key={star}
                className="review-star-filled"
              />
            ) : (
              <FaRegStar
                key={star}
                className="review-star-empty"
              />
            )
        )}

      </div>
    );
  }


  // UPDATE STATUS

  async function updateStatus(
    review,
    status
  ) {

    if (!review?.$id) {
      toast.error(
        "Review ID is missing."
      );
      return;
    }

    try {

      await reviewService.updateReviewStatus(
        review.$id,
        status
      );

      setReviews((prev) =>
        prev.map((item) =>
          item.$id === review.$id
            ? {
                ...item,
                status,
              }
            : item
        )
      );

      setSelectedReview((prev) =>
        prev?.$id === review.$id
          ? {
              ...prev,
              status,
            }
          : prev
      );

      if (status === "Approved") {
        toast.success(
          "Review approved successfully."
        );
      }

      if (status === "Rejected") {
        toast.success(
          "Review rejected successfully."
        );
      }

    } catch (error) {

      console.error(error);

      toast.error(
        error?.message ||
        "Failed to update review."
      );
    }
  }


  // DELETE REVIEW

  async function deleteReview(
    review
  ) {

    if (!review?.$id) {
      toast.error(
        "Review ID is missing."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete review from ${review.customerName || "this customer"}?`
      );

    if (!confirmed) {
      return;
    }

    try {

      await reviewService.deleteReview(
        review.$id
      );

      setReviews((prev) =>
        prev.filter(
          (item) =>
            item.$id !== review.$id
        )
      );

      if (
        selectedReview?.$id ===
        review.$id
      ) {
        setSelectedReview(null);
      }

      toast.success(
        "Review deleted successfully."
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error?.message ||
        "Failed to delete review."
      );
    }
  }


  // CLEAR FILTERS

  function clearFilters() {

    setSearch("");
    setRatingFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
  }


  // LOADING

  if (loading) {

    return (
      <div className="container-fluid reviews-page py-5">

        <div className="reviews-loading">

          <div className="spinner-border text-primary">
          </div>

          <h5 className="mt-3">
            Loading Customer Reviews...
          </h5>

          <p className="text-muted mb-0">
            Fetching reviews from Appwrite.
          </p>

        </div>

      </div>
    );
  }


  // UI

  return (

    <div className="container-fluid reviews-page py-4">

      {/* HEADER */}

      <div className="reviews-header mb-4">

        <div>

          <div className="reviews-eyebrow">
            <FaComments />
            CUSTOMER FEEDBACK
          </div>

          <h2 className="admin-page-title mb-1">
            Customer Reviews
          </h2>

          <p className="text-muted mb-0">
            Manage customer feedback,
            ratings and review moderation.
          </p>

        </div>


        <button
          type="button"
          className="reviews-refresh-btn"
          onClick={() =>
            loadReviews(true)
          }
          disabled={refreshing}
        >

          <FaSyncAlt
            className={
              refreshing
                ? "reviews-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh Reviews"}

        </button>

      </div>


      {/* APPWRITE STATUS */}

      <div className="reviews-db-banner mb-4">

        <div className="reviews-db-icon">
          <FaCheckCircle />
        </div>

        <div>

          <strong>
            Appwrite Reviews Database
          </strong>

          <span>
            Live data is being loaded
            directly from your Appwrite
            reviews collection.
          </span>

        </div>

        <div className="reviews-live-badge">
          <span />
          LIVE
        </div>

      </div>


      {/* STATISTICS */}

      <div className="row g-4 mb-4">

        <div className="col-xl-3 col-md-6">

          <div className="review-card total-card h-100">

            <div className="review-stat-content">

              <small>
                Total Reviews
              </small>

              <h3>
                {reviews.length}
              </h3>

              <span>
                All customer feedback
              </span>

            </div>

            <div className="review-icon">
              <FaComments />
            </div>

          </div>

        </div>


        <div className="col-xl-3 col-md-6">

          <div className="review-card approved-card h-100">

            <div className="review-stat-content">

              <small>
                Approved
              </small>

              <h3>
                {approvedReviews}
              </h3>

              <span>
                Published reviews
              </span>

            </div>

            <div className="review-icon">
              <FaCheckCircle />
            </div>

          </div>

        </div>


        <div className="col-xl-3 col-md-6">

          <div className="review-card pending-card h-100">

            <div className="review-stat-content">

              <small>
                Pending
              </small>

              <h3>
                {pendingReviews}
              </h3>

              <span>
                Waiting for moderation
              </span>

            </div>

            <div className="review-icon">
              <FaClipboardList />
            </div>

          </div>

        </div>


        <div className="col-xl-3 col-md-6">

          <div className="review-card rating-card h-100">

            <div className="review-stat-content">

              <small>
                Average Rating
              </small>

              <h3>
                {averageRating}
                <small className="rating-out-of">
                  / 5
                </small>
              </h3>

              <span>
                {rejectedReviews} rejected
              </span>

            </div>

            <div className="review-icon">
              <FaStarHalfAlt />
            </div>

          </div>

        </div>

      </div>


      {/* FILTERS */}

      <div className="review-table-card mb-4">

        <div className="review-filter-header">

          <div>

            <h5>
              Review Management
            </h5>

            <span>
              {filteredReviews.length}
              {" "}
              matching reviews
            </span>

          </div>

          {(search ||
            ratingFilter !== "All" ||
            statusFilter !== "All") && (

            <button
              type="button"
              className="clear-filter-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </button>

          )}

        </div>


        <div className="review-filter-body">

          <div className="row g-3">

            {/* Search */}

            <div className="col-xl-6 col-lg-5">

              <div className="reviews-search">

                <FaSearch />

                <input
                  type="text"
                  placeholder="Search customer, email, product or review..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                  >
                    ×
                  </button>
                )}

              </div>

            </div>


            {/* Rating */}

            <div className="col-xl-2 col-lg-2">

              <AdminCustomSelect
                className="reviews-filter-select"
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Ratings
                </option>

                <option value="5">
                  5 Stars
                </option>

                <option value="4">
                  4 Stars
                </option>

                <option value="3">
                  3 Stars
                </option>

                <option value="2">
                  2 Stars
                </option>

                <option value="1">
                  1 Star
                </option>

              </AdminCustomSelect>

            </div>


            {/* Status */}

            <div className="col-xl-2 col-lg-2">

              <AdminCustomSelect
                className="reviews-filter-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
              >

                <option value="All">
                  All Status
                </option>

                <option value="Approved">
                  Approved
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="Rejected">
                  Rejected
                </option>

              </AdminCustomSelect>

            </div>


            {/* Count */}

            <div className="col-xl-2 col-lg-3">

              <div className="review-result-box">

                <FaFilter />

                <span>
                  {filteredReviews.length}
                  {" "}
                  Results
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>


      {/* TABLE */}

      <div className="review-table-card">

        <div className="table-responsive">

          <table className="table align-middle mb-0 reviews-table">

            <thead>

              <tr>

                <th>
                  #
                </th>

                <th>
                  Customer
                </th>

                <th>
                  Product
                </th>

                <th>
                  Rating
                </th>

                <th>
                  Review
                </th>

                <th>
                  Status
                </th>

                <th>
                  Date
                </th>

                <th className="text-center">
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {currentReviews.length > 0 ? (

                currentReviews.map(
                  (review, index) => (

                    <tr
                      key={review.$id}
                    >

                      {/* Number */}

                      <td>

                        <span className="review-row-number">
                          {(currentPage - 1) *
                            reviewsPerPage +
                            index +
                            1}
                        </span>

                      </td>


                      {/* Customer */}

                      <td>

                        <div className="review-customer">

                          <div className="review-avatar">
                            <FaUser />
                          </div>

                          <div>

                            <strong>
                              {review.customerName ||
                                "Unknown Customer"}
                            </strong>

                            <small>
                              <FaEnvelope />
                              {review.customerEmail ||
                                "No email"}
                            </small>

                          </div>

                        </div>

                      </td>


                      {/* Product */}

                      <td>

                        <div className="review-product">

                          <FaBoxOpen />

                          <span>
                            {review.productName ||
                              "Unknown Product"}
                          </span>

                        </div>

                        {review.orderId && (
                          <small className="review-order-id">
                            Order: {review.orderId}
                          </small>
                        )}

                      </td>


                      {/* Rating */}

                      <td>

                        <div className="review-rating-wrapper">

                          {renderStars(
                            review.rating
                          )}

                          <strong>
                            {Number(
                              review.rating || 0
                            ).toFixed(1)}
                          </strong>

                        </div>

                      </td>


                      {/* Review */}

                      <td>

                        <div className="review-text-preview">

                          {review.review ||
                            "No review text"}

                        </div>

                      </td>


                      {/* Status */}

                      <td>

                        <span
                          className={`review-status ${String(
                            review.status ||
                              "Pending"
                          ).toLowerCase()}`}
                        >

                          {review.status ||
                            "Pending"}

                        </span>

                      </td>


                      {/* Date */}

                      <td>

                        <div className="review-date">

                          <strong>
                            {formatDate(
                              review.createdAt ||
                              review.$createdAt
                            )}
                          </strong>

                          <small>
                            {formatTime(
                              review.createdAt ||
                              review.$createdAt
                            )}
                          </small>

                        </div>

                      </td>


                      {/* Actions */}

                      <td>

                        <div className="review-actions">

                          <button
                            type="button"
                            className="review-action-btn view"
                            title="View Review"
                            onClick={() =>
                              setSelectedReview(
                                review
                              )
                            }
                          >
                            <FaEye />
                          </button>


                          {review.status !==
                            "Approved" && (

                            <button
                              type="button"
                              className="review-action-btn approve"
                              title="Approve Review"
                              onClick={() =>
                                updateStatus(
                                  review,
                                  "Approved"
                                )
                              }
                            >
                              <FaCheckCircle />
                            </button>

                          )}


                          {review.status !==
                            "Rejected" && (

                            <button
                              type="button"
                              className="review-action-btn reject"
                              title="Reject Review"
                              onClick={() =>
                                updateStatus(
                                  review,
                                  "Rejected"
                                )
                              }
                            >
                              <FaTimesCircle />
                            </button>

                          )}


                          <button
                            type="button"
                            className="review-action-btn delete"
                            title="Delete Review"
                            onClick={() =>
                              deleteReview(
                                review
                              )
                            }
                          >
                            <FaTrashAlt />
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              ) : (

                <tr>

                  <td
                    colSpan="8"
                    className="reviews-empty-cell"
                  >

                    <div className="reviews-empty">

                      <FaComments />

                      <h5>
                        No Reviews Found
                      </h5>

                      <p>
                        No reviews match your
                        current filters.
                      </p>

                      {(search ||
                        ratingFilter !==
                          "All" ||
                        statusFilter !==
                          "All") && (

                        <button
                          type="button"
                          className="profile-btn profile-btn-primary"
                          onClick={
                            clearFilters
                          }
                        >
                          Clear Filters
                        </button>

                      )}

                    </div>

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* PAGINATION */}

      {filteredReviews.length > 0 && (

        <div className="reviews-pagination-wrapper mt-4">

          <div className="reviews-pagination-info">

            Showing{" "}

            <strong>
              {(currentPage - 1) *
                reviewsPerPage +
                1}
            </strong>

            {" "}to{" "}

            <strong>
              {Math.min(
                currentPage *
                  reviewsPerPage,
                filteredReviews.length
              )}
            </strong>

            {" "}of{" "}

            <strong>
              {filteredReviews.length}
            </strong>

            {" "}reviews

          </div>


          <div className="reviews-pagination">

            <button
              type="button"
              disabled={
                currentPage === 1
              }
              onClick={() =>
                setCurrentPage(
                  (prev) =>
                    Math.max(
                      1,
                      prev - 1
                    )
                )
              }
            >
              Previous
            </button>


            {[...Array(totalPages)].map(
              (_, index) => {

                const page =
                  index + 1;

                return (
                  <button
                    type="button"
                    key={page}
                    className={
                      currentPage ===
                      page
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setCurrentPage(
                        page
                      )
                    }
                  >
                    {page}
                  </button>
                );

              }
            )}


            <button
              type="button"
              disabled={
                currentPage ===
                totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (prev) =>
                    Math.min(
                      totalPages,
                      prev + 1
                    )
                )
              }
            >
              Next
            </button>

          </div>

        </div>

      )}


      {/* DETAILS MODAL */}

      {selectedReview && (

        <div
          className="review-details-overlay"
          onClick={() =>
            setSelectedReview(null)
          }
        >

          <div
            className="review-details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* Header */}

            <div className="review-modal-header">

              <div>

                <span className="reviews-eyebrow">
                  <FaComments />
                  REVIEW DETAILS
                </span>

                <h4>
                  Customer Review
                </h4>

              </div>

              <button
                type="button"
                className="review-modal-close"
                onClick={() =>
                  setSelectedReview(null)
                }
              >
                ×
              </button>

            </div>


            {/* Body */}

            <div className="review-modal-body">

              {/* Customer */}

              <div className="review-detail-customer">

                <div className="review-detail-avatar">
                  <FaUser />
                </div>

                <div>

                  <h5>
                    {selectedReview.customerName ||
                      "Unknown Customer"}
                  </h5>

                  <p>
                    <FaEnvelope />
                    {selectedReview.customerEmail ||
                      "No email"}
                  </p>

                </div>

              </div>


              <div className="row g-4 mt-1">

                {/* Product */}

                <div className="col-md-6">

                  <div className="review-detail-box">

                    <span>
                      <FaShoppingBag />
                      Product
                    </span>

                    <strong>
                      {selectedReview.productName ||
                        "Unknown Product"}
                    </strong>

                  </div>

                </div>


                {/* Order */}

                <div className="col-md-6">

                  <div className="review-detail-box">

                    <span>
                      <FaClipboardList />
                      Order ID
                    </span>

                    <strong>
                      {selectedReview.orderId ||
                        "Not available"}
                    </strong>

                  </div>

                </div>


                {/* Rating */}

                <div className="col-md-6">

                  <div className="review-detail-box">

                    <span>
                      <FaStar />
                      Rating
                    </span>

                    <div className="review-modal-rating">

                      {renderStars(
                        selectedReview.rating
                      )}

                      <strong>
                        {selectedReview.rating}
                        /5
                      </strong>

                    </div>

                  </div>

                </div>


                {/* Date */}

                <div className="col-md-6">

                  <div className="review-detail-box">

                    <span>
                      <FaCalendarAlt />
                      Submitted
                    </span>

                    <strong>
                      {formatDate(
                        selectedReview.createdAt ||
                        selectedReview.$createdAt
                      )}
                    </strong>

                  </div>

                </div>

              </div>


              {/* Review */}

              <div className="review-full-text mt-4">

                <span>
                  Customer Feedback
                </span>

                <p>
                  {selectedReview.review ||
                    "No review text available."}
                </p>

              </div>


              {/* Status */}

              <div className="review-current-status mt-4">

                <span>
                  Current Status
                </span>

                <span
                  className={`review-status ${String(
                    selectedReview.status ||
                      "Pending"
                  ).toLowerCase()}`}
                >
                  {selectedReview.status ||
                    "Pending"}
                </span>

              </div>

            </div>


            {/* Footer */}

            <div className="review-modal-footer">

              <button
                type="button"
                className="review-modal-btn secondary"
                onClick={() =>
                  setSelectedReview(null)
                }
              >
                Close
              </button>


              {selectedReview.status !==
                "Rejected" && (

                <button
                  type="button"
                  className="review-modal-btn warning"
                  onClick={() =>
                    updateStatus(
                      selectedReview,
                      "Rejected"
                    )
                  }
                >
                  <FaTimesCircle />
                  Reject
                </button>

              )}


              {selectedReview.status !==
                "Approved" && (

                <button
                  type="button"
                  className="review-modal-btn success"
                  onClick={() =>
                    updateStatus(
                      selectedReview,
                      "Approved"
                    )
                  }
                >
                  <FaCheckCircle />
                  Approve
                </button>

              )}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Reviews;