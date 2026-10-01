import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    mode: "light",
};

const themeSlice = createSlice({
    name: "theme",
    initialState,
    reducers: {
        toggleTheme(state) {
            state.mode = state.mode === "light" ? "dark" : "light";
        },
        setTheme(state, action) {
            const nextMode = action.payload === "dark" ? "dark" : "light";
            state.mode = nextMode;
        },
    },
});

export const { toggleTheme, setTheme } = themeSlice.actions;

export default themeSlice.reducer;
