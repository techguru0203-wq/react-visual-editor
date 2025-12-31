import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StreamingFile {
  type: string;
  path: string;
  content: string;
}

interface StreamingState {
  isStreamingMap: Record<string, boolean>;
  statusMessageMap: Record<string, string>;
  streamingFilesMap: Record<string, StreamingFile[]>;

  setIsStreaming: (docId: string, isStreaming: boolean) => void;
  setStatusMessage: (docId: string, message: string) => void;
  setStreamingFiles: (docId: string, files: StreamingFile[]) => void;
  clearStreaming: (docId: string) => void;
}

export const useStreamingStore = create<StreamingState>()(
  persist(
    (set) => ({
      isStreamingMap: {},
      statusMessageMap: {},
      streamingFilesMap: {},

      setIsStreaming: (docId: string, isStreaming: boolean) =>
        set((state: StreamingState) => ({
          isStreamingMap: {
            ...state.isStreamingMap,
            [docId]: isStreaming,
          },
        })),

      setStatusMessage: (docId: string, message: string) =>
        set((state: StreamingState) => ({
          statusMessageMap: {
            ...state.statusMessageMap,
            [docId]: message,
          },
        })),

      setStreamingFiles: (docId: string, files: StreamingFile[]) =>
        set((state: StreamingState) => ({
          streamingFilesMap: {
            ...state.streamingFilesMap,
            [docId]: files,
          },
        })),

      clearStreaming: (docId: string) =>
        set((state: StreamingState) => {
          const newIsStreaming = { ...state.isStreamingMap };
          const newStatusMessage = { ...state.statusMessageMap };
          const newStreamingFiles = { ...state.streamingFilesMap };

          delete newIsStreaming[docId];
          delete newStatusMessage[docId];
          delete newStreamingFiles[docId];

          return {
            isStreamingMap: newIsStreaming,
            statusMessageMap: newStatusMessage,
            streamingFilesMap: newStreamingFiles,
          };
        }),
    }),
    {
      name: 'streaming-storage', // Automatically syncs to localStorage
    }
  )
); 