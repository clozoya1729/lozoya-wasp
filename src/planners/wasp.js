import {PlannerInterface} from './planner.js';
import {
    compute_arc_length_table,
    evaluate_quintic_2d,
    fit_quintic,
    get_t_for_arc_length,
    quintic_tangent,
    tangent_vector,
} from '../math.js';
import {draw_circle, draw_curve, draw_tangent, draw_text,} from "../canvas.js";

class PlannerWASP extends PlannerInterface {
    constructor(parameters = {}) {
        super(parameters);
        let {
            initialX = 0,
            initialY = 0,
            initialOrientation = 0,
            targetX = 100,
            targetY = 100,
            targetOrientation = 100,
            tangentScaleFraction = 1,
            avoidDistance = 40,
            sideDistance = -40,
            avoidResetDelay = 100,
            p2SnapDistance = 6,
            p2SnapLookaheadSec = 0.2,
            speed = 50,
            name = 'Planner',
        } = parameters;
        this.p1 = {x: initialX, y: initialY, orientation: initialOrientation};
        this.p2 = {x: targetX, y: targetY, orientation: targetOrientation};
        this.p3 = {x: targetX, y: targetY, orientation: targetOrientation};
        this.tangentScaleFraction = tangentScaleFraction;
        this.avoidDistance = avoidDistance;
        this.sideDistance = sideDistance;
        this.avoidResetDelay = avoidResetDelay;
        this.spline = null;
        this.arcLengthTable = [];
        this.arcLength = 0;
        this.p2SnapDistance = p2SnapDistance;
        this.p2SnapLookaheadSec = p2SnapLookaheadSec;
        this.avoidActive = false;
        this.avoidRestore = false;
        this.avoidClearTime = null;
        this.name = name
        this.speed = speed;
        this.update_spline_from_p1_to_p2();
    }

    record_replan(agent) {
        if (!agent || !agent.replans) return;
        agent.replans.push({
            t: agent.time,
            x: this.p1.x,
            y: this.p1.y,
            orientation: this.p1.orientation
        });
        agent.mark_replan(agent.time);
    }

    is_p2_p3() {
        return this.p2.x === this.p3.x && this.p2.y === this.p3.y && this.p2.orientation === this.p3.orientation;
    }

    update_spline_from_p1_to_p2() {
        let segLen = Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y) * this.tangentScaleFraction;
        let va = tangent_vector(this.p1.orientation, segLen);
        let thetaP2 = this.is_p2_p3() ? this.p3.orientation : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
        let vb = tangent_vector(thetaP2, segLen);
        this.spline = fit_quintic(this.p1, va, this.p2, vb);
        this.arcLengthTable = compute_arc_length_table(this.spline, 200);
        this.arcLen = 0;
    }

    compute_avoid_p2(agent, lidarHits) {
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

    update(ts, dt, agent, collision_geometry_get) {
        if (!agent.lidar) return;
        const res = agent.lidar.get_lidar_hits(() => collision_geometry_get(agent.name));
        const hits = res.hits;
        if (!this.avoidActive && hits.length > 0) {
            this.avoidActive = true;
            this.avoidRestore = false;
            this.avoidClearTime = null;
            let nextP2 = this.compute_avoid_p2(agent, hits);
            this.p2.x = nextP2.x;
            this.p2.y = nextP2.y;
            this.update_spline_from_p1_to_p2();
            this.record_replan(agent);
        }
        if (this.avoidActive && hits.length === 0) {
            if (this.avoidClearTime === null) {
                this.avoidClearTime = ts;
            } else if (ts - this.avoidClearTime > this.avoidResetDelay) {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.avoidActive = false;
                this.avoidClearTime = null;
                this.update_spline_from_p1_to_p2();
                this.record_replan(agent);
            }
        } else if (hits.length > 0) {
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
                this.update_spline_from_p1_to_p2();
            } else {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.avoidActive = false;
                this.avoidRestore = false;
                this.update_spline_from_p1_to_p2();
            }
        }
        if (!this.spline || this.arcLengthTable.length === 0) return;
        this.arcLen += this.speed * dt;
        let total = this.arcLengthTable[this.arcLengthTable.length - 1].arcLen;
        if (this.arcLen > total) this.arcLen = total;
        let t = get_t_for_arc_length(this.arcLengthTable, this.arcLen);
        let p = evaluate_quintic_2d(this.spline, t);
        let th = quintic_tangent(this.spline, t);
        this.p1.x = p.x;
        this.p1.y = p.y;
        this.p1.orientation = th;
        if (!this.is_p2_p3()) {
            let remaining = total - this.arcLen;
            let distLookahead = Math.max(this.p2SnapDistance ?? 6, this.speed * (this.p2SnapLookaheadSec ?? 0.2));
            if (remaining <= distLookahead) {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.update_spline_from_p1_to_p2();
                this.record_replan(agent);
            }
        }
        return {
            x: this.p1.x,
            y: this.p1.y,
            orientation: this.p1.orientation,
        };
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
            angle: this.p1.orientation,
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
        let thetaP2 = this.is_p2_p3() ? this.p3.orientation : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
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
            angle: this.p3.orientation,
            color: colors.p3,
            dash: [6, 4]
        });
        draw_text(ctx, {
            coordinate: [this.p3.x - 10, this.p3.y - 15],
            text: `${this.name} Target`,
            color: this.colorText,
        });
    }

    draw(ctx) {
        this.draw_waypoints(ctx);
        if (!this.spline) return;
        const curvePoints = [];
        for (let t = 0; t <= 1.001; t += 0.01) {
            const pt = evaluate_quintic_2d(this.spline, t);
            curvePoints.push([pt.x, pt.y]);
        }
        draw_curve(ctx, curvePoints, {
            color: this.colorPath,
            dash: [2, 8],
        });
    }
}

export {
    PlannerWASP,
};
