# Notification Templates

This directory contains email and SMS templates for the Hardware Pasal marketplace.

## Email Templates (`email/`)

| Template | Purpose | Variables |
|----------|---------|-----------|
| `order_confirmed.html` | Customer order confirmed | `customer_name`, `order_id_short`, `shop_name`, `items[]`, `total`, `address_line`, `city`, `district`, `province`, `order_tracking_url` |
| `order_shipped.html` | Order shipped with rider info | `customer_name`, `order_id_short`, `rider_name`, `rider_phone`, `rider_vehicle_type`, `rider_vehicle_number`, `estimated_delivery`, `order_tracking_url` |
| `order_delivered.html` | Order delivered + review request | `customer_name`, `order_id_short`, `review_url` |
| `order_cancelled.html` | Order cancelled with refund info | `customer_name`, `order_id_short`, `cancellation_reason`, `refund_amount`, `shop_url` |
| `admin_new_order.html` | Admin alert for new order | `order_id_short`, `customer_name`, `customer_phone`, `shop_name`, `total`, `payment_method`, `created_at`, `admin_order_url` |
| `vendor_approved.html` | Vendor shop approved | `shop_owner_name`, `shop_name`, `vendor_dashboard_url` |
| `vendor_rejected.html` | Vendor shop rejected | `shop_owner_name`, `shop_name`, `rejection_reason` |

## SMS Templates (`sms/`)

| Template | Purpose | Variables |
|----------|---------|-----------|
| `order_confirmed.txt` | Order confirmed (160 chars) | `order_id_short`, `shop_name`, `total`, `tracking_url` |
| `order_shipped.txt` | Order shipped with rider | `order_id_short`, `rider_name`, `rider_phone`, `tracking_url`, `estimated_delivery` |
| `order_delivered.txt` | Delivered + review | `order_id_short`, `review_url` |
| `order_cancelled.txt` | Cancelled with refund | `order_id_short`, `cancellation_reason`, `refund_amount` |
| `rider_new_assignment.txt` | New delivery for rider | `order_id_short`, `shop_name`, `customer_area`, `pickup_time`, `rider_app_url` |

## Usage

Templates use Handlebars-style `{{variable}}` syntax. Replace with your templating engine of choice (Handlebars, Mustache, etc.).

### Example (Node.js with Handlebars):
```javascript
const fs = require('fs');
const handlebars = require('handlebars');

const template = fs.readFileSync('templates/email/order_confirmed.html', 'utf8');
const compiled = handlebars.compile(template);

const html = compiled({
  customer_name: 'John Doe',
  order_id_short: 'ORD-1234',
  shop_name: 'Kathmandu Hardware',
  items: [{ name: 'Drill Machine', quantity: 1, price: '8500' }],
  total: '9605',
  address_line: 'Baluwatar',
  city: 'Kathmandu',
  district: 'Kathmandu',
  province: 'Bagmati',
  order_tracking_url: 'https://hardwarepasal.com/orders/ORD-1234'
});
```

## Integration Points

These templates should be called from:
- **Server Actions** (`src/actions/admin/orders.ts`, `shops.ts`, etc.)
- **Database Triggers** (PostgreSQL functions for real-time notifications)
- **Edge Functions** (for async email/SMS sending via providers like SendGrid, Twilio)

## Required Environment Variables

For production, configure in Supabase Dashboard or `.env`:
- `SENDGRID_API_KEY` or `RESEND_API_KEY` (email)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` (SMS)
- `SITE_URL` (for generating links)
