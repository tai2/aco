import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MarkedView } from '../src/components/Probe';
import { TestIDs } from '../src/testids';

const HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui;padding:24px">
  <h1 id="webview.title">webview</h1>
  <button id="webview.button" onclick="document.getElementById('webview.output').innerText='clicked'">
    Click me
  </button>
  <output id="webview.output">idle</output>
</body></html>`;

export default function WebViewScreen() {
  return (
    <View style={styles.root}>
      <MarkedView id={TestIDs.webview.container} style={styles.root}>
        <WebView
          testID={TestIDs.webview.iframe}
          originWhitelist={['*']}
          source={{ html: HTML }}
        />
      </MarkedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
