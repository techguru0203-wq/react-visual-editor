import React, { useEffect, useState } from 'react';
import { ArrowUpOutlined } from '@ant-design/icons';
import { Image, message, Upload } from 'antd';
import { RcFile, UploadFile } from 'antd/es/upload/interface';

import { uploadSingleFileApi } from '../../containers/templateDocument/api/filesApi';
import { useLanguage } from '../contexts/languageContext';

import './ImageUpload.scss';

interface ImageUploadProps {
  setCurrentImage: (val: string | null) => void; // now this will be the S3 URL
  currentImage: string | null;
  setCurrentBase64: (val: string | null) => void; // now this will be the S3 URL
  currentBase64: string | null;
}

const ImageUploadComponent: React.FC<ImageUploadProps> = ({
  setCurrentImage,
  currentImage,
  setCurrentBase64,
  currentBase64,
}) => {
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Helper to convert file to base64
  const getBase64 = (file: RcFile): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  useEffect(() => {
    if (currentBase64) {
      setFileList([
        {
          uid: '-1',
          name: 'Uploaded image',
          status: 'done',
          url: currentBase64,
          thumbUrl: currentBase64,
        },
      ]);
    } else {
      setFileList([]);
    }
  }, [currentBase64]);

  const handleUpload = async (file: RcFile) => {
    try {
      const fileUrl = await uploadSingleFileApi({
        file: file,
        s3BucketName: 'images',
      });
      setCurrentImage(fileUrl);

      const base64 = await getBase64(file);
      setCurrentBase64(base64);

      const uploadFile: UploadFile = {
        uid: '-1',
        name: file.name,
        status: 'done',
        url: base64,
        thumbUrl: base64,
      };
      setFileList([uploadFile]);

      message.success('Image uploaded successfully');
    } catch (err) {
      console.error('Upload error:', err);
      message.error('Image upload failed');
    }
  };

  return (
    <>
      <Upload
        name="file"
        listType="picture-card"
        fileList={fileList}
        customRequest={({ file, onSuccess }) => {
          handleUpload(file as RcFile).then(() => onSuccess?.('ok'));
        }}
        onPreview={(file) => {
          setPreviewImage(file.url || '');
          setPreviewOpen(true);
        }}
        onRemove={() => {
          setFileList([]);
          setCurrentImage(null);
        }}
        accept="image/png,image/jpeg"
        maxCount={1}
        className="image-upload-large"
      >
        {fileList.length < 1 && (
          <div>
            <ArrowUpOutlined />
            <div style={{ marginTop: 8 }}>{t('common.uploadImage')}</div>
          </div>
        )}
      </Upload>

      {previewImage && (
        <Image
          wrapperStyle={{ display: 'none' }}
          preview={{
            visible: previewOpen,
            onVisibleChange: (v) => setPreviewOpen(v),
            afterOpenChange: (v) => !v && setPreviewImage(''),
          }}
          src={previewImage}
        />
      )}
    </>
  );
};

export default ImageUploadComponent;
