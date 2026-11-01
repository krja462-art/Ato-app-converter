import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('Developer'),
  githubOwner: text('github_owner').default('medianforge-org'),
  githubRepo: text('github_repo').default('android-webview-builder'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apps = pgTable('apps', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  appName: text('app_name').notNull(),
  packageName: text('package_name').notNull(),
  targetUrl: text('target_url').notNull(),
  primaryColor: text('primary_color').notNull().default('#2563EB'),
  statusBarColor: text('status_bar_color').notNull().default('#1D4ED8'),
  appIconUrl: text('app_icon_url').default(''),
  splashColor: text('splash_color').notNull().default('#0F172A'),
  splashDurationMs: integer('splash_duration_ms').notNull().default(1800),
  splashTagline: text('splash_tagline').notNull().default('Powered by Native WebView Engine'),
  swipeToRefresh: boolean('swipe_to_refresh').notNull().default(true),
  nativeFileUpload: boolean('native_file_upload').notNull().default(true),
  geolocation: boolean('geolocation').notNull().default(false),
  pushNotifications: boolean('push_notifications').notNull().default(true),
  oneSignalAppId: text('onesignal_app_id').default(''),
  offlineFallback: boolean('offline_fallback').notNull().default(true),
  customUserAgent: text('custom_user_agent').default('MedianForgeNative/2.4 (Android; Mobile)'),
  versionName: text('version_name').notNull().default('1.0.0'),
  versionCode: integer('version_code').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const builds = pgTable('builds', {
  id: serial('id').primaryKey(),
  appId: integer('app_id')
    .references(() => apps.id)
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  buildNumber: integer('build_number').notNull().default(1),
  status: text('status').notNull().default('PENDING'), // PENDING | BUILDING | COMPLETED | FAILED
  stage: text('stage').notNull().default('Queued repository_dispatch event'),
  progress: integer('progress').notNull().default(8),
  githubRunId: text('github_run_id').notNull(),
  dispatchMode: text('dispatch_mode').notNull().default('GITHUB_ACTIONS_RUNNER'),
  apkDownloadUrl: text('apk_download_url').default(''),
  aabDownloadUrl: text('aab_download_url').default(''),
  apkSizeMb: text('apk_size_mb').default('14.8 MB'),
  commitSha: text('commit_sha').default('a8f92d1'),
  buildLogs: text('build_logs').notNull().default(''),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const usersRelations = relations(users, ({ many }) => ({
  apps: many(apps),
  builds: many(builds),
}));

export const appsRelations = relations(apps, ({ one, many }) => ({
  owner: one(users, {
    fields: [apps.userId],
    references: [users.id],
  }),
  builds: many(builds),
}));

export const buildsRelations = relations(builds, ({ one }) => ({
  app: one(apps, {
    fields: [builds.appId],
    references: [apps.id],
  }),
  owner: one(users, {
    fields: [builds.userId],
    references: [users.id],
  }),
}));
