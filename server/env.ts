import dotenv from "dotenv";
import path from "path";

// Always load .env locally, do not load on deployments
if (!process.env.REPLIT_DEPLOYMENT) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

export {};
