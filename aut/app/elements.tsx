import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MarkedPressable,
  MarkedText,
  MarkedTextInput,
  MarkedView,
} from '../src/components/Probe';
import { TestIDs } from '../src/testids';

export default function ElementsScreen() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.root}>
      <MarkedView id={TestIDs.elements.container} style={styles.body}>
        <MarkedText id={TestIDs.elements.label}>Static label</MarkedText>

        <MarkedTextInput
          id={TestIDs.elements.input}
          defaultValue="initial-value"
          style={styles.input}
        />

        <MarkedPressable
          id={TestIDs.elements.button}
          onPress={() => setCount((c) => c + 1)}
          style={styles.btn}
        >
          <MarkedText id={TestIDs.elements.buttonText}>Tap me</MarkedText>
        </MarkedPressable>

        <MarkedText id={TestIDs.elements.counter}>{`taps:${count}`}</MarkedText>
      </MarkedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  body: { gap: 16 },
  input: { borderWidth: 1, padding: 8, borderRadius: 4 },
  btn: {
    backgroundColor: '#0a66c2',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
});
