# Visual Edit Feature - Implementation Documentation

## Overview

The Visual Edit feature allows users to visually edit React components directly in the preview iframe by clicking on elements. Changes can be applied to the source code and deployed to Vercel. This feature provides a WYSIWYG (What You See Is What You Get) editing experience similar to tools like Lovable.dev.

## Feature Capabilities

- **Click-to-Select**: Click any element in the preview to select it
- **Live Editing**: Edit text content and CSS classes in a side panel
- **Code Integration**: Changes are applied directly to source code files
- **Deployment**: Modified code can be deployed to Vercel

## Architecture Overview

The Visual Edit feature consists of three main components:

1. **Compile-Time Instrumentation** (Babel Plugin) - Injects source location data into JSX elements
2. **Runtime Inspector** (Script in deployed app) - Handles click events and element selection
3. **Visual Edit Panel** (React Component) - UI for editing selected elements

## Implementation Details

### 1. Compile-Time Instrumentation

#### Purpose
During the build process, we inject `data-source-*` attributes into every JSX element so we can map DOM elements back to their source code locations.

<!-- #### Files Modified

**`server/services/visualEditInjector.ts`** (New File)
- Contains the Babel plugin that injects source location attributes
- Generates `visualEditBabelPlugin.cjs` file
- Modifies `vite.config.ts` to use Babel instead of SWC
- Adds inspector script to `public/visualEditInspector.js`
- Modifies `index.html` to load the inspector script -->

**Key Functions:**
```typescript
getVisualEditBabelPlugin() // Returns Babel plugin code
getVisualEditInspectorScript() // Returns inspector script code
injectVisualEditSupport(files) // Main injection function
```

**What It Does:**
- Adds `data-source-file` attribute with relative file path
- Adds `data-source-line` attribute with line number
- Adds `data-source-col` attribute with column number
- Adds `data-source-element` attribute with element name

**Example Output:**
```jsx
// Before
<div className="card">Hello</div>

// After (with instrumentation)
<div 
  data-source-file="src/pages/Index.tsx"
  data-source-line="12"
  data-source-col="4"
  data-source-element="div"
  className="card"
>
  Hello
</div>
```

<!-- #### Integration Points

**`server/routes/api/deploy.ts`** (Modified)
- Added import: `import { injectVisualEditSupport } from '../../services/visualEditInjector';`
- Modified both deployment endpoints:
  - `POST /api/deploy/deployToVercel`
  - `POST /api/deploy/deployToVercel-streaming`
- Files are processed through `injectVisualEditSupport()` before deployment -->


### 2. Runtime Inspector Script

#### Purpose
The inspector script runs inside the deployed application and handles:
- Element selection via click events
- Communication with parent window via `postMessage`
- Visual overlays for selected elements

#### Implementation


**Element Info Payload:**
```typescript
{
  filePath: string;        // e.g., "src/pages/Index.tsx"
  lineNumber: number;      // e.g., 12
  columnNumber: number;    // e.g., 4
  elementName: string;     // e.g., "div"
  tagName: string;         // e.g., "div"
  textContent: string;     // Text content of element
  className: string;       // CSS classes
  id: string;              // Element ID
}
```

### 3. Frontend Components

#### Visual Edit Panel

**Purpose:** Provides UI for editing selected elements

**Features:**
- Displays element information (tag, ID, line number, file path)
- Text content editor (TextArea)
- CSS classes editor (Input)
- Apply Changes button (saves to code)
- Deploy button (triggers deployment)

**Key Functions:**
```typescript
handleSave() // Applies changes to source code
```

**Text Replacement Logic:**
- Searches entire file for text content
- Uses multiple regex patterns to find text:
  - Inline JSX: `>text<`
  - Multi-line JSX: `>\n  text\n<`
  - String literals: `"text"` or `'text'`
  - Fallback: Simple string replace

**CSS Class Replacement:**
- Finds `className` attribute on target line
- Updates or adds `className` as needed



#### ChatBox Integration

**Purpose:** Adds Visual Edit toggle button next to Settings icon

**Location:** Bottom left of chat input area, right side of Settings button


**Button Behavior:**
- Shows as primary (purple) when enabled
- Shows as text when disabled

#### DocumentEditor Integration

**`client/src/containers/documents/components/DocumentEditor.tsx`** (Modified)

<!-- **New State:**
```typescript
const [visualEditEnabled, setVisualEditEnabled] = useState(false);
const [visualEditReady, setVisualEditReady] = useState(false);
const visualEditToggleRef = useRef<((enabled: boolean) => void) | null>(null);
```

**New Functions:**
```typescript
handleVisualEditStateChange() // Receives state from PrototypeEditor
handleVisualEditToggle() // Wrapper to call toggle function
``` -->

**Integration Flow:**
```
PrototypeEditor → onVisualEditStateChange → DocumentEditor → ChatBox
```

#### PrototypeEditorShow Integration


**Purpose:** Passes visual edit state callback through to PrototypeEditor

## File Structure

```
server/
├── services/
│   └── visualEditInjector.ts          
└── routes/
    └── api/
        └── deploy.ts                   

client/src/
├── containers/
│   ├── documents/
│   │   └── components/
│   │       ├── ChatBox.tsx             
│   │       └── DocumentEditor.tsx       
│   └── project/
│       └── components/
│           └── prototype/
│               ├── PrototypeEditor.tsx  
│               ├── PrototypeEditorShow.tsx 
│               ├── PrototypeEditorToolbar.tsx
│               └── VisualEditPanel.tsx  
```

## Data Flow

### Element Selection Flow

```
1. User clicks element in iframe preview
   ↓
2. Inspector script finds element with data-source-* attributes
   ↓
3. Inspector sends VISUAL_EDIT_SELECT message to parent
   ↓
4. PrototypeEditor receives message, sets selectedElement state
   ↓
5. VisualEditPanel renders with element info
```

### Edit Application Flow

```
1. User edits text/classes in VisualEditPanel
   ↓
2. User clicks "Apply Changes"
   ↓
3. handleSave() searches file for text/classes
   ↓
4. Updates file content with modifications
   ↓
5. Updates projectFiles state
   ↓
6. Code editor reflects changes
   ↓
7. User clicks "Deploy" to deploy to Vercel
```

<!-- ### State Management Flow

```
PrototypeEditor (manages state)
  ↓ onVisualEditStateChange callback
PrototypeEditorShow (passes through)
  ↓ onVisualEditStateChange callback
DocumentEditor (stores state)
  ↓ visualEditEnabled, visualEditReady, onVisualEditToggle
ChatBox (displays button)
``` -->

## Deployment Process

### After Visual Edit

```
User clicks "Save"
  ↓
injectVisualEditSupport(files) called
  ↓
Files modified:
  - vite.config.ts (uses Babel plugin)
  - visualEditBabelPlugin.cjs (added)
  - public/visualEditInspector.js (added)
  - index.html (loads inspector)
  ↓
Modified files sent to Vercel API
  ↓
Vercel builds with instrumentation
  ↓
Deployed app includes inspector script
```

## Key Technical Decisions

### 1. Why Babel Plugin Instead of SWC?

- SWC doesn't support custom plugins
- Babel has extensive plugin ecosystem
- Recast (used for AST manipulation) works with Babel

### 2. Why Inject Before Deployment?

- Cross-origin restrictions prevent script injection into iframe
- Deployed app must include inspector script
- Ensures inspector runs in same context as app

### 3. Why postMessage Communication?

- Only way to communicate across origins (localhost ↔ vercel.app)
- Secure and standard approach
- Works with iframe sandbox restrictions

### 4. Why Multiple Text Search Patterns?

- JSX can have text in various formats:
  - Inline: `<div>text</div>`
  - Multi-line: `<div>\n  text\n</div>`
  - String literals: `title="text"`
- Component files may use props instead of direct text


## Usage Instructions

1. **Enable Visual Edit:**
   - Click the pencil icon (Edit) button in ChatBox
   - Button is disabled until visual edit it ready

2. **Select Element:**
   - Click any element in the preview
   - Visual Edit Panel appears on the right

3. **Edit Content:**
   - Modify text in "Text Content" field
   - Modify classes in css using options like color picker, margin, padding, text align etc.
   - Click "Apply Changes" to save to code

4. **Deploy:**
   - Click "Deploy" button or use toolbar "Save" button
   - Changes are deployed to Vercel

5. **Close Panel:**
   - Click X button to close panel
   - Visual Edit mode stays enabled
   - Click Edit button again to disable

<!-- ## Testing Checklist

- [ ] Visual Edit button appears in ChatBox for PROTOTYPE/PRODUCT
- [ ] Button is disabled until deployment completes
- [ ] Clicking element opens Visual Edit Panel
- [ ] Text editing works for simple elements
- [ ] CSS class editing works
- [ ] "Apply Changes" updates code editor
- [ ] Deploy button triggers deployment
- [ ] Panel closes with X button (visual edit stays enabled)
- [ ] Visual Edit button toggles mode on/off -->


## Dependencies

- `@babel/parser` - AST parsing
- `@babel/traverse` - AST traversal
- `@babel/generator` - Code generation
- `@vitejs/plugin-react` - Babel-based React plugin (replaces SWC)
- `recast` - Code formatting preservation (for future AST edits)
