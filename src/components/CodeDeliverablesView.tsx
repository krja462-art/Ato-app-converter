import React, { useState, useEffect } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import {
  AppConfigInput,
  generateGithubWorkflowYaml,
  generateMainActivityKt,
  generateActivityMainXml,
} from '../utils/apkBuilderConfig.ts';
import {
  SQL_POSTGRES_SCHEMA,
  PRISMA_SCHEMA_MODEL,
  EXPRESS_BACKEND_SNIPPET,
} from '../utils/architectureReference.ts';

export type DeliverableTab =
  | 'github-workflow'
  | 'kotlin-main'
  | 'xml-layout'
  | 'backend-api'
  | 'db-schema';

interface CodeDeliverablesViewProps {
  config: AppConfigInput;
  initialTab?: DeliverableTab;
}

export const CodeDeliverablesView: React.FC<CodeDeliverablesViewProps> = ({
  config,
  initialTab = 'github-workflow',
}) => {
  const [activeTab, setActiveTab] = useState<DeliverableTab>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const workflowYaml = generateGithubWorkflowYaml(config);
  const kotlinCode = generateMainActivityKt(config);
  const xmlLayout = generateActivityMainXml(config);
  const combinedSchema = `${SQL_POSTGRES_SCHEMA}\n\n${PRISMA_SCHEMA_MODEL}`;

  const getActiveContent = (): { title: string; filename: string; code: string; description: string } => {
    switch (activeTab) {
      case 'github-workflow':
        return {
          title: 'Automated GitHub Actions Build Engine',
          filename: '.github/workflows/build-apk.yml',
          description:
            'Triggered via repository_dispatch [build-android-apk]. Checks out the Android template, injects App Name, Package ID, URL, and Colors via sed/CLI, compiles release APK & AAB via Gradle, and invokes /api/github-webhook.',
          code: workflowYaml,
        };
      case 'kotlin-main':
        return {
          title: 'Android Kotlin WebView Activity',
          filename: `app/src/main/java/${config.packageName.replace(/\./g, '/')}/MainActivity.kt`,
          description:
            'Configured with JavaScript, DOM Storage, CookieManager, SwipeRefreshLayout, ActivityResultContracts file chooser for <input type="file">, geolocation permissions, and OnBackPressedCallback WebView history navigation.',
          code: kotlinCode,
        };
      case 'xml-layout':
        return {
          title: 'Android ConstraintLayout & SwipeRefreshLayout XML',
          filename: 'app/src/main/res/layout/activity_main.xml',
          description:
            'Defines the fullscreen SwipeRefreshLayout wrapping the native WebView alongside the native offline fallback container and retry action.',
          code: xmlLayout,
        };
      case 'backend-api':
        return {
          title: 'Node.js / Express CI/CD Dispatch & Webhook Receiver',
          filename: 'server.ts (/api/trigger-build & /api/github-webhook)',
          description:
            'Authenticates users, persists project configurations in PostgreSQL, triggers GitHub Actions via REST API with a Personal Access Token, and processes incoming webhook completion events.',
          code: EXPRESS_BACKEND_SNIPPET,
        };
      case 'db-schema':
        return {
          title: 'PostgreSQL DDL & Prisma ORM Schema (Users, Apps, Builds)',
          filename: 'prisma/schema.prisma & migrations/001_init.sql',
          description:
            'Complete relational schema modeling Users, Web-to-App configurations, feature toggles, and CI/CD Build artifacts.',
          code: combinedSchema,
        };
    }
  };

  const activeSpec = getActiveContent();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSpec.code);
      setCopiedKey(activeTab);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Fallback
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeSpec.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeSpec.filename.split('/').pop() || 'deliverable.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Segmented Deliverable Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div
          role="tablist"
          aria-label="Engineering Deliverables"
          className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'github-workflow'}
            onClick={() => setActiveTab('github-workflow')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'github-workflow'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. GitHub Actions (build-apk.yml)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kotlin-main'}
            onClick={() => setActiveTab('kotlin-main')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'kotlin-main'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Kotlin WebView (MainActivity.kt)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'xml-layout'}
            onClick={() => setActiveTab('xml-layout')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'xml-layout'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Layout XML (activity_main.xml)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backend-api'}
            onClick={() => setActiveTab('backend-api')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'backend-api'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Backend API (/api/trigger-build)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'db-schema'}
            onClick={() => setActiveTab('db-schema')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'db-schema'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5. Database Schema (SQL & Prisma)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copiedKey === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Source</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadFile}
            className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
        </div>
      </div>

      {/* Code Panel */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{activeSpec.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{activeSpec.description}</p>
          </div>
          <span className="text-xs font-mono text-slate-300">{activeSpec.filename}</span>
        </div>
        <pre className="p-5 text-xs font-mono text-slate-100 overflow-x-auto leading-relaxed max-h-[560px]">
          <code>{activeSpec.code}</code>
        </pre>
      </div>

      {/* Step-by-Step DevOps Implementation Guide */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-bold text-slate-900">
          Step-by-Step Production DevOps Implementation Guide
        </h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-blue-600">01. Template Repository Setup</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Push <code className="font-mono text-slate-800">MainActivity.kt</code>,{' '}
              <code className="font-mono text-slate-800">activity_main.xml</code>, and{' '}
              <code className="font-mono text-slate-800">.github/workflows/build-apk.yml</code> to a
              dedicated GitHub repository. Add <code className="font-mono text-slate-800">ANDROID_KEYSTORE_BASE64</code>{' '}
              and <code className="font-mono text-slate-800">WEBHOOK_SHARED_SECRET</code> in GitHub Actions Secrets.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-blue-600">02. Personal Access Token (PAT)</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Generate a Fine-Grained GitHub PAT with <code className="font-mono text-slate-800">Contents: Read & Write</code>{' '}
              and <code className="font-mono text-slate-800">Actions: Read & Write</code> permissions. Set{' '}
              <code className="font-mono text-slate-800">GITHUB_PAT</code>, <code className="font-mono text-slate-800">GITHUB_OWNER</code>,
              and <code className="font-mono text-slate-800">GITHUB_REPO</code> in the backend environment.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-blue-600">03. Repository Dispatch Trigger</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a user clicks <strong>Build Release APK</strong>, the Express backend persists the
              app config in PostgreSQL and sends a <code className="font-mono text-slate-800">repository_dispatch</code>{' '}
              POST request with <code className="font-mono text-slate-800">client_payload</code> containing the
              build ID, URL, package ID, and feature flags.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-blue-600">04. Webhook Artifact Sync</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              As the Ubuntu runner executes <code className="font-mono text-slate-800">./gradlew assembleRelease bundleRelease</code>,
              it posts live progress and final signed artifact URLs back to{' '}
              <code className="font-mono text-slate-800">/api/github-webhook</code>, updating PostgreSQL and
              unlocking instant APK/AAB downloads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
