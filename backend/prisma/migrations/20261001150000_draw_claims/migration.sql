-- AlterTable: when the winner received the prize
ALTER TABLE "draws" ADD COLUMN "claimed_at" TIMESTAMPTZ(3);
