import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  isLoggedIn: false,
  authLoading: true,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    login(state, action) {
      state.user = action.payload;
      state.isLoggedIn = true;
    },

    logout(state) {
      state.user = null;
      state.isLoggedIn = false;
    },

    updateProfile(state, action) {
      state.user = {
        ...state.user,
        ...action.payload,
      };
    },

    finishAuthLoading(state) {
      state.authLoading = false;
    },
  },
});

export const {
  login,
  logout,
  updateProfile,
  finishAuthLoading,
} = authSlice.actions;

export default authSlice.reducer;