# 📦 Player Chest Module (`crafter.chest`)

Manages the web inventory where purchased or gifted items wait before being moved into the game. Covers sending an item to the in-game server (using it) and gifting it to another user.

---

## 📌 Methods and Usage Examples

### 1. `getItems(userId?)`
Lists the items in the user's chest.

* **HTTP Route:** `GET /chest/:userId`
* **Default parameter:** `'me'`
* **Returns:** `ChestItem[]`
  ```typescript
  interface ChestItem {
    id: string;
    product?: {
      id: string;
      name: string;
      server_id?: string;
    };
    used: boolean;      // Has the item been used?
    createdAt?: string;
    updatedAt?: string;
  }
  ```
* **Example usage:**
  ```javascript
  const items = await crafter.chest.getItems('me');

  // Active chest items that have not been used yet:
  const activeItems = items.filter(item => !item.used);
  console.log(`You have ${activeItems.length} unclaimed items in your chest.`);
  ```

---

### 2. `useItem(chestItemId, userId?)`
Uses an item in the chest to move it into the game (a command is sent to the server).

* **HTTP Route:** `POST /chest/:userId/use/:chestItemId`
* **Default parameter:** `userId = 'me'`
* **Returns:**
  ```json
  {
    "success": true,
    "message": "Item used and sent to the server.",
    "item": {
      "id": "item-uuid",
      "used": true,
      "updatedAt": "2026-09-01T12:00:00.000Z"
    }
  }
  ```
* **Example usage:**
  ```javascript
  try {
    const res = await crafter.chest.useItem('chest-item-123');
    alert('Your item was delivered in game!');
  } catch (err) {
    alert('Could not use the item: ' + err.message);
  }
  ```

---

### 3. `giftItem(targetUserId, chestItemId, fromUserId?)`
Moves an unused item in the chest to another player's chest as a gift.

* **HTTP Route:** `POST /chest/:from/gift/:to/:chestItemId`
* **Default parameter:** `fromUserId = 'me'`
* **Returns:**
  ```json
  {
    "success": true,
    "message": "Item gifted.",
    "newChestItem": {
      "id": "new-item-id",
      "used": false
    }
  }
  ```
* **Example usage:**
  ```javascript
  await crafter.chest.giftItem('@ArkadasiminAdi', 'chest-item-123');
  alert('The item was gifted to your friend!');
  ```
