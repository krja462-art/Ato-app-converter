export interface AppConfigInput {
  id?: number;
  appName: string;
  packageName: string;
  targetUrl: string;
  primaryColor: string;
  statusBarColor: string;
  appIconUrl?: string | null;
  splashColor: string;
  splashDurationMs: number;
  splashTagline: string;
  swipeToRefresh: boolean;
  nativeFileUpload: boolean;
  geolocation: boolean;
  pushNotifications: boolean;
  oneSignalAppId?: string | null;
  offlineFallback: boolean;
  customUserAgent?: string | null;
  versionName: string;
  versionCode: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const PACKAGE_NAME_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function validateAppConfig(config: Partial<AppConfigInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!config.appName || config.appName.trim().length < 2) {
    errors.appName = 'App Name must be at least 2 characters.';
  }

  if (!config.packageName || !PACKAGE_NAME_REGEX.test(config.packageName.trim())) {
    errors.packageName =
      'Package Name must follow Android reverse-domain format (e.g. com.company.app).';
  }

  if (!config.targetUrl || !config.targetUrl.trim()) {
    errors.targetUrl = 'Target Web App URL is required.';
  } else {
    try {
      const parsed = new URL(config.targetUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.targetUrl = 'Target URL must start with https:// or http://.';
      }
    } catch {
      errors.targetUrl = 'Enter a valid full URL including https://.';
    }
  }

  if (!config.primaryColor || !HEX_COLOR_REGEX.test(config.primaryColor.trim())) {
    errors.primaryColor = 'Primary Color must be a 6-digit hex code (e.g. #2563EB).';
  }

  if (config.splashColor && !HEX_COLOR_REGEX.test(config.splashColor.trim())) {
    errors.splashColor = 'Splash Color must be a 6-digit hex code (e.g. #0F172A).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function sanitizePackagePath(packageName: string): string {
  const clean = PACKAGE_NAME_REGEX.test(packageName.trim())
    ? packageName.trim()
    : 'com.company.webviewapp';
  return clean.replace(/\./g, '/');
}

export function generateGithubWorkflowYaml(config: AppConfigInput): string {
  return `name: Automated Android APK & AAB Builder

on:
  repository_dispatch:
    types: [build-android-apk]

env:
  JAVA_VERSION: '17'
  ANDROID_COMPILE_SDK: '34'
  ANDROID_BUILD_TOOLS: '34.0.0'

jobs:
  compile-android-release:
    name: Inject Config & Build Signed APK (${config.appName})
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout Android WebView Template Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Set up JDK \${{ env.JAVA_VERSION }}
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: \${{ env.JAVA_VERSION }}
          cache: 'gradle'

      - name: Setup Android SDK CLI Tools
        uses: android-actions/setup-android@v3

      - name: Notify Backend Webhook (BUILDING Stage)
        run: |
          curl -sS -X POST "\${{ github.event.client_payload.webhook_url }}" \\
            -H "Content-Type: application/json" \\
            -H "X-Webhook-Secret: \${{ secrets.WEBHOOK_SHARED_SECRET }}" \\
            -d '{
              "build_id": "\${{ github.event.client_payload.build_id }}",
              "github_run_id": "\${{ github.run_id }}",
              "status": "BUILDING",
              "stage": "Injecting Android Manifest, Package ID & WebView Config",
              "progress": 38
            }' || true

      - name: Dynamically Inject App Parameters (sed / xmlstarlet / ImageMagick)
        env:
          APP_NAME: \${{ github.event.client_payload.app_name }}
          PACKAGE_NAME: \${{ github.event.client_payload.package_name }}
          TARGET_URL: \${{ github.event.client_payload.target_url }}
          PRIMARY_COLOR: \${{ github.event.client_payload.primary_color }}
          STATUS_BAR_COLOR: \${{ github.event.client_payload.status_bar_color }}
          SPLASH_COLOR: \${{ github.event.client_payload.splash_color }}
          SWIPE_REFRESH: \${{ github.event.client_payload.swipe_to_refresh }}
          FILE_UPLOAD: \${{ github.event.client_payload.native_file_upload }}
          GEOLOCATION: \${{ github.event.client_payload.geolocation }}
          PUSH_ENABLED: \${{ github.event.client_payload.push_notifications }}
          ONESIGNAL_APP_ID: \${{ github.event.client_payload.onesignal_app_id }}
          OFFLINE_FALLBACK: \${{ github.event.client_payload.offline_fallback }}
          VERSION_NAME: \${{ github.event.client_payload.version_name }}
          VERSION_CODE: \${{ github.event.client_payload.version_code }}
          ICON_URL: \${{ github.event.client_payload.app_icon_url }}
        run: |
          set -euo pipefail
          echo "==> Injecting configuration for \$APP_NAME (\$PACKAGE_NAME)"

          # 1. Update applicationId, versionCode, and versionName in app/build.gradle.kts
          sed -i "s|applicationId = \\".*\\"|applicationId = \\"\$PACKAGE_NAME\\"|g" app/build.gradle.kts
          sed -i "s|versionCode = [0-9]*|versionCode = \$VERSION_CODE|g" app/build.gradle.kts
          sed -i "s|versionName = \\".*\\"|versionName = \\"\$VERSION_NAME\\"|g" app/build.gradle.kts

          # 2. Inject strings.xml values (App Name & Target URL)
          ESCAPED_NAME=\$(printf '%s\\n' "\$APP_NAME" | sed -e 's/[\\/&]/\\\\&/g')
          sed -i "s|<string name=\\"app_name\\">.*</string>|<string name=\\"app_name\\">\$ESCAPED_NAME</string>|g" app/src/main/res/values/strings.xml
          sed -i "s|<string name=\\"target_url\\">.*</string>|<string name=\\"target_url\\">\$TARGET_URL</string>|g" app/src/main/res/values/strings.xml

          # 3. Inject colors.xml (Primary, Status Bar & Splash Background)
          sed -i "s|<color name=\\"colorPrimary\\">.*</color>|<color name=\\"colorPrimary\\">\$PRIMARY_COLOR</color>|g" app/src/main/res/values/colors.xml
          sed -i "s|<color name=\\"colorPrimaryDark\\">.*</color>|<color name=\\"colorPrimaryDark\\">\$STATUS_BAR_COLOR</color>|g" app/src/main/res/values/colors.xml
          sed -i "s|<color name=\\"splashBackground\\">.*</color>|<color name=\\"splashBackground\\">\$SPLASH_COLOR</color>|g" app/src/main/res/values/colors.xml

          # 4. Write runtime feature flags into app/src/main/assets/app_config.json
          mkdir -p app/src/main/assets
          cat <<EOF > app/src/main/assets/app_config.json
          {
            "appName": "\$APP_NAME",
            "packageName": "\$PACKAGE_NAME",
            "targetUrl": "\$TARGET_URL",
            "primaryColor": "\$PRIMARY_COLOR",
            "swipeToRefresh": \$SWIPE_REFRESH,
            "nativeFileUpload": \$FILE_UPLOAD,
            "geolocation": \$GEOLOCATION,
            "pushNotifications": \$PUSH_ENABLED,
            "oneSignalAppId": "\$ONESIGNAL_APP_ID",
            "offlineFallback": \$OFFLINE_FALLBACK
          }
          EOF

          # 5. Download & resize custom App Icon into mipmap densities if provided
          if [ -n "\$ICON_URL" ] && [[ "\$ICON_URL" == http* ]]; then
            curl -L "\$ICON_URL" -o /tmp/raw_icon.png
            for density in "mdpi:48" "hdpi:72" "xhdpi:96" "xxhdpi:144" "xxxhdpi:192"; do
              dir="app/src/main/res/mipmap-\${density%%:*}"
              size="\${density##*:}"
              mkdir -p "\$dir"
              convert /tmp/raw_icon.png -resize "\${size}x\${size}" "\$dir/ic_launcher.png"
            done
          fi

      - name: Decode Release Keystore & Sign Configuration
        env:
          KEYSTORE_BASE64: \${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: |
          if [ -n "\$KEYSTORE_BASE64" ]; then
            echo "\$KEYSTORE_BASE64" | base64 --decode > app/release-key.jks
          else
            keytool -genkeypair -v -keystore app/release-key.jks -alias release \\
              -keyalg RSA -keysize 2048 -validity 10000 \\
              -storepass androidrelease -keypass androidrelease \\
              -dname "CN=MedianForge CI, OU=Mobile, O=SaaS, L=Singapore, S=SG, C=SG"
          fi

      - name: Compile Signed Release APK & Play Store AAB with Gradle
        run: |
          chmod +x ./gradlew
          ./gradlew assembleRelease bundleRelease --no-daemon --stacktrace

      - name: Upload Compiled Release APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: release-apk-\${{ github.event.client_payload.build_id }}
          path: app/build/outputs/apk/release/*.apk
          retention-days: 30

      - name: Upload Play Store Bundle (AAB) Artifact
        uses: actions/upload-artifact@v4
        with:
          name: release-aab-\${{ github.event.client_payload.build_id }}
          path: app/build/outputs/bundle/release/*.aab
          retention-days: 30

      - name: Notify SaaS Backend Webhook on Completion
        if: always()
        run: |
          FINAL_STATUS="COMPLETED"
          if [ "\${{ job.status }}" != "success" ]; then
            FINAL_STATUS="FAILED"
          fi
          curl -sS -X POST "\${{ github.event.client_payload.webhook_url }}" \\
            -H "Content-Type: application/json" \\
            -H "X-Webhook-Secret: \${{ secrets.WEBHOOK_SHARED_SECRET }}" \\
            -d "{
              \\"build_id\\": \\"\${{ github.event.client_payload.build_id }}\\",
              \\"github_run_id\\": \\"\${{ github.run_id }}\\",
              \\"status\\": \\"\$FINAL_STATUS\\",
              \\"stage\\": \\"Gradle assembleRelease & bundleRelease finished\\",
              \\"progress\\": 100,
              \\"apk_download_url\\": \\"https://github.com/\${{ github.repository }}/actions/runs/\${{ github.run_id }}\\#artifacts\\",
              \\"aab_download_url\\": \\"https://github.com/\${{ github.repository }}/actions/runs/\${{ github.run_id }}\\#artifacts\\"
            }"
`;
}

export function generateMainActivityKt(config: AppConfigInput): string {
  const pkg = PACKAGE_NAME_REGEX.test(config.packageName.trim())
    ? config.packageName.trim()
    : 'com.company.app';

  return `package ${pkg}

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var offlineContainer: LinearLayout
    private lateinit var retryButton: Button

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Configuration injected via CI/CD build-apk.yml pipeline
    private val targetUrl: String = "${config.targetUrl}"
    private val enableSwipeRefresh: Boolean = ${config.swipeToRefresh}
    private val enableNativeFileUpload: Boolean = ${config.nativeFileUpload}
    private val enableGeolocation: Boolean = ${config.geolocation}
    private val enableOfflineFallback: Boolean = ${config.offlineFallback}
    private val enablePushNotifications: Boolean = ${config.pushNotifications}
    private val oneSignalAppId: String = "${config.oneSignalAppId || 'ONESIGNAL-APP-ID'}"

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        var results: Array<Uri>? = null

        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val dataString = result.data?.dataString
            val clipData = result.data?.clipData
            if (clipData != null) {
                results = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (dataString != null) {
                results = arrayOf(Uri.parse(dataString))
            }
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("${config.statusBarColor}")
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        offlineContainer = findViewById(R.id.offlineContainer)
        retryButton = findViewById(R.id.retryButton)

        configureSwipeRefresh()
        configureWebView()
        configureBackNavigation()

        retryButton.setOnClickListener {
            if (isNetworkAvailable()) {
                offlineContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
                webView.reload()
            }
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadApplicationUrl()
        }
    }

    private fun configureSwipeRefresh() {
        swipeRefreshLayout.isEnabled = enableSwipeRefresh
        swipeRefreshLayout.setColorSchemeColors(Color.parseColor("${config.primaryColor}"))
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }
        webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            if (enableSwipeRefresh) {
                swipeRefreshLayout.isEnabled = (scrollY == 0)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = enableNativeFileUpload
            allowContentAccess = enableNativeFileUpload
            setGeolocationEnabled(enableGeolocation)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            userAgentString = "\$userAgentString ${config.customUserAgent || 'MedianForgeNative/2.4'}"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                offlineContainer.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && enableOfflineFallback) {
                    swipeRefreshLayout.isRefreshing = false
                    webView.visibility = View.GONE
                    offlineContainer.visibility = View.VISIBLE
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Native File Upload Chooser for <input type="file">
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (!enableNativeFileUpload) return false
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                return try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    fileChooserLauncher.launch(Intent.createChooser(intent, "Select File to Upload"))
                    true
                } catch (e: Exception) {
                    fileUploadCallback = null
                    false
                }
            }

            // Native HTML5 Geolocation Permission Bridge
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (!enableGeolocation) {
                    callback?.invoke(origin, false, false)
                    return
                }
                val hasFineLocation = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                callback?.invoke(origin, hasFineLocation, false)
            }
        }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun loadApplicationUrl() {
        if (!isNetworkAvailable() && enableOfflineFallback) {
            webView.visibility = View.GONE
            offlineContainer.visibility = View.VISIBLE
        } else {
            webView.visibility = View.VISIBLE
            offlineContainer.visibility = View.GONE
            webView.loadUrl(targetUrl)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }
}
`;
}

export function generateActivityMainXml(config: AppConfigInput): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="${config.splashColor}">

    <!-- Pull-to-Refresh + Fullscreen Native WebView -->
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefreshLayout"
        android:layout_width="0dp"
        android:layout_height="0dp"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">

        <WebView
            android:id="@+id/webView"
            android:layout_width="match_parent"
            android:layout_height="match_parent" />

    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

    <!-- Native Offline Fallback Container -->
    <LinearLayout
        android:id="@+id/offlineContainer"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:orientation="vertical"
        android:gravity="center"
        android:padding="32dp"
        android:visibility="gone"
        android:background="#0F172A"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="${config.appName} is Offline"
            android:textColor="#F8FAFC"
            android:textSize="20sp"
            android:textStyle="bold" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:gravity="center"
            android:text="Check your cellular or Wi-Fi connection and try again."
            android:textColor="#94A3B8"
            android:textSize="14sp" />

        <Button
            android:id="@+id/retryButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="24dp"
            android:backgroundTint="${config.primaryColor}"
            android:text="Retry Connection"
            android:textColor="#FFFFFF" />

    </LinearLayout>

</androidx.constraintlayout.widget.ConstraintLayout>
`;
}
