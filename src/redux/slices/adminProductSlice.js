import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    products: []
};

const adminProductSlice = createSlice({
    name: "adminProducts",
    initialState,

    reducers: {

        addProduct(state, action) {
            state.products.push(action.payload);
        },

        editProduct(state, action) {
            const index = state.products.findIndex(
                product => product.id === action.payload.id
            );

            if (index !== -1) {
                state.products[index] = action.payload;
            }
        },

        deleteProduct(state, action) {
            state.products = state.products.filter(
                product => product.id !== action.payload
            );
        }

    }

});

export const {
    addProduct,
    editProduct,
    deleteProduct
} = adminProductSlice.actions;

export default adminProductSlice.reducer;