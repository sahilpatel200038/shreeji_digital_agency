-- AlterTable
ALTER TABLE `service` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `EditLock` (
    `resourceKey` VARCHAR(120) NOT NULL,
    `userId` INTEGER NOT NULL,
    `userName` VARCHAR(120) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `heartbeatAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `EditLock_expiresAt_idx`(`expiresAt`),
    INDEX `EditLock_userId_idx`(`userId`),
    PRIMARY KEY (`resourceKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditLockRequest` (
    `resourceKey` VARCHAR(120) NOT NULL,
    `requesterId` INTEGER NOT NULL,
    `requesterName` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`resourceKey`, `requesterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Service_isFeatured_sortOrder_idx` ON `Service`(`isFeatured`, `sortOrder`);

-- Backfill: the eight services that were previously hard-coded as "core" stay main services (data preserved, nothing removed).
UPDATE `Service` SET `isFeatured` = true
WHERE `slug` IN ('web-app-development', 'custom-software-development', 'seo', 'digital-marketing', 'ads-management', 'ugc-content-creation', 'social-media-marketing', 'influencer-marketing');
