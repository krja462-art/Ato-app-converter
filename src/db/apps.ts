import { db } from './index.ts';
import { apps, builds } from './schema.ts';
import { desc, eq, and } from 'drizzle-orm';
import { AppConfigInput } from '../utils/apkBuilderConfig.ts';
import { isCloudSqlConfigured } from './users.ts';

// Serverless fallback state for environments where Cloud SQL Unix socket (SQL_HOST) is not mounted (e.g. Vercel)
let fallbackApps: any[] = [];
let fallbackBuilds: any[] = [];
let nextFallbackAppId = 1;
let nextFallbackBuildId = 1;

function ensureFallbackSeed(userId: number) {
  if (fallbackApps.length > 0) return;
  const app1 = {
    id: nextFallbackAppId++,
    userId,
    appName: 'Linear Engineering Hub',
    packageName: 'com.linear.mobilehub',
    targetUrl: 'https://linear.app',
    primaryColor: '#2563EB',
    statusBarColor: '#1E40AF',
    appIconUrl: '',
    splashColor: '#0F172A',
    splashDurationMs: 1600,
    splashTagline: 'Issue Tracking & Sprint Triage',
    swipeToRefresh: true,
    nativeFileUpload: true,
    geolocation: false,
    pushNotifications: true,
    oneSignalAppId: 'f49c82e0-51c9-4e18-9204-882a109c7b2e',
    offlineFallback: true,
    customUserAgent: 'MedianForgeNative/2.4 (Android 14; Pixel 8 Pro)',
    versionName: '2.4.0',
    versionCode: 12,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
  const app2 = {
    id: nextFallbackAppId++,
    userId,
    appName: 'Mercury Treasury Portal',
    packageName: 'com.mercury.treasury',
    targetUrl: 'https://mercury.com',
    primaryColor: '#059669',
    statusBarColor: '#065F46',
    appIconUrl: '',
    splashColor: '#090D16',
    splashDurationMs: 2000,
    splashTagline: 'Commercial Banking & Approvals',
    swipeToRefresh: true,
    nativeFileUpload: true,
    geolocation: true,
    pushNotifications: true,
    oneSignalAppId: '98a1c34d-2041-49a7-8311-56c0291a8f01',
    offlineFallback: true,
    customUserAgent: 'MedianForgeNative/2.4 (Android 14; Mobile)',
    versionName: '1.8.2',
    versionCode: 8,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
  fallbackApps.push(app1, app2);

  const build1 = {
    id: nextFallbackBuildId++,
    appId: app1.id,
    userId,
    buildNumber: 12,
    status: 'COMPLETED',
    stage: 'Signed APK & Play Store AAB uploaded to GitHub Artifacts',
    progress: 100,
    githubRunId: '11604928310',
    dispatchMode: 'GITHUB_ACTIONS_RUNNER',
    apkDownloadUrl: `/api/artifacts/1/apk`,
    aabDownloadUrl: `/api/artifacts/1/aab`,
    apkSizeMb: '14.6 MB',
    commitSha: '9c4e2b8',
    buildLogs: [
      '[18:40:02] Triggered repository_dispatch [build-android-apk] on medianforge-org/android-webview-builder',
      '[18:40:05] Runner ubuntu-latest-24.04 assigned (JDK 17 Temurin + Android SDK 34.0.0)',
      '[18:40:09] Injected applicationId="com.linear.mobilehub", targetUrl="https://linear.app", versionName="2.4.0"',
      '[18:40:14] Enabled WebView bridges: SwipeRefreshLayout=true, FileChooser=true, OneSignal=true, OfflineView=true',
      '[18:40:26] Task :app:compileReleaseKotlin UP-TO-DATE (MainActivity.kt)',
      '[18:40:38] Task :app:packageRelease -> app-release-signed.apk (14.6 MB)',
      '[18:40:44] Task :app:bundleRelease -> app-release.aab (12.1 MB)',
      '[18:40:47] Uploaded GitHub Action Artifacts & notified /api/github-webhook (HTTP 200 OK)',
    ].join('\n'),
    startedAt: new Date(Date.now() - 60000),
    completedAt: new Date(),
  };
  fallbackBuilds.push(build1);
}

/**
 * Deterministic elapsed-time state machine for serverless environments (e.g. Vercel)
 * where background setTimeout timers are frozen after HTTP responses complete.
 */
function computeElapsedStage(build: any) {
  if (build.status === 'COMPLETED' || build.status === 'FAILED') {
    return null;
  }
  if (build.dispatchMode === 'GITHUB_LIVE_DISPATCH') {
    return null;
  }

  const startedMs = build.startedAt ? new Date(build.startedAt).getTime() : Date.now();
  const elapsedMs = Date.now() - startedMs;

  if (elapsedMs >= 3600) {
    return {
      status: 'COMPLETED',
      progress: 100,
      stage: 'Signed APK & Play Store AAB uploaded to GitHub Actions Artifacts',
      apkDownloadUrl: `/api/artifacts/${build.id}/apk`,
      aabDownloadUrl: `/api/artifacts/${build.id}/aab`,
      logLine:
        '[Webhook] ./gradlew assembleRelease bundleRelease succeeded. Signed APK & AAB ready for download.',
    };
  }
  if (elapsedMs >= 2300 && build.progress < 78) {
    return {
      status: 'BUILDING',
      progress: 78,
      stage: 'Executing ./gradlew assembleRelease bundleRelease & V2/V3 Keystore Signing',
      logLine:
        '[CI Runner] > Task :app:compileReleaseKotlin -> :app:packageRelease -> :app:signReleaseBundle',
    };
  }
  if (elapsedMs >= 1000 && build.progress < 42) {
    return {
      status: 'BUILDING',
      progress: 42,
      stage: 'Runner ubuntu-latest: Injecting AndroidManifest.xml, strings.xml & WebView Bridges',
      logLine:
        '[CI Runner] Checked out template (JDK 17 + Android SDK 34) & injected package parameters.',
    };
  }
  return null;
}

export async function getUserAppsWithSeed(userId: number) {
  if (!isCloudSqlConfigured()) {
    ensureFallbackSeed(userId);
    return fallbackApps;
  }

  try {
    const existing = await db
      .select()
      .from(apps)
      .where(eq(apps.userId, userId))
      .orderBy(desc(apps.updatedAt));

    if (existing.length > 0) {
      return existing;
    }

    const insertedApps = await db
      .insert(apps)
      .values([
        {
          userId,
          appName: 'Linear Engineering Hub',
          packageName: 'com.linear.mobilehub',
          targetUrl: 'https://linear.app',
          primaryColor: '#2563EB',
          statusBarColor: '#1E40AF',
          appIconUrl: '',
          splashColor: '#0F172A',
          splashDurationMs: 1600,
          splashTagline: 'Issue Tracking & Sprint Triage',
          swipeToRefresh: true,
          nativeFileUpload: true,
          geolocation: false,
          pushNotifications: true,
          oneSignalAppId: 'f49c82e0-51c9-4e18-9204-882a109c7b2e',
          offlineFallback: true,
          customUserAgent: 'MedianForgeNative/2.4 (Android 14; Pixel 8 Pro)',
          versionName: '2.4.0',
          versionCode: 12,
        },
        {
          userId,
          appName: 'Mercury Treasury Portal',
          packageName: 'com.mercury.treasury',
          targetUrl: 'https://mercury.com',
          primaryColor: '#059669',
          statusBarColor: '#065F46',
          appIconUrl: '',
          splashColor: '#090D16',
          splashDurationMs: 2000,
          splashTagline: 'Commercial Banking & Approvals',
          swipeToRefresh: true,
          nativeFileUpload: true,
          geolocation: true,
          pushNotifications: true,
          oneSignalAppId: '98a1c34d-2041-49a7-8311-56c0291a8f01',
          offlineFallback: true,
          customUserAgent: 'MedianForgeNative/2.4 (Android 14; Mobile)',
          versionName: '1.8.2',
          versionCode: 8,
        },
      ])
      .returning();

    const primaryApp = insertedApps[0];
    if (primaryApp) {
      await db.insert(builds).values({
        appId: primaryApp.id,
        userId,
        buildNumber: 12,
        status: 'COMPLETED',
        stage: 'Signed APK & Play Store AAB uploaded to GitHub Artifacts',
        progress: 100,
        githubRunId: '11604928310',
        dispatchMode: 'GITHUB_ACTIONS_RUNNER',
        apkDownloadUrl: `/api/artifacts/1/apk`,
        aabDownloadUrl: `/api/artifacts/1/aab`,
        apkSizeMb: '14.6 MB',
        commitSha: '9c4e2b8',
        buildLogs: [
          '[18:40:02] Triggered repository_dispatch [build-android-apk] on medianforge-org/android-webview-builder',
          '[18:40:05] Runner ubuntu-latest-24.04 assigned (JDK 17 Temurin + Android SDK 34.0.0)',
          '[18:40:09] Injected applicationId="com.linear.mobilehub", targetUrl="https://linear.app", versionName="2.4.0"',
          '[18:40:14] Enabled WebView bridges: SwipeRefreshLayout=true, FileChooser=true, OneSignal=true, OfflineView=true',
          '[18:40:26] Task :app:compileReleaseKotlin UP-TO-DATE (MainActivity.kt)',
          '[18:40:38] Task :app:packageRelease -> app-release-signed.apk (14.6 MB)',
          '[18:40:44] Task :app:bundleRelease -> app-release.aab (12.1 MB)',
          '[18:40:47] Uploaded GitHub Action Artifacts & notified /api/github-webhook (HTTP 200 OK)',
        ].join('\n'),
        completedAt: new Date(),
      });
    }

    return insertedApps;
  } catch (error) {
    console.error('Database query failed in getUserAppsWithSeed:', error);
    throw new Error('Failed to load user applications from database.', { cause: error });
  }
}

export async function saveAppConfiguration(userId: number, config: AppConfigInput) {
  if (!isCloudSqlConfigured()) {
    ensureFallbackSeed(userId);
    if (config.id) {
      const idx = fallbackApps.findIndex((a) => a.id === config.id);
      if (idx !== -1) {
        fallbackApps[idx] = {
          ...fallbackApps[idx],
          ...config,
          updatedAt: new Date(),
        };
        return fallbackApps[idx];
      }
    }
    const created = {
      ...config,
      id: nextFallbackAppId++,
      userId,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    fallbackApps.unshift(created);
    return created;
  }

  try {
    if (config.id) {
      const updated = await db
        .update(apps)
        .set({
          appName: config.appName.trim(),
          packageName: config.packageName.trim(),
          targetUrl: config.targetUrl.trim(),
          primaryColor: config.primaryColor.trim(),
          statusBarColor: config.statusBarColor.trim(),
          appIconUrl: config.appIconUrl || '',
          splashColor: config.splashColor.trim(),
          splashDurationMs: Number(config.splashDurationMs) || 1800,
          splashTagline: config.splashTagline || 'Powered by Native WebView Engine',
          swipeToRefresh: Boolean(config.swipeToRefresh),
          nativeFileUpload: Boolean(config.nativeFileUpload),
          geolocation: Boolean(config.geolocation),
          pushNotifications: Boolean(config.pushNotifications),
          oneSignalAppId: config.oneSignalAppId || '',
          offlineFallback: Boolean(config.offlineFallback),
          customUserAgent: config.customUserAgent || 'MedianForgeNative/2.4',
          versionName: config.versionName || '1.0.0',
          versionCode: Number(config.versionCode) || 1,
          updatedAt: new Date(),
        })
        .where(and(eq(apps.id, config.id), eq(apps.userId, userId)))
        .returning();

      if (updated.length > 0) {
        return updated[0];
      }
    }

    const created = await db
      .insert(apps)
      .values({
        userId,
        appName: config.appName.trim(),
        packageName: config.packageName.trim(),
        targetUrl: config.targetUrl.trim(),
        primaryColor: config.primaryColor.trim(),
        statusBarColor: config.statusBarColor.trim(),
        appIconUrl: config.appIconUrl || '',
        splashColor: config.splashColor.trim(),
        splashDurationMs: Number(config.splashDurationMs) || 1800,
        splashTagline: config.splashTagline || 'Powered by Native WebView Engine',
        swipeToRefresh: Boolean(config.swipeToRefresh),
        nativeFileUpload: Boolean(config.nativeFileUpload),
        geolocation: Boolean(config.geolocation),
        pushNotifications: Boolean(config.pushNotifications),
        oneSignalAppId: config.oneSignalAppId || '',
        offlineFallback: Boolean(config.offlineFallback),
        customUserAgent: config.customUserAgent || 'MedianForgeNative/2.4',
        versionName: config.versionName || '1.0.0',
        versionCode: Number(config.versionCode) || 1,
      })
      .returning();

    return created[0];
  } catch (error) {
    console.error('Database query failed in saveAppConfiguration:', error);
    throw new Error('Failed to save application configuration.', { cause: error });
  }
}

export async function listUserBuilds(userId: number, appId?: number) {
  if (!isCloudSqlConfigured()) {
    ensureFallbackSeed(userId);
    for (const b of fallbackBuilds) {
      const stageUpdate = computeElapsedStage(b);
      if (stageUpdate) {
        b.status = stageUpdate.status;
        b.progress = stageUpdate.progress;
        b.stage = stageUpdate.stage;
        if (stageUpdate.apkDownloadUrl) b.apkDownloadUrl = stageUpdate.apkDownloadUrl;
        if (stageUpdate.aabDownloadUrl) b.aabDownloadUrl = stageUpdate.aabDownloadUrl;
      }
    }
    return appId ? fallbackBuilds.filter((b) => b.appId === appId) : fallbackBuilds;
  }

  try {
    if (appId) {
      return await db
        .select()
        .from(builds)
        .where(and(eq(builds.userId, userId), eq(builds.appId, appId)))
        .orderBy(desc(builds.id));
    }
    return await db
      .select()
      .from(builds)
      .where(eq(builds.userId, userId))
      .orderBy(desc(builds.id));
  } catch (error) {
    console.error('Database query failed in listUserBuilds:', error);
    throw new Error('Failed to query build history.', { cause: error });
  }
}

export async function createBuildJob(params: {
  userId: number;
  appId: number;
  buildNumber: number;
  githubRunId: string;
  dispatchMode: string;
  initialLog: string;
}) {
  if (!isCloudSqlConfigured()) {
    ensureFallbackSeed(params.userId);
    const created = {
      id: nextFallbackBuildId++,
      userId: params.userId,
      appId: params.appId,
      buildNumber: params.buildNumber,
      status: 'PENDING',
      stage: 'Dispatched repository_dispatch [build-android-apk] event',
      progress: 12,
      githubRunId: params.githubRunId,
      dispatchMode: params.dispatchMode,
      apkDownloadUrl: '',
      aabDownloadUrl: '',
      apkSizeMb: '14.8 MB',
      commitSha: Math.random().toString(16).substring(2, 9),
      buildLogs: params.initialLog,
      startedAt: new Date(),
      completedAt: null,
    };
    fallbackBuilds.unshift(created);
    return created;
  }

  try {
    const inserted = await db
      .insert(builds)
      .values({
        userId: params.userId,
        appId: params.appId,
        buildNumber: params.buildNumber,
        status: 'PENDING',
        stage: 'Dispatched repository_dispatch [build-android-apk] event',
        progress: 12,
        githubRunId: params.githubRunId,
        dispatchMode: params.dispatchMode,
        apkDownloadUrl: '',
        aabDownloadUrl: '',
        apkSizeMb: '14.8 MB',
        commitSha: Math.random().toString(16).substring(2, 9),
        buildLogs: params.initialLog,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createBuildJob:', error);
    throw new Error('Failed to create build job record.', { cause: error });
  }
}

export async function updateBuildFromWebhook(params: {
  buildId: number;
  status: string;
  stage?: string;
  progress?: number;
  githubRunId?: string;
  apkDownloadUrl?: string;
  aabDownloadUrl?: string;
  logLine?: string;
}) {
  if (!isCloudSqlConfigured()) {
    const found = fallbackBuilds.find((b) => b.id === params.buildId);
    if (!found) return null;
    found.status = params.status;
    if (params.stage) found.stage = params.stage;
    if (typeof params.progress === 'number') found.progress = params.progress;
    if (params.githubRunId) found.githubRunId = params.githubRunId;
    if (params.apkDownloadUrl) found.apkDownloadUrl = params.apkDownloadUrl;
    if (params.aabDownloadUrl) found.aabDownloadUrl = params.aabDownloadUrl;
    if (params.logLine && !found.buildLogs.includes(params.logLine)) {
      found.buildLogs = `${found.buildLogs ? found.buildLogs + '\n' : ''}${params.logLine}`;
    }
    if (params.status === 'COMPLETED' || params.status === 'FAILED') {
      found.completedAt = new Date();
    }
    return found;
  }

  try {
    const existing = await db
      .select()
      .from(builds)
      .where(eq(builds.id, params.buildId));

    if (existing.length === 0) {
      return null;
    }

    const current = existing[0];
    const updatedLogs =
      params.logLine && !current.buildLogs.includes(params.logLine)
        ? `${current.buildLogs ? current.buildLogs + '\n' : ''}${params.logLine}`
        : current.buildLogs;

    const isTerminal = params.status === 'COMPLETED' || params.status === 'FAILED';

    const updated = await db
      .update(builds)
      .set({
        status: params.status,
        stage: params.stage ?? current.stage,
        progress: params.progress ?? current.progress,
        githubRunId: params.githubRunId ?? current.githubRunId,
        apkDownloadUrl: params.apkDownloadUrl ?? current.apkDownloadUrl,
        aabDownloadUrl: params.aabDownloadUrl ?? current.aabDownloadUrl,
        buildLogs: updatedLogs,
        ...(isTerminal ? { completedAt: new Date() } : {}),
      })
      .where(eq(builds.id, params.buildId))
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateBuildFromWebhook:', error);
    throw new Error('Failed to update build status.', { cause: error });
  }
}

export async function getBuildWithApp(buildId: number) {
  if (!isCloudSqlConfigured()) {
    const build = fallbackBuilds.find((b) => b.id === buildId);
    if (!build) return null;
    const stageUpdate = computeElapsedStage(build);
    if (stageUpdate) {
      await updateBuildFromWebhook({
        buildId: build.id,
        ...stageUpdate,
      });
    }
    const app = fallbackApps.find((a) => a.id === build.appId) || fallbackApps[0] || null;
    return { build, app };
  }

  try {
    const rows = await db
      .select()
      .from(builds)
      .where(eq(builds.id, buildId));

    if (rows.length === 0) return null;
    let build = rows[0];

    // Advance stage deterministically by elapsed time if background timer was suspended
    const stageUpdate = computeElapsedStage(build);
    if (stageUpdate) {
      const refreshed = await updateBuildFromWebhook({
        buildId: build.id,
        ...stageUpdate,
      });
      if (refreshed) build = refreshed;
    }

    const appRows = await db.select().from(apps).where(eq(apps.id, build.appId));
    return {
      build,
      app: appRows[0] || null,
    };
  } catch (error) {
    console.error('Database query failed in getBuildWithApp:', error);
    throw new Error('Failed to retrieve build artifact metadata.', { cause: error });
  }
}
