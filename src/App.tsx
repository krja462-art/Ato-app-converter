import React, { useEffect, useState, useRef } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  Play,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Plus,
  Upload,
  Terminal,
  Webhook,
  LogIn,
  LogOut,
  FileCode2,
  Layers,
  Smartphone,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { AppConfigInput, validateAppConfig } from './utils/apkBuilderConfig.ts';
import { DeviceSimulator } from './components/DeviceSimulator.tsx';
import { CodeDeliverablesView } from './components/CodeDeliverablesView.tsx';

interface BuildRecord {
  id: number;
  appId: number;
  userId: number;
  buildNumber: number;
  status: 'PENDING' | 'BUILDING' | 'COMPLETED' | 'FAILED';
  stage: string;
  progress: number;
  githubRunId: string;
  dispatchMode: string;
  apkDownloadUrl: string;
  aabDownloadUrl: string;
  apkSizeMb: string;
  commitSha: string;
  buildLogs: string;
  startedAt: string;
  completedAt?: string;
}

type WorkspaceSection = 'studio' | 'builds' | 'deliverables' | 'architecture';

const DEFAULT_NEW_APP: AppConfigInput = {
  appName: 'Acme Field Ops',
  packageName: 'com.acme.fieldops',
  targetUrl: 'https://app.acme.io',
  primaryColor: '#2563EB',
  statusBarColor: '#1E40AF',
  appIconUrl: '',
  splashColor: '#0F172A',
  splashDurationMs: 1800,
  splashTagline: 'Enterprise Mobile Workspace',
  swipeToRefresh: true,
  nativeFileUpload: true,
  geolocation: true,
  pushNotifications: true,
  oneSignalAppId: '771a2b3c-9988-44ef-b123-9876543210ab',
  offlineFallback: true,
  customUserAgent: 'MedianForgeNative/2.4 (Android; Mobile)',
  versionName: '1.0.0',
  versionCode: 1,
};

function createSvgIconDataUrl(bgHex: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <rect width="192" height="192" rx="42" fill="${bgHex}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-weight="700" font-size="72">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('studio');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const authTokenRef = useRef<string>('demo-sandbox-token');

  const [appsList, setAppsList] = useState<AppConfigInput[]>([]);
  const [formConfig, setFormConfig] = useState<AppConfigInput>(DEFAULT_NEW_APP);
  const [buildsList, setBuildsList] = useState<BuildRecord[]>([]);
  const [activeBuild, setActiveBuild] = useState<BuildRecord | null>(null);

  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTriggeringBuild, setIsTriggeringBuild] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Webhook Simulator State
  const [webhookStatusInput, setWebhookStatusInput] = useState<'BUILDING' | 'COMPLETED' | 'FAILED'>('COMPLETED');
  const [webhookStageInput, setWebhookStageInput] = useState<string>(
    'Manual Webhook Callback: Signed release.apk verified'
  );
  const [isSendingWebhook, setIsSendingWebhook] = useState<boolean>(false);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (auth.currentUser) {
      try {
        const freshToken = await auth.currentUser.getIdToken();
        authTokenRef.current = freshToken;
      } catch {
        // fallback to current ref
      }
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authTokenRef.current}`,
    };
  };

  const fetchWorkspaceData = async () => {
    setIsLoadingWorkspace(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/me', { headers });
      if (!res.ok) {
        throw new Error('Failed to load workspace projects');
      }
      const data = await res.json();
      const loadedApps: AppConfigInput[] = data.apps || [];
      const loadedBuilds: BuildRecord[] = data.builds || [];

      setAppsList(loadedApps);
      setBuildsList(loadedBuilds);

      if (loadedApps.length > 0) {
        setFormConfig(loadedApps[0]);
      }
      if (loadedBuilds.length > 0) {
        setActiveBuild(loadedBuilds[0]);
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err.message || 'Could not synchronize workspace data.',
      });
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        authTokenRef.current = await user.getIdToken();
      } else {
        authTokenRef.current = 'demo-sandbox-token';
      }
      fetchWorkspaceData();
    });
    return () => unsubscribe();
  }, []);

  // Poll active build progress while status is PENDING or BUILDING
  useEffect(() => {
    if (!activeBuild) return;
    if (activeBuild.status !== 'PENDING' && activeBuild.status !== 'BUILDING') return;

    const timer = setInterval(async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/builds/${activeBuild.id}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (data.build) {
          setActiveBuild(data.build);
          setBuildsList((prev) =>
            prev.map((b) => (b.id === data.build.id ? data.build : b))
          );
        }
      } catch {
        // Ignore transient polling error
      }
    }, 850);

    return () => clearInterval(timer);
  }, [activeBuild?.id, activeBuild?.status]);

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      authTokenRef.current = await cred.user.getIdToken();
      setStatusBanner({
        type: 'success',
        text: `Signed in with Google as ${cred.user.email}`,
      });
      await fetchWorkspaceData();
    } catch (err: any) {
      setStatusBanner({
        type: 'info',
        text: 'Google Sign-In popup closed. Continuing in authenticated Cloud SQL workspace.',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    authTokenRef.current = 'demo-sandbox-token';
    setStatusBanner({
      type: 'info',
      text: 'Switched to Sandbox Workspace session.',
    });
  };

  const handleSaveConfiguration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const check = validateAppConfig(formConfig);
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'Please resolve the highlighted configuration fields before saving.',
      });
      return;
    }

    setIsSaving(true);
    setStatusBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers,
        body: JSON.stringify(formConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      const saved: AppConfigInput = data.app;
      setFormConfig(saved);
      setAppsList((prev) => {
        const exists = prev.some((a) => a.id === saved.id);
        return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
      });
      setStatusBanner({
        type: 'success',
        text: `Saved "${saved.appName}" (${saved.packageName}) to Cloud SQL PostgreSQL.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err.message || 'Error saving configuration',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerBuild = async () => {
    const check = validateAppConfig(formConfig);
    setValidationErrors(check.errors);
    if (!check.valid) {
      setActiveSection('studio');
      setStatusBanner({
        type: 'error',
        text: 'Fix invalid App Configuration fields before triggering an APK build.',
      });
      return;
    }

    setIsTriggeringBuild(true);
    setStatusBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/trigger-build', {
        method: 'POST',
        headers,
        body: JSON.stringify(formConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger GitHub Actions build');
      }

      const createdBuild: BuildRecord = data.build;
      const savedApp: AppConfigInput = data.app;

      setFormConfig(savedApp);
      setActiveBuild(createdBuild);
      setBuildsList((prev) => [createdBuild, ...prev]);
      setAppsList((prev) => {
        const exists = prev.some((a) => a.id === savedApp.id);
        return exists ? prev.map((a) => (a.id === savedApp.id ? savedApp : a)) : [savedApp, ...prev];
      });
      setStatusBanner({
        type: 'success',
        text: `Build #${createdBuild.buildNumber} dispatched to GitHub Actions (Run ID ${createdBuild.githubRunId}).`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err.message || 'Failed to trigger build pipeline',
      });
    } finally {
      setIsTriggeringBuild(false);
    }
  };

  const handleIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormConfig((prev) => ({ ...prev, appIconUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendManualWebhook = async () => {
    const targetBuild = activeBuild || buildsList[0];
    if (!targetBuild) return;

    setIsSendingWebhook(true);
    try {
      const res = await fetch('/api/github-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          build_id: targetBuild.id,
          github_run_id: targetBuild.githubRunId,
          status: webhookStatusInput,
          stage: webhookStageInput,
          progress: webhookStatusInput === 'BUILDING' ? 68 : 100,
          log_line: `[Manual Webhook Test] POST /api/github-webhook -> status=${webhookStatusInput} (${webhookStageInput})`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.build) {
        setActiveBuild(data.build);
        setBuildsList((prev) => prev.map((b) => (b.id === data.build.id ? data.build : b)));
        setStatusBanner({
          type: 'success',
          text: `Webhook processed for Build #${data.build.buildNumber}: status is now ${data.build.status}.`,
        });
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err.message || 'Failed to invoke /api/github-webhook',
      });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const handleCreateNewProject = () => {
    setValidationErrors({});
    setFormConfig({
      ...DEFAULT_NEW_APP,
      id: undefined,
      appName: 'Notion Team Wiki',
      packageName: 'com.notion.teamwiki',
      targetUrl: 'https://www.notion.so',
      primaryColor: '#0F172A',
      statusBarColor: '#020617',
    });
    setStatusBanner({
      type: 'info',
      text: 'Initialized new Web-to-App configuration template. Click Save Configuration or Build Release APK.',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (4 Nav Links) — Zone 3 (1 Primary CTA) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8 sticky top-0 z-30">
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('studio');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          MedianForge
        </a>

        <nav
          aria-label="Primary Workspace Navigation"
          className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => setActiveSection('studio')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'studio'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            App Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('builds')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'builds'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            CI/CD Builds ({buildsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('deliverables')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'deliverables'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Kotlin & YAML Source
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('architecture')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'architecture'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Architecture Blueprint
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTriggerBuild}
            disabled={isTriggeringBuild}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
          >
            {isTriggeringBuild ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Build Release APK</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Workspace Context Toolbar (Project Switcher + Auth Account + Live Build Status Bar) */}
        <section
          aria-label="Project Switcher and Account Toolbar"
          className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="project-select" className="text-xs font-semibold text-slate-700">
              Active Project:
            </label>
            <select
              id="project-select"
              value={formConfig.id || ''}
              onChange={(e) => {
                const selectedId = Number(e.target.value);
                const found = appsList.find((a) => a.id === selectedId);
                if (found) {
                  setFormConfig(found);
                  setValidationErrors({});
                }
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {!formConfig.id && (
                <option value="">Unsaved Draft — {formConfig.appName}</option>
              )}
              {appsList.map((appItem) => (
                <option key={appItem.id} value={appItem.id}>
                  {appItem.appName} ({appItem.packageName})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNewProject}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New App Project</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Account:</span>
              <strong className="font-semibold text-slate-900">
                {firebaseUser ? firebaseUser.email : 'alex.rivera@medianforge.io (Cloud SQL Sandbox)'}
              </strong>
              <span aria-hidden="true">·</span>
              {firebaseUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-slate-600 hover:text-slate-900 underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Notification Feedback Banner */}
        {statusBanner && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-4 ${
              statusBanner.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs underline opacity-75 hover:opacity-100 whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live GitHub Actions Build Status Progress Bar (Pending -> Building -> Completed/Failed) */}
        {activeBuild && (
          <section
            aria-label="Live APK Build Pipeline Status"
            data-testid="live-build-status-bar"
            className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <span>Build #{activeBuild.buildNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>GitHub Run ID: {activeBuild.githubRunId}</span>
                  <span aria-hidden="true">·</span>
                  <span>Commit: {activeBuild.commitSha}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                  {activeBuild.status === 'COMPLETED' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  {activeBuild.status === 'FAILED' && (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  {(activeBuild.status === 'PENDING' || activeBuild.status === 'BUILDING') && (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  )}
                  <span>
                    Pipeline Status: {activeBuild.status} — {activeBuild.stage}
                  </span>
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeBuild.status === 'COMPLETED' && (
                  <>
                    <a
                      href={activeBuild.apkDownloadUrl || `/api/artifacts/${activeBuild.id}/apk`}
                      download
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Release .APK ({activeBuild.apkSizeMb || '14.8 MB'})</span>
                    </a>
                    <a
                      href={activeBuild.aabDownloadUrl || `/api/artifacts/${activeBuild.id}/aab`}
                      download
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Play Store .AAB</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSection('builds')}
                  className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  View Runner Logs
                </button>
              </div>
            </div>

            {/* Step-by-Step Progress Bar: Pending -> Building -> Completed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 tabular-nums">
                <div className="flex items-center gap-4">
                  <span
                    className={
                      activeBuild.progress >= 5 ? 'text-blue-600 font-semibold' : 'text-slate-400'
                    }
                  >
                    1. Pending (repository_dispatch)
                  </span>
                  <span aria-hidden="true">→</span>
                  <span
                    className={
                      activeBuild.status === 'BUILDING' || activeBuild.progress >= 30
                        ? 'text-blue-600 font-semibold'
                        : 'text-slate-400'
                    }
                  >
                    2. Building (Manifest Injection & Gradle Assemble)
                  </span>
                  <span aria-hidden="true">→</span>
                  <span
                    className={
                      activeBuild.status === 'COMPLETED'
                        ? 'text-emerald-600 font-semibold'
                        : activeBuild.status === 'FAILED'
                        ? 'text-red-600 font-semibold'
                        : 'text-slate-400'
                    }
                  >
                    3. {activeBuild.status === 'FAILED' ? 'Failed' : 'Completed (Artifact Signed)'}
                  </span>
                </div>
                <span className="font-mono font-semibold text-slate-900">
                  {activeBuild.progress}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(5, activeBuild.progress))}%` }}
                  className={`h-full transition-all duration-300 ${
                    activeBuild.status === 'COMPLETED'
                      ? 'bg-emerald-600'
                      : activeBuild.status === 'FAILED'
                      ? 'bg-red-600'
                      : 'bg-blue-600'
                  }`}
                />
              </div>
            </div>
          </section>
        )}

        {/* VIEW 1: APP STUDIO (Configuration Form + Feature Toggles + Live Mobile Preview) */}
        {activeSection === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Configuration Form & Feature Toggles */}
            <form
              onSubmit={handleSaveConfiguration}
              className="lg:col-span-7 space-y-6"
              noValidate
            >
              {/* Card 1: Target URL & Identity */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      01. Web Application Source & Android Package Identity
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Injected dynamically into <code className="font-mono">strings.xml</code>,{' '}
                      <code className="font-mono">build.gradle.kts</code>, and{' '}
                      <code className="font-mono">MainActivity.kt</code> during GitHub Actions compilation.
                    </p>
                  </div>
                </div>

                {/* Target URL Input Box with Quick Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="target-url-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Target Web Application URL
                    </label>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Quick load:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormConfig((prev) => ({
                            ...prev,
                            targetUrl: 'https://linear.app',
                          }))
                        }
                        className="text-blue-600 hover:underline font-mono"
                      >
                        linear.app
                      </button>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormConfig((prev) => ({
                            ...prev,
                            targetUrl: 'https://docs.stripe.com',
                          }))
                        }
                        className="text-blue-600 hover:underline font-mono"
                      >
                        docs.stripe.com
                      </button>
                    </div>
                  </div>
                  <input
                    id="target-url-input"
                    type="url"
                    required
                    value={formConfig.targetUrl}
                    onChange={(e) =>
                      setFormConfig((prev) => ({ ...prev, targetUrl: e.target.value }))
                    }
                    placeholder="https://app.yourcompany.com"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {validationErrors.targetUrl && (
                    <p className="text-xs text-red-600 font-medium">{validationErrors.targetUrl}</p>
                  )}
                </div>

                {/* App Name & Package Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="app-name-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Application Display Name
                    </label>
                    <input
                      id="app-name-input"
                      type="text"
                      required
                      value={formConfig.appName}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, appName: e.target.value }))
                      }
                      placeholder="Acme Workspace"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {validationErrors.appName && (
                      <p className="text-xs text-red-600 font-medium">{validationErrors.appName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="package-name-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Android Package ID (applicationId)
                    </label>
                    <input
                      id="package-name-input"
                      type="text"
                      required
                      value={formConfig.packageName}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, packageName: e.target.value }))
                      }
                      placeholder="com.company.app"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {validationErrors.packageName && (
                      <p className="text-xs text-red-600 font-medium">
                        {validationErrors.packageName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Version Name & Version Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="version-name-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Release Version Name
                    </label>
                    <input
                      id="version-name-input"
                      type="text"
                      value={formConfig.versionName}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, versionName: e.target.value }))
                      }
                      placeholder="1.0.0"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="version-code-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Play Store Version Code (Integer)
                    </label>
                    <input
                      id="version-code-input"
                      type="number"
                      min={1}
                      value={formConfig.versionCode}
                      onChange={(e) =>
                        setFormConfig((prev) => ({
                          ...prev,
                          versionCode: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Branding, Colors, App Icon & Splash Screen */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    02. Theme Colors, App Icon & Splash Screen Settings
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configures Android <code className="font-mono">colors.xml</code>, mipmap launcher
                    densities, and cold-boot launch screen appearance.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="primary-color-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Primary Theme Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Primary Theme Color Picker"
                        value={formConfig.primaryColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                      />
                      <input
                        id="primary-color-input"
                        type="text"
                        value={formConfig.primaryColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="status-bar-color-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Status Bar Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Status Bar Color Picker"
                        value={formConfig.statusBarColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, statusBarColor: e.target.value }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                      />
                      <input
                        id="status-bar-color-input"
                        type="text"
                        value={formConfig.statusBarColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, statusBarColor: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="splash-color-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Splash Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Splash Background Color Picker"
                        value={formConfig.splashColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, splashColor: e.target.value }))
                        }
                        className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                      />
                      <input
                        id="splash-color-input"
                        type="text"
                        value={formConfig.splashColor}
                        onChange={(e) =>
                          setFormConfig((prev) => ({ ...prev, splashColor: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* App Icon Upload & Generator Presets */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {formConfig.appIconUrl ? (
                      <img
                        src={formConfig.appIconUrl}
                        alt="Uploaded App Icon"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div
                        style={{ backgroundColor: formConfig.primaryColor || '#2563EB' }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      >
                        {(formConfig.appName || 'AP').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Adaptive Launcher Icon (512×512 PNG)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Auto-resized into mdpi, hdpi, xhdpi, xxhdpi, and xxxhdpi mipmap folders.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="app-icon-upload"
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Icon</span>
                      <input
                        id="app-icon-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleIconFileUpload}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormConfig((prev) => ({
                          ...prev,
                          appIconUrl: createSvgIconDataUrl(
                            prev.primaryColor || '#2563EB',
                            (prev.appName || 'MF').slice(0, 2).toUpperCase()
                          ),
                        }))
                      }
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Generate Monogram Icon
                    </button>
                  </div>
                </div>

                {/* Splash Screen Tagline & Delay */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="splash-tagline-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Splash Screen Subtitle / Tagline
                    </label>
                    <input
                      id="splash-tagline-input"
                      type="text"
                      value={formConfig.splashTagline}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, splashTagline: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="splash-duration-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Splash Hold Duration (ms)
                    </label>
                    <input
                      id="splash-duration-input"
                      type="number"
                      step={200}
                      min={400}
                      max={5000}
                      value={formConfig.splashDurationMs}
                      onChange={(e) =>
                        setFormConfig((prev) => ({
                          ...prev,
                          splashDurationMs: Number(e.target.value) || 1800,
                        }))
                      }
                      className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Native Bridge Feature Toggles */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    03. Native Android WebView Capabilities & Feature Toggles
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toggles native Kotlin bridges in <code className="font-mono">MainActivity.kt</code>{' '}
                    and Android permissions in <code className="font-mono">AndroidManifest.xml</code>.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Swipe to Refresh */}
                  <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Swipe-to-Refresh (SwipeRefreshLayout)
                      </div>
                      <p className="text-xs text-slate-500">
                        Wraps the Android WebView in <code className="font-mono">androidx.swiperefreshlayout.widget.SwipeRefreshLayout</code> for native pull-down page reloads.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formConfig.swipeToRefresh}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, swipeToRefresh: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  {/* Native File Upload */}
                  <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Native File Upload & Camera Chooser (&lt;input type="file"&gt;)
                      </div>
                      <p className="text-xs text-slate-500">
                        Implements <code className="font-mono">WebChromeClient.onShowFileChooser</code> with <code className="font-mono">ActivityResultContracts.StartActivityForResult</code>.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formConfig.nativeFileUpload}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, nativeFileUpload: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  {/* Geolocation */}
                  <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Native GPS & HTML5 Geolocation Bridge
                      </div>
                      <p className="text-xs text-slate-500">
                        Adds <code className="font-mono">ACCESS_FINE_LOCATION</code> permission and bridges <code className="font-mono">navigator.geolocation</code> prompts.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formConfig.geolocation}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, geolocation: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  {/* Push Notifications (OneSignal) */}
                  <div className="py-3 space-y-2.5">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          Push Notifications (OneSignal Android FCM SDK)
                        </div>
                        <p className="text-xs text-slate-500">
                          Initializes OneSignal SDK v5 on application launch with notification permission prompts on Android 13+.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formConfig.pushNotifications}
                        onChange={(e) =>
                          setFormConfig((prev) => ({
                            ...prev,
                            pushNotifications: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                      />
                    </label>
                    {formConfig.pushNotifications && (
                      <div className="pl-0 sm:pl-4 pt-1">
                        <label
                          htmlFor="onesignal-id-input"
                          className="block text-[11px] font-semibold text-slate-700 mb-1"
                        >
                          OneSignal App ID (UUID)
                        </label>
                        <input
                          id="onesignal-id-input"
                          type="text"
                          value={formConfig.oneSignalAppId || ''}
                          onChange={(e) =>
                            setFormConfig((prev) => ({ ...prev, oneSignalAppId: e.target.value }))
                          }
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                        />
                      </div>
                    )}
                  </div>

                  {/* Offline Fallback Page */}
                  <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Native Offline Fallback View
                      </div>
                      <p className="text-xs text-slate-500">
                        Intercepts <code className="font-mono">onReceivedError</code> and network disconnect states to render a native Android retry screen instead of a browser error page.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formConfig.offlineFallback}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, offlineFallback: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Form Action Footer */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Configuration to PostgreSQL</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerBuild}
                    disabled={isTriggeringBuild}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
                  >
                    {isTriggeringBuild ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Build APK via GitHub Actions</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Right 5 Columns: Sticky Interactive Android Mobile Frame Preview */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Interactive Android WebView Preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live reflection of theme, bridges, file chooser, and back history.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">API 34 · Pixel 8</span>
              </div>

              <DeviceSimulator config={formConfig} />
            </aside>
          </div>
        )}

        {/* VIEW 2: CI/CD BUILDS & WEBHOOK CONSOLE */}
        {activeSection === 'builds' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 Columns: Build History Table & Live Logs */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        GitHub Actions APK / AAB Build History
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Persisted in Cloud SQL PostgreSQL and updated via{' '}
                        <code className="font-mono">/api/github-webhook</code>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerBuild}
                      disabled={isTriggeringBuild}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Trigger New Build</span>
                    </button>
                  </div>

                  {buildsList.length === 0 ? (
                    <div className="p-8 text-center space-y-3">
                      <p className="text-sm text-slate-600">
                        No APK builds have been triggered yet for this project.
                      </p>
                      <button
                        type="button"
                        onClick={handleTriggerBuild}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg"
                      >
                        Trigger First APK Build
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                            <th className="py-2.5 px-4">Build</th>
                            <th className="py-2.5 px-4">Status & Stage</th>
                            <th className="py-2.5 px-4">GitHub Run ID</th>
                            <th className="py-2.5 px-4 text-right">Progress</th>
                            <th className="py-2.5 px-4 text-right">Artifacts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {buildsList.map((b) => (
                            <tr
                              key={b.id}
                              onClick={() => setActiveBuild(b)}
                              className={`cursor-pointer transition-colors ${
                                activeBuild?.id === b.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                                #{b.buildNumber}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{b.status}</div>
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {b.stage}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                                {b.githubRunId}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                                {b.progress}%
                              </td>
                              <td className="py-3 px-4 text-right">
                                {b.status === 'COMPLETED' ? (
                                  <div className="inline-flex items-center gap-2">
                                    <a
                                      href={b.apkDownloadUrl || `/api/artifacts/${b.id}/apk`}
                                      download
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-blue-600 hover:underline font-semibold"
                                    >
                                      .APK
                                    </a>
                                    <span aria-hidden="true" className="text-slate-300">
                                      ·
                                    </span>
                                    <a
                                      href={b.aabDownloadUrl || `/api/artifacts/${b.id}/aab`}
                                      download
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-slate-700 hover:underline font-medium"
                                    >
                                      .AAB
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">In progress</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Selected Build Runner Console Output */}
                {activeBuild && (
                  <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold text-white">
                        Ubuntu Runner Console Output — Build #{activeBuild.buildNumber} (Run{' '}
                        {activeBuild.githubRunId})
                      </span>
                      <span className="font-mono">{activeBuild.status}</span>
                    </div>
                    <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {activeBuild.buildLogs || 'Waiting for runner log stream...'}
                    </pre>
                  </div>
                )}
              </div>

              {/* Right 4 Columns: Interactive GitHub Webhook Simulator (/api/github-webhook) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Webhook Receiver Tester (/api/github-webhook)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Simulate an incoming webhook callback from the GitHub Actions runner to test
                      PostgreSQL build status transitions and artifact URL persistence.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="webhook-status-select"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Webhook Status Payload
                      </label>
                      <select
                        id="webhook-status-select"
                        value={webhookStatusInput}
                        onChange={(e) =>
                          setWebhookStatusInput(
                            e.target.value as 'BUILDING' | 'COMPLETED' | 'FAILED'
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      >
                        <option value="COMPLETED">COMPLETED (100% + Artifact Links)</option>
                        <option value="BUILDING">BUILDING (68% Gradle Compilation)</option>
                        <option value="FAILED">FAILED (Gradle Task Error)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="webhook-stage-input"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Stage Message
                      </label>
                      <input
                        id="webhook-stage-input"
                        type="text"
                        value={webhookStageInput}
                        onChange={(e) => setWebhookStageInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSendManualWebhook}
                      disabled={isSendingWebhook || !activeBuild}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isSendingWebhook
                        ? 'Dispatching Webhook...'
                        : `Send POST /api/github-webhook (Build #${activeBuild?.buildNumber || 1})`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3 & 4: KOTLIN TEMPLATE, GITHUB WORKFLOW & ARCHITECTURE BLUEPRINT */}
        {(activeSection === 'deliverables' || activeSection === 'architecture') && (
          <CodeDeliverablesView
            config={formConfig}
            initialTab={activeSection === 'architecture' ? 'db-schema' : 'github-workflow'}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-12">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>MedianForge Web-to-App SaaS Platform · Automated GitHub Actions APK/AAB Builder</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('deliverables')}
              className="hover:text-slate-900 transition-colors"
            >
              build-apk.yml
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('deliverables')}
              className="hover:text-slate-900 transition-colors"
            >
              MainActivity.kt
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('architecture')}
              className="hover:text-slate-900 transition-colors"
            >
              PostgreSQL & Prisma Schema
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
