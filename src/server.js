const { createApp } = require('./app');
const { openStore } = require('./data/store');
async function start() {
    const data = await openStore();
    const port = process.env.PORT || 3000;
    const server = createApp(data).listen(port, '0.0.0.0', () => console.log(`Campus Club Events running on port ${server.address().port}`));
    async function stop() {
        server.close(async () => { await data.close(); process.exit(0); });
    }
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}
start().catch(error => { console.error('Startup failed:', error.name); process.exitCode = 1; });
