import { Alert } from "antd";
import { isRouteErrorResponse, useRouteError } from "react-router";

export function ErrorScreen() {
  const error = useRouteError();
  console.error('An error occurred and was caught by the error boundary', error);

  if (isRouteErrorResponse(error)) {
    return (
      <Alert
        message={`Oops: (${error.status}) ${error.statusText}`}
        description={error.data?.message || error.data}
        type='error'
        showIcon
      />
    );
  }

  return (
    <Alert
      message='Error'
      description={error ? error.toString() : 'An unknown error has occurred'}
      type='error'
      showIcon
    />
  );
}