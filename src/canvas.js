function draw_circle(ctx, parameters = {}) {
    let {
        radius = 1,
        centroid = [0, 0],
        colorFill = '#fff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
        linewidth = 1,
        dash = [],
    } = parameters;
    ctx.save();
    ctx.lineWidth = linewidth;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.beginPath();
    ctx.arc(centroid[0], centroid[1], radius, 0, 2 * Math.PI);
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.globalAlpha = opacityFill;
    ctx.fillStyle = colorFill;
    ctx.fill();
    ctx.setLineDash([]);
    ctx.restore();
}

function draw_curve(ctx, points, parameters = {}) {
    let {
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = opacity;
    if (dash && dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    if (dash && dash.length) ctx.setLineDash([]);
    ctx.restore();
}

function draw_line(ctx, parameters = {}) {
    let {
        start = [0, 0],
        end = [1, 1],
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function draw_rectangle(ctx, parameters = {}) {
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

function draw_square(ctx, parameters = {}) {
    let {size = 12, ...rest} = parameters;
    draw_rectangle(ctx, {width: size, height: size, ...rest});
}

function draw_tangent(ctx, parameters = {}) {
    let {
        start = [0, 0],
        length = 100,
        angle = 0,
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    let end = [start[0] + length * Math.cos(angle), start[1] + length * Math.sin(angle)];
    draw_line(ctx, {
        start: start,
        end: end,
        color: color,
        linewidth: linewidth,
        opacity: opacity,
        dash: dash,
    })
}

function draw_text(ctx, parameters = {}) {
    let {
        coordinate = [0, 0],
        text = 'TEXT',
        font = '10pt Arial',
        color = '#888',
        opacity = 1,
    } = parameters;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, coordinate[0], coordinate[1]);
    ctx.restore();
}

function draw_triangle(ctx, parameters = {}) {
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

function svg_instantiate(templateId, parameters = {}) {
    let {
        size = 100,
        anchor = 'origin',  // 'center' or 'origin
        zIndex = 10,
    } = parameters;
    const template = document.getElementById(templateId);
    const clone = template.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.position = 'absolute';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.width = size + 'px';
    clone.style.height = size + 'px';
    clone.style.pointerEvents = 'none';
    clone.style.transformBox = 'fill-box';
    clone.style.zIndex = String(zIndex);
    clone.dataset.anchor = anchor;
    clone.style.transformOrigin = clone.dataset.anchor === 'origin' ? '0 0' : '50% 50%';
    document.body.appendChild(clone);
    return clone;
}

function svg_sync(svg, position, orientation, parameters = {}) {
    let {
        size = 100,
    } = parameters;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    if (size != null) {
        svg.style.width = size + 'px';
        svg.style.height = size + 'px';
    }
    const w = parseFloat(svg.style.width) || size;
    const h = parseFloat(svg.style.height) || w;
    const anchor = svg.dataset.anchor || 'center';
    const left = rect.left + window.scrollX + position.x * sx - (anchor === 'center' ? w / 2 : 0);
    const top = rect.top + window.scrollY + position.y * sy - (anchor === 'center' ? h / 2 : 0);
    svg.style.left = left + 'px';
    svg.style.top = top + 'px';
    if (orientation != null) svg.style.transform = 'rotate(' + (orientation * 180 / Math.PI) + 'deg)';
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
    svg_instantiate,
    svg_sync,
};