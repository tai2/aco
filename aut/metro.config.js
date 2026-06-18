const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle .html as a static asset so the WebView screen can load it via a
// file:// URL (expo-asset resolves the on-device path). A real file URL is
// surfaced as a WEBVIEW_* context by Appium, unlike inline-HTML/about:blank.
config.resolver.assetExts.push('html');

module.exports = config;
