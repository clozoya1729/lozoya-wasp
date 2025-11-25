class PlannerInterface {
    constructor(parameters = {}) {
    }

    update(ts, dt, agent, collision_geometry_get) {
        /** Called once per simulation step */
        throw new Error('PlannerInterface.update() not implemented');
    }

    draw(ctx) {
    }
}

export {
    PlannerInterface,
}