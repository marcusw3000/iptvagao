-- DropForeignKey
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_deviceId_fkey";

-- AlterTable
ALTER TABLE "favorites" ADD COLUMN "clientId" TEXT;

-- Backfill clientId from existing device favorites
UPDATE "favorites" AS f
SET "clientId" = d."clientId"
FROM "devices" AS d
WHERE f."deviceId" = d."id";

-- Remove rows that could not be mapped to a client
DELETE FROM "favorites"
WHERE "clientId" IS NULL;

-- Deduplicate favorites coming from multiple devices of the same client
DELETE FROM "favorites" AS older
USING "favorites" AS newer
WHERE older."clientId" = newer."clientId"
  AND older."channelId" = newer."channelId"
  AND older."id" < newer."id";

-- Enforce new client-based relation
ALTER TABLE "favorites" ALTER COLUMN "clientId" SET NOT NULL;

-- DropIndex
DROP INDEX "favorites_deviceId_idx";

-- DropIndex
DROP INDEX "favorites_deviceId_channelId_key";

-- CreateIndex
CREATE INDEX "favorites_clientId_idx" ON "favorites"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_clientId_channelId_key" ON "favorites"("clientId", "channelId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "favorites" DROP COLUMN "deviceId";
