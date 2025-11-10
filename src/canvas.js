function draw_circle(ctx, radius, centroid, color = '#6d1b7b', linewidth = 1, alpha = 1, fill = false) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = linewidth;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centroid[0], centroid[1], radius, 0, 2 * Math.PI);
    if (fill) {
        ctx.fill();
    }
    ctx.stroke();
    ctx.restore();
}

function draw_curve(ctx, curve, color = '#888', linewidth = 1, alpha = 1) {

}

function draw_line(ctx, start, end, color = '#888', linewidth = 1, alpha = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
    ctx.restore();
}

function draw_rectangle(ctx, parameters) {
    let {
        coordinate = [0, 0],
        width = 20,
        height = 10,
        orientation = 0,
        colorFill = '#0ff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
    } = parameters;
    ctx.save();
    ctx.translate(coordinate[0], coordinate[1]);
    ctx.rotate(orientation);
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = colorFill;
    ctx.globalAlpha = opacityFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.stroke();
    ctx.restore();
}

function draw_square(ctx, parameters) {
    let {size = 12, ...rest} = parameters;
    draw_rectangle(ctx, {width: size, height: size, ...rest});
}

function draw_tangent(ctx, start, theta, color = '#888', linewidth = 1, alpha = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + 44 * Math.cos(theta), start.y + 44 * Math.sin(theta));
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function draw_text(ctx, coordinate, text, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, coordinate[0], coordinate[1]);
    ctx.restore();
}

function draw_triangle(ctx, parameters) {
    let {
        coordinate = [0, 0],
        orientation = 0,
        colorFill = '#0ff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
    } = parameters;
    ctx.save();
    ctx.translate(coordinate[0], coordinate[1]);
    ctx.rotate(orientation);
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = colorFill;
    ctx.globalAlpha = opacityFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.stroke();
    ctx.rotate(-orientation);
    ctx.restore();
}

export {
    draw_circle,
    draw_curve,
    draw_line,
    draw_rectangle,
    draw_square,
    draw_tangent,
    draw_text,
    draw_triangle,
};