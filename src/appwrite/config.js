import {
    Client,
    Databases,
} from "appwrite";


  // APPWRITE CLIENT

const client = new Client();


  // APPWRITE CONFIG

client
    .setEndpoint(
        import.meta.env.VITE_APPWRITE_ENDPOINT
    )
    .setProject(
        import.meta.env.VITE_APPWRITE_PROJECT_ID
    );


  // APPWRITE DATABASE

const databases = new Databases(
    client
);


  // EXPORTS

// Default export
// Used by files like:
// import client from "./config";

export default client;


// Named export
// Used by walletService.js:
// import { databases } from "./config";

export {
    databases,
};