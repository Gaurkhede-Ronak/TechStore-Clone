const customers = [
    {
        id: 1,
        name: "Ronak Gaurkhede",
        email: "ronak@gmail.com",
        avatar: "https://i.pravatar.cc/100?img=1",
        status: "Active",
    },
    {
        id: 2,
        name: "Rahul Patel",
        email: "rahul@gmail.com",
        avatar: "https://i.pravatar.cc/100?img=2",
        status: "Active",
    },
    {
        id: 3,
        name: "Amit Sharma",
        email: "amit@gmail.com",
        avatar: "https://i.pravatar.cc/100?img=3",
        status: "Inactive",
    },
    {
        id: 4,
        name: "Karan Singh",
        email: "karan@gmail.com",
        avatar: "https://i.pravatar.cc/100?img=4",
        status: "Active",
    },
];

function LatestCustomers() {
    return (
        <div className="latest-customers">

            <div className="d-flex justify-content-between align-items-center mb-4">

                <h4 className="mb-0">
                    Latest Customers
                </h4>

                <button className="btn btn-outline-primary btn-sm">
                    View All
                </button>

            </div>

            {
                customers.map((customer) => (

                    <div
                        className="customer-item"
                        key={customer.id}
                    >

                        <div className="d-flex align-items-center">

                            <img
                                src={customer.avatar}
                                alt={customer.name}
                                className="customer-avatar"
                            />

                            <div className="ms-3">

                                <h6 className="mb-1">
                                    {customer.name}
                                </h6>

                                <small className="text-muted">
                                    {customer.email}
                                </small>

                            </div>

                        </div>

                        <span
                            className={`badge ${
                                customer.status === "Active"
                                    ? "bg-success"
                                    : "bg-secondary"
                            }`}
                        >
                            {customer.status}
                        </span>

                    </div>

                ))
            }

        </div>
    );
}

export default LatestCustomers;