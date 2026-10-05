-- AlterTable
ALTER TABLE "prizes" ADD COLUMN     "image_updated_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "prize_images" (
    "prize_id" UUID NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "data" BYTEA NOT NULL,
    "byte_size" INTEGER NOT NULL,

    CONSTRAINT "prize_images_pkey" PRIMARY KEY ("prize_id")
);

-- AddForeignKey
ALTER TABLE "prize_images" ADD CONSTRAINT "prize_images_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "prizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
