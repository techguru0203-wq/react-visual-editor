import { describe, it, expect } from '@jest/globals';
import { AIMessageChunk } from '@langchain/core/messages';
import { processStreamJSON } from './ai_utils';

// Helper function to create a mock stream that yields chunks
async function* createMockStream(
  chunks: string[]
): AsyncIterable<AIMessageChunk> {
  for (const chunk of chunks) {
    yield { content: chunk } as AIMessageChunk;
  }
}

describe('processStreamJSON', () => {
  it('should handle a single complete file in one chunk', async () => {
    const mockStream = createMockStream([
      "FILE: test.ts\nconsole.log('hello');\nENDFILE",
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'test.ts',
          content: "console.log('hello');",
        },
      ],
    });

    expect(onProgress).toHaveBeenCalledWith(
      JSON.stringify({
        text: {
          path: 'test.ts',
          content: "console.log('hello');",
        },
      })
    );
  });

  it('should handle package.json with nested content', async () => {
    const packageContent = `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  }
}`;
    const mockStream = createMockStream([
      `FILE: package.json\n${packageContent}\nENDFILE`,
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'package.json',
          content: packageContent,
        },
      ],
    });

    expect(onProgress).toHaveBeenCalledWith(
      JSON.stringify({
        text: {
          path: 'package.json',
          content: packageContent,
        },
      })
    );
  });

  it('should handle CSS files with complex selectors', async () => {
    const cssContent = `.container {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }
}

.button:hover {
  background-color: #f0f0f0;
  transform: translateY(-1px);
}`;

    const mockStream = createMockStream([
      `FILE: src/styles/main.css\n${cssContent}\nENDFILE`,
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'src/styles/main.css',
          content: cssContent,
        },
      ],
    });
  });

  it('should handle HTML files with nested elements', async () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="root"></div>
  <script src="main.js"></script>
</body>
</html>`;

    const mockStream = createMockStream([
      `FILE: index.html\n${htmlContent}\nENDFILE`,
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'index.html',
          content: htmlContent,
        },
      ],
    });
  });

  it('should handle markdown files with formatting', async () => {
    const markdownContent = `# Project Title

## Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

## Features
- Feature 1
- Feature 2

## License
MIT`;

    const mockStream = createMockStream([
      `FILE: README.md\n${markdownContent}\nENDFILE`,
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'README.md',
          content: markdownContent,
        },
      ],
    });
  });

  it('should handle .gitignore file', async () => {
    const gitignoreContent = `node_modules/
.env
.DS_Store
dist/
*.log
coverage/
.vscode/`;

    const mockStream = createMockStream([
      `FILE: .gitignore\n${gitignoreContent}\nENDFILE`,
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: '.gitignore',
          content: gitignoreContent,
        },
      ],
    });
  });

  it('should handle multiple different file types in sequence', async () => {
    const mockStream = createMockStream([
      'FILE: package.json\n{"name": "app"}\nENDFILE\n',
      'FILE: styles.css\n.main { color: blue; }\nENDFILE\n',
      'FILE: README.md\n# Title\nENDFILE\n',
      'FILE: .gitignore\nnode_modules/\nENDFILE',
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        { path: 'package.json', content: '{"name": "app"}' },
        { path: 'styles.css', content: '.main { color: blue; }' },
        { path: 'README.md', content: '# Title' },
        { path: '.gitignore', content: 'node_modules/' },
      ],
    });

    expect(onProgress).toHaveBeenCalledTimes(4);
  });

  it('should handle a file split across multiple chunks', async () => {
    const mockStream = createMockStream([
      'FILE: test.ts\ncons',
      "ole.log('hello');\nEND",
      'FILE',
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        {
          path: 'test.ts',
          content: "console.log('hello');",
        },
      ],
    });
  });

  it('should handle invalid content between files', async () => {
    const mockStream = createMockStream([
      'some invalid content\n',
      'FILE: valid.ts\ncode\nENDFILE\n',
      'more invalid\n',
      'FILE: also-valid.ts\nmore code\nENDFILE',
    ]);

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({
      files: [
        { path: 'valid.ts', content: 'code' },
        { path: 'also-valid.ts', content: 'more code' },
      ],
    });
  });

  it('should handle a complete React application structure', async () => {
    const files = [
      {
        path: 'package.json',
        content: `{
  "name": "hello-world-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@supabase/supabase-js": "^2.39.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.341.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.1",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.11.26",
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@typescript-eslint/eslint-plugin": "^7.0.2",
    "@typescript-eslint/parser": "^7.0.2",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "eslint": "^8.56.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}`,
      },
      {
        path: 'src/App.tsx',
        content: `import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { ThemeProvider } from './context/ThemeContext';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </BrowserRouter>
  );
}`,
      },
      {
        path: 'src/routes/index.tsx',
        content: `import { Routes, Route } from 'react-router-dom';
import { Dashboard, Profile, Settings } from '../pages';
import { Layout } from '../components/Layout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}`,
      },
      {
        path: 'src/components/Layout/index.tsx',
        content: `import { Outlet } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Sidebar } from '../Sidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <Sidebar />
      <main className="p-4 sm:ml-64">
        <Outlet />
      </main>
    </div>
  );
}`,
      },
      {
        path: 'src/components/Navbar/index.tsx',
        content: `import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';

export function Navbar() {
  const { toggleTheme } = useTheme();
  return (
    <nav className="fixed top-0 z-50 w-full border-b bg-white dark:bg-gray-800">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <Button onClick={toggleTheme}>Toggle Theme</Button>
      </div>
    </nav>
  );
}`,
      },
      {
        path: 'src/components/ui/Button.tsx',
        content: `import { cn } from '../../lib/utils';
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
}

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}`,
      },
      {
        path: 'src/hooks/useTheme.ts',
        content: `import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useTheme = create<ThemeStore>((set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
}));`,
      },
      {
        path: 'src/lib/utils.ts',
        content: `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
      },
      {
        path: 'src/pages/Dashboard/index.tsx',
        content: `import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '../../api/dashboard';

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Dashboard content */}
    </div>
  );
}`,
      },
      {
        path: 'src/api/dashboard.ts',
        content: `export async function fetchDashboardData() {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  return response.json();
}`,
      },
      {
        path: 'src/styles/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 0 0% 100%;
  }
}`,
      },
      {
        path: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
    },
  },
  plugins: [],
}`,
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});`,
      },
      {
        path: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
      },
      {
        path: '.env',
        content: `VITE_API_URL=http://localhost:3000
VITE_APP_NAME=My React App`,
      },
      {
        path: '.gitignore',
        content: `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# production
dist
build

# misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*`,
      },
      {
        path: 'README.md',
        content: `# My React App

A modern React application built with Vite, TypeScript, and TailwindCSS.

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## Features

- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- React Router for navigation
- React Query for data fetching
- Zustand for state management`,
      },
      {
        path: 'src/types/index.ts',
        content: `export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface DashboardData {
  stats: {
    users: number;
    revenue: number;
    growth: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    date: string;
  }>;
}`,
      },
      {
        path: 'src/context/ThemeContext.tsx',
        content: `import { createContext, useContext, ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

const ThemeContext = createContext<ReturnType<typeof useTheme> | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}`,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      },
    ];

    const mockStream = createMockStream(
      files.map((file) => `FILE: ${file.path}\n${file.content}\nENDFILE\n`)
    );

    const onProgress = jest.fn();
    const result = await processStreamJSON(mockStream, onProgress);

    expect(JSON.parse(result)).toEqual({ files });
    expect(onProgress).toHaveBeenCalledTimes(20);

    // Verify the structure of each progress call
    files.forEach((file, index) => {
      expect(onProgress).toHaveBeenNthCalledWith(
        index + 1,
        JSON.stringify({
          text: {
            path: file.path,
            content: file.content,
          },
        })
      );
    });
  });
});
