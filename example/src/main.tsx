import React from 'react';
import { createRoot } from 'react-dom/client';
/* Import the source component for the example build instead of expecting a pre-built bundle.
   This keeps the example working in CI where the library dist may not exist yet. */
import { RealEstateAgent } from '../../src/RealEstateAgent';
 
function App() {
  return <RealEstateAgent onGenerate={() => {}} />;
}
 
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
