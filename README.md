# Real Estate Agent UI

[![GitHub stars](https://img.shields.io/github/stars/nshorter72/Real-Estate-Agent?style=social)](https://github.com/nshorter72/Real-Estate-Agent/stargazers)

A reusable React component that generates post-offer timelines and email templates for real estate transactions.

Live demo (once published)
- Demo URL after publishing: https://nshorter72.github.io/Real-Estate-Agent
- The demo is served from the example app and is ready to be published via GitHub Pages using the included workflow.

Install (quick)
```bash
# Install the package and peer deps in an existing React app
npm install real-estate-agent react react-dom lucide-react
# or with yarn
yarn add real-estate-agent react react-dom lucide-react
```

Start using immediately (quick start)
1. Ensure your app includes Tailwind CSS (component uses Tailwind utility classes) or provide equivalent CSS.
2. Import and render the component:
```tsx
import React from 'react';
import { RealEstateAgent } from 'real-estate-agent';

export default function App() {
  return <RealEstateAgent />;
}
```
3. Run your app (e.g., `npm run dev` or `npm start` depending on your setup). The component provides UI for:
   - Uploading the accepted offer document
   - Entering offer details (dates, parties, periods)
   - Generating a transaction timeline
   - Generating email templates and copying them to clipboard
   - Printing the timeline

What is included in this repository / package
- src/RealEstateAgent.tsx — TypeScript React component (exported as named and default export)
- src/index.ts — package entry that re-exports the component
- dist/ — build outputs produced by the bundler (ESM, CJS, and .d.ts)
  - dist/index.mjs (ES module)
  - dist/index.js (CommonJS)
  - dist/index.d.ts (TypeScript declarations)
- example/ — Vite demo that imports the built bundle and mounts the component
  - example/index.html
  - example/src/main.tsx
  - example/package.json
- .github/workflows/pages.yml — CI workflow that builds the library and deploys `example/dist` to GitHub Pages
- package.json — package metadata, scripts, and peer/dev deps
- tsconfig.json — TypeScript configuration

How users will access the program
- Hosted demo (one click): open https://nshorter72.github.io/Real-Estate-Agent after you push and Actions completes.
- Installable package: `npm install real-estate-agent` then import `RealEstateAgent` in any React app.
- Local preview: `npm run build` then `cd example && npm install && npm run dev` to view the example locally.

Publish steps you must run (one-time)
1. Create the GitHub repo at https://github.com/nshorter72/Real-Estate-Agent and push this project to branch `main`.
   - git add .
   - git commit -m "Add example and GH Pages workflow"
   - git push origin main
2. Ensure GitHub Actions runs successfully; the workflow will build the library and example and publish `example/dist` to GitHub Pages.
3. After Actions completes, visit: https://nshorter72.github.io/Real-Estate-Agent

Notes on access control
- Current configuration publishes the demo publicly. If you later want to control access, add a custom domain and front it with Cloudflare Access (SSO, allowlists). No app changes are required for Access.

Support and next steps I can perform
- Add a CI badge and demo link to README automatically.
- Help configure Cloudflare Access with a custom domain when you decide to add access control.
- Create a small release workflow to publish npm when ready.
