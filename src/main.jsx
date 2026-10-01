import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./index.css";
import AppToaster from "./components/AppToaster";

import App from "./App";
import { store } from "./redux/store";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Provider store={store}>
      <AppToaster />
      <App />
    </Provider>
  </BrowserRouter>
);
