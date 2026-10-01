import { Storage, ID } from "appwrite";
import client from "./config";

export const storage = new Storage(client);

export { ID };