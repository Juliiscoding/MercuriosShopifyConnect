import { authenticate } from "../shopify.server";
import { syncOneCustomer } from "../services/customerSync"; // We need to expose syncOneCustomer or adapt syncCustomers
import { connectDB } from "../db.server";

export const action = async ({ request }) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
        return new Response();
    }

    await connectDB();

    console.log(`[Webhook] Customer Sync Trigger: ${topic}`);

    try {
        // payload is the Customer object from Shopify
        // We need to adapt syncOneCustomer to accept this payload
        // Note: The previous logic might have expected a different format (rest vs graphql), 
        // verify common keys like 'email', 'default_address' etc are in payload.
        await syncOneCustomer(payload);
    } catch (error) {
        console.error(`Error syncing customer ${payload.id}:`, error);
    }

    return new Response();
};
