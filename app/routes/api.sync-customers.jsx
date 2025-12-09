import { authenticate } from "../shopify.server";
import { syncCustomers } from "../services/customerSync";
import { connectDB } from "../db.server";

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    await connectDB();

    console.log("[API] Manual Customer Sync Triggered");

    try {
        await syncCustomers(admin.rest);
        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("[API] Customer Sync Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
