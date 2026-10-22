"use client";

import { useState } from "react";
import { CheckboxField, CountedInput, SelectField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import type { SeoCheck } from "@/lib/seo/score";

export type SeoDefaults = {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  includeInSitemap?: boolean;
  focusKeyword?: string | null;
  secondaryKeywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogMediaId?: number | null;
  structuredData?: "AUTO" | "NONE";
};

export function SeoPanel({
  seo,
  checks,
  score,
  previewUrl,
  slugValue,
}: {
  seo: SeoDefaults | null;
  checks?: SeoCheck[];
  score?: number;
  previewUrl: string;
  slugValue?: string;
}) {
  const [title, setTitle] = useState(seo?.title ?? "");
  const [desc, setDesc] = useState(seo?.description ?? "");
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line bg-paper p-4" aria-label="Search result preview">
        <p className="text-xs text-muted">Search result preview (approximate)</p>
        <p className="mt-1 truncate text-lg text-[#1a0dab]">{title || "Your SEO title appears here"}</p>
        <p className="truncate text-sm text-forest-700">
          {previewUrl}
          {slugValue ?? ""}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{desc || "Your meta description appears here."}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <CountedInput label="SEO title" name="seoTitle" value={title} onValueChange={setTitle} max={60} hint="Leave empty to use the page title with the site name." />
        <CountedInput label="Meta description" name="seoDescription" value={desc} onValueChange={setDesc} max={160} rows={3} />
        <TextInput label="Focus keyword" name="focusKeyword" defaultValue={seo?.focusKeyword} maxLength={120} hint="The main phrase this page should be found for." />
        <TextInput label="Secondary keywords" name="secondaryKeywords" defaultValue={(seo?.secondaryKeywords ?? []).join(", ")} hint="Comma-separated, up to 10. Used for the checklist only; they are not output as a meta keywords tag." />
        <TextInput label="Canonical URL" name="canonicalUrl" defaultValue={seo?.canonicalUrl} placeholder="https://… (optional)" hint="Leave empty to use this page's own address." />
        <SelectField label="Structured data" name="structuredData" defaultValue={seo?.structuredData ?? "AUTO"} options={[{ value: "AUTO", label: "Automatic (recommended)" }, { value: "NONE", label: "None" }]} />
        <TextInput label="Social title (Open Graph)" name="ogTitle" defaultValue={seo?.ogTitle} maxLength={255} />
        <TextArea label="Social description" name="ogDescription" defaultValue={seo?.ogDescription} rows={2} maxLength={500} />
      </div>
      <MediaPicker name="ogMediaId" label="Social sharing image" defaultId={seo?.ogMediaId} hint="Recommended 1200×630. Falls back to the featured image, then the site default." />
      <div className="grid gap-1 sm:grid-cols-3">
        <CheckboxField label="Allow search engines to index" name="robotsIndex" defaultChecked={seo?.robotsIndex ?? true} />
        <CheckboxField label="Allow following links" name="robotsFollow" defaultChecked={seo?.robotsFollow ?? true} />
        <CheckboxField label="Include in sitemap.xml" name="includeInSitemap" defaultChecked={seo?.includeInSitemap ?? true} />
      </div>

      {checks && (
        <div className="rounded-lg border border-line p-4">
          <p className="font-bold text-forest-900">
            Content-quality checklist: {score}%
            <span className="ml-2 text-xs font-normal text-muted">(an internal indicator based on the rules below, as of the last save, not a Google ranking prediction)</span>
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className={c.ok ? "text-forest-700" : "text-bronze-700"}>{c.ok ? "✓" : "○"}</span>
                <span>
                  <span className="sr-only">{c.ok ? "Passed: " : "To improve: "}</span>
                  {c.label}
                  {!c.ok && <span className="block text-xs text-muted">{c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

