-- CreateEnum: what the live roulette spins
CREATE TYPE "draw_mode" AS ENUM ('PRIZES', 'PARTICIPANTS');

-- AlterTable: existing events keep the prize roulette
ALTER TABLE "events" ADD COLUMN "draw_mode" "draw_mode" NOT NULL DEFAULT 'PRIZES';
