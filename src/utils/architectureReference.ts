export const SQL_POSTGRES_SCHEMA = `-- PostgreSQL Schema for MedianForge Web-to-App SaaS Platform
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE, -- Firebase / Supabase Auth UID
  email TEXT NOT NULL,
  display_name TEXT DEFAULT 'Developer',
  github_owner TEXT DEFAULT 'medianforge-org',
  github_repo TEXT DEFAULT 'android-webview-builder',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE apps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL, -- e.g. com.company.app
  target_url TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#2563EB',
  status_bar_color TEXT NOT NULL DEFAULT '#1D4ED8',
  app_icon_url TEXT DEFAULT '',
  splash_color TEXT NOT NULL DEFAULT '#0F172A',
  splash_duration_ms INTEGER NOT NULL DEFAULT 1800,
  splash_tagline TEXT NOT NULL DEFAULT 'Powered by Native WebView Engine',
  swipe_to_refresh BOOLEAN NOT NULL DEFAULT TRUE,
  native_file_upload BOOLEAN NOT NULL DEFAULT TRUE,
  geolocation BOOLEAN NOT NULL DEFAULT FALSE,
  push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  onesignal_app_id TEXT DEFAULT '',
  offline_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  custom_user_agent TEXT DEFAULT 'MedianForgeNative/2.4 (Android; Mobile)',
  version_name TEXT NOT NULL DEFAULT '1.0.0',
  version_code INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE builds (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | BUILDING | COMPLETED | FAILED
  stage TEXT NOT NULL DEFAULT 'Queued repository_dispatch event',
  progress INTEGER NOT NULL DEFAULT 8,
  github_run_id TEXT NOT NULL,
  dispatch_mode TEXT NOT NULL DEFAULT 'GITHUB_ACTIONS_RUNNER',
  apk_download_url TEXT DEFAULT '',
  aab_download_url TEXT DEFAULT '',
  apk_size_mb TEXT DEFAULT '14.8 MB',
  commit_sha TEXT DEFAULT 'a8f92d1',
  build_logs TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);`;

export const PRISMA_SCHEMA_MODEL = `// schema.prisma — Complete Prisma ORM Models for Users, Apps, and Builds
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum BuildStatus {
  PENDING
  BUILDING
  COMPLETED
  FAILED
}

model User {
  id          Int      @id @default(autoincrement())
  uid         String   @unique
  email       String
  displayName String?  @default("Developer") @map("display_name")
  githubOwner String?  @default("medianforge-org") @map("github_owner")
  githubRepo  String?  @default("android-webview-builder") @map("github_repo")
  createdAt   DateTime @default(now()) @map("created_at")

  apps        App[]
  builds      Build[]

  @@map("users")
}

model App {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  appName           String   @map("app_name")
  packageName       String   @map("package_name")
  targetUrl         String   @map("target_url")
  primaryColor      String   @default("#2563EB") @map("primary_color")
  statusBarColor    String   @default("#1D4ED8") @map("status_bar_color")
  appIconUrl        String?  @map("app_icon_url")
  splashColor       String   @default("#0F172A") @map("splash_color")
  splashDurationMs  Int      @default(1800) @map("splash_duration_ms")
  splashTagline     String   @default("Powered by Native WebView Engine") @map("splash_tagline")
  swipeToRefresh    Boolean  @default(true) @map("swipe_to_refresh")
  nativeFileUpload  Boolean  @default(true) @map("native_file_upload")
  geolocation       Boolean  @default(false)
  pushNotifications Boolean  @default(true) @map("push_notifications")
  oneSignalAppId    String?  @map("onesignal_app_id")
  offlineFallback   Boolean  @default(true) @map("offline_fallback")
  customUserAgent   String?  @map("custom_user_agent")
  versionName       String   @default("1.0.0") @map("version_name")
  versionCode       Int      @default(1) @map("version_code")
  updatedAt         DateTime @updatedAt @map("updated_at")
  createdAt         DateTime @default(now()) @map("created_at")

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  builds            Build[]

  @@map("apps")
}

model Build {
  id             Int         @id @default(autoincrement())
  appId          Int         @map("app_id")
  userId         Int         @map("user_id")
  buildNumber    Int         @default(1) @map("build_number")
  status         BuildStatus @default(PENDING)
  stage          String      @default("Queued repository_dispatch event")
  progress       Int         @default(8)
  githubRunId    String      @map("github_run_id")
  dispatchMode   String      @default("GITHUB_ACTIONS_RUNNER") @map("dispatch_mode")
  apkDownloadUrl String?     @map("apk_download_url")
  aabDownloadUrl String?     @map("aab_download_url")
  apkSizeMb      String?     @default("14.8 MB") @map("apk_size_mb")
  commitSha      String?     @map("commit_sha")
  buildLogs      String      @default("") @map("build_logs")
  startedAt      DateTime    @default(now()) @map("started_at")
  completedAt    DateTime?   @map("completed_at")

  app            App         @relation(fields: [appId], references: [id], onDelete: Cascade)
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("builds")
}`;

export const EXPRESS_BACKEND_SNIPPET = `// Express Routes: /api/trigger-build & /api/github-webhook
import express from 'express';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { createBuildJob, updateBuildFromWebhook, saveAppConfiguration } from './src/db/apps.ts';

const router = express.Router();

// POST /api/trigger-build — Dispatches repository_dispatch to GitHub Actions REST API
router.post('/api/trigger-build', requireAuth, async (req: AuthRequest, res) => {
  const savedApp = await saveAppConfiguration(req.user!.id, req.body);
  const buildRecord = await createBuildJob({
    userId: req.user!.id,
    appId: savedApp.id,
    buildNumber: savedApp.versionCode,
    githubRunId: String(Date.now()),
    dispatchMode: 'GITHUB_ACTIONS_RUNNER',
    initialLog: 'Dispatched repository_dispatch [build-android-apk] to GitHub Actions',
  });

  // Trigger GitHub Actions workflow via REST API
  const ghResponse = await fetch(
    \`https://api.github.com/repos/\${process.env.GITHUB_OWNER}/\${process.env.GITHUB_REPO}/dispatches\`,
    {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${process.env.GITHUB_PAT}\`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'build-android-apk',
        client_payload: {
          build_id: buildRecord.id,
          app_name: savedApp.appName,
          package_name: savedApp.packageName,
          target_url: savedApp.targetUrl,
          primary_color: savedApp.primaryColor,
          status_bar_color: savedApp.statusBarColor,
          splash_color: savedApp.splashColor,
          swipe_to_refresh: savedApp.swipeToRefresh,
          native_file_upload: savedApp.nativeFileUpload,
          geolocation: savedApp.geolocation,
          push_notifications: savedApp.pushNotifications,
          onesignal_app_id: savedApp.oneSignalAppId,
          offline_fallback: savedApp.offlineFallback,
          version_name: savedApp.versionName,
          version_code: savedApp.versionCode,
          app_icon_url: savedApp.appIconUrl,
          webhook_url: \`\${process.env.APP_URL}/api/github-webhook\`,
        },
      }),
    }
  );

  if (!ghResponse.ok && ghResponse.status !== 204) {
    throw new Error(\`GitHub API responded with status \${ghResponse.status}\`);
  }

  return res.status(201).json({ build: buildRecord, app: savedApp });
});

// POST /api/github-webhook — Receives CI/CD stage updates & artifact download URLs
router.post('/api/github-webhook', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid X-Webhook-Secret signature' });
  }

  const { build_id, github_run_id, status, stage, progress, apk_download_url, aab_download_url } = req.body;
  const updated = await updateBuildFromWebhook({
    buildId: Number(build_id),
    status,
    stage,
    progress,
    githubRunId: github_run_id,
    apkDownloadUrl: apk_download_url,
    aabDownloadUrl: aab_download_url,
  });

  return res.json({ ok: true, build: updated });
});`;
