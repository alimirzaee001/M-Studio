-- AlterTable: add locale to projects (existing rows default to fa)
ALTER TABLE "projects" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fa';

-- CreateIndex
CREATE INDEX "projects_locale_idx" ON "projects"("locale");

-- Recreate site_settings as per-locale rows
CREATE TABLE "new_site_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locale" TEXT NOT NULL,
    "about_html" TEXT NOT NULL DEFAULT '',
    "contact_html" TEXT NOT NULL DEFAULT '',
    "updated_at" DATETIME NOT NULL
);

INSERT INTO "new_site_settings" ("id", "locale", "about_html", "contact_html", "updated_at")
SELECT 'fa', 'fa', "about_html", "contact_html", "updated_at"
FROM "site_settings"
WHERE "id" = 'default';

INSERT INTO "new_site_settings" ("id", "locale", "about_html", "contact_html", "updated_at")
SELECT 'en', 'en', '', '', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "new_site_settings" WHERE "locale" = 'en');

-- If legacy table was empty, ensure fa row exists
INSERT INTO "new_site_settings" ("id", "locale", "about_html", "contact_html", "updated_at")
SELECT 'fa', 'fa', '', '', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "new_site_settings" WHERE "locale" = 'fa');

DROP TABLE "site_settings";
ALTER TABLE "new_site_settings" RENAME TO "site_settings";

CREATE UNIQUE INDEX "site_settings_locale_key" ON "site_settings"("locale");
