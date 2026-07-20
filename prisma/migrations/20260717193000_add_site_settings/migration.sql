-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "about_html" TEXT NOT NULL DEFAULT '',
    "contact_html" TEXT NOT NULL DEFAULT '',
    "updated_at" DATETIME NOT NULL
);

-- Seed singleton row
INSERT INTO "site_settings" ("id", "about_html", "contact_html", "updated_at")
VALUES ('default', '', '', CURRENT_TIMESTAMP);
