-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "draw_status" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "event_date" TIMESTAMPTZ(3),
    "registration_open" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(160),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prizes" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draws" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "prize_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "status" "draw_status" NOT NULL DEFAULT 'CONFIRMED',
    "drawn_at" TIMESTAMPTZ(3) NOT NULL,
    "voided_at" TIMESTAMPTZ(3),

    CONSTRAINT "draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participants_event_id_created_at_idx" ON "participants"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "participants_event_id_phone_key" ON "participants"("event_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "participants_event_id_email_key" ON "participants"("event_id", "email");

-- CreateIndex
CREATE INDEX "prizes_event_id_idx" ON "prizes"("event_id");

-- CreateIndex
CREATE INDEX "draws_prize_id_status_idx" ON "draws"("prize_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "draws_event_id_participant_id_key" ON "draws"("event_id", "participant_id");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "prizes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddCheckConstraint (not modeled by Prisma)
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_quantity_check" CHECK ("quantity" > 0);
