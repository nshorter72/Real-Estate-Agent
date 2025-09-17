import React from 'react';
import { createRoot } from 'react-dom/client';
import { RealEstateAgent } from '../../dist/index.mjs';

function App() {
  return <RealEstateAgent onGenerate={() => {}} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
