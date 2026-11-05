import { describe, expect, it } from 'vitest';
import { brands, cssVariableName, getTheme, palette, themeCssVariables } from './theme';

const HEX = /^#[0-9A-F]{6}$/;

describe('theme', () => {
  it('palette holds only 6-digit upper-case hex colours', () => {
    for (const value of Object.values(palette)) expect(value).toMatch(HEX);
  });

  it('every app gets the same roles, only the brand differs', () => {
    const passenger = getTheme('passenger').colors;
    const driver = getTheme('driver').colors;
    expect(Object.keys(passenger).sort()).toEqual(Object.keys(driver).sort());
    expect(passenger.brand).toBe(brands.passenger.brand);
    expect(driver.brand).toBe(brands.driver.brand);
    expect(passenger.text).toBe(driver.text);
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
