import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MarkedText,
  MarkedTextInput,
  MarkedView,
} from '../src/components/Probe';
import { TestIDs } from '../src/testids';

export default function KeyboardScreen() {
  const [text, setText] = useState('');
  return (
    <View style={styles.root}>
      <MarkedView id={TestIDs.kb.container} style={styles.body}>
        <MarkedTextInput
          id={TestIDs.kb.input}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
        <MarkedText id={TestIDs.kb.echo}>{`echo:${text}`}</MarkedText>
      </MarkedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  body: { gap: 16 },
  input: { borderWidth: 1, padding: 8, borderRadius: 4, fontSize: 18 },
});
