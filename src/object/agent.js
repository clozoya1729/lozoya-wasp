import {draw_robot_arm, draw_triangle, SVG,} from '../canvas.js';
import {PlannerWASP} from "../planners/wasp.js";
import {Lidar} from './sensor.js';

class Agent {
    constructor(parameters = {}) {
        let {
            renderParameters = {},
            name = 'Agent',
            positionX = 100,
            positionY = 100,
            orientation = 0,
            speed = 100,
            targetX = 500,
            targetY = 500,
            targetOrientation = 0,
            planner = PlannerWASP,
            plannerParameters = {},
            lidarParameters = {}
        } = parameters;
        this.time = 0;
        this.position = {x: positionX, y: positionY};
        this.orientation = orientation;
        this.targetX = targetX;
        this.targetY = targetY;
        this.targetOrientation = targetOrientation;
        this.name = name;
        this.speed = speed;
        this.trail = [];
        this.replans = [];
        this.lastTrailTime = null;
        this.trailAccum = 0;
        this.lidar = new Lidar(lidarParameters);
        this.lidar.position = {x: this.position.x, y: this.position.y};
        this.lidar.orientation = this.orientation;
        this.plannerParameters = plannerParameters;
        this.planner = new planner({
            initialX: this.position.x,
            initialY: this.position.y,
            initialOrientation: this.orientation,
            targetX: this.targetX,
            targetY: this.targetY,
            targetOrientation: this.targetOrientation,
            name: this.name,
            ...this.plannerParameters,
        });
        this.renderParameters = {
            canvas: null,
            colorBodyFill: '#fff',
            colorBodyOutline: '#888',
            colorPath: '#888',
            colorTrail: '#000',
            colorReplanTrail: '#f00',
            colorText: '#888',
            sizeTrail: 1,
            intervalTrail: 0.15,
            spriteScale: 0.25,
            svgSize: 1,
            svgTemplate: null,
            ...renderParameters,
        };
        if (this.renderParameters.canvas && this.renderParameters.svgTemplate) {
            this.svg = new SVG(this.renderParameters.canvas, this.renderParameters.svgTemplate, {
                position: {x: this.position.x, y: this.position.y},
                orientation: this.orientation,
                size: this.renderParameters.svgSize,
                zIndex: 20,
            });
            this.svg.sync();
        }
    }

    mark_replan(time) {
        if (!this.trail.length) return;
        let index = this.trail.length - 1;
        for (let i = 0; i < this.trail.length; ++i) {
            if (this.trail[i].t >= time) {
                index = i;
                break;
            }
        }
        this.trail[index].replan = true;
    }


    trail_update(dt) {
        this.trailAccum += dt;
        if (this.trail.length === 0 || this.trailAccum >= this.renderParameters.intervalTrail) {
            this.trail.push({
                t: this.time,
                x: this.position.x,
                y: this.position.y,
                orientation: this.orientation,
            });
            this.trailAccum = 0;
        }
    }

    step(ts, dt, collision_geometry_get) {
        this.time += dt;
        this.trail_update(dt);
        if (this.lidar) {
            this.lidar.position = {
                x: this.position.x,
                y: this.position.y,
            };
            this.lidar.orientation = this.orientation;
        }
        if (this.planner && typeof this.planner.update === 'function') {
            let pose = this.planner.update(ts, dt, this, collision_geometry_get);
            this.position = {
                x: pose.x,
                y: pose.y,
            };
            this.orientation = pose.orientation;
        }
    }

    draw_trail(ctx) {
        if (this.trail.length < 2) return;
        for (let i = 1; i < this.trail.length; ++i) {
            const prev = this.trail[i - 1];
            const curr = this.trail[i];
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const isReplan = !!curr.replan;
            const color = isReplan ? this.renderParameters.colorReplanTrail : this.renderParameters.colorTrail;
            draw_triangle(ctx, {
                coordinate: [curr.x, curr.y],
                orientation: angle,
                size: this.renderParameters.sizeTrail,
                colorFill: color,
                colorOutline: color,
                opacityFill: 1,
                opacityOutline: 1,
            });
        }
    }

    draw(ctx) {
        this.planner.draw(ctx);
        this.draw_trail(ctx);
        draw_robot_arm(ctx, {
            position: this.position,
            orientation: this.orientation,
            name: this.name,
            scale: this.renderParameters.spriteScale,
            colorBodyFill: this.renderParameters.colorBodyFill,
            colorOutlineFill: this.renderParameters.colorOutlineFill,
            collision: true,
            meta: {
                kind: 'agent',
                name: this.name,
            },
        });
        if (this.svg) {
            this.svg.position.x = this.position.x;
            this.svg.position.y = this.position.y;
            this.svg.orientation = this.orientation;
            this.svg.size = this.renderParameters.svgSize;
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

export {
    Agent,
};
