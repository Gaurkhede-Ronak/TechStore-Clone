function DashboardCard({
    title,
    value,
    icon,
    color,
}) {
    return (
        <div
            className="dashboard-card"
            style={{
                borderLeft: `6px solid ${color}`,
            }}
        >
            <div className="dashboard-card-top">

                <div>

                    <p className="dashboard-title">

                        {title}

                    </p>

                    <h2 className="dashboard-value">

                        {value}

                    </h2>

                </div>

                <div
                    className="dashboard-icon"
                    style={{
                        background: color,
                    }}
                >

                    {icon}

                </div>

            </div>

            <div className="dashboard-footer">

                <span className="dashboard-growth">

                    ↑ 12%

                </span>

                <span>

                    than last month

                </span>

            </div>

        </div>
    );
}

export default DashboardCard;