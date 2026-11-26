# 📜 Legal Documents & Reports (`crafter.legal` & `crafter.reports`)

Handles the terms of use, rules, privacy policy and players reporting rule violations to the staff.

---

## 📌 Hukuki Belgeler (`crafter.legal`)

### 1. `getDocuments()`
Fetches the server rules, privacy policy and user agreement the admin entered in the panel, in a single object.

* **HTTP Route:** `GET /config/legal`
* **Returns:**
  ```typescript
  interface LegalDocuments {
    rules?: string;             // Server & site rules, HTML/Markdown
    privacy_policy?: string;    // Privacy policy
    terms_of_service?: string;  // Terms of service
  }
  ```
* **Example usage:**
  ```javascript
  const docs = await crafter.legal.getDocuments();

  if (docs.rules) {
    document.querySelector('#server-rules').innerHTML = docs.rules;
  }
  ```

---

## 🚨 Reports Module (`crafter.reports`)

Lets users report players who cheat, swear or break the rules to the staff.

### 2. `create(reportedUserId, data)`
* **HTTP Route:** `POST /reports/:reportedUserId`
* **Input:**
  ```typescript
  interface CreateReportDto {
    reportType: 'spam' | 'harassment' | 'inappropriate_content' | 'fraud' | 'other';
    reason: string; // Report description
  }
  ```
* **Returns:**
  ```typescript
  interface ReportResponse {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reportType: string;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed';
    createdAt: string;
  }
  ```
* **Example usage:**
  ```javascript
  try {
    const report = await crafter.reports.create('player-uuid', {
      reportType: 'harassment',
      reason: 'Insulted other players in the in-game chat.'
    });

    alert('Your report was sent to the staff team. Ticket no: #' + report.id.slice(0, 6));
  } catch (err) {
    alert('Could not send the report: ' + err.message);
  }
  ```
