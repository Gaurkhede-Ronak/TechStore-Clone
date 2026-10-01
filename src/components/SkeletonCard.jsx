import "../css/Skeleton.css";

function SkeletonCard() {

    return (

        <div className="col-md-3 col-sm-6 mb-4">

            <div className="skeleton-card">

                <div className="skeleton skeleton-image"></div>

                <div className="p-3">

                    <div className="skeleton skeleton-title"></div>

                    <div className="skeleton skeleton-text"></div>

                    <div className="skeleton skeleton-price"></div>

                    <div className="skeleton skeleton-btn"></div>

                </div>

            </div>

        </div>

    );

}

export default SkeletonCard;