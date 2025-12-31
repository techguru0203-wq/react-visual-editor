import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type SelectionOptions = {
  className: string;
};

export const Selection = Extension.create({
  name: 'selection',

  addOptions() {
    return {
      className: 'selection',
    };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;

    return [
      new Plugin({
        key: new PluginKey('selection'),
        props: {
          decorations(state) {
            if (state.selection.empty || editor.isFocused) {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.inline(state.selection.from, state.selection.to, {
                class: options.className,
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export default Selection;
