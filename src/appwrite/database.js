import { Databases, ID } from "appwrite";
import client from "./config";

export const databases = new Databases(client);

export { ID };