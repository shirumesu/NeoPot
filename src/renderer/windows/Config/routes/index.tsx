import { lazy } from 'react'
import { Navigate } from 'react-router-dom'

const configPageLoaders = {
  '/general': () => import('../pages/General'),
  '/translate': () => import('../pages/Translate'),
  '/recognize': () => import('../pages/Recognize'),
  '/hotkey': () => import('../pages/Hotkey'),
  '/service': () => import('../pages/Service'),
  '/plugin': () => import('../pages/Plugin'),
  '/about': () => import('../pages/About'),
} as const

export function preloadConfigRoute(path: string): void {
  const loader = configPageLoaders[path as keyof typeof configPageLoaders]
  if (loader) {
    void loader()
  }
}

const General = lazy(configPageLoaders['/general'])
const Translate = lazy(configPageLoaders['/translate'])
const Recognize = lazy(configPageLoaders['/recognize'])
const Hotkey = lazy(configPageLoaders['/hotkey'])
const Service = lazy(configPageLoaders['/service'])
const Plugin = lazy(configPageLoaders['/plugin'])
const About = lazy(configPageLoaders['/about'])

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
