import { BrowserRouter } from 'react-router-dom'
import HomePage from './HomePage'
import LogInPage from './LogInPage'
import useRoute from './useRoute'
// import useRoute from './useRoute'

function App() {
  return (
    <BrowserRouter>
      <MainWindow />
    </BrowserRouter>
  )
}

function MainWindow() {
  const { route } = useRoute()
  if (route.page === 'home') {
    return <HomePage />
  }
  else if (route.page === 'logIn') {
    return <LogInPage />
  }
  else if (route.page === 'lindiCloudLogin') {
    return <div style={{padding: 30}}>
      <h1>Logged in</h1>
      <p>Here is your access token: {route.accessToken}</p>
    </div>
  }
  else {
    return <div>Invalid route</div>
  }
}

export default App
