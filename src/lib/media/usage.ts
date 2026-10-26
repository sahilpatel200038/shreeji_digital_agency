import { db } from "@/lib/db";
import { uploadedVideoId } from "@/lib/video";
import { mediaIdsInBlocks, parseBlocks } from "@/lib/blocks/schema";

/** Everywhere a media item is referenced. Used to refuse unsafe deletion. */
export async function findMediaUsage(id: number): Promise<string[]> {
  const [pages, posts, services, projects, seos, settings, bannerSetting, homeSetting, blockPages, blockPosts, blockServices] = await Promise.all([
    db.page.findMany({ where: { featuredMediaId: id }, select: { title: true } }),
    db.post.findMany({ where: { featuredMediaId: id }, select: { title: true } }),
    db.service.findMany({ where: { featuredMediaId: id }, select: { title: true } }),
    db.project.findMany({ where: { mediaId: id }, select: { name: true } }),
    db.seoMeta.count({ where: { ogMediaId: id } }),
    db.setting.findUnique({ where: { key: "seo" } }),
    db.setting.findUnique({ where: { key: "banners" } }),
    db.setting.findUnique({ where: { key: "home" } }),
    db.page.findMany({ select: { title: true, blocks: true } }),
    db.post.findMany({ select: { title: true, blocks: true } }),
    db.service.findMany({ select: { title: true, blocks: true } }),
  ]);
  const used: string[] = [];
  pages.forEach((p) => used.push(`Page “${p.title}” (featured image)`));
  posts.forEach((p) => used.push(`Post “${p.title}” (featured image)`));
  services.forEach((s) => used.push(`Service “${s.title}” (featured image)`));
  projects.forEach((p) => used.push(`Project “${p.name}”`));
  if (seos > 0) used.push(`${seos} SEO social image setting(s)`);
  const banners = (bannerSetting?.value ?? {}) as Record<string, unknown>;
  for (const [k, label] of [["home", "Homepage"], ["services", "Services page"], ["blog", "Blog page"], ["faq", "FAQ page"]] as const) {
    if (banners[k] === id) used.push(`${label} banner image`);
  }
  const homeVideos = ((homeSetting?.value ?? {}) as { videos?: { url?: string }[] }).videos ?? [];
  homeVideos.forEach((v, i) => {
    if (uploadedVideoId(v.url ?? "") === id) used.push(`Homepage work video ${i + 1}`);
  });
  if ((settings?.value as { ogMediaId?: number } | null)?.ogMediaId === id) used.push("Site default social image");
  const inBlocks = (rows: { title: string; blocks: unknown }[], kind: string) =>
    rows.forEach((r) => {
      if (mediaIdsInBlocks(parseBlocks(r.blocks ?? [])).includes(id)) used.push(`${kind} “${r.title}” (content image)`);
    });
  inBlocks(blockPages, "Page");
  inBlocks(blockPosts, "Post");
  inBlocks(blockServices, "Service");
  return used;
}
