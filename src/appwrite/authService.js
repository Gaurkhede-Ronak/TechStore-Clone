import { account, ID } from "./auth";

class AuthService {
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
        // Pehle purana session delete karne ka try karo taaki "Session already active" error na aaye
        try {
            await account.deleteSession("current");
        } catch {
            // Agar koi session nahi tha, toh is error ko ignore karo
        }

        // Naya session create karo
        return await account.createEmailPasswordSession(email, password);
    } catch (error) {
        console.log("Appwrite service :: login :: error", error);
        throw error;
    }
  }

  // 🌟 GET CURRENT USER
  async getCurrentUser() {
    try {
        // Agar user logged in hoga, toh uska data mil jayega
        return await account.get();
    } catch {
        // NOTE: Agar user logged in nahi hai, toh Console mein 403/401 error aayega. 
        // Ye normal hai, isse app crash nahi hogi. Hum bas null return kar rahe hain.
        return null; 
    }
  }

  // 🌟 LOGOUT
  async logout() {
    try {
        return await account.deleteSession("current");
    } catch (error) {
        console.log("Appwrite service :: logout :: error", error);
        return null;
    }
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
    try {
      return await account.getPrefs();
    } catch {
      return {};
    }
  }

  // 🌟 UPDATE USER PREFERENCES
  async updatePrefs(prefs) {
    try {
      return await account.updatePrefs(prefs);
    } catch (error) {
      console.log("Appwrite service :: updatePrefs :: error", error);
      throw error;
    }
  }
}

export default new AuthService();