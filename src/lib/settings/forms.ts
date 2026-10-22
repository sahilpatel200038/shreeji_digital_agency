/** Form → settings-value coercions shared by Admin > Settings and the dedicated Home / Contact screens. */

export const HOME_SECTION_FLAGS = [
  ["showAbout", "About"],
  ["showServices", "Core services"],
  ["showProcess", "How we work"],
  ["showTestimonials", "Testimonials (only verified ones are ever shown)"],
  ["showVideos", "Work videos"],
  ["showWork", "Projects"],
  ["showFaq", "FAQ"],
] as const;

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Turns the Homepage form fields into the typed `home` settings value (mutates `raw`). */
export function coerceHomeForm(fd: FormData, raw: Record<string, unknown>) {
  raw.showStats = fd.get("showStats") === "on";
  const stats: { label: string; value: number; suffix: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const label = String(fd.get(`stat_label_${i}`) ?? "").trim();
    const value = Number(fd.get(`stat_value_${i}`));
    if (label && Number.isFinite(value)) stats.push({ label, value, suffix: String(fd.get(`stat_suffix_${i}`) ?? "").trim() });
  }
  raw.stats = stats;
  const pairs = (prefix: string, n: number) => {
    const out: { title: string; text: string }[] = [];
    for (let i = 0; i < n; i++) {
      const title = String(fd.get(`${prefix}_title_${i}`) ?? "").trim();
      const text = String(fd.get(`${prefix}_text_${i}`) ?? "").trim();
      if (title) out.push({ title, text });
    }
    return out;
  };
  raw.whyUs = pairs("why", 4);
  raw.process = pairs("process", 6);
  raw.videos = [0, 1].map((i) => ({
    title: String(fd.get(`video_title_${i}`) ?? "").trim(),
    text: String(fd.get(`video_text_${i}`) ?? "").trim(),
    url: String(fd.get(`video_url_${i}`) ?? "").trim(),
  }));
  for (const k of Object.keys(raw)) if (/^(stat|why|process|video)_/.test(k)) delete raw[k];

  // Section switches and the pill list exist only on the dedicated Home screen. Checkboxes that are unticked are
  // absent from FormData, so they count as "hidden" only when that screen's marker field is present.
  for (const [k] of HOME_SECTION_FLAGS) {
    if (fd.has("sectionsForm")) raw[k] = fd.get(k) === "on";
    else if (typeof raw[k] === "string") delete raw[k];
  }
  if (fd.has("aboutPills")) raw.aboutPills = lines(fd.get("aboutPills"));
  delete raw.sectionsForm;
}

/** Turns the Contact form fields into the typed `contact` settings value (mutates `raw`). */
export function coerceContactForm(fd: FormData, raw: Record<string, unknown>) {
  if (fd.has("contactPageForm")) raw.showServices = fd.get("showServices") === "on";
  else if (typeof raw.showServices === "string") delete raw.showServices;
  delete raw.contactPageForm;
}
