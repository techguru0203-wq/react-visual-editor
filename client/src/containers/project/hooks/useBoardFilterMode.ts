import { useCallback, useState } from 'react';

import { getValue, setValue } from '../../../lib/safeLocalStorage';

export type AgileBoardMode = 'sprint' | 'scrum';

export const DEFAULT_BOARD_MODE = 'sprint';

export const BOARD_MODE_STORAGE_KEY = 'projectBoardMode';

export function useBoardFilterMode() {
  const [boardMode, setBoardMode] = useState<AgileBoardMode>(getValue(BOARD_MODE_STORAGE_KEY) || DEFAULT_BOARD_MODE);
  const _setBoardMode = useCallback((mode: AgileBoardMode) => {
    setValue(BOARD_MODE_STORAGE_KEY, mode);
    setBoardMode(mode);
  }, []);
  return [boardMode, _setBoardMode] as const;
}
