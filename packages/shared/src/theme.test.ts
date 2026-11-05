import { describe, expect, it } from 'vitest';
import {
  brands,
  cssVariableName,
  fontSize,
  fontWeight,
  getTheme,
  palette,
  SPACE_UNIT,
  space,
  spaceVariableName,
  themeCssVariables,
} from './theme';

const HEX = /^#[0-9A-F]{6}$/;

describe('theme', () => {
  it('palette holds only 6-digit upper-case hex colours', () => {
    for (const value of Object.values(palette)) expect(value).toMatch(HEX);
  });

  it('every app gets the same roles, only the brand differs', () => {
    const mobile = getTheme('mobile').colors;
    const admin = getTheme('admin').colors;
    expect(Object.keys(mobile).sort()).toEqual(Object.keys(admin).sort());
    expect(mobile.brand).toBe(brands.mobile.brand);
    expect(admin.brand).toBe(brands.admin.brand);
    expect(mobile.text).toBe(admin.text);
  });

  it('names CSS variables in kebab-case', () => {
    expect(cssVariableName('brand')).toBe('--brand');
    expect(cssVariableName('brandSoft')).toBe('--brand-soft');
    expect(cssVariableName('errorSoftStrong')).toBe('--error-soft-strong');
  });

  it('writes a :root block with colours and corner sizes', () => {
    const css = themeCssVariables('admin');
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain(`--brand: ${brands.admin.brand};`);
    expect(css).toContain('--surface: #FFFFFF;');
    expect(css).toContain('--radius-lg: 12px;');
  });
});

describe('theme: text, spacing and sizes', () => {
  it('every spacing step is a multiple of the space unit', () => {
    for (const [key, value] of Object.entries(space)) expect(value).toBe(Number(key) * SPACE_UNIT);
    expect(space[4]).toBe(16);
  });

  it('font sizes grow with the scale order', () => {
    const values = Object.values(fontSize);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it('font weights are strings (React Native only accepts strings)', () => {
    for (const value of Object.values(fontWeight)) expect(typeof value).toBe('string');
  });

  it('names spacing CSS variables without dots', () => {
    expect(spaceVariableName(0.5)).toBe('--space-0-5');
    expect(spaceVariableName('4')).toBe('--space-4');
  });

  it('puts text, spacing, borders and opacity in the CSS block', () => {
    const css = themeCssVariables('admin');
    expect(css).toContain('--font-size-base: 15px;');
    expect(css).toContain('--font-size-amount-large: 36px;');
    expect(css).toContain('--font-weight-semibold: 600;');
    expect(css).toContain('--font-weight-extra-bold: 800;');
    expect(css).toContain("--font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;");
    expect(css).toContain('--space-0-5: 2px;');
    expect(css).toContain('--space-20: 80px;');
    expect(css).toContain('--border-width-thin: 1px;');
    expect(css).toContain('--opacity-disabled: 0.5;');
  });
});
