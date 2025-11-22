import {draw_circle, draw_rectangle, draw_text, svg_instantiate, svg_sync} from './canvas.js';

class Obstacle {
    constructor(parameters) {
        let {
            positionX = 0,
            positionY = 0,
            radius = 30,
            velocityX = 0,
            velocityY = 0,
            colorFill = '#a40',
            colorOutline = '#a40',
            name = '',
            opacityFill = 0.1,
            opacityOutline = 1,
            canvas = null,
            svgTemplate = null,
            svgSize = null,
        } = parameters;
        this.positionX = positionX;
        this.positionY = positionY;
        this.radius = radius;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        // render
        this.colorFill = colorFill;
        this.colorOutline = colorOutline;
        this.name = name;
        this.opacityFill = opacityFill;
        this.opacityOutline = opacityOutline;
        this.canvas = canvas;
        this.svgTemplate = svgTemplate;
        this.svgSize = svgSize ?? 3 * radius;
        this.svg = null;
        this.t = 0;
        if (this.canvas && this.svgTemplate) {
            this.svg = svg_instantiate(this.svgTemplate, {size: 3 * this.radius});
            svg_sync(this.canvas, this.svg, {x: this.positionX, y: this.positionY}, 0, this.svgSize);
        }
    }

    step(dt) {
        this.t += dt;
        const vx = typeof this.velocityX === 'function' ? this.velocityX(this.t) : this.velocityX;
        const vy = typeof this.velocityY === 'function' ? this.velocityY(this.t) : this.velocityY;
        this.positionX += vx * dt;
        this.positionY += vy * dt;
    }

    draw(ctx) {
        draw_circle(ctx, {
            radius: this.radius,
            centroid: [this.positionX, this.positionY],
            colorFill: this.colorFill,
            colorOutline: this.colorOutline,
            opacityFill: this.opacityFill,
            opacityOutline: this.opacityOutline,
            collision: true,
            meta: {kind: 'obstacle', name: this.name},
        });
        draw_rectangle(ctx, {
            coordinate: [this.positionX, this.positionY],
            orientation: 0,
            opacityFill: 0.5,
        });
        if (this.canvas && this.svgTemplate) {
            svg_sync(this.canvas, this.svg, {x: this.positionX, y: this.positionY}, 0, this.svgSize);
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