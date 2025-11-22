import {draw_circle, draw_curve, draw_rectangle, draw_tangent, draw_text, svg_instantiate, svg_sync} from './canvas.js';
import {compute_arc_length_table, evaluate_quintic_2d, fit_quintic, get_t_for_arc_length, quintic_tangent, tangent_vector} from './math.js';

class Agent {
    constructor(parameters = {}) {
        let name = parameters.name ?? 'Agent';
        let positionX = parameters.positionX ?? 100;
        let positionY = parameters.positionY ?? 350;
        let speed = parameters.speed ?? 100;
        let targetX = parameters.targetX ?? 700;
        let targetY = parameters.targetY ?? 100;
        let targetOrientation = parameters.targetOrientation ?? 0;
        let lidar = parameters.lidar ?? null;
        let tangentScaleFrac = parameters.tangentScaleFrac ?? 1;
        let lidarRange = parameters.lidarRange ?? 40;
        let lidarFov = parameters.lidarFov ?? Math.PI / 2;
        let numLidar = parameters.numLidar ?? 9;
        let p2SnapLookaheadSec = parameters.p2SnapLookaheadSec ?? 0.20;
        let p2SnapDistance = parameters.p2SnapDistance ?? 6;
        let collisionRadius = parameters.collisionCircle ?? 30;
        let collisionMargin = parameters.collisionMargin ?? 0;
        let colorPath = parameters.colorPath ?? '#888';
        let colorTrail = parameters.colorTrail ?? '#000';
        let colorBodyFill = parameters.colorBodyFill ?? '#fff';
        let colorBodyOutline = parameters.colorBodyOutline ?? '#888';
        let colorText = parameters.colorText ?? '#888';
        let planner = parameters.planner;
        let svgSize = parameters.svgSize ?? 3 * (lidar ? lidar.range : 40);
        let svgTemplate = parameters.svgTemplate ?? null;
        let canvas = parameters.canvas ?? null;
        this.name = name;
        this.p1 = {x: positionX, y: positionY};
        this.p2 = {x: targetX, y: targetY};
        this.p3 = {x: targetX, y: targetY};
        this.orientation = -Math.PI / 3;
        this.targetOrientation = targetOrientation;
        this.tangentScaleFrac = tangentScaleFrac;
        this.currentSpline = null;
        this.arcLengthTable = [];
        this.arcLen = 0;
        this.speed = speed;
        this.lidar = lidar;
        if (this.lidar) {
            this.lidar.range = lidarRange;
            this.lidar.fov = lidarFov;
            this.lidar.numRays = numLidar;
        }
        this.p2SnapLookaheadSec = p2SnapLookaheadSec;
        this.p2SnapDistance = p2SnapDistance;
        this.collisionRadius = collisionRadius;
        this.collisionMargin = collisionMargin;
        this.colorBodyFill = colorBodyFill;
        this.colorBodyOutline = colorBodyOutline;
        this.colorText = colorText;
        this.trail = [];
        this.colorTrail = colorTrail;
        this.colorPath = colorPath;
        this.lastTrailTime = null;
        this.planner = planner;
        this.canvas = canvas;
        this.svgTemplate = svgTemplate;
        this.svg = null;
        this.svgSize = svgSize;
        if (this.canvas && this.svgTemplate) {
            this.svg = svg_instantiate(this.svgTemplate, {size: 400});
            svg_sync(this.canvas, this.svg, this.p1, this.orientation, this.svgSize);
        }
        this.update_spline_from_p1_to_p2();
    }

    set_target_tangent(thetaRad) {
        this.targetOrientation = thetaRad;
        if (this.is_p2_p3()) this.update_spline_from_p1_to_p2();
    }

    is_p2_p3() {
        return this.p2.x === this.p3.x && this.p2.y === this.p3.y;
    }

    update_spline_from_p1_to_p2() {
        let segLen = Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y) * this.tangentScaleFrac;
        let va = tangent_vector(this.orientation, segLen);
        let thetaP2 = this.is_p2_p3() ? this.targetOrientation : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
        let vb = tangent_vector(thetaP2, segLen);
        this.currentSpline = fit_quintic(this.p1, va, this.p2, vb);
        this.arcLengthTable = compute_arc_length_table(this.currentSpline, 200);
        this.arcLen = 0;
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
        let thetaP2 = this.is_p2_p3() ? this.targetOrientation : Math.atan2(this.p3.y - this.p2.y, this.p3.x - this.p2.x);
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
            angle: this.targetOrientation,
            color: colors.p3,
            dash: [6, 4]
        });
        draw_text(ctx, {
            coordinate: [this.p3.x - 10, this.p3.y - 15],
            text: `${this.name} Target`,
            color: this.colorText,
        });
    }

    trail_update(ts) {
        if (this.lastTrailTime === null) this.lastTrailTime = ts;
        if (ts - this.lastTrailTime >= 100 || this.trail.length === 0) {
            this.trail.push({x: this.p1.x, y: this.p1.y});
            this.lastTrailTime = ts;
        }
    }

    step(ts, dt, get_collision_geometry) {
        this.trail_update(ts);
        if (this.planner && typeof this.planner.update === 'function') {
            this.planner.update(ts, dt, this, get_collision_geometry);
        } else if (this.lidar) {
            this.lidar.position = this.p1;
            this.lidar.orientation = this.orientation;
        }
        if (!this.currentSpline || this.arcLengthTable.length === 0) return;
        this.arcLen += this.speed * dt;
        let total = this.arcLengthTable[this.arcLengthTable.length - 1].arcLen;
        if (this.arcLen > total) this.arcLen = total;
        let t = get_t_for_arc_length(this.arcLengthTable, this.arcLen);
        let p = evaluate_quintic_2d(this.currentSpline, t);
        let th = quintic_tangent(this.currentSpline, t);
        this.p1.x = p.x;
        this.p1.y = p.y;
        this.orientation = th;
        if (!this.is_p2_p3()) {
            let remaining = total - this.arcLen;
            let distLookahead = Math.max(this.p2SnapDistance ?? 6, this.speed * (this.p2SnapLookaheadSec ?? 0.2));
            if (remaining <= distLookahead) {
                this.p2.x = this.p3.x;
                this.p2.y = this.p3.y;
                this.update_spline_from_p1_to_p2();
            }
        }
    }

    draw_path(ctx) {
        this.draw_waypoints(ctx);
        if (!this.currentSpline) return;
        const curvePoints = [];
        for (let t = 0; t <= 1.001; t += 0.01) {
            const pt = evaluate_quintic_2d(this.currentSpline, t);
            curvePoints.push([pt.x, pt.y]);
        }
        draw_curve(ctx, curvePoints, {
            color: this.colorPath,
            dash: [2, 8],
        });
    }

    draw_trail(ctx) {
        for (let i = 0; i < this.trail.length; ++i) {
            draw_circle(ctx, {
                radius: 0.4,
                centroid: [this.trail[i].x, this.trail[i].y],
                colorOutline: this.colorTrail,
                colorFill: this.colorTrail,
                opacityFill: 1,
            });
        }
    }

    draw(ctx) {
        this.draw_path(ctx);
        this.draw_trail(ctx);
        if (this.lidar) {
            draw_circle(ctx, {
                radius: this.lidar.range,
                centroid: [this.p1.x, this.p1.y],
                colorOutline: '#0ff',
                opacityFill: 0,
                opacityOutline: 0.2,
            });
        }
        draw_rectangle(ctx, {
            coordinate: [this.p1.x, this.p1.y],
            orientation: this.orientation,
            colorFill: this.colorBodyFill,
            colorOutline: this.colorBodyOutline,
            height: 30,
            width: 30,
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
            collision: true,
            meta: {kind: 'agent', name: this.name},
        });
        if (this.canvas && this.svgTemplate && this.svg) {
            svg_sync(this.canvas, this.svg, this.p1, this.orientation, this.svgSize);
        }
    }

    undraw(ctx) {
        if (this.svg && this.svg.remove) {
            this.svg.remove();
        }
        this.svg = null;
    }
}

export {Agent};
