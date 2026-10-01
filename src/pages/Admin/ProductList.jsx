import { useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";
import { Link } from "react-router-dom";
import "../../css/ProductList.css";

import {
  FaPlus,
  FaSearch,
  FaFilter,
  FaSortAmountDown,
  FaBoxOpen,
  FaTags,
  FaSyncAlt,
  FaEye,
  FaEdit,
  FaTrash,
  FaTimes,
  FaStar,
  FaExclamationTriangle,
} from "react-icons/fa";

import productService from "../../appwrite/productService";

/* IMAGE HELPER */

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=80";

const getProductImage = (product) => {
  const raw =
    product?.thumbnail ||
    product?.image ||
    (Array.isArray(product?.images) ? product.images[0] : null);

  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return FALLBACK_PRODUCT_IMAGE;
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  return `https://fra.cloud.appwrite.io/v1/storage/buckets/${
    import.meta.env.VITE_APPWRITE_BUCKET_ID
  }/files/${raw}/view?project=${
    import.meta.env.VITE_APPWRITE_PROJECT_ID
  }`;
};

/* PRODUCT LIST */

function ProductList() {
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sort, setSort] = useState("default");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [deleteProduct, setDeleteProduct] = useState(null);

  const productsPerPage = 8;

  /* LOAD PRODUCTS */

  const loadProducts = async (showMainLoader = true) => {
    try {
      if (showMainLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await productService.getProducts();

      setProducts(response?.documents || []);
    } catch (error) {
      console.error("Load Products Error:", error);

      alert(error?.message || "Failed to load products.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  /* CATEGORIES */

  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        products.map((product) => product.category).filter(Boolean)
      ),
    ];

    return ["all", ...uniqueCategories];
  }, [products]);

  /* FILTER + SORT */

  const filteredProducts = useMemo(() => {
    let data = [...products];

    const searchValue = search.trim().toLowerCase();

    /* SEARCH */

    if (searchValue) {
      data = data.filter((product) => {
        const title = product?.title?.toLowerCase() || "";

        const category = product?.category?.toLowerCase() || "";

        const brand = product?.brand?.toLowerCase() || "";

        return (
          title.includes(searchValue) ||
          category.includes(searchValue) ||
          brand.includes(searchValue)
        );
      });
    }

    /* CATEGORY */

    if (category !== "all") {
      data = data.filter(
        (product) => product.category === category
      );
    }

    /* STOCK */

    if (stockFilter === "in-stock") {
      data = data.filter(
        (product) => Number(product.stock) > 10
      );
    }

    if (stockFilter === "low-stock") {
      data = data.filter(
        (product) =>
          Number(product.stock) > 0 &&
          Number(product.stock) <= 10
      );
    }

    if (stockFilter === "out-of-stock") {
      data = data.filter(
        (product) => Number(product.stock) <= 0
      );
    }

    /* SORT */

    switch (sort) {
      case "price-low":
        data.sort(
          (a, b) =>
            Number(a.price || 0) -
            Number(b.price || 0)
        );
        break;

      case "price-high":
        data.sort(
          (a, b) =>
            Number(b.price || 0) -
            Number(a.price || 0)
        );
        break;

      case "rating":
        data.sort(
          (a, b) =>
            Number(b.rating || 0) -
            Number(a.rating || 0)
        );
        break;

      case "stock":
        data.sort(
          (a, b) =>
            Number(b.stock || 0) -
            Number(a.stock || 0)
        );
        break;

      case "name":
        data.sort((a, b) =>
          String(a.title || "").localeCompare(
            String(b.title || "")
          )
        );
        break;

      case "newest":
        data.sort(
          (a, b) =>
            new Date(b.$createdAt || 0) -
            new Date(a.$createdAt || 0)
        );
        break;

      default:
        break;
    }

    return data;
  }, [
    products,
    search,
    category,
    stockFilter,
    sort,
  ]);

  /* STATS */

  const totalProducts = products.length;

  const totalCategories = categories.length - 1;

  const inStockProducts = products.filter(
    (product) =>
      Number(product.stock || 0) > 10
  ).length;

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.stock || 0) > 0 &&
      Number(product.stock || 0) <= 10
  ).length;

  const outOfStockProducts = products.filter(
    (product) =>
      Number(product.stock || 0) <= 0
  ).length;

  const totalInventoryValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) *
        Number(product.stock || 0),
    0
  );

  const averageRating =
    products.length > 0
      ? products.reduce(
          (total, product) =>
            total +
            Number(product.rating || 0),
          0
        ) / products.length
      : 0;

  /* PAGINATION */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredProducts.length /
        productsPerPage
    )
  );

  const currentProducts =
    filteredProducts.slice(
      (currentPage - 1) * productsPerPage,
      currentPage * productsPerPage
    );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* DELETE PRODUCT */

  const handleDelete = async () => {
    if (!deleteProduct?.$id) {
      return;
    }

    try {
      await productService.deleteProduct(
        deleteProduct.$id
      );

      setProducts((prev) =>
        prev.filter(
          (product) =>
            product.$id !== deleteProduct.$id
        )
      );

      setDeleteProduct(null);

      alert("Product deleted successfully.");
    } catch (error) {
      console.error(
        "Delete Product Error:",
        error
      );

      alert(
        error?.message ||
          "Failed to delete product."
      );
    }
  };

  /* RESET FILTERS */

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setStockFilter("all");
    setSort("default");
    setCurrentPage(1);
  };

  /* LOADING */

  if (loading) {
    return (
      <div className="product-list-page">
        <div className="container-fluid py-5">
          <div className="text-center">

            <div
              className="spinner-border text-primary"
              style={{
                width: "3rem",
                height: "3rem",
              }}
            />

            <h5 className="mt-3 fw-bold">
              Loading Products...
            </h5>

            <p className="text-muted">
              Fetching products from Appwrite
            </p>

          </div>
        </div>
      </div>
    );
  }

  /* UI */

  return (
    <div className="product-list-page">

      <div className="container-fluid py-4">

        {/* HEADER */}

        <div className="d-flex justify-content-between align-items-center flex-wrap mb-4">

          <div>

            <h2 className="fw-bold mb-1">
              Product Management
            </h2>

            <p className="text-muted mb-0">
              Manage all TechStore products
              from one place.
            </p>

          </div>

          <div className="d-flex gap-2 mt-3 mt-md-0">

            <button
              className="btn btn-outline-primary"
              onClick={() =>
                loadProducts(false)
              }
              disabled={refreshing}
            >
              <FaSyncAlt
                className={
                  refreshing
                    ? "fa-spin me-2"
                    : "me-2"
                }
              />

              Refresh
            </button>

            <Link
              to="/admin/add-product"
              className="btn btn-primary"
            >
              <FaPlus className="me-2" />
              Add Product
            </Link>

          </div>

        </div>

        {/* STATS */}

        <div className="row g-4 mb-4">

          {/* TOTAL */}

          <div className="col-xl-3 col-md-6">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body d-flex justify-content-between align-items-center">

                <div>

                  <small className="text-muted">
                    Total Products
                  </small>

                  <h3 className="fw-bold mt-2 mb-0">
                    {totalProducts}
                  </h3>

                  <small className="text-primary">
                    Live Appwrite Data
                  </small>

                </div>

                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "#dbeafe",
                  }}
                >
                  <FaBoxOpen
                    size={26}
                    color="#2563eb"
                  />
                </div>

              </div>

            </div>

          </div>

          {/* CATEGORIES */}

          <div className="col-xl-3 col-md-6">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body d-flex justify-content-between align-items-center">

                <div>

                  <small className="text-muted">
                    Categories
                  </small>

                  <h3 className="fw-bold mt-2 mb-0">
                    {totalCategories}
                  </h3>

                  <small className="text-success">
                    Product categories
                  </small>

                </div>

                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "#dcfce7",
                  }}
                >
                  <FaTags
                    size={26}
                    color="#16a34a"
                  />
                </div>

              </div>

            </div>

          </div>

          {/* IN STOCK */}

          <div className="col-xl-3 col-md-6">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body">

                <small className="text-muted">
                  In Stock
                </small>

                <h3 className="fw-bold mt-2 mb-0">
                  {inStockProducts}
                </h3>

                <small className="text-success">
                  Healthy inventory
                </small>

              </div>

            </div>

          </div>

          {/* OUT OF STOCK */}

          <div className="col-xl-3 col-md-6">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body">

                <small className="text-muted">
                  Out of Stock
                </small>

                <h3 className="fw-bold mt-2 mb-0 text-danger">
                  {outOfStockProducts}
                </h3>

                <small className="text-danger">
                  Needs restocking
                </small>

              </div>

            </div>

          </div>

        </div>

        {/* INVENTORY SUMMARY */}

        <div className="row g-4 mb-4">

          <div className="col-lg-4">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body">

                <div className="d-flex justify-content-between">

                  <div>

                    <small className="text-muted">
                      Low Stock
                    </small>

                    <h4 className="fw-bold text-warning mt-2">
                      {lowStockProducts}
                    </h4>

                  </div>

                  <FaExclamationTriangle
                    className="text-warning"
                    size={28}
                  />

                </div>

                <small className="text-muted">
                  Products with 1–10 units
                  remaining.
                </small>

              </div>

            </div>

          </div>

          <div className="col-lg-4">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body">

                <small className="text-muted">
                  Inventory Value
                </small>

                <h4 className="fw-bold text-success mt-2">
                  ₹{" "}
                  {totalInventoryValue.toLocaleString(
                    "en-IN"
                  )}
                </h4>

                <small className="text-muted">
                  Price × current stock
                </small>

              </div>

            </div>

          </div>

          <div className="col-lg-4">

            <div className="card border-0 shadow-sm h-100">

              <div className="card-body">

                <small className="text-muted">
                  Average Rating
                </small>

                <h4 className="fw-bold text-warning mt-2">
                  ⭐{" "}
                  {averageRating.toFixed(1)}
                </h4>

                <small className="text-muted">
                  Across all products
                </small>

              </div>

            </div>

          </div>

        </div>

        {/* SEARCH & FILTER */}

        <div className="card border-0 shadow-sm mb-4">

          <div className="card-body">

            <div className="row g-3">

              {/* SEARCH */}

              <div className="col-xl-4 col-lg-5">

                <div className="input-group">

                  <span className="input-group-text">
                    <FaSearch />
                  </span>

                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search product, brand..."
                    value={search}
                    onChange={(e) => {
                      setSearch(
                        e.target.value
                      );
                      setCurrentPage(1);
                    }}
                  />

                </div>

              </div>

              {/* CATEGORY */}

              <div className="col-xl-2 col-lg-3">

                <div className="input-group">

                  <span className="input-group-text">
                    <FaFilter />
                  </span>

                  <AdminCustomSelect
                    className="form-select"
                    value={category}
                    onChange={(e) => {
                      setCategory(
                        e.target.value
                      );
                      setCurrentPage(1);
                    }}
                  >

                    {categories.map(
                      (cat) => (
                        <option
                          key={cat}
                          value={cat}
                        >
                          {cat === "all"
                            ? "All Categories"
                            : cat}
                        </option>
                      )
                    )}

                  </AdminCustomSelect>

                </div>

              </div>

              {/* STOCK */}

              <div className="col-xl-2 col-lg-2">

                <AdminCustomSelect
                  className="form-select"
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(
                      e.target.value
                    );
                    setCurrentPage(1);
                  }}
                >

                  <option value="all">
                    All Stock
                  </option>

                  <option value="in-stock">
                    In Stock
                  </option>

                  <option value="low-stock">
                    Low Stock
                  </option>

                  <option value="out-of-stock">
                    Out of Stock
                  </option>

                </AdminCustomSelect>

              </div>

              {/* SORT */}

              <div className="col-xl-2 col-lg-2">

                <div className="input-group">

                  <span className="input-group-text">
                    <FaSortAmountDown />
                  </span>

                  <AdminCustomSelect
                    className="form-select"
                    value={sort}
                    onChange={(e) =>
                      setSort(
                        e.target.value
                      )
                    }
                  >

                    <option value="default">
                      Default
                    </option>

                    <option value="newest">
                      Newest
                    </option>

                    <option value="name">
                      Name
                    </option>

                    <option value="price-low">
                      Price: Low → High
                    </option>

                    <option value="price-high">
                      Price: High → Low
                    </option>

                    <option value="rating">
                      Highest Rating
                    </option>

                    <option value="stock">
                      Highest Stock
                    </option>

                  </AdminCustomSelect>

                </div>

              </div>

              {/* RESET */}

              <div className="col-xl-2 col-lg-12">

                <button
                  className="btn btn-outline-secondary w-100"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>

              </div>

            </div>

          </div>

        </div>

        {/* RESULT COUNT */}

        <div className="d-flex justify-content-between align-items-center mb-3">

          <div>

            <h5 className="fw-bold mb-1">
              Products
            </h5>

            <small className="text-muted">
              Showing{" "}
              {currentProducts.length} of{" "}
              {filteredProducts.length}
            </small>

          </div>

          {search ||
          category !== "all" ||
          stockFilter !== "all" ? (
            <span className="badge bg-primary px-3 py-2">
              Filters Applied
            </span>
          ) : null}

        </div>

        {/* PRODUCT GRID */}

        {currentProducts.length === 0 ? (

          <div className="card border-0 shadow-sm">

            <div className="card-body text-center py-5">

              <FaBoxOpen
                size={55}
                className="text-muted mb-3"
              />

              <h4 className="fw-bold">
                No Products Found
              </h4>

              <p className="text-muted">
                Try changing your search
                or filters.
              </p>

              <button
                className="btn btn-primary"
                onClick={resetFilters}
              >
                Reset Filters
              </button>

            </div>

          </div>

        ) : (

          <div className="row g-4">

            {currentProducts.map(
              (product) => (

                <div
                  className="col-xl-3 col-lg-4 col-md-6"
                  key={product.$id}
                >

                  <div className="card border-0 shadow-sm h-100 product-card">

                    {/* IMAGE */}

                    <div className="position-relative">

                      <img
                        src={getProductImage(
                          product
                        )}
                        alt={
                          product.title ||
                          "Product"
                        }
                        className="card-img-top p-3"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            FALLBACK_PRODUCT_IMAGE;
                        }}
                        style={{
                          height: "220px",
                          objectFit: "contain",
                        }}
                      />

                      {Number(
                        product.discount || 0
                      ) > 0 && (
                        <span className="badge bg-danger position-absolute top-0 end-0 m-3">
                          -
                          {product.discount}
                          %
                        </span>
                      )}

                    </div>

                    {/* BODY */}

                    <div className="card-body d-flex flex-column">

                      <span className="badge bg-primary align-self-start mb-2">
                        {product.category ||
                          "Uncategorized"}
                      </span>

                      <h5
                        className="fw-bold mb-2"
                        style={{
                          minHeight: "50px",
                        }}
                      >
                        {product.title ||
                          "Untitled Product"}
                      </h5>

                      <div className="d-flex justify-content-between align-items-center mb-2">

                        <span className="fw-bold text-success fs-5">
                          ₹{" "}
                          {Number(
                            product.price || 0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>

                        <span className="text-warning">
                          <FaStar />{" "}
                          {Number(
                            product.rating || 0
                          ).toFixed(1)}
                        </span>

                      </div>

                      {/* STOCK */}

                      <div className="mb-3">

                        {Number(
                          product.stock || 0
                        ) > 10 ? (

                          <span className="badge bg-success">
                            In Stock (
                            {product.stock})
                          </span>

                        ) : Number(
                            product.stock || 0
                          ) > 0 ? (

                          <span className="badge bg-warning text-dark">
                            Low Stock (
                            {product.stock})
                          </span>

                        ) : (

                          <span className="badge bg-danger">
                            Out of Stock
                          </span>

                        )}

                      </div>

                      {/* ACTIONS */}

                      <div className="mt-auto">

                        <div className="d-grid gap-2">

                          <button
                            className="btn btn-outline-primary"
                            onClick={() =>
                              setSelectedProduct(
                                product
                              )
                            }
                          >
                            <FaEye className="me-2" />
                            View Product
                          </button>

                          <div className="d-flex gap-2">

                            <Link
                              to={`/admin/edit-product/${product.$id}`}
                              className="btn btn-warning flex-fill text-white"
                            >
                              <FaEdit className="me-1" />
                              Edit
                            </Link>

                            <button
                              className="btn btn-danger flex-fill"
                              onClick={() =>
                                setDeleteProduct(
                                  product
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

                </div>

              )
            )}

          </div>

        )}

        {/* PAGINATION */}

        {totalPages > 1 && (

          <nav className="mt-5">

            <ul className="pagination justify-content-center">

              <li
                className={`page-item ${
                  currentPage === 1
                    ? "disabled"
                    : ""
                }`}
              >

                <button
                  className="page-link"
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

              </li>

              {Array.from(
                {
                  length: totalPages,
                },
                (_, index) => (

                  <li
                    key={index}
                    className={`page-item ${
                      currentPage ===
                      index + 1
                        ? "active"
                        : ""
                    }`}
                  >

                    <button
                      className="page-link"
                      onClick={() =>
                        setCurrentPage(
                          index + 1
                        )
                      }
                    >
                      {index + 1}
                    </button>

                  </li>

                )
              )}

              <li
                className={`page-item ${
                  currentPage ===
                  totalPages
                    ? "disabled"
                    : ""
                }`}
              >

                <button
                  className="page-link"
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

              </li>

            </ul>

          </nav>

        )}

        {/* VIEW PRODUCT MODAL */}

        {selectedProduct && (

          <div
            className="modal fade show d-block"
            style={{
              background:
                "rgba(0,0,0,.6)",
              backdropFilter:
                "blur(4px)",
            }}
          >

            <div className="modal-dialog modal-lg modal-dialog-centered">

              <div className="modal-content border-0 rounded-4 shadow-lg">

                <div className="modal-header">

                  <h4 className="fw-bold mb-0">
                    Product Details
                  </h4>

                  <button
                    className="btn-close"
                    onClick={() =>
                      setSelectedProduct(
                        null
                      )
                    }
                  />

                </div>

                <div className="modal-body">

                  <div className="row g-4">

                    {/* IMAGE */}

                    <div className="col-md-5">

                      <div
                        className="border rounded-4 p-3 d-flex align-items-center justify-content-center"
                        style={{
                          minHeight:
                            "320px",
                        }}
                      >

                        <img
                          src={getProductImage(
                            selectedProduct
                          )}
                          alt={
                            selectedProduct.title
                          }
                          className="img-fluid"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              FALLBACK_PRODUCT_IMAGE;
                          }}
                          style={{
                            maxHeight:
                              "280px",
                            objectFit:
                              "contain",
                          }}
                        />

                      </div>

                    </div>

                    {/* DETAILS */}

                    <div className="col-md-7">

                      <span className="badge bg-primary mb-2">
                        {selectedProduct.category ||
                          "Uncategorized"}
                      </span>

                      <h3 className="fw-bold">
                        {
                          selectedProduct.title
                        }
                      </h3>

                      <p className="text-muted">
                        {selectedProduct.description ||
                          "No description available."}
                      </p>

                      <hr />

                      <div className="row g-3">

                        <div className="col-6">

                          <small className="text-muted">
                            Price
                          </small>

                          <h5 className="fw-bold text-success">
                            ₹{" "}
                            {Number(
                              selectedProduct.price ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </h5>

                        </div>

                        <div className="col-6">

                          <small className="text-muted">
                            Rating
                          </small>

                          <h5 className="fw-bold text-warning">
                            ⭐{" "}
                            {Number(
                              selectedProduct.rating ||
                                0
                            ).toFixed(1)}
                          </h5>

                        </div>

                        <div className="col-6">

                          <small className="text-muted">
                            Stock
                          </small>

                          <h5 className="fw-bold">
                            {
                              selectedProduct.stock
                            }
                          </h5>

                        </div>

                        <div className="col-6">

                          <small className="text-muted">
                            Discount
                          </small>

                          <h5 className="fw-bold">
                            {Number(
                              selectedProduct.discount ||
                                0
                            )}
                            %
                          </h5>

                        </div>

                        <div className="col-6">

                          <small className="text-muted">
                            Brand
                          </small>

                          <h6 className="fw-bold">
                            {
                              selectedProduct.brand ||
                              "Not specified"
                            }
                          </h6>

                        </div>

                        <div className="col-6">

                          <small className="text-muted">
                            Product ID
                          </small>

                          <h6
                            className="fw-bold text-truncate"
                            title={
                              selectedProduct.$id
                            }
                          >
                            {
                              selectedProduct.$id
                            }
                          </h6>

                        </div>

                      </div>

                    </div>

                  </div>

                </div>

                <div className="modal-footer">

                  <Link
                    to={`/admin/edit-product/${selectedProduct.$id}`}
                    className="btn btn-warning text-white"
                  >
                    <FaEdit className="me-2" />
                    Edit Product
                  </Link>

                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      setSelectedProduct(
                        null
                      )
                    }
                  >
                    Close
                  </button>

                </div>

              </div>

            </div>

          </div>

        )}

        {/* DELETE MODAL */}

        {deleteProduct && (

          <div
            className="modal fade show d-block"
            style={{
              background:
                "rgba(0,0,0,.65)",
              backdropFilter:
                "blur(5px)",
            }}
          >

            <div className="modal-dialog modal-dialog-centered">

              <div className="modal-content border-0 rounded-4 shadow-lg">

                <div className="modal-body text-center p-5">

                  <div
                    className="mx-auto mb-4 d-flex align-items-center justify-content-center rounded-circle bg-danger text-white"
                    style={{
                      width: "85px",
                      height: "85px",
                      fontSize: "30px",
                    }}
                  >
                    <FaTrash />
                  </div>

                  <h3 className="fw-bold">
                    Delete Product?
                  </h3>

                  <p className="text-muted mt-3">
                    You are about to delete:
                  </p>

                  <h5 className="fw-bold">
                    {deleteProduct.title}
                  </h5>

                  <p className="text-danger small">
                    This action cannot be
                    undone.
                  </p>

                  <div className="d-flex justify-content-center gap-3 mt-4">

                    <button
                      className="btn btn-secondary px-4"
                      onClick={() =>
                        setDeleteProduct(
                          null
                        )
                      }
                    >
                      <FaTimes className="me-2" />
                      Cancel
                    </button>

                    <button
                      className="btn btn-danger px-4"
                      onClick={handleDelete}
                    >
                      <FaTrash className="me-2" />
                      Delete
                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  );
}

export default ProductList;