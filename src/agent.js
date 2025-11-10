class Agent {
    constructor(parameters = {}) {
        let {
            positionX = 100,        // m
            positionY = 350,        // m
            avoidDistance = 40,     // m
            sideDistance = 40,      // m
            avoidResetDelay = 500,  // ms
            speed = 100,            // m/s
            targetX = 700,          // m
            targetY = 100,          // m
            avoidClearTime = null,
            avoidRestore = false,
            avoidActive = false,
            lastDotTime = null,
            dots = [],
            currentSpline = null,
        } = parameters;
        this.positionX = positionX;
        this.positionY = positionY;
        this.avoidDistance = avoidDistance;
        this.sideDistance = sideDistance;
        this.avoidResetDelay = avoidResetDelay;
        this.speed = speed;
        this.targetX = targetX;
        this.targetY = targetY;
        this.avoidClearTime = avoidClearTime;
        this.avoidRestore = avoidRestore;
        this.avoidActive = avoidActive;
        this.lastTrailTime = lastDotTime;
        this.trail = dots;
        this.currentSpline = currentSpline;
    }

    step_trail(ts, p) {
        if (this.lastTrailTime === null) this.lastTrailTime = ts;
        if (ts - this.lastTrailTime >= 100 || this.trail.length === 0) {
            this.trail.push({x: p.x, y: p.y});
            this.lastTrailTime = ts;
        }
    }

    step(ts, dt, p) {
        this.step_trail(ts, p);
    }

    draw_trail(ctx) {
        if (this.trail.length > 0) {
            ctx.save();
            ctx.fillStyle = "#fff";
            for (let i = 0; i < this.trail.length; ++i) {
                ctx.beginPath();
                ctx.arc(this.trail[i].x, this.trail[i].y, 1, 0, 2 * Math.PI);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    draw(ctx) {
        this.draw_trail(ctx);
    }

}

export {
    Agent,
}