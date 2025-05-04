-- Add stixBundleUrl column if it doesn't exist
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "stixBundleUrl" TEXT;
