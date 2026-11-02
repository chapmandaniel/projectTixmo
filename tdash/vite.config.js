import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ROBOTS_TXT, dashShouldNoIndex } from './src/lib/searchIndexing.js'

const blockSearchIndexing = () => dashShouldNoIndex({
    appEnv: process.env.VITE_APP_ENV,
    labsBranch: process.env.VITE_APP_LABS_BRANCH,
})

const robotsPlugin = () => ({
    name: 'tixmo-robots',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const path = req.url?.split('?')[0]
            if (path === '/robots.txt' && blockSearchIndexing()) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                res.end(ROBOTS_TXT)
                return
            }
            next()
        })
    },
    generateBundle() {
        if (!blockSearchIndexing()) return
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS_TXT })
    },
})

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), robotsPlugin()],
    build: {
        assetsDir: 'app-assets',
    },
    server: {
        port: 5173,
        open: false,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
})
