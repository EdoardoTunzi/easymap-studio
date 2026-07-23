import { Navigate, Route, Routes } from 'react-router-dom'
import { ControlPage } from './routes/control/ControlPage'
import { OutputPage } from './routes/output/OutputPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/control" replace />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="/output" element={<OutputPage />} />
    </Routes>
  )
}

export default App
