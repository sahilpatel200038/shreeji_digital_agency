export type VideoSource =
  | { kind: "youtube"; id: string; embedUrl: string; thumbnail: string }
  | { kind: "vimeo"; id: string; embedUrl: string; thumbnail: null }
  | { kind: "file"; src: string; thumbnail: null };

const YT_ID = /^[\w-]{11}$/;

/** Turns a pasted https:// video link into something the player can use. Returns null for anything unsupported. */
export function parseVideoUrl(value: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const parts = u.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be" ? parts[0] : parts[0] === "watch" ? u.searchParams.get("v") : ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null;
    if (!id || !YT_ID.test(id)) return null;
    return {
      kind: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    if (!id) return null;
    return { kind: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`, thumbnail: null };
  }
  if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "file", src: u.toString(), thumbnail: null };
  return null;
}
