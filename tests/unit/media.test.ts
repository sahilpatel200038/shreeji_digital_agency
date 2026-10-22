import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MediaError, MAX_UPLOAD_BYTES, processImage } from "@/lib/media/process";

const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#053620" } }).png().toBuffer();

describe("processImage (upload validation)", () => {
  it("accepts a real PNG and re-encodes to WebP", async () => {
    const r = await processImage(await png());
    expect(r.mimeType).toBe("image/webp");
    expect(r.width).toBe(40);
    expect(r.height).toBe(30);
    expect(r.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not trust file names: text renamed to .png is rejected", async () => {
    await expect(processImage(Buffer.from("MZ this is an executable pretending to be an image"))).rejects.toBeInstanceOf(MediaError);
  });

  it("rejects SVG (script risk)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(processImage(svg)).rejects.toThrow(/Unsupported|not a valid/);
  });

  it("rejects HTML polyglots", async () => {
    await expect(processImage(Buffer.from("<html><script>alert(1)</script></html>"))).rejects.toBeInstanceOf(MediaError);
  });

  it("rejects empty and oversize files", async () => {
    await expect(processImage(Buffer.alloc(0))).rejects.toThrow(/empty/);
    await expect(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toThrow(/too large/);
  });

  it("downsizes huge images and strips metadata", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#c27e2a" } }).withMetadata({ exif: { IFD0: { Copyright: "secret" } } }).jpeg().toBuffer();
    const r = await processImage(big);
    expect(r.width).toBeLessThanOrEqual(2400);
    const meta = await sharp(r.data).metadata();
    expect(meta.exif).toBeUndefined();
  });
});
