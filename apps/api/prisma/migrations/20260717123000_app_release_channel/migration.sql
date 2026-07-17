CREATE TYPE "AppReleaseChannel" AS ENUM ('local', 'staging', 'prod');

ALTER TABLE "app_releases"
ADD COLUMN "channel" "AppReleaseChannel" NOT NULL DEFAULT 'prod';

DROP INDEX "app_releases_versionCode_key";

CREATE UNIQUE INDEX "app_releases_channel_versionCode_key" ON "app_releases"("channel", "versionCode");
