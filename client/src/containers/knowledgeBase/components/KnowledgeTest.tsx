import { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  List,
  Tag,
  Empty,
  Spin,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLanguage } from '../../../common/contexts/languageContext';
import { searchKnowledgeBaseApi, SearchResult } from '../api/knowledgeBaseApi';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface KnowledgeTestProps {
  knowledgeBaseId: string;
}

export function KnowledgeTest({ knowledgeBaseId }: KnowledgeTestProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const results = await searchKnowledgeBaseApi(knowledgeBaseId, query, 5);
      setResults(results);
    } catch (error: any) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'green';
    if (score >= 0.8) return 'blue';
    if (score >= 0.7) return 'orange';
    return 'default';
  };

  return (
    <div>
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text type="secondary">
              {t('knowledgeBase.testQueryDescription')}
            </Text>
          </div>

          <TextArea
            rows={4}
            placeholder={t('knowledgeBase.enterTestQuery')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={(e) => {
              if (e.shiftKey) return;
              e.preventDefault();
              handleSearch();
            }}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            disabled={!query.trim()}
          >
            {t('knowledgeBase.search')}
          </Button>
        </Space>
      </Card>

      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">{t('knowledgeBase.searching')}</Text>
            </div>
          </div>
        </Card>
      ) : searched ? (
        results.length === 0 ? (
          <Card>
            <Empty description={t('knowledgeBase.noResults')} />
          </Card>
        ) : (
          <Card
            title={`${t('knowledgeBase.searchResults')} (${results.length})`}
          >
            <List
              dataSource={results}
              renderItem={(result, index) => {
                const isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(
                  result.fileName
                );
                return (
                  <List.Item key={index}>
                    <Card
                      size="small"
                      style={{ width: '100%' }}
                      title={
                        <Space>
                          <Text strong>#{index + 1}</Text>
                          <Tag color={getScoreColor(result.score)}>
                            {t('knowledgeBase.similarity')}:{' '}
                            {(result.score * 100).toFixed(1)}%
                          </Tag>
                          <span>
                            {isImage ? '🖼️ ' : '📄 '}
                            <Text type="secondary">{result.fileName}</Text>
                          </span>
                          {isImage && (
                            <Tag color="blue" style={{ marginLeft: '8px' }}>
                              {t('knowledgeBase.ocrExtracted')}
                            </Tag>
                          )}
                        </Space>
                      }
                    >
                      {isImage && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#1890ff',
                            marginBottom: '8px',
                            fontWeight: 500,
                          }}
                        >
                          📝 {t('knowledgeBase.extractedText')}:
                        </div>
                      )}
                      {result.text && result.text.trim().length > 0 ? (
                      <Paragraph
                        style={{
                          whiteSpace: 'pre-wrap',
                            backgroundColor: isImage ? '#f0f8ff' : '#f5f5f5',
                          padding: '12px',
                          borderRadius: '4px',
                          marginBottom: 0,
                          borderLeft: isImage
                            ? '3px solid #1890ff'
                            : undefined,
                        }}
                      >
                        {result.text}
                      </Paragraph>
                      ) : (
                        <Paragraph
                          style={{
                            whiteSpace: 'pre-wrap',
                            backgroundColor: '#fff7e6',
                            padding: '12px',
                            borderRadius: '4px',
                            marginBottom: 0,
                            borderLeft: '3px solid #faad14',
                            color: '#8c8c8c',
                          }}
                        >
                          {t('knowledgeBase.noTextExtracted')}
                        </Paragraph>
                      )}
                    </Card>
                  </List.Item>
                );
              }}
            />
          </Card>
        )
      ) : (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('knowledgeBase.enterQueryToTest')}
          />
        </Card>
      )}
    </div>
  );
}
