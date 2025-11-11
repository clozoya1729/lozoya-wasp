class Lidar {
    constructor(parameters = {}) {
        let {
            numRays = 9,
            range = 60,         // m
            fov = Math.PI / 2,  // radians
            bufferLength = 10,
        } = parameters;
        this.numRays = numRays;
        this.range = range;
        this.fov = fov;
        this.history = [];  // store past readings for velocity estimation
        this.historyLength = bufferLength;
        this.hits = [];
    }

    // Cast rays from position `pos` with heading `theta`, returns hits and angles
    getHits(pos, theta, obstacles) {
        let hits = [], angles = [];
        for (let i = 0; i < this.numRays; ++i) {
            let offset = (i / (this.numRays - 1) - 0.5) * this.fov;
            let angle = theta + offset;
            // Add noise to the ray angle
            let noisyAngle = angle + gaussian_noise(0, angleNoiseStd);
            let best = null, bestDist = Infinity;
            for (const obs of obstacles) {
                let rawHit = this.rayCircleIntersect(pos.x, pos.y, noisyAngle, obs.x, obs.y, obs.r, this.range);
                if (rawHit) {
                    // Add noise to measured distance
                    let noisyDist = rawHit.dist + gaussian_noise(0, distanceNoiseStd);
                    // Clamp distance so it does not go beyond sensor range or below zero
                    noisyDist = Math.min(Math.max(noisyDist, 0), this.range);
                    if (noisyDist < bestDist) {
                        bestDist = noisyDist;
                        best = {
                            x: pos.x + noisyDist * Math.cos(noisyAngle),
                            y: pos.y + noisyDist * Math.sin(noisyAngle),
                            dist: noisyDist
                        };
                    }
                }
            }
            if (best) hits.push({...best, angle: noisyAngle});
            angles.push(noisyAngle);
        }
        return {hits, angles};
    }

    rayCircleIntersect(x0, y0, theta, cx, cy, r, maxRange) {
        let dx = Math.cos(theta), dy = Math.sin(theta);
        let ox = x0 - cx, oy = y0 - cy;
        let A = dx * dx + dy * dy, B = 2 * (ox * dx + oy * dy), C = ox * ox + oy * oy - r * r;
        let D = B * B - 4 * A * C;
        if (D < 0) return null;
        let t1 = (-B - Math.sqrt(D)) / (2 * A), t2 = (-B + Math.sqrt(D)) / (2 * A);
        let t = (t1 > 0 && t1 < maxRange) ? t1 : (t2 > 0 && t2 < maxRange) ? t2 : null;
        if (t == null) return null;
        return {x: x0 + t * dx, y: y0 + t * dy, dist: t};
    }

    // Store new lidar data for velocity estimation
    updateHistory(ts, minFrontDist, minSideDist, minBehindDist) {
        this.history.push({time: ts, minFrontDist, minSideDist, minBehindDist});
        if (this.history.length > this.historyLength) this.history.shift();
    }

    // Estimate velocities based on history (front, side, behind)
    estimateVelocities() {
        let frontVel = 0, sideVel = 0, behindVel = 0;
        if (this.history.length === this.historyLength) {
            let h0 = this.history[0], h2 = this.history[this.historyLength - 1];
            let dt = (h2.time - h0.time) / 1000;
            if (dt > 0) {
                frontVel = (h2.minFrontDist - h0.minFrontDist) / dt;
                sideVel = (h2.minSideDist - h0.minSideDist) / dt;
                behindVel = (h2.minBehindDist - h0.minBehindDist) / dt;
            }
        }
        return {frontVel, sideVel, behindVel};
    }

    constructor2(numRays, range, fov) {
        this.numRays = numRays;
        this.range = range;
        this.fov = fov;
        // history[i] = array of { time, dist } for ray i
        this.history = Array.from({length: numRays}, () => []);
        this.historyLength = lidarBufferLength;
    }

    // Aligned outputs: hits.length === numRays, each entry either null or {x,y,dist,angle}
    getHits2(pos, theta, obstacles) {
        const hits = new Array(this.numRays).fill(null);
        const angles = [];
        for (let i = 0; i < this.numRays; ++i) {
            const offset = (i / (this.numRays - 1) - 0.5) * this.fov;
            const angle = theta + offset;
            angles.push(angle);
            const noisyAngle = angle + gaussian_noise(0, angleNoiseStd);
            let best = null, bestDist = Infinity;
            for (const obs of obstacles) {
                const raw = this.rayCircleIntersect(pos.x, pos.y, noisyAngle, obs.x, obs.y, obs.r, this.range);
                if (raw) {
                    let noisyDist = raw.dist + gaussian_noise(0, distanceNoiseStd);
                    noisyDist = Math.min(Math.max(noisyDist, 0), this.range);
                    if (noisyDist < bestDist) {
                        bestDist = noisyDist;
                        best = {
                            x: pos.x + noisyDist * Math.cos(noisyAngle),
                            y: pos.y + noisyDist * Math.sin(noisyAngle),
                            dist: noisyDist,
                            angle: noisyAngle
                        };
                    }
                }
            }
            if (best) hits[i] = best;
        }
        return {hits, angles};
    }

    // Per-ray history update
    updateHistory2(ts, angles, hits) {
        for (let i = 0; i < this.numRays; ++i) {
            const d = hits[i] ? hits[i].dist : this.range;
            this.history[i].push({time: ts, dist: d});
            if (this.history[i].length > this.historyLength) this.history[i].shift();
        }
    }

    // Returns array vel[i] for each ray (m/s along the ray: +away, −toward)
    estimateVelocities2() {
        const v = new Array(this.numRays).fill(0);
        for (let i = 0; i < this.numRays; ++i) {
            const h = this.history[i];
            if (h.length >= 2) {
                const h0 = h[0], h1 = h[h.length - 1];
                const dt = (h1.time - h0.time) / 1000;
                if (dt > 0) v[i] = (h1.dist - h0.dist) / dt;
            }
        }
        return v;
    }

    draw(ctx) {

    }
}

export {
    Lidar,
}