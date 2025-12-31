import { HashRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';

const App = () => (
  <HashRouter>
    <Routes>
      <Route path="/" element={<Index />} />
    </Routes>
  </HashRouter>
);

export default App;
