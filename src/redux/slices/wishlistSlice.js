import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    items: [],
};

const wishlistSlice = createSlice({
    name: "wishlist",
    initialState,
    reducers: {
        setWishlistItems: (state, action) => {
            state.items = Array.isArray(action.payload) ? action.payload : [];
        },

        addWishlist: (state, action) => {
            const exist = state.items.find(
                (item) => item.$id === action.payload.$id
            );
            if (!exist) {
                state.items.push(action.payload);
            }
        },

        removeWishlist: (state, action) => {
            state.items = state.items.filter(
                (item) => item.$id !== action.payload
            );
        },
    },
});

export const { setWishlistItems, addWishlist, removeWishlist } = wishlistSlice.actions;

export default wishlistSlice.reducer;
