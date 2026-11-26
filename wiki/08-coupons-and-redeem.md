# 🎟️ Coupons & Gift Codes (`crafter.coupons` & `crafter.redeemCode`)

Handles discount coupon lookups, cart discount checks and redeeming promotion / gift cards.

---

## 📌 Coupon Module (`crafter.coupons`)

### 1. `get(couponCode)`
Checks whether the discount coupon the user entered on the cart page is valid, the discount amount and the cart restrictions.

* **HTTP Route:** `GET /coupons/:couponCode`
* **Returns:** `CouponResponse`
  ```typescript
  interface CouponResponse {
    id?: string;
    code: string;
    minCartValue?: number;              // Minimum cart total requirement
    productId?: string | null;          // Only valid for a specific product?
    discountValue: number;              // Discount amount (e.g. 20)
    discountType: 'percentage' | 'fixed'; // Percentage or fixed amount?
    isActive: boolean;
  }
  ```
* **Example usage:**
  ```javascript
  try {
    const { currency } = await crafter.website.getInfo(); // store currency
    const coupon = await crafter.coupons.get('BAHAR2026');
    if (coupon.isActive) {
      if (coupon.discountType === 'percentage') {
        console.log(`${coupon.discountValue}% discount applied!`);
      } else {
        console.log(`${Crafter.utils.formatMoney(coupon.discountValue, currency)} discount applied!`);
      }
    }
  } catch (err) {
    alert('Invalid or expired coupon code!');
  }
  ```

---

## 🎁 Gift / Promotion Codes (`crafter.redeemCode`)

Redeems single-use codes that grant a bonus or products, which admins hand out in giveaways or YouTube sponsorships.

### 2. `use(code)`
* **HTTP Route:** `POST /redeem-codes/use`
* **Input:** `{ code: string }`
* **Returns:**
  ```typescript
  interface UseRedeemCodeResponse {
    bonus?: number;       // Balance/credit amount added
    products?: Array<{    // Gift products added to the chest
      id: string;
      name: string;
    }>;
    success?: boolean;
    message?: string;
  }
  ```
* **Example usage:**
  ```javascript
  try {
    const res = await crafter.redeemCode.use('YOUTUBE-BONUS-100');
    if (res.bonus) {
      const { currency } = await crafter.website.getInfo(); // balance is in the store currency
      alert(`Congratulations! ${Crafter.utils.formatMoney(res.bonus, currency)} was added to your balance.`);
    }
    if (res.products?.length) {
      alert(`Congratulations! ${res.products.map(p => p.name).join(', ')} added to your chest.`);
    }
  } catch (err) {
    alert('Could not use the code: ' + err.message);
  }
  ```
