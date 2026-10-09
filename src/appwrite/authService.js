import { account, ID } from "./auth";

class AuthService {
  // Check if an Appwrite session exists in storage / cookies before requesting
  hasActiveSession() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const cookieFallback = window.localStorage.getItem("cookieFallback");
      if (cookieFallback && cookieFallback !== "{}" && cookieFallback !== "[]") {
        try {
          const parsed = JSON.parse(cookieFallback);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            return true;
          }
        } catch {
          if (cookieFallback.trim().length > 5) {
            return true;
          }
        }
      }
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith("a_session_") || key.includes("appwrite"))) {
          const val = window.localStorage.getItem(key);
          if (val && val !== "{}" && val.trim().length > 0) {
            return true;
          }
        }
      }
      if (typeof document !== "undefined" && document.cookie && document.cookie.includes("a_session")) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // 🌟 REGISTER
  async register({ name, email, password }) {
    try {
      const user = await account.create(
        ID.unique(),
        email,
        password,
        name
      );

      // Register hone ke turant baad automatically login karna
      if (user) {
        await this.login({ email, password });
      }

      return user;
    } catch (error) {
      console.log("Appwrite service :: register :: error", error);
      throw error;
    }
  }

  // 🌟 LOGIN
  async login({ email, password }) {
    try {
      // Pehle purana session delete karne ka try karo agar session pehle se maujood ho
      if (this.hasActiveSession()) {
        try {
          await account.deleteSession("current");
        } catch {
          // Ignore if no session
        }
      }

      // Naya session create karo
      return await account.createEmailPasswordSession(email, password);
    } catch (error) {
      if (error?.code === 409 || String(error?.message || "").toLowerCase().includes("session is active")) {
        await account.deleteSession("current");
        return await account.createEmailPasswordSession(email, password);
      }
      console.log("Appwrite service :: login :: error", error);
      throw error;
    }
  }

  // 🌟 GET CURRENT USER
  async getCurrentUser() {
    if (!this.hasActiveSession()) {
      return null;
    }

    try {
      // Agar user logged in hoga, toh uska data mil jayega
      return await account.get();
    } catch {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("cookieFallback");
        }
      } catch {
        // ignore
      }
      return null;
    }
  }

  // 🌟 LOGOUT
  async logout() {
    try {
      if (this.hasActiveSession()) {
        await account.deleteSession("current");
      }
    } catch (error) {
      console.log("Appwrite service :: logout :: error", error);
    } finally {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("cookieFallback");
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  // 🌟 FORGOT PASSWORD (Send Recovery Email)
  async forgotPassword(email) {
    try {
      // Dhyan rakhein ki ye URL bilkul sahi ho aur Appwrite me allowed ho
      const redirectUrl = "http://localhost:5173/reset-password"; 
      return await account.createRecovery(email, redirectUrl);
    } catch (error) {
      console.log("Appwrite service :: forgotPassword :: error", error);
      throw error;
    }
  }

  // 🌟 RESET PASSWORD (Confirm New Password)
  async resetPassword({ userId, secret, password }) {
    try {
      return await account.updateRecovery(
        userId,
        secret,
        password,
        password
      );
    } catch (error) {
      console.log("Appwrite service :: resetPassword :: error", error);
      throw error;
    }
  }

  // 🌟 GET USER PREFERENCES
  async getPrefs() {
    if (!this.hasActiveSession()) {
      return {};
    }
    try {
      return await account.getPrefs();
    } catch {
      return {};
    }
  }

  // 🌟 UPDATE USER PREFERENCES
  async updatePrefs(prefs) {
    if (!this.hasActiveSession()) {
      return {};
    }
    try {
      return await account.updatePrefs(prefs);
    } catch (error) {
      console.log("Appwrite service :: updatePrefs :: error", error);
      throw error;
    }
  }
}

export default new AuthService();