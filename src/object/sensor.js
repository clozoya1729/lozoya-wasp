import {draw_circle, draw_line} from "../canvas.js";
import {gaussian_noise} from "../math.js";

class Lidar {
    constructor(parameters = {}) {
        let {
            numRays = 9,        // int
            range = 20,         // float, m
            fov = Math.PI / 2,  // float, radians
            bufferLength = 10,  // int
        } = parameters;
        this.position = {x: 0, y: 0};
        this.orientation = 0;
        this.numRays = numRays;
        this.range = range;
        this.fov = fov;
        // history[i] = array of { time, dist } for ray i
        // this.history = Array.from({length: numRays}, () => []);
        this.history = [];  // store past readings for velocity estimation
        this.historyLength = bufferLength;
        this.hits = [];
    }

    getHits(position, orientation, obstacles) {
        // Cast rays from position with orientation, returns hits and angles
        let hits = [];
        let angles = [];
        for (let i = 0; i < this.numRays; ++i) {
            let offset = (i / (this.numRays - 1) - 0.5) * this.fov;
            let angle = orientation + offset;
            // Add noise to the ray angle
            let noisyAngle = angle + gaussian_noise(0, angleNoiseStd);
            let best = null, bestDist = Infinity;
            for (const obs of obstacles) {
                let rawHit = this.ray_intersect_circle(position.x, position.y, noisyAngle, obs.x, obs.y, obs.r, this.range);
                if (rawHit) {
                    // Add noise to measured distance
                    let noisyDist = rawHit.dist + gaussian_noise(0, distanceNoiseStd);
                    // Clamp distance so it does not go beyond sensor range or below zero
                    noisyDist = Math.min(Math.max(noisyDist, 0), this.range);
                    if (noisyDist < bestDist) {
                        bestDist = noisyDist;
                        best = {
                            x: position.x + noisyDist * Math.cos(noisyAngle),
                            y: position.y + noisyDist * Math.sin(noisyAngle),
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

    getHits2(pos, theta, obstacles) {
        // Aligned outputs: hits.length === numRays, each entry either null or {x,y,dist,angle}
        const hits = new Array(this.numRays).fill(null);
        const angles = [];
        for (let i = 0; i < this.numRays; ++i) {
            const offset = (i / (this.numRays - 1) - 0.5) * this.fov;
            const angle = theta + offset;
            angles.push(angle);
            const noisyAngle = angle + gaussian_noise(0, angleNoiseStd);
            let best = null, bestDist = Infinity;
            for (const obs of obstacles) {
                const raw = this.ray_intersect_circle(pos.x, pos.y, noisyAngle, obs.x, obs.y, obs.r, this.range);
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

    ray_intersect_circle(x0, y0, theta, cx, cy, r, maxRange) {
        let dx = Math.cos(theta);
        let dy = Math.sin(theta);
        let ox = x0 - cx;
        let oy = y0 - cy;
        let A = dx * dx + dy * dy;
        let B = 2 * (ox * dx + oy * dy);
        let C = ox * ox + oy * oy - r * r;
        let D = B * B - 4 * A * C;
        if (D < 0) return null;
        let sqrtD = Math.sqrt(D);
        let t1 = (-B - sqrtD) / (2 * A);
        let t2 = (-B + sqrtD) / (2 * A);
        let eps = 1e-6;
        const t = (t1 > eps && t1 < maxRange) ? t1 : (t2 > eps && t2 < maxRange) ? t2 : null;
        if (t == null) return null;
        return {x: x0 + t * dx, y: y0 + t * dy, dist: t};
    }

    ray_intersect_segment(x0, y0, theta, x1, y1, x2, y2, maxRange) {
        const dx = Math.cos(theta);
        const dy = Math.sin(theta);
        const sx = x2 - x1;
        const sy = y2 - y1;
        const ox = x0 - x1;
        const oy = y0 - y1;
        const det = -dx * sy + dy * sx;
        const eps = 1e-9;
        if (Math.abs(det) < eps) return null;
        const t = (ox * sy - oy * sx) / det;
        const u = (-dx * oy + dy * ox) / det;
        if (t <= eps || t >= maxRange || u < 0 || u > 1) return null;
        return {x: x0 + t * dx, y: y0 + t * dy, dist: t};
    }

    ray_intersect_rect(x0, y0, theta, rect, maxRange) {
        const cx = rect.cx;
        const cy = rect.cy;
        const w = rect.w;
        const h = rect.h;
        const angle = rect.angle ?? 0;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const hw = 0.5 * w;
        const hh = 0.5 * h;
        const corners = [{x: -hw, y: -hh}, {x: hw, y: -hh}, {x: hw, y: hh}, {x: -hw, y: hh}].map(p => {
            const gx = cx + p.x * cosA - p.y * sinA;
            const gy = cy + p.x * sinA + p.y * cosA;
            return {x: gx, y: gy};
        });
        let best = null;
        for (let i = 0; i < 4; ++i) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            const hSeg = this.ray_intersect_segment(x0, y0, theta, a.x, a.y, b.x, b.y, maxRange);
            if (!hSeg) continue;
            if (!best || hSeg.dist < best.dist) best = hSeg;
        }
        return best;
    }

    updateHistory(ts, minFrontDist, minSideDist, minBehindDist) {
        // Store new lidar data for velocity estimation
        this.history.push({time: ts, minFrontDist, minSideDist, minBehindDist});
        if (this.history.length > this.historyLength) this.history.shift();
    }

    updateHistory2(ts, angles, hits) {
        // Per-ray history update
        for (let i = 0; i < this.numRays; ++i) {
            const d = hits[i] ? hits[i].dist : this.range;
            this.history[i].push({time: ts, dist: d});
            if (this.history[i].length > this.historyLength) this.history[i].shift();
        }
    }

    estimateVelocities() {
        // Estimate velocities based on history (front, side, behind)
        let frontVel = 0;
        let sideVel = 0;
        let behindVel = 0;
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

    estimateVelocities2() {
        // Returns array vel[i] for each ray (m/s along the ray: +away, −toward)
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

    cast_lidar_circles(position, orientation, shapes) {
        const hits = [];
        const angles = [];
        const denom = this.numRays > 1 ? (this.numRays - 1) : 1;
        for (let i = 0; i < this.numRays; ++i) {
            const offset = this.numRays > 1 ? (i / denom - 0.5) * this.fov : 0;
            const angle = orientation + offset;
            let best = null;
            for (let j = 0; j < shapes.length; ++j) {
                const s = shapes[j];
                const type = s.type ?? 'circle';
                let h = null;
                if (type === 'circle' || s.r != null) h = this.ray_intersect_circle(position.x, position.y, angle, s.cx, s.cy, s.r, this.range); else if (type === 'rect') h = this.ray_intersect_rect(position.x, position.y, angle, s, this.range);
                if (!h) continue;
                if (!best || h.dist < best.dist) best = {...h, shapeIndex: j, meta: s.meta};
            }
            if (best) hits.push({...best, angle});
            angles.push(angle);
        }
        return {hits, angles};
    }

    get_lidar_hits(getCirclesFn) {
        const circles = getCirclesFn();
        return this.cast_lidar_circles(this.position, this.orientation, circles);
    }

    step() {

    }

    draw(ctx, position, orientation, circles, parameters = {}) {
        let {
            numRays = 9,
            fov = Math.PI / 2,
            range = 60,
        } = parameters;
        const cast = this.cast_lidar_circles(position, orientation, circles)
        for (let i = 0; i < cast.angles.length; ++i) {
            const angle = cast.angles[i]
            const h = cast.hits.find(k => Math.abs(k.angle - angle) < 1e-6)
            const len = h ? h.dist : range
            const x1 = position.x + len * Math.cos(angle)
            const y1 = position.y + len * Math.sin(angle)
            draw_line(ctx, {
                start: [position.x, position.y],
                end: [x1, y1],
                color: '#4dd0e1',
                opacity: 0.6,
            })
        }
        for (const h of cast.hits) draw_circle(ctx, {
            radius: 3,
            centroid: [h.x, h.y],
            colorOutline: '#a00',
            colorFill: '#f00',
            opacityFill: 1
        })
    }
}

export {
    Lidar,
}