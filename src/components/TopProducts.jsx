const products = [
    {
        id: 1,
        name: "iPhone 16 Pro",
        image: "https://dummyjson.com/image/300x300?text=iPhone",
        sales: 325,
        price: "₹1,29,999",
        rating: 4.9,
    },
    {
        id: 2,
        name: "MacBook Pro M4",
        image: "https://dummyjson.com/image/300x300?text=MacBook",
        sales: 210,
        price: "₹1,99,999",
        rating: 4.8,
    },
    {
        id: 3,
        name: "Samsung S25 Ultra",
        image: "https://dummyjson.com/image/300x300?text=Samsung",
        sales: 180,
        price: "₹1,14,999",
        rating: 4.7,
    },
    {
        id: 4,
        name: "ASUS TUF Gaming",
        image: "https://dummyjson.com/image/300x300?text=ASUS",
        sales: 140,
        price: "₹74,999",
        rating: 4.6,
    },
];

function TopProducts() {
    return (
        <div className="top-products">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Top Selling Products</h4>

                <button className="btn btn-outline-primary btn-sm">
                    View All
                </button>
            </div>

            {products.map((product) => (
                <div className="top-product-item" key={product.id}>
                    <div className="d-flex align-items-center">

                        <img
                            src={product.image}
                            alt={product.name}
                            className="top-product-img"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=150&q=80";
                            }}
                        />

                        <div className="ms-3">
                            <h6 className="mb-1">
                                {product.name}
                            </h6>

                            <small className="text-muted">
                                {product.sales} Sold
                            </small>
                        </div>
                    </div>

                    <div className="text-end">

                        <h6 className="mb-1">
                            {product.price}
                        </h6>

                        <small className="text-warning">
                            ⭐ {product.rating}
                        </small>

                    </div>
                </div>
            ))}
        </div>
    );
}

export default TopProducts;