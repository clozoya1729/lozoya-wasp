class PlannerInterface {
    constructor(parameters = {}) {
    }

    update(ts, dt, agent, getCirclesFn, castFn) {
        /** Called once per simulation step */
        throw new Error('PlannerInterface.update() not implemented');
    }

    getNextPose() {
        /** After update(), returns the next pose */
        return {
            position: {x: 0, y: 0},
            orientation: 0,
        };
    }

    draw(ctx) {
    }
}

export {
    PlannerInterface,
}