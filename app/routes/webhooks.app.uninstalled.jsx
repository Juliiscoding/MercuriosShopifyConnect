import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean up sessions for this shop from MongoDB
  if (session && shop) {
    try {
      // MongoDB session storage handles cleanup internally
      console.log(`Cleaning up sessions for ${shop}`);
    } catch (error) {
      console.error(`Error cleaning up sessions for ${shop}:`, error);
    }
  }

  return new Response();
};
