import {draw_circle, draw_curve, draw_rectangle, draw_tangent, draw_text, SVG,} from '../canvas.js';
import {
    compute_arc_length_table,
    evaluate_quintic_2d,
    fit_quintic,
    get_t_for_arc_length,
    quintic_tangent,
    tangent_vector
} from '../math.js';

class Agent {
    constructor(parameters = {}) {
        let {
            colorBodyFill = '#fff',
            colorBodyOutline = '#888',
            colorPath = '#888',
            colorTrail = '#000',
            name = 'Agent',
            positionX = 100,
            positionY = 100,
            speed = 100,
            targetX = 500,
            targetY = 500,
        } = parameters;
        this.positionX = positionX;
        this.positionY = positionY;
        this.targetX = targetX;
        this.targetY = targetY;
        let targetOrientation = parameters.targetOrientation ?? 0;
        let lidar = parameters.lidar ?? null;
        let collisionRadius = parameters.collisionCircle ?? 0;
        let collisionMargin = parameters.collisionMargin ?? 0;
        let colorText = parameters.colorText ?? '#888';
        let planner = parameters.planner;
        let svgSize = parameters.svgSize ?? 3 * (lidar ? lidar.range : 40);
        let svgTemplate = parameters.svgTemplate ?? null;
        let canvas = parameters.canvas ?? null;
        this.name = name;
        this.orientation = -Math.PI / 3;
        this.targetOrientation = targetOrientation;
        this.speed = speed;
        this.lidar = lidar;
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
        this.spriteScale = parameters.spriteScale ?? 0.3;
        //move to lidar
        let lidarRange = parameters.lidarRange ?? 40;
        let lidarFov = parameters.lidarFov ?? Math.PI / 2;
        let numLidar = parameters.numLidar ?? 9;
        if (this.lidar) {
            this.lidar.range = lidarRange;
            this.lidar.fov = lidarFov;
            this.lidar.numRays = numLidar;
        }
        //end move
        // move to wasp
        let p2SnapLookaheadSec = parameters.p2SnapLookaheadSec ?? 0.20;
        let p2SnapDistance = parameters.p2SnapDistance ?? 6;
        let tangentScaleFrac = parameters.tangentScaleFrac ?? 1;
        this.p1 = {x: positionX, y: positionY};
        this.p2 = {x: targetX, y: targetY};
        this.p3 = {x: targetX, y: targetY};
        this.tangentScaleFrac = tangentScaleFrac;
        this.currentSpline = null;
        this.arcLengthTable = [];
        this.arcLen = 0;
        this.p2SnapDistance = p2SnapDistance;
        this.p2SnapLookaheadSec = p2SnapLookaheadSec;
        // end move
        // end move
        if (this.canvas && this.svgTemplate) {
            this.svg = new SVG(this.canvas, this.svgTemplate, {
                position: {x: this.p1.x, y: this.p1.y},
                orientation: this.orientation,
                size: this.svgSize,
                zIndex: 20,
            });
            this.svg.sync();
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

    draw_canvas_sprite(ctx) {
        const s = this.spriteScale ?? 1;
        const meta = {kind: 'agent', name: this.name};
        let frame = {x: this.p1.x, y: this.p1.y, angle: this.orientation};
        const stack = [];

        function pushFrame() {
            stack.push({...frame});
        }

        function popFrame() {
            frame = stack.pop();
        }

        function rotateFrame(delta) {
            frame.angle += delta;
        }

        function translateFrameLocal(dx, dy) {
            const cosA = Math.cos(frame.angle);
            const sinA = Math.sin(frame.angle);
            frame.x += s * (dx * cosA - dy * sinA);
            frame.y += s * (dx * sinA + dy * cosA);
        }

        function worldPoint(localX, localY) {
            const cosA = Math.cos(frame.angle);
            const sinA = Math.sin(frame.angle);
            return {
                x: frame.x + s * (localX * cosA - localY * sinA),
                y: frame.y + s * (localX * sinA + localY * cosA),
            };
        }

        // base at origin
        {
            const c = worldPoint(0, 0);
            draw_circle(ctx, {
                radius: 10 * s,
                centroid: [c.x, c.y],
                colorFill: '#f64',
                colorOutline: '#000',
                opacityFill: 1,
                opacityOutline: 1,
                collision: true,
                meta,
            });
        }
        // first link
        pushFrame();
        rotateFrame(0);
        {
            const cRect = worldPoint(22.5, 0);
            draw_rectangle(ctx, {
                coordinate: [cRect.x, cRect.y],
                width: 45 * s,
                height: 12 * s,
                orientation: frame.angle,
                colorFill: '#aaa',
                colorOutline: '#000',
                opacityFill: 1,
                opacityOutline: 1,
                collision: true,
                meta,
            });
            const cCircle = worldPoint(45, 0);
            draw_circle(ctx, {
                radius: 8 * s,
                centroid: [cCircle.x, cCircle.y],
                colorFill: '#f64',
                colorOutline: '#000',
                opacityFill: 1,
                opacityOutline: 1,
                collision: true,
                meta,
            });
            // second link
            pushFrame();
            translateFrameLocal(45, 0);
            rotateFrame(-25 * Math.PI / 180);
            {
                const cRect2 = worldPoint(20, 0);
                draw_rectangle(ctx, {
                    coordinate: [cRect2.x, cRect2.y],
                    width: 40 * s,
                    height: 10 * s,
                    orientation: frame.angle,
                    colorFill: '#888',
                    colorOutline: '#000',
                    opacityFill: 1,
                    opacityOutline: 1,
                    collision: true,
                    meta,
                });
                const cCircle2 = worldPoint(40, 0);
                draw_circle(ctx, {
                    radius: 7 * s,
                    centroid: [cCircle2.x, cCircle2.y],
                    colorFill: '#f64',
                    colorOutline: '#000',
                    opacityFill: 1,
                    opacityOutline: 1,
                    collision: true,
                    meta,
                });
                // third link
                pushFrame();
                translateFrameLocal(40, 0);
                rotateFrame(30 * Math.PI / 180);
                {
                    const cRect3 = worldPoint(17.5, 0);
                    draw_rectangle(ctx, {
                        coordinate: [cRect3.x, cRect3.y],
                        width: 35 * s,
                        height: 8 * s,
                        orientation: frame.angle,
                        colorFill: '#aaa',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: true,
                        meta,
                    });
                    const cCircle3 = worldPoint(35, 0);
                    draw_circle(ctx, {
                        radius: 6 * s,
                        centroid: [cCircle3.x, cCircle3.y],
                        colorFill: '#f64',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: true,
                        meta,
                    });
                    // end effector (gripper)
                    pushFrame();
                    translateFrameLocal(35, 0);
                    {
                        const cBlock = worldPoint(3, 0);
                        draw_rectangle(ctx, {
                            coordinate: [cBlock.x, cBlock.y],
                            width: 18 * s,
                            height: 20 * s,
                            orientation: frame.angle,
                            colorFill: '#888',
                            colorOutline: '#000',
                            opacityFill: 1,
                            opacityOutline: 1,
                            collision: true,
                            meta,
                        });
                        const cBarTop = worldPoint(25, -13);
                        draw_rectangle(ctx, {
                            coordinate: [cBarTop.x, cBarTop.y],
                            width: 26 * s,
                            height: 6 * s,
                            orientation: frame.angle,
                            colorFill: '#888',
                            colorOutline: '#000',
                            opacityFill: 1,
                            opacityOutline: 1,
                            collision: true,
                            meta,
                        });
                        const cBarBot = worldPoint(25, 13);
                        draw_rectangle(ctx, {
                            coordinate: [cBarBot.x, cBarBot.y],
                            width: 26 * s,
                            height: 6 * s,
                            orientation: frame.angle,
                            colorFill: '#888',
                            colorOutline: '#000',
                            opacityFill: 1,
                            opacityOutline: 1,
                            collision: true,
                            meta,
                        });
                        const cTipTop = worldPoint(38, -13);
                        draw_rectangle(ctx, {
                            coordinate: [cTipTop.x, cTipTop.y],
                            width: 4 * s,
                            height: 6 * s,
                            orientation: frame.angle,
                            colorFill: '#888',
                            colorOutline: '#000',
                            opacityFill: 1,
                            opacityOutline: 1,
                            collision: true,
                            meta,
                        });
                        const cTipBot = worldPoint(38, 13);
                        draw_rectangle(ctx, {
                            coordinate: [cTipBot.x, cTipBot.y],
                            width: 4 * s,
                            height: 6 * s,
                            orientation: frame.angle,
                            colorFill: '#888',
                            colorOutline: '#000',
                            opacityFill: 1,
                            opacityOutline: 1,
                            collision: true,
                            meta,
                        });
                    }
                    popFrame();
                }
                popFrame();
            }
            popFrame();
        }
        popFrame();
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
        draw_rectangle(ctx, {
            coordinate: [this.p1.x, this.p1.y],
            orientation: this.orientation,
            colorFill: this.colorBodyFill,
            colorOutline: this.colorBodyOutline,
            height: 30,
            width: 30,
            opacityFill: 0.5,
            collision: true,
            meta: {kind: 'agent', name: this.name},
        });
        this.draw_canvas_sprite(ctx);
        if (this.svg) {
            this.svg.position.x = this.p1.x;
            this.svg.position.y = this.p1.y;
            this.svg.orientation = this.orientation;
            this.svg.size = this.svgSize;
            this.svg.sync();
        }
    }

    undraw(ctx) {
        if (this.svg && this.svg.svg && this.svg.svg.remove) {
            this.svg.svg.remove();
        }
        this.svg = null;
    }
}

export {Agent};
