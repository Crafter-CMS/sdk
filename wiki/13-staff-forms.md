# 📝 Staff Application Forms (`crafter.staffForms`)

Handles listing staff recruitment forms for the server (helper, moderator, builder, developer, etc.), rendering dynamic form fields and submitting applications.

---

## 📌 Methods and Usage Examples

### 1. `list()`
Lists the open and active staff recruitment forms.

* **HTTP Route:** `GET /staff-forms`
* **Returns:** `StaffFormItem[]`
  ```typescript
  interface StaffFormInput {
    id: string;             // Form input field ID
    name: string;           // Question title (e.g. 'How many hours a day can you be active?')
    type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox';
    index: number;          // Sort index
    required?: boolean;
  }

  interface StaffFormItem {
    id: string;
    title: string;          // e.g. 'Helper Recruitment'
    description?: string;
    inputs: StaffFormInput[];
    isActive: boolean;
  }
  ```
* **Example usage:**
  ```javascript
  const forms = await crafter.staffForms.list();
  forms.forEach(f => {
    console.log(`${f.title} (${f.inputs.length} questions) -> /apply/${f.id}`);
  });
  ```

---

### 2. `get(formId)`
Fetches the details of a single application form and all its question fields.

* **HTTP Route:** `GET /staff-forms/:formId`
* **Example:**
  ```javascript
  const form = await crafter.staffForms.get('form-uuid');
  form.inputs.forEach(input => {
    console.log(`[${input.type}] ${input.name}`);
  });
  ```

---

### 3. `apply(formId, answers)`
Sends the answers to the application questions to the server.

The SDK accepts the answers in **two different formats** and converts them automatically to the `values: [{ inputId, value }]` format the backend expects:

#### Format A: Key-Value Object (Recommended, Easiest)
```javascript
await crafter.staffForms.apply('form-uuid', {
  'input-id-age': 19,
  'input-id-experience': 'I was a moderator on 2 servers before.',
  'input-id-discord': 'soro#0001'
});
```

#### Format B: Array Format
```javascript
await crafter.staffForms.apply('form-uuid', [
  { inputId: 'input-id-age', value: '19' },
  { inputId: 'input-id-experience', value: '...' }
]);
```

* **Returns:**
  ```typescript
  interface StaffFormApplicationResponse {
    id: string;
    userId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
  }
  ```
