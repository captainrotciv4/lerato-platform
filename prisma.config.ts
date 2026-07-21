import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

if (!process.env.DATABASE_URL) {
  loadEnv();
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
