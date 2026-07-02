-- Add Discord notification fields
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "discordWebhookUrl" TEXT;
