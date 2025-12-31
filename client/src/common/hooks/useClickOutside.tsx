import { RefObject, useEffect } from 'react';

export default function useClickOutside<T extends HTMLElement>(
  node: RefObject<T | undefined>,
  callback?: (e: MouseEvent) => void
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !node.current ||
        node.current.contains(e.target as Node) ||
        node.current.contains(
          document.querySelector('#ant-image-preview-operations')
        )
      ) {
        return;
      }

      callback && callback(e);
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [node, callback]);
}
