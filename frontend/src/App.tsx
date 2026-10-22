import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Overview } from '@/pages/Overview';
import { SystemServices } from '@/pages/SystemServices';
import { Processes } from '@/pages/Processes';
import { Drivers } from '@/pages/Drivers';
import { Docker } from '@/pages/Docker';
import { NetworkPorts } from '@/pages/NetworkPorts';
import { LogsAudit } from '@/pages/LogsAudit';
import { Settings } from '@/pages/Settings';

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/services" element={<SystemServices />} />
        <Route path="/processes" element={<Processes />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/docker" element={<Docker />} />
        <Route path="/network" element={<NetworkPorts />} />
        <Route path="/logs" element={<LogsAudit />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;