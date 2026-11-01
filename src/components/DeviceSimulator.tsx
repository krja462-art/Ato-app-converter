import React, { useState } from 'react';
import {
  RotateCw,
  Upload,
  Bell,
  WifiOff,
  ArrowLeft,
  Compass,
  CheckCircle2,
  MapPin,
  FileText,
  Smartphone,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AppConfigInput } from '../utils/apkBuilderConfig.ts';

interface DeviceSimulatorProps {
  config: AppConfigInput;
}

type PreviewScreenMode = 'webview' | 'splash' | 'offline';

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ config }) => {
  const [screenMode, setScreenMode] = useState<PreviewScreenMode>('webview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([
    config.targetUrl || 'https://linear.app',
    '/projects/mobile-sdk',
  ]);
  const [activeSubPath, setActiveSubPath] = useState<string>('/dashboard');
  const [selectedNativeFile, setSelectedNativeFile] = useState<string | null>(null);
  const [showFileChooserSheet, setShowFileChooserSheet] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [useLiveIframe, setUseLiveIframe] = useState(false);

  const triggerPullToRefresh = () => {
    if (!config.swipeToRefresh) return;
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 900);
  };

  const navigateInternal = (path: string) => {
    setHistoryStack((prev) => [...prev, path]);
    setActiveSubPath(path);
  };

  const handleAndroidBack = () => {
    if (showFileChooserSheet) {
      setShowFileChooserSheet(false);
      return;
    }
    if (screenMode !== 'webview') {
      setScreenMode('webview');
      return;
    }
    if (historyStack.length > 1) {
      const next = historyStack.slice(0, -1);
      setHistoryStack(next);
      setActiveSubPath(next[next.length - 1]);
    }
  };

  const triggerTestPush = () => {
    if (!config.pushNotifications) return;
    setShowPushBanner(true);
    setTimeout(() => {
      setShowPushBanner(false);
    }, 3500);
  };

  const initials = (config.appName || 'App')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col items-center">
      {/* Segmented Preview Mode Selector */}
      <div className="w-full flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
        <div
          role="group"
          aria-label="Android Device Preview Mode"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            onClick={() => {
              setScreenMode('webview');
              setUseLiveIframe(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'webview' && !useLiveIframe
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            WebView Bridge
          </button>
          <button
            type="button"
            onClick={() => {
              setScreenMode('splash');
              setUseLiveIframe(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'splash'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Splash
          </button>
          <button
            type="button"
            onClick={() => {
              setScreenMode('offline');
              setUseLiveIframe(false);
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'offline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Offline
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setScreenMode('webview');
            setUseLiveIframe((prev) => !prev);
          }}
          className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            useLiveIframe
              ? 'bg-slate-900 text-white border-slate-900'
              : 'text-slate-700 hover:text-slate-900 bg-white border-slate-200'
          }`}
        >
          {useLiveIframe ? 'Exit Live Iframe' : 'Live URL Iframe'}
        </button>
      </div>

      {/* Android Pixel 8 Pro Hardware Frame */}
      <div
        data-testid="android-device-frame"
        className="w-[336px] h-[660px] rounded-[38px] bg-slate-950 p-3 shadow-xl border border-slate-800 flex flex-col justify-between relative select-none"
      >
        {/* Top Speaker Cutout */}
        <div className="w-20 h-1.5 bg-slate-800 rounded-full mx-auto mb-1.5" />

        {/* Screen Viewport */}
        <div className="flex-1 w-full rounded-[28px] overflow-hidden bg-white flex flex-col relative border border-slate-900">
          {/* Android Status Bar */}
          <div
            style={{ backgroundColor: config.statusBarColor || '#1D4ED8' }}
            className="px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-white shrink-0"
          >
            <span>09:41</span>
            <div className="w-3 h-3 rounded-full bg-black/40" />
            <span>5G · 100%</span>
          </div>

          {/* OneSignal Heads-up Push Notification Toast */}
          {showPushBanner && (
            <div className="absolute top-8 inset-x-3 z-30 bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700 flex items-start gap-2.5">
              <div
                style={{ backgroundColor: config.primaryColor }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">
                  {config.appName} · OneSignal Push
                </div>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  Release build v{config.versionName} synced with WebView bridge.
                </p>
              </div>
            </div>
          )}

          {/* MODE 1: SPLASH SCREEN */}
          {screenMode === 'splash' && (
            <div
              style={{ backgroundColor: config.splashColor || '#0F172A' }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white"
            >
              {config.appIconUrl ? (
                <img
                  src={config.appIconUrl}
                  alt={`${config.appName} Icon`}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover mb-4 border border-white/15 shadow-md"
                />
              ) : (
                <div
                  style={{ backgroundColor: config.primaryColor || '#2563EB' }}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-md"
                >
                  {initials}
                </div>
              )}
              <h4 className="text-lg font-bold tracking-tight text-white">
                {config.appName || 'Untitled App'}
              </h4>
              <p className="text-xs text-slate-300 mt-1 max-w-[220px]">
                {config.splashTagline || 'Powered by Native WebView Engine'}
              </p>
              <div className="mt-6 text-[11px] font-mono text-slate-400">
                Splash Duration: {config.splashDurationMs}ms · {config.packageName}
              </div>
            </div>
          )}

          {/* MODE 2: OFFLINE FALLBACK SCREEN */}
          {screenMode === 'offline' && (
            <div className="flex-1 bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4 text-slate-300">
                <WifiOff className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">
                {config.appName} is Offline
              </h4>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {config.offlineFallback
                  ? 'Native offlineContainer active. Check your cellular or Wi-Fi connection and retry.'
                  : 'Offline fallback view is currently disabled in Feature Toggles.'}
              </p>
              <button
                type="button"
                onClick={() => setScreenMode('webview')}
                style={{ backgroundColor: config.primaryColor || '#2563EB' }}
                className="mt-5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* MODE 3: INTERACTIVE NATIVE WEBVIEW RUNTIME */}
          {screenMode === 'webview' && (
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
              {/* Native Action Bar / WebView Header */}
              <div
                style={{ backgroundColor: config.primaryColor || '#2563EB' }}
                className="px-3.5 py-2.5 text-white flex items-center justify-between gap-2 shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {config.appIconUrl ? (
                    <img
                      src={config.appIconUrl}
                      alt="App icon"
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-md object-cover shrink-0 border border-white/20"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {config.appName || 'App Preview'}
                    </div>
                    <div className="text-[10px] text-white/80 font-mono truncate">
                      {config.targetUrl || 'https://example.com'}
                    </div>
                  </div>
                </div>

                {config.swipeToRefresh && (
                  <button
                    type="button"
                    onClick={triggerPullToRefresh}
                    aria-label="Simulate Pull to Refresh"
                    className="p-1.5 rounded-md bg-white/15 hover:bg-white/25 transition-colors shrink-0"
                    title="Trigger SwipeRefreshLayout"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* SwipeRefreshLayout Indicator */}
              {isRefreshing && (
                <div className="bg-blue-50 border-b border-blue-100 px-3 py-1.5 text-[11px] font-medium text-blue-800 flex items-center justify-center gap-1.5">
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>SwipeRefreshLayout reloading WebView...</span>
                </div>
              )}

              {/* Content Area: Either Live iframe or Interactive WebView Bridge Inspector */}
              {useLiveIframe ? (
                <div className="flex-1 flex flex-col bg-white relative">
                  <iframe
                    src={config.targetUrl}
                    title={`WebView preview of ${config.appName}`}
                    className="w-full flex-1 border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                  <div className="px-3 py-1.5 bg-slate-900 text-[10px] text-slate-300 flex items-center justify-between">
                    <span className="truncate"> Target: {config.targetUrl}</span>
                    <a
                      href={config.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-left">
                  {/* Simulated Web App Viewport Header */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="truncate">{config.packageName}</span>
                      <span>v{config.versionName}</span>
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-slate-900 truncate">
                      {config.targetUrl}
                      <span className="text-slate-400 font-mono">{activeSubPath}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigateInternal('/dashboard')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          activeSubPath === '/dashboard'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        /dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateInternal('/uploads')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          activeSubPath === '/uploads'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        /uploads
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateInternal('/settings')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          activeSubPath === '/settings'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        /settings
                      </button>
                    </div>
                  </div>

                  {/* Interactive Native Bridge Tester inside WebView */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Test Injected Kotlin WebView Bridges
                    </div>

                    {/* 1. Native File Upload (<input type="file">) */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">
                          onShowFileChooser (&lt;input type="file"&gt;)
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {selectedNativeFile
                            ? `Selected: ${selectedNativeFile}`
                            : config.nativeFileUpload
                            ? 'Enabled · ActivityResultLauncher ready'
                            : 'Disabled in Feature Toggles'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!config.nativeFileUpload}
                        onClick={() => setShowFileChooserSheet(true)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Choose File
                      </button>
                    </div>

                    {/* 2. OneSignal Push Notification Bridge */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">
                          OneSignal Push SDK Bridge
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {config.pushNotifications
                            ? `Active · ${config.oneSignalAppId ? config.oneSignalAppId.slice(0, 12) + '...' : 'Default App ID'}`
                            : 'Disabled in Feature Toggles'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!config.pushNotifications}
                        onClick={triggerTestPush}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Send Push
                      </button>
                    </div>

                    {/* 3. Active Native Capabilities Summary */}
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>SwipeRefresh: {config.swipeToRefresh ? 'On' : 'Off'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Geolocation: {config.geolocation ? 'On' : 'Off'}</span>
                      <span aria-hidden="true">·</span>
                      <span>History Depth: {historyStack.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Simulated Native Android File Chooser Bottom Sheet */}
              {showFileChooserSheet && (
                <div className="absolute inset-0 bg-black/50 z-20 flex flex-col justify-end">
                  <div className="bg-white rounded-t-2xl p-4 space-y-2.5">
                    <div className="text-xs font-bold text-slate-900">
                      Android Intent.ACTION_GET_CONTENT
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Select a local device file to pass back to WebChromeClient ValueCallback:
                    </p>
                    <div className="space-y-1.5">
                      {['invoice_q4_signed.pdf', 'camera_capture_0941.jpg', 'company_logo_vector.png'].map(
                        (fileName) => (
                          <button
                            key={fileName}
                            type="button"
                            onClick={() => {
                              setSelectedNativeFile(fileName);
                              setShowFileChooserSheet(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-mono text-slate-800 flex items-center justify-between"
                          >
                            <span className="truncate">{fileName}</span>
                            <span className="text-[10px] text-blue-600 font-sans font-medium">
                              Select
                            </span>
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFileChooserSheet(false)}
                      className="w-full py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Android System Navigation Bar (Back / Home / Recents) */}
          <div className="bg-slate-950 text-slate-300 px-6 py-2 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleAndroidBack}
              aria-label="Android Back Navigation"
              title="Test OnBackPressedCallback (navigates WebView history)"
              className="p-1 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back ({historyStack.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setScreenMode('webview')}
              aria-label="Android Home"
              className="w-3.5 h-3.5 rounded-full border border-slate-400 hover:border-white transition-colors"
            />
            <button
              type="button"
              onClick={triggerPullToRefresh}
              aria-label="Reload WebView"
              className="text-[11px] hover:text-white transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
