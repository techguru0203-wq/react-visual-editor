import React, { useEffect, useRef, useState } from 'react';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Progress, Spin } from 'antd';

import { ProjectAccessResponse } from '../../../../../../shared/types';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { GlobalStoreInst } from '../../../../common/util/globalStore';
import { COLORS } from '../../../../lib/constants';
import {
  DocumentOutput,
  DocumentTypeNameMapping,
} from '../../../documents/types/documentTypes';
import { ProjectFile } from './PrototypeEditor';
import { PrototypeEditorToolbar } from './PrototypeEditorToolbar';

interface StreamingEditorProps {
  files: ProjectFile[];
  statusMessage?: string;
  documentId?: string;
  documentType?: string;
  onToolbarRender?: (toolbar: React.ReactNode | null) => void;
  document?: DocumentOutput;
  access?: ProjectAccessResponse;
  onShare?: () => void;
}

const MIN_DELAY_MS = 20_000;
const MAX_DELAY_MS = 40_000;

// Helper function to generate progress key
const getProgressKey = (documentId: string) =>
  `streaming-progress-${documentId}`;

const StreamingEditor: React.FC<StreamingEditorProps> = ({
  files,
  statusMessage,
  documentId,
  documentType,
  onToolbarRender,
  document,
  access,
  onShare,
}) => {
  const { t } = useLanguage();
  const lastFileRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const currentStepRef = useRef(currentStep);
  const hasRestoredProgress = useRef(false);

  const polishingMessages = [
    t('streaming.polishingCss'),
    t('streaming.minifyingJs'),
    t('streaming.optimizingAssets'),
    t('streaming.refiningLayout'),
    t('streaming.tuningPerformance'),
    t('streaming.aligningPixels'),
    t('streaming.lintingFiles'),
    t('streaming.trimmingWhitespace'),
  ];

  const isPolishing = statusMessage?.startsWith(t('streaming.polishingApp'));

  const [polishIndex, setPolishIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const documentName =
    DocumentTypeNameMapping(t)[documentType as string].name.toLowerCase();

  const effectiveStep =
    statusMessage ===
    t('streaming.deployingDocument').replace('{documentName}', documentName)
      ? files.length
      : currentStep;

  // Load saved progress on mount and save progress on unmount
  useEffect(() => {
    if (!documentId) return;

    // Load saved progress on mount
    if (
      statusMessage ===
        t('streaming.creatingDocument').replace(
          '{documentName}',
          documentName
        ) &&
      !hasRestoredProgress.current
    ) {
      const progressKey = getProgressKey(documentId);
      const savedProgress = GlobalStoreInst.get(progressKey);
      if (savedProgress) {
        try {
          const {
            currentStep: savedStep,
            filesCount,
            timestamp,
          } = savedProgress;

          console.log('StreamingEditor: Found saved progress:', {
            savedStep,
            filesCount,
            currentFilesLength: files.length,
            timestamp,
          });

          // Only restore if the files count matches
          if (filesCount === files.length) {
            hasRestoredProgress.current = true;

            // Calculate time elapsed since progress was saved
            const timeElapsed = Date.now() - timestamp;
            console.log(
              'StreamingEditor: Time elapsed since save:',
              timeElapsed,
              'ms'
            );

            // Estimate additional steps based on time elapsed
            let estimatedAdditionalSteps = 0;
            let remainingTime = timeElapsed;

            // Calculate how many steps would have completed during the elapsed time
            for (
              let step = savedStep;
              step < files.length && remainingTime > 0;
              step++
            ) {
              let stepDelay: number;
              // Use the same delay calculation logic as the progress animation
              if (step < 2) {
                // First 2 files: 30-60 seconds
                stepDelay = MIN_DELAY_MS + Math.random() * MIN_DELAY_MS;
              } else if (step < 6) {
                // Next 4 files: 60-120 seconds
                stepDelay = MAX_DELAY_MS + Math.random() * MIN_DELAY_MS;
              } else {
                // Last 2 files: 90-150 seconds
                stepDelay =
                  MIN_DELAY_MS + MAX_DELAY_MS + Math.random() * MAX_DELAY_MS;
              }
              if (remainingTime >= stepDelay) {
                estimatedAdditionalSteps++;
                remainingTime -= stepDelay;
              } else {
                break;
              }
            }
            // Calculate the estimated current step
            const estimatedStep = Math.min(
              savedStep + estimatedAdditionalSteps,
              files.length
            );
            console.log('StreamingEditor: Estimated progress:', {
              savedStep,
              estimatedAdditionalSteps,
              estimatedStep,
              timeElapsed: timeElapsed / 1000, // in seconds
            });
            setCurrentStep(estimatedStep);
            console.log(
              'StreamingEditor: Restored progress to step:',
              estimatedStep
            );
            GlobalStoreInst.delete(progressKey);
          } else {
            console.log(
              'StreamingEditor: files count mismatch',
              filesCount,
              files.length
            );
          }
        } catch (error) {
          console.error('Error parsing saved progress:', error);
          GlobalStoreInst.delete(progressKey);
        }
      }
    }

    // Save progress on unmount
    return () => {
      console.log('Component is about to unmount');
      const progressKey = getProgressKey(documentId);
      // Save progress when component unmounts (user navigates away)
      if (
        files.length > 0 &&
        statusMessage ===
          t('streaming.creatingDocument').replace(
            '{documentName}',
            documentName
          )
      ) {
        const progressData = {
          currentStep: currentStepRef.current,
          filesCount: files.length,
          timestamp: Date.now(),
        };
        GlobalStoreInst.set(progressKey, progressData);
        console.log('Saved progress on unmount:', progressData);
      }
    };
  }, [documentId, files.length, statusMessage, documentName, t]);

  // Update ref when currentStep changes
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Consolidated polishing management: interval and reset
  useEffect(() => {
    if (!isPolishing) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setPolishIndex((prev) => prev + 1);
    }, 5000);
    // Reset position after fake end scroll
    if (polishIndex === polishingMessages.length) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setPolishIndex(0);
      }, 400);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => clearInterval(interval);
  }, [isPolishing, polishIndex, polishingMessages.length, t]);

  // Sequential random loading
  useEffect(() => {
    if (
      currentStep < files.length &&
      (statusMessage ===
        t('streaming.creatingDocument').replace(
          '{documentName}',
          documentName
        ) ||
        statusMessage ===
          t('streaming.updatingDocument').replace(
            '{documentName}',
            documentName
          ))
    ) {
      let delay: number;
      // Progressive delays based on file position
      if (currentStep < 2) {
        // First 2 files: 20-40 seconds
        delay = MIN_DELAY_MS + Math.random() * MIN_DELAY_MS; // 20-40 seconds
      } else if (currentStep < 6) {
        // Next 4 files: 40-60 seconds
        delay = MAX_DELAY_MS + Math.random() * MIN_DELAY_MS; // 40-60 seconds
      } else {
        // Last 2 files: 60-100 seconds
        delay = MIN_DELAY_MS + MAX_DELAY_MS + Math.random() * MAX_DELAY_MS; // 60-100 seconds
      }

      const timeout = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentStep, files.length, statusMessage, documentName, t]);

  const getStatusIcon = (index: number) => {
    if (index < effectiveStep) {
      return <CheckCircleOutlined style={{ color: 'green', fontSize: 16 }} />;
    } else if (index === effectiveStep) {
      return <Spin size="small" />;
    } else {
      return <ClockCircleOutlined style={{ color: '#aaa', fontSize: 16 }} />;
    }
  };

  const progressPercent = Math.round((effectiveStep / files.length) * 100);

  // Show progress percentage only for initial generation, hide for updates and polishing
  const isInitialGeneration = statusMessage?.includes(
    t('streaming.creatingDocument').replace('{documentName}', documentName)
  );
  const shouldShowProgressPercentage = !isPolishing && isInitialGeneration;

  // Render toolbar during streaming
  useEffect(() => {
    if (onToolbarRender && document) {
      const isReadOnly = access?.projectPermission === 'VIEW';
      // Get deployment info from document meta
      const meta = document?.meta as any;
      const deployUrl = meta?.deployUrl as string | undefined;
      const previewDeploymentId = meta?.previewDeploymentId as
        | string
        | undefined;
      const productionDeploymentId = meta?.productionDeploymentId as
        | string
        | undefined;
      const productionUrl = meta?.productionUrl as string | undefined;
      const previewUrl = meta?.previewUrl as string | undefined;

      const toolbar = (
        <PrototypeEditorToolbar
          viewMode="preview"
          previewMode="desktop"
          isReadOnly={isReadOnly}
          hasUnsavedChanges={false}
          isEditing={false}
          access={access}
          docId={document?.id || ''}
          deployUrl={deployUrl}
          previewDeploymentId={previewDeploymentId}
          productionDeploymentId={productionDeploymentId}
          productionUrl={productionUrl}
          previewUrl={previewUrl}
          onViewModeChange={() => {}} // Disabled during streaming
          onPreviewModeChange={() => {}} // Disabled during streaming
          onSave={() => {}} // Disabled during streaming
          onViewDiff={undefined} // No diff available during streaming
          onViewLogs={() => {}} // Disabled during streaming
          onShare={onShare}
          hasFiles={false} // No files available during streaming
        />
      );
      onToolbarRender(toolbar);
    }
    return () => {
      if (onToolbarRender) {
        onToolbarRender(null);
      }
    };
  }, [onToolbarRender, document, access, onShare]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '20px',
        paddingBottom: '100px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Heading */}
        <h2
          style={{
            fontSize: '32px',
            fontWeight: 500,
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <Spin style={{ marginRight: 16 }} />
          {statusMessage || 'Setting up your app...'}
        </h2>

        {/* Progress Bar - Only show percentage for creating prototype/product */}
        <div style={{ width: '100%', marginBottom: '30px' }}>
          <Progress
            percent={progressPercent}
            showInfo={shouldShowProgressPercentage}
            strokeColor={COLORS.PRIMARY}
            trailColor="#f0f0f0"
            strokeWidth={6}
          />
        </div>

        {/* File List */}
        <div style={{ width: '100%' }}>
          {/* Rotating wheel with polishing messages */}
          {isPolishing ? (
            <div
              style={{
                height: '120px',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '20px',
              }}
            >
              <div
                ref={containerRef}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  transform: `translateY(-${40 * polishIndex}px)`,
                  transition: isTransitioning
                    ? 'transform 0.4s ease-in-out'
                    : 'none',
                }}
              >
                {[...polishingMessages, ...polishingMessages.slice(0, 2)].map(
                  (msg, i) => {
                    const visibleIndex =
                      (i - polishIndex + polishingMessages.length) %
                      polishingMessages.length;
                    const isCenter = visibleIndex === 1;

                    return (
                      <div
                        key={`${msg}-${i}`}
                        style={{
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isCenter ? '16px' : '14px',
                          fontWeight: isCenter ? 600 : 400,
                          color: isCenter ? '#333' : '#888',
                          opacity: isCenter ? 1 : 0.6,
                          transform: `scale(${isCenter ? 1.1 : 1})`,
                          transition: 'all 0.3s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {msg}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ) : files.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#888',
                fontSize: '16px',
              }}
            >
              {t('streaming.planningFiles')}
            </div>
          ) : (
            files.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                ref={index === files.length - 1 ? lastFileRef : undefined}
                style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#333',
                }}
              >
                {/* Icon */}
                <div style={{ marginTop: '2px' }}>{getStatusIcon(index)}</div>

                {/* File Purpose */}
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#888' }}>{file.content}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamingEditor;
