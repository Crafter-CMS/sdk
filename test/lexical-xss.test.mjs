// lexicalToHtml injection tests. Tests the built package (dist): `npm test` builds first.
// Zero dependencies: node:test. Every payload is a synthetic attack string; none of them may survive into the output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lexicalToHtml } from '../dist/index.mjs';

const text = (t, extra = {}) => ({ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1, ...extra });
const doc = (...children) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children } });
const para = (...children) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children });
const link = (url, extra = {}) => para({ type: 'link', url, version: 1, children: [text('x')], ...extra });
const image = (src, extra = {}) => para({ type: 'image', src, altText: 'a', version: 1, ...extra });

const hrefOf = (html) => html.match(/<a href="([^"]*)"/)?.[1];
const srcOf = (html) => html.match(/<img src="([^"]*)"/)?.[1];

// Strings that must never appear in output, whatever the payload
const FORBIDDEN = [/javascript:/i, /vbscript:/i, /data:/i, /<script/i, /expression\(/i, /url\(/i];
function assertClean(html) {
  for (const re of FORBIDDEN) assert.doesNotMatch(html, re, `output contains ${re}: ${html}`);
  // Escaped text inside a quoted attribute value is harmless; outside of values no event handler may appear
  const outsideValues = html.replace(/="[^"]*"/g, '=""');
  assert.doesNotMatch(outsideValues, /\son[a-z]+\s*=/i, `event handler attribute in: ${html}`);
  assert.doesNotMatch(outsideValues, /<(?!\/?(p|a|img|h[1-6]|ul|ol|li|span|strong|em|s|u|code|pre|sub|sup|mark|blockquote|table|tbody|tr|td|th|div|hr|br|input)[\s>/])/i, `unexpected tag in: ${html}`);
}

// ---------------- Link href payloads (rendered as href="#") ----------------
const BLOCKED_LINKS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'JAVASCRIPT:alert(1)',
  ' javascript:alert(1)',
  '\tjavascript:alert(1)',
  '\njavascript:alert(1)',
  '\u0000javascript:alert(1)',
  '\u0001\u0002javascript:alert(1)',
  ' javascript:alert(1)',
  '﻿javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'java\rscript:alert(1)',
  'javascript&#58;alert(1)',
  'javascript&#x3a;alert(1)',
  'javascript&#X3A;alert(1)',
  'javascript&#0000058alert(1)',
  'javascript&colon;alert(1)',
  'javascript&amp;#58;alert(1)',
  '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)',
  '&#x6A;avascript:alert(1)',
  'javascript%3Aalert(1)',
  'javascript:/*--></title></style></textarea></script><svg/onload=alert(1)>',
  'vbscript:msgbox(1)',
  'VBScript:msgbox(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'DATA:text/html,<script>alert(1)</script>',
  ' data:text/html,x',
  'file:///etc/passwd',
  'blob:https://example.com/uuid',
  'livescript:alert(1)',
];

for (const payload of BLOCKED_LINKS) {
  test(`link: blocks ${JSON.stringify(payload)}`, () => {
    const html = lexicalToHtml(doc(link(payload)));
    assert.equal(hrefOf(html), '#');
    assertClean(html);
  });
}

// ---------------- Link href values that must keep working ----------------
const ALLOWED_LINKS = [
  ['https://example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
  ['http://example.com', 'http://example.com'],
  ['HTTPS://EXAMPLE.COM', 'HTTPS://EXAMPLE.COM'],
  ['  https://example.com  ', 'https://example.com'],
  ['mailto:hello@example.com', 'mailto:hello@example.com'],
  ['tel:+905551112233', 'tel:+905551112233'],
  ['/products/shoe', '/products/shoe'],
  ['products/shoe', 'products/shoe'],
  ['./a', './a'],
  ['../a', '../a'],
  ['#reviews', '#reviews'],
  ['?page=2', '?page=2'],
  ['//cdn.example.com/x', '//cdn.example.com/x'],
  ['/search?q=a:b', '/search?q=a:b'],
  ['https://example.com/?q="><script>', 'https://example.com/?q=&quot;&gt;&lt;script&gt;'],
];

for (const [input, expected] of ALLOWED_LINKS) {
  test(`link: keeps ${JSON.stringify(input)}`, () => {
    assert.equal(hrefOf(lexicalToHtml(doc(link(input)))), expected);
  });
}

test('link: non-string or empty url falls back to #', () => {
  for (const url of [undefined, null, '', '   ', 42, { toString: () => 'javascript:alert(1)' }, ['javascript:alert(1)']]) {
    assert.equal(hrefOf(lexicalToHtml(doc(link(url)))), '#');
  }
});

test('link: autolink nodes are sanitized too', () => {
  const html = lexicalToHtml(doc(para({ type: 'autolink', url: 'javascript:alert(1)', version: 1, children: [text('x')] })));
  assert.equal(hrefOf(html), '#');
});

test('link: target=_blank always gets rel="noopener noreferrer"', () => {
  assert.match(lexicalToHtml(doc(link('https://a.com', { target: '_blank' }))), /target="_blank" rel="noopener noreferrer"/);
  assert.match(lexicalToHtml(doc(link('https://a.com', { target: '_BLANK', rel: 'nofollow' }))), /target="_blank" rel="nofollow noopener noreferrer"/);
  assert.match(lexicalToHtml(doc(link('https://a.com', { target: '_blank', rel: 'noopener' }))), /rel="noopener noreferrer"/);
});

test('link: target and rel cannot inject attributes', () => {
  const html = lexicalToHtml(doc(link('https://a.com', { target: '_blank" onclick="alert(1)', rel: 'x" onmouseover="alert(1)', title: '" onfocus="alert(1)' })));
  assertClean(html);
  assert.doesNotMatch(html, /target=/);
  assert.match(html, /title="&quot; onfocus=&quot;alert\(1\)"/);
});

test('link: unknown target is dropped', () => {
  assert.doesNotMatch(lexicalToHtml(doc(link('https://a.com', { target: 'evilframe' }))), /target=/);
});

// ---------------- Image src ----------------
const BLOCKED_IMAGES = [
  'javascript:alert(1)',
  ' JaVaScRiPt:alert(1)',
  'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'javascript&#58;alert(1)',
  'mailto:a@b.c',
  '',
  null,
];

for (const payload of BLOCKED_IMAGES) {
  test(`image: drops ${JSON.stringify(payload)}`, () => {
    const html = lexicalToHtml(doc(image(payload)));
    assert.equal(srcOf(html), undefined);
    assertClean(html);
  });
}

test('image: quotes in src stay inside the attribute', () => {
  const html = lexicalToHtml(doc(image('x" onerror="alert(1)')));
  assertClean(html);
  assert.equal(srcOf(html), 'x&quot; onerror=&quot;alert(1)');
});

test('image: keeps http(s) and relative src', () => {
  assert.equal(srcOf(lexicalToHtml(doc(image('https://cdn.example.com/a.jpg')))), 'https://cdn.example.com/a.jpg');
  assert.equal(srcOf(lexicalToHtml(doc(image('/uploads/a.jpg')))), '/uploads/a.jpg');
});

test('image: width/height/alt cannot inject attributes', () => {
  const html = lexicalToHtml(doc(image('https://a.com/a.jpg', { width: '1" onerror="alert(1)', height: '2 onload=alert(1)', altText: '" onerror="alert(1)' })));
  assertClean(html);
  assert.doesNotMatch(html, /width=|height=/);
  const ok = lexicalToHtml(doc(image('https://a.com/a.jpg', { width: 300, height: '200' })));
  assert.match(ok, /width="300" height="200"/);
});

// ---------------- Other attribute / tag injection points ----------------
test('heading: tag must be h1-h6', () => {
  for (const tag of ['script', 'img src=x onerror=alert(1)', 'h1 onclick=alert(1)', 'iframe']) {
    const html = lexicalToHtml(doc({ type: 'heading', tag, version: 1, children: [text('t')] }));
    assert.match(html, /^<h2[ >]/);
    assertClean(html);
  }
  assert.match(lexicalToHtml(doc({ type: 'heading', tag: 'h3', version: 1, children: [text('t')] })), /^<h3[ >]/);
});

test('direction: only ltr/rtl', () => {
  const html = lexicalToHtml(doc({ ...para(text('t')), direction: 'ltr" onmouseover="alert(1)' }));
  assertClean(html);
  assert.doesNotMatch(html, /dir=/);
  assert.match(lexicalToHtml(doc({ ...para(text('t')), direction: 'rtl' })), /dir="rtl"/);
});

test('list: start must be an integer', () => {
  const html = lexicalToHtml(doc({ type: 'list', listType: 'number', start: '2" onclick="alert(1)', version: 1, children: [] }));
  assertClean(html);
  assert.doesNotMatch(html, /start=/);
  assert.match(lexicalToHtml(doc({ type: 'list', listType: 'number', start: 3, version: 1, children: [] })), /start="3"/);
});

test('indent: must be a number', () => {
  const html = lexicalToHtml(doc({ ...para(text('t')), indent: '1px; background:url(javascript:alert(1))' }));
  assertClean(html);
  assert.doesNotMatch(html, /padding-left/);
});

test('table cell: backgroundColor and spans cannot inject', () => {
  const cell = (extra) => doc({ type: 'table', version: 1, children: [{ type: 'tablerow', version: 1, children: [{ type: 'tablecell', version: 1, children: [], ...extra }] }] });
  for (const backgroundColor of ['red" onmouseover="alert(1)', 'url(javascript:alert(1))', 'red; position: fixed', 'expression(alert(1))']) {
    const html = lexicalToHtml(cell({ backgroundColor }));
    assertClean(html);
    assert.doesNotMatch(html, /style=/);
  }
  assert.match(lexicalToHtml(cell({ backgroundColor: '#f2f3f5' })), /style="background-color: #f2f3f5;"/);
  assert.match(lexicalToHtml(cell({ backgroundColor: 'rgb(1, 2, 3)' })), /background-color: rgb\(1, 2, 3\)/);
  const spans = lexicalToHtml(cell({ colSpan: '2" onclick="alert(1)', rowSpan: 3 }));
  assertClean(spans);
  assert.doesNotMatch(spans, /colspan=/);
  assert.match(spans, /rowspan="3"/);
});

test('code block: language cannot inject', () => {
  const html = lexicalToHtml(doc({ type: 'code', language: 'js" onclick="alert(1)', version: 1, children: [text('<script>alert(1)</script>')] }));
  assertClean(html);
  assert.doesNotMatch(html, /language-/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(lexicalToHtml(doc({ type: 'code', language: 'typescript', version: 1, children: [] })), /class="language-typescript"/);
});

// ---------------- Text and inline style ----------------
test('text: HTML is escaped', () => {
  const html = lexicalToHtml(doc(para(text('<img src=x onerror=alert(1)>"\'&'))));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&#039;&amp;/);
  assert.doesNotMatch(html, /<img/);
});

test('text: dangerous inline style declarations are dropped', () => {
  const payloads = [
    'background-image: url(javascript:alert(1))',
    'background: url(https://evil.com/track.png)',
    'width: expression(alert(1))',
    'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999',
    'color: red" onmouseover="alert(1)',
    'color: \\72 ed',
    'color: red; /* */ behavior: url(x.htc)',
    '-moz-binding: url(http://evil/xbl)',
  ];
  for (const style of payloads) {
    const html = lexicalToHtml(doc(para(text('t', { style }))));
    assertClean(html);
    assert.doesNotMatch(html, /position|z-index|behavior|binding|background-image/);
  }
});

test('text: editor styles are kept', () => {
  const html = lexicalToHtml(doc(para(text('t', { style: 'color: #ff0000; font-size: 18px; background-color: rgb(255, 255, 0); font-family: Arial, sans-serif' }))));
  assert.match(html, /<span style="color: #ff0000; font-size: 18px; background-color: rgb\(255, 255, 0\); font-family: Arial, sans-serif">t<\/span>/);
});

test('raw / unknown nodes never emit raw HTML', () => {
  const html = lexicalToHtml(doc({ type: 'html', html: '<script>alert(1)</script>', text: '<script>alert(2)</script>', version: 1 }));
  assertClean(html);
  assert.equal(html, '&lt;script&gt;alert(2)&lt;/script&gt;');
  assert.equal(lexicalToHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('a JSON string input is sanitized the same way', () => {
  const html = lexicalToHtml(JSON.stringify(doc(link('javascript:alert(1)'))));
  assert.equal(hrefOf(html), '#');
});
