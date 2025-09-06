import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './routes/App'
import Lists from './routes/Lists'
import ListDetail from './routes/ListDetail'
import GlobalTasks from './routes/GlobalTasks'
import Join from './routes/Join'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Lists /> },
      { path: 'lists/:id', element: <ListDetail /> },
      { path: 'tasks', element: <GlobalTasks /> },
      { path: 'join/:token', element: <Join /> },
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
