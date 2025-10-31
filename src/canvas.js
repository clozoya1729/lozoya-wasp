function draw_circle(canvas, radius, centroid, color = '#6d1b7b', linewidth = 1, alpha = 1, fill = false) {
    canvas.save();
    canvas.globalAlpha = alpha;
    canvas.lineWidth = linewidth;
    canvas.strokeStyle = color;
    canvas.beginPath();
    canvas.arc(centroid[0], centroid[1], radius, 0, 2 * Math.PI);
    if (fill) {
        canvas.fill();
    }
    canvas.stroke();
    canvas.restore();
}

function draw_curve(canvas, curve, color = '#888', linewidth = 1, alpha = 1) {

}

function draw_line(canvas, start, end, color = '#888', linewidth = 1, alpha = 1) {
    canvas.save();
    canvas.strokeStyle = color;
    canvas.lineWidth = linewidth;
    canvas.globalAlpha = alpha;
    canvas.beginPath();
    canvas.moveTo(start[0], start[1]);
    canvas.lineTo(end[0], end[1]);
    canvas.stroke();
}

function draw_tangent(canvas, start, theta, color = '#888', linewidth = 1, alpha = 1) {
    canvas.save();
    canvas.strokeStyle = color;
    canvas.lineWidth = linewidth;
    canvas.globalAlpha = alpha;
    canvas.beginPath();
    canvas.moveTo(start.x, start.y);
    canvas.lineTo(start.x + 44 * Math.cos(theta), start.y + 44 * Math.sin(theta));
    canvas.setLineDash([6, 4]);
    canvas.stroke();
    canvas.setLineDash([]);
    canvas.restore();
}

function draw_text(canvas, coordinate, text, font, color) {
    canvas.save();
    canvas.font = font;
    canvas.fillStyle = color;
    canvas.fillText(text, coordinate[0], coordinate[1]);
    canvas.restore();
}

export {
    draw_circle,
    draw_curve,
    draw_line,
    draw_tangent,
    draw_text,
};