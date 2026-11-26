import type { Appearance } from './types';

type Variables = NonNullable<Appearance['variables']>;

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%\s,/]+\)|hsla?\(\s*[\d.%\s,/deg]+\)|transparent)$/;
const LENGTH = /^(0|\d{1,3}(\.\d{1,3})?(px|rem|em))$/;
const FONT = /^[A-Za-z0-9 ,'"_-]{1,120}$/;
const WEIGHT = /^(normal|bold|[1-9]00)$/;

const RULES: { [K in keyof Variables]-?: RegExp } = {
  colorPrimary: COLOR,
  colorBackground: COLOR,
  colorText: COLOR,
  colorTextSecondary: COLOR,
  colorTextPlaceholder: COLOR,
  colorDanger: COLOR,
  colorBorder: COLOR,
  colorFocusRing: COLOR,
  fontFamily: FONT,
  fontSizeBase: LENGTH,
  fontWeightNormal: WEIGHT,
  borderRadius: LENGTH,
  borderWidth: LENGTH,
  spacingUnit: LENGTH,
};

/**
 * Görünüm token'larını doğrular: yalnızca bilinen anahtarlar ve güvenli değer biçimleri geçer (serbest CSS yok,
 * `url(`, `;`, `}` gibi kaçış imkânı yok). Asıl uygulama ve son doğrulama checkout sayfasındadır.
 */
export function sanitizeAppearance(input: Appearance | undefined): Appearance | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Appearance = {};
  if (input.theme === 'light' || input.theme === 'dark' || input.theme === 'auto') out.theme = input.theme;
  if (typeof input.showCardBrandIcon === 'boolean') out.showCardBrandIcon = input.showCardBrandIcon;
  if (input.variables && typeof input.variables === 'object') {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.variables)) {
      const rule = (RULES as Record<string, RegExp>)[key];
      if (rule && typeof value === 'string' && rule.test(value.trim())) {
        vars[key] = value.trim();
      } else {
        console.warn(`[CrafterPayments] appearance.variables.${key} ignored (unknown key or invalid value).`);
      }
    }
    if (Object.keys(vars).length) out.variables = vars as Variables;
  }
  return Object.keys(out).length ? out : undefined;
}
