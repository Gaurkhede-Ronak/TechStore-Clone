import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
};

const cartSlice = createSlice({
  name: "cart",

  initialState,

  reducers: {
    // Hydrate Cart from Appwrite
    setCartItems: (state, action) => {
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },

    // Add Product
    addToCart: (state, action) => {
      const product = action.payload;

      const exist = state.items.find(
        (item) => item.$id === product.$id
      );

      if (exist) {
        exist.quantity += product.quantity || 1;
      } else {
        state.items.push({
          ...product,
          quantity: product.quantity || 1,
        });
      }
    },

    // Increase Quantity
    increaseQty: (state, action) => {
      const item = state.items.find(
        (item) => item.$id === action.payload
      );

      if (item) {
        item.quantity++;
      }
    },

    // Decrease Quantity
    decreaseQty: (state, action) => {
      const item = state.items.find(
        (item) => item.$id === action.payload
      );

      if (item && item.quantity > 1) {
        item.quantity--;
      }
    },

    // Remove Product
    removeFromCart: (state, action) => {
      state.items = state.items.filter(
        (item) => item.$id !== action.payload
      );
    },

    // Clear Cart
    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const {
  setCartItems,
  addToCart,
  removeFromCart,
  increaseQty,
  decreaseQty,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
