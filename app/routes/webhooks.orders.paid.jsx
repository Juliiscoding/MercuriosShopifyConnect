import { authenticate } from "../shopify.server";
import { processOrder } from "../services/voucherSync";
import { connectDB } from "../db.server";

export const action = async ({ request }) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
        // The topic was not triggered by an admin event or verification failed
        return new Response();
    }

    // Ensure DB connection
    await connectDB();

    console.log(`[Webhook] Topic: ${topic} Shop: ${shop}`);

    // Process the order for Vouchers
    try {
        if (topic === "ORDERS_PAID") {
            await processOrder(payload);
        }
    } catch (error) {
        console.error(`Error processing webhook ${topic}:`, error);
    }

    return new Response();
};
