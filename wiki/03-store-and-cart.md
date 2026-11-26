# 🛒 Store & Cart Module (`crafter.store` & `crafter.cart`)

Handles listing the server's product catalogs, filtering by category, bulk discount settings for the cart and instant purchases from site balance.

---

## 📌 Store Module (`crafter.store`)

### 1. `getCategories()` & `getCategory(categoryId)`
Fetches all categories in the store or the details of a single category.

* **HTTP Route:** `GET /categories` & `GET /categories/:categoryId`
* **Returns:** `Category[]` (`id, name, slug, description, image, order`)
* **Example:**
  ```javascript
  const categories = await crafter.store.getCategories();
  categories.forEach(cat => {
    console.log(`[${cat.name}] - Slug: ${cat.slug}`);
  });
  ```

---

### 2. `getProducts()` & `getProduct(productId)`
Fetches all products in the store or the details of a single product.

* **HTTP Route:** `GET /products` & `GET /products/:productId`
* **Returns:** `Product[]`
  ```typescript
  interface Product {
    id: string;
    name: string;
    slug?: string;
    price: number;
    discountPrice?: number;
    category: string;       // Category ID
    server_id: string;      // ID of the server it belongs to
    images: string[];       // Array of product images
    stock: number;          // Remaining stock (-1 unlimited)
    discountType?: 'percentage' | 'fixed' | null;
    discountValue?: number;
    server_commands?: string[];
    description?: string;
  }
  ```
* **Example:**
  ```javascript
  const products = await crafter.store.getProducts();
  const firstProduct = products[0];
  console.log(`${firstProduct.name} - Price: ${firstProduct.price}`);
  ```

---

### 3. `getProductsByCategory(categoryId)`
Filters the products of a specific category.

* **HTTP Route:** `GET /products/by-category/:categoryId`
* **Example:**
  ```javascript
  const vips = await crafter.store.getProductsByCategory('vip-category-id');
  ```

---

### 4. `getConfig()` (Bulk Discount)
Fetches the general settings the admin set for the store and the active **bulk discount in the cart** rules.

* **HTTP Route:** `GET /config/marketplace`
* **Returns:**
  ```typescript
  interface MarketplaceConfig {
    bulkDiscount?: {
      type: 'percentage' | 'fixed';
      amount: number;       // e.g. 20 for 20%
      expireDate?: string;  // Date the discount ends
      products?: string[];  // Product IDs the discount applies to (all if empty)
    } | null;
  }
  ```
* **Example:**
  ```javascript
  const config = await crafter.store.getConfig();
  if (config.bulkDiscount) {
    console.log(`${config.bulkDiscount.amount}% cart discount campaign is active!`);
  }
  ```

---

## 🛍️ Cart & Purchase (`crafter.cart` / `crafter.marketplace`)

### Cart contents and where they are kept (#447, #434)
`get()`, `add(product, qty?)`, `update(id, qty)`, `remove(id)`, `clear()`, `setCoupon(code)`, `removeCoupon()` all
`get()`, `add(product, qty?)`, `update(id, qty)`, `remove(id)`, `clear()`, `setCoupon(code)`, `removeCoupon()` hepsi
return `CartState`: `items`, `itemCount`, `subtotal`, `discount` (coupon discount), `total` (`subtotal - discount`; all in
the store currency), `currency`, `coupon`, `couponDetails`; the storefront cart also has `removed[]` (products taken off sale /
sold out), `adjusted[]` (quantities reduced to match stock) and `couponRemoved` (a coupon that became invalid and was dropped). Every
change emits `crafter:cart:updated`.

- **Inside the storefront** (if the page context has `routes.cartApi`, SDK 1.5.0+): the cart lives on the storefront's `/cart.js`,
  `/cart/add.js`, `/cart/change.js`, `/cart/clear.js`, `/cart/coupon.js` endpoints. For a visitor it is kept in a signed `httpOnly`
  cookie, merged into the account on login/sign-up, and stays the same across devices. No price is sent; the server calculates it from the current product
  (`add({ id })` is enough). The localStorage cart (`cart`: v1 theme, old SDK) is synced with the server cart once per page, before the
  first operation (1.5.2+): the last synced state is in the `crafter_cart_synced` record; a line added or whose quantity changed after
  that is set to that quantity on the server (not added), a line removed from `cart` is dropped on the server too, and unchanged
  lines are not sent. The new selection is not lost even if the server cart is not empty; running again does not double quantities. Across tabs
  it is updated with the `crafter_cart_sync` signal. Errors: `CrafterError` (`409 cart_product_unavailable`, `422 cart_full`,
  `503 cart_unavailable`).
- **Headless** (no context): localStorage `cart` / `crafter_cart_coupon`; the price is the value passed to `add()`.

```js
try {
  const cart = await crafter.cart.add({ id: 'prod_123' }, 2);
  if (cart.adjusted?.length) console.log('Added up to the available stock');
} catch (error) {
  if (error.type === 'cart_product_unavailable') alert('This product cannot be purchased right now');
}
```

### Coupon (#476, SDK 1.5.1+)

In the storefront cart `setCoupon(code)` validates the coupon on the server right away. If valid, the returned cart has `discount`, `total` and
`couponDetails` (`code`, `type`: `'percentage' | 'fixed' | 'free_product'`, `value`, `freeProductId`) filled. If invalid,
a `CrafterCouponError` is thrown (HTTP 422): `type` is a `CouponErrorType` code, `message` is in the page language and can be shown
directly, and for `coupon_cart_total_below_minimum` the `minCartValue` (`details.minCartValue`) is included. A rejected coupon
is not written to the cart, the cart does not change and no event is emitted. `removeCoupon()` (or `setCoupon(null)` / an empty code) removes the coupon.

If a stored coupon later becomes invalid (e.g. a product was removed and the total fell below the minimum), the server drops the coupon and
reports `couponRemoved: { code, reason }` once in the cart; `reason` uses the same `CouponErrorType` codes. An old localStorage coupon
(`crafter_cart_coupon`) is also moved to the cart only if the server accepts it; if rejected, the lines are kept, the coupon
is dropped and `couponRemoved` is reported.

Coupon error codes (`CouponErrorType`): `coupon_not_found`, `coupon_inactive`, `coupon_usage_limit_reached`,
`coupon_already_used_by_user`, `coupon_not_assigned_to_user`, `coupon_cart_total_below_minimum`,
`coupon_invalid_for_product`, `coupon_invalid_type`.

```js
import { isCouponError } from '@crafter-cms/sdk';

try {
  const cart = await crafter.cart.setCoupon(input.value);
  showTotals(crafter.money.format(cart.discount), crafter.money.format(cart.total));
} catch (error) {
  if (isCouponError(error)) showCouponError(error.message); // in the page language
  else throw error;
}

crafter.dom.on('cart:updated', (cart) => {
  if (cart.couponRemoved) notify(`The ${cart.couponRemoved.code} coupon is no longer valid`);
});
```

The localStorage cart (headless) cannot validate coupons: it stores the code; `discount` is always 0, `total` = `subtotal`,
`couponDetails` is null. Checkout calculates the discount.

### 5. `purchase(data)` (Purchase with Balance)
Lets the user buy the products in their cart using their site balance.

* **HTTP Route:** `POST /marketplace/purchase`
* **Input:**
  ```typescript
  interface PurchaseDto {
    productIds: string[];   // ID array of the products to buy
    coupon?: string;        // Optional discount coupon code (or couponCode)
  }
  ```
* **Returns:**
  ```json
  {
    "success": true,
    "message": "Products purchased successfully",
    "type": "success"
  }
  ```
* **Example usage:**
  ```javascript
  try {
    const res = await crafter.cart.purchase({
      productIds: ['prod-uuid-1', 'prod-uuid-2'],
      coupon: 'SUMMER2026' // Optional coupon code
    });

    alert(res.message);
    // Update the balance after the purchase:
    const balance = await crafter.users.getBalance('me');
    document.querySelector('#user-balance').innerText = balance.balance;
  } catch (err) {
    // e.g. on insufficient balance (HTTP 400):
    alert('Purchase failed: ' + err.message);
  }
  ```
