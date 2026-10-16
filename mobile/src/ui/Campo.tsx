import { useState } from 'react';
import { TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { raggio, spazio, tipo, TOCCO, useColori } from '../theme';
import { Testo } from './Testo';

const SCALA_GRANDE = 1.3;

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
