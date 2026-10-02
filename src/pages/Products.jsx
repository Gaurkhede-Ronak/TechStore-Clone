import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import EmptyState from "../components/EmptyState";
import productService from "../appwrite/productService";
import "../css/Product.css";
import { scrollToPageTop } from "../components/ScrollToTop";

function Products() {
  const [products, setProducts] = useState(
    () => productService.getCachedProducts() || []
  );
  const [loading, setLoading] = useState(
    () => !(productService.getCachedProducts()?.length > 0)
  );

  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(
    () => searchParams.get("search") || ""
  );

  const [category, setCategory] = useState(
    () => searchParams.get("category") || "All"
  );

  const [sort, setSort] = useState("");
  const [maxPrice, setMaxPrice] = useState(1000000000);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Custom dropdown
  const [openDropdown, setOpenDropdown] = useState(null);

  const productsPerPage = 8;

  /* LOAD PRODUCTS */

  useEffect(() => {
    let isMounted = true;

    productService
      .getProducts()
      .then((res) => {
        if (isMounted) {
          setProducts(res?.documents || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading products:", err);

        if (isMounted) {
          setProducts([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /* URL PARAMETER SYNC */

  const paramSearch = searchParams.get("search") || "";
  const paramCategory = searchParams.get("category") || "All";

  useEffect(() => {
    setSearch(paramSearch);
    setCategory(paramCategory);
    setCurrentPage(1);
    scrollToPageTop();
  }, [paramSearch, paramCategory]);

  /* CLOSE CUSTOM DROPDOWN WHEN CLICKING OUTSIDE */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest(".product-custom-select")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  /* HANDLERS */

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const handleSortChange = (value) => {
    setSort(value);
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const handlePriceChange = (value) => {
    setMaxPrice(Number(value));
    setCurrentPage(1);
  };

  /* CATEGORY LIST */

  const categories = useMemo(() => {
    const standardCategories = [
      "All",
      "Laptop",
      "Mobile",
      "Smart Watches",
      "Headphones",
    ];

    const dbCategories = products
      .map((product) => product.category?.trim())
      .filter(
        (cat) =>
          Boolean(cat) &&
          !standardCategories.some(
            (standard) =>
              standard.toLowerCase() === cat.toLowerCase()
          )
      );

    return [...standardCategories, ...new Set(dbCategories)];
  }, [products]);

  /* CATEGORY LABEL */

  const getCategoryLabel = (cat) => {
    if (cat === "All") return "All Categories";
    if (cat === "Laptop") return "Laptops";
    if (cat === "Mobile") return "Mobiles & Tablets";
    if (cat === "Smart Watches") return "Smart Watches";
    if (cat === "Headphones") return "Headphones & Audio";
    if (cat === "Tablet") return "Tablets";

    return cat;
  };

  /* SORT LABEL */

  const getSortLabel = () => {
    if (sort === "low") return "Price: Low → High";
    if (sort === "high") return "Price: High → Low";
    if (sort === "name") return "Name: A → Z";

    return "Sort By: Default";
  };

  /* FILTER PRODUCTS */

  const filteredProducts = useMemo(() => {
    let data = [...products];

    /* ---------------- Search ---------------- */

    if (search.trim() !== "") {
      const query = search.toLowerCase().trim();

      data = data.filter((product) => {
        const title = product.title?.toLowerCase() || "";
        const brand = product.brand?.toLowerCase() || "";
        const productCategory =
          product.category?.toLowerCase() || "";

        return (
          title.includes(query) ||
          brand.includes(query) ||
          productCategory.includes(query)
        );
      });
    }

    /* ---------------- Category ---------------- */

    if (category !== "All") {
      const target = category.trim().toLowerCase();

      data = data.filter((product) => {
        const titleLower =
          (product.title || "").toLowerCase();

        const catLower =
          (product.category || "").toLowerCase();

        const brandLower =
          (product.brand || "").toLowerCase();

        const isAudioCategory =
          catLower.includes("headphone") ||
          catLower.includes("earphone") ||
          catLower.includes("earbud") ||
          catLower.includes("buds") ||
          catLower.includes("audio") ||
          catLower.includes("neckband") ||
          catLower.includes("speaker");

        const isMobileCategory =
          !isAudioCategory &&
          (catLower.includes("mobile") ||
            catLower === "phone" ||
            catLower === "phones" ||
            catLower.includes("smartphone"));

        /* SMART WATCHES */

        if (target.includes("watch")) {
          const isWatch =
            titleLower.includes("watch") ||
            catLower.includes("watch") ||
            brandLower.includes("fireboltt") ||
            brandLower.includes("fire-boltt") ||
            brandLower.includes("noise");

          const isAudio =
            isAudioCategory ||
            titleLower.includes("buds") ||
            titleLower.includes("headphone") ||
            titleLower.includes("earphone");

          const isPhone = isMobileCategory;

          const isLaptop =
            catLower.includes("laptop") ||
            titleLower.includes("laptop");

          return (
            isWatch &&
            !isAudio &&
            !isPhone &&
            !isLaptop
          );
        }

        /* HEADPHONES & AUDIO */

        if (
          target.includes("headphone") ||
          target.includes("earphone") ||
          target.includes("buds") ||
          target.includes("audio")
        ) {
          const isAudio =
            isAudioCategory ||
            titleLower.includes("buds") ||
            titleLower.includes("headphone") ||
            titleLower.includes("earphone") ||
            titleLower.includes("headset") ||
            titleLower.includes("airpod") ||
            titleLower.includes("audio") ||
            titleLower.includes("neckband") ||
            titleLower.includes("rockerz") ||
            (titleLower.includes("air") &&
              catLower.includes("accessories"));

          const isWatch =
            titleLower.includes("watch") ||
            catLower.includes("watch");

          const isPhone = isMobileCategory;

          const isLaptop =
            catLower.includes("laptop") ||
            titleLower.includes("laptop");

          return (
            isAudio &&
            !isWatch &&
            !isPhone &&
            !isLaptop
          );
        }

        /* LAPTOPS */

        if (
          target.includes("laptop") ||
          target.includes("macbook") ||
          target.includes("computer") ||
          target.includes("notebook")
        ) {
          const isLaptop =
            catLower.includes("laptop") ||
            catLower.includes("computer") ||
            catLower.includes("notebook") ||
            titleLower.includes("laptop") ||
            titleLower.includes("macbook") ||
            titleLower.includes("notebook") ||
            titleLower.includes("thinkpad") ||
            titleLower.includes("chromebook") ||
            titleLower.includes("victus") ||
            titleLower.includes("alienware") ||
            titleLower.includes("tuf gaming");

          const isWatch =
            titleLower.includes("watch") ||
            catLower.includes("watch");

          const isAudio =
            isAudioCategory ||
            titleLower.includes("buds") ||
            titleLower.includes("headphone") ||
            titleLower.includes("earphone");

          const isPhone = isMobileCategory;

          return (
            isLaptop &&
            !isWatch &&
            !isAudio &&
            !isPhone
          );
        }

        /* TABLETS ONLY */

        if (target === "tablet" || target === "tablets") {
          return (
            catLower.includes("tablet") ||
            titleLower.includes("tablet") ||
            titleLower.includes("ipad") ||
            titleLower.includes("tab ") ||
            titleLower.includes("pad ")
          );
        }

        /* MOBILE & TABLETS */

        if (
          target.includes("mobile") ||
          target.includes("phone") ||
          target.includes("smartphone") ||
          target.includes("ipad")
        ) {
          const isMobileOrTablet =
            isMobileCategory ||
            catLower.includes("tablet") ||
            titleLower.includes("iphone") ||
            titleLower.includes("smartphone") ||
            titleLower.includes("mobile") ||
            titleLower.includes("tablet") ||
            titleLower.includes("ipad") ||
            titleLower.includes("tab ") ||
            brandLower.includes("realme") ||
            brandLower.includes("vivo") ||
            brandLower.includes("oppo") ||
            brandLower.includes("samsung") ||
            brandLower.includes("oneplus") ||
            brandLower.includes("apple");

          const isWatch =
            titleLower.includes("watch") ||
            catLower.includes("watch");

          const isAudio =
            isAudioCategory ||
            titleLower.includes("buds") ||
            titleLower.includes("headphone") ||
            titleLower.includes("earphone") ||
            titleLower.includes("rockerz");

          const isLaptop =
            catLower.includes("laptop") ||
            titleLower.includes("laptop") ||
            titleLower.includes("macbook");

          return (
            isMobileOrTablet &&
            !isWatch &&
            !isAudio &&
            !isLaptop
          );
        }

        /* DIRECT / FALLBACK MATCH */

        if (catLower === target) {
          return true;
        }

        if (
          catLower.replace(/s$/, "") ===
          target.replace(/s$/, "")
        ) {
          return true;
        }

        return (
          catLower.includes(target) ||
          target.includes(catLower)
        );
      });
    }

    /* ---------------- Price ---------------- */

    data = data.filter(
      (product) =>
        Number(product.price || 0) <= Number(maxPrice)
    );

    /* ---------------- Sorting ---------------- */

    if (sort === "low") {
      data.sort(
        (a, b) =>
          Number(a.price || 0) -
          Number(b.price || 0)
      );
    }

    if (sort === "high") {
      data.sort(
        (a, b) =>
          Number(b.price || 0) -
          Number(a.price || 0)
      );
    }

    if (sort === "name") {
      data.sort((a, b) =>
        (a.title || "").localeCompare(
          b.title || ""
        )
      );
    }

    return data;
  }, [
    products,
    search,
    category,
    maxPrice,
    sort,
  ]);

  /* PAGINATION */

  const indexOfLastProduct =
    currentPage * productsPerPage;

  const indexOfFirstProduct =
    indexOfLastProduct - productsPerPage;

  const currentProducts =
    filteredProducts.slice(
      indexOfFirstProduct,
      indexOfLastProduct
    );

  const totalPages = Math.ceil(
    filteredProducts.length / productsPerPage
  );

  const paginate = (pageNumber) => {
    if (
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      return;
    }

    setCurrentPage(pageNumber);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* LOADING */

  if (loading) {
    return (
      <div className="product-page-wrapper">
        <div className="container py-5">
          <div className="products-clean-loader">
            <div className="products-clean-spinner" />
            <h5>Loading Products...</h5>
            <p>Fetching the latest collection for you</p>
          </div>
        </div>
      </div>
    );
  }

  /* NO PRODUCTS */

  if (products.length === 0) {
    return (
      <div className="product-page-wrapper">
        <EmptyState
          title="No Products Available"
          message="Products will appear here after the admin adds them."
          buttonText="Go Home"
          buttonLink="/"
        />
      </div>
    );
  }

  /* MAIN UI */

  return (
    <div className="product-page-wrapper">
      <div className="container py-5">

        {/* FILTER BAR */}

        <div className="filter-bar-wrapper mb-5">
          <div className="row g-3 align-items-center">

            {/* SEARCH */}

            <div className="col-lg-3 col-md-6">
              <div className="input-icon-wrapper">

                <i className="bi bi-search search-icon"></i>

                <input
                  type="text"
                  className="form-control premium-input with-icon"
                  placeholder="Search Product..."
                  value={search}
                  onChange={(e) =>
                    handleSearchChange(
                      e.target.value
                    )
                  }
                />

              </div>
            </div>

            {/* CATEGORY CUSTOM DROPDOWN */}

            <div
              className={`col-lg-3 col-md-6 ${
                openDropdown === "category" ? "dropdown-col-open" : ""
              }`}
            >
              <div
                className={`product-custom-select ${
                  openDropdown === "category" ? "is-open" : ""
                }`}
              >

                <button
                  type="button"
                  className={`product-custom-select-button ${
                    openDropdown === "category"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "category"
                        ? null
                        : "category"
                    )
                  }
                >
                  <span>
                    {getCategoryLabel(category)}
                  </span>

                  <i
                    className={`bi bi-chevron-down product-custom-arrow ${
                      openDropdown === "category"
                        ? "rotate"
                        : ""
                    }`}
                  ></i>
                </button>

                {openDropdown === "category" && (
                  <div className="product-custom-menu">

                    {categories.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        className={`product-custom-option ${
                          category === cat
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleCategoryChange(cat)
                        }
                      >
                        <span>
                          {getCategoryLabel(cat)}
                        </span>

                        {category === cat && (
                          <i className="bi bi-check2 product-option-check"></i>
                        )}
                      </button>
                    ))}

                  </div>
                )}

              </div>
            </div>

            {/* SORT CUSTOM DROPDOWN */}

            <div
              className={`col-lg-3 col-md-6 ${
                openDropdown === "sort" ? "dropdown-col-open" : ""
              }`}
            >
              <div
                className={`product-custom-select ${
                  openDropdown === "sort" ? "is-open" : ""
                }`}
              >

                <button
                  type="button"
                  className={`product-custom-select-button ${
                    openDropdown === "sort"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "sort"
                        ? null
                        : "sort"
                    )
                  }
                >
                  <span>
                    {getSortLabel()}
                  </span>

                  <i
                    className={`bi bi-chevron-down product-custom-arrow ${
                      openDropdown === "sort"
                        ? "rotate"
                        : ""
                    }`}
                  ></i>
                </button>

                {openDropdown === "sort" && (
                  <div className="product-custom-menu">

                    {[
                      {
                        value: "",
                        label: "Sort By: Default",
                      },
                      {
                        value: "low",
                        label: "Price: Low → High",
                      },
                      {
                        value: "high",
                        label: "Price: High → Low",
                      },
                      {
                        value: "name",
                        label: "Name: A → Z",
                      },
                    ].map((option) => (
                      <button
                        type="button"
                        key={
                          option.value ||
                          "default"
                        }
                        className={`product-custom-option ${
                          sort === option.value
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleSortChange(
                            option.value
                          )
                        }
                      >
                        <span>
                          {option.label}
                        </span>

                        {sort === option.value && (
                          <i className="bi bi-check2 product-option-check"></i>
                        )}
                      </button>
                    ))}

                  </div>
                )}

              </div>
            </div>

            {/* PRICE SLIDER */}

            <div className="col-lg-3 col-md-6">
              <div className="price-slider-box">

                <label className="form-label d-flex justify-content-between">

                  <span>
                    Max Price:
                  </span>

                  <span className="price-value">
                    ₹
                    {Number(
                      maxPrice
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </span>

                </label>

                <input
                  type="range"
                  className="form-range premium-range"
                  min="0"
                  max="1000000000"
                  step="1000"
                  value={maxPrice}
                  onChange={(e) =>
                    handlePriceChange(
                      e.target.value
                    )
                  }
                />

              </div>
            </div>

          </div>
        </div>

        {/* RESULTS */}

        {filteredProducts.length === 0 ? (
          <EmptyState
            image="https://cdn-icons-png.flaticon.com/512/7486/7486754.png"
            title="No Matching Products"
            message="We couldn't find anything matching your filters or search."
            buttonText="Reset Filters"
            buttonLink="/products"
          />
        ) : (
          <>

            <div className="results-header mb-4 d-flex justify-content-between align-items-end">

              <h5 className="results-text">

                Showing{" "}

                <span>
                  {indexOfFirstProduct + 1}-
                  {Math.min(
                    indexOfLastProduct,
                    filteredProducts.length
                  )}
                </span>{" "}

                of{" "}

                <span>
                  {filteredProducts.length}
                </span>{" "}

                Products

              </h5>

            </div>

            {/* PRODUCT GRID */}

            <div className="row g-3 g-md-4">

              {currentProducts.map(
                (product) => (
                  <div
                    className="col-6 col-md-4 col-lg-3"
                    key={product.$id}
                  >
                    <ProductCard
                      product={product}
                    />
                  </div>
                )
              )}

            </div>

            {/* PAGINATION */}

            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-5">

                <ul className="pagination custom-pagination">

                  {/* PREVIOUS */}

                  <li
                    className={`page-item ${
                      currentPage === 1
                        ? "disabled"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="page-link"
                      onClick={() =>
                        paginate(
                          currentPage - 1
                        )
                      }
                      disabled={
                        currentPage === 1
                      }
                    >
                      <i className="bi bi-chevron-left"></i>{" "}
                      Prev
                    </button>
                  </li>

                  {/* PAGE NUMBERS */}

                  {[...Array(totalPages)].map(
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
                          type="button"
                          className="page-link"
                          onClick={() =>
                            paginate(
                              index + 1
                            )
                          }
                        >
                          {index + 1}
                        </button>
                      </li>
                    )
                  )}

                  {/* NEXT */}

                  <li
                    className={`page-item ${
                      currentPage ===
                      totalPages
                        ? "disabled"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="page-link"
                      onClick={() =>
                        paginate(
                          currentPage + 1
                        )
                      }
                      disabled={
                        currentPage ===
                        totalPages
                      }
                    >
                      Next{" "}
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </li>

                </ul>

              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
}

export default Products;