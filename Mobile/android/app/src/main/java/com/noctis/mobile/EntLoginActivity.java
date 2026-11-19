package com.noctis.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

public class EntLoginActivity extends AppCompatActivity {
    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_SCHOOL_NAME = "schoolName";

    public static final String RESULT_URL = "url";
    public static final String RESULT_USERNAME = "username";
    public static final String RESULT_TOKEN = "token";
    public static final String RESULT_DEVICE_UUID = "deviceUUID";

    private static final String MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    private static final String DESKTOP_UA =
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    private static final String INFO_MOBILE_QUERY =
        "/InfoMobileApp.json?id=0D264427-EEFC-4810-A9E9-346942A862A4";
    private static final String LYCEE_CONNECTE_EDUCONNECT =
        "https://educonnect.education.gouv.fr/idp/profile/SAML2/Unsolicited/SSO?providerId=https%3A%2F%2Fmon.lyceeconnecte.fr%2Fauth%2Fsaml%2Fmetadata%2Fidp.xml";
    private static final String LYCEE_CONNECTE_DIRECT =
        "https://mon.lyceeconnecte.fr/auth/login#/";

    private WebView webView;
    private TextView statusText;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private String deviceUUID;
    private volatile String pronoteBaseUrl = null;
    private volatile boolean launchingMobile = false;
    private volatile boolean discoveryRan = false;
    private volatile boolean settled = false;
    private volatile int mobileLaunchCount = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        deviceUUID = UUID.randomUUID().toString();
        String mode = getIntent().getStringExtra(EXTRA_MODE);
        if (mode == null) mode = "lyceeconnecte-educonnect";
        String initialUrl = getIntent().getStringExtra(EXTRA_URL);
        String schoolName = getIntent().getStringExtra(EXTRA_SCHOOL_NAME);

        // Root dark layout
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#060608"));

        // Dark top bar
        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setBackgroundColor(Color.parseColor("#0B0B10"));
        topBar.setPadding(24, 36, 24, 24);

        Button closeBtn = new Button(this);
        closeBtn.setText("Annuler");
        closeBtn.setTextColor(Color.parseColor("#D4D4DC"));
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setAllCaps(false);
        closeBtn.setOnClickListener(v -> {
            setResult(Activity.RESULT_CANCELED);
            finish();
        });

        statusText = new TextView(this);
        statusText.setTextColor(Color.parseColor("#F4F4F6"));
        statusText.setTextSize(14f);
        statusText.setPadding(16, 0, 8, 0);
        statusText.setText(schoolName != null && !schoolName.isEmpty() ? schoolName : "Connexion Lycée Connecté");
        LinearLayout.LayoutParams tvParams = new LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        );
        statusText.setLayoutParams(tvParams);

        topBar.addView(statusText);
        topBar.addView(closeBtn);
        root.addView(topBar);

        webView = new WebView(this);
        LinearLayout.LayoutParams wvParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        );
        webView.setLayoutParams(wvParams);
        webView.setBackgroundColor(Color.parseColor("#060608"));
        root.addView(webView);
        setContentView(root);

        // Configure isolated cookies + modern WebView settings
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(null);
        cm.flush();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUserAgentString(MOBILE_UA);
        settings.setSupportMultipleWindows(false);

        webView.addJavascriptInterface(new AndroidBridge(), "__noctisAndroidBridge");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!settled && !launchingMobile && pronoteBaseUrl == null
                    && !url.contains("mobile.eleve.html")
                    && !url.contains("InfoMobileApp.json")
                    && !url.contains("daCas")) {
                    String detected = extractPronoteBaseUrl(url);
                    if (detected != null) {
                        launchMobileHandshake(detected);
                        return true;
                    }
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (url != null && url.contains("mobile.eleve.html")) {
                    injectHook(view);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (settled || url == null) return;

                if (url.contains("mobile.eleve.html")) {
                    updateStatus("Validation PRONOTE en cours…");
                    injectHook(view);
                    injectLoginWatcher(view);
                    return;
                }

                if (isAuthenticatedLyceeConnecteUrl(url)) {
                    if (pronoteBaseUrl != null) {
                        updateStatus("Retour automatique vers PRONOTE…");
                        mainHandler.postDelayed(() -> {
                            if (!settled && pronoteBaseUrl != null) {
                                launchMobileHandshake(pronoteBaseUrl);
                            }
                        }, 350);
                        return;
                    }
                    if (!discoveryRan) {
                        discoveryRan = true;
                        updateStatus("Détection automatique de PRONOTE…");
                        injectLyceeConnecteDiscovery(view);
                    }
                    return;
                }

                if (url.toLowerCase().contains("/pronote/eleve.html")) {
                    String detected = extractPronoteBaseUrl(url);
                    if (detected != null) {
                        launchMobileHandshake(detected);
                    }
                }
            }
        });

        if ("url".equals(mode) && initialUrl != null && !initialUrl.isEmpty()) {
            pronoteBaseUrl = cleanBaseUrl(initialUrl);
            launchMobileHandshake(pronoteBaseUrl);
        } else if ("lyceeconnecte-direct".equals(mode)) {
            updateStatus("Connexion Lycée Connecté…");
            webView.getSettings().setUserAgentString(DESKTOP_UA);
            webView.loadUrl(LYCEE_CONNECTE_DIRECT);
        } else {
            updateStatus("Connexion ÉduConnect (Lycée Connecté)…");
            webView.getSettings().setUserAgentString(DESKTOP_UA);
            webView.loadUrl(LYCEE_CONNECTE_EDUCONNECT);
        }
    }

    private void updateStatus(String text) {
        mainHandler.post(() -> {
            if (statusText != null) statusText.setText(text);
        });
    }

    private String cleanBaseUrl(String raw) {
        String s = raw.trim();
        s = s.replaceAll("/[^/]+\\.html.*$", "");
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    private String extractPronoteBaseUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) return null;
        try {
            Uri uri = Uri.parse(rawUrl);
            for (String p : new String[] { "service", "callback", "url", "redirect", "target" }) {
                String nested = uri.getQueryParameter(p);
                if (nested != null && !nested.isEmpty()) {
                    String found = extractPronoteBaseUrl(nested);
                    if (found != null) return found;
                }
            }
            String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
            if (host.contains("lyceeconnecte") || host.contains("educonnect")
                || host.contains("nouvelle-aquitaine.fr") || host.contains("education.gouv.fr")) {
                return null;
            }
            String scheme = uri.getScheme() != null ? uri.getScheme() : "https";
            String path = uri.getPath() != null ? uri.getPath() : "";
            Pattern pat = Pattern.compile("^(.*?/pronote)(?:/|$)", Pattern.CASE_INSENSITIVE);
            Matcher m = pat.matcher(path);
            if (m.find()) {
                return scheme + "://" + uri.getHost() + m.group(1);
            }
            if (host.contains("index-education.net")) {
                return scheme + "://" + uri.getHost() + "/pronote";
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isAuthenticatedLyceeConnecteUrl(String rawUrl) {
        try {
            Uri uri = Uri.parse(rawUrl);
            if (!"mon.lyceeconnecte.fr".equalsIgnoreCase(uri.getHost())) return false;
            String p = uri.getPath() != null ? uri.getPath().toLowerCase() : "/";
            return !(p.equals("/") || p.startsWith("/auth/") || p.startsWith("/cas/")
                || p.startsWith("/assets/") || p.startsWith("/public/"));
        } catch (Exception e) {
            return false;
        }
    }

    private JSONObject fetchInfoMobile(String baseUrl) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl + INFO_MOBILE_QUERY);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", MOBILE_UA);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            if (conn.getResponseCode() != 200) return null;
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void launchMobileHandshake(String targetBaseUrl) {
        if (settled || launchingMobile || mobileLaunchCount >= 4) return;
        launchingMobile = true;
        mobileLaunchCount++;
        final String cleaned = cleanBaseUrl(targetBaseUrl);
        pronoteBaseUrl = cleaned;
        updateStatus("PRONOTE détecté — connexion…");

        executor.execute(() -> {
            String jetonCas = null;
            JSONObject info = fetchInfoMobile(cleaned);
            if (info != null) {
                JSONObject cas = info.optJSONObject("CAS");
                if (cas != null) {
                    String tok = cas.optString("jetonCAS", "");
                    if (!tok.isEmpty()) jetonCas = tok;
                }
            }
            final String finalJeton = jetonCas;
            mainHandler.post(() -> {
                if (settled || isFinishing()) return;
                CookieManager cm = CookieManager.getInstance();
                Uri parsed = Uri.parse(cleaned);
                String origin = parsed.getScheme() + "://" + parsed.getHost();
                if (finalJeton != null) {
                    cm.setCookie(origin, "appliMobile=; Max-Age=0; Path=/");
                    cm.setCookie(origin, "validationAppliMobile=" + finalJeton + "; Path=/; Secure; SameSite=None");
                    cm.setCookie(origin, "uuidAppliMobile=" + deviceUUID + "; Path=/; Secure; SameSite=None");
                    cm.setCookie(origin, "ielang=1036; Path=/; Secure; SameSite=None");
                } else {
                    cm.setCookie(origin, "appliMobile=1; Path=/; Secure; SameSite=None");
                    cm.setCookie(origin, "ielang=1036; Path=/; Secure; SameSite=None");
                }
                cm.flush();
                webView.getSettings().setUserAgentString(MOBILE_UA);
                launchingMobile = false;
                webView.loadUrl(cleaned + "/mobile.eleve.html?fd=1");
            });
        });
    }

    private void injectHook(WebView view) {
        String js = "(function(){ window.hookAccesDepuisAppli = function(){ try{ this.passerEnModeValidationAppliMobile('', '"
            + deviceUUID + "'); }catch(e){} }; })();";
        view.evaluateJavascript(js, null);
    }

    private void injectLoginWatcher(WebView view) {
        String js = "(function(){"
            + "if(window.__noctisAndroidWatcher) return;"
            + "window.__noctisAndroidWatcher = true;"
            + "function check(){"
            + "  try{ if(window.GInterface && window.GInterface.passerEnModeValidationAppliMobile && !window.__noctisTrig){"
            + "    window.__noctisTrig = true;"
            + "    window.GInterface.passerEnModeValidationAppliMobile('', '" + deviceUUID + "', '', '', '{\"model\":\"Noctis\",\"platform\":\"android\"}');"
            + "  }}catch(e){}"
            + "  var st = window.loginState;"
            + "  if(st && st.status === 0 && st.login && st.mdp && window.__noctisAndroidBridge){"
            + "    window.__noctisAndroidBridge.onLoginState(String(st.login), String(st.mdp));"
            + "  }"
            + "}"
            + "check(); setInterval(check, 350);"
            + "})();";
        view.evaluateJavascript(js, null);
    }

    private void injectLyceeConnecteDiscovery(WebView view) {
        String js = "(function(){"
            + "if(window.__noctisDisc) return; window.__noctisDisc = true;"
            + "function findUrl(str){"
            + "  if(!str) return null;"
            + "  var m = str.match(/https?:\\/\\/[a-z0-9.-]+\\.index-education\\.net(?:\\/[^\\s\"'&<>]*)?/i);"
            + "  if(m) return m[0];"
            + "  var enc = str.match(/https?%3A%2F%2F[a-z0-9.%-]+\\.index-education\\.net(?:%2F[^\\s\"'&<>]*)?/i);"
            + "  if(enc){ try{ return decodeURIComponent(enc[0]); }catch(e){} }"
            + "  return null;"
            + "}"
            + "async function run(){"
            + "  try{"
            + "    var r = await fetch('/appregistry/applications',{credentials:'include'});"
            + "    if(r.ok){"
            + "      var data = await r.json();"
            + "      var arr = Array.isArray(data) ? data : (data && data.apps ? data.apps : []);"
            + "      for(var i=0;i<arr.length;i++){"
            + "        var u = findUrl(JSON.stringify(arr[i]));"
            + "        if(u && window.__noctisAndroidBridge){ window.__noctisAndroidBridge.onPronoteUrl(u); return; }"
            + "      }"
            + "      for(var j=0;j<arr.length;j++){"
            + "        var nm = ((arr[j].name||arr[j].displayName||arr[j].address)||'').toLowerCase();"
            + "        if(nm.indexOf('pronote')>-1 && arr[j].address){ window.location.assign(arr[j].address); return; }"
            + "      }"
            + "    }"
            + "  }catch(e){}"
            + "  var uais = [];"
            + "  var eps = ['/auth/oauth2/userinfo','/userbook/api/person'];"
            + "  for(var k=0;k<eps.length;k++){"
            + "    try{"
            + "      var rr = await fetch(eps[k],{credentials:'include'});"
            + "      if(rr.ok){"
            + "        var txt = await rr.text();"
            + "        var u2 = findUrl(txt);"
            + "        if(u2 && window.__noctisAndroidBridge){ window.__noctisAndroidBridge.onPronoteUrl(u2); return; }"
            + "        var ms = txt.match(/\\b\\d{7}[A-Za-z]\\b/g);"
            + "        if(ms){ for(var x=0;x<ms.length;x++) uais.push(ms[x].toUpperCase()); }"
            + "      }"
            + "    }catch(e){}"
            + "  }"
            + "  if(uais.length>0 && window.__noctisAndroidBridge){ window.__noctisAndroidBridge.onUais(uais.join(',')); }"
            + "}"
            + "run();"
            + "})();";
        view.evaluateJavascript(js, null);
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void onLoginState(String login, String mdp) {
            if (settled) return;
            String resolved = pronoteBaseUrl;
            if (resolved == null) return;
            settled = true;
            mainHandler.post(() -> {
                Intent data = new Intent();
                data.putExtra(RESULT_URL, resolved);
                data.putExtra(RESULT_USERNAME, login);
                data.putExtra(RESULT_TOKEN, mdp);
                data.putExtra(RESULT_DEVICE_UUID, deviceUUID);
                setResult(Activity.RESULT_OK, data);
                finish();
            });
        }

        @JavascriptInterface
        public void onPronoteUrl(String rawUrl) {
            if (settled) return;
            String base = extractPronoteBaseUrl(rawUrl);
            if (base != null) {
                launchMobileHandshake(base);
            }
        }

        @JavascriptInterface
        public void onUais(String csv) {
            if (settled || pronoteBaseUrl != null || csv == null) return;
            String[] parts = csv.split(",");
            executor.execute(() -> {
                for (String raw : parts) {
                    String uai = raw.trim().toLowerCase();
                    if (!uai.matches("^\\d{7}[a-z]$")) continue;
                    String candidate = "https://" + uai + ".index-education.net/pronote";
                    if (fetchInfoMobile(candidate) != null && !settled && pronoteBaseUrl == null) {
                        launchMobileHandshake(candidate);
                        return;
                    }
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();
        if (webView != null) {
            webView.destroy();
        }
    }
}
