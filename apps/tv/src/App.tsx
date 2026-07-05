import { useTvStore } from './store'
import { LoginScreen } from './screens/LoginScreen'
import { HomeScreen } from './screens/HomeScreen'
import { Heartbeat } from './components/Heartbeat'

export default function App() {
  const { token, deviceId } = useTvStore()

  return (
    <>
      {deviceId && token && <Heartbeat deviceId={deviceId} />}
      {!token && <LoginScreen />}
      {token && <HomeScreen />}
    </>
  )
}
