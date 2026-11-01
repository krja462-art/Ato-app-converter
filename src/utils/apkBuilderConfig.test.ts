import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAppConfig,
  sanitizePackagePath,
  generateGithubWorkflowYaml,
  generateMainActivityKt,
  generateActivityMainXml,
  AppConfigInput,
} from './apkBuilderConfig';

const sampleConfig: AppConfigInput = {
  appName: 'Linear Workspace',
  packageName: 'com.linear.mobileapp',
  targetUrl: 'https://linear.app',
  primaryColor: '#2563EB',
  statusBarColor: '#1D4ED8',
  appIconUrl: '',
  splashColor: '#0F172A',
  splashDurationMs: 1800,
  splashTagline: 'Native Android Client',
  swipeToRefresh: true,
  nativeFileUpload: true,
  geolocation: true,
  pushNotifications: true,
  oneSignalAppId: '771a2b3c-9988-44ef-b123-9876543210ab',
  offlineFallback: true,
  customUserAgent: 'MedianForgeNative/2.4',
  versionName: '1.2.0',
  versionCode: 4,
};

test('validateAppConfig accepts valid Android Web-to-App configuration', () => {
  const res = validateAppConfig(sampleConfig);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, {});
});

test('validateAppConfig rejects invalid package name and invalid URL', () => {
  const res = validateAppConfig({
    ...sampleConfig,
    appName: 'A',
    packageName: 'InvalidPackageName',
    targetUrl: 'ftp://bad-url',
    primaryColor: 'blue',
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.appName);
  assert.ok(res.errors.packageName);
  assert.ok(res.errors.targetUrl);
  assert.ok(res.errors.primaryColor);
});

test('sanitizePackagePath converts reverse domain package into directory path', () => {
  assert.equal(sanitizePackagePath('com.linear.mobileapp'), 'com/linear/mobileapp');
});

test('generateGithubWorkflowYaml embeds repository_dispatch and Gradle assembleRelease', () => {
  const yaml = generateGithubWorkflowYaml(sampleConfig);
  assert.match(yaml, /repository_dispatch:/);
  assert.match(yaml, /types: \[build-android-apk\]/);
  assert.match(yaml, /assembleRelease bundleRelease/);
  assert.match(yaml, /actions\/upload-artifact@v4/);
});

test('generateMainActivityKt includes package declaration, SwipeRefreshLayout, file chooser, and back handling', () => {
  const kt = generateMainActivityKt(sampleConfig);
  assert.match(kt, /package com\.linear\.mobileapp/);
  assert.match(kt, /SwipeRefreshLayout/);
  assert.match(kt, /onShowFileChooser/);
  assert.match(kt, /OnBackPressedCallback/);
  assert.match(kt, /webView\.canGoBack\(\)/);
});

test('generateActivityMainXml includes SwipeRefreshLayout, WebView, and offlineContainer', () => {
  const xml = generateActivityMainXml(sampleConfig);
  assert.match(xml, /SwipeRefreshLayout/);
  assert.match(xml, /android:id="@\+id\/webView"/);
  assert.match(xml, /android:id="@\+id\/offlineContainer"/);
});
