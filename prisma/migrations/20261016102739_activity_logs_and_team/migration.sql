-- AlterTable
ALTER TABLE `auditlog` ADD COLUMN `actionType` VARCHAR(20) NOT NULL DEFAULT 'OTHER',
    ADD COLUMN `entityName` VARCHAR(190) NOT NULL DEFAULT '',
    ADD COLUMN `module` VARCHAR(60) NOT NULL DEFAULT '',
    ADD COLUMN `newValues` JSON NULL,
    ADD COLUMN `oldValues` JSON NULL,
    ADD COLUMN `requestId` VARCHAR(64) NOT NULL DEFAULT '',
    ADD COLUMN `userName` VARCHAR(120) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `TeamMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `role` VARCHAR(120) NOT NULL,
    `title` VARCHAR(160) NOT NULL DEFAULT '',
    `photoId` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'PUBLISHED',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamMember_status_sortOrder_idx`(`status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AuditLog_actionType_createdAt_idx` ON `AuditLog`(`actionType`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_module_createdAt_idx` ON `AuditLog`(`module`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_requestId_idx` ON `AuditLog`(`requestId`);

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_photoId_fkey` FOREIGN KEY (`photoId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the new activity-log columns for entries written before this migration (data is preserved, nothing is removed).
UPDATE `auditlog` a LEFT JOIN `user` u ON u.`id` = a.`userId`
SET a.`userName` = COALESCE(u.`name`, ''),
    a.`actionType` = CASE
        WHEN a.`action` = 'login' THEN 'LOGIN'
        WHEN a.`action` = 'logout' THEN 'LOGOUT'
        WHEN a.`action` = 'login.failed' THEN 'LOGIN_FAILED'
        WHEN a.`action` LIKE '%.create' OR a.`action` LIKE '%.upload' THEN 'CREATE'
        WHEN a.`action` LIKE '%.delete' THEN 'DELETE'
        WHEN a.`action` LIKE '%.unpublish' THEN 'UNPUBLISH'
        WHEN a.`action` LIKE '%.publish' THEN 'PUBLISH'
        WHEN a.`action` LIKE '%.export' THEN 'EXPORT'
        WHEN a.`action` LIKE '%.%' THEN 'UPDATE'
        ELSE 'OTHER'
    END,
    a.`module` = CASE a.`entityType`
        WHEN 'page' THEN 'Pages'
        WHEN 'post' THEN 'Blog posts'
        WHEN 'post-category' THEN 'Blog posts'
        WHEN 'service' THEN 'Services'
        WHEN 'project' THEN 'Projects'
        WHEN 'testimonial' THEN 'Testimonials'
        WHEN 'faq' THEN 'FAQs'
        WHEN 'media' THEN 'Media'
        WHEN 'menu' THEN 'Menus'
        WHEN 'setting' THEN 'Settings'
        WHEN 'redirect' THEN 'Redirects'
        WHEN 'lead' THEN 'Leads'
        WHEN 'user' THEN 'Users'
        ELSE a.`entityType`
    END,
    a.`entityName` = a.`summary`;
