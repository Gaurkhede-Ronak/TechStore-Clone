import { Account, ID } from "appwrite";
import client from "./config";

export const account = new Account(client);

export { ID };