import mongoose from "mongoose";
import IdentityCustomer from "../models/IdentityCustomer";

export async function syncCustomers(shopifyClient) {
    let stats = { processed: 0, matched: 0, created: 0, errors: 0 };
    let params = { limit: 250 };
    let hasNext = true;

    try {
        const session = shopifyClient.session.customAppSession(process.env.SHOP_URL || 'mercurios-test.myshopify.com');
        const client = new shopifyClient.clients.Rest({ session });

        while (hasNext) {
            const response = await client.get({
                path: 'customers',
                query: params,
            });

            const customers = response.body.customers;

            for (const customer of customers) {
                try {
                    await syncOneCustomer(customer);
                    stats.processed++;
                } catch (err) {
                    console.error(`Failed to sync customer ${customer.id}:`, err);
                    stats.errors++;
                }
            }

            // Pagination info is in response.pageInfo
            if (response.pageInfo && response.pageInfo.nextPage) {
                params = response.pageInfo.nextPage.query;
            } else {
                hasNext = false;
            }
        }
    } catch (error) {
        console.error("Shopify API Error:", error);
        throw error;
    }
    return stats;
}

export async function syncOneCustomer(shopifyData) {
    if (!shopifyData.email) {
        console.log(`Skipping Shopify customer ${shopifyData.id} - No email`);
        return; // Cannot match reliably without email for now
    }

    const normalizedEmail = shopifyData.email.toLowerCase().trim();

    // Try to find existing customer
    // Matching Strategy: Email OR (LastName + FirstName + Zip - NOT IMPLEMENTED YET to avoid false positives)
    let customer = await IdentityCustomer.findOne({
        $or: [
            { email: normalizedEmail },
            { 'shopifyIntegration.shopifyCustomerId': shopifyData.id.toString() }
        ]
    });

    if (customer) {
        // UPDATE existing
        // console.log(`Matched customer: ${customer.email} with Shopify ID: ${shopifyData.id}`);

        customer.shopifyIntegration = {
            ...customer.shopifyIntegration,
            shopifyCustomerId: shopifyData.id.toString(),
            ordersCount: shopifyData.orders_count,
            totalSpent: shopifyData.total_spent,
            lastOrderId: shopifyData.last_order_id ? shopifyData.last_order_id.toString() : null,
            tags: shopifyData.tags ? shopifyData.tags.split(',').map(t => t.trim()) : [],
            syncStatus: 'synced',
            lastSyncDate: new Date()
        };

        // Enrich main profile fields if missing
        if (!customer.firstName && shopifyData.first_name) customer.firstName = shopifyData.first_name;
        if (!customer.lastName && shopifyData.last_name) customer.lastName = shopifyData.last_name;
        if (!customer.phoneNumber && shopifyData.phone) customer.phoneNumber = shopifyData.phone;

        await customer.save();
        return 'updated';
    } else {
        // CREATE new
        // console.log(`Creating new customer from Shopify: ${normalizedEmail}`);

        const newCustomer = new IdentityCustomer({
            email: normalizedEmail,
            firstName: shopifyData.first_name,
            lastName: shopifyData.last_name,
            phoneNumber: shopifyData.phone,
            source: 'shopify',
            'crmData.source': 'import',
            shopifyIntegration: {
                shopifyCustomerId: shopifyData.id.toString(),
                ordersCount: shopifyData.orders_count,
                totalSpent: shopifyData.total_spent,
                lastOrderId: shopifyData.last_order_id ? shopifyData.last_order_id.toString() : null,
                tags: shopifyData.tags ? shopifyData.tags.split(',').map(t => t.trim()) : [],
                syncStatus: 'synced',
                lastSyncDate: new Date()
            },
            auditTrail: [{
                action: 'CREATED_FROM_SHOPIFY',
                performedBy: 'SYSTEM',
                performedAt: new Date()
            }]
        });

        await newCustomer.save();
        return 'created';
    }
}
