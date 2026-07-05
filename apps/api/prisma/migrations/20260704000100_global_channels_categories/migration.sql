-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_clientId_fkey";

-- DropIndex
DROP INDEX "channels_clientId_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "clientId";

-- AlterTable
ALTER TABLE "channels" DROP COLUMN "clientId";

-- CreateTable
CREATE TABLE "_ChannelToPlan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ChannelToPlan_AB_unique" ON "_ChannelToPlan"("A", "B");

-- CreateIndex
CREATE INDEX "_ChannelToPlan_B_index" ON "_ChannelToPlan"("B");

-- CreateIndex
CREATE INDEX "categories_order_idx" ON "categories"("order");

-- CreateIndex
CREATE INDEX "channels_active_idx" ON "channels"("active");

-- AddForeignKey
ALTER TABLE "_ChannelToPlan" ADD CONSTRAINT "_ChannelToPlan_A_fkey" FOREIGN KEY ("A") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChannelToPlan" ADD CONSTRAINT "_ChannelToPlan_B_fkey" FOREIGN KEY ("B") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

