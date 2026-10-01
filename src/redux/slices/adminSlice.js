import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    admin: null,
    isAdminLoggedIn: false,
};

const adminSlice = createSlice({
    name: "admin",
    initialState,
    reducers: {
        adminLogin(state, action) {
            state.admin = action.payload;
            state.isAdminLoggedIn = true;
        },

        adminLogout(state) {
            state.admin = null;
            state.isAdminLoggedIn = false;
        },
    },
});

export const {
    adminLogin, adminLogout
} = adminSlice.actions;


export default adminSlice.reducer;