import { Routes, Route } from 'react-router-dom';
import CdpDetails from './components/CdpDetails';
import CdpHomePage from './components/CdpHomePage';

function App() {
    return (
        <div>
            <Routes>
                <Route path="/" element={<CdpHomePage/>} />
                <Route path="/cdp/:cdpId" element={<CdpDetails />} />
            </Routes>
        </div>
    );
}

export default App;
