// @ts-nocheck
import { Navigate } from 'react-router-dom'

import Translate from '../pages/Translate'
import Recognize from '../pages/Recognize'
import General from '../pages/General'
import Service from '../pages/Service'
import Hotkey from '../pages/Hotkey'
import About from '../pages/About'
import Plugin from '../pages/Plugin'

const routes = [
  {
    path: '/general',
    element: <General />,
  },
  {
    path: '/translate',
    element: <Translate />,
  },
  {
    path: '/recognize',
    element: <Recognize />,
  },
  {
    path: '/hotkey',
    element: <Hotkey />,
  },
  {
    path: '/service',
    element: <Service />,
  },
  {
    path: '/plugin',
    element: <Plugin />,
  },
  {
    path: '/about',
    element: <About />,
  },
  {
    path: '/',
    element: <Navigate to="/general" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/general" replace />,
  },
]

export default routes
