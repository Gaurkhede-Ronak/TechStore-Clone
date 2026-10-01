function RecentOrders() {

    const orders = [

        {
            id: "#1001",
            customer: "Ronak",
            amount: "₹45,999",
            status: "Delivered",
        },

        {
            id: "#1002",
            customer: "Rahul",
            amount: "₹18,499",
            status: "Pending",
        },

        {
            id: "#1003",
            customer: "Amit",
            amount: "₹29,999",
            status: "Processing",
        },

        {
            id: "#1004",
            customer: "Karan",
            amount: "₹12,999",
            status: "Cancelled",
        },

        {
            id: "#1005",
            customer: "Akash",
            amount: "₹9,999",
            status: "Delivered",
        },

    ];

    return (

        <div className="recent-orders">

            <div className="d-flex justify-content-between align-items-center mb-4">

                <h4 className="mb-0">

                    Recent Orders

                </h4>

                <button className="btn btn-primary btn-sm">

                    View All

                </button>

            </div>

            <div className="table-responsive">

                <table className="table table-hover align-middle">

                    <thead>

                        <tr>

                            <th>Order ID</th>

                            <th>Customer</th>

                            <th>Amount</th>

                            <th>Status</th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            orders.map(order => (

                                <tr key={order.id}>

                                    <td>

                                        {order.id}

                                    </td>

                                    <td>

                                        {order.customer}

                                    </td>

                                    <td>

                                        {order.amount}

                                    </td>

                                    <td>

                                        <span
                                            className={`badge ${
                                                order.status === "Delivered"
                                                    ? "bg-success"
                                                    : order.status === "Pending"
                                                    ? "bg-warning text-dark"
                                                    : order.status === "Processing"
                                                    ? "bg-primary"
                                                    : "bg-danger"
                                            }`}
                                        >

                                            {order.status}

                                        </span>

                                    </td>

                                </tr>

                            ))

                        }

                    </tbody>

                </table>

            </div>

        </div>

    );

}

export default RecentOrders;