import {draw_circle} from './canvas.js';

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
        draw_circle(ctx, this.radius, [this.positionX, this.positionY]);
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.positionX, this.positionY, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.colorFill;
        ctx.globalAlpha = this.opacityFill;
        ctx.fill();
        ctx.globalAlpha = this.opacityOutline;
        ctx.strokeStyle = this.colorOutline;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "bold 15px monospace";
        ctx.fillStyle = "#b00";
        if (this.name) {
            ctx.fillText(this.name, this.positionX - 29, this.positionY - this.radius - 6);
        }
        ctx.restore();
    }
}

export {
    Obstacle,
}