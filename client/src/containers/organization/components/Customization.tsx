import { useCallback, useEffect, useRef, useState } from 'react';
import { BgColorsOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Flex, message, Space } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import ImageUploadComponent from '../../../common/components/ImageUpload';
import PrototypeCodeEditor from '../../../common/components/PrototypeCodeEditor';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { getHeaders } from '../../../common/util/apiHeaders';
import { checkIsGenerationLocked } from '../../../common/util/app';
import { api_url } from '../../../lib/constants';

interface StyleFromImageOutput {
  contentStr: string;
  styleDescription: string;
}

async function streamStyleFromImage(
  imageUrl: string,
  onProgress: (msg: string) => void
): Promise<StyleFromImageOutput> {
  const headers = await getHeaders();
  const response = await fetch(
    `${api_url}/api/customization/generate-style-from-image`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({ imageUrl }),
    }
  );

  if (!response.body) {
    throw new Error('No response body received from server.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult: StyleFromImageOutput | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // process full lines
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || ''; // keep incomplete chunk for next loop

    for (const chunk of lines) {
      const eventMatch = chunk.match(/^event:\s*(\w+)\ndata:\s*([\s\S]*)$/);
      if (!eventMatch) continue;

      const [, eventType, jsonData] = eventMatch;

      try {
        const parsed = JSON.parse(jsonData);

        if (eventType === 'step') {
          onProgress(parsed.message || 'Working...');
        } else if (eventType === 'done') {
          finalResult = parsed.data;
        } else if (eventType === 'error') {
          throw new Error(parsed.errorMsg || 'Unknown server error');
        }
      } catch (err) {
        console.error('Malformed SSE chunk:', chunk);
      }
    }
  }

  if (!finalResult) {
    throw new Error('No final result received from server.');
  }

  return finalResult;
}

async function regenerateStylePreview(description: string): Promise<string> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/customization/regenerate-style-preview`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ styleDescription: description }),
    }
  );

  const { success, data, errorMsg } = await result.json();

  if (!success) throw new Error('Failed to regenerate preview: ' + errorMsg);

  return data.contentStr;
}

async function fetchLatestStyleDescription(): Promise<{
  styleDescription: string;
  imageUrl: string;
  base64: string;
}> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/customization/latest-style-description`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (!success) throw new Error('Failed to load: ' + errorMsg);

  return data;
}

export default function Customization() {
  const wasUploadedRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const { user, organization } = useCurrentUser();
  const { showAppModal } = useAppModal();
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [styleDescription, setStyleDescription] = useState('');

  useEffect(() => {
    // Prevent multiple simultaneous requests
    if (hasLoadedRef.current) return;

    async function loadInitialDescription() {
      try {
        hasLoadedRef.current = true;
        const latest = await fetchLatestStyleDescription();
        setCurrentImage(latest.imageUrl);
        setCurrentBase64(latest.base64);
        setStyleDescription(latest.styleDescription);
      } catch (err) {
        console.error('Could not fetch initial style description:', err);
        // Only show error if it's not a "no data found" scenario
        const errorMessage = (err as Error).message;
        if (
          !errorMessage.includes('Failed to fetch latest style description')
        ) {
          message.error('Failed to load previous style description');
        }
      } finally {
        setLoadingInitial(false);
      }
    }

    loadInitialDescription();
  }, []);

  const handleGenerateStyle = useCallback(async () => {
    if (!currentImage) {
      message.warning('Please upload an image.');
      return;
    }
    const isGenerationLocked = checkIsGenerationLocked(organization);
    if (isGenerationLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'customization',
          destination: 'generateStyle',
          isLowCredits: true,
        },
      });
      message.warning(
        'You are running out of credits. Please buy credits or upgrade your plan.'
      );
      return;
    }

    setLoadingGenerate(true);

    try {
      const result = await streamStyleFromImage(currentImage, (msg) => {
        console.log('[SSE]', msg);
        message.loading({ content: msg, key: 'progress', duration: 2 });
      });
      setStyleDescription(result.styleDescription);

      message.success({
        content: 'Style extracted! You may edit the style guidelines.',
        key: 'progress',
      });
    } catch (err) {
      console.error('Style generation failed:', err);
      message.error({ content: 'Failed to extract style', key: 'progress' });
    } finally {
      setLoadingGenerate(false);
    }
  }, [currentImage]);

  useEffect(() => {
    if (!currentImage || !wasUploadedRef.current) return;

    const timeout = setTimeout(() => {
      handleGenerateStyle();
      wasUploadedRef.current = false; // reset after use
    }, 100);

    return () => clearTimeout(timeout);
  }, [currentImage, handleGenerateStyle]);

  const handleSave = async () => {
    setLoadingSave(true);
    try {
      await regenerateStylePreview(styleDescription);
      message.success('Style updated!');
    } catch (err) {
      console.error(err);
      message.error('Failed to save style');
    } finally {
      setLoadingSave(false);
    }
  };

  // Show loading state while initial data is being fetched
  if (loadingInitial) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Flex
          gap="large"
          wrap="wrap"
          justify="center"
          style={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}
        >
          <Card
            title="Loading..."
            style={{ flex: 1, minWidth: 500, maxWidth: 500 }}
            loading
          >
            <div style={{ height: 200 }} />
          </Card>
          <Card
            title="Loading..."
            style={{ flex: 1, minWidth: 600, maxWidth: 800 }}
            loading
          >
            <div style={{ height: 400 }} />
          </Card>
        </Flex>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex
        gap="large"
        wrap="wrap"
        justify="center"
        style={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}
      >
        {/* Left column: Image Upload */}
        <Card
          title="Attach a Style Reference"
          style={{ flex: 1, minWidth: 500, maxWidth: 500 }}
        >
          <Flex vertical gap="middle" style={{ width: '100%' }}>
            <Flex justify="center" align="center" style={{ width: '100%' }}>
              <div style={{ maxWidth: 400, width: '100%' }}>
                <ImageUploadComponent
                  currentImage={currentImage}
                  setCurrentImage={(url) => {
                    wasUploadedRef.current = true;
                    setCurrentImage(url);
                  }}
                  currentBase64={currentBase64}
                  setCurrentBase64={setCurrentBase64}
                />
              </div>
            </Flex>

            <Flex justify="center" style={{ marginTop: 0 }}>
              <Button
                type="primary"
                icon={<BgColorsOutlined style={{ marginRight: 8 }} />}
                onClick={handleGenerateStyle}
                loading={loadingGenerate}
                disabled={!currentImage}
                style={{ padding: '0 16px' }}
              >
                Extract Style
              </Button>
            </Flex>
          </Flex>
        </Card>

        {/* Right column: Edit Style Guidelines */}
        <Card
          title="Edit Style Guidelines"
          style={{ flex: 1, minWidth: 600, maxWidth: 800 }}
          extra="You may directly update your style below"
        >
          <Flex vertical gap="middle" style={{ width: '100%' }}>
            <PrototypeCodeEditor
              value={styleDescription}
              language={'md'}
              onUpdate={(val) => setStyleDescription(val)}
              style={{ minHeight: 400, maxHeight: 400, overflow: 'auto' }}
            />
            <Flex justify="center" style={{ marginTop: 0 }}>
              <Button
                icon={<SaveOutlined style={{ marginRight: 8 }} />}
                type="primary"
                onClick={handleSave}
                loading={loadingSave}
                style={{ padding: '0 16px' }}
              >
                Update Style
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </Space>
  );
}
