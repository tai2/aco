import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  MarkedPressable,
  MarkedText,
  MarkedView,
} from '../src/components/Probe';
import { TestIDs } from '../src/testids';

export default function GesturesScreen() {
  const [taps, setTaps] = useState(0);
  return (
    <View style={styles.root}>
      <MarkedPressable
        id={TestIDs.gestures.target}
        style={styles.target}
        onPress={() => setTaps((t) => t + 1)}
      >
        <MarkedText id={TestIDs.gestures.taps}>{`taps:${taps}`}</MarkedText>
      </MarkedPressable>

      <ScrollView
        testID={TestIDs.gestures.scroll}
        accessibilityLabel={TestIDs.gestures.scroll}
        style={styles.scroll}
      >
        {Array.from({ length: 30 }, (_, i) => {
          const rowId = TestIDs.gestures.row(i);
          return (
            <MarkedView id={rowId} key={rowId} style={styles.row}>
              <MarkedText
                id={TestIDs.gestures.rowText(i)}
              >{`row ${i}`}</MarkedText>
            </MarkedView>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  target: {
    padding: 20,
    backgroundColor: '#0a66c2',
    alignItems: 'center',
  },
  scroll: { flex: 1, padding: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
});
