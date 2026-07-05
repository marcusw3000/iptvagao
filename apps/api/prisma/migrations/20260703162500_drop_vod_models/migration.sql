-- DropForeignKey
ALTER TABLE "live_streams" DROP CONSTRAINT "live_streams_clientId_fkey";

-- DropForeignKey
ALTER TABLE "playlist_items" DROP CONSTRAINT "playlist_items_playlistId_fkey";

-- DropForeignKey
ALTER TABLE "playlist_items" DROP CONSTRAINT "playlist_items_streamId_fkey";

-- DropForeignKey
ALTER TABLE "playlist_items" DROP CONSTRAINT "playlist_items_videoId_fkey";

-- DropForeignKey
ALTER TABLE "playlists" DROP CONSTRAINT "playlists_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "playlists" DROP CONSTRAINT "playlists_clientId_fkey";

-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_clientId_fkey";

-- DropTable
DROP TABLE "live_streams";

-- DropTable
DROP TABLE "playlist_items";

-- DropTable
DROP TABLE "playlists";

-- DropTable
DROP TABLE "videos";

