import { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { DOMSerializer } from 'prosemirror-model';

export interface ISelectionContext {
  selection: string;
  before: string;
  after: string;
  docId: string;
}

const FULL_LIST_OFFSET = 2;

export const replaceSelection = (
  editor: Editor,
  generatedContent: string,
  selection: string
) => {
  const { from, to } = editor.state.selection;

  const hasSelectedFullList =
    selection.startsWith('<ul>') ||
    selection.startsWith('<li>') ||
    selection.startsWith('<ol>');

  editor
    .chain()
    .focus()
    .insertContentAt(
      {
        from: from - (hasSelectedFullList ? FULL_LIST_OFFSET : 0), // adjust formatting
        to,
      },
      generatedContent,
      {
        updateSelection: true,
      }
    )
    .run();
};

export function useSelectedText(editor: Editor | null) {
  const getSelectedText = useCallback(() => {
    if (editor == null) {
      return '';
    }

    const { from, to } = editor.state.selection;

    return editor.state.doc.textBetween(from, to, ' ');
  }, [editor?.state.selection.from, editor?.state.selection.to]);

  return getSelectedText;
}

export function getHTMLContentBetween(editor: Editor) {
  const slice = editor.state.selection.content();
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const fragment = serializer.serializeFragment(slice.content);
  const div = document.createElement('div');

  div.appendChild(fragment);

  return div.innerHTML;
}

export default useSelectedText;
