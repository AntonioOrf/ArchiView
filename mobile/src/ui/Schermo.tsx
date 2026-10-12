// Contenitore di ogni schermata. Android 16 disegna l'app sotto le barre di sistema
// (edge-to-edge): la fascia in alto prende il colore dell'intestazione, e senza barra in fondo
// si lascia libero lo spazio della navigazione a gesti.

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
