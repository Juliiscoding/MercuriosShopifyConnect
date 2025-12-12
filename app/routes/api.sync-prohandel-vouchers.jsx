import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import Voucher from "../models/Voucher";
import axios from "axios";
import { connectDB } from "../db.server";

// Reusing config - ideally shared
const PROHANDEL_CONFIG = {
    authUrl: process.env.PROHANDEL_AUTH_URL || 'https://auth.prohandel.cloud/api/v4',
    apiUrl: process.env.PROHANDEL_API_URL || 'https://linde.prohandel.de/api/v2',
    apiKey: process.env.PROHANDEL_API_KEY,
    apiSecret: process.env.PROHANDEL_API_SECRET
};

async function getProHandelHeaders() {
    try {
        const authData = { apiKey: PROHANDEL_CONFIG.apiKey, secret: PROHANDEL_CONFIG.apiSecret };
        const authRes = await axios.post(`${PROHANDEL_CONFIG.authUrl}/token`, authData, { timeout: 10000 });
        const token = authRes.data.token.token.value;
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    } catch (err) {
        console.error('❌ ProHandel Auth Failed:', err.message);
        throw err;
    }
}

export const action = async ({ request }) => {
    // Authenticate (Admin or flexible if Cron)
    // For manual trigger from our dashboard, admin auth is good.
    // For Cron, we might need to bypass if we use a specific header secret.
    // For now, let's assume manual trigger for testing.
    let admin = null;
    try {
        const auth = await authenticate.admin(request);
        admin = auth.admin;
    } catch (e) {
        // If not admin, check for Cron secret?
        // console.log("Not admin request");
    }

    await connectDB();
    console.log("🔄 Starting ProHandel -> Shopify Voucher Sync...");

    try {
        const headers = await getProHandelHeaders();

        // 1. Get Changed Vouchers (Time window: Last 24h or since last sync)
        // For simplicity, let's look at last 2 hours
        const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        console.log(`📡 Fetching ProHandel vouchers changed since ${since}`);

        // Use 'changed' endpoint
        const phRes = await axios.get(`${PROHANDEL_CONFIG.apiUrl}/voucher/changed/${since}`, { headers });
        const changedVouchers = phRes.data;

        let syncedCount = 0;

        for (const phV of changedVouchers) {
            const code = phV.internetCode || phV.number.toString();

            // Check if exists
            const existing = await Voucher.findOne({
                $or: [
                    { proHandelUuid: phV.id },
                    { proHandelNumber: phV.number }
                ]
            });

            if (!existing) {
                console.log(`✨ New ProHandel Voucher found: ${code} (${phV.value} EUR)`);

                // Create in MongoDB
                const newUsage = new Voucher({
                    shopifyCode: code,
                    // No shopifyOrderId as it comes from POS/Offline
                    proHandelNumber: phV.number,
                    proHandelUuid: phV.id,
                    value: phV.value,
                    initialValue: phV.value,
                    status: 'active',
                    issuedAt: new Date(phV.date || Date.now()),
                    source: 'prohandel_import'
                });
                await newUsage.save();

                // TODO: Create Shopify Discount Code or Gift Card here
                // admin.rest.post... or admin.graphql...

                syncedCount++;
            } else {
                // Update status if needed (Redemption sync)
                // TODO
            }
        }

        return json({ success: true, count: changedVouchers.length, synced: syncedCount });

    } catch (error) {
        console.error("❌ Sync Error:", error.message);
        return json({ success: false, error: error.message }, { status: 500 });
    }
};
