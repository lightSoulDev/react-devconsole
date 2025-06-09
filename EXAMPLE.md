# DevConsole Example

Here's an example of using DevConsole in a Vite + React + TypeScript project:

.env

```env
VITE_DEV_CONSOLE=active # active/hidden/disable
```

vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Add this line to prevent the DevConsole JS bundle from being included in production.
    'import.meta.env.VITE_DEV_CONSOLE': JSON.stringify(process.env.VITE_DEV_CONSOLE || 'disable')
  }
})
```

App.tsx

```tsx
import { useState } from 'react'
import './App.css'
import { configureDevConsole, DevConsole, DevConsoleUI, activateHttpExtension, activateStorageExtension, setUserHeaders } from 'devconsole'

// Configure DevConsole
configureDevConsole({
  enableConsoleOutput: false,
  maxLogs: 500,
  enableSourceTracking: true
});

// Register custom commands
DevConsole.registerCommand({
  name: 'echo',
  description: 'Echo back the provided message',
  handler: (args) => {
    DevConsole.dev(args.join(' ') || 'No message provided');
  }
});

// Set variables that will be available in the DevConsole using the ${variableName} syntax.
DevConsole.setVariable('apiHost', 'http://localhost:8080');

// Activate extensions (you can write your own extensions as well)
(async () => {
  await activateHttpExtension();
  await activateStorageExtension();

  // Example: Set user headers for authenticated requests.
  await setUserHeaders({
    'Authorization': 'Bearer your-api-token-here'
  });
})();

// Render the DevConsole UI
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <DevConsoleUI />
      <div>
        <h1>DevConsole Example</h1>
        <button onClick={() => {
          setCount((count) => count + 1);
          DevConsole.info('Button clicked', { count });
        }}>
          Clicked {count} times
        </button>
        <p>Press ~ to open the DevConsole</p>
        <p>/help - See all commands</p>
      </div>
    </>
  )
}

export default App;
```

## Production Safety

The logger is designed to be production-safe — you can leave logging and logger function calls in place.
Just make sure to set the `VITE_DEV_CONSOLE` environment variable to `disable` in production builds.
This will replace the DevConsole bundle with an empty No-Op module, ensuring no DevConsole code is included in the final build.