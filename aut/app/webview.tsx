import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MarkedView } from '../src/components/Probe';
import { TestIDs } from '../src/testids';

// The page is bundled as a static asset (metro.config.js registers .html) and
// loaded by its on-device file:// URL. RNCWebView routes host-less URLs
// through loadFileURL, and a real file URL -- unlike an inline-HTML
// about:blank document -- is surfaced by Appium as a WEBVIEW_* context.
const HTML_ASSET = Asset.fromModule(require('../assets/webview.html'));

export default function WebViewScreen() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    HTML_ASSET.downloadAsync().then(() => {
      setUri(HTML_ASSET.localUri ?? HTML_ASSET.uri);
    });
  }, []);

  return (
    <View style={styles.root}>
      <MarkedView id={TestIDs.webview.container} style={styles.root}>
        {uri && (
          <WebView
            testID={TestIDs.webview.iframe}
            originWhitelist={['*']}
            source={{ uri }}
            allowFileAccess
            // iOS 16.4+ hides WKWebViews from remote inspection by default, so
            // Appium never surfaces a WEBVIEW_* context without this.
            webviewDebuggingEnabled
          />
        )}
      </MarkedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
