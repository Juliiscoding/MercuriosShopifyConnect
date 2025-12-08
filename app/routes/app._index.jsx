import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  List,
  InlineStack,
  Badge,
  Banner,
  Modal,
  IndexTable,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { connectDB } from "../db.server";
import IdentityCustomer from "../models/IdentityCustomer";
import Voucher from "../models/Voucher";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  await connectDB();

  try {
    // 1. Stats
    const totalCustomers = await IdentityCustomer.countDocuments({
      'shopifyIntegration.syncStatus': 'synced'
    });

    const pendingCustomers = await IdentityCustomer.countDocuments({
      'shopifyIntegration.syncStatus': 'pending'
    });

    const totalVouchers = await Voucher.countDocuments({});

    const activeVouchers = await Voucher.countDocuments({
      status: 'active'
    });

    // 2. Data Lists (Latest 50)
    const customers = await IdentityCustomer.find({
      $or: [
        { 'shopifyIntegration.syncStatus': 'synced' },
        { 'shopifyIntegration.shopifyCustomerId': { $exists: true } }
      ]
    })
      .sort({ 'shopifyIntegration.lastSyncDate': -1 })
      .limit(50)
      .lean();

    const vouchers = await Voucher.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Transform for UI
    const customersSerialized = customers.map(c => ({
      id: c._id.toString(),
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
      email: c.email,
      shopifyStatus: c.shopifyIntegration?.syncStatus || 'pending',
      spent: c.shopifyIntegration?.totalSpent || '0.00',
      orders: c.shopifyIntegration?.ordersCount || 0
    }));

    const vouchersSerialized = vouchers.map(v => ({
      id: v._id.toString(),
      code: v.shopifyCode,
      amount: v.initialValue,
      status: v.status,
      customerName: v.customer ? `${v.customer.firstName || ''} ${v.customer.lastName || ''}`.trim() : 'Guest',
      createdAt: v.createdAt.toISOString()
    }));


    return {
      stats: {
        totalCustomers,
        pendingCustomers,
        totalVouchers,
        activeVouchers
      },
      customers: customersSerialized,
      vouchers: vouchersSerialized,
      status: 'ok',
      lastRefreshed: new Date().toISOString()
    };
  } catch (error) {
    console.error("Dashboard Loader Error:", error);
    return {
      stats: { totalCustomers: 0, pendingCustomers: 0, totalVouchers: 0, activeVouchers: 0 },
      customers: [],
      vouchers: [],
      status: 'error',
      message: error.message
    };
  }
};

export const action = async ({ request }) => {
  return null; // No actions yet
};

export default function Index() {
  const { stats, status, message, customers, vouchers, lastRefreshed } = useLoaderData();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();

  // 1. Auto-Refresh Logic (60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("🔄 Auto-refreshing dashboard data...");
      revalidator.revalidate();
    }, 60000);
    return () => clearInterval(interval);
  }, [revalidator]);

  // 2. Modal State
  const [activeCustomerModal, setActiveCustomerModal] = useState(false);
  const [activeVoucherModal, setActiveVoucherModal] = useState(false);

  // 3. Resource Lists State (for IndexTable)
  const customerResourceControl = useIndexResourceState(customers);
  const voucherResourceControl = useIndexResourceState(vouchers);

  // 4. Render Tables
  const customerTable = (
    <IndexTable
      resourceName={{ singular: 'customer', plural: 'customers' }}
      itemCount={customers.length}
      selectedItemsCount={customerResourceControl.selectedResources.length}
      onSelectionChange={customerResourceControl.handleSelectionChange}
      headings={[
        { title: 'Name' },
        { title: 'Email' },
        { title: 'Shopify Status' },
        { title: 'Total Spent' },
        { title: 'Orders' },
      ]}
    >
      {customers.map((customer, index) => (
        <IndexTable.Row
          id={customer.id}
          key={customer.id}
          selected={customerResourceControl.selectedResources.includes(customer.id)}
          position={index}
        >
          <IndexTable.Cell>{customer.name}</IndexTable.Cell>
          <IndexTable.Cell>{customer.email}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={customer.shopifyStatus === 'synced' ? 'success' : 'attention'}>
              {customer.shopifyStatus}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>€{customer.spent}</IndexTable.Cell>
          <IndexTable.Cell>{customer.orders}</IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );

  const voucherTable = (
    <IndexTable
      resourceName={{ singular: 'voucher', plural: 'vouchers' }}
      itemCount={vouchers.length}
      selectedItemsCount={voucherResourceControl.selectedResources.length}
      onSelectionChange={voucherResourceControl.handleSelectionChange}
      headings={[
        { title: 'Code' },
        { title: 'Amount' },
        { title: 'Status' },
        { title: 'Customer' },
        { title: 'Created At' },
      ]}
    >
      {vouchers.map((voucher, index) => (
        <IndexTable.Row
          id={voucher.id}
          key={voucher.id}
          selected={voucherResourceControl.selectedResources.includes(voucher.id)}
          position={index}
        >
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">{voucher.code}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>€{voucher.amount?.toFixed(2)}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={voucher.status === 'active' ? 'success' : 'subdued'}>
              {voucher.status}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>{voucher.customerName}</IndexTable.Cell>
          <IndexTable.Cell>{new Date(voucher.createdAt).toLocaleString('de-DE')}</IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );

  return (
    <Page>
      <TitleBar title="Mercurios Connect Dashboard" />
      <BlockStack gap="500">

        {status === 'error' && (
          <Banner title="System Error" tone="critical">
            <p>Could not load statistics: {message}</p>
          </Banner>
        )}

        {/* Refresh Indicator */}
        <Box paddingBlockEnd="200">
          <Text variant="bodyXs" tone="subdued">
            Last updated: {new Date(lastRefreshed).toLocaleTimeString()} (Auto-refresh: 60s)
          </Text>
        </Box>

        <Layout>

          {/* Customer Sync Stats with Modal Trigger */}
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Customer Synchronization
                  </Text>
                  <Button onClick={() => setActiveCustomerModal(true)} variant="plain">View All</Button>
                </InlineStack>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    Synchronized Customers (with Hyperlinked MongoDB):
                  </Text>
                  <Text variant="headingXl" as="p">
                    {stats.totalCustomers}
                  </Text>
                </BlockStack>

                <InlineStack gap="200">
                  <Badge tone="info">Pending: {stats.pendingCustomers}</Badge>
                  <Badge tone="success">Synced: {stats.totalCustomers}</Badge>
                </InlineStack>

              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Voucher Stats with Modal Trigger */}
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Vouchers (Pro Handel)
                  </Text>
                  <Button onClick={() => setActiveVoucherModal(true)} variant="plain">View All</Button>
                </InlineStack>

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    Total Vouchers Generated:
                  </Text>
                  <Text variant="headingXl" as="p">
                    {stats.totalVouchers}
                  </Text>
                </BlockStack>

                <InlineStack gap="200">
                  <Badge tone="success">Active: {stats.activeVouchers}</Badge>
                </InlineStack>

              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Info Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  System Integration Status
                </Text>
                <List type="bullet">
                  <List.Item>Connected to <b>MongoDB</b> (Hyperlinked)</List.Item>
                  <List.Item>Webhooks Active: <code>ORDERS_PAID</code>, <code>CUSTOMERS_UPDATE</code></List.Item>
                  <List.Item>Pro Handel API: <b>Ready</b></List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>

        </Layout>
      </BlockStack>

      {/* MODALS */}
      <Modal
        open={activeCustomerModal}
        onClose={() => setActiveCustomerModal(false)}
        title="Synchronized Customers"
        large
      >
        <Modal.Section>
          {customerTable}
        </Modal.Section>
      </Modal>

      <Modal
        open={activeVoucherModal}
        onClose={() => setActiveVoucherModal(false)}
        title="Generated Vouchers"
        large
      >
        <Modal.Section>
          {voucherTable}
        </Modal.Section>
      </Modal>

    </Page>
  );
}
