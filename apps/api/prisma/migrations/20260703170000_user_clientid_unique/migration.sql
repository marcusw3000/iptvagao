-- DropIndex
DROP INDEX "users_clientId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "users_clientId_key" ON "users"("clientId");

