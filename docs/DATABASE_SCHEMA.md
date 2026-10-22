# Database Schema (MySQL 8, utf8mb4_unicode_ci)

ORM: **Prisma 7.10** with `@prisma/adapter-mariadb` (MariaDB driver; MySQL-compatible, pooled). The authoritative definition is `prisma/schema.prisma`; migrations live in `prisma/migrations/`. Database name: `shreeji_marketing` (dedicated, new). Dedicated DB user `shreeji_site` limited to that database. No existing database was modified.

Conventions: `id` = `Int @id @default(autoincrement())` (public identifiers are slugs); `createdAt`/`updatedAt` on every mutable table; enums as MySQL enums; JSON columns validated by Zod before write.

## Entity overview

```
User ──< Session            User ──< AuditLog
User ──< Post (author)      Page  ─1:1─ SeoMeta     Post ─1:1─ SeoMeta    Service ─1:1─ SeoMeta
ServiceCategory ──< Service ──< ServiceFaq          Service >──< Service (related, self m:n)
PostCategory ──< Post >──< Tag (PostTag)            Post >──< Post (related via same category query)
Media ─1:1─ MediaBlob       Media referenced by Page/Post/Service/Project/Setting (featured / og)
Menu ──< MenuItem (self-parent)
Lead ──< LeadNote           Project, Testimonial, Faq, Setting, Redirect, RateLimit
```

## Tables

### `User` (administrators & roles)
`id`, `email` UNIQUE, `name`, `passwordHash`, `role` ENUM(`SUPER_ADMIN`,`ADMIN`,`EDITOR`), `isActive` BOOL, `lastLoginAt`, timestamps.
Roles are an enum rather than a table: three fixed roles, permission matrix in code (`src/lib/auth/permissions.ts`) — avoids an unnecessary join/table.

### `Session`
`id` (cuid, = session token id), `userId` FK→User **CASCADE**, `expiresAt`, `ipHash`, `userAgent`, `createdAt`. INDEX(`userId`), INDEX(`expiresAt`). Enables server-side revocation/logout.

### `Page`
`id`, `title`, `slug` UNIQUE, `template` ENUM(`DEFAULT`,`CONTACT`), `excerpt` TEXT?, `blocks` JSON, `featuredMediaId` FK→Media **SET NULL** (nullable), `status` ENUM(`DRAFT`,`PUBLISHED`), `publishedAt` DATETIME?, `seoId` UNIQUE FK→SeoMeta **SET NULL**, `isSystem` BOOL (home/legal pages can't be deleted by Editors), timestamps. INDEX(`status`,`publishedAt`).

### `ServiceCategory`
`id`, `name`, `slug` UNIQUE, `description`, `sortOrder`.

### `Service`
`id`, `categoryId` FK→ServiceCategory **RESTRICT**, `title`, `slug` UNIQUE, `summary` (card text), `icon` (key from icon set), `heroHeading`, `intro` TEXT, `benefits` JSON `[{title,text}]`, `included` JSON `string[]`, `process` JSON `[{title,text}]`, `blocks` JSON (extra body), `featuredMediaId` FK→Media SET NULL, `status`, `publishedAt`, `sortOrder`, `seoId` UNIQUE FK SET NULL, timestamps. INDEX(`status`,`sortOrder`), INDEX(`categoryId`).
### `ServiceRelation` (m:n self)
`serviceId`, `relatedId` composite PK, both FK→Service **CASCADE**.
### `ServiceFaq`
Not a separate table: service FAQs reuse `Faq` with optional `serviceId` FK → Service **CASCADE** (global FAQs have `serviceId = NULL`).

### `PostCategory`, `Tag`, `PostTag`
`PostCategory(id,name,slug UNIQUE,description)`. `Tag(id,name,slug UNIQUE)`. `PostTag(postId,tagId)` composite PK, FKs **CASCADE**.

### `Post`
`id`, `title`, `slug` UNIQUE, `excerpt`, `blocks` JSON, `featuredMediaId` FK SET NULL, `authorId` FK→User **RESTRICT** (an author with posts can't be deleted — deactivate instead), `categoryId` FK→PostCategory **SET NULL**, `status`, `publishedAt`, `readingMinutes` INT, `seoId` UNIQUE FK SET NULL, timestamps. INDEX(`status`,`publishedAt`), INDEX(`categoryId`). Blog search uses `LIKE` on title/excerpt (adequate for a small site; add a FULLTEXT index if the blog grows large).

### `SeoMeta` (shared SEO fields — one row per Page/Post/Service)
`id`, `title` VARCHAR(255)?, `description` VARCHAR(500)?, `canonicalUrl` VARCHAR(500)?, `robotsIndex` BOOL default true, `robotsFollow` BOOL default true, `focusKeyword`, `secondaryKeywords` JSON `string[]`, `ogTitle`, `ogDescription`, `ogMediaId` FK→Media SET NULL, `structuredData` ENUM(`AUTO`,`NONE`) (AUTO = emit the type-appropriate schema), `includeInSitemap` BOOL default true, timestamps.

### `Media`
`id`, `fileName`, `title`, `altText`, `mimeType`, `sizeBytes`, `width`, `height`, `folder` VARCHAR(80) default `general`, `checksum` (sha256), `uploadedById` FK→User SET NULL, timestamps. INDEX(`folder`), INDEX(`mimeType`).
### `MediaBlob`
`mediaId` PK/FK→Media **CASCADE**, `data` LONGBLOB. Separate so list queries never load binary data. **Storage strategy:** blobs live in MySQL so uploads persist on any host (no dependence on the web server's local disk) and are included in DB backups. `StorageDriver` interface in code allows swapping to S3/R2 later without schema change (a driver boundary in `src/lib/media/store.ts`).

### `Menu`, `MenuItem`
`Menu(id, key UNIQUE ('header'|'footer-services'|'footer-company'|'footer-legal'), name)`. `MenuItem(id, menuId FK CASCADE, parentId FK→MenuItem CASCADE (nullable), label, href, sortOrder, openInNewTab, isActive)`. INDEX(`menuId`,`sortOrder`).

### `Setting`
`key` VARCHAR(80) PK, `value` JSON, `updatedAt`, `updatedById`. One row per validated **group** (`general`, `contact`, `social`, `home`, `analytics`, `seo`), each parsed by a Zod schema in `src/lib/settings/schema.ts` and merged with defaults on read. Homepage statistics are stored in `home.stats` and shown only when `home.showStats` is true (default false).

### `Lead`, `LeadNote`
`Lead` (reserved word in MySQL 8: always back-tick it in raw SQL) `(id, firstName, lastName, email, phone, company, service, message TEXT, status ENUM(NEW,CONTACTED,QUALIFIED,WON,LOST,SPAM) default NEW, source (page path), ipHash, userAgent, createdAt, updatedAt)`. INDEX(`status`,`createdAt`), INDEX(`email`).
`LeadNote(id, leadId FK CASCADE, authorId FK→User SET NULL, body, createdAt)`.
IP is stored as a salted SHA-256 hash (privacy), not plaintext.

### `Project` (portfolio)
`id`, `name`, `slug` UNIQUE, `category` ENUM(`DIGITAL_MARKETING`,`WEB_DEVELOPMENT`,`WEB_APPLICATION`), `tags` JSON `string[]`, `summary`, `externalUrl`?, `mediaId` FK→Media SET NULL, `sortOrder`, `status`, timestamps.

### `Testimonial`
`id`, `name`, `location`, `company`?, `quote` TEXT, `isVerified` BOOL default **false**, `status` (DRAFT/PUBLISHED), `sortOrder`, timestamps. Public site shows only `isVerified AND PUBLISHED`.

### `Faq`
`id`, `question`, `answer` TEXT, `category` VARCHAR(60), `serviceId` FK→Service CASCADE NULL, `showOnHome` BOOL, `sortOrder`, `status`.

### `Redirect`
`id`, `fromPath` UNIQUE VARCHAR(500), `toPath` VARCHAR(500), `statusCode` SMALLINT (301|302|307|308), `isActive`, `hits` INT, `createdAt`. Validated: internal path or `https://` URL only; no loops.

### `AuditLog`
`id`, `userId` FK→User SET NULL, `action` (e.g. `page.update`), `entityType`, `entityId`, `summary`, `ipHash`, `createdAt`. INDEX(`createdAt`), INDEX(`entityType`,`entityId`). Append-only.

### `RateLimit`
`key` VARCHAR(190) PK (e.g. `login:ip:<hash>`, `contact:ip:<hash>`), `count`, `windowStart`. Persistent limiter that works across restarts/instances.

## Deletion behaviour summary
CASCADE: Session, PostTag, ServiceRelation, MenuItem (with menu), LeadNote (with lead), MediaBlob, service-scoped Faq. SET NULL: media references, SEO references, post category, AuditLog.user. RESTRICT: Service→Category, Post→author (UI blocks with a message). Media deletion is additionally guarded in code: refuses when referenced by any Page/Post/Service/Project/Setting/SeoMeta (reports where).

## Migrations & seeding
- `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (production). Never `migrate reset` on production.
- `npm run db:seed` — idempotent upserts (never truncates): admin user from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (refuses to run in production without a strong password), menus, categories, 11 services (with FAQs and related links), 8 projects with their logo images (from `prisma/seed-data/images`), global FAQs, testimonials (**unverified + draft**), CMS pages, 3 starter posts, default settings, logo media.
