const express = require('express');
function accountRoutes(auth, events, suggestions, setSession) {
    const router = express.Router();
    router.post('/register', async (req, res) => res.status(201).json(await auth.register(req.body?.email, req.body?.password)));
    router.post('/login', async (req, res) => {
        const result = await auth.login(req.body?.email, req.body?.password);
        setSession(res, result.token);
        res.json(result.user);
    });
    router.post('/logout', async (req, res) => {
        await auth.logout(req.sessionToken);
        setSession(res, '');
        res.status(204).end();
    });
    router.get('/me', (req, res) => res.json({ user: req.user }));
    router.get('/users/:id/registrations', async (req, res) => res.json(await events.myRegistrations(req.user, Number(req.params.id))));
    router.delete('/registrations/:id', async (req, res) => {
        await events.cancelRegistration(req.user, Number(req.params.id));
        res.status(204).end();
    });
    router.post('/suggestions', async (req, res) => res.json(await suggestions.suggest(req.user, req.body?.interests)));
    return router;
}
module.exports = { accountRoutes };
