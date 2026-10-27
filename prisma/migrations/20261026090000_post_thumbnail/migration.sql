-- AlterTable: separate listing thumbnail for blog posts (NULL = fall back to the banner image)
ALTER TABLE `Post` ADD COLUMN `thumbnailMediaId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Post_thumbnailMediaId_idx` ON `Post`(`thumbnailMediaId`);

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_thumbnailMediaId_fkey` FOREIGN KEY (`thumbnailMediaId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
