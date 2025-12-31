import { useEffect } from 'react';

import { ReactComponent as DragMove } from '../../../common/icons/drag-move.svg';

interface ResizerProps {
  onResize?: (e: MouseEvent) => void;
}

export default function Resizer({ onResize }: ResizerProps) {
  useEffect(() => {
    const winDoc = window.document;
    const resizer = winDoc.getElementById('resizer');
    if (!resizer) {
      return;
    }

    const resize = (e: MouseEvent) => {
      onResize && onResize(e);
    };

    const resizerDragIcon = winDoc.getElementById('resizer-drag-icon');
    resizer.addEventListener('mousedown', (event) => {
      if (resizerDragIcon?.style) {
        resizerDragIcon.style.visibility = 'hidden';
      }
      winDoc.addEventListener('mousemove', resize, false);
      winDoc.addEventListener(
        'mouseup',
        () => {
          winDoc.removeEventListener('mousemove', resize, false);
          if (resizerDragIcon?.style) {
            resizerDragIcon.style.visibility = 'visible';
          }
        },
        false
      );
    });
  }, [onResize]);

  return (
    <div id="resizer">
      <div id="resizer-drag-icon">
        <DragMove />
      </div>
    </div>
  );
}
