import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePalette } from '../theme';

/**
 * Переключатель, состояние которого живёт на устройстве (AsyncStorage).
 *
 * Как LocalToggle в вебе: серверной части у уведомлений, приватности и контента
 * пока нет, поэтому значение просто помнится локально. По цвету — акцент темы.
 */
export function LocalToggle({ storageKey, defaultOn = false }: { storageKey: string; defaultOn?: boolean }) {
  const palette = usePalette();
  const [on, setOn] = useState(defaultOn);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (value === '1') setOn(true);
        else if (value === '0') setOn(false);
      })
      .catch(() => {});
  }, [storageKey]);

  function toggle(next: boolean) {
    setOn(next);
    AsyncStorage.setItem(storageKey, next ? '1' : '0').catch(() => {});
  }

  return (
    <Switch
      value={on}
      onValueChange={toggle}
      trackColor={{ true: palette.accent, false: palette.surface2 }}
      thumbColor="#fff"
      ios_backgroundColor={palette.surface2}
    />
  );
}
