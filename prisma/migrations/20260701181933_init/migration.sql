-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "processedLeads" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "placeId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "rating" REAL,
    "reviewCount" INTEGER,
    "category" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "opportunityScore" REAL,
    "scoreBreakdownJson" TEXT,
    "priorityFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GmbData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "hasWebsite" BOOLEAN NOT NULL,
    "hasPhotos" BOOLEAN NOT NULL,
    "photoCount" INTEGER,
    "reviewCount" INTEGER NOT NULL,
    "rating" REAL NOT NULL,
    "openingHoursJson" TEXT,
    "rawJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GmbData_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebsiteAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mobilePerformance" INTEGER,
    "mobileAccessibility" INTEGER,
    "mobileBestPractices" INTEGER,
    "mobileSeo" INTEGER,
    "desktopPerformance" INTEGER,
    "desktopAccessibility" INTEGER,
    "desktopBestPractices" INTEGER,
    "desktopSeo" INTEGER,
    "lcpMs" REAL,
    "cls" REAL,
    "inpMs" REAL,
    "rawJson" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeoOnPageAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "titleTag" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescriptionLength" INTEGER,
    "h1Count" INTEGER,
    "h2Count" INTEGER,
    "wordCount" INTEGER,
    "topKeywordsJson" TEXT,
    "imageCount" INTEGER,
    "imagesWithAlt" INTEGER,
    "altCoveragePct" REAL,
    "hasCanonical" BOOLEAN,
    "hasStructuredData" BOOLEAN,
    "hasRobotsTxt" BOOLEAN,
    "hasSitemap" BOOLEAN,
    "openPageRank" REAL,
    "contentScore" REAL,
    "rawJson" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoOnPageAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeoAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "aiBotsJson" TEXT,
    "aiBotsAllowedCount" INTEGER,
    "aiBotsBlockedCount" INTEGER,
    "aiBotsTotalChecked" INTEGER,
    "llmsTxtFound" BOOLEAN,
    "llmsTxtValid" BOOLEAN,
    "llmsFullTxtFound" BOOLEAN,
    "schemaTypesJson" TEXT,
    "hasOrganizationOrLocalBusinessSchema" BOOLEAN,
    "hasFaqOrArticleSchema" BOOLEAN,
    "hasSameAsLinks" BOOLEAN,
    "sameAsCount" INTEGER,
    "rawHtmlWordCount" INTEGER,
    "textToHtmlByteRatio" REAL,
    "likelyJsShell" BOOLEAN,
    "geoScore" REAL,
    "rawJson" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeoAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "siren" TEXT,
    "siret" TEXT,
    "legalName" TEXT,
    "legalForm" TEXT,
    "nafCode" TEXT,
    "nafLabel" TEXT,
    "creationDate" DATETIME,
    "workforceRange" TEXT,
    "matchConfidence" REAL,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "pappersFetched" BOOLEAN NOT NULL DEFAULT false,
    "dirigeantsJson" TEXT,
    "financialsJson" TEXT,
    "rawJson" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyData_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "GmbData_leadId_key" ON "GmbData"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAudit_leadId_key" ON "WebsiteAudit"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoOnPageAudit_leadId_key" ON "SeoOnPageAudit"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoAudit_leadId_key" ON "GeoAudit"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyData_leadId_key" ON "CompanyData"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsage_service_periodKey_key" ON "QuotaUsage"("service", "periodKey");
