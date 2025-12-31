import { Button, Form, Typography } from 'antd';

type DeleteProjectProps = Readonly<{
  documentId: string;
  onSuccess: () => void;
  deleteImage: () => void;
}>;

export function DeleteDocumentImage({
  documentId,
  onSuccess,
  deleteImage,
}: DeleteProjectProps) {
  const onSubmit = () => {
    if (documentId) {
      deleteImage();
      onSuccess();
    }
  };

  return (
    <>
      <Form
        id="image-delete"
        name="deleteProject"
        size="large"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        onFinish={onSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography.Paragraph style={{ paddingBottom: '20px' }}>
          Are you sure you want to delete the image for this document?
        </Typography.Paragraph>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Delete
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
