const express = require('express');
function eventRoutes(service) {
    const router = express.Router();
    router.get('/', async (req, res) => res.json(await service.listEvents()));
    router.get('/:id', async (req, res) => res.json(await service.getEvent(Number(req.params.id))));
    router.post('/', async (req, res) => res.status(201).json(await service.createEvent(req.user, req.body)));
    router.patch('/:id', async (req, res) => res.json(await service.updateEvent(req.user, Number(req.params.id), req.body)));
    router.post('/:id/registrations', async (req, res) => res.status(201).json(await service.registerEvent(req.user, Number(req.params.id))));
    return router;
}
module.exports = { eventRoutes };
