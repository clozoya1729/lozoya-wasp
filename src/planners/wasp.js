import {PlannerInterface} from './planner.js';

class PlannerWASP extends PlannerInterface {
    constructor(parameters = {}) {
        super(parameters);
        this.tangentScaleFrac = parameters.tangentScaleFrac ?? 0.5;
        this.lidarRange = parameters.lidarRange ?? 60;
        this.numLidar = parameters.numLidar ?? 9;
        this.avoidDistance = parameters.avoidDistance ?? 40;
        this.sideDistance = parameters.sideDistance ?? -40;
        this.avoidResetDelay = parameters.avoidResetDelay ?? 100;
        this.avoidActive = false;
        this.avoidRestore = false;
        this.avoidClearTime = null;
    }

    compute_avoid_p2(agent, lidarHits) {
        let fx = agent.p3.x - agent.p1.x;
        let fy = agent.p3.y - agent.p1.y;
        let fmag = Math.hypot(fx, fy);
        if (fmag < 1e-6) return {x: agent.p1.x + this.avoidDistance, y: agent.p1.y};
        let fwd = {x: fx / fmag, y: fy / fmag};
        let left = {x: -fwd.y, y: fwd.x};
        let leftCount = 0;
        let rightCount = 0;
        for (let h of lidarHits) {
            let vx = h.x - agent.p1.x;
            let vy = h.y - agent.p1.y;
            let det = fwd.x * vy - fwd.y * vx;
            if (det > 0) leftCount += 1;
            else if (det < 0) rightCount += 1;
        }
        let side = 0;
        if (leftCount > rightCount) side = 1;
        else if (rightCount > leftCount) side = -1;
        return {
            x: agent.p1.x + fwd.x * this.avoidDistance + side * left.x * this.sideDistance,
            y: agent.p1.y + fwd.y * this.avoidDistance + side * left.y * this.sideDistance,
        };
    }

    update(ts, dt, agent, get_collision_geometry) {
        if (!agent.lidar) return;
        agent.lidar.range = this.lidarRange;
        agent.lidar.numRays = this.numLidar;
        agent.lidar.position = agent.p1;
        agent.lidar.orientation = agent.orientation;
        const res = agent.lidar.get_lidar_hits(() => get_collision_geometry(agent.name));
        const hits = res.hits;
        if (!this.avoidActive && hits.length > 0) {
            this.avoidActive = true;
            this.avoidRestore = false;
            this.avoidClearTime = null;
            let nextP2 = this.compute_avoid_p2(agent, hits);
            agent.p2.x = nextP2.x;
            agent.p2.y = nextP2.y;
            agent.update_spline_from_p1_to_p2();
        }
        if (this.avoidActive && hits.length === 0) {
            if (this.avoidClearTime === null) this.avoidClearTime = ts;
            else if (ts - this.avoidClearTime > this.avoidResetDelay) {
                agent.p2.x = agent.p3.x;
                agent.p2.y = agent.p3.y;
                this.avoidActive = false;
                this.avoidClearTime = null;
                agent.update_spline_from_p1_to_p2();
            }
        } else if (hits.length > 0) {
            this.avoidClearTime = null;
        }
        if (this.avoidRestore) {
            let dx = agent.p3.x - agent.p2.x;
            let dy = agent.p3.y - agent.p2.y;
            let d = Math.hypot(dx, dy);
            let stepMag = Math.min(2000 * dt, d);
            if (d > 1) {
                agent.p2.x += dx / d * stepMag;
                agent.p2.y += dy / d * stepMag;
                agent.update_spline_from_p1_to_p2();
            } else {
                agent.p2.x = agent.p3.x;
                agent.p2.y = agent.p3.y;
                this.avoidActive = false;
                this.avoidRestore = false;
                agent.update_spline_from_p1_to_p2();
            }
        }
    }
}

export {PlannerWASP};
