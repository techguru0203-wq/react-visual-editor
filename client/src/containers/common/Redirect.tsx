import { Navigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';

export default function Redirect() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url');
  console.log('inRedirect', url);
  if (!url) {
    throw new Error('Please ');
  }
  return <Navigate to={url} replace />;
}
