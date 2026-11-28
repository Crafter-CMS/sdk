/** Tiny HTML helpers. Everything that comes from Crafter or the request is escaped. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tagged template: interpolated values are escaped unless wrapped with raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, chunk, index) => {
    if (index === 0) return chunk;
    const value = values[index - 1];
    const text = Array.isArray(value)
      ? value.map((item) => (item?.__raw ? item.value : escapeHtml(item))).join('')
      : value?.__raw
        ? value.value
        : escapeHtml(value);
    return out + text + chunk;
  }, '');
}

export const raw = (value) => ({ __raw: true, value: String(value) });

export function page(title, body) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; color: #1f2328; background: #fff; }
  main { max-width: 760px; margin: 0 auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
  .muted { color: #6b7280; }
  .error { color: #b42318; }
</style>
</head>
<body><main>${raw(body)}</main></body>
</html>`;
}

export function ordersTable(orders) {
  if (!orders.length) return html`<p class="muted">No orders yet.</p>`;
  return html`<table>
<thead><tr><th>Number</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead>
<tbody>${orders.map((order) =>
    raw(html`<tr><td>${order.number}</td><td>${order.status}</td><td>${order.amount} ${order.currency}</td><td>${order.createdAt}</td></tr>`),
  )}</tbody>
</table>`;
}
