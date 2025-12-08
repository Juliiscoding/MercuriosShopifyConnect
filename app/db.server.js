import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";

// --- Prisma Setup (for Shopify Session Storage) ---
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
}

export default prisma;

// --- Mongoose Setup (for Application Data) ---
let mongooseConnection;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Use the MONGODB_URI from .env or fallback to local default
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/MercuriosIDV';

  if (!mongoUri) {
    console.error("❌ MONGODB_URI is missing in .env and no default provided");
    throw new Error("MONGODB_URI is executing");
  }

  try {
    if (!global.mongoose) {
      global.mongoose = await mongoose.connect(mongoUri);
    } else {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(mongoUri);
      }
    }
    console.log("✅ Connected to MongoDB (Mongoose)");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
}
