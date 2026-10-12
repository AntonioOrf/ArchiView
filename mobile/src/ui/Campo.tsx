// Il `.form-input` del desktop: fondo pannello, bordo dei campi (≥ 3:1), angoli morbidi; a
// fuoco il bordo prende l'accento. L'etichetta sta sopra, non solo nel segnaposto.

import { useState } from 'react';
import { TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { Testo } from './Testo';

/** Oltre questo ingrandimento del carattere di sistema il segnaposto lungo non sta in una riga. */
const SCALA_GRANDE = 1.3;

/**
 * `segnapostoBreve`: su Android il segnaposto di un campo a una riga non si accorcia coi puntini,
 * si taglia a metà parola («Cerca segnatura, titolo o ca»). Col carattere grande si usa questo.
 */
export function Campo({ etichetta, multiline, style, onFocus, onBlur, segnapostoBreve, ...props }: TextInputProps & { etichetta?: string; segnapostoBreve?: string }) {
  const c = useColori();
  const [fuoco, setFuoco] = useState(false);
  const { fontScale } = useWindowDimensions();
  if (segnapostoBreve && fontScale >= SCALA_GRANDE) props = { ...props, placeholder: segnapostoBreve };
  return (
    <View style={{ gap: spazio.xs }}>
      {!!etichetta && <Testo variante="aiuto">{etichetta}</Testo>}
      <TextInput
        accessibilityLabel={etichetta || props.placeholder}
        placeholderTextColor={c.textPlaceholder}
        selectionColor={c.primary}
        multiline={multiline}
        onFocus={e => { setFuoco(true); onFocus?.(e); }}
        onBlur={e => { setFuoco(false); onBlur?.(e); }}
        style={[tipo.corpo, {
          minHeight: multiline ? TOCCO * 1.75 : TOCCO,
          paddingHorizontal: spazio.md,
          paddingVertical: spazio.sm,
          textAlignVertical: multiline ? 'top' : 'center',
          color: c.textMain,
          backgroundColor: c.bgPanel,
          borderRadius: raggio.md,
          borderWidth: fuoco ? 2 : 1,
          borderColor: fuoco ? c.primary : c.borderInput
        }, style]}
        {...props}
      />
    </View>
  );
}
