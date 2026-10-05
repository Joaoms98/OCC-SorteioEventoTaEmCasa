-- CreateTable
CREATE TABLE "registration_verifications" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "send_count" INTEGER NOT NULL,
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_verifications_email_created_at_idx" ON "registration_verifications"("email", "created_at");

-- CreateIndex
CREATE INDEX "registration_verifications_expires_at_idx" ON "registration_verifications"("expires_at");

-- AddForeignKey
ALTER TABLE "registration_verifications" ADD CONSTRAINT "registration_verifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
