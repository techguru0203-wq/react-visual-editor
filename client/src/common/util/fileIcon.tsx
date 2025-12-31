import {
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from '@ant-design/icons';

export const getFileIcon = (fileExt: string) => {
  const fileIconStyle = {
    fontSize: '18px',
    marginRight: '4px',
  };

  switch (fileExt) {
    case 'pdf':
      return <FilePdfOutlined style={fileIconStyle} />;
    case 'xls':
    case 'xlsx':
      return <FileExcelOutlined style={fileIconStyle} />;
    case 'txt':
      return <FileTextOutlined style={fileIconStyle} />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={fileIconStyle} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
    case 'bmp':
    case 'webp':
      return <FileImageOutlined style={fileIconStyle} />;
    default:
      return <FileOutlined style={fileIconStyle} />;
  }
};
