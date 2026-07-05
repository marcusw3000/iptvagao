-- DropForeignKey
ALTER TABLE "epg_programs" DROP CONSTRAINT "epg_programs_channelId_fkey";

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "tvgId" TEXT;

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_deviceId_idx" ON "favorites"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_deviceId_channelId_key" ON "favorites"("deviceId", "channelId");

-- CreateIndex
CREATE INDEX "channels_tvgId_idx" ON "channels"("tvgId");

-- CreateIndex
CREATE INDEX "epg_programs_startTime_endTime_idx" ON "epg_programs"("startTime", "endTime");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_programs" ADD CONSTRAINT "epg_programs_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
