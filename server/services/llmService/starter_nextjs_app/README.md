# Next.js App Template

This is a Next.js application template with the following features:

## ⚠️ Template Note
This is a **template directory** used by the LLM for code generation. The linting errors you see are expected because:
- Dependencies are not installed in the template directory
- This is used as a reference for generating actual projects
- When copied to a real project with `npm install`, all errors will be resolved
- ESLint is configured to ignore TypeScript files in the template to prevent false errors

## Project Structure

```
.
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── globals.css   # Global styles with Tailwind
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   └── custom/      # Custom components
│   ├── lib/             # Utility functions
│   │   └── utils.ts     # Class name utilities
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
├── package.json         # Dependencies and scripts
├── next.config.js       # Next.js configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── components.json      # shadcn/ui configuration
```

## Features

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **ESLint** for code quality (configured to ignore template files)
- **PostCSS** for CSS processing

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Package Manager**: npm

## Template Usage

This template is used by the LLM to generate Next.js applications. When a user requests a Next.js app, this template provides the foundation structure and configuration files. 