import {draw_circle, draw_rectangle, draw_text} from './canvas.js';

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
    }

    step(dt) {
        // Move if dynamic
        this.positionX += this.velocityX * dt;
        this.positionY += this.velocityY * dt;
    }

    draw(ctx) {
        draw_circle(ctx, {
            radius: this.radius,
            centroid: [this.positionX, this.positionY],
            colorFill: this.colorFill,
            colorOutline: this.colorOutline,
            opacityFill: this.opacityFill,
            opacityOutline: this.opacityOutline,
        });
        draw_rectangle(ctx, {
            coordinate: [this.positionX, this.positionY],
            orientation: 0,
            opacityFill: 0.5,
        });
        if (this.name) {
            draw_text(ctx, {
                coordinate: [this.positionX, this.positionY - this.radius - 6],
                text: this.name,
                opacity: 1,
            });
        }
        ctx.restore();
    }
}

export {
    Obstacle,
}