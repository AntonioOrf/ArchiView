import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColori } from '../theme';

export function Schermo({ children, conBarra }: { children: ReactNode; conBarra?: boolean }) {
  const c = useColori();
  const margini = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase, paddingBottom: conBarra ? 0 : margini.bottom }}>
      <View style={{ height: margini.top, backgroundColor: c.bgPanel }} />
      {children}
    </View>
  );
}
