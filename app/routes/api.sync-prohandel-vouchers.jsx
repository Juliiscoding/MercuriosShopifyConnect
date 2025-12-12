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

        // 1. Get Changed Vouchers (Issuance Sync)
        const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        console.log(`📡 Fetching ProHandel vouchers changed since ${since}`);

        const phRes = await axios.get(`${PROHANDEL_CONFIG.apiUrl}/voucher/changed/${since}`, { headers });
        const changedVouchers = phRes.data;

        let syncedCount = 0;
        let redeemedCount = 0;

        for (const phV of changedVouchers) {
            const code = phV.internetCode || phV.number.toString();

            const existing = await Voucher.findOne({
                $or: [
                    { proHandelUuid: phV.id },
                    { proHandelNumber: phV.number }
                ]
            });

            if (!existing) {
                console.log(`✨ New ProHandel Voucher found: ${code} (${phV.value} EUR)`);

                let shopifyGiftCardId = null;
                if (admin) {
                    try {
                        const giftCard = new admin.rest.resources.GiftCard({ session: admin.session });
                        giftCard.code = code;
                        giftCard.initial_value = phV.value;
                        giftCard.note = `ProHandel Import: ${phV.number}`;
                        await giftCard.save({ update: true });
                        shopifyGiftCardId = giftCard.id;
                        console.log(`✅ Created Native Shopify Gift Card ID: ${shopifyGiftCardId}`);
                    } catch (gcErr) {
                        console.error("⚠️ Failed to create Shopify Gift Card (Import):", gcErr.message);
                    }
                }

                const newUsage = new Voucher({
                    shopifyCode: code,
                    shopifyGiftCardId: shopifyGiftCardId ? shopifyGiftCardId.toString() : undefined,
                    proHandelNumber: phV.number,
                    proHandelUuid: phV.id,
                    value: phV.value,
                    initialValue: phV.value,
                    status: 'active',
                    issuedAt: new Date(phV.date || Date.now()),
                    source: 'prohandel_import'
                });
                await newUsage.save();
                syncedCount++;
            } else {
                // Update status if needed (Redemption sync)
                // This part is now handled by the separate redemption sync below
            }
        }

        // 2. Get Redeemed Vouchers (Redemption Sync)
        console.log(`📡 Fetching ProHandel redeemed vouchers since ${since}`);
        const redeemedRes = await axios.get(`${PROHANDEL_CONFIG.apiUrl}/voucher/redemption/changed/${since}`, { headers });
        const redeemedVouchers = redeemedRes.data;

        for (const redV of redeemedVouchers) {
            const voucher = await Voucher.findOne({ proHandelUuid: redV.id });

            if (voucher && voucher.status !== 'redeemed') {
                console.log(`🔄 Syncing Redemption for Voucher ${voucher.shopifyCode}`);

                voucher.status = 'redeemed';
                voucher.redeemedAt = new Date(redV.voucherRedemptionDate || Date.now());
                await voucher.save();

                // Disable in Shopify
                if (admin && voucher.shopifyGiftCardId) {
                    try {
                        const giftCard = new admin.rest.resources.GiftCard({ session: admin.session });
                        giftCard.id = voucher.shopifyGiftCardId;
                        await giftCard.disable();
                        console.log(`🚫 Disabled Shopify Gift Card ${voucher.shopifyGiftCardId}`);
                    } catch (err) {
                        console.error(`⚠️ Failed to disable Shopify Gift Card ${voucher.shopifyGiftCardId}:`, err.message);
                    }
                }
                redeemedCount++;
            }
        }

        return json({ success: true, synced: syncedCount, redeemed: redeemedCount });

    } catch (error) {
        console.error("❌ Sync Error:", error.message);
        return json({ success: false, error: error.message }, { status: 500 });
    }
};
