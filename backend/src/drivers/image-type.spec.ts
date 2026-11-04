import { detectImageType } from './image-type.js';

describe('detectImageType', () => {
  it('recognises JPEG and PNG by their first bytes', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe('image/png');
  });

  it('refuses anything else, whatever it claims to be', () => {
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(Buffer.from('<html>'))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
