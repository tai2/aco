import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { MarkedText, MarkedView } from '../src/components/Probe';
import { TestIDs } from '../src/testids';

export default function Home() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MarkedView id={TestIDs.home.container} style={styles.body}>
        <MarkedText id={TestIDs.home.title} style={styles.title}>
          aco AUT
        </MarkedText>

        <Link href="/elements" asChild>
          <MarkedText id={TestIDs.home.navElements} style={styles.link}>
            Elements
          </MarkedText>
        </Link>
        <Link href="/keyboard" asChild>
          <MarkedText id={TestIDs.home.navKeyboard} style={styles.link}>
            Keyboard
          </MarkedText>
        </Link>
        <Link href="/gestures" asChild>
          <MarkedText id={TestIDs.home.navGestures} style={styles.link}>
            Gestures
          </MarkedText>
        </Link>
        <Link href="/webview" asChild>
          <MarkedText id={TestIDs.home.navWebview} style={styles.link}>
            WebView
          </MarkedText>
        </Link>

        <MarkedText
          id={TestIDs.home.navPermissions}
          style={styles.linkDisabled}
        >
          Permissions (TODO: not yet implemented)
        </MarkedText>
        <MarkedText
          id={TestIDs.home.navOrientation}
          style={styles.linkDisabled}
        >
          Orientation (TODO: not yet implemented)
        </MarkedText>
      </MarkedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  body: { gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  link: { fontSize: 18, color: '#0a66c2', paddingVertical: 8 },
  linkDisabled: { fontSize: 16, color: '#888', paddingVertical: 8 },
});
