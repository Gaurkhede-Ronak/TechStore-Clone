import { configureStore } from "@reduxjs/toolkit";
import adminReducer from "./slices/adminSlice";
import cartReducer from "./slices/cartSlice";
import wishlistReducer from "./slices/wishlistSlice";
import authReducer from "./slices/authSlice";
import themeReducer from "./slices/themeSlice";
import adminProductReducer from "./slices/adminProductSlice"

export const store = configureStore({

  reducer: {

    cart: cartReducer,

    wishlist: wishlistReducer,

    auth: authReducer,

    theme: themeReducer,

    admin: adminReducer,

     adminProducts: adminProductReducer
  },

});