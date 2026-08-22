import { Navigate, Route, Routes } from 'react-router-dom'
import { ControlPage } from './routes/control/ControlPage'
import { OutputPage } from './routes/output/OutputPage'
import { NotFoundPage } from './routes/not-found/NotFoundPage'
import { MobileBlockOverlay } from './components/layout/MobileBlockOverlay'

function App() {
  return (
    <>
      {/* fuori dalle route: copre sia /control che /output senza doverlo montare due volte */}
      <MobileBlockOverlay />
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<ControlPage />} />
        <Route path="/output" element={<OutputPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
