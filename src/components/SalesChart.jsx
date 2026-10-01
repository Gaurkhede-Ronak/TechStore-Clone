import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

function SalesChart() {

    const data = {
        labels: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
        ],

        datasets: [

            {

                label: "Revenue",

                data: [
                    12000,
                    18000,
                    15000,
                    25000,
                    21000,
                    30000,
                    38000,
                ],

                borderColor: "#2563eb",

                backgroundColor: "rgba(37,99,235,.15)",

                fill: true,

                tension: 0.4,

            },

        ],

    };

    const options = {

        responsive: true,

        plugins: {

            legend: {

                position: "top",

            },

        },

    };

    return (

        <div className="chart-card">

            <h4 className="mb-4">

                Sales Overview

            </h4>

            <Line
                data={data}
                options={options}
            />

        </div>

    );

}

export default SalesChart;