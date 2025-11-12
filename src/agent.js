/*
TODO: move wasp code to planners/wasp.js
 */
import {draw_circle, draw_rectangle, draw_tangent, draw_text} from './canvas.js';
import {evaluate_quintic_2d, fit_quintic, quintic_tangent, tangent_vector} from './math.js';

class Agent {
    constructor(parameters = {}) {
        let name = parameters.name ?? 'Agent';
        let positionX = parameters.positionX ?? 100;
        let positionY = parameters.positionY ?? 350;
        let speed = parameters.speed ?? 100;
        let targetX = parameters.targetX ?? 700;
        let targetY = parameters.targetY ?? 100;
        let lidar = parameters.lidar ?? null;
        let tangentScaleFrac = parameters.tangentScaleFrac ?? 0.5;
        let lidarRange = parameters.lidarRange ?? 60;
        let lidarFov = parameters.lidarFov ?? Math.PI / 2;
        let numLidar = parameters.numLidar ?? 9;
        let avoidDistance = parameters.avoidDistance ?? 40;
        let sideDistance = parameters.sideDistance ?? -40;
        let avoidResetDelay = parameters.avoidResetDelay ?? 200;
        let p2SnapLookaheadSec = parameters.p2SnapLookaheadSec ?? 0.20;
        let p2SnapDistance = parameters.p2SnapDistance ?? 6;
        let collisionRadius = parameters.collisionCircle ?? 30;
        let collisionMargin = parameters.collisionMargin ?? 0;
        let colorTrail = parameters.colorTrail ?? '#000';
        let colorBodyFill = parameters.colorBodyFill ?? '#fff';
        let colorBodyOutline = parameters.colorBodyOutline ?? '#888';
        let colorText = parameters.colorText ?? '#888';
        this.name = name;
        this.p1 = {x: positionX, y: positionY};
        this.p2 = {x: targetX, y: targetY};
        this.p3 = {x: targetX, y: targetY};
        this.orientation = -Math.PI / 3;
        this.targetTangent = 0;
        this.tangentScaleFrac = tangentScaleFrac;
        this.currentSpline = null;
        this.arcLengthTable = [];
        this.arcLen = 0;
        this.speed = speed;
        this.lidar = lidar;
        this.lidarRange = lidarRange;
        this.lidarFov = lidarFov;
        this.numLidar = numLidar;
        this.avoidDistance = avoidDistance;
        this.sideDistance = sideDistance;
        this.avoidResetDelay = avoidResetDelay;
        this.p2SnapLookaheadSec = p2SnapLookaheadSec;
        this.p2SnapDistance = p2SnapDistance;
        this.collisionRadius = collisionRadius;
        this.collisionMargin = collisionMargin;
        this.colorBodyFill = colorBodyFill;
        this.colorBodyOutline = colorBodyOutline;
        this.colorText = colorText;
        this.avoidActive = false;
        this.avoidRestore = false;
        this.avoidClearTime = null;
        this.trail = [];
        this.colorTrail = colorTrail;
        this.lastTrailTime = null;
        this.svg = null;
        this._update_spline_from_p1_to_p2();
    }

    set_target_tangent(thetaRad) {
        this.targetTangent = thetaRad;
        if (this._p2_is_p3()) this._update_spline_from_p1_to_p2();
    }

    _p2_is_p3() {
        return this.p2.x === this.p3.x && this.p2.y === this.p3.y;
    }

    _compute_arc_length_table(spline, segments = 200) {
        let table = [];
        let prev = evaluate_quintic_2d(spline, 0);
        let acc = 0;
        table.push({t: 0, arcLen: 0});
        for (let i = 1; i <= segments; ++i) {
            let t = i / segments;
            let pt = evaluate_quintic_2d(spline, t);
            acc += Math.hypot(pt.x - prev.x, pt.y - prev.y);
            table.push({t: t, arcLen: acc});
            prev = pt;
        }
        return table;
    }

    _get_t_for_arc_length(table, s) {
        if (s <= 0) return 0;
        if (s >= table[table.length - 1].arcLen) return 1;
        for (let i = 1; i < table.length; ++i) {
            if (s <= table[i].arcLen) {
                let t0 = table[i - 1].t;
                let t1 = table[i].t;
                let s0 = table[i - 1].arcLen;
                let s1 = table[i].arcLen;
                let f = (s - s0) / (s1 - s0);
                return t0 + f * (t1 - t0);
            }
        }
        return 1;
    }

    _update_spline_from_p1_to_p2() {
        let segLen = Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y) * this.tangentScaleFrac;
        let va = tangent_vector(this.orientation, segLen);
        let thetaP2 = this._p2_is_p3() ? this.targetTangent : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
        let vb = tangent_vector(thetaP2, segLen);
        this.currentSpline = fit_quintic(this.p1, va, this.p2, vb);
        this.arcLengthTable = this._compute_arc_length_table(this.currentSpline, 200);
        this.arcLen = 0;
    }

    _compute_avoid_p2(lidarHits) {
        let fx = this.p3.x - this.p1.x;
        let fy = this.p3.y - this.p1.y;
        let fmag = Math.hypot(fx, fy);
        if (fmag < 1e-6) return {x: this.p1.x + this.avoidDistance, y: this.p1.y};
        let fwd = {x: fx / fmag, y: fy / fmag};
        let left = {x: -fwd.y, y: fwd.x};
        let leftCount = 0;
        let rightCount = 0;
        for (let h of lidarHits) {
            let vx = h.x - this.p1.x;
            let vy = h.y - this.p1.y;
            let det = fwd.x * vy - fwd.y * vx;
            if (det > 0) leftCount += 1;
            else if (det < 0) rightCount += 1;
        }
        let side = 0;
        if (leftCount > rightCount) side = 1;
        else if (rightCount > leftCount) side = -1;
        return {
            x: this.p1.x + fwd.x * this.avoidDistance + side * left.x * this.sideDistance,
            y: this.p1.y + fwd.y * this.avoidDistance + side * left.y * this.sideDistance,
        };
    }

    _get_lidar_hits(getCirclesFn, castFn) {
        if (!this.lidar) return {hits: [], angles: []};
        const circles = getCirclesFn().filter(c => !(c.meta && c.meta.type === 'agent' && c.meta.name === this.name));
        return castFn(this.p1, this.orientation, circles, {
            numLidar: this.numLidar,
            lidarFov: this.lidarFov,
            lidarRange: this.lidarRange,
        });
    }

    step(ts, dt, getCirclesFn, castFn) {
        if (this.lastTrailTime === null) this.lastTrailTime = ts;
        if (ts - this.lastTrailTime >= 100 || this.trail.length === 0) {
            this.trail.push({x: this.p1.x, y: this.p1.y});
            this.lastTrailTime = ts;
        }
        const res = this._get_lidar_hits(getCirclesFn, castFn)
        const combinedHits = res.hits
        if (!this.avoidActive && combinedHits.length > 0) {
            this.avoidActive = true;
            this.avoidRestore = false;
            this.avoidClearTime = null;
            let nextP2 = this._compute_avoid_p2(combinedHits);
            this.p2.x = nextP2.x;
            this.p2.y = nextP2.y;
            this._update_spline_from_p1_to_p2();
        }
        if (this.avoidActive && combinedHits.length === 0) {
            if (this.avoidClearTime === null) this.avoidClearTime = ts;
            else if (ts - this.avoidClearTime > this.avoidResetDelay) {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.avoidActive = false;
                this.avoidClearTime = null;
                this._update_spline_from_p1_to_p2();
            }
        } else if (combinedHits.length > 0) {
            this.avoidClearTime = null;
        }
        if (this.avoidRestore) {
            let dx = this.p3.x - this.p2.x;
            let dy = this.p3.y - this.p2.y;
            let d = Math.hypot(dx, dy);
            let stepMag = Math.min(2000 * dt, d);
            if (d > 1) {
                this.p2.x += dx / d * stepMag;
                this.p2.y += dy / d * stepMag;
                this._update_spline_from_p1_to_p2();
            } else {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.avoidActive = false;
                this.avoidRestore = false;
                this._update_spline_from_p1_to_p2();
            }
        }
        this.arcLen += this.speed * dt;
        let total = this.arcLengthTable[this.arcLengthTable.length - 1].arcLen;
        if (this.arcLen > total) this.arcLen = total;
        let t = this._get_t_for_arc_length(this.arcLengthTable, this.arcLen);
        let p = evaluate_quintic_2d(this.currentSpline, t);
        let th = quintic_tangent(this.currentSpline, t);
        this.p1.x = p.x;
        this.p1.y = p.y;
        this.orientation = th;
        if (this.lidar) {
            this.lidar.position = this.p1;
            this.lidar.orientation = this.orientation;
        }
        if (!this._p2_is_p3()) {
            let remaining = total - this.arcLen;
            let distLookahead = Math.max(this.p2SnapDistance ?? 6, this.speed * (this.p2SnapLookaheadSec ?? 0.2));
            if (remaining <= distLookahead) {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this._update_spline_from_p1_to_p2();
            }
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.trail.length; ++i) {
            draw_circle(ctx, {
                radius: 0.4,
                centroid: [this.trail[i].x, this.trail[i].y],
                colorOutline: this.colorTrail,
                colorFill: this.colorTrail,
                opacityFill: 1,
            });
        }
        draw_circle(ctx, {
            radius: this.lidarRange,
            centroid: [this.p1.x, this.p1.y],
            colorOutline: '#0ff',
            opacityFill: 0,
            opacityOutline: 0.2,
        });
        draw_rectangle(ctx, {
            coordinate: [this.p1.x, this.p1.y],
            orientation: this.orientation,
            colorFill: this.colorBodyFill,
            colorOutline: this.colorBodyOutline,
            opacityFill: 0.5,
        });
        draw_circle(ctx, {
            radius: this.collisionRadius,
            centroid: [this.p1.x, this.p1.y],
            colorOutline: '#ff9800',
            colorFill: '#ff9800',
            opacityFill: 0.05,
            opacityOutline: 0.3,
            dash: [8, 8],
        });
    }

    draw_waypoints(ctx, colors = {p1: '#0ff', p2: '#4a5', p3: '#258'}) {
        draw_circle(ctx, {
            radius: 0,
            centroid: [this.p1.x, this.p1.y],
            colorOutline: colors.p1,
            opacityFill: 0,
        });
        draw_tangent(ctx, {
            start: [this.p1.x, this.p1.y],
            length: 44,
            angle: this.orientation,
            color: colors.p1,
            dash: [6, 4],
        });
        draw_text(ctx, {
            coordinate: [this.p1.x - 10, this.p1.y - 30],
            text: this.name,
            color: this.colorText,
        });
        draw_circle(ctx, {
            radius: 8,
            centroid: [this.p2.x, this.p2.y],
            colorOutline: colors.p2,
            opacityFill: 0,
        });
        let thetaP2 = this._p2_is_p3() ? this.targetTangent : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
        draw_tangent(ctx, {
            start: [this.p2.x, this.p2.y],
            length: 44,
            angle: thetaP2,
            color: colors.p2,
            dash: [6, 4],
        });
        draw_text(ctx, {
            coordinate: [this.p2.x - 10, this.p2.y + 20],
            text: `${this.name} Waypoint`,
            color: this.colorText,
        });
        draw_circle(ctx, {
            radius: 4,
            centroid: [this.p3.x, this.p3.y],
            colorOutline: colors.p3,
            opacityFill: 0,
        });
        draw_tangent(ctx, {
            start: [this.p3.x, this.p3.y],
            length: 44,
            angle: this.targetTangent,
            color: colors.p3,
            dash: [6, 4]
        });
        draw_text(ctx, {
            coordinate: [this.p3.x - 10, this.p3.y - 15],
            text: `${this.name} Target`,
            color: this.colorText,
        });
    }
}

export {Agent};

