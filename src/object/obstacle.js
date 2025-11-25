import {draw_circle, draw_text, draw_triangle, SVG} from '../canvas.js';

class Obstacle {
    constructor(parameters) {
        let {
            positionX = 0,
            positionY = 0,
            radius = 30,
            velocityX = 0,
            velocityY = 0,
            name = '',
            renderParameters = {},
        } = parameters;
        this.positionX = positionX;
        this.positionY = positionY;
        this.radius = radius;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.trail = [];
        this.trailAccum = 0;
        // render
        this.name = name;
        this.renderParameters = {
            canvas: null,
            svgTemplate: null,
            svgSize: null,
            colorFill: '#a40',
            colorOutline: '#a40',
            colorTrail: '#a40',
            opacityFill: 0.1,
            opacityOutline: 1,
            sizeTrail: 1,
            intervalTrail: 0.5,
            ...renderParameters
        }
        this.svg = null;
        this.t = 0;
        if (this.renderParameters.canvas && this.renderParameters.svgTemplate) {
            this.svg = new SVG(this.renderParameters.canvas, this.renderParameters.svgTemplate, {
                position: {x: this.positionX, y: this.positionY},
                orientation: 0,
                size: this.renderParameters.svgSize,
                zIndex: 10,
            });
            this.svg.sync();
        }
    }

    trail_update(dt) {
        this.trailAccum += dt;
        if (this.trail.length === 0 || this.trailAccum >= this.renderParameters.intervalTrail) {
            this.trail.push({x: this.positionX, y: this.positionY});
            this.trailAccum = 0;
        }
    }

    step(dt) {
        this.t += dt;
        this.trail_update(dt);
        const vx = typeof this.velocityX === 'function'
            ? this.velocityX(this.positionX, this.positionY, this.t)
            : this.velocityX;
        const vy = typeof this.velocityY === 'function'
            ? this.velocityY(this.positionX, this.positionY, this.t)
            : this.velocityY;
        this.positionX += vx * dt;
        this.positionY += vy * dt;
    }

    draw_trail(ctx) {
        if (this.trail.length < 2) return;
        for (let i = 1; i < this.trail.length; ++i) {
            const prev = this.trail[i - 1];
            const curr = this.trail[i];
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            draw_triangle(ctx, {
                coordinate: [curr.x, curr.y],
                orientation: angle,
                size: this.renderParameters.sizeTrail,
                colorFill: this.renderParameters.colorTrail,
                colorOutline: this.renderParameters.colorTrail,
                opacityFill: 1,
                opacityOutline: 1,
            });
        }
    }

    draw(ctx) {
        this.draw_trail(ctx);
        draw_circle(ctx, {
            radius: this.radius,
            centroid: [this.positionX, this.positionY],
            colorFill: this.renderParameters.colorFill,
            colorOutline: this.renderParameters.colorOutline,
            opacityFill: this.renderParameters.opacityFill,
            opacityOutline: this.renderParameters.opacityOutline,
            collision: true,
            meta: {
                kind: 'obstacle',
                name: this.name,
            },
        });
        if (this.svg) {
            this.svg.position.x = this.positionX;
            this.svg.position.y = this.positionY;
            this.svg.orientation = 0;
            this.svg.size = this.renderParameters.svgSize;
            this.svg.sync();
        }
        if (this.name) {
            draw_text(ctx, {
                coordinate: [this.positionX, this.positionY - this.radius - 6],
                text: this.name,
                opacity: 1,
            });
        }
    }

    undraw(ctx) {
        if (this.svg && this.svg.remove) {
            this.svg.remove();
        }
        this.svg = null;
    }
}

export {
    Obstacle,
}