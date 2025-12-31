import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import mermaid from 'mermaid';

import AppRouter from './containers/nav/components/AppRouter';
import { COLORS } from './lib/constants';

import './App.scss';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* <UserProvider> */}
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: COLORS.PRIMARY,
            fontFamily: 'Poppins',
            colorLink: COLORS.PRIMARY,
          },
          components: {
            Segmented: {
              itemSelectedBg: COLORS.PRIMARY,
              itemSelectedColor: '#ffffff',
            },
            Button: {
              defaultActiveColor: COLORS.PRIMARY,
              defaultActiveBorderColor: COLORS.PRIMARY,
              defaultHoverColor: COLORS.PRIMARY,
              defaultHoverBorderColor: COLORS.PRIMARY,
            },
            Steps: {
              descriptionMaxWidth: 160,
              iconFontSize: 12,
              iconSize: 24,
              dotCurrentSize: 5,
              dotSize: 5,
              titleLineHeight: 18,
            },
          },
        }}
      >
        <AppRouter />
      </ConfigProvider>
      {/* </UserProvider> */}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}
