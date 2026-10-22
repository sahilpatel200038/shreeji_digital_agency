import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/lib/video";

describe("parseVideoUrl", () => {
  it("handles YouTube link shapes", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const v = parseVideoUrl(u);
      expect(v?.kind).toBe("youtube");
      expect(v && "embedUrl" in v && v.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });
  it("handles Vimeo and direct files", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")?.kind).toBe("vimeo");
    expect(parseVideoUrl("https://cdn.example.com/a/clip.mp4?x=1")?.kind).toBe("file");
  });
  it("rejects unsafe or unsupported links", () => {
    for (const u of ["", "http://youtu.be/dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=bad", "https://example.com/page"]) {
      expect(parseVideoUrl(u)).toBeNull();
    }
  });
});
